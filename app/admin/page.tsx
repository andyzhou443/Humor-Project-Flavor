import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from "next/link";
import AuthButton from "@/components/AuthButton";

export default async function AdminPage() {
  const cookieStore = await cookies()
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() { /* Read-only in Server Components */ }
      },
    }
  )

  // 1. Verify Authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 2. Verify Superadmin Status (Security Wall)
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_superadmin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_superadmin) {
    // If not a superadmin, redirect to home immediately
    redirect('/')
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-[#f9fafb] font-sans dark:bg-zinc-950">
      {/* Navigation */}
      <nav className="sticky top-0 z-10 flex w-full justify-center border-b border-zinc-200 bg-white/80 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="flex w-full max-w-6xl items-center justify-between p-4">
          <div className="flex gap-8 text-sm font-semibold text-zinc-500">
            <Link href="/" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">Profiles</Link>
            <Link href="/?view=captions" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">Captions</Link>
            <Link href="/admin" className="text-indigo-600 dark:text-indigo-400">Admin Panel</Link>
          </div>
          <AuthButton user={user} />
        </div>
      </nav>

      <main className="flex w-full max-w-6xl flex-col py-12 px-6">
        <header className="mb-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 uppercase tracking-tight dark:bg-amber-900/30 dark:text-amber-400">
              Superadmin Access
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">System Administration</h1>
          <p className="mt-2 text-zinc-500 text-sm">Sensitive system-wide settings and logs.</p>
        </header>

        {/* Admin Content Area */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="font-bold text-zinc-900 dark:text-zinc-100">User Management</h3>
            <p className="mt-2 text-sm text-zinc-500">Promote users to admin status or manage study participation groups.</p>
            <button className="mt-4 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
              Configure Roles →
            </button>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="font-bold text-zinc-900 dark:text-zinc-100">System Logs</h3>
            <p className="mt-2 text-sm text-zinc-500">View detailed audit logs for caption deletions and profile changes.</p>
            <button className="mt-4 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
              View Logs →
            </button>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="font-bold text-zinc-900 dark:text-zinc-100">Danger Zone</h3>
            <p className="mt-2 text-sm text-zinc-500">Purge inactive data or reset study parameters for the next phase.</p>
            <button className="mt-4 text-sm font-semibold text-red-500 hover:underline">
              System Reset →
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

