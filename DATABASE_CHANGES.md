# DATABASE CHANGES

**Project:** KAMLE AI Marketplace  
**Feature:** Payment Request Model & Platform Config Extensions  
**Status:** Implemented & Verified  

---

## 1. New Model: `PaymentRequest` (`server/src/models/PaymentRequest.ts`)

| Field | Type | Attributes | Description |
|---|---|---|---|
| `enquiryId` | `ObjectId` | Ref: Enquiry, Required, Indexed | Associated booking |
| `quotationId` | `ObjectId` | Ref: Quotation, Indexed | Approved quotation reference |
| `workerId` | `ObjectId` | Ref: User, Required, Indexed | Assigned worker |
| `customerId` | `ObjectId` | Ref: User, Required, Indexed | Booking customer |
| `serviceCategory` | `String` | Required, Trim | Service category for fee lookup |
| `amount` | `Number` | Required, Min: 1 | Agreed total quotation amount |
| `agreedAmount` | `Number` | Required, Min: 1 | Alias for amount |
| `currency` | `String` | Default: "INR" | Payment currency |
| `completionNotes` | `String` | Trim, Max: 2000 | Notes submitted by worker |
| `completionEvidence` | `[String]` | Default: [] | Photo URLs of completed work |
| `status` | `String` | Enum | Request lifecycle status |
| `customerPaymentStatus` | `String` | Enum | Customer payment lifecycle status |
| `payoutStatus` | `String` | Enum | Worker payout lifecycle status |
| `commissionPercent` | `Number` | Required, Min: 0, Max: 100 | Applied commission percentage |
| `commissionAmount` | `Number` | Required, Min: 0 | Platform commission amount in INR |
| `workerPayableAmount` | `Number` | Required, Min: 0 | Net payable to worker in INR |
| `paymentId` | `ObjectId` | Ref: Payment, Indexed | Payment settlement record |
| `payoutId` | `ObjectId` | Ref: Payout, Indexed | Worker payout disbursement record |
| `adminRemarks` | `String` | Trim, Max: 1000 | Remarks by administrator |
| `providerPayoutRef` | `String` | Trim | Payout transaction reference |
| `history` | `Array` | Sub-documents | Immutable audit log of state changes |

---

## 2. Updated Model: `PlatformConfig` (`server/src/models/PlatformConfig.ts`)

Added dynamic commission settings:
- `categoryCommissions: [{ categoryName: String, commissionPercent: Number }]`
- `effectiveDate: Date`
- `calculationMethod: "percentage" | "fixed_plus_percentage"`
- `gatewayFeeBorneBy: "platform" | "customer" | "worker"`
