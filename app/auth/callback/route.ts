import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js' // Import basic client for Admin
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const cookieStore = await cookies()

    // 1. Standard Client (for acting as the user)
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch { }
          },
        },
      }
    )

    // 2. Exchange the code for a session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data?.user) {
      const userEmail = data.user.email
      const userId = data.user.id

      // 3. Fetch Profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('email, created_datetime_utc')
        .eq('email', userEmail)
        .single()

      // 4. Logic Check
      let isAutoCreated = false
      if (profile?.created_datetime_utc) {
        const profileTime = new Date(profile.created_datetime_utc).getTime()
        const now = new Date().getTime()
        // If created within the last 15 seconds, assume it's an auto-signup
        if ((now - profileTime) < 15000) {
          isAutoCreated = true
        }
      }

      // 5. DENY ACCESS Logic
      if (profileError || !profile || isAutoCreated) {
        console.log(`Blocking unauthorized login: ${userEmail}`)

        // --- THE FIX STARTS HERE ---
        
        // Initialize Admin Client (Requires SERVICE_ROLE_KEY in .env)
        // We need this because the regular user cannot delete themselves usually
        const supabaseAdmin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY! 
        )

        // HARD DELETE the user. 
        // This ensures next time they try, they are "new" again and get blocked again.
        await supabaseAdmin.auth.admin.deleteUser(userId)

        // Sign out the session in the browser
        await supabase.auth.signOut()
        
        return NextResponse.redirect(`${origin}/login?error=Unauthorized: Email not on the allowlist`)
      }

      // 6. Authorized: Proceed
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}