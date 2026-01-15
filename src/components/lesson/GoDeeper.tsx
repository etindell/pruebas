'use client'

import { useState } from 'react'

interface GoDeepHistory {
  id: string
  userPrompt: string
  aiResponse: string
  isRelevant: boolean
  createdAt: string
}

interface GoDeeperProps {
  lessonId: string
  themeColor?: string
}

export default function GoDeeper({ lessonId, themeColor = '#2563eb' }: GoDeeperProps) {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<{
    isRelevant: boolean
    response: string
  } | null>(null)
  const [history, setHistory] = useState<GoDeepHistory[]>([])
  const [showHistory, setShowHistory] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim() || loading) return

    setLoading(true)
    setResponse(null)

    try {
      const res = await fetch(`/api/lessons/${lessonId}/go-deeper`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
      })

      if (res.ok) {
        const data = await res.json()
        setResponse(data)
        setPrompt('')

        // Add to history
        setHistory(prev => [{
          id: Date.now().toString(),
          userPrompt: prompt.trim(),
          aiResponse: data.response,
          isRelevant: data.isRelevant,
          createdAt: new Date().toISOString(),
        }, ...prev])
      }
    } catch (error) {
      console.error('Go deeper error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-gray-50 rounded-lg p-6">
      <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
        <svg className="w-5 h-5 mr-2" style={{ color: themeColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Go Deeper
      </h3>

      <p className="text-sm text-gray-600 mb-4">
        Want to understand something better? Ask a question about this lesson.
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask a question about this lesson..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent resize-none"
            style={{ '--tw-ring-color': themeColor } as React.CSSProperties}
            rows={2}
            maxLength={500}
            disabled={loading}
          />
          <span className="absolute bottom-2 right-2 text-xs text-gray-400">
            {prompt.length}/500
          </span>
        </div>

        <button
          type="submit"
          disabled={!prompt.trim() || loading}
          className="px-4 py-2 rounded-lg text-white font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: themeColor }}
        >
          {loading ? (
            <span className="flex items-center">
              <svg className="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Thinking...
            </span>
          ) : (
            'Ask'
          )}
        </button>
      </form>

      {/* Response */}
      {response && (
        <div className={`mt-4 p-4 rounded-lg ${response.isRelevant ? 'bg-white border border-gray-200' : 'bg-orange-50 border border-orange-200'}`}>
          {!response.isRelevant && (
            <div className="flex items-center text-orange-600 text-sm font-medium mb-2">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Let's stay focused
            </div>
          )}
          <p className="text-gray-700 whitespace-pre-wrap">{response.response}</p>
        </div>
      )}

      {/* History Toggle */}
      {history.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-sm text-gray-600 hover:text-gray-900 flex items-center"
          >
            <svg
              className={`w-4 h-4 mr-1 transition-transform ${showHistory ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Previous questions ({history.length})
          </button>

          {showHistory && (
            <div className="mt-2 space-y-3">
              {history.slice(0, 5).map((item) => (
                <div key={item.id} className="bg-white rounded-lg p-3 border border-gray-200">
                  <p className="text-sm font-medium text-gray-900 mb-1">Q: {item.userPrompt}</p>
                  <p className="text-sm text-gray-600">{item.aiResponse.substring(0, 200)}...</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
