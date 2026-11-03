import type { Request, Response } from "express";
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { z } from "zod";
import User from "../models/User.js";
import WorkerProfile from "../models/WorkerProfile.js";
import Enquiry from "../models/Enquiry.js";
import Review from "../models/Review.js";
import Report from "../models/Report.js";
import AuditLog from "../models/AuditLog.js";
import ServiceCategory from "../models/ServiceCategory.js";
import Payment from "../models/Payment.js";
import Payout from "../models/Payout.js";
import Quotation from "../models/Quotation.js";
import PlatformConfig from "../models/PlatformConfig.js";
import ApiError from "../utils/ApiError.js";
import { buildPaginated, getPagination, slugify } from "../utils/pagination.js";
import { recordAudit } from "../services/auditService.js";
import { recomputeRating } from "../services/workerService.js";
import { checkAiProvider } from "../services/aiService.js";
import { uploadRoot } from "../middleware/upload.js";
import type { approvalSchema, accountStatusSchema, categorySchema, moderationSchema, reportStatusSchema } from "../validators/admin.js";

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type ApprovalInput = z.infer<typeof approvalSchema>;
type AccountInput = z.infer<typeof accountStatusSchema>;
type CategoryInput = z.infer<typeof categorySchema>;
type ModerationInput = z.infer<typeof moderationSchema>;
type ReportStatusInput = z.infer<typeof reportStatusSchema>;

export async function aiHealth(_req: Request, res: Response) {
  res.json({ health: await checkAiProvider() });
}

export async function dashboard(_req: Request, res: Response) {
  const [totalUsers, totalWorkers, totalCustomers, approvedWorkers, pendingApplications, rejectedWorkers, totalEnquiries, pendingRequests, inProgressRequests, completedRequests, disputedRequests, openReports, pendingReviews, totalReviews, totalCategories, paymentAgg, failedPayments, refundedPayments, pendingPayoutsAgg, paidPayoutsAgg] = await Promise.all([
    User.countDocuments({ accountStatus: { $ne: "deactivated" } }),
    User.countDocuments({ role: "worker" }),
    User.countDocuments({ role: "customer" }),
    WorkerProfile.countDocuments({ approvalStatus: "approved" }),
    WorkerProfile.countDocuments({ approvalStatus: "pending" }),
    WorkerProfile.countDocuments({ approvalStatus: "rejected" }),
    Enquiry.countDocuments({}),
    Enquiry.countDocuments({ status: { $in: ["PENDING", "sent"] } }),
    Enquiry.countDocuments({ status: { $in: ["ACCEPTED", "accepted", "IN_PROGRESS"] } }),
    Enquiry.countDocuments({ status: { $in: ["COMPLETED", "completed"] } }),
    Enquiry.countDocuments({ status: "DISPUTED" }),
    Report.countDocuments({ status: { $in: ["open", "reviewing"] } }),
    Review.countDocuments({ moderationStatus: "pending" }),
    Review.countDocuments({}),
    ServiceCategory.countDocuments({}),
    Payment.aggregate<{ _id: null; count: number; total: number; commission: number }>([
      { $match: { status: "COMPLETED" } },
      { $group: { _id: null, count: { $sum: 1 }, total: { $sum: "$amount" }, commission: { $sum: "$commissionAmount" } } },
    ]),
    Payment.countDocuments({ status: "FAILED" }),
    Payment.countDocuments({ status: "REFUNDED" }),
    Payout.aggregate<{ _id: null; total: number }>([
      { $match: { status: "PENDING" } },
      { $group: { _id: null, total: { $sum: "$workerPayableAmount" } } },
    ]),
    Payout.aggregate<{ _id: null; total: number }>([
      { $match: { status: "PAID" } },
      { $group: { _id: null, total: { $sum: "$workerPayableAmount" } } },
    ]),
  ]);

  const paymentAggDoc = paymentAgg?.[0];
  const pendingPayoutsAggDoc = pendingPayoutsAgg?.[0];
  const paidPayoutsAggDoc = paidPayoutsAgg?.[0];

  const paymentsReceived = paymentAggDoc?.count ?? 0;
  const totalVolume = paymentAggDoc?.total ?? 0;
  const totalCommission = paymentAggDoc?.commission ?? 0;
  const pendingPayoutsTotal = pendingPayoutsAggDoc?.total ?? 0;
  const totalPayoutsPaid = paidPayoutsAggDoc?.total ?? 0;

  res.json({
    stats: {
      totalUsers,
      totalWorkers,
      totalCustomers,
      approvedWorkers,
      pendingApplications,
      rejectedWorkers,
      totalEnquiries,
      pendingRequests,
      inProgressRequests,
      completedRequests,
      disputedRequests,
      openReports,
      pendingReviews,
      totalReviews,
      totalCategories,
      paymentsReceived,
      failedPayments,
      refundedPayments,
      totalVolume,
      totalCommission,
      pendingPayoutsTotal,
      totalPayoutsPaid,
    },
  });
}

