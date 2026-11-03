/**
 * Automated Test Suite: KAMLE AI One-Click Demo Login
 * Tests:
 * 1. Admin Demo Login (POST /api/auth/demo-login { role: "admin" })
 * 2. Customer Demo Login (POST /api/auth/demo-login { role: "customer" })
 * 3. Worker Demo Login (POST /api/auth/demo-login { role: "worker" })
 * 4. Token validation via GET /api/auth/me for each role
 * 5. Role-based endpoint authorization verification
 * 6. Input validation (invalid role rejected with 400)
 * 7. Normal login backwards compatibility
 */

const BASE_URL = process.env.API_BASE_URL || "http://localhost:4000";

async function postJson(endpoint, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function getJson(endpoint, token) {
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: "GET",
    headers,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log("=================================================");
  console.log("KAMLE AI — ONE-CLICK DEMO LOGIN TEST SUITE");
  console.log("=================================================\n");

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`✓ ${message}`);
      passed++;
    } else {
      console.error(`✗ FAIL: ${message}`);
      process.exitCode = 1;
    }
  }

  // 1. Test Admin Demo Login
  console.log("[1/6] Testing Admin Demo Login...");
  const adminRes = await postJson("/api/auth/demo-login", { role: "admin" });
  assert(adminRes.status === 200, `Admin demo login returns 200 OK (got ${adminRes.status})`);
  assert(Boolean(adminRes.data.token), "JWT token generated for Admin");
  assert(adminRes.data.user?.role === "admin", `User role is 'admin' (got ${adminRes.data.user?.role})`);
  assert(adminRes.data.user?.email === "admin@kamle.ai", `Admin email matches demo identifier (${adminRes.data.user?.email})`);

  // Verify Admin Token with /auth/me
  const adminMe = await getJson("/api/auth/me", adminRes.data.token);
  assert(adminMe.status === 200, "/api/auth/me accepts Admin token");
  assert(adminMe.data.user?.role === "admin", "Admin session verified via /auth/me");

  // 2. Test Customer Demo Login
  console.log("\n[2/6] Testing Customer Demo Login...");
  const customerRes = await postJson("/api/auth/demo-login", { role: "customer" });
  assert(customerRes.status === 200, `Customer demo login returns 200 OK (got ${customerRes.status})`);
  assert(Boolean(customerRes.data.token), "JWT token generated for Customer");
  assert(customerRes.data.user?.role === "customer", `User role is 'customer' (got ${customerRes.data.user?.role})`);
  assert(customerRes.data.user?.email === "customer@example.com", `Customer email matches demo identifier (${customerRes.data.user?.email})`);

  // Verify Customer Token with /auth/me
  const customerMe = await getJson("/api/auth/me", customerRes.data.token);
  assert(customerMe.status === 200, "/api/auth/me accepts Customer token");
  assert(customerMe.data.user?.role === "customer", "Customer session verified via /auth/me");

  // 3. Test Worker Demo Login
  console.log("\n[3/6] Testing Worker Demo Login...");
  const workerRes = await postJson("/api/auth/demo-login", { role: "worker" });
  assert(workerRes.status === 200, `Worker demo login returns 200 OK (got ${workerRes.status})`);
  assert(Boolean(workerRes.data.token), "JWT token generated for Worker");
  assert(workerRes.data.user?.role === "worker", `User role is 'worker' (got ${workerRes.data.user?.role})`);
  assert(workerRes.data.user?.phone === "9800000001", `Worker phone matches demo identifier (${workerRes.data.user?.phone})`);

  // Verify Worker Token with /auth/me
  const workerMe = await getJson("/api/auth/me", workerRes.data.token);
  assert(workerMe.status === 200, "/api/auth/me accepts Worker token");
  assert(workerMe.data.user?.role === "worker", "Worker session verified via /auth/me");
  assert(workerMe.data.workerProfile !== undefined, "Worker profile populated in session");

  // 4. Role Authorization & Isolation
  console.log("\n[4/6] Testing Role Authorization & Access Control...");
  // Customer attempting admin route
  const customerAdminCheck = await getJson("/api/admin/dashboard", customerRes.data.token);
  assert(customerAdminCheck.status === 403, `Customer blocked from admin routes (got ${customerAdminCheck.status})`);

  // Worker attempting admin route
  const workerAdminCheck = await getJson("/api/admin/dashboard", workerRes.data.token);
  assert(workerAdminCheck.status === 403, `Worker blocked from admin routes (got ${workerAdminCheck.status})`);

  // Admin accessing admin route
  const adminCheck = await getJson("/api/admin/dashboard", adminRes.data.token);
  assert(adminCheck.status === 200, `Admin authorized to access admin routes (got ${adminCheck.status})`);

  // 5. Input Validation & Negative Tests
  console.log("\n[5/6] Testing Input Validation & Negative Cases...");
  const invalidRole = await postJson("/api/auth/demo-login", { role: "superadmin" });
  assert(invalidRole.status === 400, `Invalid role 'superadmin' rejected with 400 (got ${invalidRole.status})`);

  const emptyBody = await postJson("/api/auth/demo-login", {});
  assert(emptyBody.status === 400, `Missing role rejected with 400 (got ${emptyBody.status})`);

  const sqlInj = await postJson("/api/auth/demo-login", { role: "admin' OR '1'='1" });
  assert(sqlInj.status === 400, `Malformed role input rejected with 400 (got ${sqlInj.status})`);

  // 6. Normal Credentials Login Compatibility
  console.log("\n[6/6] Testing Normal Credential Login Compatibility...");
  const normalLogin = await postJson("/api/auth/login", {
    identifier: "customer@example.com",
    password: "Password123",
  });
  assert(normalLogin.status === 200, `Standard credentials login functional (got ${normalLogin.status})`);
  assert(normalLogin.data.user?.email === "customer@example.com", "Standard login returns user profile");

  console.log("\n=================================================");
  console.log(`TEST SUMMARY: ${passed}/${total} TESTS PASSED`);
  console.log("=================================================");

  if (passed === total) {
    console.log("ALL ONE-CLICK DEMO LOGIN TESTS PASSED SUCCESSFULLY! ✓\n");
  } else {
    console.error("SOME TESTS FAILED! ✗\n");
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
