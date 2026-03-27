'use client'
import { createImage, updateImage } from "./actions";

export default function ImageForm({ initialData }: { initialData?: any }) {
  const action = initialData 
    ? updateImage.bind(null, initialData.id) 
    : createImage;

  return (
    <form action={action} className="space-y-6 max-w-2xl bg-white p-8 rounded-xl border border-zinc-200">
      <div className="space-y-2">
        <label className="text-sm font-semibold">Image URL</label>
        <input name="url" defaultValue={initialData?.url} className="w-full p-2 border rounded-md text-sm" placeholder="https://..." required />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold">Description</label>
        <textarea name="image_description" defaultValue={initialData?.image_description} className="w-full p-2 border rounded-md text-sm" rows={3} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center gap-2">
          <input type="checkbox" name="is_public" defaultChecked={initialData?.is_public} id="is_public" />
          <label htmlFor="is_public" className="text-sm">Make Public</label>
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" name="is_common_use" defaultChecked={initialData?.is_common_use} id="is_common" />
          <label htmlFor="is_common" className="text-sm">Common Use</label>
        </div>
      </div>

      <div className="flex gap-4 pt-4">
        <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-bold">
          {initialData ? 'Update Image' : 'Save Image'}
        </button>
      </div>
    </form>
  );
}