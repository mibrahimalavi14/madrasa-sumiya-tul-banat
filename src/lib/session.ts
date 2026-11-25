import { cache } from "react";
import { cookies } from "next/headers";
import { revalidateTag, unstable_cache } from "next/cache";
import prisma from "./prisma";

export const VIEW_SESSION_COOKIE = "msb_view_session";

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function isSessionExpiredByDate(session: { status: string; endDate?: Date | null }) {
  return session.status === "ACTIVE" && !!session.endDate && Date.now() > endOfDay(new Date(session.endDate)).getTime();
}

export async function autoExpireSessionsIfNeeded(options?: { revalidate?: boolean }) {
  const now = new Date();
  // Expire ACTIVE sessions whose end date has passed
  const active = await prisma.session.findMany({ where: { status: "ACTIVE", endDate: { not: null } }, select: { id: true, endDate: true, isCurrent: true } });
  const toExpire = active.filter(s => s.endDate && now.getTime() > endOfDay(new Date(s.endDate)).getTime());
  if (!toExpire.length) return 0;
  await prisma.session.updateMany({ where: { id: { in: toExpire.map(s => s.id) } }, data: { status: "EXPIRED", isCurrent: false } });
  if (options?.revalidate) revalidateTag("current-session", { expire: 0 });
  return toExpire.length;
}

const getCurrentSessionCached = unstable_cache(
  async () => prisma.session.findFirst({ where: { isCurrent: true } }),
  ["current-session"],
  { tags: ["current-session"], revalidate: 30 }
);

export const getCurrentSession = cache(async () => {
  try {
    const jar = await cookies();
    const viewId = jar.get(VIEW_SESSION_COOKIE)?.value;
    if (viewId) {
      const view = await prisma.session.findUnique({ where: { id: viewId } });
      if (view) return view as any;
    }
  } catch {
    // cookies() may be unavailable in some contexts; fall back to system current session
  }

  const s = await getCurrentSessionCached();
  if (s && isSessionExpiredByDate(s)) {
    // Avoid write on read path for speed; mutations/pages run autoExpireSessionsIfNeeded() to persist.
    return { ...s, status: "EXPIRED", isCurrent: false } as any;
  }
  return s;
});

export async function requireCurrentSession() {
  const s = await getCurrentSession();
  if (!s) throw new Error("NO_SESSION");
  if (s.status !== "ACTIVE") throw new Error("SESSION_NOT_ACTIVE");
  return s;
}

export function hasSessionStarted(session: { startDate?: Date | null } | null | undefined) {
  if (!session?.startDate) return true;
  const start = new Date(session.startDate);
  start.setHours(0, 0, 0, 0);
  return new Date() >= start;
}

export async function requireActiveSessionForMutation() {
  const s = await getCurrentSession();
  if (!s) throw new Error("NO_SESSION");
  if (s.status !== "ACTIVE") throw new Error("SESSION_NOT_ACTIVE");
  return s;
}

export async function requireStartedSessionForMutation() {
  const s = await requireActiveSessionForMutation();
  if (!hasSessionStarted(s)) throw new Error("SESSION_NOT_STARTED");
  return s;
}

