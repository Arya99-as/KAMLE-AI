# DATABASE INTEGRATION REPORT
## KAMLE AI — MongoDB Schema, Indexes & Relationships

**Generated:** 2026-11-03  
**Database Engine:** MongoDB (via Mongoose ODM)  
**Dev Mode:** `mongodb-memory-server` (in-memory, D:\ drive dbPath)  
**Production Mode:** MongoDB Atlas (recommended)

---

## 1. Model Inventory

| Model | File | Purpose |
|---|---|---|
| `User` | `models/User.ts` | Core identity for Customer, Worker, Admin roles |
| `WorkerProfile` | `models/WorkerProfile.ts` | Extended worker data, skills, geo location |
| `Enquiry` | `models/Enquiry.ts` | Customer service request lifecycle |
| `Quotation` | `models/Quotation.ts` | Worker price quote with admin approval workflow |
| `Payment` | `models/Payment.ts` | Razorpay order and payment record |
| `Payout` | `models/Payout.ts` | Worker payout tracking |
| `Refund` | `models/Refund.ts` | Admin-initiated refund record |
| `WebhookEvent` | `models/WebhookEvent.ts` | Idempotent Razorpay webhook event log |
| `Notification` | `models/Notification.ts` | In-app and WhatsApp notification record |
| `Review` | `models/Review.ts` | Customer rating and review |
| `Favorite` | `models/Favorite.ts` | Customer saved worker list |
| `ChatSession` | `models/ChatSession.ts` | AI chat sessions (customer-scoped) |
| `AiLog` | `models/AiLog.ts` | AI interaction logs |
| `AiConfig` | `models/AiConfig.ts` | Per-role AI configuration |
| `PlatformConfig` | `models/PlatformConfig.ts` | Global platform settings (commission rate, etc.) |
| `ServiceCategory` | `models/ServiceCategory.ts` | Master list of service categories |
| `AuditLog` | `models/AuditLog.ts` | Admin action audit trail |
| `Report` | `models/Report.ts` | User-submitted problem reports |

---

## 2. Core Model Schemas

### 2.1 User (`models/User.ts`)

```
Fields:
  name           String  required
  email          String  unique, indexed
  phone          String  unique, indexed
  passwordHash   String  required (bcrypt)
  role           Enum    customer | worker | admin
  avatar         String  optional
  address        String  optional
  locationGeo    GeoJSON { type: "Point", coordinates: [lng, lat] }  optional, sparse 2dsphere
  isActive       Boolean default true
  createdAt      Date    auto
  updatedAt      Date    auto

Indexes:
  { email: 1 }           unique
  { phone: 1 }           unique
  { role: 1 }
  { locationGeo: "2dsphere" }  sparse: true
```

> [!NOTE] The `locationGeo` field uses a **sparse 2dsphere index** to support geospatial queries while allowing existing documents without coordinates. Non-sparse 2dsphere indexes reject documents missing the geo field.

### 2.2 WorkerProfile (`models/WorkerProfile.ts`)

```
Fields:
  userId             ObjectId   ref: User, unique, indexed
  serviceCategories  [String]   indexed, text-search
  skills             [String]
  experience         Number     years
  hourlyRate         Number     min: 0
  serviceAreas       [String]   city/area names for fallback matching
  locationGeo        GeoJSON    { type: "Point", coordinates: [lng, lat] }  optional
  serviceRadiusKm    Number     default: 20
  isAvailable        Boolean    default: true, indexed
  isVerified         Boolean    default: false, indexed
  approvalStatus     Enum       PENDING | APPROVED | REJECTED | SUSPENDED
  rating             Number     0-5
  totalReviews       Number     default: 0
  totalEarnings      Number     default: 0
  completedJobs      Number     default: 0
  bio                String     maxlength: 1000
  portfolio          [String]   image URLs
  createdAt          Date
  updatedAt          Date

Indexes:
  { userId: 1 }                              unique
  { approvalStatus: 1, serviceCategories: 1 } compound
  { isAvailable: 1, isVerified: 1 }          compound
  { locationGeo: "2dsphere" }                sparse: true
  { serviceCategories: "text", skills: "text" }  full-text search
```

