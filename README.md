# Insighta Labs+ — Backend

Secure REST API powering the Insighta Labs+ platform. Provides GitHub OAuth authentication with PKCE, role-based access control, demographic profile management, natural language search, and CSV export.

---

## Live URLs

| Resource | URL |
|---|---|
| API Base | `https://your-app.vercel.app` |
| Interactive Docs | `https://your-app.vercel.app` |
| Web Portal | `https://your-app.vercel.app/dashboard` |

---

## Tech Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js v18+ |
| Framework | Express |
| Database | PostgreSQL via `pg` (Neon serverless) |
| Auth | GitHub OAuth 2.0 + PKCE |
| Tokens | JWT (jsonwebtoken) — access 3min, refresh 5min |
| Security | helmet, cors, cookie-parser, express-rate-limit |
| Logging | morgan |

---

## Project Structure

```
insighta-backend/
├── public/
│   ├── index.html          ← Interactive API docs (root URL)
│   ├── login.html          ← GitHub OAuth login page
│   └── dashboard.html      ← Web portal with avatar + profile browser
├── src/
│   ├── config/
│   │   ├── db.js           ← PostgreSQL pool
│   │   └── auth.js         ← JWT secrets + GitHub OAuth constants
│   ├── controllers/
│   │   ├── auth.controller.js      ← OAuth redirect, callback, refresh, logout
│   │   └── profile.controller.js  ← All profile CRUD + CSV export
│   ├── services/
│   │   ├── auth.service.js         ← GitHub exchange, user upsert, token management
│   │   ├── profile.service.js      ← DB queries, filtering, pagination, export
│   │   ├── nlp.service.js          ← Rule-based natural language parser
│   │   └── external.service.js     ← Genderize, Agify, Nationalize API calls
│   ├── routes/
│   │   ├── auth.routes.js          ← /auth/* routes
│   │   └── profile.routes.js       ← /api/profiles/* routes
│   ├── middleware/
│   │   ├── authenticate.js         ← JWT verification (header or cookie)
│   │   ├── authorize.js            ← Role gate: authorize('admin')
│   │   ├── apiVersion.js           ← Enforces X-API-Version: 1 header
│   │   ├── rateLimiter.js          ← 10/min auth, 60/min API
│   │   └── errorHandler.js         ← Global error formatter
│   ├── utils/
│   │   ├── classify.js             ← Age group + top country helpers
│   │   └── uuidv7.js               ← UUID v7 generator (no external dep)
│   ├── scripts/
│   │   ├── migrate.js              ← Schema migrations
│   │   └── seed.js                 ← Seed 2026 profiles
│   ├── app.js                      ← Express setup, middleware, table init
│   └── server.js                   ← Entry point
├── .env
├── .gitignore
├── vercel.json
└── package.json
```

---

## Getting Started

### 1. Install

```bash
git clone https://github.com/your-username/insighta-backend.git
cd insighta-backend
npm install
```

### 2. Create `.env`

```
PORT=3000
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require

GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_CALLBACK_URL=http://localhost:3000/auth/github/callback

ACCESS_TOKEN_SECRET=long_random_string_here
REFRESH_TOKEN_SECRET=another_long_random_string_here

FRONTEND_URL=http://localhost:3000
```

**Creating a GitHub OAuth App:**
1. Go to github.com → Settings → Developer settings → OAuth Apps → New OAuth App
2. Homepage URL: `http://localhost:3000`
3. Authorization callback URL: `http://localhost:3000/auth/github/callback`
4. Copy Client ID and generate a Client Secret

### 3. Migrate and seed

```bash
npm run migrate   # creates tables and indexes
npm run seed      # loads 2026 profiles
```

### 4. Start

```bash
npm run dev    # development with nodemon
npm start      # production
```

Visit `http://localhost:3000` → interactive API docs with live testing.

---

## API Reference

### Headers required on all `/api/*` routes

```
Authorization: Bearer <access_token>
X-API-Version: 1
```

Missing `X-API-Version` returns:
```json
{ "status": "error", "message": "API version header required" }
```

### Auth Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/auth/github` | Public | Redirect to GitHub OAuth |
| GET | `/auth/github/callback` | Public | Handle OAuth callback, issue tokens |
| POST | `/auth/refresh` | Public | Rotate token pair |
| POST | `/auth/logout` | Authenticated | Invalidate refresh token |
| GET | `/auth/me` | Authenticated | Get current user info |

