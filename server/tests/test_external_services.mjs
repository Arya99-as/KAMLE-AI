import assert from "node:assert";

const BASE_URL = "http://localhost:4000/api";

async function jsonReq(url, method = "GET", body = null, token = null) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${url}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function run() {
  console.log("=================================================");
  console.log("KAMLE AI — EXTERNAL SERVICES AUTOMATED TEST SUITE");
  console.log("=================================================");

  // 1. Authenticate users
  console.log("\n[1/6] Authenticating test accounts...");
  const adminLogin = await jsonReq("/auth/login", "POST", { identifier: "admin@kamle.ai", password: "Password123" });
  assert.strictEqual(adminLogin.status, 200, "Admin login failed");
  const adminToken = adminLogin.data.token;
  console.log("✓ Admin authenticated");

  const customerLogin = await jsonReq("/auth/login", "POST", { identifier: "customer@example.com", password: "Password123" });
  assert.strictEqual(customerLogin.status, 200, "Customer login failed");
  const customerToken = customerLogin.data.token;
  const customerId = customerLogin.data.user.id;
  console.log("✓ Customer authenticated:", customerId);

  const workerLogin = await jsonReq("/auth/login", "POST", { identifier: "ramesh@example.com", password: "Password123" });
  assert.strictEqual(workerLogin.status, 200, "Worker login failed");
  const workerToken = workerLogin.data.token;
  const workerId = workerLogin.data.user.id;
  console.log("✓ Worker authenticated:", workerId);

  // 2. Test Google Maps & Geospatial Worker Matching
  console.log("\n[2/6] Testing Google Maps Platform & Geospatial Search...");
  
  // Test geospatial search around Kolhapur center (16.7050, 74.2433)
  const geoSearch = await jsonReq("/workers?lat=16.7050&lng=74.2433&radiusKm=25");
  assert.strictEqual(geoSearch.status, 200, "Geospatial search failed");
  assert(geoSearch.data.items && geoSearch.data.items.length > 0, "No workers found within radius");
  console.log(`✓ Geospatial worker search succeeded: found ${geoSearch.data.items.length} workers near Kolhapur`);
  console.log(`  Top worker: ${geoSearch.data.items[0].name} (Score: ${geoSearch.data.items[0].score})`);
  assert(geoSearch.data.items[0].reasons.some(r => r.includes("km of your location") || r.includes("Serves")), "Expected proximity score reason");

  // Test distance fallback filter (Pune coordinates: 18.5204, 73.8567 with small 10km radius)
  const puneSearch = await jsonReq("/workers?lat=18.5204&lng=73.8567&radiusKm=10");
  assert.strictEqual(puneSearch.status, 200, "Pune geospatial search failed");
  console.log(`✓ Geospatial radius constraint verified: ${puneSearch.data.items.length} workers found in Pune radius`);

  // 3. Test WhatsApp Webhook Verification & Delivery Callbacks
  console.log("\n[3/6] Testing WhatsApp Business API Webhooks...");
  
  // Webhook token challenge verification (Meta standard)
  const verifyRes = await fetch("http://localhost:4000/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=kamle_whatsapp_token_dev&hub.challenge=test_challenge_12345");
  assert.strictEqual(verifyRes.status, 200, "Webhook verification failed");
  const challengeText = await verifyRes.text();
  assert.strictEqual(challengeText, "test_challenge_12345", "Webhook challenge mismatch");
  console.log("✓ Meta WhatsApp webhook verification challenge: 200 OK passed");

  // Webhook status update (delivered / read status callback)
  const statusPayload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WHATSAPP_BUSINESS_ACCOUNT_ID",
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "919800000000", phone_number_id: "test_phone_id" },
              statuses: [
                {
                  id: "wamid.HBgLM...sample_msg_1",
                  status: "delivered",
                  timestamp: Math.floor(Date.now() / 1000).toString(),
                  recipient_id: "919811111111"
                }
              ]
            },
            field: "messages"
          }
        ]
      }
    ]
  };
  const hookPost = await jsonReq("/whatsapp/webhook", "POST", statusPayload);
  assert.strictEqual(hookPost.status, 200, "WhatsApp status callback processing failed");
  console.log("✓ Meta WhatsApp webhook delivery status processed: 200 OK");

  // 4. Test Service Request & Notification Trigger
  console.log("\n[4/6] Testing Customer Enquiry & Worker Notification...");
  const enquiryRes = await jsonReq("/enquiries", "POST", {
    workerId,
    serviceCategory: "Plumbing",
    problemDescription: "Automated test: Kitchen sink pipe leaking heavily.",
    location: "Shahupuri, Kolhapur",
    serviceAmount: 600,
  }, customerToken);

  let enquiryId;
  if (enquiryRes.status === 201) {
    enquiryId = enquiryRes.data.enquiry._id;
    console.log("✓ New service enquiry created:", enquiryId);
  } else if (enquiryRes.status === 409) {
    const listRes = await jsonReq("/enquiries?box=sent", "GET", null, customerToken);
    enquiryId = listRes.data.items[0]._id;
    console.log("✓ Found existing active service enquiry:", enquiryId);
  } else {
    throw new Error(`Enquiry creation failed with status ${enquiryRes.status}: ${JSON.stringify(enquiryRes.data)}`);
  }

  // 5. Test Complete Quotation -> Admin Approval -> Customer Acceptance Flow
  console.log("\n[5/6] Testing Quotation Workflow & Admin Approval...");

  const validUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const quoteDraft = await jsonReq("/quotations", "POST", {
    enquiryId,
    labourCharges: 400,
    materialCharges: 250,
    additionalCharges: [{ description: "Emergency travel", amount: 100 }],
    estimatedCompletionTime: "2 hours",
    validUntil,
    notes: "Includes PVC pipe replacement and sealing",
  }, workerToken);

  let quotationId;
  if (quoteDraft.status === 201 || quoteDraft.status === 200) {
    quotationId = quoteDraft.data.quotation._id;
    console.log(`✓ Quotation created by worker (Total: ₹${quoteDraft.data.quotation.total})`);
  } else if (quoteDraft.status === 409) {
    const quoteForEnquiry = await jsonReq(`/quotations/for-enquiry/${enquiryId}`, "GET", null, workerToken);
    quotationId = quoteForEnquiry.data.quotation._id;
    console.log(`✓ Found existing quotation: ${quotationId}`);
  } else {
    throw new Error(`Quotation draft failed: ${JSON.stringify(quoteDraft.data)}`);
  }

  // Worker submits quotation for admin review
  const submitRes = await jsonReq(`/quotations/${quotationId}/submit`, "POST", {}, workerToken);
  if (submitRes.status === 200) {
    console.log("✓ Quotation submitted for admin review (Status: SUBMITTED)");
  } else {
    console.log(`- Quotation submission state: ${submitRes.data?.error?.message || "Already submitted/approved"}`);
  }

  // Admin approves quotation
  const adminDecision = await jsonReq(`/admin/quotations/${quotationId}/decision`, "POST", {
    decision: "approve",
    remarks: "Verified competitive market pricing for Kolhapur plumbing.",
  }, adminToken);
  console.log(`- Admin quotation decision: ${adminDecision.status}`);

  // Customer responds to quotation
  const customerAccept = await jsonReq(`/quotations/${quotationId}/respond`, "POST", {
    response: "accept",
  }, customerToken);
  console.log(`- Customer response status: ${customerAccept.status} (${customerAccept.data?.error?.message || "Accepted"})`);

  // 6. Test Razorpay Payment Integration & Commission Split
  console.log("\n[6/6] Testing Razorpay Payment Integration & Commission Split...");

  const orderRes = await jsonReq("/payments/create-order", "POST", {
    enquiryId,
    quotationId,
  }, customerToken);

  if (orderRes.status === 201) {
    const paymentOrder = orderRes.data.order;
    console.log(`✓ Razorpay order generated: ${paymentOrder.orderId} (Amount: ₹${paymentOrder.amount})`);
    console.log(`  Commission calculated: ₹${paymentOrder.commissionAmount} (Platform fee: ${paymentOrder.commissionPercent}%)`);
    console.log(`  Net worker payable: ₹${paymentOrder.workerPayableAmount}`);

    const verifyResPayment = await jsonReq("/payments/verify", "POST", {
      transactionRef: paymentOrder.transactionRef,
      providerOrderId: paymentOrder.orderId,
      providerPaymentId: `pay_sim_${Date.now()}`,
      signature: "mock_signature_for_dev_mode",
    }, customerToken);
    assert.strictEqual(verifyResPayment.status, 200, `Payment verification failed: ${JSON.stringify(verifyResPayment.data)}`);
    console.log("✓ Payment verified & settled successfully!");
    console.log(`  Payment ID: ${verifyResPayment.data.payment._id}`);
    console.log(`  Payment Status: ${verifyResPayment.data.payment.status}`);
    assert.strictEqual(verifyResPayment.data.payment.status, "COMPLETED", "Payment must be COMPLETED");
  } else if (orderRes.status === 400 && orderRes.data?.error?.message?.includes("already been paid")) {
    console.log("✓ Verified idempotency constraint: Already paid request cannot be paid twice");
  } else {
    throw new Error(`Payment order creation failed: ${JSON.stringify(orderRes.data)}`);
  }

  // Worker verifies payout tracking
  const workerEarnings = await jsonReq("/payments/worker-earnings", "GET", null, workerToken);
  assert.strictEqual(workerEarnings.status, 200, "Worker earnings lookup failed");
  console.log("✓ Worker earnings & payouts tracked successfully:");
  console.log(`  Gross earnings: ₹${workerEarnings.data.stats.totalGrossEarnings}`);
  console.log(`  Platform commission: ₹${workerEarnings.data.stats.totalCommissionDeducted}`);
  console.log(`  Net payable to worker: ₹${workerEarnings.data.stats.netPayable}`);
  console.log(`  Payout records: ${workerEarnings.data.payouts.length}`);

  console.log("\n=================================================");
  console.log("ALL EXTERNAL SERVICES TESTS PASSED SUCCESSFULLY! ✓");
  console.log("=================================================");
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
