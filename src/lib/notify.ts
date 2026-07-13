import "server-only";
import { sendMail } from "./mailer";
import { sendPushByEmail } from "./push";

/**
 * Notify a person by email AND Web Push (if they've enabled notifications).
 * Thin wrapper so call sites stay declarative; in dev (no SMTP/VAPID) email is
 * logged and push is skipped. Never throws — a failed notification must not roll
 * back a completed business action.
 */
export async function notify(
  to: string | null | undefined,
  subject: string,
  body: string,
  url?: string
): Promise<void> {
  if (!to) return;
  try {
    await sendMail(to, `MADRE · ${subject}`, `${body}\n\n— Corte de Manga`);
  } catch (err) {
    console.error("[notify] email failed", subject, err);
  }
  try {
    await sendPushByEmail(to, { title: subject, body, url });
  } catch (err) {
    console.error("[notify] push failed", subject, err);
  }
}
