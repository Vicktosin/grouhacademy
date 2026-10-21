import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// The link in a Support Admin's invitation email (lib/support-admin-invite).
// Opening it confirms they have the mailbox; they then sign in with the
// password the admin set, so this never signs them in by itself.
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const login = new URL("/login", request.url);

  if (tokenHash && type) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) {
      await supabase.auth.signOut({ scope: "local" });
      login.searchParams.set("invite", "confirmed");
      return NextResponse.redirect(login);
    }
    console.error("Support Admin invitation link was refused:", error);
  }
  login.searchParams.set("invite", "expired");
  return NextResponse.redirect(login);
}
