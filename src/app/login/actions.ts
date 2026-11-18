"use server";
import { redirect } from "next/navigation";
import { createSession, verifyLogin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function loginAction(formData: FormData) {
  const username = String(formData.get("username") || "");
  const password = String(formData.get("password") || "");
  const portal = String(formData.get("portal") || "");
  const user = await verifyLogin(username, password);
  if (!user) redirect("/login?error=1");

  if (portal === "admin" && user.role !== "ADMIN" && user.role !== "ACCOUNTANT") {
    redirect("/login?error=portal");
  }
  if (portal === "parent" && user.role !== "PARENT") {
    redirect("/login?error=portal");
  }

  await createSession(user);
  await logAudit({ actorUserId: user.id, actorLabel: user.username || user.name, action: "LOGIN", entityType: "User", entityId: user.id, details: JSON.stringify({ role: user.role, portal: portal || null }) });
  redirect("/dashboard");
}