export async function listPendingWorkers(req: Request, res: Response) {
  const page = getPagination(req.query as Record<string, unknown>, 20);
  const filter: Record<string, unknown> = {};

  if (req.query.status) {
    filter.approvalStatus = req.query.status;
  } else {
    filter.approvalStatus = "pending";
  }

  const [items, total] = await Promise.all([
    WorkerProfile.find(filter)
      .sort({ updatedAt: -1 })
      .skip(page.skip)
      .limit(page.limit)
      .populate("userId", "name phone email location accountStatus")
      .lean()
      .exec(),
    WorkerProfile.countDocuments(filter),
  ]);

  res.json(buildPaginated(items, total, page));
}

export async function reviewWorkerApplication(req: Request<{ id: string }, unknown, ApprovalInput>, res: Response) {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.badRequest("Invalid profile id");

  const profile = await WorkerProfile.findById(req.params.id);
  if (!profile) throw ApiError.notFound("Worker profile not found");

  const { decision, reason } = req.body;
  const prev = profile.approvalStatus;

  profile.approvalStatus = decision;
  profile.verificationStatus = decision === "approved" ? "verified" : decision === "rejected" ? "rejected" : "pending";
  if (decision === "rejected" && reason) {
    profile.rejectionReason = reason;
  } else if (decision === "approved") {
    profile.rejectionReason = undefined;
  }

  await profile.save();

  await recordAudit({
    adminId: req.user!.id,
    action: "worker." + decision,
    targetType: "WorkerProfile",
    targetId: String(profile._id),
    metadata: { from: prev, to: decision, reason },
  });

  res.json({ profile, workerProfile: profile, message: "Worker profile successfully " + decision });
}

export async function listUsers(req: Request, res: Response) {
  const page = getPagination(req.query as Record<string, unknown>, 20);
  const filter: Record<string, unknown> = {};

  if (req.query.role) filter.role = req.query.role;
  if (req.query.status) filter.accountStatus = req.query.status;
  if (req.query.q) {
    const q = String(req.query.q).trim();
    if (q) {
      const escaped = escapeRegex(q);
      filter.$or = [
        { name: { $regex: escaped, $options: "i" } },
        { phone: { $regex: escaped, $options: "i" } },
        { email: { $regex: escaped, $options: "i" } },
      ];
    }
  }

  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(page.skip).limit(page.limit).lean().exec(),
    User.countDocuments(filter),
  ]);

  res.json(buildPaginated(items, total, page));
}

export async function updateUserAccountStatus(req: Request<{ id: string }, unknown, AccountInput>, res: Response) {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.badRequest("Invalid user id");
  if (req.params.id === req.user!.id) throw ApiError.badRequest("You cannot modify your own admin account status");

  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound("User not found");

  const { accountStatus, reason } = req.body;
  const prev = user.accountStatus;
  user.accountStatus = accountStatus;
  await user.save();

  await recordAudit({
    adminId: req.user!.id,
    action: "user.status." + accountStatus,
    targetType: "User",
    targetId: String(user._id),
    metadata: { from: prev, to: accountStatus, reason },
  });

  res.json({ user, message: "User status updated to " + accountStatus });
}

