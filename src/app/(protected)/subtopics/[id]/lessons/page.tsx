'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSubject } from '@/contexts/SubjectContext'
import { getSubjectTheme } from '@/config/subject-themes'

interface Lesson {
  id: string
  title: string
  sortOrder: number
  completed: boolean
  quizScore: number | null
}

interface SubtopicData {
  subtopic: {
    id: string
    name: string
    levelName: string
    subjectName: string
    subjectIcon: string
  }
  lessons: Lesson[]
  totalLessons: number
  completedLessons: number
  nextLessonId: string | null
}

export default function SubtopicLessonsPage() {
  const params = useParams()
  const router = useRouter()
  const { currentSubject } = useSubject()
  const [data, setData] = useState<SubtopicData | null>(null)
  const [loading, setLoading] = useState(true)

  const theme = currentSubject ? getSubjectTheme(currentSubject.name) : null

  useEffect(() => {
    async function fetchLessons() {
      try {
        const res = await fetch(`/api/subtopics/${params.id}/lessons`)
        if (res.ok) {
          const result = await res.json()
          setData(result)
        }
      } catch (error) {
        console.error('Failed to fetch lessons:', error)
      } finally {
        setLoading(false)
      }
    }

    if (params.id) {
      fetchLessons()
    }
  }, [params.id])

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
        Failed to load lessons
      </div>
    )
  }

  const progressPercent = data.totalLessons > 0
    ? Math.round((data.completedLessons / data.totalLessons) * 100)
    : 0

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <Link
          href={`/subjects/${currentSubject?.id || ''}`}
          className="text-sm text-gray-600 hover:text-gray-900 mb-2 inline-flex items-center"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to {data.subtopic.subjectName}
        </Link>

        <div className="flex items-center space-x-3 mt-2">
          <span className="text-3xl">{data.subtopic.subjectIcon}</span>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{data.subtopic.name}</h1>
            <p className="text-gray-600">{data.subtopic.levelName}</p>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">Progress</span>
          <span className="text-sm text-gray-600">
            {data.completedLessons} of {data.totalLessons} lessons completed
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="h-3 rounded-full transition-all duration-500"
            style={{
              width: `${progressPercent}%`,
              backgroundColor: theme?.primary || '#22c55e',
            }}
          ></div>
        </div>

        {data.nextLessonId && (
          <button
            onClick={() => router.push(`/lessons/${data.nextLessonId}`)}
            className="mt-4 w-full py-3 px-4 rounded-lg text-white font-medium transition"
            style={{ backgroundColor: theme?.primary || '#2563eb' }}
          >
            {data.completedLessons === 0 ? 'Start Learning' : 'Continue Learning'}
          </button>
        )}
      </div>

      {/* Lessons List */}
      <div className="bg-white rounded-lg shadow divide-y">
        {data.lessons.map((lesson, index) => (
          <Link
            key={lesson.id}
            href={`/lessons/${lesson.id}`}
            className="flex items-center justify-between p-4 hover:bg-gray-50 transition"
          >
            <div className="flex items-center space-x-4">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  lesson.completed
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {lesson.completed ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>
              <div>
                <h3 className="font-medium text-gray-900">{lesson.title}</h3>
                <p className="text-sm text-gray-500">Lesson {lesson.sortOrder}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {lesson.quizScore !== null && (
                <span
                  className={`text-sm font-medium px-2 py-1 rounded ${
                    lesson.quizScore >= 80
                      ? 'bg-green-100 text-green-700'
                      : lesson.quizScore >= 60
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {lesson.quizScore}%
                </span>
              )}
              <svg
                className="w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        ))}

        {data.lessons.length === 0 && (
          <div className="p-8 text-center text-gray-600">
            No lessons available yet for this topic.
          </div>
        )}
      </div>
    </div>
  )
}
