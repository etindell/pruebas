'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Stats {
  streak: {
    current: number
    longest: number
    lastQuizDate: string | null
  }
  overall: {
    totalQuizzes: number
    totalQuestions: number
    overallAccuracy: number
    quizzesThisWeek: number
  }
  recentActivity: Array<{
    id: string
    quizId: string
    topic: string
    subject: string
    level: string
    score: number
    totalQuestions: number
    completedAt: string
    isFirstAttempt: boolean
  }>
  subjectStats: Array<{
    subject: { id: string; name: string; icon: string }
    currentLevel: { id: string; name: string } | null
    suggestedLevel: { id: string; name: string } | null
    quizzesCompleted: number
    accuracy: number
  }>
}

interface LevelProgress {
  progress: {
    total: number
    passed: number
    percent: number
  }
  subtopics: Array<{
    id: string
    name: string
    score: number
    passed: boolean
  }>
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [levelProgress, setLevelProgress] = useState<Record<string, LevelProgress>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/stats')
        const data = await res.json()
        setStats(data)

        // Fetch level progress for each subject with a level set
        const progressPromises = data.subjectStats
          .filter((s: { currentLevel: { id: string } | null }) => s.currentLevel?.id)
          .map(async (s: { subject: { id: string }; currentLevel: { id: string } }) => {
            try {
              const progressRes = await fetch(`/api/levels/${s.currentLevel.id}/progress`)
              if (progressRes.ok) {
                const progressData = await progressRes.json()
                return { subjectId: s.subject.id, progress: progressData }
              }
            } catch {
              console.error(`Failed to fetch progress for subject ${s.subject.id}`)
            }
            return null
          })

        const progressResults = await Promise.all(progressPromises)
        const progressMap: Record<string, LevelProgress> = {}
        progressResults.forEach((result) => {
          if (result) {
            progressMap[result.subjectId] = result.progress
          }
        })
        setLevelProgress(progressMap)
      } catch (error) {
        console.error('Failed to fetch stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!stats) {
    return <div className="text-center py-12 text-gray-600">Failed to load stats</div>
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <Link
          href="/quiz/create"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          Create Quiz
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-3xl font-bold text-orange-600">{stats.streak.current}</div>
          <div className="text-sm text-gray-600">Day Streak</div>
          <div className="text-xs text-gray-400 mt-1">Best: {stats.streak.longest}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-3xl font-bold text-blue-600">{stats.overall.totalQuizzes}</div>
          <div className="text-sm text-gray-600">Quizzes Completed</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-3xl font-bold text-green-600">{stats.overall.overallAccuracy}%</div>
          <div className="text-sm text-gray-600">Overall Accuracy</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-3xl font-bold text-purple-600">{stats.overall.quizzesThisWeek}</div>
          <div className="text-sm text-gray-600">This Week</div>
        </div>
      </div>

      {/* Subject Cards */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Subjects</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {stats.subjectStats.map((stat) => {
            const progress = levelProgress[stat.subject.id]
            const hasLevel = !!stat.currentLevel

            return (
              <div
                key={stat.subject.id}
                className="bg-white rounded-lg shadow overflow-hidden"
              >
                {/* Subject Header */}
                <div className="p-6 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-3xl">{stat.subject.icon}</span>
                      <div>
                        <h3 className="font-semibold text-lg text-gray-900">
                          {stat.subject.name}
                        </h3>
                        {hasLevel ? (
                          <p className="text-sm text-gray-600">{stat.currentLevel?.name}</p>
                        ) : (
                          <p className="text-sm text-orange-600 font-medium">No level selected</p>
                        )}
                      </div>
                    </div>
                    <Link
                      href={`/subjects/${stat.subject.id}`}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      View Details
                    </Link>
                  </div>
                </div>

                {/* Content based on whether level is set */}
                {hasLevel ? (
                  <div className="p-6">
                    {/* Level Progress */}
                    {progress && (
                      <div className="mb-4">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">Level Mastery</span>
                          <span className="font-medium text-gray-900">
                            {progress.progress.passed}/{progress.progress.total} subtopics
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div
                            className="bg-green-500 h-3 rounded-full transition-all duration-500"
                            style={{ width: `${progress.progress.percent}%` }}
                          ></div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {progress.progress.percent}% complete
                        </p>
                      </div>
                    )}

                    {/* Stats Row */}
                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">
                          {stat.quizzesCompleted}
                        </div>
                        <div className="text-xs text-gray-600">Quizzes Done</div>
                      </div>
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{stat.accuracy}%</div>
                        <div className="text-xs text-gray-600">Accuracy</div>
                      </div>
                    </div>

                    {/* Change Level Link */}
                    <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
                      <Link
                        href={`/subjects/${stat.subject.id}/assess`}
                        className="text-sm text-gray-600 hover:text-gray-900"
                      >
                        Take Assessment
                      </Link>
                      <Link
                        href={`/subjects/${stat.subject.id}`}
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        Change Level
                      </Link>
                    </div>
                  </div>
                ) : (
                  /* No Level Set - Prominent CTA */
                  <div className="p-6 bg-orange-50">
                    <p className="text-gray-700 mb-4">
                      Select a level to start tracking your progress and unlock personalized
                      quizzes.
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <Link
                        href={`/subjects/${stat.subject.id}`}
                        className="flex-1 text-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                      >
                        Select Level
                      </Link>
                      <Link
                        href={`/subjects/${stat.subject.id}/assess`}
                        className="flex-1 text-center px-4 py-3 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 font-medium"
                      >
                        Take Assessment
                      </Link>
                    </div>
                    {stat.suggestedLevel && (
                      <p className="text-sm text-blue-600 mt-3">
                        Assessment suggests: {stat.suggestedLevel.name}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Activity</h2>
        {stats.recentActivity.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6 text-center text-gray-600">
            No quizzes taken yet. Start by{' '}
            <Link href="/browse" className="text-blue-600 hover:underline">
              browsing quizzes
            </Link>{' '}
            or{' '}
            <Link href="/quiz/create" className="text-blue-600 hover:underline">
              creating your own
            </Link>
            .
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow divide-y">
            {stats.recentActivity.map((activity) => (
              <Link
                key={activity.id}
                href={`/quiz/${activity.quizId}/results/${activity.id}`}
                className="block p-4 hover:bg-gray-50"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium text-gray-900">{activity.topic}</div>
                    <div className="text-sm text-gray-600">
                      {activity.subject} - {activity.level}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-gray-900">
                      {activity.score}/{activity.totalQuestions}
                    </div>
                    <div className="text-sm text-gray-600">
                      {new Date(activity.completedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
