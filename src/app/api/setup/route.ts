import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET(req: NextRequest) {
  // Security: setup endpoint must be explicitly enabled with a secret.
  // Set SETUP_SECRET in env and call /api/setup?secret=... (avoid in production after use).
  const secret = process.env.SETUP_SECRET;
  const provided = req.nextUrl.searchParams.get("secret");
  if (!secret || !provided || provided !== secret) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  try {
    const username = process.env.SETUP_ADMIN_USERNAME || "admin";
    const password = process.env.SETUP_ADMIN_PASSWORD || "admin123";
    const hash = await bcrypt.hash(password, 10);
    await prisma.user.upsert({
      where: { username },
      update: {},
      create: { username, name: "Administrator", passwordHash: hash, role: "ADMIN" },
    });
    return NextResponse.json({ ok: true, message: "Admin user ensured" });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: "Setup failed" }, { status: 500 });
  }
}
