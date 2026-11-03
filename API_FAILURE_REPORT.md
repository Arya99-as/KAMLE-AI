# KAMLE AI — API Failure & Error Handling Report

**Audit Date:** 2026-11-02  
**Target:** KAMLE AI Core Backend & Security Middleware  
**Scope:** Error conditions, validation boundaries, rate limits, and anti-fraud protections.  

---

## 1. Summary of Handled Failure Modes

The KAMLE AI backend uses centralized error handling (`ApiError` + `errorHandler.ts`) with Zod request body validation (`validateBody.ts`). Every error returns a standardized JSON payload:

```json
{
  "error": {
    "message": "Specific human-readable message",
    "code": "ERROR_CODE",
    "details": []
  }
}
```

---

## 2. Identified & Verified Failure Scenarios

### 2.1. Authentication Failures
* **Endpoint:** `POST /api/auth/login`
  * **Failure Scenario:** Invalid password provided for existing account.
  * **Status Code:** `401 Unauthorized`
  * **Response:** `{"error": {"message": "Invalid email/phone or password", "code": "UNAUTHORIZED"}}`
  * **Security Check:** Prevents user enumeration by using identical error text whether email or password is wrong.

### 2.2. Rate Limiting Enforcement
* **Endpoint:** `POST /api/auth/login` & `POST /api/auth/register`
  * **Failure Scenario:** Exceeding `rateLimit.authMax` within the rate limit window.
  * **Status Code:** `429 Too Many Requests`
  * **Response:** `{"error": {"message": "Too many requests, please try again later.", "code": "TOO_MANY_REQUESTS"}}`
  * **Security Check:** Mitigates brute-force credential stuffing attacks against user accounts.

### 2.3. Schema Validation Failures
* **Endpoint:** `POST /api/auth/register`
  * **Failure Scenario:** Payload missing required `phone` or `password` fields.
  * **Status Code:** `400 Bad Request`
  * **Response Code:** `VALIDATION_ERROR` with detailed path array showing exact missing fields.

### 2.4. Cross-Role Privilege Violations (RBAC)
* **Endpoint:** `GET /api/admin/dashboard` & `GET /api/admin/payouts`
  * **Failure Scenario:** Authenticated Customer or Worker attempting to access administrative console.
  * **Status Code:** `403 Forbidden`
  * **Response:** `{"error": {"message": "Forbidden", "code": "FORBIDDEN"}}`
  * **Security Check:** Enforced server-side in `authorize("admin")` middleware before controller invocation.

### 2.5. Worker Booking Eligibility Failure
* **Endpoint:** `POST /api/enquiries`
  * **Failure Scenario:** Customer attempting to send enquiry to a worker whose profile is still `pending` or `rejected`.
  * **Status Code:** `404 Not Found`
  * **Response:** `{"error": {"message": "This worker is not available or not yet approved", "code": "NOT_FOUND"}}`
  * **Integrity Check:** Prevents customers from booking unverified or suspended service providers.

### 2.6. Anti-Spam Duplicate Review Guard
* **Endpoint:** `POST /api/reviews`
  * **Failure Scenario:** Customer submitting more than one review for the same worker/job.
  * **Status Code:** `409 Conflict`
  * **Response:** `{"error": {"message": "You have already reviewed this worker", "code": "CONFLICT"}}`
  * **Integrity Check:** Guarantees worker rating distribution cannot be artificially inflated.

### 2.7. Payment Verification IDOR Guard
* **Endpoint:** `POST /api/payments/create-order`
  * **Failure Scenario:** Customer A attempting to initiate payment for an enquiry created by Customer B.
  * **Status Code:** `403 Forbidden`
  * **Integrity Check:** `enquiry.customerId` is compared strictly against `req.user.id`.

### 2.8. Unsettled Payout Prevention
* **Endpoint:** `PATCH /api/admin/payouts/:id/status`
  * **Failure Scenario:** Admin attempting to mark a payout as `PAID` without providing a bank reference `providerPayoutRef`.
  * **Status Code:** `400 Bad Request`
  * **Integrity Check:** Enforces audit trail requirement for all financial disbursements.

