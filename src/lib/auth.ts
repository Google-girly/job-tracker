import "server-only";
import { redirect } from "next/navigation";
import { isAllowedEmail } from "./allowed-email";
import { createAuthClient } from "./supabase/server";

export async function getUserEmail(): Promise<string | null> {
  const supabase = await createAuthClient();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email;
  return isAllowedEmail(email) ? (email as string) : null;
}

// src/proxy.ts already guards every route; this re-checks inside server actions and route handlers.
export async function requireUser(): Promise<string> {
  const email = await getUserEmail();
  if (!email) redirect("/login");
  return email;
}
