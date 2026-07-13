import { prisma } from "./db";

type AuditInput = {
  actorId?: string | null;
  actorEmail?: string | null;
  localId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  detail?: unknown;
  ip?: string | null;
};

/**
 * Append a row to the immutable activity log (spec §2.3).
 * Never throws into the caller's flow — a failed audit write must not roll back
 * a completed business action, but it is logged to the server console.
 */
export async function audit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        actorEmail: input.actorEmail ?? null,
        localId: input.localId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        detail: (input.detail ?? undefined) as never,
        ip: input.ip ?? null,
      },
    });
  } catch (err) {
    console.error("[audit] failed to write audit log", input.action, err);
  }
}