### 2.3 Enquiry (`models/Enquiry.ts`)

```
Fields:
  customerId          ObjectId   ref: User, indexed
  workerId            ObjectId   ref: User, indexed
  serviceCategory     String     required
  problemDescription  String     required, maxlength: 2000
  location            String     city/area text
  status              Enum       PENDING | ACCEPTED | REJECTED | IN_PROGRESS
                                 | COMPLETED | CANCELLED | DISPUTED | sent | declined
  serviceAmount       Number     min: 0, default: 0
  paymentStatus       Enum       UNPAID | PAID | REFUNDED, indexed
  clientConfirmedAt   Date       optional
  disputeReason       String     optional
  scheduledDate       Date       optional
  statusHistory       [Event]    embedded sub-documents
  createdAt           Date
  updatedAt           Date

Embedded StatusEvent:
  status  String  required
  at      Date    default: now
  by      ObjectId  ref: User
  note    String  optional

Indexes:
  { customerId: 1, workerId: 1, status: 1 }  compound
  { workerId: 1, status: 1, createdAt: -1 }
  { status: 1, createdAt: -1 }
  { paymentStatus: 1 }
```

### 2.4 Quotation (`models/Quotation.ts`)

```
Fields:
  enquiryId               ObjectId   ref: Enquiry, unique (1 quotation per enquiry)
  customerId              ObjectId   ref: User
  workerId                ObjectId   ref: User
  status                  Enum       DRAFT | SUBMITTED | UNDER_REVIEW | APPROVED
                                     | REJECTED | REVISION_REQUESTED | EXPIRED
  labourCharges           Number     min: 0
  materialCharges         Number     min: 0
  additionalCharges       [Charge]   embedded
  subtotal                Number     server-computed: labour + material + additional
  total                   Number     approved/final amount
  estimatedCompletionTime String     maxlength: 120
  validUntil              Date       indexed
  notes                   String     maxlength: 1000
  revisionNumber          Number     increments on each worker revision
  history                 [Event]    approval history trail
  approvedAmount          Number     set by admin on approval
  approvedBy              ObjectId   ref: User (admin)
  approvedAt              Date
  adminRemarks            String     maxlength: 1000
  decidedAt               Date
  customerStatus          Enum       PENDING | ACCEPTED | REJECTED, indexed
  respondedAt             Date
  paidAt                  Date
  paymentId               ObjectId   ref: Payment

Indexes:
  { enquiryId: 1 }                        unique
  { workerId: 1, status: 1, createdAt: -1 }
  { customerId: 1, status: 1, createdAt: -1 }
  { status: 1, createdAt: -1 }
```

### 2.5 Payment (`models/Payment.ts`)

```
Fields:
  enquiryId           ObjectId   ref: Enquiry, indexed
  customerId          ObjectId   ref: User, indexed
  workerId            ObjectId   ref: User, indexed
  quotationId         ObjectId   ref: Quotation, indexed
  approvedAmount      Number     original quotation approved amount
  categoryName        String
  amount              Number     actual charged amount (INR paise base)
  currency            String     default: INR
  commissionPercent   Number     0-100, default: 10
  commissionAmount    Number     computed: amount × commissionPercent / 100
  workerPayableAmount Number     computed: amount - commissionAmount
  refundedAmount      Number     default: 0
  refundStatus        Enum       NONE | PARTIAL | FULL, indexed
  status              Enum       PENDING | COMPLETED | FAILED | REFUND_REQUESTED | REFUNDED
  provider            String     mock | razorpay
  transactionRef      String     unique, indexed (internal idempotency key)
  providerOrderId     String     Razorpay order ID, indexed
  providerPaymentId   String     Razorpay payment ID, indexed
  paymentMethod       String     upi | card | netbanking | wallet etc.
  transfers           [Transfer] embedded — Razorpay Route transfer records
  verifiedAt          Date       HMAC verification timestamp
  metadata            Mixed      extra Razorpay metadata

Embedded Transfer:
  transferId  String  Razorpay Transfer ID
  account     String  Razorpay Linked Account ID
  amount      Number
  status      String  created | pending | processed
  createdAt   Date

Indexes:
  { transactionRef: 1 }              unique
  { enquiryId: 1, status: 1 }
  { customerId: 1, createdAt: -1 }
  { workerId: 1, createdAt: -1 }
  { providerOrderId: 1 }
  { providerPaymentId: 1 }
  { status: 1 }
  { refundStatus: 1 }
```

