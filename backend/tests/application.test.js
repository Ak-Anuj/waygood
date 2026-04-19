/**
 * Application Workflow Tests
 * Run: node tests/application.test.js
 */

const BASE = process.env.TEST_BASE_URL || "http://localhost:4000/api";

async function req(method, path, body, token) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, body: await r.json() };
}

let passed = 0, failed = 0;
function assert(label, ok, detail = "") {
  if (ok) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`); failed++; }
}

async function getToken(suffix = "") {
  const email = `apptest_${Date.now()}${suffix}@example.com`;
  const r = await req("POST", "/auth/register", { fullName: "App Tester", email, password: "password123" });
  return r.body.data?.token;
}

async function getFirstProgram(token) {
  const r = await req("GET", "/api/programs?limit=1", null, token);
  return r.body?.data?.[0];
}

async function run() {
  console.log("\n=== Application Workflow Tests ===\n");

  const token = await getToken();
  assert("Got auth token", !!token);

  // Fetch programs list
  const pr = await req("GET", "/programs?limit=1", null, token);
  const program = pr.body?.data?.[0];
  assert("Got at least one program", !!program, JSON.stringify(pr.body));
  if (!program) { console.log("Skipping remaining tests — no programs in DB"); process.exit(1); }

  // Create application
  let appId;
  {
    const r = await req("POST", "/applications", { programId: program._id, intake: program.intakes?.[0] || "September 2025" }, token);
    assert("Create application returns 201", r.status === 201, JSON.stringify(r.body));
    appId = r.body.data?._id;
    assert("Application ID returned", !!appId);
    assert("Default status is draft", r.body.data?.status === "draft");
  }

  // Duplicate application
  {
    const r = await req("POST", "/applications", { programId: program._id, intake: program.intakes?.[0] || "September 2025" }, token);
    assert("Duplicate application returns 409", r.status === 409);
  }

  // List applications
  {
    const r = await req("GET", "/applications", null, token);
    assert("List applications returns 200", r.status === 200);
    assert("Lists own application", r.body.data?.some(a => a._id === appId));
  }

  // Valid status transition: draft -> submitted
  {
    const r = await req("PATCH", `/applications/${appId}/status`, { status: "submitted", note: "Submitting now" }, token);
    assert("Transition draft->submitted succeeds", r.status === 200, JSON.stringify(r.body));
    assert("Status is now submitted", r.body.data?.status === "submitted");
    assert("Timeline has 2 entries", r.body.data?.timeline?.length === 2);
  }

  // Invalid status transition: submitted -> enrolled (skipping steps)
  {
    const r = await req("PATCH", `/applications/${appId}/status`, { status: "enrolled" }, token);
    assert("Invalid transition returns 400", r.status === 400);
  }

  // Get single application
  {
    const r = await req("GET", `/applications/${appId}`, null, token);
    assert("GET single application returns 200", r.status === 200);
  }

  // Unauthenticated access
  {
    const r = await req("GET", "/applications");
    assert("Unauthenticated list returns 401", r.status === 401);
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