### Profile Endpoints

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/api/profiles` | admin + analyst | List with filters, sort, pagination |
| GET | `/api/profiles/search` | admin + analyst | Natural language search |
| GET | `/api/profiles/export` | admin + analyst | CSV download |
| GET | `/api/profiles/:id` | admin + analyst | Get single profile |
| POST | `/api/profiles` | admin only | Create profile |
| DELETE | `/api/profiles/:id` | admin only | Delete profile |

### GET `/api/profiles` — Query Parameters

| Param | Type | Description |
|---|---|---|
| `gender` | string | `male` or `female` |
| `age_group` | string | `child`, `teenager`, `adult`, `senior` |
| `country_id` | string | ISO code e.g. `NG` |
| `min_age` | number | Minimum age inclusive |
| `max_age` | number | Maximum age inclusive |
| `min_gender_probability` | float | 0–1 |
| `min_country_probability` | float | 0–1 |
| `sort_by` | string | `age`, `created_at`, `gender_probability` |
| `order` | string | `asc` or `desc` |
| `page` | number | Default: 1 |
| `limit` | number | Default: 10, max: 50 |

### Paginated Response Shape

```json
{
  "status": "success",
  "page": 1,
  "limit": 10,
  "total": 2026,
  "total_pages": 203,
  "links": {
    "self": "/api/profiles?page=1&limit=10",
    "next": "/api/profiles?page=2&limit=10",
    "prev": null
  },
  "data": [ ... ]
}
```

---

## System Architecture

```
┌─────────────────────────────────────────────────┐
│                  Clients                         │
│   CLI (Bearer token)  ·  Web Portal (cookies)   │
└──────────────────┬──────────────────────────────┘
                   │ HTTPS
