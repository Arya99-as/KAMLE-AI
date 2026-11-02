import crypto from "node:crypto";
import env from "../config/env.js";
import logger from "../utils/logger.js";
import ApiError from "../utils/ApiError.js";

export interface RouteLinkedAccountInput {
  email: string;
  phone: string;
  name: string;
  accountHolderName: string;
  accountNumber: string;
  ifsc: string;
  city?: string;
  category?: string;
}

export interface RouteTransferResult {
  transferId: string;
  linkedAccountId: string;
  amount: number;
  status: "created" | "pending" | "processed" | "failed";
  raw?: Record<string, unknown>;
}

export interface RazorpayRefundResult {
  refundId: string;
  paymentId: string;
  amount: number;
  status: "processed" | "pending" | "failed";
  raw?: Record<string, unknown>;
}

function getRazorpayAuthHeader(): string {
  if (!env.payments.keyId || !env.payments.keySecret) {
    throw new ApiError(500, "Razorpay API credentials are not configured", "PAYMENT_CONFIG_ERROR");
  }
  return `Basic ${Buffer.from(`${env.payments.keyId}:${env.payments.keySecret}`).toString("base64")}`;
}

export function isRouteConfigured(): boolean {
  return env.payments.provider === "razorpay" && Boolean(env.payments.keyId && env.payments.keySecret);
}

/**
 * Creates or updates a Razorpay Route linked account for a service professional.
 * Uses Razorpay Accounts API: POST https://api.razorpay.com/v1/accounts
 */
export async function createRouteLinkedAccount(input: RouteLinkedAccountInput): Promise<{ linkedAccountId: string; status: string }> {
  if (env.payments.provider !== "razorpay") {
    // In simulated/mock mode: Return simulated account
    const mockId = `acc_mock_${crypto.randomBytes(6).toString("hex")}`;
    logger.info(`[MOCK] Created simulated linked account ${mockId} for ${input.name}`);
    return { linkedAccountId: mockId, status: "activated" };
  }

  const auth = getRazorpayAuthHeader();
  const payload = {
    email: input.email || `${input.phone.replace(/\D/g, "")}@kamle.ai`,
    phone: input.phone.replace(/\D/g, "").slice(-10),
    type: "standard",
    legal_business_name: input.accountHolderName || input.name,
    business_type: "individual",
    contact_name: input.name,
    profile: {
      category: "services",
      subcategory: "home_services",
      addresses: {
        registered: {
          street1: "Marketplace Street",
          city: input.city || "Kolhapur",
          state: "Maharashtra",
          postal_code: "416001",
          country: "IN",
        },
      },
    },
  };

  const response = await fetch("https://api.razorpay.com/v1/accounts", {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as { id?: string; error?: { description?: string } };
  if (!response.ok || !data.id) {
    logger.warn(`Razorpay linked account creation returned: ${data.error?.description || response.statusText}`);
    throw new ApiError(
      502,
      data.error?.description || "Razorpay Route account could not be created. Ensure Route is activated on your Razorpay dashboard.",
      "RAZORPAY_ROUTE_ERROR",
    );
  }

  return { linkedAccountId: data.id, status: "created" };
}

/**
 * Creates an authorized split transfer from a captured payment to a worker's linked account.
 * Uses Razorpay Transfers API: POST https://api.razorpay.com/v1/payments/{payment_id}/transfers
 */
export async function createRouteTransfer(
  providerPaymentId: string,
  linkedAccountId: string,
  amountInPaise: number,
  notes: Record<string, string> = {},
): Promise<RouteTransferResult> {
  if (env.payments.provider !== "razorpay") {
    const mockTransferId = `trf_mock_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    logger.info(`[MOCK] Created simulated Route transfer ${mockTransferId} of ${amountInPaise} paise to ${linkedAccountId}`);
    return {
      transferId: mockTransferId,
      linkedAccountId,
      amount: amountInPaise / 100,
      status: "processed",
    };
  }

  const auth = getRazorpayAuthHeader();
  const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(providerPaymentId)}/transfers`, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      transfers: [
        {
          account: linkedAccountId,
          amount: amountInPaise,
          currency: "INR",
          notes,
        },
      ],
    }),
  });

  const data = (await response.json()) as {
    items?: Array<{ id: string; status: string; amount: number }>;
    error?: { description?: string };
  };

  if (!response.ok || !data.items || data.items.length === 0) {
    logger.error(`Razorpay Route transfer failed: ${data.error?.description || response.statusText}`);
    throw new ApiError(
      502,
      data.error?.description || "Razorpay Route transfer failed. Please verify linked account status.",
      "RAZORPAY_TRANSFER_ERROR",
    );
  }

  const item = data.items[0]!;
  return {
    transferId: item.id,
    linkedAccountId,
    amount: item.amount / 100,
    status: (item.status as any) || "processed",
    raw: data as Record<string, unknown>,
  };
}

