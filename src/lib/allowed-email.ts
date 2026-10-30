// Only these accounts may use the app (comma-separated ALLOWED_EMAIL), even if someone else signs up in Supabase.
// Kept free of server-only imports so src/proxy.ts can use it too.
export function isAllowedEmail(email: unknown): boolean {
  if (typeof email !== "string") return false;
  const allowed = (process.env.ALLOWED_EMAIL ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return allowed.includes(email.toLowerCase());
}
