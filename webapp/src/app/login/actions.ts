"use server";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

/* Native-form login: works before hydration (progressive enhancement via
   useActionState), keeps the typed email on error without putting it in a URL. */

export type LoginState = { error?: string; email?: string };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Both fields are needed.", email };

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const msg = /invalid/i.test(error.message)
      ? "That email and password don't match. Check both and try again."
      : error.message;
    return { error: msg, email };
  }
  redirect("/");
}


/* One-click logins for local testing. Guarded twice: the buttons render only
   against a local Supabase, and this action refuses on anything else. */
const LOCAL = /(127\.0\.0\.1|localhost)/.test(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
const DEV_USERS = {
  owner: { email: "owner@local.test", password: "agency-owner-1" },
  client: { email: "client@local.test", password: "agency-client-1" },
} as const;

export async function devLogin(role: keyof typeof DEV_USERS) {
  if (!LOCAL) throw new Error("dev logins only exist against a local Supabase");
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword(DEV_USERS[role]);
  if (error) throw new Error(error.message);
  redirect("/");
}
