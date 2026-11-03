# RAZORPAY INTEGRATION REPORT — KAMLE AI

**Date:** 2026-11-03  
**Project:** KAMLE AI Marketplace  
**Gateway:** Razorpay Standard Checkout & Razorpay Route Marketplace Transfers  

---

## 1. ARCHITECTURAL OVERVIEW

The payment subsystem in KAMLE AI enforces a multi-tier authorization workflow to guarantee financial safety for both customers and service professionals:

```
[Customer Enquiry] 
      │
      ▼
[Worker Itemized Quotation] (Labour + Materials + Additional Charges)
      │
      ▼
[Admin Review & Approval] (Server computes and freezes approvedAmount)
      │
      ▼
[Customer Acceptance] (Customer reviews breakdown and approves quote)
      │
      ▼
[Razorpay Order Creation] (/api/payments/create-order)
      │
      ▼
[Razorpay Checkout Payment] (Cards / UPI / NetBanking / Wallets)
      │
      ▼
[Server HMAC Signature Verification] (/api/payments/verify or Webhook)
      │
      ▼
[Atomic Settlement & Split Payout Creation] (10% platform fee, 90% worker payable)
```

---

## 2. KEY IMPLEMENTATION DETAILS

### 2.1 Backend Services
1. **Order Creation (`createPaymentOrder`):**
   - Validates that the enquiry has an approved quotation: `quotation.status === "APPROVED"` and `quotation.customerStatus === "ACCEPTED"`.
   - Freezes immutable `amount = quotation.approvedAmount`.
   - Fetches platform commission from `PlatformConfig` (default: 10%).
   - Calculates commission split: `commissionAmount = amount * (commissionPercent / 100)` and `workerPayableAmount = amount - commissionAmount`.
   - Calls Razorpay Orders API: `POST https://api.razorpay.com/v1/orders` with amount in paise.
   - Generates and stores unique `transactionRef` and `providerOrderId` in `Payment` collection.

2. **Signature Verification (`verifyAndRecordPayment`):**
   - Verifies server-side HMAC-SHA256 signature:
     ```typescript
     crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
     ```
   - Uses constant-time buffer comparison (`crypto.timingSafeEqual`) to prevent timing attacks.
   - Idempotent: checks if already `COMPLETED` and returns existing settlement without duplicate increments.

3. **Settlement & Payout Generation (`settlePayment`):**
   - Atomically updates `Payment` status to `COMPLETED`.
   - Updates `Enquiry` payment status to `PAID`.
   - Updates `Quotation` paid timestamp: `paidAt = new Date()`.
   - Automatically upserts `Payout` record in `PENDING` state ready for admin disbursement or automated Route transfer.

4. **Razorpay Route Integration (`razorpayRouteService.ts`):**
   - Onboards worker bank accounts via Linked Accounts API: `POST /v1/accounts`.
   - Disburses worker earnings using Transfer API: `POST /v1/payments/{payment_id}/transfers`.
   - Reversal and refund capabilities: `POST /v1/transfers/{transfer_id}/reversals`.

---

## 3. TEST & VERIFICATION RESULTS

- Automated verification script: `server/tests/test_external_services.mjs`
- Test cases verified:
  - Quotation requirement enforcement: 100% Pass
  - Order creation: 100% Pass
  - Signature verification: 100% Pass
  - Commission split computation: 100% Pass (₹750 quote → ₹75 platform commission, ₹675 worker earnings)
  - Duplicate payment prevention: 100% Pass (re-paying a paid enquiry returns `400 Bad Request: already been paid`)

