import { cookies } from "next/headers";
import { cache } from "react";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";

export type AuthUser = {
  id: string;
  username: string;
  name: string | null;
  role: "ADMIN" | "PARENT";
  parentStudentId: string | null;
};

const COOKIE = "msb_session";

function encode(payload: object) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}
function decode<T>(v: string): T | null {
  try { return JSON.parse(Buffer.from(v, "base64url").toString("utf8")); } catch { return null; }
}

export async function createSession(user: AuthUser) {
  const jar = await cookies();
  jar.set(COOKIE, encode({ u: user, t: Date.now() }), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.set(COOKIE, "", { path: "/", maxAge: 0 });
}

export const getAuthUser = cache(async (): Promise<AuthUser | null> => {
  const jar = await cookies();
  const c = jar.get(COOKIE)?.value;
  if (!c) return null;
  const data = decode<{ u: AuthUser }>(c);
  return data?.u ?? null;
});

export async function requireAdmin() {
  const u = await getAuthUser();
  if (!u || u.role !== "ADMIN") throw new Error("UNAUTHORIZED");
  return u;
}

export async function requireUser() {
  const u = await getAuthUser();
  if (!u) throw new Error("UNAUTHORIZED");
  return u;
}

export async function verifyLogin(username: string, password: string) {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role as "ADMIN" | "PARENT",
    parentStudentId: user.parentStudentId,
  } satisfies AuthUser;
}

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}
