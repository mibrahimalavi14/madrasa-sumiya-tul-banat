import { prisma } from "@/lib/prisma";

export async function logAudit(input: {
  actorUserId?: string | null;
  actorLabel?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  details?: string | null;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: input.actorUserId || null,
        actorLabel: input.actorLabel || null,
        action: input.action,
        entityType: input.entityType || null,
        entityId: input.entityId || null,
        details: input.details || null,
      },
    });
  } catch {
    // Audit logging must never break core flows
  }
}
