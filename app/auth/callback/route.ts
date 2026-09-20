import { NextRequest, NextResponse } from 'next/server'
import {
  ensurePrismaUserForSupabaseAuth,
  getAuthorizedHomeRouteForUserId,
} from '@/lib/supabase/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const next = request.nextUrl.searchParams.get('next')

  if (code) {
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Password-recovery links are the sole callback that should honour a
      // caller-provided destination. OAuth sign-ins must use the real account
      // state below, otherwise existing interns are sent back to onboarding.
      if (next === '/reset-password') {
        return NextResponse.redirect(new URL(next, request.url))
      }

      const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (assurance?.currentLevel === 'aal1' && assurance.nextLevel === 'aal2') {
        return NextResponse.redirect(new URL('/auth/mfa', request.url))
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const userId = await ensurePrismaUserForSupabaseAuth(user)
        const destination = await getAuthorizedHomeRouteForUserId(userId)
        return NextResponse.redirect(new URL(destination, request.url))
      }
    }
  }

  return NextResponse.redirect(new URL('/login?error=auth_callback_failed', request.url))
}
