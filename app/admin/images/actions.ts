'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

async function getAdminSupabase() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_superadmin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_superadmin) throw new Error("Forbidden")
  
  return supabase
}

export async function createImage(formData: FormData) {
  const supabase = await getAdminSupabase()
  
  const data = {
    url: formData.get('url') as string,
    image_description: formData.get('image_description') as string,
    additional_context: formData.get('additional_context') as string,
    celebrity_recognition: formData.get('celebrity_recognition') as string,
    is_common_use: formData.get('is_common_use') === 'on',
    is_public: formData.get('is_public') === 'on',
    modified_datetime_utc: new Date().toISOString(),
  }

  await supabase.from('images').insert(data)
  revalidatePath('/admin/images')
  redirect('/admin/images')
}

export async function upsertImage(formData: FormData) {
  const id = formData.get('id') as string; // Check if an ID exists
  const supabase = await getAdminSupabase();

  const data = {
    url: formData.get('url') as string,
    image_description: formData.get('image_description') as string,
    additional_context: formData.get('additional_context') as string,
    celebrity_recognition: formData.get('celebrity_recognition') as string,
    is_common_use: formData.get('is_common_use') === 'on',
    is_public: formData.get('is_public') === 'on',
    modified_datetime_utc: new Date().toISOString(),
  };

  if (id) {
    // If ID exists, we are UPDATING
    const { error } = await supabase.from('images').update(data).eq('id', id);
    if (error) throw error;
  } else {
    // If no ID, we are CREATING
    const { error } = await supabase.from('images').insert(data);
    if (error) throw error;
  }

  revalidatePath('/'); // Refresh the main dashboard
  redirect('/?view=images'); // Send the user back to the list
}

export async function updateImage(id: string, formData: FormData) {
  const supabase = await getAdminSupabase()
  
  const data = {
    url: formData.get('url') as string,
    image_description: formData.get('image_description') as string,
    additional_context: formData.get('additional_context') as string,
    celebrity_recognition: formData.get('celebrity_recognition') as string,
    is_common_use: formData.get('is_common_use') === 'on',
    is_public: formData.get('is_public') === 'on',
    modified_datetime_utc: new Date().toISOString(),
  }

  await supabase.from('images').update(data).eq('id', id)
  revalidatePath('/admin/images')
  redirect('/admin/images')
}

export async function deleteImage(id: string) {
  const supabase = await getAdminSupabase()
  await supabase.from('images').delete().eq('id', id)
  revalidatePath('/admin/images')
}