export async function listAllEnquiries(req: Request, res: Response) {
  const page = getPagination(req.query as Record<string, unknown>, 30);
  const filter: Record<string, unknown> = {};

  if (req.query.status) {
    filter.status = req.query.status;
  }

  const [items, total] = await Promise.all([
    Enquiry.find(filter)
      .sort({ createdAt: -1 })
      .skip(page.skip)
      .limit(page.limit)
      .populate("customerId", "name phone email")
      .populate("workerId", "name phone email")
      .lean()
      .exec(),
    Enquiry.countDocuments(filter),
  ]);

  res.json(buildPaginated(items, total, page));
}

export async function resolveDispute(req: Request<{ id: string }>, res: Response) {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.badRequest("Invalid enquiry id");

  const enquiry = await Enquiry.findById(req.params.id);
  if (!enquiry) throw ApiError.notFound("Enquiry not found");

  if (enquiry.status !== "DISPUTED") {
    throw ApiError.badRequest("Only disputed enquiries can be resolved by the admin");
  }

  const resolution = req.body.resolution || "COMPLETED";
  const note = req.body.note || "Dispute resolved by platform admin";

  // A DISPUTED job may have originated from IN_PROGRESS (never counted) or from
  // COMPLETED (already counted). Inspect history so resolving to COMPLETED
  // increments the worker's completed-job counter exactly once.
  const alreadyCounted = enquiry.statusHistory.some((h) => String(h.status).toUpperCase() === "COMPLETED");

  enquiry.status = resolution === "CANCELLED" ? "CANCELLED" : "COMPLETED";
  enquiry.disputeResolvedAt = new Date();
  enquiry.statusHistory.push({
    status: enquiry.status,
    at: new Date(),
    by: new mongoose.Types.ObjectId(req.user!.id),
    note,
  });

  await enquiry.save();

  if (enquiry.status === "COMPLETED" && !alreadyCounted) {
    await WorkerProfile.updateOne({ userId: enquiry.workerId }, { $inc: { completedEnquiries: 1 } });
  }

  await recordAudit({
    adminId: req.user!.id,
    action: "enquiry.dispute.resolve",
    targetType: "Enquiry",
    targetId: String(enquiry._id),
    metadata: { resolution: enquiry.status, note },
  });

  res.json({ success: true, enquiry, message: "Dispute resolved" });
}

export async function listPayments(req: Request, res: Response) {
  const page = getPagination(req.query as Record<string, unknown>, 30);
  const filter: Record<string, unknown> = {};
  if (req.query.status) filter.status = req.query.status;

  const [items, total] = await Promise.all([
    Payment.find(filter)
      .sort({ createdAt: -1 })
      .skip(page.skip)
      .limit(page.limit)
      .populate("customerId", "name phone")
      .populate("workerId", "name phone")
      .populate("enquiryId", "serviceCategory")
      .lean()
      .exec(),
    Payment.countDocuments(filter),
  ]);

  res.json(buildPaginated(items, total, page));
}

