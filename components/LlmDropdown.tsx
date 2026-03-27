// components/LlmDropdown.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, Cpu, Network, Link2, Bot } from 'lucide-react'

export default function LlmDropdown({ currentView }: { currentView: string }) {
  const [isOpen, setIsOpen] = useState(false)
  
  const isActive = 
    currentView === 'llm_providers' || 
    currentView === 'llm_models' || 
    currentView === 'llm_prompt_chains' || 
    currentView === 'llm_model_responses';

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
        LLMs
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full pt-2 w-52 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            <div className="p-1">
              <Link
                href="/?view=llm_models"
                className="flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 hover:text-indigo-600 dark:text-zinc-300 dark:hover:bg-zinc-900"
                onClick={() => setIsOpen(false)}
              >
                <Cpu className="w-4 h-4" />
                LLM Models
              </Link>
              <Link
                href="/?view=llm_providers"
                className="flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 hover:text-indigo-600 dark:text-zinc-300 dark:hover:bg-zinc-900"
                onClick={() => setIsOpen(false)}
              >
                <Network className="w-4 h-4" />
                LLM Providers
              </Link>
              <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
              <Link
                href="/?view=llm_prompt_chains"
                className="flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 hover:text-indigo-600 dark:text-zinc-300 dark:hover:bg-zinc-900"
                onClick={() => setIsOpen(false)}
              >
                <Link2 className="w-4 h-4" />
                Prompt Chains
              </Link>
              <Link
                href="/?view=llm_model_responses"
                className="flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 hover:text-indigo-600 dark:text-zinc-300 dark:hover:bg-zinc-900"
                onClick={() => setIsOpen(false)}
              >
                <Bot className="w-4 h-4" />
                Read LLM Responses
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}