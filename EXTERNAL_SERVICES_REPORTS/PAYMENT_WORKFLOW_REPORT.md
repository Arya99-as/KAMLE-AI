# PAYMENT WORKFLOW REPORT — KAMLE AI

**Date:** 2026-11-03  
**Project:** KAMLE AI Marketplace  
**Domain:** FinTech Workflow, Quotation Governance & Marketplace Settlement  

---

## 1. END-TO-END WORKFLOW ARCHITECTURE

```
  CUSTOMER                                 WORKER                                  ADMIN
     │                                        │                                      │
  1. Browse & Discover Worker                 │                                      │
     │                                        │                                      │
  2. Send Service Request (Enquiry) ─────────►│                                      │
                                              │                                      │
                                           3. Accept Request                         │
                                              │                                      │
                                           4. Submit Itemized Quotation ────────────►│
                                              (Labour, Materials, Travel)            │
                                                                                  5. Review & Approve
                                                                                     Quotation
                                              ◄──────────────────────────────────────┤
                                              │                                      │
  6. Review Approved Quotation ◄──────────────┘                                      │
     │                                                                               │
  7. Accept Quotation                                                                │
     │                                                                               │
  8. Click "Pay Now"                                                                 │
     │                                                                               │
  9. Razorpay Checkout Modal                                                         │
     (UPI / NetBanking / Cards)                                                      │
     │                                                                               │
 10. Server Signature Verification ─────────────────────────────────────────────────►│
     (/api/payments/verify)                                                       11. Monitor Transaction
     │                                                                                Ledger
 12. Receipt Modal & Invoice ◄───────────────────────────────────────────────────────┤
                                              │                                      │
                                          13. Receive Payment Confirmation &      14. Authorize Payout
                                              Net Earnings Breakdown                  Disbursement
```

---

## 2. STATE MACHINE TRANSITIONS

### 2.1 Quotation State Machine
```
[DRAFT] ──(submit)──► [SUBMITTED] ──(admin decision)──► [APPROVED] ──(customer response)──► [ACCEPTED] ──► [PAID]
                           │                                  │
                           ├──► [REVISION_REQUESTED]          └──► [REJECTED] ──► (Worker revises)
                           │
                           └──► [REJECTED]
```

### 2.2 Payment State Machine
```
[PENDING] ──(verify & settle)──► [COMPLETED] ──(refund)──► [REFUNDED]
    │
    └──(invalid signature)──► [FAILED]
```

### 2.3 Payout State Machine
```
[PENDING] ──(admin authorize / Route transfer)──► [PAID]
    │
    └──(transfer error / reversal)──────────────► [FAILED]
```

---

## 3. FINANCIAL SPLIT MATH & COMMISSION FORMULAS

1. **Quotation Total:**
   $$\text{Subtotal} = \text{Labour Charges} + \text{Material Charges} + \sum \text{Additional Charges}$$
   $$\text{Total Payable} = \text{Subtotal}$$

2. **Platform Commission Calculation:**
   $$\text{Platform Commission Rate} = 10\% \quad (\text{Configurable via } \texttt{PlatformConfig})$$
   $$\text{Commission Amount} = \text{Round}\left(\text{Total Payable} \times \frac{\text{Commission Rate}}{100}\right)$$

3. **Net Worker Payable:**
   $$\text{Net Worker Earnings} = \text{Total Payable} - \text{Commission Amount}$$

*Example from automated test execution:*
- Quotation Total: **₹750** (Labour ₹400 + Material ₹250 + Emergency Travel ₹100)
- Platform Commission (10%): **₹75**
- Net Worker Payable (90%): **₹675**

---

## 4. UI SAFETY GUARDS & CONDITIONAL RENDERING

1. **Customer Dashboard:**
   - The "Pay Now" button is strictly conditionally rendered.
   - It only appears when:
     - `enquiry.status === "COMPLETED"` or an approved quote is awaiting payment
     - `enquiry.paymentStatus !== "PAID"`
     - `enquiry.serviceAmount > 0`
   - Prevents duplicate clicks by tracking local transaction submission state.

2. **Worker Dashboard:**
   - Displays clear separation between **Gross Earnings**, **Platform Commission**, and **Net Earnings**.
   - Transparent payout tracking table detailing pending vouchers versus settled transfers.

3. **Admin Dashboard:**
   - Dedicated "Payments & Financial Transactions" view.
   - Real-time customer payment ledger and worker payout voucher ledger.
   - One-click payout authorization button with live Route status verification.

