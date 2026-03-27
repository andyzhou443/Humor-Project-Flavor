import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { upsertImage } from '../actions'
import Link from 'next/link'

export default async function EditImagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const isNew = id === 'new'
  
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )

  // Security: Check SuperAdmin status
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('is_superadmin').eq('id', user?.id).single()
  if (!profile?.is_superadmin) redirect('/')

  // Fetch existing data if editing
  let imageData = null
  if (!isNew) {
    const { data } = await supabase.from('images').select('*').eq('id', id).single()
    imageData = data
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-[#f9fafb] p-12">
      <div className="w-full max-w-2xl">
        <Link href="/?view=images" className="text-xs font-bold text-zinc-400 hover:text-zinc-600 mb-4 block">← BACK TO DIRECTORY</Link>
        <h1 className="text-2xl font-bold mb-8">{isNew ? 'Add New Image' : 'Edit Image Metadata'}</h1>
        
        <form action={upsertImage} className="space-y-6 bg-white p-8 rounded-xl border border-zinc-200 shadow-sm">
          {!isNew && <input type="hidden" name="id" value={id} />}
          
          <div className="space-y-2">
            <label className="text-sm font-bold text-zinc-700">Image URL</label>
            <input name="url" defaultValue={imageData?.url} className="w-full p-2 border rounded-md" required />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-zinc-700">Description</label>
            <textarea name="image_description" defaultValue={imageData?.image_description} className="w-full p-2 border rounded-md" rows={4} />
          </div>

          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" name="is_public" defaultChecked={imageData?.is_public} /> Public
            </label>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" name="is_common_use" defaultChecked={imageData?.is_common_use} /> Common Use
            </label>
          </div>

          <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 transition-colors">
            {isNew ? 'CREATE IMAGE' : 'SAVE CHANGES'}
          </button>
        </form>
      </div>
    </div>
  )
}