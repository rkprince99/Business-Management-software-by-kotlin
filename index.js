const path = require("path");
const http = require("http");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const { MongoClient, ObjectId } = require("mongodb");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");

const PROTO_ROOT = path.join(__dirname, "..", "app", "src", "main", "proto");
const PROTO_PATH = path.join(PROTO_ROOT, "users", "auth_service.proto");

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: false,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
  includeDirs: [PROTO_ROOT],
});

const proto = grpc.loadPackageDefinition(packageDefinition).wiradata.users;

const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://test:You%40%40123@cluster0.p2xus.mongodb.net/ERP";
const MONGO_DB = process.env.MONGO_DB || "ERP";
const GRPC_PORT = process.env.PORT || "8001";
const HTTP_PORT = process.env.HTTP_PORT || "8002";

const defaultUser = {
  username: "rakib",
  name: "Rakib",
  email: "rakib",
  role: "ADMIN",
  status: "ACTIVE",
  location_id: null,
  isTwoFactorEnabled: false,
};

function buildUserResponse(user) {
  return {
    id: user._id.toString(),
    companyId: user.company_id || "",
    regionId: user.region_id || "",
    branchId: user.branch_id || "",
    username: user.username || user.email || user.name || "",
    name: user.name || "",
    email: user.email || "",
    group: {
      id: user._id.toString(),
      companyId: user.company_id || "",
      name: user.role || "USER",
      isMutable: false,
      access: [
        {
          id: "1",
          name: user.role ? user.role.toUpperCase() : "USER",
          parentId: "",
          createdAt: "",
          createdBy: "",
          updatedAt: "",
          updatedBy: "",
        },
      ],
      createdAt: "",
      createdBy: "",
      updatedAt: "",
      updatedBy: "",
    },
    createdAt: user.createdAt ? user.createdAt.toISOString() : "",
    updatedAt: user.updatedAt ? user.updatedAt.toISOString() : "",
    updatedBy: user.updatedBy || "",
  };
}

async function ensureDefaultUser(usersCollection) {
  const existing = await usersCollection.findOne({
    $or: [
      { username: defaultUser.username },
      { email: defaultUser.email },
      { name: defaultUser.name },
    ],
  });

  if (existing) {
    console.log("Default user already exists:", existing._id.toString());
    return;
  }

  const hashedPassword = await bcrypt.hash("rakib123", 10);
  const now = new Date();
  const insertDoc = {
    ...defaultUser,
    password: hashedPassword,
    createdAt: now,
    updatedAt: now,
    __v: 0,
  };

  const result = await usersCollection.insertOne(insertDoc);
  console.log("Inserted default user with id", result.insertedId.toString());
}

function createServer(db) {
  const usersCollection = db.collection("users");
  const server = new grpc.Server();

  server.addService(proto.AuthService.service, {
    Login: async (call, callback) => {
      const { username, password } = call.request;
      if (!username || !password) {
        return callback(null, { token: "", user: {} });
      }

      const user = await usersCollection.findOne({
        $or: [{ username: username }, { email: username }, { name: username }],
      });

      if (!user || !user.password) {
        return callback(null, { token: "", user: {} });
      }

      const passwordMatches = await bcrypt.compare(password, user.password);
      if (!passwordMatches) {
        return callback(null, { token: "", user: {} });
      }

      const response = {
        token: uuidv4(),
        user: buildUserResponse(user),
      };

      callback(null, response);
    },
    ForgotPassword: (_call, callback) => {
      callback(null, {
        message: "ForgotPassword is not implemented in this backend.",
      });
    },
    ResetPassword: (_call, callback) => {
      callback(null, {
        message: "ResetPassword is not implemented in this backend.",
      });
    },
    ChangePassword: (_call, callback) => {
      callback(null, {
        message: "ChangePassword is not implemented in this backend.",
      });
    },
    IsAuth: (call, callback) => {
      const token = call.request.string || "";
      callback(null, { boolean: token !== "" });
    },
  });

  return server;
}

const MODULES = {
  sales: {
    collection: "sales",
    validate: (payload) => {
      const partyName = String(payload.partyName || "").trim();
      const itemName = String(payload.itemName || "").trim();
      const quantity = Number(payload.quantity || 0);
      const amount = Number(payload.amount || 0);

      if (!partyName || !itemName || quantity <= 0 || amount < 0) {
        return null;
      }

      return { partyName, itemName, quantity, amount };
    },
  },
  purchases: {
    collection: "purchases",
    validate: (payload) => {
      const partyName = String(payload.partyName || "").trim();
      const itemName = String(payload.itemName || "").trim();
      const quantity = Number(payload.quantity || 0);
      const amount = Number(payload.amount || 0);

      if (!partyName || !itemName || quantity <= 0 || amount < 0) {
        return null;
      }

      return { partyName, itemName, quantity, amount };
    },
  },
  accounts: {
    collection: "accounts",
    validate: (payload) => {
      const accountName = String(payload.accountName || "").trim();
      const accountType = String(payload.accountType || "").trim();
      const balance = Number(payload.balance || 0);

      if (!accountName || !accountType || Number.isNaN(balance)) {
        return null;
      }

      return { accountName, accountType, balance };
    },
  },
  items: {
    collection: "items",
    validate: (payload) => {
      const itemName = String(payload.itemName || "").trim();
      const unitPrice = Number(payload.unitPrice || 0);
      const stock = Number(payload.stock || 0);

      if (!itemName || unitPrice < 0 || stock < 0) {
        return null;
      }

      return { itemName, unitPrice, stock };
    },
  },
};

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.end(JSON.stringify(payload));
}

