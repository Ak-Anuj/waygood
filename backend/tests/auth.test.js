/**
 * Auth API Tests
 * Run: node tests/auth.test.js
 * (requires the server running on PORT 4000 or set TEST_BASE_URL)
 */

const BASE = process.env.TEST_BASE_URL || "http://localhost:4000/api";

async function request(method, path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  return { status: res.status, body: json };
}

let passed = 0;
let failed = 0;

function assert(label, condition, detail = "") {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

async function run() {
  console.log("\n=== Auth Tests ===\n");

  const email = `test_${Date.now()}@example.com`;
  const password = "password123";
  let token;

  // Register
  {
    const r = await request("POST", "/auth/register", { fullName: "Test User", email, password });
    assert("Register returns 201", r.status === 201, JSON.stringify(r.body));
    assert("Register returns token", !!r.body.data?.token);
    token = r.body.data?.token;
  }

  // Duplicate register
  {
    const r = await request("POST", "/auth/register", { fullName: "Test User", email, password });
    assert("Duplicate register returns 409", r.status === 409);
  }

  // Login
  {
    const r = await request("POST", "/auth/login", { email, password });
    assert("Login returns 200", r.status === 200);
    assert("Login returns token", !!r.body.data?.token);
    token = r.body.data?.token;
  }

  // Wrong password
  {
    const r = await request("POST", "/auth/login", { email, password: "wrongpass" });
    assert("Wrong password returns 401", r.status === 401);
  }

  // Me (authenticated)
  {
    const r = await request("GET", "/auth/me", null, token);
    assert("GET /auth/me returns 200 with token", r.status === 200);
    assert("GET /auth/me returns user email", r.body.data?.email === email);
  }

  // Me (unauthenticated)
  {
    const r = await request("GET", "/auth/me");
    assert("GET /auth/me without token returns 401", r.status === 401);
  }

  // Update profile
  {
    const r = await request("PATCH", "/auth/me", { targetCountries: ["Canada", "UK"], maxBudgetUsd: 30000, interestedFields: ["Computer Science"] }, token);
    assert("PATCH /auth/me returns 200", r.status === 200);
    assert("Profile updated with countries", r.body.data?.targetCountries?.includes("Canada"));
    assert("profileComplete set to true", r.body.data?.profileComplete === true);
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => { console.error(e); process.exit(1); });