/** Full verified payment record plus consistency checks for admin reconciliation. */
export async function getPaymentDetail(req: Request<{ id: string }>, res: Response) {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.badRequest("Invalid payment id");

  const payment = await Payment.findById(req.params.id)
    .populate("customerId", "name phone email")
    .populate("workerId", "name phone email")
    .populate("enquiryId", "serviceCategory problemDescription status paymentStatus serviceAmount")
    .populate("quotationId")
    .lean()
    .exec();
  if (!payment) throw ApiError.notFound("Payment record not found");

  const payout = await Payout.findOne({ paymentId: payment._id }).lean().exec();
  const quotation = (payment as unknown as { quotationId?: { approvedAmount?: number; total?: number; status?: string } }).quotationId;

  const expectedCommission = Math.round((payment.amount * payment.commissionPercent) / 100);
  const checks = [
    {
      key: "commission_amount",
      ok: expectedCommission === payment.commissionAmount,
      detail: `Expected ₹${expectedCommission} at ${payment.commissionPercent}%, recorded ₹${payment.commissionAmount}`,
    },
    {
      key: "worker_payable",
      ok: payment.amount - payment.commissionAmount === payment.workerPayableAmount,
      detail: `Expected ₹${payment.amount - payment.commissionAmount}, recorded ₹${payment.workerPayableAmount}`,
    },
    {
      key: "payout_record",
      ok: payment.status !== "COMPLETED" || Boolean(payout),
      detail: payout ? `Payout ${payout.status}` : "No payout record for a completed payment",
    },
    {
      key: "quotation_amount",
      ok: !quotation || quotation.approvedAmount === undefined || quotation.approvedAmount === payment.amount,
      detail: quotation ? `Quotation approved ₹${quotation.approvedAmount ?? quotation.total}, payment ₹${payment.amount}` : "Legacy payment without a quotation",
    },
  ];

  res.json({ success: true, payment, payout: payout ?? null, checks });
}

/**
 * Reconciles a payment without ever inventing provider evidence:
 * - sync: repairs derived records (enquiry payment flag, missing payout voucher)
 * - request_refund: flags a verified payment for refund processing
 * - mark_refunded: records a refund that was actually processed out-of-band
 */
export async function reconcilePayment(req: Request<{ id: string }>, res: Response) {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.badRequest("Invalid payment id");

  const payment = await Payment.findById(req.params.id);
  if (!payment) throw ApiError.notFound("Payment record not found");

  const { action, note } = req.body as { action: "sync" | "request_refund" | "mark_refunded"; note?: string };
  const rationale = (note ?? "").trim();

  if (action === "request_refund") {
    if (payment.status !== "COMPLETED") {
      throw ApiError.badRequest("Only a verified completed payment can be flagged for refund");
    }
    payment.status = "REFUND_REQUESTED";
    payment.metadata = { ...(payment.metadata ?? {}), refundRequestedAt: new Date().toISOString(), refundNote: rationale };
    await payment.save();

    await recordAudit({
      adminId: req.user!.id,
      action: "payment.refund.request",
      targetType: "Payment",
      targetId: String(payment._id),
      metadata: { transactionRef: payment.transactionRef, amount: payment.amount, note: rationale },
    });
  } else if (action === "mark_refunded") {
    if (!["COMPLETED", "REFUND_REQUESTED"].includes(payment.status)) {
      throw ApiError.badRequest("Only a completed or refund-requested payment can be marked refunded");
    }
    payment.status = "REFUNDED";
    payment.refundStatus = "FULL";
    payment.refundedAmount = payment.amount;
    payment.metadata = { ...(payment.metadata ?? {}), refundedAt: new Date().toISOString(), refundNote: rationale };
    await payment.save();

    await Enquiry.updateOne({ _id: payment.enquiryId }, { $set: { paymentStatus: "REFUNDED" } });
    await Payout.updateOne(
      { paymentId: payment._id },
      { $set: { status: "FAILED", failureReason: "Payment refunded", note: rationale } },
    );

    await recordAudit({
      adminId: req.user!.id,
      action: "payment.refund.complete",
      targetType: "Payment",
      targetId: String(payment._id),
      metadata: { transactionRef: payment.transactionRef, amount: payment.amount, note: rationale },
    });
  } else {
    // sync: repair derived state that drifted, never change verified money fields.
    if (payment.status === "COMPLETED") {
      await Enquiry.updateOne({ _id: payment.enquiryId }, { $set: { paymentStatus: "PAID" } });
      await Payout.findOneAndUpdate(
        { paymentId: payment._id },
        {
          $setOnInsert: {
            workerId: payment.workerId,
            enquiryId: payment.enquiryId,
            paymentId: payment._id,
            serviceAmount: payment.amount,
            commissionAmount: payment.commissionAmount,
            workerPayableAmount: payment.workerPayableAmount,
            status: "PENDING",
            providerPayoutRef: "",
          },
        },
        { upsert: true, new: true },
      );
    } else if (payment.status === "REFUNDED") {
      await Enquiry.updateOne({ _id: payment.enquiryId }, { $set: { paymentStatus: "REFUNDED" } });
      await Payout.updateOne({ paymentId: payment._id }, { $set: { status: "FAILED", failureReason: "Payment refunded" } });
    }

    await recordAudit({
      adminId: req.user!.id,
      action: "payment.reconcile.sync",
      targetType: "Payment",
      targetId: String(payment._id),
      metadata: { status: payment.status, note: rationale },
    });
  }

  const refreshed = await Payment.findById(payment._id).lean().exec();
  res.json({ success: true, payment: refreshed, message: "Payment reconciliation updated" });
}

