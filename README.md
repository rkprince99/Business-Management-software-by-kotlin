# Sairah Trading ERP — Android (Kotlin + Jetpack Compose)

A native Android client for the existing **Sairah Trading ERP** (NestJS + MongoDB
backend, React + Tailwind web frontend). The Android app is a clean rewrite that
talks to the same `/api` REST endpoints used by the web client and mirrors the
brand, palette, and module structure.

> This is **not a WebView wrapper** — every screen is built with native Kotlin
> and Jetpack Compose. The web app under `erp_rakib-main/` and `backend/` is
> kept untouched.

## Stack

- Kotlin 1.9.22, AGP 8.2.x, JDK 17
- Jetpack Compose (Material 3) + Navigation Compose
- MVVM + Repository pattern, Hilt for DI
- Retrofit + OkHttp + Moshi for the network layer
- Coroutines + Flow / StateFlow for state management
- DataStore Preferences for the encrypted JWT session

## Module map (web → Android)

| Web route | Compose route | Roles |
|---|---|---|
| `/login` | `Routes.Login` | Public |
| `/` | `Routes.Dashboard` | ADMIN, ACCOUNTS |
| `/sales-entry` | `Routes.SalesEntry` | ADMIN, EMPLOYEE |
| `/sales-record`, `/sales-invoice`, `/sales-product-record` | `Routes.Sales*` | All |
| `/purchase-entry`, `/purchase-record`, `/product-record` | `Routes.Purchase*` | All / ADMIN+EMP |
| `/return-entry`, `/return-report` | `Routes.Returns` | All / ADMIN+ACCOUNTS |
| `/stock`, `/damage-stock` | `Routes.Stock`, `Routes.DamageStock` | All |
| `/customer-list`, `/customer-due`, `/customer-statement` | `Routes.Customer*` | varies |
| `/supplier-list`, `/supplier-statement` | `Routes.Supplier*` | varies |
| `/payment-report`, `/sales-due`, `/purchase-due` | `Routes.Payment*` | ADMIN+ACCOUNTS |
| `/e-invoice`, `/product-demand` | `Routes.EInvoice`, `Routes.ProductDemand` | varies |
| `/user-management`, `/location-management` | `Routes.*Management` | ADMIN |
| `/profile` | `Routes.Profile` | All |

## Architecture

```
app/src/main/java/com/wiradata/erpapplication/
├── ErpApplication.kt          // Hilt entry point
├── MainActivity.kt            // Single Compose activity
├── di/                        // Hilt modules (Network, App)
├── data/
│   ├── local/                 // SessionStore (DataStore-backed JWT cache)
│   ├── remote/                // Retrofit ErpApi, AuthInterceptor, DTOs
│   └── repository/            // Auth/Sales/Purchase/Stock/... repos
├── domain/
│   ├── model/                 // Clean domain models (AuthUser, UserRole)
│   └── util/                  // Resource<T>
├── navigation/                // Routes + NavMenu (drawer groups)
├── ui/
│   ├── theme/                 // Forest emerald palette (matches web Tailwind)
│   ├── components/            // DataTable, ListScreen, FormDialog, Picker, etc.
│   ├── app/                   // SairahErpApp + ErpScaffold (drawer / topbar)
│   ├── auth/                  // LoginScreen + ViewModel
│   ├── dashboard/             // DashboardScreen + SalesBarChart
│   └── modules/
│       ├── sales/             // SalesEntry (full form)
│       ├── purchase/          // PurchaseEntry (full form)
│       ├── list/              // Read-only list screens (records, due, etc.)
│       ├── crud/              // Customer/Supplier/User/Location CRUD
│       └── profile/           // ProfileScreen + change-password
└── util/                      // Money + DateUtils helpers
```

## Backend connectivity

`API_BASE_URL` is supplied via `BuildConfig`:

- **Debug** → `http://10.0.2.2:3001/api/`  (Android emulator → host machine)
- **Release** → `https://your-erp-domain.com/api/` (override before shipping)

The same NestJS server under `erp_rakib-main/backend/` powers the app. Run it
locally with:

```bash
cd erp_rakib-main/backend
npm install
npm run start:dev
```

Then build & run the Android app from Android Studio. JWTs returned by
`/api/auth/login` are persisted via DataStore and automatically attached as
`Authorization: Bearer …` to every subsequent request. A 401 response wipes the
session and bounces the user back to the login screen.

> **Note about 2FA:** the backend supports TOTP-based 2FA via a `temp_token`.
> The mobile app currently surfaces a friendly error if 2FA is required, since
> the OTP step needs to be designed separately. Disable 2FA on the web console
> for accounts that should sign in via the mobile app.

## License

GPL-3.0 — see `LICENSE`.
