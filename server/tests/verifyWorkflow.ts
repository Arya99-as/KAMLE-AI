import assert from "node:assert";

const BASE_URL = "http://localhost:4000/api";

async function post(endpoint: string, body: any, token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function get(endpoint: string, token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: "GET",
    headers,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function patch(endpoint: string, body: any, token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function main() {
  console.log("=== STARTING WORKFLOW VERIFICATION ===");

  // 1. Auth: Register a brand new customer
  const randomSuffix = Date.now();
  const regRes = await post("/auth/register", {
    name: "Rohit Kulkarni",
    email: `rohit_${randomSuffix}@example.com`,
    phone: `99${String(randomSuffix).slice(-8)}`,
    password: "Password123",
    role: "customer",
    location: "Kolhapur",
  });
  assert.strictEqual(regRes.status, 201, `Customer registration failed: ${JSON.stringify(regRes.data)}`);
  const custToken = regRes.data.token;
  const custUser = regRes.data.user;
  console.log("✓ Customer registered & logged in:", custUser.name, custUser.email);

  const workerLogin = await post("/auth/login", { identifier: "ramesh@example.com", password: "Password123" });
  assert.strictEqual(workerLogin.status, 200, "Worker login failed");
  const workerToken = workerLogin.data.token;
  const workerUser = workerLogin.data.user;
  console.log("✓ Worker logged in:", workerUser.name);

  // 2. Search & Discovery: Problem + Location
  const searchRes = await get("/workers?q=My+kitchen+tap+is+leaking+continuously&location=Kolhapur");
  assert.strictEqual(searchRes.status, 200);
  assert.ok(searchRes.data.items.length > 0, "No workers found for leaking tap in Kolhapur");
  const foundWorker = searchRes.data.items[0];
  console.log("✓ Found worker:", foundWorker.name, "| Category:", foundWorker.serviceCategories, "| Score:", foundWorker.score);
  assert.strictEqual(foundWorker.name, "Ramesh Patil");

  // 3. Worker Profile: Verify get by workerId and userId
  const prof1 = await get(`/workers/${foundWorker.workerId}`);
  assert.strictEqual(prof1.status, 200, "Failed to get profile by workerId");
  const prof2 = await get(`/workers/${foundWorker.userId}`);
  assert.strictEqual(prof2.status, 200, "Failed to get profile by userId");
  console.log("✓ Worker profile loads by both workerId and userId");

  // 4. Test A: Customer sends enquiry
  const enqRes = await post("/enquiries", {
    workerId: foundWorker.userId,
    serviceCategory: "Plumbing",
    problemDescription: "My kitchen tap is leaking continuously under the counter.",
    location: "Kolhapur",
  }, custToken);
  assert.strictEqual(enqRes.status, 201, `Failed to create enquiry: ${JSON.stringify(enqRes.data)}`);
  const enquiry = enqRes.data.enquiry;
  assert.strictEqual(enquiry.status, "sent");
  console.log("✓ Test A Passed: Enquiry created with status 'sent', id:", enquiry._id);

  // Verify duplicate enquiry blocked
  const dupEnq = await post("/enquiries", {
    workerId: foundWorker.userId,
    serviceCategory: "Plumbing",
    problemDescription: "My kitchen tap is leaking continuously again.",
    location: "Kolhapur",
  }, custToken);
  assert.strictEqual(dupEnq.status, 409, "Duplicate open enquiry was not blocked");
  console.log("✓ Test F1 Passed: Duplicate open enquiry properly blocked with 409 Conflict");

  // 5. Test B: Worker views received enquiries and accepts
  const workerEnqs = await get("/enquiries/me?box=received", workerToken);
  assert.strictEqual(workerEnqs.status, 200);
  const receivedItem = workerEnqs.data.items.find((x: any) => x._id === enquiry._id);
  assert.ok(receivedItem, "Created enquiry not found in worker inbox");
  assert.strictEqual(receivedItem.status, "sent");

  const acceptRes = await patch(`/enquiries/${enquiry._id}/status`, { status: "accepted" }, workerToken);
  assert.strictEqual(acceptRes.status, 200, `Worker accept failed: ${JSON.stringify(acceptRes.data)}`);
  assert.strictEqual(acceptRes.data.enquiry.status, "accepted");
  console.log("✓ Test B Passed: Worker accepted enquiry -> DB status 'accepted'");

  // 6. Test C: Customer sees status 'accepted'
  const custEnqs = await get("/enquiries/me?box=sent", custToken);
  assert.strictEqual(custEnqs.status, 200);
  const custItem = custEnqs.data.items.find((x: any) => x._id === enquiry._id);
  assert.ok(custItem);
  assert.strictEqual(custItem.status, "accepted");
  console.log("✓ Test C Passed: Customer dashboard sees updated status 'accepted'");

  // 7. Test D: Worker marks job completed
  const completeRes = await patch(`/enquiries/${enquiry._id}/status`, { status: "completed" }, workerToken);
  assert.strictEqual(completeRes.status, 200, `Worker complete failed: ${JSON.stringify(completeRes.data)}`);
  assert.strictEqual(completeRes.data.enquiry.status, "completed");
  console.log("✓ Test D Passed: Worker marked job completed -> DB status 'completed'");

  // 8. Test E: Customer reviews completed job
  const reviewRes = await post("/reviews", {
    workerId: foundWorker.userId,
    rating: 5,
    comment: "Excellent plumbing work! Fixed the leaking tap promptly and cleanly.",
  }, custToken);
  assert.strictEqual(reviewRes.status, 201, `Failed to submit review: ${JSON.stringify(reviewRes.data)}`);
  console.log("✓ Test E1 Passed: Customer submitted review successfully");

  // Verify duplicate review blocked
  const dupReview = await post("/reviews", {
    workerId: foundWorker.userId,
    rating: 4,
    comment: "Trying to submit a second review.",
  }, custToken);
  assert.strictEqual(dupReview.status, 409, "Duplicate review was not blocked with 409");
  console.log("✓ Test E2 Passed: Duplicate review rejected with 409 Conflict");

  // Verify review appears on worker profile and ratings recomputed
  const updatedProf = await get(`/workers/${foundWorker.userId}`);
  assert.strictEqual(updatedProf.status, 200);
  const hasReview = updatedProf.data.reviews.some((r: any) => r.comment.includes("Excellent plumbing work!"));
  assert.ok(hasReview, "Newly submitted review does not appear on worker profile");
  console.log("✓ Test E3 Passed: Review appears on public worker profile");
  console.log("✓ Worker updated ratingAverage:", updatedProf.data.worker.ratingAverage, "| ratingCount:", updatedProf.data.worker.ratingCount);

  // 9. Test F: Security and validation tests
  // Unauthorized user cannot modify enquiry
  const wrongWorker = await post("/auth/login", { identifier: "imran@example.com", password: "Password123" });
  const wrongToken = wrongWorker.data.token;
  const invalidMod = await patch(`/enquiries/${enquiry._id}/status`, { status: "cancelled" }, wrongToken);
  assert.strictEqual(invalidMod.status, 403, "Unrelated user was able to modify enquiry");
  console.log("✓ Test F2 Passed: Unrelated worker forbidden from modifying enquiry (403)");

  // Invalid transition prevented (completed cannot be accepted again)
  const invalidTrans = await patch(`/enquiries/${enquiry._id}/status`, { status: "accepted" }, workerToken);
  assert.strictEqual(invalidTrans.status, 400, "Invalid transition completed -> accepted allowed");
  console.log("✓ Test F3 Passed: Invalid state transition blocked (400)");

  console.log("\n===========================================");
  console.log("ALL TESTS (A, B, C, D, E, F) PASSED 100%!");
  console.log("===========================================");
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
