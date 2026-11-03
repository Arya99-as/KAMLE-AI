# COMMISSION CALCULATION REPORT

**Project:** KAMLE AI Marketplace  
**Feature:** Dynamic Category-Based Commission Engine  
**Status:** Implemented & Verified  

---

## 1. Commission Formula & Principles

Platform commission is dynamically calculated based on platform configuration and optional service-category overrides:

$$\text{Platform Commission} = \frac{\text{Verified Customer Payment} \times \text{Commission Percentage}}{100}$$

$$\text{Worker Net Earnings} = \text{Verified Customer Payment} - \text{Platform Commission}$$

### Key Financial Invariants:
1. **Never Hardcoded:** Configurable in `PlatformConfig` (`default: 10%`).
2. **Category-Specific Overrides:** If `categoryCommissions` has an entry for the enquiry's service category (e.g. Electrical: 12%, Appliance Repair: 15%), it takes precedence over the default rate.
3. **Historical Transaction Immutability:** The applied `commissionPercent`, `commissionAmount`, and `workerPayableAmount` are saved directly onto the `PaymentRequest` and `Payment` records at time of order creation. Future changes to commission settings do not recalculate settled transactions.
4. **Gateway Fee Transparency:** Gateway charges are tracked independently and configured via `PlatformConfig.gatewayFeeBorneBy` (`"platform" | "customer" | "worker"`), preventing silent deductions from worker earnings.

---

## 2. Example Calculation

| Transaction Item | Amount (₹) | Formula / Rate |
|---|---|---|
| Customer Gross Payment | ₹5,000.00 | Agreed approved quotation |
| Platform Commission (10%) | ₹500.00 | ₹5,000 × 10 / 100 |
| Worker Net Payable | ₹4,500.00 | ₹5,000 - ₹500 |
