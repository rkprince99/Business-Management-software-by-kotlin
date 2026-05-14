# ERP Backend

This backend provides the `AuthService` gRPC implementation for the Android client.

## Setup

1. Install dependencies:

   ```bash
   cd backend
   npm install
   ```

2. Run the backend:

   ```bash
   npm start
   ```

3. The server listens on port `8001` by default.

## MongoDB

The backend uses the MongoDB URI from the environment variable `MONGO_URI`.
If you do not set it, it defaults to:

```text
mongodb+srv://test:You%40%40123@cluster0.p2xus.mongodb.net/ERP
```

## Default credentials

The backend creates a default login account automatically if it does not exist:

- username: `rakib`
- password: `rakib123`

## Android setup

If you run the backend on your local machine and test using the Android emulator, change the Android client server URL to `10.0.2.2:8001` for the debug/dev build.