function mapDocument(doc) {
  return {
    id: doc._id.toString(),
    ...doc,
    _id: undefined,
  };
}

async function getDashboardSummary(db) {
  const [
    salesCount,
    purchasesCount,
    accountsCount,
    itemsCount,
    salesTotals,
    purchaseTotals,
    accountTotals,
  ] = await Promise.all([
    db.collection("sales").countDocuments(),
    db.collection("purchases").countDocuments(),
    db.collection("accounts").countDocuments(),
    db.collection("items").countDocuments(),
    db
      .collection("sales")
      .aggregate([{ $group: { _id: null, total: { $sum: "$amount" } } }])
      .toArray(),
    db
      .collection("purchases")
      .aggregate([{ $group: { _id: null, total: { $sum: "$amount" } } }])
      .toArray(),
    db
      .collection("accounts")
      .aggregate([{ $group: { _id: null, total: { $sum: "$balance" } } }])
      .toArray(),
  ]);

  return {
    salesCount,
    purchasesCount,
    accountsCount,
    itemsCount,
    totalSalesAmount: salesTotals[0]?.total || 0,
    totalPurchaseAmount: purchaseTotals[0]?.total || 0,
    totalAccountBalance: accountTotals[0]?.total || 0,
    generatedAt: new Date().toISOString(),
  };
}

function createHttpServer(db) {
  return http.createServer(async (req, res) => {
    const method = req.method || "GET";
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const parts = url.pathname.split("/").filter(Boolean);

    if (method === "OPTIONS") {
      sendJson(res, 200, { ok: true });
      return;
    }

    try {
      if (method === "GET" && url.pathname === "/health") {
        sendJson(res, 200, { ok: true, service: "erp-backend" });
        return;
      }

      if (method === "GET" && url.pathname === "/api/dashboard-summary") {
        const summary = await getDashboardSummary(db);
        sendJson(res, 200, summary);
        return;
      }

      if (parts[0] !== "api" || parts.length < 2) {
        sendJson(res, 404, { message: "Route not found" });
        return;
      }

      const moduleName = parts[1];
      const moduleConfig = MODULES[moduleName];

      if (!moduleConfig) {
        sendJson(res, 404, { message: "Invalid module" });
        return;
      }

      const collection = db.collection(moduleConfig.collection);

      if (method === "GET" && parts.length === 2) {
        const rows = await collection
          .find({})
          .sort({ updatedAt: -1 })
          .toArray();
        sendJson(res, 200, rows.map(mapDocument));
        return;
      }

      if (method === "POST" && parts.length === 2) {
        const payload = await readJsonBody(req);
        const normalized = moduleConfig.validate(payload);

        if (!normalized) {
          sendJson(res, 400, { message: "Invalid payload" });
          return;
        }

        const now = new Date();
        const insertDoc = {
          ...normalized,
          createdAt: now,
          updatedAt: now,
        };
        const result = await collection.insertOne(insertDoc);
        const doc = await collection.findOne({ _id: result.insertedId });
        sendJson(res, 201, mapDocument(doc));
        return;
      }

      if ((method === "PUT" || method === "DELETE") && parts.length === 3) {
        let objectId;
        try {
          objectId = new ObjectId(parts[2]);
        } catch (_error) {
          sendJson(res, 400, { message: "Invalid id" });
          return;
        }

        if (method === "DELETE") {
          const result = await collection.deleteOne({ _id: objectId });
          if (result.deletedCount === 0) {
            sendJson(res, 404, { message: "Record not found" });
            return;
          }

          sendJson(res, 200, { message: "Deleted" });
          return;
        }

        const payload = await readJsonBody(req);
        const normalized = moduleConfig.validate(payload);

        if (!normalized) {
          sendJson(res, 400, { message: "Invalid payload" });
          return;
        }

        const updateResult = await collection.findOneAndUpdate(
          { _id: objectId },
          { $set: { ...normalized, updatedAt: new Date() } },
          { returnDocument: "after" },
        );

        if (!updateResult.value) {
          sendJson(res, 404, { message: "Record not found" });
          return;
        }

        sendJson(res, 200, mapDocument(updateResult.value));
        return;
      }

      sendJson(res, 404, { message: "Route not found" });
    } catch (error) {
      console.error("HTTP API error:", error);
      sendJson(res, 500, { message: "Internal server error" });
    }
  });
}

async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  console.log("Connected to MongoDB");

  const db = client.db(MONGO_DB);
  const usersCollection = db.collection("users");

  await ensureDefaultUser(usersCollection);

  const server = createServer(db);
  const grpcAddress = `0.0.0.0:${GRPC_PORT}`;
  server.bindAsync(
    grpcAddress,
    grpc.ServerCredentials.createInsecure(),
    (err, port) => {
      if (err) {
        console.error("Server bind failed:", err);
        process.exit(1);
      }
      server.start();
      console.log(`gRPC server is running at ${grpcAddress}`);
    },
  );

  const httpServer = createHttpServer(db);
  httpServer.listen(Number(HTTP_PORT), "0.0.0.0", () => {
    console.log(`HTTP API server is running at 0.0.0.0:${HTTP_PORT}`);
  });
}

main().catch((error) => {
  console.error("Failed to start backend:", error);
  process.exit(1);
});
