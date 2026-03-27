// components/CaptionsDropdown.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, MessageSquareText, FileUser, Lightbulb } from 'lucide-react'

export default function CaptionsDropdown({ currentView }: { currentView: string }) {
  const [isOpen, setIsOpen] = useState(false)
  
  const isActive = currentView === 'captions' || currentView === 'caption_requests' || currentView === 'caption_examples';

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
        Captions
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full pt-2 w-52 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            <div className="p-1">
              <Link
                href="/?view=captions"
                className="flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 hover:text-indigo-600 dark:text-zinc-300 dark:hover:bg-zinc-900"
                onClick={() => setIsOpen(false)}
              >
                <MessageSquareText className="w-4 h-4" />
                Edit Captions
              </Link>
              <Link
                href="/?view=caption_examples"
                className="flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 hover:text-indigo-600 dark:text-zinc-300 dark:hover:bg-zinc-900"
                onClick={() => setIsOpen(false)}
              >
                <Lightbulb className="w-4 h-4" />
                Caption Examples
              </Link>
              <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
              <Link
                href="/?view=caption_requests"
                className="flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 hover:text-indigo-600 dark:text-zinc-300 dark:hover:bg-zinc-900"
                onClick={() => setIsOpen(false)}
              >
                <FileUser className="w-4 h-4" />
                Caption Requests
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}