export async function listPayouts(req: Request, res: Response) {
  const page = getPagination(req.query as Record<string, unknown>, 30);
  const filter: Record<string, unknown> = {};
  if (req.query.status) filter.status = req.query.status;

  const [items, total] = await Promise.all([
    Payout.find(filter)
      .sort({ createdAt: -1 })
      .skip(page.skip)
      .limit(page.limit)
      .populate("workerId", "name phone")
      .populate("paymentId", "transactionRef amount")
      .lean()
      .exec(),
    Payout.countDocuments(filter),
  ]);

  res.json(buildPaginated(items, total, page));
}

export async function updatePayoutStatus(req: Request<{ id: string }>, res: Response) {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.badRequest("Invalid payout id");

  const { status, providerPayoutRef, note } = req.body;
  if (!["PENDING", "PROCESSING", "PAID", "FAILED"].includes(status)) {
    throw ApiError.badRequest("Invalid payout status");
  }

  if (status === "PAID" && !String(providerPayoutRef ?? "").trim()) {
    throw ApiError.badRequest("A provider payout reference is required to mark a payout as PAID");
  }

  const update: Record<string, unknown> = { status };
  if (providerPayoutRef) update.providerPayoutRef = String(providerPayoutRef).trim();
  if (note) update.note = note;
  if (status === "PAID") update.paidAt = new Date();

  const payout = await Payout.findOneAndUpdate({ _id: req.params.id, status: { $ne: "PAID" } }, { $set: update }, { new: true });
  if (!payout) {
    const existing = await Payout.findById(req.params.id).lean();
    if (!existing) throw ApiError.notFound("Payout record not found");
    if (existing.status === "PAID") {
      throw ApiError.conflict("This payout has already been marked as PAID and cannot be changed");
    }
    throw ApiError.conflict("Payout status could not be updated due to a concurrent change");
  }

  await recordAudit({
    adminId: req.user!.id,
    action: "payout." + status,
    targetType: "Payout",
    targetId: String(payout._id),
    metadata: { status, providerPayoutRef, note },
  });

  res.json({ success: true, payout, message: "Payout status updated to " + status });
}

export async function getPlatformConfig(_req: Request, res: Response) {
  let config = await PlatformConfig.findOne({ key: "global" }).exec();
  if (!config) {
    config = await PlatformConfig.create({
      key: "global",
      commissionPercent: 10,
      payoutTerms: "Standard marketplace payout after job completion verification.",
    });
  }
  res.json({ success: true, config });
}

