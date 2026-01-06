'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface Subject {
  id: string
  name: string
  icon: string
  levels: Array<{ id: string; name: string; sortOrder: number }>
}

interface LessonSection {
  heading: string
  content: string
  examples?: string[]
}

interface Lesson {
  title: string
  introduction: string
  sections: LessonSection[]
  keyTakeaways: string[]
  practicePrompts: string[]
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export default function LearnPage() {
  const params = useParams()
  const subjectId = params.id as string
  const chatEndRef = useRef<HTMLDivElement>(null)

  const [subject, setSubject] = useState<Subject | null>(null)
  const [selectedLevelId, setSelectedLevelId] = useState('')
  const [topic, setTopic] = useState('')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [error, setError] = useState('')

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

  useEffect(() => {
    async function fetchSubject() {
      try {
        const res = await fetch(`/api/subjects/${subjectId}`)
        const data = await res.json()
        setSubject(data.subject)
        if (data.subject?.levels?.length > 0) {
          const middleIndex = Math.floor(data.subject.levels.length / 2)
          setSelectedLevelId(data.subject.levels[middleIndex].id)
        }
      } catch {
        setError('Failed to load subject')
      } finally {
        setLoading(false)
      }
    }
    fetchSubject()
  }, [subjectId])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function generateLesson() {
    if (!selectedLevelId) return
    setGenerating(true)
    setError('')
    setLesson(null)
    setMessages([])

    const levelName = subject?.levels.find(l => l.id === selectedLevelId)?.name

    try {
      const res = await fetch('/api/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject?.name,
          level: levelName,
          topic: topic || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate lesson')
      }

      setLesson(data.lesson)

      // Add initial assistant message
      setMessages([
        {
          role: 'assistant',
          content: `I've prepared a lesson on "${data.lesson.title}" for you. Feel free to ask me any questions about the material, or we can discuss the practice prompts together!`,
        },
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate lesson')
    } finally {
      setGenerating(false)
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!chatInput.trim() || chatLoading) return

    const userMessage: ChatMessage = { role: 'user', content: chatInput.trim() }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setChatInput('')
    setChatLoading(true)

    const levelName = subject?.levels.find(l => l.id === selectedLevelId)?.name

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          subject: subject?.name,
          level: levelName,
          topic: lesson?.title || topic || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to get response')
      }

      setMessages([...newMessages, data.message])
    } catch (err) {
      setMessages([
        ...newMessages,
        { role: 'assistant', content: 'Sorry, I had trouble responding. Please try again.' },
      ])
    } finally {
      setChatLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!subject) {
    return <div className="text-center py-12 text-gray-600">Subject not found</div>
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="text-3xl">{subject.icon}</span>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Learn {subject.name}</h1>
            <p className="text-gray-600">Generate a lesson and chat with your AI tutor</p>
          </div>
        </div>
        <Link
          href={`/subjects/${subjectId}`}
          className="text-gray-600 hover:text-gray-900"
        >
          Back to {subject.name}
        </Link>
      </div>

      {/* Lesson Setup */}
      {!lesson && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Generate a Lesson</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Level
              </label>
              <select
                value={selectedLevelId}
                onChange={(e) => setSelectedLevelId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {subject.levels.map((level) => (
                  <option key={level.id} value={level.id}>
                    {level.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Topic (optional)
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., Fractions, Photosynthesis, Civil War..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-sm text-gray-500 mt-1">
                Leave blank for a general lesson at the selected level
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <button
              onClick={generateLesson}
              disabled={generating || !selectedLevelId}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {generating ? 'Generating Lesson...' : 'Generate Lesson'}
            </button>
          </div>
        </div>
      )}

      {/* Generated Lesson */}
      {lesson && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-xl font-bold text-gray-900">{lesson.title}</h2>
            <button
              onClick={() => {
                setLesson(null)
                setMessages([])
              }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              New Lesson
            </button>
          </div>

          <p className="text-gray-700 mb-6">{lesson.introduction}</p>

          {/* Sections */}
          <div className="space-y-6">
            {lesson.sections.map((section, idx) => (
              <div key={idx} className="border-l-4 border-blue-500 pl-4">
                <h3 className="font-semibold text-gray-900 mb-2">{section.heading}</h3>
                <p className="text-gray-700 mb-2">{section.content}</p>
                {section.examples && section.examples.length > 0 && (
                  <div className="bg-gray-50 rounded p-3 mt-2">
                    <p className="text-sm font-medium text-gray-600 mb-1">Examples:</p>
                    <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                      {section.examples.map((ex, i) => (
                        <li key={i}>{ex}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Key Takeaways */}
          <div className="mt-6 bg-green-50 rounded-lg p-4">
            <h3 className="font-semibold text-green-900 mb-2">Key Takeaways</h3>
            <ul className="space-y-1">
              {lesson.keyTakeaways.map((takeaway, idx) => (
                <li key={idx} className="flex items-start space-x-2">
                  <span className="text-green-600">*</span>
                  <span className="text-green-800">{takeaway}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Practice Prompts */}
          <div className="mt-4 bg-blue-50 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Practice Prompts</h3>
            <ul className="space-y-1">
              {lesson.practicePrompts.map((prompt, idx) => (
                <li key={idx} className="text-blue-800">
                  {idx + 1}. {prompt}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Chat Interface */}
      {lesson && (
        <div className="bg-white rounded-lg shadow">
          <div className="border-b px-6 py-4">
            <h2 className="font-semibold text-gray-900">Chat with Your Tutor</h2>
            <p className="text-sm text-gray-600">
              Ask questions about the lesson or discuss the practice prompts
            </p>
          </div>

          {/* Messages */}
          <div className="h-80 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg px-4 py-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={sendMessage} className="border-t p-4">
            <div className="flex space-x-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask a question about the lesson..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={chatLoading}
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || chatLoading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
