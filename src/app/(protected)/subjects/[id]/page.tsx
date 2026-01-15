'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
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

interface SubtopicScore {
  id: string
  name: string
  score: number
  questionsAnswered: number
  passed: boolean
  totalLessons: number
  completedLessons: number
}

interface Progress {
  total: number
  passed: number
  percent: number
}

interface DailyScore {
  date: string
  score: number
}

interface LevelProgress {
  level: { id: string; name: string; subject: { id: string; name: string } }
  subtopics: SubtopicScore[]
  progress: Progress
  dailyHistory: DailyScore[]
}

export default function SubjectPage() {
  const params = useParams()
  const router = useRouter()
  const subjectId = params.id as string
  const [subject, setSubject] = useState<Subject | null>(null)
  const [userLevel, setUserLevel] = useState<UserLevel | null>(null)
  const [levelProgress, setLevelProgress] = useState<LevelProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [changingLevel, setChangingLevel] = useState(false)
  const [selectedLevelId, setSelectedLevelId] = useState('')
  const [creatingQuiz, setCreatingQuiz] = useState<string | null>(null)
  const [customTopic, setCustomTopic] = useState('')
  const [customQuestionCount, setCustomQuestionCount] = useState(10)
  const [creatingCustomQuiz, setCreatingCustomQuiz] = useState(false)

  useEffect(() => {
    async function fetchData() {
      try {
        const [subjectRes, statsRes] = await Promise.all([
          fetch(`/api/subjects/${subjectId}`),
          fetch('/api/stats'),
        ])

        const subjectData = await subjectRes.json()
        const statsData = await statsRes.json()

        setSubject(subjectData.subject)

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

          // Fetch progress for current level
          if (subjectStat.currentLevel?.id) {
            fetchLevelProgress(subjectStat.currentLevel.id)
          }
        }
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [subjectId])

  async function fetchLevelProgress(levelId: string) {
    try {
      const res = await fetch(`/api/levels/${levelId}/progress`)
      if (res.ok) {
        const data = await res.json()
        setLevelProgress(data)
      }
    } catch (error) {
      console.error('Failed to fetch level progress:', error)
    }
  }

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
        // Fetch progress for new level
        fetchLevelProgress(selectedLevelId)
      }
    } catch (error) {
      console.error('Failed to update level:', error)
    } finally {
      setChangingLevel(false)
    }
  }

  async function startSubtopicQuiz(subtopicId: string) {
    setCreatingQuiz(subtopicId)
    try {
      const res = await fetch('/api/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subtopicId,
          questionCount: 10,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        router.push(`/quiz/${data.quiz.id}/take`)
      }
    } catch (error) {
      console.error('Failed to create quiz:', error)
    } finally {
      setCreatingQuiz(null)
    }
  }

  async function createCustomQuiz() {
    if (!customTopic.trim() || !selectedLevelId) return
    setCreatingCustomQuiz(true)

    try {
      const res = await fetch('/api/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectId,
          levelId: selectedLevelId,
          topicName: customTopic,
          questionCount: customQuestionCount,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        router.push(`/quiz/${data.quiz.id}/take`)
      }
    } catch (error) {
      console.error('Failed to create custom quiz:', error)
    } finally {
      setCreatingCustomQuiz(false)
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

  // Calculate max score for chart scaling
  const maxChartScore = levelProgress?.dailyHistory.length
    ? Math.max(...levelProgress.dailyHistory.map((d) => d.score), 100)
    : 100

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <span className="text-4xl">{subject.icon}</span>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{subject.name}</h1>
          <p className="text-gray-600">{subject.levels.length} levels available</p>
        </div>
      </div>

      {/* Level Selection - Prominent when no level set */}
      {!userLevel?.currentLevel ? (
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg shadow-lg p-8 text-white">
          <h2 className="text-2xl font-bold mb-2">Get Started with {subject.name}</h2>
          <p className="text-blue-100 mb-6">
            Select your level to unlock personalized quizzes and track your progress through
            subtopics.
          </p>

          <div className="bg-white/10 rounded-lg p-6 mb-6">
            <label className="block text-sm font-medium text-blue-100 mb-2">
              Choose Your Level
            </label>
            <div className="flex flex-wrap gap-3">
              <select
                value={selectedLevelId}
                onChange={(e) => {
                  setSelectedLevelId(e.target.value)
                  if (e.target.value) {
                    fetchLevelProgress(e.target.value)
                  }
                }}
                className="flex-1 min-w-[200px] px-4 py-3 border-0 rounded-lg text-gray-900 text-lg"
              >
                <option value="">Select a level...</option>
                {subject.levels.map((level) => (
                  <option key={level.id} value={level.id}>
                    {level.name}
                  </option>
                ))}
              </select>

              {selectedLevelId && (
                <button
                  onClick={updateLevel}
                  disabled={changingLevel}
                  className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 font-medium text-lg"
                >
                  {changingLevel ? 'Saving...' : 'Start Learning'}
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-4 items-center">
            <span className="text-blue-100">Not sure which level?</span>
            <Link
              href={`/subjects/${subjectId}/assess`}
              className="px-4 py-2 bg-white text-blue-600 rounded-lg hover:bg-blue-50 font-medium"
            >
              Take Assessment
            </Link>
          </div>

          {userLevel?.suggestedLevel && (
            <p className="mt-4 text-green-300 font-medium">
              Assessment suggests: {userLevel.suggestedLevel.name}
            </p>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Current Level</h2>
              <p className="text-2xl font-bold text-blue-600">{userLevel.currentLevel.name}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedLevelId}
                onChange={(e) => {
                  setSelectedLevelId(e.target.value)
                  if (e.target.value) {
                    fetchLevelProgress(e.target.value)
                  }
                }}
                className="px-4 py-2 border border-gray-300 rounded-md"
              >
                {subject.levels.map((level) => (
                  <option key={level.id} value={level.id}>
                    {level.name}
                  </option>
                ))}
              </select>

              {selectedLevelId !== userLevel.currentLevel.id && selectedLevelId && (
                <button
                  onClick={updateLevel}
                  disabled={changingLevel}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {changingLevel ? 'Saving...' : 'Change Level'}
                </button>
              )}

              <Link
                href={`/subjects/${subjectId}/assess`}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                Retake Assessment
              </Link>
            </div>
          </div>

          {userLevel?.suggestedLevel &&
            userLevel.suggestedLevel.id !== userLevel.currentLevel?.id && (
              <p className="mt-3 text-sm text-blue-600 bg-blue-50 px-3 py-2 rounded">
                Assessment suggests: {userLevel.suggestedLevel.name}
              </p>
            )}
        </div>
      )}

      {/* Level Mastery Progress */}
      {levelProgress && levelProgress.subtopics.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Level Mastery</h2>
          <div className="mb-2">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>
                {levelProgress.progress.passed} of {levelProgress.progress.total} subtopics
                passed
              </span>
              <span>{levelProgress.progress.percent}% complete</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className="bg-green-500 h-4 rounded-full transition-all duration-500"
                style={{ width: `${levelProgress.progress.percent}%` }}
              ></div>
            </div>
          </div>
          <p className="text-xs text-gray-500">Pass a subtopic by scoring &gt;90% on your last 40 questions</p>
        </div>
      )}

      {/* Progress Over Time Chart */}
      {levelProgress && levelProgress.dailyHistory.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Progress Over Time</h2>
          <div className="h-40 flex items-end space-x-1">
            {levelProgress.dailyHistory.map((day, i) => (
              <div key={day.date} className="flex-1 flex flex-col items-center">
                <div
                  className="w-full bg-blue-500 rounded-t transition-all duration-300"
                  style={{ height: `${(day.score / maxChartScore) * 100}%`, minHeight: '2px' }}
                  title={`${day.date}: ${day.score}%`}
                ></div>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>{levelProgress.dailyHistory[0]?.date}</span>
            <span>{levelProgress.dailyHistory[levelProgress.dailyHistory.length - 1]?.date}</span>
          </div>
          <p className="text-xs text-gray-500 text-center mt-1">Daily average score</p>
        </div>
      )}

      {/* Subtopics */}
      {levelProgress && levelProgress.subtopics.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Subtopics</h2>
          <div className="space-y-3">
            {levelProgress.subtopics.map((subtopic) => (
              <div
                key={subtopic.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <span className={subtopic.passed ? 'text-green-500' : 'text-gray-300'}>
                    {subtopic.passed ? (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 100-12 6 6 0 000 12z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </span>
                  <span className="font-medium text-gray-900 truncate">{subtopic.name}</span>
                </div>

                <div className="flex items-center space-x-4">
                  {/* Lesson Progress */}
                  {subtopic.totalLessons > 0 && (
                    <div className="text-xs text-gray-500 w-16 text-center">
                      <span className={subtopic.completedLessons === subtopic.totalLessons ? 'text-green-600 font-medium' : ''}>
                        {subtopic.completedLessons}/{subtopic.totalLessons}
                      </span>
                      <br />lessons
                    </div>
                  )}

                  {/* Quiz Score */}
                  <div className="w-24 flex items-center space-x-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          subtopic.passed
                            ? 'bg-green-500'
                            : subtopic.score >= 70
                            ? 'bg-yellow-500'
                            : 'bg-gray-400'
                        }`}
                        style={{ width: `${subtopic.score}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium text-gray-700 w-10 text-right">
                      {subtopic.score}%
                    </span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center space-x-2">
                    {subtopic.totalLessons > 0 && (
                      <Link
                        href={`/subtopics/${subtopic.id}/lessons`}
                        className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                      >
                        Learn
                      </Link>
                    )}
                    <button
                      onClick={() => startSubtopicQuiz(subtopic.id)}
                      disabled={creatingQuiz === subtopic.id}
                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      {creatingQuiz === subtopic.id ? '...' : 'Quiz'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No subtopics message */}
      {levelProgress && levelProgress.subtopics.length === 0 && (
        <div className="bg-white rounded-lg shadow p-6 text-center text-gray-600">
          No subtopics defined for this level yet.
        </div>
      )}

      {/* Custom Quiz Section */}
      {selectedLevelId && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Custom Quiz</h2>
          <p className="text-sm text-gray-500 mb-4">
            Create a quiz with any topic. Custom quizzes won&apos;t count toward subtopic progress.
          </p>
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
              placeholder="Enter any topic..."
              className="flex-1 min-w-[200px] px-4 py-2 border border-gray-300 rounded-md"
            />
            <select
              value={customQuestionCount}
              onChange={(e) => setCustomQuestionCount(parseInt(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-md"
            >
              <option value={10}>10 questions</option>
              <option value={15}>15 questions</option>
              <option value={20}>20 questions</option>
            </select>
            <button
              onClick={createCustomQuiz}
              disabled={creatingCustomQuiz || !customTopic.trim()}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50"
            >
              {creatingCustomQuiz ? 'Creating...' : 'Create Quiz'}
            </button>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href={`/subjects/${subjectId}/learn`}
          className="bg-green-600 text-white py-3 px-4 rounded-lg text-center hover:bg-green-700"
        >
          Generate Lesson
        </Link>
        <Link
          href={`/browse?subjectId=${subjectId}`}
          className="border border-gray-300 py-3 px-4 rounded-lg text-center hover:bg-gray-50"
        >
          Browse All Quizzes
        </Link>
      </div>
    </div>
  )
}