### 2.6 Payout (`models/Payout.ts`)

```
Fields:
  workerId            ObjectId   ref: User, indexed
  enquiryId           ObjectId   ref: Enquiry, indexed
  paymentId           ObjectId   ref: Payment, unique (1 payout per payment)
  serviceAmount       Number     gross service charge
  commissionAmount    Number     platform fee deducted
  workerPayableAmount Number     net amount worker receives
  status              Enum       PENDING | PROCESSING | PAID | FAILED, indexed
  method              Enum       route | manual  (Razorpay Route vs manual transfer)
  providerPayoutRef   String     Razorpay payout reference
  linkedAccountId     String     Razorpay Linked Account ID
  transferId          String     Razorpay Transfer ID, indexed
  transferStatus      String     Razorpay transfer status
  approvedBy          ObjectId   ref: User (admin)
  approvedAt          Date
  paidAt              Date
  failureReason       String
  note                String     maxlength: 500

Indexes:
  { paymentId: 1 }               unique
  { workerId: 1, status: 1, createdAt: -1 }
```

### 2.7 Refund (`models/Refund.ts`)

```
Fields:
  paymentId        ObjectId   ref: Payment, indexed
  enquiryId        ObjectId   ref: Enquiry, indexed
  customerId       ObjectId   ref: User, indexed
  workerId         ObjectId   ref: User, indexed
  amount           Number     required, min: 1
  currency         String     default: INR
  reason           String     required, minlength: 5
  razorpayRefundId String     Razorpay refund ID, indexed
  status           Enum       PENDING | PROCESSED | FAILED, indexed
  processedBy      ObjectId   ref: User (admin)
  processedAt      Date
  failureReason    String

Indexes:
  { paymentId: 1, status: 1 }
  { customerId: 1, createdAt: -1 }
```

### 2.8 WebhookEvent (`models/WebhookEvent.ts`)

```
Fields:
  eventId      String   required, unique, indexed  (Razorpay event ID for idempotency)
  eventType    String   required, indexed
  provider     String   default: razorpay
  processed    Boolean  default: false, indexed
  processedAt  Date
  payload      Mixed    raw webhook payload
  error        String   processing error if any

Indexes:
  { eventId: 1 }     unique (idempotency guard)
  { eventType: 1 }
  { processed: 1 }
  { createdAt: -1 }
```

### 2.9 Notification (`models/Notification.ts`)

```
Fields:
  userId            ObjectId   ref: User, indexed
  type              Enum       ENQUIRY | QUOTATION | PAYMENT | BOOKING
                               | PAYOUT | SYSTEM | DISPUTE | REVIEW
  title             String     maxlength: 200
  message           String     maxlength: 1000
  data              Mixed      contextual metadata (enquiryId, amount, etc.)
  channels          [String]   IN_APP | WHATSAPP | EMAIL | SMS
  status            Enum       PENDING | SENT | DELIVERED | FAILED | READ, indexed
  whatsappStatus    Enum       parallel tracking for WhatsApp delivery
  whatsappMessageId String     Meta WAMID for delivery status tracking
  whatsappError     String     error message if WhatsApp send failed
  readAt            Date
  sentAt            Date

Indexes:
  { userId: 1, status: 1, createdAt: -1 }
```

---

## 3. Entity-Relationship Diagram

