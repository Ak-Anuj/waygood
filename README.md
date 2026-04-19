# Waygood – Study Abroad Platform Backend

A production-ready MERN backend for a study-abroad platform that helps students discover universities, compare programs, track applications, and receive personalised program recommendations.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Setup](#setup)
3. [Environment Variables](#environment-variables)
4. [API Reference](#api-reference)
5. [Architecture Decisions](#architecture-decisions)
6. [Indexing & Performance](#indexing--performance)
7. [Testing](#testing)
8. [Assumptions](#assumptions)
9. [Bonus Features Implemented](#bonus-features-implemented)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 18+ |
| Framework | Express 4 |
| Database | MongoDB (Mongoose 8) |
| Auth | JWT + bcryptjs |
| Caching | In-process LRU-style Map (Redis-ready interface) |
| Rate Limiting | Custom in-process limiter (swap-in express-rate-limit) |
| Testing | Native fetch-based integration tests (no extra deps) |

---

## Setup

### Prerequisites
- Node.js 18+
- MongoDB running locally or a MongoDB Atlas URI

### Install & Run

```bash
# 1. Clone / extract the project
cd backend

# 2. Install dependencies
npm install

# 3. Copy and fill environment variables
cp .env.example .env

# 4. Seed the database with sample data
npm run seed

# 5. Start the development server
npm run dev
# Server listens on http://localhost:4000
```

### Docker (optional)

```dockerfile
# Dockerfile (backend)
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 4000
CMD ["node", "src/server.js"]
```

```yaml
# docker-compose.yml
version: "3.9"
services:
  mongo:
    image: mongo:7
    ports: ["27017:27017"]
  backend:
    build: ./backend
    ports: ["4000:4000"]
    env_file: ./backend/.env
    depends_on: [mongo]
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | HTTP port |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/waygood-evaluation` | MongoDB connection string |
| `JWT_SECRET` | `dev-secret` | **Change in production** |
| `JWT_EXPIRES_IN` | `1d` | Token lifetime |
| `CACHE_TTL_SECONDS` | `300` | Default cache TTL (seconds) |

---

## API Reference

All responses follow `{ success: true, data: ..., meta: ... }`.

### Auth  `/api/auth`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/register` | — | Register new user |
| POST | `/login` | — | Login, get JWT |
| GET | `/me` | ✅ | Get own profile |
| PATCH | `/me` | ✅ | Update profile |

**Register body:**
```json
{
  "fullName": "Arjun Sharma",
  "email": "arjun@example.com",
  "password": "securepass",
  "targetCountries": ["Canada", "UK"],
  "interestedFields": ["Computer Science"],
  "maxBudgetUsd": 35000,
  "preferredIntake": "September 2025",
  "englishTest": { "exam": "IELTS", "score": 7.0 }
}
```

### Universities  `/api/universities`

| Method | Path | Query params | Description |
|--------|------|-------------|-------------|
| GET | `/` | `country`, `partnerType`, `q`, `scholarshipAvailable`, `sortBy`, `page`, `limit` | Paginated list |
| GET | `/popular` | — | Top 6 by popularity (cached) |
| GET | `/:id` | — | Single university |

### Programs  `/api/programs`

| Method | Path | Query params | Description |
|--------|------|-------------|-------------|
| GET | `/` | `country`, `degreeLevel`, `field`, `intake`, `maxTuition`, `scholarshipAvailable`, `q`, `sortBy`, `page`, `limit` | Paginated list with filters |

### Recommendations  `/api/recommendations`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | ✅ | Get recommendations for logged-in user |
| GET | `/:studentId` | ✅ | Get recommendations for any student (counselors) |

Response includes `matchScore` (0–100) and `reasons[]` per program.

### Applications  `/api/applications`

All routes require authentication.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List applications (own for students, filterable for counselors) |
| POST | `/` | Create application |
| GET | `/:id` | Get single application |
| PATCH | `/:id/status` | Advance status (enforces valid transitions) |

**Status lifecycle:**
```
draft → submitted → under-review → offer-received → visa-processing → enrolled
                 ↘              ↘               ↘                ↘
                  rejected      rejected        rejected         rejected
```

---

## Architecture Decisions

### 1. JWT Stateless Auth
JWTs are verified on every request without a database lookup in the middleware (except to confirm the user still exists). This keeps auth fast and horizontally scalable.

### 2. Recommendation Engine — MongoDB Aggregation Pipeline
Instead of pulling all programs into JS and scoring in memory, the engine uses a multi-stage `$aggregate` pipeline:
- **Stage 1** — `$match` pre-filters by country + budget + IELTS before scoring (reduces documents early).
- **Stage 2** — `$addFields` computes weighted partial scores for country (35), field (30), budget (20), intake (10), IELTS (5), scholarship bonus (5).
- **Stage 3** — sums scores and builds a human-readable `reasons[]` array.
- **Stage 4** — filters out zero-match results.
- **Stage 5** — `$sort` + `$limit` (top 10).
- **Stage 6** — `$lookup` joins university details.

This runs entirely inside MongoDB, avoiding N+1 queries.

### 3. In-Process Cache
A simple `Map`-based cache with TTL is used. The interface matches what a Redis client would expose so swapping to `ioredis` requires only changing `cacheService.js`.

Cached endpoints:
- `GET /api/universities/popular` — 5 min TTL
- `GET /api/universities` (simple, unfiltered queries) — 2 min TTL

### 4. Application Workflow Integrity
Status transitions are validated against a whitelist (`config/constants.js`). Every transition appends an immutable entry to `timeline[]`, providing a full audit trail. A compound unique index `{ student, program, intake }` prevents duplicate applications at the database level.

### 5. Rate Limiting
Two limiters:
- **Global** — 200 req/min per IP (all routes).
- **Auth** — 10 req/min per IP (register + login only, brute-force protection).

---

## Indexing & Performance

| Collection | Index | Rationale |
|-----------|-------|-----------|
| `universities` | `{ country: 1 }` | Most common filter |
| `universities` | `{ popularScore: -1 }` | Popular endpoint sort |
| `universities` | `text(name, country, city)` | Full-text `q` search |
| `programs` | `{ country: 1, degreeLevel: 1, field: 1, tuitionFeeUsd: 1 }` | Compound filter |
| `programs` | `{ university: 1 }` | Lookups |
| `applications` | `{ student: 1 }`, `{ program: 1 }`, `{ status: 1 }` | Common query patterns |
| `applications` | `{ student: 1, program: 1, intake: 1 }` unique | Duplicate prevention |

### Query Optimisations
- `lean()` used on all read-only queries (returns plain JS objects, ~30% faster than Mongoose documents).
- `Promise.all([find, countDocuments])` parallelises data + count queries.
- Aggregation pipeline pre-filters before scoring, avoiding full collection scans.
- Pagination enforced server-side with a max `limit` of 50.

---

## Testing

Integration tests use Node's built-in `fetch` — no extra test framework needed.

```bash
# Run all tests (server must be running)
npm test

# Individual suites
npm run test:auth        # Register, login, profile
npm run test:app         # Application lifecycle
npm run test:discovery   # Universities & programs
```

---

## Assumptions

1. The `Student` model serves both students and counselors (distinguished by `role`).
2. The `intake` field on an application must be a string (e.g., `"September 2025"`). Validation against `program.intakes[]` is intentionally lenient to allow manual entries.
3. Counselors can view and update any application status; students can only view and submit their own.
4. The in-process cache is intentionally simple — in a multi-instance deployment, this should be replaced with a shared Redis cache.
5. The `profileComplete` flag is computed automatically when `targetCountries`, `interestedFields`, and `maxBudgetUsd` are all set.

---

## Bonus Features Implemented

- ✅ Rate limiting (global + auth-specific)
- ✅ Security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection)
- ✅ Full audit trail (timeline) on applications
- ✅ Profile update endpoint (`PATCH /api/auth/me`)
- ✅ Recommendation engine using MongoDB Aggregation (not JS scoring)
- ✅ Cache hit/miss headers on university endpoints
- ✅ Docker setup instructions
- ✅ Integration test suite (zero extra dependencies)
