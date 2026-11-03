import assert from "node:assert";

const BASE_URL = "http://localhost:4000/api";

async function patch(path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function post(path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function get(path, token) {
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, { headers });
  const data = await res.json();
  return { status: res.status, data };
}

async function runTests() {
  console.log("=== STARTING MASTER PAYMENT WORKFLOW END-TO-END TEST ===");

  // 1. Authenticate users
  console.log("\n[1] Authenticating Demo Users...");
  const adminLogin = await post("/auth/login", { identifier: "admin@kamle.ai", password: "Password123" });
  assert.strictEqual(adminLogin.status, 200, "Admin login failed");
  const adminToken = adminLogin.data.token;
  console.log("✔ Admin authenticated");

  const workerLogin = await post("/auth/login", { identifier: "9800000001", password: "Password123" });
  assert.strictEqual(workerLogin.status, 200, "Worker login failed");
  const workerToken = workerLogin.data.token;
  const workerId = workerLogin.data.user.id;
  console.log(`✔ Worker authenticated (ID: ${workerId})`);

  const customerLogin = await post("/auth/login", { identifier: "8623970107", password: "Password123" });
  assert.strictEqual(customerLogin.status, 200, "Customer login failed");
  const customerToken = customerLogin.data.token;
  const customerId = customerLogin.data.user.id;
  console.log(`✔ Customer 8623970107 authenticated (ID: ${customerId})`);

  // 2. Customer creates an Enquiry
  console.log("\n[2] Customer submits an Enquiry...");
  let enquiryId;
  const enquiryRes = await post("/enquiries", {
    workerId,
    serviceCategory: "Plumbing",
    problemDescription: "Complete bathroom pipe overhaul and leak fixing",
    location: "Kolhapur",
  }, customerToken);
  if (enquiryRes.status === 201) {
    enquiryId = enquiryRes.data.enquiry._id;
  } else if (enquiryRes.status === 409) {
    const list = await get("/enquiries", customerToken);
    const existing = list.data.items?.find((e) => String(typeof e.workerId === "object" ? e.workerId._id : e.workerId) === String(workerId));
    enquiryId = existing?._id;
  }
  assert.ok(enquiryId, "Could not acquire enquiry ID");
  console.log(`✔ Enquiry active: ${enquiryId}`);

  // 3. Worker accepts the enquiry
  console.log("\n[3] Worker accepts the Enquiry...");
  const acceptRes = await patch(`/enquiries/${enquiryId}/status`, { status: "ACCEPTED" }, workerToken);
  if (acceptRes.status === 200 || acceptRes.data?.error?.message?.includes("ACCEPTED to ACCEPTED")) {
    console.log("✔ Enquiry accepted by worker");
  } else {
    assert.fail(`Worker accept enquiry failed with status ${acceptRes.status}`);
  }

  // 4. Worker submits a quotation of ₹5,000
  console.log("\n[4] Worker drafts and submits quotation of ₹5,000...");
  let quotationId;
  const quoteDraft = await post("/quotations", {
    enquiryId,
    labourCharges: 1500,
    materialCharges: 3500,
    estimatedCompletionTime: "1 day",
    validUntil: new Date(Date.now() + 86400000 * 7).toISOString(),
    notes: "Includes 6 months leak warranty",
  }, workerToken);

  if (quoteDraft.status === 201) {
    quotationId = quoteDraft.data.quotation._id;
    // Worker submits to admin review queue
    await post(`/quotations/${quotationId}/submit`, {}, workerToken);
  } else {
    const existingQ = await get(`/quotations/for-enquiry/${enquiryId}`, workerToken);
    quotationId = existingQ.data.quotation?._id;
  }
  assert.ok(quotationId, "Quotation ID required");
  console.log(`✔ Quotation submitted to admin queue: ${quotationId}`);

  // 5. Admin approves quotation
  console.log("\n[5] Admin approves Quotation...");
  const adminApproveQuote = await post(`/admin/quotations/${quotationId}/decision`, {
    decision: "approve",
  }, adminToken);
  if (adminApproveQuote.status === 200 || adminApproveQuote.data?.error?.message?.includes("already")) {
    console.log("✔ Quotation approved by Admin");
  } else {
    assert.fail(`Admin quote approval failed: ${JSON.stringify(adminApproveQuote.data)}`);
  }

  // 6. Customer accepts quotation
  console.log("\n[6] Customer accepts Quotation...");
  const custAcceptQuote = await post(`/quotations/${quotationId}/respond`, {
    response: "accept",
  }, customerToken);
  if (custAcceptQuote.status === 200 || custAcceptQuote.data?.error?.message?.includes("already")) {
    console.log("✔ Quotation accepted by Customer");
  } else {
    assert.fail(`Customer quote accept failed: ${JSON.stringify(custAcceptQuote.data)}`);
  }

  // 7. Worker completes job & submits Payment Request to Admin
  console.log("\n[7] Worker marks work completed and requests payment from Admin...");
  const paymentReqRes = await post("/payment-requests", {
    enquiryId,
    completionNotes: "All copper pipes installed, tested under high pressure with zero leaks.",
    completionEvidence: ["https://images.unsplash.com/photo-1581092160607-ee22621dd758"],
  }, workerToken);
  assert.strictEqual(paymentReqRes.status, 201, "Payment request submission failed");
  const pReq = paymentReqRes.data.paymentRequest;
  const reqId = pReq._id;
  const amount = pReq.agreedAmount || pReq.amount;
  assert.strictEqual(amount, 5000, "Agreed amount mismatch");
  assert.strictEqual(pReq.commissionPercent, 10, "Commission percent should be 10%");
  assert.strictEqual(pReq.commissionAmount, 500, "Commission should be ₹500");
  assert.strictEqual(pReq.workerPayableAmount, 4500, "Worker net should be ₹4,500");
  assert.strictEqual(pReq.status, "SUBMITTED");
  console.log(`✔ Payment Request created: ${reqId} (Gross: ₹5,000, Commission: ₹500, Worker Net: ₹4,500)`);

  // 8. Admin reviews & sends payment request to Customer
  console.log("\n[8] Admin reviews and sends payment request to Customer...");
  const adminDecision = await post(`/payment-requests/admin/${reqId}/decision`, {
    action: "send_to_customer",
    remarks: "Workmanship and completion photographs verified by Admin. Forwarding to customer for payment.",
  }, adminToken);
  assert.strictEqual(adminDecision.status, 200, "Admin decision failed");
  assert.strictEqual(adminDecision.data.paymentRequest.status, "CUSTOMER_PAYMENT_REQUESTED");
  assert.strictEqual(adminDecision.data.paymentRequest.customerPaymentStatus, "PENDING");
  console.log("✔ Admin approved and requested payment from customer");

  // 9. Customer fetches pending payment requests
  console.log("\n[9] Customer fetches pending payment requests...");
  const pendingRes = await get("/payment-requests/customer-pending", customerToken);
  assert.strictEqual(pendingRes.status, 200, "Fetch customer pending payments failed");
  const hasRequest = pendingRes.data.requests.some((r) => r._id === reqId);
  assert.ok(hasRequest, "Customer did not receive pending payment request");
  console.log(`✔ Customer sees pending payment request #${reqId} for ₹5,000`);

  // 10. Customer initiates Razorpay Checkout and pays
  console.log("\n[10] Customer creates Razorpay Order & verifies payment...");
  const orderRes = await post("/payments/create-order", { enquiryId }, customerToken);
  assert.ok([200, 201].includes(orderRes.status), "Order creation failed");
  const orderId = orderRes.data.order.orderId;
  const txRef = orderRes.data.order.transactionRef;
  console.log(`✔ Razorpay Order created: ${orderId} (Amount: ₹5,000)`);

  const verifyRes = await post("/payments/verify", {
    providerOrderId: orderId,
    providerPaymentId: `pay_${Date.now()}`,
    signature: "mock_signature_test_mode",
    transactionRef: txRef,
    paymentMethod: "razorpay_checkout",
  }, customerToken);
  assert.strictEqual(verifyRes.status, 200, "Payment verification failed");
  console.log("✔ Customer payment verified and settled successfully");

  // 11. Verify PaymentRequest updated to customerPaymentStatus: PAID & payoutStatus: PENDING_ADMIN_APPROVAL
  console.log("\n[11] Verifying PaymentRequest settlement state...");
  const reqCheck = await get(`/payment-requests/for-enquiry/${enquiryId}`, adminToken);
  assert.strictEqual(reqCheck.status, 200);
  assert.strictEqual(reqCheck.data.paymentRequest.customerPaymentStatus, "PAID");
  assert.strictEqual(reqCheck.data.paymentRequest.payoutStatus, "PENDING_ADMIN_APPROVAL");
  const payoutId = typeof reqCheck.data.paymentRequest.payoutId === "object"
    ? reqCheck.data.paymentRequest.payoutId._id
    : reqCheck.data.paymentRequest.payoutId;
  assert.ok(payoutId, "Payout ID must be set on PaymentRequest");
  console.log(`✔ PaymentRequest marked PAID; Payout ID: ${payoutId} awaiting admin approval`);

  // 12. Admin authorizes worker payout
  console.log("\n[12] Admin authorizes worker payout...");
  const payoutRef = `pout_transfer_${Date.now()}`;
  const authPayout = await post("/payment-requests/admin/authorize-payout", {
    payoutId,
    providerPayoutRef: payoutRef,
    note: "Settlement disbursed to worker bank account",
  }, adminToken);
  assert.strictEqual(authPayout.status, 200, "Payout authorization failed");
  assert.strictEqual(authPayout.data.payout.status, "PAID");
  assert.strictEqual(authPayout.data.paymentRequest.payoutStatus, "PAID");
  assert.strictEqual(authPayout.data.paymentRequest.providerPayoutRef, payoutRef);
  console.log(`✔ Worker payout authorized and marked PAID with reference ${payoutRef}`);

  // 13. Worker checks their payment requests and earnings
  console.log("\n[13] Worker checks my payment requests & earnings...");
  const workerReqs = await get("/payment-requests/my", workerToken);
  assert.strictEqual(workerReqs.status, 200);
  const myReq = workerReqs.data.items.find((r) => r._id === reqId);
  assert.ok(myReq, "Worker cannot find their payment request");
  assert.strictEqual(myReq.customerPaymentStatus, "PAID");
  assert.strictEqual(myReq.payoutStatus, "PAID");
  assert.strictEqual(myReq.workerPayableAmount, 4500);
  assert.strictEqual(myReq.providerPayoutRef, payoutRef);

  const earnings = await get("/payments/worker-earnings", workerToken);
  assert.strictEqual(earnings.status, 200);
  console.log(`✔ Worker sees payout confirmed in earnings! (Net payable: ₹${earnings.data.stats.netPayable}, Total Paid Out: ₹${earnings.data.stats.totalPaidOut})`);

  // 14. Negative Tests
  console.log("\n[14] Running Security & Financial Control Negative Tests...");

  // Non-worker attempts to submit payment request
  const neg1 = await post("/payment-requests", { enquiryId, completionNotes: "hacker" }, customerToken);
  assert.strictEqual(neg1.status, 403, "Customer should be forbidden from submitting payment requests");
  console.log("✔ Negative Test 1 passed: Customer forbidden from submitting worker payment request");

  // Worker attempts to submit payment request on an already completed request
  const neg2 = await post("/payment-requests", { enquiryId, completionNotes: "duplicate request" }, workerToken);
  assert.strictEqual(neg2.status, 409, "Duplicate payment request should return 409 Conflict");
  console.log("✔ Negative Test 2 passed: Idempotency prevents duplicate payment requests");

  console.log("\n=======================================================");
  console.log("  ALL TESTS PASSED: FULL PAYMENT LIFECYCLE VERIFIED!  ");
  console.log("=======================================================\n");
}

runTests().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