/**
 * Fetches status of an existing transfer from Razorpay.
 */
export async function getRouteTransferStatus(transferId: string): Promise<{ status: string; amount: number }> {
  if (env.payments.provider !== "razorpay" || transferId.startsWith("trf_mock_")) {
    return { status: "processed", amount: 0 };
  }

  const auth = getRazorpayAuthHeader();
  const response = await fetch(`https://api.razorpay.com/v1/transfers/${encodeURIComponent(transferId)}`, {
    headers: { Authorization: auth },
  });

  if (!response.ok) {
    throw new ApiError(502, "Could not fetch transfer status from Razorpay", "RAZORPAY_API_ERROR");
  }

  const data = (await response.json()) as { status: string; amount: number };
  return { status: data.status, amount: data.amount / 100 };
}

/**
 * Reverses a previously processed transfer on refund.
 * Uses: POST https://api.razorpay.com/v1/transfers/{transfer_id}/reversals
 */
export async function reverseRouteTransfer(transferId: string, amountInPaise?: number): Promise<{ reversalId: string; status: string }> {
  if (env.payments.provider !== "razorpay" || transferId.startsWith("trf_mock_")) {
    const mockRevId = `rev_mock_${Date.now()}`;
    return { reversalId: mockRevId, status: "processed" };
  }

  const auth = getRazorpayAuthHeader();
  const response = await fetch(`https://api.razorpay.com/v1/transfers/${encodeURIComponent(transferId)}/reversals`, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(amountInPaise ? { amount: amountInPaise } : { reverse_all: 1 }),
  });

  const data = (await response.json()) as { id?: string; error?: { description?: string } };
  if (!response.ok || !data.id) {
    throw new ApiError(502, data.error?.description || "Could not reverse transfer on Razorpay Route", "RAZORPAY_REVERSAL_ERROR");
  }

  return { reversalId: data.id, status: "processed" };
}

/**
 * Executes a customer payment refund on Razorpay.
 * Uses: POST https://api.razorpay.com/v1/payments/{payment_id}/refund
 */
export async function executeRazorpayRefund(
  providerPaymentId: string,
  amountInPaise: number,
  notes: Record<string, string> = {},
): Promise<RazorpayRefundResult> {
  if (env.payments.provider !== "razorpay") {
    const mockRefundId = `rfnd_mock_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    logger.info(`[MOCK] Created simulated refund ${mockRefundId} of ${amountInPaise} paise for payment ${providerPaymentId}`);
    return {
      refundId: mockRefundId,
      paymentId: providerPaymentId,
      amount: amountInPaise / 100,
      status: "processed",
    };
  }

  const auth = getRazorpayAuthHeader();
  const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(providerPaymentId)}/refund`, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: amountInPaise,
      notes,
    }),
  });

  const data = (await response.json()) as { id?: string; status?: string; amount?: number; error?: { description?: string } };
  if (!response.ok || !data.id) {
    logger.error(`Razorpay refund API call failed: ${data.error?.description || response.statusText}`);
    throw new ApiError(502, data.error?.description || "Razorpay could not process the refund. Please check gateway balance.", "RAZORPAY_REFUND_ERROR");
  }

  return {
    refundId: data.id,
    paymentId: providerPaymentId,
    amount: (data.amount ?? amountInPaise) / 100,
    status: (data.status as any) || "processed",
    raw: data as Record<string, unknown>,
  };
}

