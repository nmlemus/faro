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
