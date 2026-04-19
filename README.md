# Waygood Backend Assignment

---

## What I Built

- Login and Register system with JWT tokens
- University and Program search with filters
- Recommendation system (suggests programs based on student profile)
- Application system (apply, track status, update progress)
- Caching for fast responses
- Rate limiting to prevent spam
- Tests for all major features

---

## How to Run This Project

### Step 1 — Install MongoDB
Make sure MongoDB is running on your computer.

### Step 2 — Go into the backend folder
```bash
cd backend
```

### Step 3 — Install packages
```bash
npm install
```

### Step 4 — Setup environment file
```bash
cp .env.example .env
```
Open the `.env` file and it will look like this:
```
PORT=4000
MONGODB_URI=mongodb://127.0.0.1:27017/waygood-evaluation
JWT_SECRET=change-me-in-production
JWT_EXPIRES_IN=1d
CACHE_TTL_SECONDS=300
```
You don't need to change anything to run locally.

### Step 5 — Add sample data to database
```bash
npm run seed
```

### Step 6 — Start the server
```bash
npm run dev
```

Server will start at: `http://localhost:4000`

---

## How to Test APIs

Open Hopscotch and use these URLs.

> First register and copy the token. Then paste it in Authorization header for protected routes.

---

## All API Endpoints

### Auth

| What | Method | URL |
|------|--------|-----|
| Register | POST | /api/auth/register |
| Login | POST | /api/auth/login |
| My Profile | GET | /api/auth/me |
| Update Profile | PATCH | /api/auth/me |

### Universities

| What | Method | URL |
|------|--------|-----|
| All Universities | GET | /api/universities |
| Popular Universities | GET | /api/universities/popular |
| Single University | GET | /api/universities/:id |

### Programs

| What | Method | URL |
|------|--------|-----|
| All Programs | GET | /api/programs |
| Filter Programs | GET | /api/programs?country=Canada&degreeLevel=master |

### Recommendations

| What | Method | URL |
|------|--------|-----|
| My Recommendations | GET | /api/recommendations |

### Applications

| What | Method | URL |
|------|--------|-----|
| Apply to Program | POST | /api/applications |
| My Applications | GET | /api/applications |
| Single Application | GET | /api/applications/:id |
| Update Status | PATCH | /api/applications/:id/status |

---

## Application Status Flow

When you apply, the status starts at `draft` and moves like this:

```
draft → submitted → under-review → offer-received → visa-processing → enrolled
```

At any point it can go to `rejected`.

You cannot skip steps. For example you cannot go from `draft` directly to `enrolled`.

---

## Recommendation System

When you call the recommendations API, it looks at your profile and gives you a score for each program.

| What it checks | Points |
|----------------|--------|
| Country match | 35 |
| Field of study match | 30 |
| Within your budget | 20 |
| Intake match | 10 |
| IELTS score ok | 5 |
| Scholarship available | 5 |

Higher score = better match.  Programs with 0 score are not shown.

---

## Caching

Two APIs use caching so they respond faster:

- `/api/universities/popular` — cached for 5 minutes
- `/api/universities` — cached for 2 minutes (simple queries only)


---

## Rate Limiting

To prevent too many requests:

- All routes — max 200 requests per minute
- Login and Register — max 10 requests per minute (to stop brute force attacks)

---

## How to Run Tests

Make sure server is running first, then open a new terminal:

```bash
cd backend
npm test
```