```
User (role: customer) ──── creates ──→ Enquiry ←─── assigned to ──── User (role: worker)
                                          │
                                          │ 1:1
                                          ↓
                                      Quotation ──── approvedBy ──→ User (role: admin)
                                          │
                                          │ 1:1 (on customer accept)
                                          ↓
                                       Payment ←──── processedBy (admin) ──── Refund
                                          │
                                          │ 1:1
                                          ↓
                                        Payout ──── approvedBy ──→ User (role: admin)

User (role: worker) ──── has ──→ WorkerProfile
User (role: customer) ──── has ──→ Favorite (→ WorkerProfile)
User (any) ──── receives ──→ Notification
Enquiry ──── logged by ──→ WebhookEvent (Razorpay events)
Payment ──── triggers ──→ Notification (customer + worker)
```

---

## 4. Index Strategy Summary

| Index Type | Fields | Purpose |
|---|---|---|
| **Unique** | `Payment.transactionRef` | Idempotency: prevent duplicate payment records |
| **Unique** | `Payout.paymentId` | One payout per payment |
| **Unique** | `Quotation.enquiryId` | One quotation document per enquiry |
| **Unique** | `WebhookEvent.eventId` | Idempotent webhook processing |
| **Compound** | `WorkerProfile.approvalStatus + serviceCategories` | Fast worker discovery filtering |
| **Compound** | `Payment.customerId + createdAt` | Customer payment history (paginated) |
| **Compound** | `Payment.workerId + createdAt` | Worker earnings history (paginated) |
| **Compound** | `Payout.workerId + status + createdAt` | Worker payout dashboard |
| **Compound** | `Enquiry.customerId + workerId + status` | Customer-worker job lookup |
| **2dsphere (sparse)** | `User.locationGeo` | Customer geospatial proximity queries |
| **2dsphere (sparse)** | `WorkerProfile.locationGeo` | Worker `$near` geospatial search |
| **Text** | `WorkerProfile.serviceCategories + skills` | Full-text skill search |

> [!IMPORTANT] Both 2dsphere indexes are declared `{ sparse: true }`. Without this, MongoDB rejects documents that lack a `locationGeo` field, which would break all existing workers who registered without GPS coordinates.

---

## 5. Financial Calculation Integrity

All monetary calculations are performed **server-side only** and stored in the `Payment` document:

```
commissionAmount    = floor(amount × commissionPercent / 100)
workerPayableAmount = amount - commissionAmount

Example (₹750 service, 10% commission):
  amount              = 750
  commissionPercent   = 10
  commissionAmount    = 75
  workerPayableAmount = 675
```

The `PlatformConfig` model stores the global `commissionPercent` value. The `paymentService.ts` reads this value at order creation time and embeds it into each `Payment` document so historical records are immutable even if the platform rate changes later.

---

## 6. Data Consistency & Safety

| Concern | Mechanism |
|---|---|
| Duplicate payments | `transactionRef` unique index + pre-check in `createPaymentOrder` |
| Duplicate webhooks | `WebhookEvent.eventId` unique index → `upsert` with `$setOnInsert` |
| Concurrent payment attempts | Check `enquiry.paymentStatus !== "PAID"` before order creation |
| Orphaned payout records | `Payout.paymentId` unique — exactly one payout created per completed payment |
| Invalid state transitions | Enum constraints on `status` fields + controller-level guards |
| Financial data type | All amounts stored as **Number (float)** in INR rupees — no paise conversion in DB layer |

---

## 7. Dev vs Production Database Config

| Setting | Development | Production |
|---|---|---|
| Engine | `mongodb-memory-server` (in-memory) | MongoDB Atlas M10+ cluster |
| dbPath | `D:\kamle-mongo-temp\db_{timestamp}` | Atlas manages storage |
| Geospatial support | ✅ Supported by MongoMemoryServer | ✅ Full Atlas support |
| Persistence | ❌ Wiped on each server restart | ✅ Persistent |
| Backups | ❌ None | ✅ Automated Atlas backups |
| Connection string | Set by `connectDB()` auto-detect | `MONGODB_URI` env var |
| Seed data | Auto-seeds on empty DB | Manual seeding / migrations |

