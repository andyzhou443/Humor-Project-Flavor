'use client'

import { createBrowserClient } from '@supabase/ssr'

export default function AuthButton({ user }: { user: any }) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Using your specific Google Client ID
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
          //client_id: '388960353527-fh4grc6mla425lg0e3g1hh67omtrdihd.apps.googleusercontent.com',
        },
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/' // Better than reload for UX
  }

  return user ? (
    <button onClick={handleLogout} className="rounded-md bg-zinc-200 px-4 py-2 text-sm font-medium dark:bg-zinc-800">
      Logout ({user.email})
    </button>
  ) : (
    <button onClick={handleLogin} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
      Login with Google
    </button>
  )
}