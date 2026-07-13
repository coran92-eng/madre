import "server-only";
import webpush from "web-push";
import { prisma } from "./db";

let configured: boolean | undefined;

function ensureConfigured(): boolean {
  if (configured !== undefined) return configured;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (pub && priv) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@madre.local", pub, priv);
    configured = true;
  } else {
    configured = false;
  }
  return configured;
}

/**
 * Send a Web Push to all of a user's subscribed devices. No-op if VAPID isn't
 * configured. Dead subscriptions (404/410) are pruned. Never throws.
 */
export async function sendPush(
  userId: string,
  payload: { title: string; body: string; url?: string }
): Promise<void> {
  if (!ensureConfigured()) return;
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return;

  const data = JSON.stringify({ title: payload.title, body: payload.body, url: payload.url ?? "/dashboard" });
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, data);
      } catch (err: unknown) {
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        } else {
          console.error("[push] send failed", code);
        }
      }
    })
  );
}

/** Push to a user identified by email (used by the notify() helper). */
export async function sendPushByEmail(email: string, payload: { title: string; body: string; url?: string }): Promise<void> {
  if (!ensureConfigured()) return;
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() }, select: { id: true } });
  if (user) await sendPush(user.id, payload);
}
