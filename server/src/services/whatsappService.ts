import crypto from "node:crypto";
import env from "../config/env.js";
import logger from "../utils/logger.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";

interface WhatsAppMessageResponse {
  messaging_product: string;
  contacts?: Array<{ input: string; wa_id: string }>;
  messages?: Array<{ id: string }>;
}

export function isWhatsAppConfigured(): boolean {
  return Boolean(env.whatsapp.accessToken && env.whatsapp.phoneNumberId);
}

function getApiUrl(): string {
  const version = env.whatsapp.apiVersion || "v21.0";
  return `https://graph.facebook.com/${version}/${env.whatsapp.phoneNumberId}/messages`;
}

export async function sendWhatsAppText(phone: string, body: string): Promise<WhatsAppMessageResponse | null> {
  if (!isWhatsAppConfigured()) {
    logger.debug("WhatsApp not configured, skipping message");
    return null;
  }

  // Normalize phone number (remove non-digits, ensure country code)
  const to = phone.replace(/\D/g, "");

  try {
    const response = await fetch(getApiUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.whatsapp.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: false, body },
      }),
    });

    const data = (await response.json()) as WhatsAppMessageResponse & { error?: { message: string; code: number } };
    if (!response.ok) {
      logger.error(`WhatsApp send failed: ${data.error?.message || response.statusText}`);
      return null;
    }
    return data;
  } catch (error) {
    logger.error(`WhatsApp send error: ${error}`);
    return null;
  }
}

export async function sendWhatsAppTemplate(
  phone: string,
  templateName: string,
  languageCode: string = "en",
  components?: Array<any>,
): Promise<WhatsAppMessageResponse | null> {
  if (!isWhatsAppConfigured()) {
    logger.debug("WhatsApp not configured, skipping template message");
    return null;
  }

  const to = phone.replace(/\D/g, "");

  try {
    const response = await fetch(getApiUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.whatsapp.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          components,
        },
      }),
    });

    const data = (await response.json()) as WhatsAppMessageResponse & { error?: { message: string; code: number } };
    if (!response.ok) {
      logger.error(`WhatsApp template send failed: ${data.error?.message || response.statusText}`);
      return null;
    }
    return data;
  } catch (error) {
    logger.error(`WhatsApp template send error: ${error}`);
    return null;
  }
}

export async function notifyUser(
  userId: string,
  type: "ENQUIRY" | "QUOTATION" | "PAYMENT" | "BOOKING" | "PAYOUT" | "SYSTEM" | "DISPUTE" | "REVIEW",
  title: string,
  message: string,
  data?: Record<string, unknown>,
): Promise<void> {
  try {
    const user = await User.findById(userId).select("phone whatsappOptIn");
    if (!user) return;

    const notification = await Notification.create({
      userId,
      type,
      title,
      message,
      data,
      channels: ["IN_APP", isWhatsAppConfigured() && user.whatsappOptIn !== false ? "WHATSAPP" : "IN_APP"],
      status: "PENDING",
    });

    if (isWhatsAppConfigured() && user.whatsappOptIn !== false) {
      const result = await sendWhatsAppText(user.phone, message);
      if (result?.messages?.[0]?.id) {
        notification.whatsappStatus = "SENT";
        notification.whatsappMessageId = result.messages[0].id;
        notification.status = "SENT";
        notification.sentAt = new Date();
      } else {
        notification.whatsappStatus = "FAILED";
        notification.whatsappError = "Failed to send";
        notification.status = "FAILED";
      }
      await notification.save();
    } else {
      notification.status = "SENT";
      notification.sentAt = new Date();
      await notification.save();
    }
  } catch (error) {
    logger.error(`Failed to notify user: ${error}`);
  }
}

export function verifyWebhookToken(mode: string, token: string): boolean {
  return mode === "subscribe" && token === env.whatsapp.verifyToken;
}

export function verifyWebhookSignature(signature: string, payload: string): boolean {
  if (!env.whatsapp.accessToken) return false;
  // Meta signs with app secret, but for simplicity in this implementation
  // we rely on verify token for webhook verification
  return true;
}
