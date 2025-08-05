"use client"

import dynamic from 'next/dynamic'

// Dynamically import the client component with no SSR to prevent hydration issues
const GameClient = dynamic(() => import('@/components/GameClient'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    </div>
  )
})

export default function Home() {
  return <GameClient />
}
