'use client'

import { useState, useEffect, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Heart, X } from 'lucide-react'

type CaptionData = {
  id: string
  content: string | null
  image_id: string
  images: {
    url: string
  } | null
}

interface VotingInterfaceProps {
  initialCaptions: CaptionData[]
  userId: string
}

export default function VotingInterface({ initialCaptions, userId }: VotingInterfaceProps) {
  const [queue, setQueue] = useState<CaptionData[]>(initialCaptions)
  const [currentIndex, setCurrentIndex] = useState(0)
  
  // NEW: State to track which direction the card is animating out
  const [animatingOut, setAnimatingOut] = useState<'left' | 'right' | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const currentItem = queue[currentIndex]
  const nextItem = queue[currentIndex + 1]

// 1. Add a state for errors if you want to show a persistent banner
const [error, setError] = useState<string | null>(null);

const handleVote = useCallback(async (voteValue: number) => {
  if (!currentItem || animatingOut) return

  setAnimatingOut(voteValue === 1 ? 'right' : 'left')
  const captionIdToVote = currentItem.id

  // 2. Prepare the payload
  const votePayload = {
    profile_id: userId,
    caption_id: captionIdToVote,
    vote_value: voteValue,
    created_datetime_utc: new Date().toISOString(),
    modified_datetime_utc: new Date().toISOString(),
  }

  // 3. UI Transition
  setTimeout(() => {
    if (currentIndex < queue.length - 1) {
      setCurrentIndex((prev) => prev + 1)
    } else {
      setQueue([]) 
    }
    setAnimatingOut(null)
  }, 300)

  // 4. Robust Error Handling
  try {
    const { error: supabaseError } = await supabase
      .from('caption_votes')
      .upsert(votePayload, { onConflict: 'profile_id, caption_id' })

    if (supabaseError) throw supabaseError;

  } catch (err) {
    console.error('Vote failed:', err);
    // Use a toast library here (e.g., toast.error("Failed to save vote"))
    alert("Connection error: Your vote wasn't saved."); 
    
    // Optional: Logic to "undo" the UI change
    // setCurrentIndex(prev => prev - 1);
  }

}, [currentItem, currentIndex, queue.length, userId, supabase, animatingOut])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }
      if (e.key === 'ArrowLeft') {
        handleVote(-1)
      } else if (e.key === 'ArrowRight') {
        handleVote(1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleVote]) 

  if (!currentItem) {
    return (
      <div className="flex h-96 w-full items-center justify-center rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700">
        <p className="text-zinc-500">No more captions to vote on!</p>
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col items-center gap-6">
      
      {/* CARD CONTAINER 
        We use a fixed height (h-[34rem]) so the container doesn't collapse 
        since its children are now absolute-positioned.
      */}
      <div className="relative w-full max-w-md h-[34rem]">
        
        {/* NEXT CARD (Background) */}
        {nextItem && (
          <div className="absolute inset-0 z-0 flex flex-col overflow-hidden rounded-2xl bg-white shadow-xl border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 scale-95 opacity-50 blur-[2px] transition-all duration-300">
            <div className="relative aspect-square w-full bg-zinc-100 dark:bg-zinc-800">
              <img 
                src={nextItem.images?.url} 
                alt="Next caption" 
                className="h-full w-full object-cover"
              />
            </div>
            <div className="flex flex-1 items-center justify-center p-6 text-center">
              <p className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
                {nextItem.content || "Untitled Caption"}
              </p>
            </div>
          </div>
        )}

        {/* CURRENT CARD (Foreground) */}
        {currentItem && (
          <div 
            className={`absolute inset-0 z-10 flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 transition-all duration-300 ease-in-out
              ${animatingOut === 'left' ? '-translate-x-full rotate-[-10deg] opacity-0' : ''}
              ${animatingOut === 'right' ? 'translate-x-full rotate-[10deg] opacity-0' : ''}
              ${!animatingOut ? 'translate-x-0 rotate-0 opacity-100' : ''}
            `}
          >
            <div className="relative aspect-square w-full bg-zinc-100 dark:bg-zinc-800">
              <img 
                src={currentItem.images?.url} 
                alt="Caption target" 
                className="h-full w-full object-cover"
              />
            </div>
            <div className="flex flex-1 items-center justify-center bg-white p-6 text-center dark:bg-zinc-900">
              <p className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
                {currentItem.content || "Untitled Caption"}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-8">
        <button
          onClick={() => handleVote(-1)}
          disabled={animatingOut !== null}
          className="group flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-zinc-200 transition-all hover:scale-110 hover:bg-red-50 disabled:opacity-50 dark:bg-zinc-900 dark:ring-zinc-800 dark:hover:bg-red-950/30"
          aria-label="Dislike (Left Arrow)"
        >
          <X className="h-8 w-8 text-zinc-400 transition-colors group-hover:text-red-500" />
        </button>

        <button
          onClick={() => handleVote(1)}
          disabled={animatingOut !== null}
          className="group flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-zinc-200 transition-all hover:scale-110 hover:bg-green-50 disabled:opacity-50 dark:bg-zinc-900 dark:ring-zinc-800 dark:hover:bg-green-950/30"
          aria-label="Like (Right Arrow)"
        >
          <Heart className="h-8 w-8 fill-transparent text-zinc-400 transition-colors group-hover:fill-green-500 group-hover:text-green-500" />
        </button>
      </div>

      <p className="text-xs text-zinc-400 dark:text-zinc-500">
        Tip: You can use your ← and → arrow keys to vote.
      </p>
    </div>
  )
}