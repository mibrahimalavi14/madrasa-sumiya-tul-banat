import prisma from "./prisma";

export async function getCurrentSession() {
  return prisma.session.findFirst({ where: { isCurrent: true } });
}

export async function requireCurrentSession() {
  const s = await getCurrentSession();
  if (!s) throw new Error("NO_SESSION");
  if (s.status !== "ACTIVE") throw new Error("SESSION_NOT_ACTIVE");
  return s;
}
