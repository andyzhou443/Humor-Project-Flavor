// page.tsx
import Link from "next/link";
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import AuthButton from "@/components/AuthButton";
import { revalidatePath } from "next/cache";

type Profile = {
  id: string;
  is_superadmin: boolean;
  is_matrix_admin: boolean;
};

type HumorFlavor = {
  id: number;
  slug: string;
  description: string | null;
  created_datetime_utc: string;
};

type HumorFlavorStep = {
  id: number;
  humor_flavor_id: number;
  llm_temperature: number | null;
  order_by: number;
  llm_input_type_id: number;
  llm_output_type_id: number;
  llm_model_id: number;
  humor_flavor_step_type_id: number;
  llm_system_prompt: string | null;
  llm_user_prompt: string | null;
  description: string | null;
  created_datetime_utc: string;
};

type Caption = {
  id: string;
  content: string | null;
  humor_flavor_id: number | null;
  created_datetime_utc: string;
};

async function createActionClient() {
  const cookieStore = await cookies();
  return createServerClient(
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
          } catch {}
        }
      }
    }
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ 
    tab?: string; 
    flavor_id?: string; 
    test_result?: string; 
    test_error?: string; 
    ft_flavor_id?: string;
    ft_result?: string;
    ft_error?: string;
  }>;
}) {
  const cookieStore = await cookies();
  const params = await searchParams;
  const activeTab = params.tab || "flavors";
  const selectedFlavorId = params.flavor_id ? parseInt(params.flavor_id, 10) : null;
  const ftFlavorId = params.ft_flavor_id ? parseInt(params.ft_flavor_id, 10) : null;
  
  // Theme state retrieved from cookies (defaults to system)
  const currentTheme = cookieStore.get('theme')?.value || 'system';

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() { } } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: currentProfile } = await supabase.from('profiles').select('is_superadmin, is_matrix_admin').eq('id', user.id).single();

  if (!currentProfile || (!currentProfile.is_superadmin && !currentProfile.is_matrix_admin)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f9fafb] dark:bg-zinc-950">
        <p className="text-zinc-500">Account pending administrative authorization.</p>
      </div>
    );
  }

  // --- THEME SERVER ACTION ---
  async function setThemeAction(formData: FormData) {
    'use server'
    const theme = formData.get("theme") as string;
    const cookieStore = await cookies();
    cookieStore.set('theme', theme, { path: '/' });
    revalidatePath('/');
  }

  // --- REST API TEST ACTION (4-Step Pipeline) ---
  async function testHumorFlavorAction(formData: FormData) {
    'use server'
    const flavorId = formData.get("flavor_id") as string;
    const file = formData.get("image_file") as File;

    try {
      if (!file || file.size === 0) {
        throw new Error("Please upload a valid image file.");
      }

      // We must retrieve the user's session token to pass to the API auth header
      const actionClient = await createActionClient();
      const { data: { session }, error: sessionError } = await actionClient.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error("Failed to retrieve valid Supabase session token.");
      }

      const token = session.access_token;
      const baseUrl = "https://api.almostcrackd.ai";

      // Step 1: Generate Presigned URL
      const step1Res = await fetch(`${baseUrl}/pipeline/generate-presigned-url`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ contentType: file.type })
      });
      if (!step1Res.ok) throw new Error(`Step 1 failed: ${step1Res.statusText}`);
      const { presignedUrl, cdnUrl } = await step1Res.json();

      // Step 2: Upload Image Bytes
      const fileBytes = await file.arrayBuffer(); // Extract raw binary data

      const step2Res = await fetch(presignedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: fileBytes // Pass the binary buffer instead of the proxy File object
      });
      if (!step2Res.ok) throw new Error(`Step 2 failed: ${step2Res.statusText}`);

      // Step 3: Register Image URL
      const step3Res = await fetch(`${baseUrl}/pipeline/upload-image-from-url`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ imageUrl: cdnUrl, isCommonUse: false })
      });
      if (!step3Res.ok) throw new Error(`Step 3 failed: ${step3Res.statusText}`);
      const step3Json = await step3Res.json();
      // Support both camelCase (imageId) and snake_case (image_id) from the API
      const imageId = step3Json.imageId ?? step3Json.image_id;
      if (!imageId) throw new Error(`Step 3 did not return a valid imageId. Response was: ${JSON.stringify(step3Json)}`);


      // Step 4: Generate Captions
      const step4Res = await fetch(`${baseUrl}/pipeline/generate-captions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          imageId: imageId, 
          humorFlavorId: parseInt(flavorId, 10) 
        })
      });
      if (!step4Res.ok) {
        // Read the actual error body so the real backend message is surfaced
        const errorBody = await step4Res.text().catch(() => step4Res.statusText);
        throw new Error(`Step 4 failed (${step4Res.status}): ${errorBody}`);
      }
      
      // The endpoint may return a JSON array or plain text depending on step config
      const step4Text = await step4Res.text();
      let formattedResult: string;
      try {
        const captionsArray = JSON.parse(step4Text);
        formattedResult = JSON.stringify(captionsArray, null, 2);
      } catch {
        // Backend returned plain text — surface it as-is so the config issue is visible
        formattedResult = step4Text;
      }

      redirect(`/?tab=test&flavor_id=${flavorId}&test_result=${encodeURIComponent(formattedResult)}`);
    } catch (error: any) {
      // Next.js redirect() works by throwing a special error internally — re-throw it
      // so the redirect is not swallowed and mistakenly treated as a real error.
      if (error?.message === 'NEXT_REDIRECT' || error?.digest?.startsWith('NEXT_REDIRECT')) {
        throw error;
      }
      redirect(`/?tab=test&flavor_id=${flavorId}&test_error=${encodeURIComponent(error.message)}`);
    }
  }

  // --- FLAVOR TEST ACTION (same 4-step pipeline, separate URL state) ---
  async function testFlavorAction(formData: FormData) {
    'use server'
    const flavorId = formData.get("ft_flavor_id") as string;
    const file = formData.get("ft_image_file") as File;

    try {
      if (!file || file.size === 0) throw new Error("Please upload a valid image file.");

      const actionClient = await createActionClient();
      const { data: { session }, error: sessionError } = await actionClient.auth.getSession();
      if (sessionError || !session?.access_token) throw new Error("Failed to retrieve valid Supabase session token.");

      const token = session.access_token;
      const baseUrl = "https://api.almostcrackd.ai";

      // Step 1: Generate Presigned URL
      const step1Res = await fetch(`${baseUrl}/pipeline/generate-presigned-url`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: file.type })
      });
      if (!step1Res.ok) throw new Error(`Step 1 failed: ${step1Res.statusText}`);
      const { presignedUrl, cdnUrl } = await step1Res.json();

      // Step 2: Upload Image Bytes
      const step2Res = await fetch(presignedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: await file.arrayBuffer()
      });
      if (!step2Res.ok) throw new Error(`Step 2 failed: ${step2Res.statusText}`);

      // Step 3: Register Image URL
      const step3Res = await fetch(`${baseUrl}/pipeline/upload-image-from-url`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: cdnUrl, isCommonUse: false })
      });
      if (!step3Res.ok) throw new Error(`Step 3 failed: ${step3Res.statusText}`);
      const step3Json = await step3Res.json();
      const imageId = step3Json.imageId ?? step3Json.image_id;
      if (!imageId) throw new Error(`Step 3 did not return a valid imageId. Response: ${JSON.stringify(step3Json)}`);

      // Step 4: Generate Captions
      const step4Res = await fetch(`${baseUrl}/pipeline/generate-captions`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId, humorFlavorId: parseInt(flavorId, 10) })
      });
      if (!step4Res.ok) {
        const errorBody = await step4Res.text().catch(() => step4Res.statusText);
        throw new Error(`Step 4 failed (${step4Res.status}): ${errorBody}`);
      }

      const step4Text = await step4Res.text();
      // Parse captions — backend returns a JSON array of strings, one per pipeline step
      let captions: string[];
      try {
        const parsed = JSON.parse(step4Text);
        captions = Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
      } catch {
        captions = [step4Text];
      }

      // Bundle CDN image URL + captions so the results page can render them together
      const resultPayload = JSON.stringify({ imageUrl: cdnUrl, captions });
      redirect(`/?tab=flavor-test&ft_flavor_id=${flavorId}&ft_result=${encodeURIComponent(resultPayload)}`);
    } catch (error: any) {
      if (error?.message === 'NEXT_REDIRECT' || error?.digest?.startsWith('NEXT_REDIRECT')) throw error;
      redirect(`/?tab=flavor-test&ft_flavor_id=${flavorId}&ft_error=${encodeURIComponent(error.message)}`);
    }
  }

  // --- SERVER ACTIONS FOR FLAVORS ---
  async function createHumorFlavorAction(formData: FormData) {
    'use server'
    const slug = formData.get("slug") as string;
    const description = formData.get("description") as string;
    const actionClient = await createActionClient();
    await actionClient.from('humor_flavors').insert({ slug, description: description || null });
    revalidatePath('/');
  }

  async function updateHumorFlavorAction(formData: FormData) {
    'use server'
    const id = parseInt(formData.get("id") as string, 10);
    const slug = formData.get("slug") as string;
    const description = formData.get("description") as string;
    const actionClient = await createActionClient();
    await actionClient.from('humor_flavors').update({ slug, description: description || null }).eq('id', id);
    revalidatePath('/');
  }

  async function deleteHumorFlavorAction(formData: FormData) {
    'use server'
    const id = parseInt(formData.get("id") as string, 10);
    const actionClient = await createActionClient();
    await actionClient.from('humor_flavors').delete().eq('id', id);
    revalidatePath('/');
  }

  // --- SERVER ACTIONS FOR STEPS ---
  async function createHumorFlavorStepAction(formData: FormData) {
    'use server'
    const actionClient = await createActionClient();
    const flavorId = formData.get("humor_flavor_id") as string;

    const { error } = await actionClient.from('humor_flavor_steps').insert({ 
      humor_flavor_id: parseInt(flavorId, 10),
      order_by: parseInt(formData.get("order_by") as string, 10),
      llm_temperature: formData.get("llm_temperature") ? parseFloat(formData.get("llm_temperature") as string) : null,
      llm_input_type_id: parseInt(formData.get("llm_input_type_id") as string, 10),
      llm_output_type_id: parseInt(formData.get("llm_output_type_id") as string, 10),
      llm_model_id: parseInt(formData.get("llm_model_id") as string, 10),
      humor_flavor_step_type_id: parseInt(formData.get("humor_flavor_step_type_id") as string, 10),
      description: formData.get("description") as string || null,
      llm_system_prompt: formData.get("llm_system_prompt") as string || null,
      llm_user_prompt: formData.get("llm_user_prompt") as string || null,
    });

    // 1. Catch and expose the silent failure
    if (error) {
      console.error("Supabase Insert Error:", error);
      // Throwing an error stops Next.js from wiping your form,
      // allowing you to see what actually failed in your server console.
      throw new Error(`Failed to create step: ${error.message}`);
    }

    // 2. Explicitly redirect to preserve your tab and flavor selection state
    redirect(`/?tab=steps&flavor_id=${flavorId}`);
  }

  async function updateHumorFlavorStepAction(formData: FormData) {
    'use server'
    const id = parseInt(formData.get("id") as string, 10);
    const actionClient = await createActionClient();
    await actionClient.from('humor_flavor_steps').update({ 
      llm_temperature: formData.get("llm_temperature") ? parseFloat(formData.get("llm_temperature") as string) : null,
      llm_input_type_id: parseInt(formData.get("llm_input_type_id") as string, 10),
      llm_output_type_id: parseInt(formData.get("llm_output_type_id") as string, 10),
      llm_model_id: parseInt(formData.get("llm_model_id") as string, 10),
      humor_flavor_step_type_id: parseInt(formData.get("humor_flavor_step_type_id") as string, 10),
      description: formData.get("description") as string || null,
      llm_system_prompt: formData.get("llm_system_prompt") as string || null,
      llm_user_prompt: formData.get("llm_user_prompt") as string || null,
    }).eq('id', id);
    revalidatePath('/');
  }

  async function deleteHumorFlavorStepAction(formData: FormData) {
    'use server'
    const id = parseInt(formData.get("id") as string, 10);
    const actionClient = await createActionClient();
    await actionClient.from('humor_flavor_steps').delete().eq('id', id);
    revalidatePath('/');
  }

  async function reorderStepAction(formData: FormData) {
    'use server'
    const id = parseInt(formData.get("id") as string, 10);
    const flavorId = parseInt(formData.get("humor_flavor_id") as string, 10);
    const currentOrder = parseInt(formData.get("current_order") as string, 10);
    const direction = formData.get("direction") as string;
    
    const targetOrder = direction === "up" ? currentOrder - 1 : currentOrder + 1;
    const actionClient = await createActionClient();

    const { data: swapTarget } = await actionClient.from('humor_flavor_steps')
      .select('id, order_by')
      .eq('humor_flavor_id', flavorId)
      .eq('order_by', targetOrder)
      .single();

    if (swapTarget) {
      await actionClient.from('humor_flavor_steps').update({ order_by: currentOrder }).eq('id', swapTarget.id);
    }
    await actionClient.from('humor_flavor_steps').update({ order_by: targetOrder }).eq('id', id);
    revalidatePath('/');
  }

  // --- DATA FETCHING ---
  const { data: flavorsData } = await supabase.from('humor_flavors').select('*').order('slug', { ascending: true });
  const flavors = (flavorsData as HumorFlavor[]) || [];

  let steps: HumorFlavorStep[] = [];
  let captions: Caption[] = [];

  if (activeTab === "steps" && selectedFlavorId) {
    const { data: stepsData } = await supabase.from('humor_flavor_steps').select('*').eq('humor_flavor_id', selectedFlavorId).order('order_by', { ascending: true });
    steps = (stepsData as HumorFlavorStep[]) || [];
  }

  if (activeTab === "captions" && selectedFlavorId) {
    const { data: captionsData } = await supabase.from('captions').select('*').eq('humor_flavor_id', selectedFlavorId).order('created_datetime_utc', { ascending: false }).limit(50);
    captions = (captionsData as Caption[]) || [];
  }

  return (
    <div 
      id="main-app-wrapper" 
      className={`flex min-h-screen flex-col items-center bg-[#f9fafb] text-zinc-900 font-sans dark:bg-zinc-950 dark:text-zinc-100 ${currentTheme === 'dark' ? 'dark' : ''}`}
    >
      {/* Script to handle System Theme dynamically without React Hydration issues */}
      <script dangerouslySetInnerHTML={{__html: `
        if ('${currentTheme}' === 'system') {
          if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.getElementById('main-app-wrapper').classList.add('dark');
          }
        }
      `}} />

      {/* NAVBAR */}
      <nav className="sticky top-0 z-10 flex w-full justify-center border-b border-zinc-200 bg-white/80 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="flex w-full max-w-6xl items-center justify-between p-4">
          <div className="flex gap-6 text-sm font-semibold items-center overflow-x-auto">
            <Link href="?tab=flavors" className={`whitespace-nowrap pb-1 ${activeTab === 'flavors' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'}`}>Humor Flavors</Link>
            <Link href="?tab=steps" className={`whitespace-nowrap pb-1 ${activeTab === 'steps' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'}`}>Humor Flavor Steps</Link>
            <Link href="?tab=captions" className={`whitespace-nowrap pb-1 ${activeTab === 'captions' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'}`}>Read Captions</Link>
            <Link href="?tab=test" className={`whitespace-nowrap pb-1 ${activeTab === 'test' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'}`}>Test API</Link>
            <Link href="?tab=flavor-test" className={`whitespace-nowrap pb-1 ${activeTab === 'flavor-test' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'}`}>Flavor Test</Link>
          </div>
          
          <div className="flex items-center gap-4">
            {/* THEME TOGGLE FORM */}
            <form action={setThemeAction} className="flex items-center gap-2">
              <select name="theme" defaultValue={currentTheme} className="text-xs px-2 py-1.5 rounded-md border border-zinc-300 bg-white dark:bg-zinc-900 dark:border-zinc-700 outline-none">
                <option value="light">Light Mode</option>
                <option value="dark">Dark Mode</option>
                <option value="system">System Default</option>
              </select>
              <button type="submit" className="text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-3 py-1.5 rounded-md border border-zinc-300 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-700 transition-colors">
                Apply
              </button>
            </form>
            <AuthButton user={user} />
          </div>
        </div>
      </nav>

      <main className="flex w-full max-w-6xl flex-col py-12 px-6">
        
        {/* =========================================
            TAB: HUMOR FLAVORS 
            ========================================= */}
        {activeTab === "flavors" && (
          <>
            <div className="mb-8 flex flex-col gap-2">
              <h1 className="text-3xl font-bold tracking-tight">Humor Flavors</h1>
              <p className="text-zinc-500 text-sm">Create and manage top-level humor style configurations.</p>
            </div>

            <div className="mb-6 p-5 rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-sm font-bold mb-4">Add New Flavor</h2>
              <form action={createHumorFlavorAction} className="flex flex-wrap items-end gap-4">
                <div className="flex flex-col gap-1.5 flex-[1] min-w-[200px]">
                  <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Slug</label>
                  <input required name="slug" type="text" className="px-3 py-2 text-sm border border-zinc-300 rounded-md bg-transparent dark:border-zinc-700 focus:ring-2 focus:ring-indigo-500/50 outline-none" />
                </div>
                <div className="flex flex-col gap-1.5 flex-[3] min-w-[250px]">
                  <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Description</label>
                  <input name="description" type="text" className="px-3 py-2 text-sm border border-zinc-300 rounded-md bg-transparent dark:border-zinc-700 focus:ring-2 focus:ring-indigo-500/50 outline-none" />
                </div>
                <button type="submit" className="px-6 py-2 h-[38px] bg-indigo-600 text-white text-sm font-semibold rounded-md hover:bg-indigo-700 transition-colors">Create</button>
              </form>
            </div>

            <div className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="grid grid-cols-12 gap-4 border-b border-zinc-200 bg-zinc-50/50 px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
                <div className="col-span-3">Slug</div>
                <div className="col-span-5">Description</div>
                <div className="col-span-2">Created</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {flavors.map((flavor) => (
                  <form key={flavor.id} action={updateHumorFlavorAction} className="grid grid-cols-12 gap-4 items-start px-6 py-4 group hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition-colors">
                    <input type="hidden" name="id" value={flavor.id} />
                    <div className="col-span-3">
                      <input required type="text" name="slug" defaultValue={flavor.slug} className="w-full text-sm font-mono text-indigo-600 dark:text-indigo-400 bg-transparent border border-transparent rounded px-2 py-1 outline-none focus:bg-white dark:focus:bg-zinc-950 focus:border-zinc-300 dark:focus:border-zinc-700" />
                      <Link href={`/?tab=steps&flavor_id=${flavor.id}`} className="text-[10px] text-zinc-500 hover:text-indigo-600 mt-1 inline-block px-2">Manage Steps →</Link>
                    </div>
                    <div className="col-span-5">
                      <textarea name="description" defaultValue={flavor.description || ''} rows={2} className="w-full text-sm text-zinc-700 dark:text-zinc-300 bg-transparent border border-transparent rounded px-2 py-1 outline-none resize-none focus:bg-white dark:focus:bg-zinc-950 focus:border-zinc-300 dark:focus:border-zinc-700" />
                    </div>
                    <div className="col-span-2 pt-1.5 text-[11px] text-zinc-400 font-medium">
                      {new Date(flavor.created_datetime_utc).toLocaleDateString('en-US')}
                    </div>
                    <div className="col-span-2 flex flex-col items-end gap-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                      <button type="submit" className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-1 rounded w-full border border-indigo-100 dark:border-indigo-800 dark:hover:bg-indigo-900/30">Update</button>
                      <button formAction={deleteHumorFlavorAction} className="text-xs font-bold text-red-600 hover:bg-red-50 px-3 py-1 rounded w-full border border-red-100 dark:border-red-900/50 dark:hover:bg-red-900/30">Delete</button>
                    </div>
                  </form>
                ))}
              </div>
            </div>
          </>
        )}

        {/* =========================================
            TAB: HUMOR FLAVOR STEPS 
            ========================================= */}
        {activeTab === "steps" && (
          <>
            <div className="mb-6 flex justify-between items-end">
              <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Flavor Pipeline Steps</h1>
                <p className="text-zinc-500 text-sm">Select a flavor to manage its sequential LLM generation steps.</p>
              </div>
              <form method="GET" action="/" className="flex items-center gap-2">
                <input type="hidden" name="tab" value="steps" />
                <select 
                  name="flavor_id" 
                  defaultValue={selectedFlavorId || ""}
                  className="px-4 py-2 border border-zinc-300 rounded-md bg-white text-sm dark:bg-zinc-900 dark:border-zinc-700 dark:text-white outline-none"
                >
                  <option value="" disabled>-- Select a Flavor --</option>
                  {flavors.map(f => <option key={f.id} value={f.id}>{f.slug}</option>)}
                </select>
                <button type="submit" className="px-3 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-sm font-semibold rounded-md border border-zinc-300 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-700 transition-colors">
                  Load
                </button>
              </form>
            </div>

            {selectedFlavorId ? (
              <>
                <div className="mb-6 p-5 rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <h2 className="text-sm font-bold mb-4">Add Step to Pipeline</h2>
                  <form action={createHumorFlavorStepAction} className="flex flex-col gap-4">
                    <input type="hidden" name="humor_flavor_id" value={selectedFlavorId} />
                    <input type="hidden" name="order_by" value={steps.length > 0 ? Math.max(...steps.map(s => s.order_by)) + 1 : 1} />
                    
                    <div className="grid grid-cols-5 gap-4">
                      <div className="flex flex-col gap-1.5"><label className="text-xs text-zinc-500">Model ID</label><input required name="llm_model_id" type="number" className="px-2 py-1.5 text-sm border rounded bg-transparent dark:border-zinc-700 outline-none focus:ring-1 focus:ring-indigo-500" /></div>
                      <div className="flex flex-col gap-1.5"><label className="text-xs text-zinc-500">Temp (0-1)</label><input name="llm_temperature" type="number" step="0.1" className="px-2 py-1.5 text-sm border rounded bg-transparent dark:border-zinc-700 outline-none focus:ring-1 focus:ring-indigo-500" /></div>
                      <div className="flex flex-col gap-1.5"><label className="text-xs text-zinc-500">Input Type ID</label><input required name="llm_input_type_id" type="number" className="px-2 py-1.5 text-sm border rounded bg-transparent dark:border-zinc-700 outline-none focus:ring-1 focus:ring-indigo-500" /></div>
                      <div className="flex flex-col gap-1.5"><label className="text-xs text-zinc-500">Output Type ID</label><input required name="llm_output_type_id" type="number" className="px-2 py-1.5 text-sm border rounded bg-transparent dark:border-zinc-700 outline-none focus:ring-1 focus:ring-indigo-500" /></div>
                      <div className="flex flex-col gap-1.5"><label className="text-xs text-zinc-500">Step Type ID</label><input required name="humor_flavor_step_type_id" type="number" className="px-2 py-1.5 text-sm border rounded bg-transparent dark:border-zinc-700 outline-none focus:ring-1 focus:ring-indigo-500" /></div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5"><label className="text-xs text-zinc-500">System Prompt</label><textarea name="llm_system_prompt" rows={2} className="px-2 py-1.5 text-sm border rounded resize-none bg-transparent dark:border-zinc-700 outline-none focus:ring-1 focus:ring-indigo-500" /></div>
                      <div className="flex flex-col gap-1.5"><label className="text-xs text-zinc-500">User Prompt / Desc.</label><textarea name="llm_user_prompt" rows={2} className="px-2 py-1.5 text-sm border rounded resize-none bg-transparent dark:border-zinc-700 outline-none focus:ring-1 focus:ring-indigo-500" /></div>
                    </div>
                    
                    <button type="submit" className="px-6 py-2 w-fit bg-indigo-600 text-white text-sm font-semibold rounded-md hover:bg-indigo-700">Add Step</button>
                  </form>
                </div>

                <div className="flex flex-col gap-4">
                  {steps.map((step, index) => (
                    <div key={step.id} className="flex gap-4 p-4 border border-zinc-200 rounded-xl bg-white shadow-sm dark:bg-zinc-900 dark:border-zinc-800 relative group">
                      <div className="flex flex-col items-center justify-center gap-1 border-r border-zinc-100 dark:border-zinc-800 pr-4">
                        <span className="text-xs font-bold text-zinc-400 mb-1">#{step.order_by}</span>
                        <form action={reorderStepAction}>
                          <input type="hidden" name="id" value={step.id} />
                          <input type="hidden" name="humor_flavor_id" value={step.humor_flavor_id} />
                          <input type="hidden" name="current_order" value={step.order_by} />
                          <button name="direction" value="up" disabled={index === 0} className="p-1 text-zinc-400 hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-zinc-400">▲</button>
                          <button name="direction" value="down" disabled={index === steps.length - 1} className="p-1 text-zinc-400 hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-zinc-400">▼</button>
                        </form>
                      </div>

                      <form action={updateHumorFlavorStepAction} className="flex-1 grid grid-cols-12 gap-4">
                        <input type="hidden" name="id" value={step.id} />
                        <div className="col-span-12 lg:col-span-5 grid grid-cols-2 gap-3">
                           <div className="flex flex-col gap-1"><span className="text-[10px] text-zinc-500">Model ID</span><input name="llm_model_id" type="number" defaultValue={step.llm_model_id} className="p-1 text-sm bg-zinc-50 border border-zinc-200 rounded dark:bg-zinc-950 dark:border-zinc-700 outline-none" /></div>
                           <div className="flex flex-col gap-1"><span className="text-[10px] text-zinc-500">Temp</span><input name="llm_temperature" type="number" step="0.1" defaultValue={step.llm_temperature || ''} className="p-1 text-sm bg-zinc-50 border border-zinc-200 rounded dark:bg-zinc-950 dark:border-zinc-700 outline-none" /></div>
                           <div className="flex flex-col gap-1"><span className="text-[10px] text-zinc-500">Input Type</span><input name="llm_input_type_id" type="number" defaultValue={step.llm_input_type_id} className="p-1 text-sm bg-zinc-50 border border-zinc-200 rounded dark:bg-zinc-950 dark:border-zinc-700 outline-none" /></div>
                           <div className="flex flex-col gap-1"><span className="text-[10px] text-zinc-500">Output Type</span><input name="llm_output_type_id" type="number" defaultValue={step.llm_output_type_id} className="p-1 text-sm bg-zinc-50 border border-zinc-200 rounded dark:bg-zinc-950 dark:border-zinc-700 outline-none" /></div>
                           <div className="flex flex-col gap-1 col-span-2"><span className="text-[10px] text-zinc-500">Step Type ID</span><input name="humor_flavor_step_type_id" type="number" defaultValue={step.humor_flavor_step_type_id} className="p-1 text-sm bg-zinc-50 border border-zinc-200 rounded dark:bg-zinc-950 dark:border-zinc-700 outline-none" /></div>
                        </div>
                        <div className="col-span-12 lg:col-span-6 flex flex-col gap-3">
                           <div className="flex flex-col gap-1"><span className="text-[10px] text-zinc-500">System Prompt</span><textarea name="llm_system_prompt" defaultValue={step.llm_system_prompt || ''} rows={2} className="p-1 text-xs bg-zinc-50 border border-zinc-200 rounded font-mono resize-none dark:bg-zinc-950 dark:border-zinc-700 outline-none" /></div>
                           <div className="flex flex-col gap-1"><span className="text-[10px] text-zinc-500">User Prompt</span><textarea name="llm_user_prompt" defaultValue={step.llm_user_prompt || ''} rows={2} className="p-1 text-xs bg-zinc-50 border border-zinc-200 rounded font-mono resize-none dark:bg-zinc-950 dark:border-zinc-700 outline-none" /></div>
                        </div>
                        <div className="col-span-12 lg:col-span-1 flex flex-col justify-end gap-2">
                           <button type="submit" className="text-[10px] font-bold text-indigo-600 bg-indigo-50 py-1.5 rounded border border-indigo-100 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-400 w-full">Save</button>
                           <button formAction={deleteHumorFlavorStepAction} className="text-[10px] font-bold text-red-600 bg-red-50 py-1.5 rounded border border-red-100 hover:bg-red-100 dark:bg-red-900/30 dark:border-red-900/50 dark:text-red-400 w-full">Delete</button>
                        </div>
                      </form>
                    </div>
                  ))}
                  {steps.length === 0 && <p className="text-center text-zinc-500 py-8 border rounded-xl border-dashed border-zinc-300 dark:border-zinc-800">No steps defined for this flavor.</p>}
                </div>
              </>
            ) : (
              <div className="flex h-48 items-center justify-center border-2 border-dashed border-zinc-200 rounded-xl dark:border-zinc-800">
                <p className="text-zinc-400">Select a flavor above to load its steps.</p>
              </div>
            )}
          </>
        )}

        {/* =========================================
            TAB: READ CAPTIONS 
            ========================================= */}
        {activeTab === "captions" && (
          <>
            <div className="mb-6 flex justify-between items-end">
              <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Flavor Outputs</h1>
                <p className="text-zinc-500 text-sm">Review the most recent captions generated by a specific humor flavor.</p>
              </div>
              <form method="GET" action="/" className="flex items-center gap-2">
                <input type="hidden" name="tab" value="captions" />
                <select 
                  name="flavor_id" 
                  defaultValue={selectedFlavorId || ""}
                  className="px-4 py-2 border border-zinc-300 rounded-md bg-white text-sm dark:bg-zinc-900 dark:border-zinc-700 dark:text-white outline-none"
                >
                  <option value="" disabled>-- Select a Flavor --</option>
                  {flavors.map(f => <option key={f.id} value={f.id}>{f.slug}</option>)}
                </select>
                <button type="submit" className="px-3 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-sm font-semibold rounded-md border border-zinc-300 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-700 transition-colors">
                  Load
                </button>
              </form>
            </div>

            {selectedFlavorId ? (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 {captions.length > 0 ? captions.map(cap => (
                   <div key={cap.id} className="p-4 border border-zinc-200 bg-white rounded-xl shadow-sm flex flex-col gap-2 dark:bg-zinc-900 dark:border-zinc-800">
                      <p className="text-sm font-medium leading-relaxed">"{cap.content}"</p>
                      <span className="text-[10px] text-zinc-400 mt-auto pt-2 border-t border-zinc-100 dark:border-zinc-800">
                        Generated: {new Date(cap.created_datetime_utc).toLocaleString('en-US')}
                      </span>
                   </div>
                 )) : (
                   <p className="col-span-full text-center text-zinc-500 py-12">No captions found for this flavor.</p>
                 )}
               </div>
            ) : (
               <div className="flex h-48 items-center justify-center border-2 border-dashed border-zinc-200 rounded-xl dark:border-zinc-800">
                  <p className="text-zinc-400">Select a flavor above to read its generated captions.</p>
               </div>
            )}
          </>
        )}

        {/* =========================================
            TAB: TEST API 
            ========================================= */}
        {activeTab === "test" && (
          <div className="max-w-xl mx-auto w-full flex flex-col gap-6">
            <div className="flex flex-col gap-2 text-center mb-4">
              <h1 className="text-3xl font-bold tracking-tight">Test REST API</h1>
              <p className="text-zinc-500 text-sm">Send a manual request to your caption generation endpoint.</p>
            </div>

            <div className="p-6 rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <form action={testHumorFlavorAction} className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold">Select Humor Flavor</label>
                  <select 
                    name="flavor_id" 
                    required 
                    defaultValue={params.flavor_id || ""}
                    className="px-3 py-2 border border-zinc-300 rounded-md bg-transparent dark:border-zinc-700 outline-none focus:ring-2 focus:ring-indigo-500/50"
                  >
                    <option value="" disabled>-- Select a Flavor --</option>
                    {flavors.map(f => <option key={f.id} value={f.id}>{f.slug}</option>)}
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold">Upload Image</label>
                  <input 
                    name="image_file" 
                    type="file" 
                    accept="image/jpeg, image/jpg, image/png, image/webp, image/gif, image/heic"
                    required 
                    className="px-3 py-2 border border-zinc-300 rounded-md bg-transparent dark:border-zinc-700 outline-none focus:ring-2 focus:ring-indigo-500/50 file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200 dark:file:bg-zinc-800 dark:file:text-zinc-300" 
                  />
                </div>

                <button type="submit" className="mt-2 w-full py-2.5 bg-indigo-600 text-white font-bold rounded-md hover:bg-indigo-700 transition-colors">
                  Generate Caption Pipeline
                </button>
              </form>
            </div>

            {/* Display Results or Errors */}
            {params.test_result && (
              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-900/50">
                <h3 className="text-xs font-bold text-emerald-700 dark:text-emerald-500 mb-2 uppercase tracking-wide">API Response:</h3>
                <pre className="text-xs text-emerald-900 dark:text-emerald-100 font-medium whitespace-pre-wrap overflow-x-auto">
                  {decodeURIComponent(params.test_result)}
                </pre>
              </div>
            )}

            {params.test_error && (
              <div className="p-4 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900/50">
                <h3 className="text-xs font-bold text-red-700 dark:text-red-500 mb-2 uppercase tracking-wide">Request Failed:</h3>
                <p className="text-sm text-red-900 dark:text-red-100 font-medium">
                  {decodeURIComponent(params.test_error)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* =========================================
            TAB: FLAVOR TEST
            ========================================= */}
        {activeTab === "flavor-test" && (
          <div className="w-full flex flex-col gap-8">
            <div className="flex flex-col gap-2">
              <h1 className="text-3xl font-bold tracking-tight">Flavor Test</h1>
              <p className="text-zinc-500 text-sm">Pick a humor flavor, upload an image, and run the full caption pipeline.</p>
            </div>

            {/* Step 1: Flavor Picker */}
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500">1 — Choose a Flavor</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {flavors.map(f => {
                  const isSelected = ftFlavorId === f.id;
                  return (
                    <Link
                      key={f.id}
                      href={`/?tab=flavor-test&ft_flavor_id=${f.id}`}
                      className={`flex flex-col gap-1.5 p-4 rounded-xl border transition-all cursor-pointer
                        ${isSelected
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 dark:border-indigo-500 shadow-sm ring-2 ring-indigo-500/30'
                          : 'border-zinc-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/50 dark:bg-zinc-900 dark:border-zinc-800 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/20'
                        }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-sm font-semibold font-mono truncate ${isSelected ? 'text-indigo-700 dark:text-indigo-400' : 'text-zinc-800 dark:text-zinc-200'}`}>
                          {f.slug}
                        </span>
                        {isSelected && (
                          <span className="shrink-0 w-4 h-4 rounded-full bg-indigo-600 flex items-center justify-center">
                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </span>
                        )}
                      </div>
                      {f.description && (
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">{f.description}</p>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Upload + Submit — only shown once a flavor is selected */}
            {ftFlavorId ? (
              <div className="flex flex-col gap-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500">2 — Upload Image &amp; Generate</h2>
                <div className="p-6 rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 max-w-lg">
                  <form action={testFlavorAction} className="flex flex-col gap-5">
                    <input type="hidden" name="ft_flavor_id" value={ftFlavorId} />
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-semibold">Image File</label>
                      <input
                        name="ft_image_file"
                        type="file"
                        accept="image/jpeg, image/jpg, image/png, image/webp, image/gif, image/heic"
                        required
                        className="px-3 py-2 border border-zinc-300 rounded-md bg-transparent dark:border-zinc-700 outline-none focus:ring-2 focus:ring-indigo-500/50 file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200 dark:file:bg-zinc-800 dark:file:text-zinc-300"
                      />
                    </div>
                    <button type="submit" className="w-full py-2.5 bg-indigo-600 text-white font-bold rounded-md hover:bg-indigo-700 transition-colors">
                      Run Pipeline →
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <div className="flex h-32 items-center justify-center border-2 border-dashed border-zinc-200 rounded-xl dark:border-zinc-800">
                <p className="text-zinc-400 text-sm">Select a flavor above to continue.</p>
              </div>
            )}

            {/* Results — one card per pipeline step showing image + caption */}
            {params.ft_result && (() => {
              let imageUrl = '';
              let captions: string[] = [];
              try {
                const parsed = JSON.parse(decodeURIComponent(params.ft_result));
                imageUrl = parsed.imageUrl ?? '';
                captions = Array.isArray(parsed.captions) ? parsed.captions : [];
              } catch { captions = [decodeURIComponent(params.ft_result)]; }
              return (
                <div className="flex flex-col gap-4">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500">3 — Results</h2>
                  <div className="flex flex-col gap-6">
                    {captions.map((caption, i) => (
                      <div key={i} className="flex flex-col sm:flex-row gap-4 p-5 rounded-xl border border-zinc-200 bg-white shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                        {/* Image */}
                        {imageUrl && (
                          <div className="shrink-0 sm:w-48">
                            <img
                              src={imageUrl}
                              alt="Submitted image"
                              className="w-full sm:w-48 h-40 object-cover rounded-lg border border-zinc-200 dark:border-zinc-700"
                            />
                          </div>
                        )}
                        {/* Caption */}
                        <div className="flex flex-col gap-2 justify-center flex-1">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-500">Step {i + 1}</span>
                          <p className="text-base font-medium leading-relaxed text-zinc-800 dark:text-zinc-100">"{caption}"</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {params.ft_error && (
              <div className="flex flex-col gap-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500">3 — Results</h2>
                <div className="p-4 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900/50">
                  <h3 className="text-xs font-bold text-red-700 dark:text-red-500 mb-2 uppercase tracking-wide">Request Failed:</h3>
                  <p className="text-sm text-red-900 dark:text-red-100 font-medium">
                    {decodeURIComponent(params.ft_error)}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}