export async function updatePlatformConfig(req: Request, res: Response) {
  const { commissionPercent, payoutTerms } = req.body;

  let config = await PlatformConfig.findOne({ key: "global" });
  if (!config) {
    config = new PlatformConfig({ key: "global" });
  }

  if (commissionPercent !== undefined) {
    const num = Number(commissionPercent);
    if (isNaN(num) || num < 0 || num > 100) {
      throw ApiError.badRequest("Commission percent must be between 0 and 100");
    }
    config.commissionPercent = num;
  }

  if (payoutTerms) config.payoutTerms = payoutTerms;
  config.updatedBy = new mongoose.Types.ObjectId(req.user!.id);
  await config.save();

  await recordAudit({
    adminId: req.user!.id,
    action: "platform.config.update",
    targetType: "PlatformConfig",
    targetId: String(config._id),
    metadata: { commissionPercent: config.commissionPercent, payoutTerms: config.payoutTerms },
  });

  res.json({ success: true, config, message: "Platform configuration updated" });
}

export async function listReviews(req: Request, res: Response) {
  const page = getPagination(req.query as Record<string, unknown>, 20);
  const filter: Record<string, unknown> = {};
  if (req.query.status) filter.moderationStatus = req.query.status;

  const [items, total] = await Promise.all([
    Review.find(filter)
      .sort({ createdAt: -1 })
      .skip(page.skip)
      .limit(page.limit)
      .populate("customerId", "name")
      .populate("workerId", "name")
      .lean()
      .exec(),
    Review.countDocuments(filter),
  ]);

  res.json(buildPaginated(items, total, page));
}

export async function moderateReview(req: Request<{ id: string }, unknown, ModerationInput>, res: Response) {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.badRequest("Invalid review id");

  const review = await Review.findById(req.params.id);
  if (!review) throw ApiError.notFound("Review not found");

  const { moderationStatus } = req.body;
  review.moderationStatus = moderationStatus;
  await review.save();
  await recomputeRating(String(review.workerId));

  await recordAudit({
    adminId: req.user!.id,
    action: "review.moderate." + moderationStatus,
    targetType: "Review",
    targetId: String(review._id),
    metadata: { workerId: String(review.workerId), moderationStatus },
  });

  res.json({ review, message: "Review " + moderationStatus });
}

export async function listReports(req: Request, res: Response) {
  const page = getPagination(req.query as Record<string, unknown>, 20);
  const filter: Record<string, unknown> = {};
  if (req.query.status) filter.status = req.query.status;

  const [items, total] = await Promise.all([
    Report.find(filter)
      .sort({ createdAt: -1 })
      .skip(page.skip)
      .limit(page.limit)
      .populate("reporterId", "name")
      .populate("reportedUserId", "name role")
      .lean()
      .exec(),
    Report.countDocuments(filter),
  ]);

  res.json(buildPaginated(items, total, page));
}

export async function updateReportStatus(req: Request<{ id: string }, unknown, ReportStatusInput>, res: Response) {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.badRequest("Invalid report id");

  const report = await Report.findById(req.params.id);
  if (!report) throw ApiError.notFound("Report not found");

  const previous = report.status;
  report.status = req.body.status;
  await report.save();

  await recordAudit({
    adminId: req.user!.id,
    action: "report.status." + report.status,
    targetType: "Report",
    targetId: String(report._id),
    metadata: { from: previous, to: report.status },
  });

  res.json({ report });
}

export async function listCategories(_req: Request, res: Response) {
  const categories = await ServiceCategory.find().sort({ sortOrder: 1, name: 1 }).lean().exec();
  res.json({ categories });
}

export async function createCategory(req: Request<unknown, unknown, CategoryInput>, res: Response) {
  const slug = slugify(req.body.slug || req.body.name);
  if (!slug) throw ApiError.badRequest("Category name must contain letters or numbers");
  const existing = await ServiceCategory.findOne({ slug });
  if (existing) throw ApiError.conflict("A category with this name already exists");

  const category = await ServiceCategory.create({
    name: req.body.name,
    slug,
    icon: req.body.icon ?? "wrench",
    description: req.body.description ?? "",
    keywords: req.body.keywords ?? [],
    isActive: req.body.isActive ?? true,
    sortOrder: req.body.sortOrder ?? 0,
  });

  await recordAudit({
    adminId: req.user!.id,
    action: "category.create",
    targetType: "ServiceCategory",
    targetId: String(category._id),
    metadata: { name: category.name, slug: category.slug },
  });

  res.status(201).json({ category });
}

