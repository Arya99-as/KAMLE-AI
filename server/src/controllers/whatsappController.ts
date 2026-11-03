import type { Request, Response } from "express";
import { verifyWebhookToken } from "../services/whatsappService.js";
import logger from "../utils/logger.js";
import Notification from "../models/Notification.js";

export function verifyWebhook(req: Request, res: Response) {
  const mode = req.query["hub.mode"] as string;
  const token = req.query["hub.verify_token"] as string;
  const challenge = req.query["hub.challenge"] as string;

  if (verifyWebhookToken(mode, token)) {
    logger.info("WhatsApp webhook verified");
    return res.status(200).send(challenge);
  }

  logger.warn("WhatsApp webhook verification failed");
  return res.status(403).send("Forbidden");
}

export async function handleWebhook(req: Request, res: Response) {
  // Acknowledge receipt immediately
  res.status(200).send("OK");

  try {
    const body = req.body;
    logger.debug(`WhatsApp webhook received: ${JSON.stringify(body)}`);

    if (body?.entry && Array.isArray(body.entry)) {
      for (const entry of body.entry) {
        for (const change of entry.changes || []) {
          const statuses = change.value?.statuses || [];
          for (const st of statuses) {
            const messageId = st.id;
            const rawStatus = (st.status || "").toLowerCase();
            if (messageId && rawStatus) {
              const statusMap: Record<string, "SENT" | "DELIVERED" | "READ" | "FAILED"> = {
                sent: "SENT",
                delivered: "DELIVERED",
                read: "READ",
                failed: "FAILED",
              };
              const mappedStatus = statusMap[rawStatus];
              if (mappedStatus) {
                await Notification.updateMany(
                  { whatsappMessageId: messageId },
                  {
                    $set: {
                      whatsappStatus: mappedStatus,
                      ...(mappedStatus === "READ" ? { readAt: new Date(), status: "READ" } : {}),
                      ...(mappedStatus === "DELIVERED" ? { status: "DELIVERED" } : {}),
                      ...(mappedStatus === "FAILED" ? { status: "FAILED", whatsappError: st.errors?.[0]?.message } : {}),
                    },
                  },
                ).catch((err) => logger.warn(`Failed to update notification status: ${err}`));
              }
            }
          }
        }
      }
    }
  } catch (error) {
    logger.error(`WhatsApp webhook processing error: ${error}`);
  }
}
