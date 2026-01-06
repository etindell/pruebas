'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface Level {
  id: string
  name: string
  sortOrder: number
}

interface Subject {
  id: string
  name: string
  icon: string
  levels: Level[]
}

interface UserLevel {
  currentLevel: { id: string; name: string } | null
  suggestedLevel: { id: string; name: string } | null
  lastAssessedAt: string | null
}

interface Quiz {
  id: string
  category: {
    topicName: string
    level: { name: string }
  }
  questionCount: number
  _count: { attempts: number }
}

export default function SubjectPage() {
  const params = useParams()
  const subjectId = params.id as string
  const [subject, setSubject] = useState<Subject | null>(null)
  const [userLevel, setUserLevel] = useState<UserLevel | null>(null)
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [loading, setLoading] = useState(true)
  const [changingLevel, setChangingLevel] = useState(false)
  const [selectedLevelId, setSelectedLevelId] = useState('')

  useEffect(() => {
    async function fetchData() {
      try {
        const [subjectRes, quizzesRes, statsRes] = await Promise.all([
          fetch(`/api/subjects/${subjectId}`),
          fetch(`/api/quizzes?subjectId=${subjectId}&limit=20`),
          fetch('/api/stats'),
        ])

        const subjectData = await subjectRes.json()
        const quizzesData = await quizzesRes.json()
        const statsData = await statsRes.json()

        setSubject(subjectData.subject)
        setQuizzes(quizzesData.quizzes)

        const subjectStat = statsData.subjectStats?.find(
          (s: { subject: { id: string } }) => s.subject.id === subjectId
        )
        if (subjectStat) {
          setUserLevel({
            currentLevel: subjectStat.currentLevel,
            suggestedLevel: subjectStat.suggestedLevel,
            lastAssessedAt: null,
          })
          setSelectedLevelId(subjectStat.currentLevel?.id || '')
        }
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [subjectId])

  async function updateLevel() {
    if (!selectedLevelId) return
    setChangingLevel(true)

    try {
      const res = await fetch(`/api/users/me/subjects/${subjectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ levelId: selectedLevelId }),
      })

      if (res.ok) {
        const data = await res.json()
        setUserLevel({
          currentLevel: data.userSubjectLevel.currentLevel,
          suggestedLevel: data.userSubjectLevel.suggestedLevel,
          lastAssessedAt: data.userSubjectLevel.lastAssessedAt,
        })
      }
    } catch (error) {
      console.error('Failed to update level:', error)
    } finally {
      setChangingLevel(false)
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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <span className="text-4xl">{subject.icon}</span>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{subject.name}</h1>
          <p className="text-gray-600">
            {subject.levels.length} levels available
          </p>
        </div>
      </div>

      {/* Level Selection */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Level</h2>
        <div className="flex flex-wrap items-center gap-4">
          <select
            value={selectedLevelId}
            onChange={(e) => setSelectedLevelId(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md"
          >
            <option value="">Select a level</option>
            {subject.levels.map((level) => (
              <option key={level.id} value={level.id}>
                {level.name}
              </option>
            ))}
          </select>

          {selectedLevelId !== (userLevel?.currentLevel?.id || '') && (
            <button
              onClick={updateLevel}
              disabled={changingLevel}
              className="px-4 py-2 bg-blue-600 text-white rounded-md disabled:opacity-50"
            >
              {changingLevel ? 'Saving...' : 'Set Level'}
            </button>
          )}

          <Link
            href={`/subjects/${subjectId}/assess`}
            className="px-4 py-2 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-50"
          >
            Take Assessment
          </Link>
        </div>

        {userLevel?.suggestedLevel &&
          userLevel.suggestedLevel.id !== userLevel.currentLevel?.id && (
            <p className="mt-3 text-sm text-blue-600">
              Assessment suggests: {userLevel.suggestedLevel.name}
            </p>
          )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          href={`/subjects/${subjectId}/learn`}
          className="bg-green-600 text-white py-3 px-4 rounded-lg text-center hover:bg-green-700"
        >
          Generate Lesson
        </Link>
        <Link
          href={`/quiz/create?subjectId=${subjectId}${selectedLevelId ? `&levelId=${selectedLevelId}` : ''}`}
          className="bg-blue-600 text-white py-3 px-4 rounded-lg text-center hover:bg-blue-700"
        >
          Create Quiz
        </Link>
        <Link
          href={`/browse?subjectId=${subjectId}`}
          className="border border-gray-300 py-3 px-4 rounded-lg text-center hover:bg-gray-50"
        >
          Browse Quizzes
        </Link>
      </div>

      {/* Recent Quizzes */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Quizzes</h2>
        {quizzes.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6 text-center text-gray-600">
            No quizzes yet.{' '}
            <Link
              href={`/quiz/create?subjectId=${subjectId}`}
              className="text-blue-600 hover:underline"
            >
              Create the first one!
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quizzes.map((quiz) => (
              <Link
                key={quiz.id}
                href={`/quiz/${quiz.id}`}
                className="bg-white rounded-lg shadow p-4 hover:shadow-md transition"
              >
                <h3 className="font-medium text-gray-900">{quiz.category.topicName}</h3>
                <div className="flex justify-between text-sm text-gray-600 mt-2">
                  <span>{quiz.category.level.name}</span>
                  <span>{quiz.questionCount} questions</span>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {quiz._count.attempts} taken
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
