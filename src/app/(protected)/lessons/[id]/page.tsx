'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSubject } from '@/contexts/SubjectContext'
import { getSubjectTheme } from '@/config/subject-themes'
import LessonQuiz from '@/components/lesson/LessonQuiz'
import GoDeeper from '@/components/lesson/GoDeeper'

interface LessonSection {
  heading: string
  content: string
  examples?: string[]
}

interface LessonData {
  lesson: {
    id: string
    title: string
    introduction: string
    content: { sections: LessonSection[] }
    keyTakeaways: string[]
    sortOrder: number
    totalLessons: number
  }
  subtopic: {
    id: string
    name: string
  }
  level: {
    id: string
    name: string
  }
  subject: {
    id: string
    name: string
    icon: string
  }
  progress: {
    completed: boolean
    quizScore: number | null
    completedAt: string | null
  } | null
  navigation: {
    previousLessonId: string | null
    nextLessonId: string | null
  }
}

export default function LessonDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { currentSubject } = useSubject()
  const [data, setData] = useState<LessonData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showQuiz, setShowQuiz] = useState(false)
  const [quizCompleted, setQuizCompleted] = useState(false)

  const theme = currentSubject ? getSubjectTheme(currentSubject.name) : null

  useEffect(() => {
    async function fetchLesson() {
      try {
        const res = await fetch(`/api/lessons/${params.id}`)
        if (res.ok) {
          const result = await res.json()
          setData(result)
          setQuizCompleted(result.progress?.completed ?? false)
        }
      } catch (error) {
        console.error('Failed to fetch lesson:', error)
      } finally {
        setLoading(false)
      }
    }

    if (params.id) {
      fetchLesson()
    }
  }, [params.id])

  const handleQuizComplete = (score: number) => {
    setQuizCompleted(true)
    setData(prev => prev ? {
      ...prev,
      progress: {
        completed: true,
        quizScore: score,
        completedAt: new Date().toISOString(),
      }
    } : null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-gray-600">
        Failed to load lesson
      </div>
    )
  }

  const { lesson, subtopic, navigation } = data

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href={`/subtopics/${subtopic.id}/lessons`}
          className="text-sm text-gray-600 hover:text-gray-900 flex items-center"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Lessons
        </Link>
        <span className="text-sm text-gray-600">
          Lesson {lesson.sortOrder} of {lesson.totalLessons}
        </span>
      </div>

      {/* Lesson Content */}
      <article className="bg-white rounded-lg shadow overflow-hidden">
        {/* Header */}
        <div
          className="p-6 text-white"
          style={{ backgroundColor: theme?.primary || '#2563eb' }}
        >
          <p className="text-sm opacity-80 mb-1">{subtopic.name}</p>
          <h1 className="text-2xl font-bold">{lesson.title}</h1>
        </div>

        {/* Introduction */}
        <div className="p-6 border-b border-gray-100">
          <p className="text-gray-700 text-lg leading-relaxed">{lesson.introduction}</p>
        </div>

        {/* Sections */}
        <div className="p-6 space-y-8">
          {lesson.content.sections.map((section, index) => (
            <section key={index}>
              <h2
                className="text-xl font-semibold mb-3"
                style={{ color: theme?.primary || '#2563eb' }}
              >
                {section.heading}
              </h2>
              <div className="prose prose-gray max-w-none">
                <p className="text-gray-700 whitespace-pre-wrap">{section.content}</p>
              </div>
              {section.examples && section.examples.length > 0 && (
                <div className="mt-4 bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Examples:</h3>
                  <ul className="space-y-2">
                    {section.examples.map((example, i) => (
                      <li key={i} className="flex items-start">
                        <span
                          className="mr-2 mt-1"
                          style={{ color: theme?.primary || '#2563eb' }}
                        >
                          •
                        </span>
                        <span className="text-gray-700">{example}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          ))}
        </div>

        {/* Key Takeaways */}
        <div className="p-6 bg-gray-50 border-t border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Key Takeaways</h2>
          <ul className="space-y-2">
            {lesson.keyTakeaways.map((takeaway, index) => (
              <li key={index} className="flex items-start">
                <svg
                  className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0"
                  style={{ color: theme?.primary || '#22c55e' }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-700">{takeaway}</span>
              </li>
            ))}
          </ul>
        </div>
      </article>

      {/* Go Deeper Section */}
      <GoDeeper lessonId={lesson.id} themeColor={theme?.primary} />

      {/* Quiz Section */}
      {showQuiz || quizCompleted ? (
        <LessonQuiz
          lessonId={lesson.id}
          onComplete={handleQuizComplete}
          themeColor={theme?.primary}
        />
      ) : (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">Ready to test your knowledge?</h3>
              <p className="text-sm text-gray-600">Take a quick 5-question quiz on this lesson</p>
            </div>
            <button
              onClick={() => setShowQuiz(true)}
              className="px-4 py-2 rounded-lg text-white font-medium transition"
              style={{ backgroundColor: theme?.primary || '#2563eb' }}
            >
              Take Quiz
            </button>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between items-center pt-4">
        {navigation.previousLessonId ? (
          <button
            onClick={() => router.push(`/lessons/${navigation.previousLessonId}`)}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Previous Lesson
          </button>
        ) : (
          <div />
        )}

        {navigation.nextLessonId ? (
          <button
            onClick={() => router.push(`/lessons/${navigation.nextLessonId}`)}
            className="flex items-center px-4 py-2 rounded-lg text-white font-medium transition"
            style={{ backgroundColor: theme?.primary || '#2563eb' }}
          >
            Next Lesson
            <svg className="w-5 h-5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <Link
            href={`/subtopics/${subtopic.id}/lessons`}
            className="flex items-center px-4 py-2 rounded-lg text-white font-medium transition"
            style={{ backgroundColor: theme?.primary || '#22c55e' }}
          >
            Complete Topic
            <svg className="w-5 h-5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </Link>
        )}
      </div>
    </div>
  )
}
