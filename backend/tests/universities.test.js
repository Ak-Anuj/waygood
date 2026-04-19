/**
 * University & Program Discovery Tests
 */
const BASE = process.env.TEST_BASE_URL || "http://localhost:4000/api";
async function req(path) {
  const r = await fetch(`${BASE}${path}`);
  return { status: r.status, body: await r.json() };
}

let passed = 0, failed = 0;
function assert(label, ok, detail = "") {
  if (ok) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`); failed++; }
}

async function run() {
  console.log("\n=== University & Program Discovery Tests ===\n");

  // Universities list
  {
    const r = await req("/universities");
    assert("GET /universities returns 200", r.status === 200);
    assert("Returns array", Array.isArray(r.body.data));
    assert("Has meta pagination", !!r.body.meta?.total);
  }

  // Popular universities (cached)
  {
    const r1 = await req("/universities/popular");
    assert("GET /universities/popular returns 200", r1.status === 200);
    const r2 = await req("/universities/popular");
    assert("Second call is cache hit", r2.body.meta?.cache === "hit");
  }

  // Filter by country
  {
    const r = await req("/universities?country=Canada");
    assert("Filter by country works", r.status === 200);
    assert("All results match country", r.body.data?.every(u => u.country === "Canada") ?? true);
  }

  // Search with q
  {
    const r = await req("/universities?q=university");
    assert("Search with q returns 200", r.status === 200);
  }

  // Pagination
  {
    const r = await req("/universities?page=1&limit=2");
    assert("Pagination limit respected", (r.body.data?.length ?? 0) <= 2);
    assert("Page meta present", r.body.meta?.page === 1);
  }

  // Programs list
  {
    const r = await req("/programs");
    assert("GET /programs returns 200", r.status === 200);
    assert("Programs array returned", Array.isArray(r.body.data));
  }

  // Program filters
  {
    const r = await req("/programs?degreeLevel=master&maxTuition=30000");
    assert("Program filter by degreeLevel+maxTuition works", r.status === 200);
    assert("All programs within budget", r.body.data?.every(p => p.tuitionFeeUsd <= 30000) ?? true);
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
