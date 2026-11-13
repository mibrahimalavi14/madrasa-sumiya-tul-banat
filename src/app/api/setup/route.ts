import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
    const hash = await bcrypt.hash("admin123", 10);
    await prisma.user.upsert({
      where: { username: "admin" },
      update: {},
      create: { username: "admin", name: "Administrator", passwordHash: hash, role: "ADMIN" },
    });
    return NextResponse.json({ ok: true, message: "Admin ensured: username admin, password admin123" });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
