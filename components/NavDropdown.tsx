// components/NavDropdown.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react' // Optional: install lucide-react

export default function NavDropdown({ currentView }: { currentView: string }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="relative inline-block text-left" onMouseEnter={() => setIsOpen(true)} onMouseLeave={() => setIsOpen(false)}>
      <button 
        className={`flex items-center gap-1 py-1 text-sm font-semibold transition-colors ${
          currentView === 'profiles' ? "text-indigo-600" : "text-zinc-500 hover:text-zinc-900"
        }`}
      >
        Users
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-0 w-48 origin-top-left rounded-md border border-zinc-200 bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950">
          <div className="py-1">
            <Link
              href="/?view=profiles"
              className="block px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              User Directory
            </Link>
            <Link
              href="/admin/users/stats" // Example of another user-related page
              className="block px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              User Analytics
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}