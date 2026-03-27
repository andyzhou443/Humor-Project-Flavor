import Link from "next/link";
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { deleteImage } from "./actions";

export default async function AdminImagesPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('is_superadmin').eq('id', user?.id).single();

  if (!profile?.is_superadmin) redirect('/login');

  const { data: images } = await supabase
    .from('images')
    .select('*')
    .order('created_datetime_utc', { ascending: false });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold">Image Library</h1>
          <p className="text-zinc-500 text-sm">Manage assets and metadata</p>
        </div>
        <Link href="/admin/images/new" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          + Add Image
        </Link>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-zinc-50 border-b border-zinc-200 text-xs font-semibold uppercase text-zinc-500">
            <tr>
              <th className="px-6 py-4">Preview</th>
              <th className="px-6 py-4">Description</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {images?.map((img) => (
              <tr key={img.id} className="hover:bg-zinc-50/50 transition-colors">
                <td className="px-6 py-4">
                  <img src={img.url} className="h-12 w-12 object-cover rounded border border-zinc-200" alt="" />
                </td>
                <td className="px-6 py-4 text-sm">
                  <p className="font-medium text-zinc-900 truncate max-w-xs">{img.image_description || 'No description'}</p>
                  <p className="text-zinc-500 text-xs truncate max-w-xs">{img.url}</p>
                </td>
                <td className="px-6 py-4">
                   <div className="flex gap-2">
                     {img.is_public && <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">Public</span>}
                     {img.is_common_use && <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">Common</span>}
                   </div>
                </td>
                <td className="px-6 py-4 text-right flex justify-end gap-4">
                  <Link href={`/admin/images/${img.id}/edit`} className="text-indigo-600 text-xs font-bold hover:underline">EDIT</Link>
                  <form action={deleteImage.bind(null, img.id)}>
                    <button className="text-red-500 text-xs font-bold hover:underline">DELETE</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}