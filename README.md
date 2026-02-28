# eCourts Wrapper — Cloudflare Workers API

A Cloudflare Workers API built with **Hono**, **neverthrow**, and **Zod** for wrapping the eCourts system.

---

## Installation

```sh
pnpm install
```

---

## Development

Run the development server locally (with hot reload):

```sh
pnpm dev
```

This uses **Wrangler's** local dev mode so you can test your Worker before deploying.

---

## Deployment

Before deploying, you need to set up your **Cloudflare API Token** so Wrangler can authenticate.

---

### 1. Get a Cloudflare API Token

1. Go to your [Cloudflare Dashboard → API Tokens](https://dash.cloudflare.com/profile/api-tokens).
2. Click **Create Token**.
3. Choose the **"Edit Cloudflare Workers"** template or create a custom token with:

    * **Permissions:**

        * **Account → Cloudflare Workers → Edit**
        * **Zone → Workers Routes → Edit** (optional, if deploying to routes)
    * **Account Resources:** Include your account
4. Create and **copy** your API token.

---

### 2. Export the API Token to Wrangler

Wrangler will look for the `CLOUDFLARE_API_TOKEN` environment variable.

**Linux / macOS:**

```sh
export CLOUDFLARE_API_TOKEN="your-api-token-here"
```

**Windows (PowerShell):**

```powershell
$env:CLOUDFLARE_API_TOKEN="your-api-token-here"
```

Or authenticate directly:

```sh
wrangler login
```

This will open a browser window to log in to Cloudflare.

---

### 3. Deploy to Cloudflare

```sh
pnpm deploy
```

---

## Generate Cloudflare Types

To synchronize type definitions for Cloudflare bindings:

```sh
pnpm cf-typegen
```

Pass the `CloudflareBindings` as generics when instantiating **Hono**:

```ts
const app = new Hono<{ Bindings: CloudflareBindings }>()
```

---

## Project Structure

```
src/
├── index.ts                  # Worker entry point
├── app.ts                    # Hono app, middlewares, 404 handler
├── config/
│   └── app-env.ts            # AppEnv type (bindings + variables)
├── routes/
│   └── index.ts              # Route definitions (health check)
├── examples/
│   └── example-route.ts      # Reference pattern for new routes
└── utils/
    ├── logger.ts             # Console-based logger (CF Workers compatible)
    ├── api-validator.ts      # Maps upstream HTTP errors → AppError
    ├── error/
    │   ├── errors.ts         # AppError hierarchy with statusCode
    │   ├── response.ts       # Standardized response types
    │   └── response-handler.ts  # Result<T, AppError> → Response
    └── http/
        ├── http-client.ts    # Fetch wrapper with timeouts + cookie support
        └── cookie-jar.ts     # Automatic cookie management for sessions
```

---

## Useful Links

* [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
* [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)
* [Hono Docs](https://hono.dev/)
* [neverthrow](https://github.com/supermacro/neverthrow)
* [Zod](https://zod.dev/)
