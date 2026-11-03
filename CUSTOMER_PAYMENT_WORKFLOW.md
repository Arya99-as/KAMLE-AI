# CUSTOMER PAYMENT WORKFLOW

**Project:** KAMLE AI Marketplace  
**Feature:** Customer Payment Portal & Razorpay Checkout Integration  
**Status:** Implemented & Verified  

---

## 1. Customer Workflow Overview

When the Admin approves a worker's completion request and forwards it to the customer:
1. The customer sees an alert banner in **PENDING PAYMENTS** (`/dashboard/customer`).
2. The card outlines the assigned worker, completed service category, booking ID, agreed quotation amount, and worker completion notes.
3. The customer clicks **PAY NOW**.
4. Razorpay Checkout modal opens with test/production key.
5. Upon successful transaction, Razorpay returns `razorpay_order_id`, `razorpay_payment_id`, and `razorpay_signature`.
6. The client posts the payload to `POST /api/payments/verify`.
7. Backend verifies HMAC SHA256 signature, marks Payment as `COMPLETED`, updates PaymentRequest `customerPaymentStatus` to `PAID`, and schedules worker payout for admin authorization.
8. Instant receipt is displayed and stored in payment history.

```mermaid
sequenceDiagram
    participant Customer
    participant Client as Web App (Razorpay Checkout)
    participant Server as KAMLE AI Server
    participant Gateway as Razorpay Gateway

    Customer->>Client: Click "PAY NOW ₹5,000"
    Client->>Server: POST /api/payments/create-order
    Server->>Gateway: orders.create({ amount: 500000, currency: "INR" })
    Gateway-->>Server: { id: "order_xyz", status: "created" }
    Server-->>Client: Return orderId & keyId
    Client->>Customer: Display Razorpay Modal (UPI, Cards, NetBanking)
    Customer->>Gateway: Authorizes payment
    Gateway-->>Client: Returns payment_id & signature
    Client->>Server: POST /api/payments/verify
    Server->>Server: Verify HMAC SHA256 Signature
    Server->>Server: Deduct Platform Commission (10%)
    Server->>Server: Sync PaymentRequest (customerPaymentStatus: PAID)
    Server-->>Client: 200 OK (Payment settled)
    Client->>Customer: Show verified receipt modal
```