export async function updateCategory(req: Request<{ id: string }, unknown, Partial<CategoryInput>>, res: Response) {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.badRequest("Invalid category id");

  const category = await ServiceCategory.findById(req.params.id);
  if (!category) throw ApiError.notFound("Category not found");

  if (req.body.name) {
    category.name = req.body.name;
    category.slug = slugify(req.body.name);
  }
  if (req.body.slug) {
    const requestedSlug = slugify(req.body.slug);
    if (!requestedSlug) throw ApiError.badRequest("Category slug must contain letters or numbers");
    category.slug = requestedSlug;
  }
  if (req.body.icon) category.icon = req.body.icon;
  if (req.body.description !== undefined) category.description = req.body.description;
  if (req.body.keywords) category.keywords = req.body.keywords;
  if (req.body.isActive !== undefined) category.isActive = req.body.isActive;
  if (req.body.sortOrder !== undefined) category.sortOrder = req.body.sortOrder;

  // Slugs are used for filtering and must stay unique across categories.
  const clash = await ServiceCategory.findOne({ slug: category.slug, _id: { $ne: category._id } });
  if (clash) throw ApiError.conflict("Another category already uses this name/slug");

  await category.save();

  await recordAudit({
    adminId: req.user!.id,
    action: "category.update",
    targetType: "ServiceCategory",
    targetId: String(category._id),
    metadata: {
      name: category.name,
      slug: category.slug,
      isActive: category.isActive,
    },
  });

  res.json({ category });
}

/** Read-only administrative audit trail (most recent first). */
export async function listAuditLogs(req: Request, res: Response) {
  const page = getPagination(req.query as Record<string, unknown>, 50);
  const filter: Record<string, unknown> = {};

  if (req.query.action) {
    filter.action = { $regex: escapeRegex(String(req.query.action)), $options: "i" };
  }
  if (req.query.targetType) filter.targetType = req.query.targetType;
  if (req.query.adminId && mongoose.isValidObjectId(String(req.query.adminId))) {
    filter.adminId = req.query.adminId;
  }

  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(page.skip)
      .limit(page.limit)
      .populate("adminId", "name email role")
      .lean()
      .exec(),
    AuditLog.countDocuments(filter),
  ]);

  res.json(buildPaginated(items, total, page));
}

/**
 * Streams a single worker verification document to an authenticated admin.
 * Verification documents are never publicly served; the stored URL is used
 * only to resolve a basename inside uploadRoot/documents.
 */
export async function getWorkerDocument(req: Request<{ id: string; index: string }>, res: Response) {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.badRequest("Invalid profile id");
  const index = Number(req.params.index);
  if (!Number.isInteger(index) || index < 0) throw ApiError.badRequest("Invalid document index");

  const profile = await WorkerProfile.findById(req.params.id).lean().exec();
  if (!profile) throw ApiError.notFound("Worker profile not found");

  const document = profile.verificationDocuments?.[index];
  if (!document) throw ApiError.notFound("Verification document not found");

  const prefix = "/uploads/documents/";
  const stored = String(document.url ?? "");
  if (!stored.startsWith(prefix)) throw ApiError.notFound("Verification document not found");

  // basename() prevents path traversal even if a malformed url was persisted.
  const filename = path.basename(stored);
  const documentsDir = path.join(uploadRoot, "documents");
  const absolute = path.join(documentsDir, filename);
  if (!absolute.startsWith(documentsDir) || !fs.existsSync(absolute)) {
    throw ApiError.notFound("Verification document file is missing");
  }

  await recordAudit({
    adminId: req.user!.id,
    action: "worker.document.view",
    targetType: "WorkerProfile",
    targetId: String(profile._id),
    metadata: { index, filename },
  });

  res.setHeader("Cache-Control", "private, no-store");
  res.sendFile(absolute);
}
