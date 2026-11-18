import { logAudit } from "@/lib/audit";

export type NotificationChannel = "sms" | "whatsapp";

export type NotificationPayload = {
  to: string;
  message: string;
  channel: NotificationChannel;
  template?: string;
  meta?: Record<string, unknown>;
};

export type NotificationConfig = {
  provider: string;
  apiKey: string;
  senderId: string;
  whatsappFrom: string;
  configured: boolean;
  missing: string[];
};

export function getNotificationConfig(): NotificationConfig {
  const provider = (process.env.NOTIFY_PROVIDER || "").trim();
  const apiKey = (process.env.NOTIFY_API_KEY || "").trim();
  const senderId = (process.env.NOTIFY_SENDER_ID || process.env.NOTIFY_SMS_FROM || "").trim();
  const whatsappFrom = (process.env.NOTIFY_WHATSAPP_FROM || "").trim();

  const missing: string[] = [];
  if (!provider) missing.push("NOTIFY_PROVIDER");
  if (!apiKey) missing.push("NOTIFY_API_KEY");
  if (!senderId && !whatsappFrom) missing.push("NOTIFY_SENDER_ID/NOTIFY_SMS_FROM or NOTIFY_WHATSAPP_FROM");

  return {
    provider,
    apiKey,
    senderId,
    whatsappFrom,
    configured: missing.length === 0,
    missing,
  };
}

export function isNotificationsConfigured() {
  return getNotificationConfig().configured;
}

export async function sendNotification(payload: NotificationPayload) {
  const cfg = getNotificationConfig();

  if (!cfg.configured) {
    await logAudit({
      action: "NOTIFICATION_SKIPPED",
      entityType: "Notification",
      entityId: payload.channel,
      details: JSON.stringify({
        channel: payload.channel,
        to: payload.to,
        reason: "NOT_CONFIGURED",
        missing: cfg.missing,
        template: payload.template || null,
      }),
    }).catch(() => {});
    return { ok: false as const, skipped: true as const, reason: "NOT_CONFIGURED", missing: cfg.missing };
  }

  // Provider-specific sending will be implemented once provider choice and credentials are provided.
  // Supported config keys (proposed): NOTIFY_PROVIDER, NOTIFY_API_KEY, NOTIFY_SENDER_ID/NOTIFY_SMS_FROM, NOTIFY_WHATSAPP_FROM
  await logAudit({
    action: "NOTIFICATION_PENDING_PROVIDER_IMPL",
    entityType: "Notification",
    entityId: payload.channel,
    details: JSON.stringify({
      channel: payload.channel,
      to: payload.to,
      provider: cfg.provider,
      template: payload.template || null,
      reason: "PROVIDER_IMPLEMENTATION_PENDING",
    }),
  }).catch(() => {});
  return { ok: false as const, skipped: true as const, reason: "PROVIDER_IMPLEMENTATION_PENDING" };
}
