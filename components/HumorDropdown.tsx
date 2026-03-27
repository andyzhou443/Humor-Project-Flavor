// components/HumorDropdown.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, Sparkles, ListOrdered, Blend } from 'lucide-react'

export default function HumorDropdown({ currentView }: { currentView: string }) {
  const [isOpen, setIsOpen] = useState(false)
  
  const isActive = currentView === 'humor_flavors' || currentView === 'humor_steps' || currentView === 'humor_mix';

  return (
    <div 
      className="relative" 
      onMouseEnter={() => setIsOpen(true)} 
      onMouseLeave={() => setIsOpen(false)}
    >
      <button 
        className={`flex items-center gap-1.5 transition-colors ${
          isActive ? "text-indigo-600" : "hover:text-zinc-900 dark:hover:text-zinc-300"
        }`}
      >
        Humor Stuff
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full pt-2 w-56 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            <div className="p-1">
              <Link
                href="/?view=humor_flavors"
                className="flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 hover:text-indigo-600 dark:text-zinc-300 dark:hover:bg-zinc-900"
                onClick={() => setIsOpen(false)}
              >
                <Sparkles className="w-4 h-4" />
                Humor Flavors
              </Link>
              <Link
                href="/?view=humor_steps"
                className="flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 hover:text-indigo-600 dark:text-zinc-300 dark:hover:bg-zinc-900"
                onClick={() => setIsOpen(false)}
              >
                <ListOrdered className="w-4 h-4" />
                Flavor Steps
              </Link>
              <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
              <Link
                href="/?view=humor_mix"
                className="flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 hover:text-indigo-600 dark:text-zinc-300 dark:hover:bg-zinc-900"
                onClick={() => setIsOpen(false)}
              >
                <Blend className="w-4 h-4" />
                Humor Mix
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}