┌──────────────────▼──────────────────────────────┐
│              Express Backend                     │
│                                                  │
│  /auth/*          /api/profiles/*  /health       │
│  rate: 10/min     rate: 60/min/user              │
│                                                  │
│  authenticate.js ──► authorize.js                │
│  (JWT header      (role: admin                   │
│   or cookie)       or analyst)                   │
│                                                  │
│  profile.service.js ◄── nlp.service.js           │
│  auth.service.js    ◄── external APIs            │
└──────────────┬──────────────────────────────────┘
               │
┌──────────────▼───────────────┐
│     Neon PostgreSQL           │
│  users · refresh_tokens       │
│  profiles                     │
└───────────────────────────────┘
```

---

## Authentication Flow

### Web Flow
1. User visits `/login`, clicks "Continue with GitHub"
2. Browser redirects to `/auth/github`
3. Backend redirects to `https://github.com/login/oauth/authorize`
4. GitHub redirects back to `/auth/github/callback?code=...&state=...`
5. Backend validates state, exchanges code with GitHub for user info
6. Backend upserts user, issues JWT pair
7. Tokens stored as **HTTP-only cookies** (inaccessible to JavaScript)
8. User redirected to `/dashboard`

### CLI Flow (PKCE)
1. CLI generates `code_verifier` (random 32-byte base64url string)
2. CLI derives `code_challenge = SHA256(code_verifier)` base64url-encoded
3. CLI starts a local HTTP server on a random port
4. CLI opens browser to `/auth/github?code_challenge=...&port=9876`
5. GitHub OAuth flow completes normally
6. Backend includes `port` in redirect: `http://localhost:9876/callback?access_token=...&refresh_token=...`
7. CLI captures tokens from local callback, saves to `~/.insighta/credentials.json`
8. Local server shuts down

### Token Lifecycle

| Token | Expiry | Storage |
|---|---|---|
| Access token | 3 minutes | CLI: memory/credentials.json · Web: HTTP-only cookie |
| Refresh token | 5 minutes | Stored in `refresh_tokens` table for server-side invalidation |

- Each `/auth/refresh` call invalidates the old refresh token and issues a new pair
- Logout invalidates the refresh token server-side immediately
- Inactive users (`is_active = false`) receive 403 on every request

---

## Role Enforcement

Two roles: `admin` and `analyst`. Default on registration: `analyst`.

Enforcement is centralised in `src/middleware/authorize.js`:

```js
// Usage in routes
router.post('/', authenticate, authorize('admin'), controller.create);
router.get('/',  authenticate, authorize('admin', 'analyst'), controller.getAll);
```

| Action | admin | analyst |
|---|---|---|
| List profiles | ✓ | ✓ |
| Search profiles | ✓ | ✓ |
| Export CSV | ✓ | ✓ |
| Get single profile | ✓ | ✓ |
| Create profile | ✓ | ✗ |
| Delete profile | ✓ | ✗ |

To promote a user to admin, run directly on the database:
```sql
UPDATE users SET role = 'admin' WHERE username = 'your-github-username';
```

---

## Natural Language Parsing

The `/api/profiles/search?q=` endpoint uses a **rule-based parser** — no AI or external NLP libraries.

### How it works

The parser in `src/services/nlp.service.js` processes the query in order:
1. Lowercase and trim input
2. Detect gender keywords
3. Detect age group keywords (`teenager`, `adult`, etc.)
4. If `"young"` present and no age group matched → `min_age=16, max_age=24`
5. Detect age expressions (`above N`, `under N`, `between N and M`)
6. Country name lookup (longest-match wins — `"south africa"` before `"africa"`)
7. Fallback: 2-letter ISO code after `"from"` or `"in"`
8. If filters object is empty → `"Unable to interpret query"`

### Supported keywords

**Gender:** `male`, `males`, `female`, `females` (both present → no filter)

**Age groups:** `child/children/kids` → `child` · `teenager/teen/teens` → `teenager` · `adult/adults` → `adult` · `senior/seniors/elderly` → `senior`

**Age expressions:**
- `young` → `min_age=16, max_age=24`
- `above/over/older than N` → `min_age=N`
- `below/under/younger than N` → `max_age=N`
- `between N and M` → `min_age=N, max_age=M`

**Countries:** 80+ country names mapped to ISO codes. Also accepts 2-letter ISO after `from` or `in`.

### Example mappings

| Query | Filters |
|---|---|
| `young males from nigeria` | `gender=male, min_age=16, max_age=24, country_id=NG` |
| `females above 30` | `gender=female, min_age=30` |
| `adult males from kenya` | `gender=male, age_group=adult, country_id=KE` |
| `male and female teenagers above 17` | `age_group=teenager, min_age=17` |
| `senior females` | `gender=female, age_group=senior` |

### Limitations

- No negation (`"not from nigeria"` won't work)
- No OR logic (all filters are AND)
- Typos not corrected
- Adjective forms not supported (`"Nigerian"` won't match NG)
- Only one country per query (first match wins)

---

## Rate Limiting

| Scope | Limit |
|---|---|
| `/auth/*` endpoints | 10 requests / minute |
| All other endpoints | 60 requests / minute per user |

Returns `429 Too Many Requests` when exceeded.

---

## Health Check

```
GET /health
```

Response:
```json
{
  "status": "ok",
  "db": "connected",
  "timestamp": "2026-04-29T10:00:00.000Z"
}
```

---

## Deployment (Vercel)

1. Push to GitHub
2. Import repo on vercel.com
3. Add all environment variables in Settings → Environment Variables
4. Deploy
5. Update `GITHUB_CALLBACK_URL` to your production URL in both `.env` and GitHub OAuth App settings
6. Run seed: `npm run seed` (or use your local env pointing to the same DB)

---

## Scripts

```bash
npm run dev      # nodemon dev server
npm start        # production server
npm run migrate  # run DB migrations
npm run seed     # seed 2026 profiles
```

---

## Database Schema

```sql
-- Users
CREATE TABLE users (
  id TEXT PRIMARY KEY, github_id VARCHAR UNIQUE NOT NULL,
  username VARCHAR, email VARCHAR, avatar_url VARCHAR,
  role VARCHAR DEFAULT 'analyst', is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW()
);

-- Refresh tokens (server-side invalidation)
CREATE TABLE refresh_tokens (
  id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL, expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Profiles
CREATE TABLE profiles (
  id TEXT PRIMARY KEY, name VARCHAR NOT NULL UNIQUE,
  gender VARCHAR, gender_probability FLOAT, sample_size INTEGER,
  age INTEGER, age_group VARCHAR,
  country_id VARCHAR(2), country_name VARCHAR,
  country_probability FLOAT, created_at TEXT NOT NULL
);
```