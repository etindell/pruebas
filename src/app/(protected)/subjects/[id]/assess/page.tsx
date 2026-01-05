'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface Question {
  id: string
  question: string
  options: string[]
  correct_answer: string
  explanation: string
  level: string
  level_id: string
}

interface Subject {
  id: string
  name: string
  icon: string
  levels: Array<{ id: string; name: string; sortOrder: number }>
}

interface LevelScore {
  level_id: string
  level_name: string
  correct: number
  total: number
}

interface AssessmentResult {
  scores: LevelScore[]
  startingLevel: string
  finalLevel: string
}

interface AdaptiveAnswer {
  question_id: string
  selected_answer: string
  is_correct: boolean
  level_id: string
  question_number: number
}

const TOTAL_QUESTIONS = 10

export default function AssessmentPage() {
  const params = useParams()
  const router = useRouter()
  const subjectId = params.id as string

  const [subject, setSubject] = useState<Subject | null>(null)
  const [assessmentId, setAssessmentId] = useState<string | null>(null)
  const [questionPool, setQuestionPool] = useState<Record<string, Question[]>>({})
  const [levels, setLevels] = useState<Array<{ id: string; name: string; sortOrder: number }>>([])
  const [currentLevelIndex, setCurrentLevelIndex] = useState(0)
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null)
  const [questionNumber, setQuestionNumber] = useState(0)
  const [usedQuestions, setUsedQuestions] = useState<Set<string>>(new Set())
  const [answers, setAnswers] = useState<AdaptiveAnswer[]>([])
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [lastDirection, setLastDirection] = useState<'up' | 'down' | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<AssessmentResult | null>(null)
  const [error, setError] = useState('')
  const [startingLevelId, setStartingLevelId] = useState<string>('')
  const [selectedStartLevel, setSelectedStartLevel] = useState<string>('')

  useEffect(() => {
    async function fetchSubject() {
      try {
        const res = await fetch('/api/subjects/' + subjectId)
        const data = await res.json()
        setSubject(data.subject)
        if (data.subject?.levels?.length > 0) {
          const middleIndex = Math.floor(data.subject.levels.length / 2)
          setSelectedStartLevel(data.subject.levels[middleIndex].id)
        }
      } catch {
        setError('Failed to load subject')
      } finally {
        setLoading(false)
      }
    }
    fetchSubject()
  }, [subjectId])

  function pickNextQuestion(pool: Record<string, Question[]>, levelIdx: number, used: Set<string>, lvls: Array<{ id: string; name: string; sortOrder: number }>): Question | null {
    const levelId = lvls[levelIdx]?.id
    if (!levelId) return null

    const available = pool[levelId]?.filter(q => !used.has(q.id))
    if (available && available.length > 0) {
      return available[0]
    }

    for (let offset = 1; offset < lvls.length; offset++) {
      const upIdx = levelIdx + offset
      const downIdx = levelIdx - offset

      if (upIdx < lvls.length) {
        const upAvailable = pool[lvls[upIdx].id]?.filter(q => !used.has(q.id))
        if (upAvailable && upAvailable.length > 0) return upAvailable[0]
      }

      if (downIdx >= 0) {
        const downAvailable = pool[lvls[downIdx].id]?.filter(q => !used.has(q.id))
        if (downAvailable && downAvailable.length > 0) return downAvailable[0]
      }
    }

    return null
  }

  async function startAssessment() {
    setGenerating(true)
    setError('')

    try {
      const res = await fetch('/api/subjects/' + subjectId + '/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startingLevelId: selectedStartLevel }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate assessment')
      }

      setAssessmentId(data.assessment.id)
      setQuestionPool(data.questionsByLevel)
      setLevels(data.levels)
      setStartingLevelId(data.startingLevelId)

      const startIdx = data.startingLevelIndex
      setCurrentLevelIndex(startIdx)

      const firstQuestion = pickNextQuestion(data.questionsByLevel, startIdx, new Set(), data.levels)
      if (firstQuestion) {
        setCurrentQuestion(firstQuestion)
        setUsedQuestions(new Set([firstQuestion.id]))
        setQuestionNumber(1)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate assessment')
    } finally {
      setGenerating(false)
    }
  }

  const submitAssessment = useCallback(async (finalAnswers: AdaptiveAnswer[], finalLevelIdx: number) => {
    if (!assessmentId || submitting) return
    setSubmitting(true)

    const finalLevelId = levels[finalLevelIdx]?.id

    try {
      const res = await fetch('/api/assessments/' + assessmentId, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: finalAnswers,
          finalLevelId,
          startingLevelId,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit assessment')
      }

      setResult({
        scores: data.scores,
        startingLevel: data.startingLevel,
        finalLevel: data.finalLevel,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit assessment')
      setSubmitting(false)
    }
  }, [assessmentId, submitting, levels, startingLevelId])

  function handleAnswer() {
    if (!currentQuestion || !selectedAnswer) return

    const isCorrect = selectedAnswer === currentQuestion.correct_answer

    const newAnswer: AdaptiveAnswer = {
      question_id: currentQuestion.id,
      selected_answer: selectedAnswer,
      is_correct: isCorrect,
      level_id: levels[currentLevelIndex].id,
      question_number: questionNumber,
    }

    const newAnswers = [...answers, newAnswer]
    setAnswers(newAnswers)

    let newLevelIndex = currentLevelIndex
    let direction: 'up' | 'down' | null = null

    if (isCorrect && currentLevelIndex < levels.length - 1) {
      newLevelIndex = currentLevelIndex + 1
      direction = 'up'
    } else if (!isCorrect && currentLevelIndex > 0) {
      newLevelIndex = currentLevelIndex - 1
      direction = 'down'
    }

    setLastDirection(direction)
    setCurrentLevelIndex(newLevelIndex)

    if (questionNumber >= TOTAL_QUESTIONS) {
      submitAssessment(newAnswers, newLevelIndex)
      return
    }

    const newUsed = new Set(usedQuestions)
    const nextQ = pickNextQuestion(questionPool, newLevelIndex, newUsed, levels)

    if (nextQ) {
      newUsed.add(nextQ.id)
      setUsedQuestions(newUsed)
      setCurrentQuestion(nextQ)
      setQuestionNumber(questionNumber + 1)
      setSelectedAnswer(null)
    } else {
      submitAssessment(newAnswers, newLevelIndex)
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

  if (result) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <span className="text-4xl">{subject.icon}</span>
          <h1 className="text-2xl font-bold text-gray-900 mt-4">Assessment Complete!</h1>

          <div className="my-8">
            <p className="text-gray-600 mb-2">Your Suggested Level</p>
            <p className="text-3xl font-bold text-blue-600">{result.finalLevel}</p>
            <p className="text-sm text-gray-500 mt-2">
              Started at {result.startingLevel} - Ended at {result.finalLevel}
            </p>
          </div>

          <div className="my-8">
            <h3 className="font-semibold text-gray-900 mb-4">Score Breakdown</h3>
            <div className="space-y-2">
              {result.scores.map((score) => {
                const percentage = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0
                return (
                  <div key={score.level_id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <span className="font-medium">{score.level_name}</span>
                    <div className="flex items-center space-x-3">
                      <span className="text-gray-600">
                        {score.correct}/{score.total}
                      </span>
                      {score.total > 0 && (
                        <span className={percentage >= 70 ? 'font-semibold text-green-600' : 'font-semibold text-gray-600'}>
                          {percentage}%
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex justify-center space-x-4">
            <button
              onClick={() => router.push('/subjects/' + subjectId)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Accept and Continue
            </button>
            <Link
              href={'/subjects/' + subjectId}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Choose Different Level
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (!assessmentId) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <span className="text-4xl">{subject.icon}</span>
          <h1 className="text-2xl font-bold text-gray-900 mt-4">{subject.name} Assessment</h1>
          <p className="text-gray-600 mt-2">
            This adaptive assessment will adjust to your skill level. Answer 10 questions
            to find your recommended starting level.
          </p>

          <div className="my-8">
            <label className="block text-gray-700 font-medium mb-3">
              Where do you think your level is?
            </label>
            <select
              value={selectedStartLevel}
              onChange={(e) => setSelectedStartLevel(e.target.value)}
              className="w-full max-w-xs px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {subject.levels.map((level) => (
                <option key={level.id} value={level.id}>
                  {level.name}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="my-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <button
            onClick={startAssessment}
            disabled={generating}
            className="mt-4 px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {generating ? 'Generating Assessment...' : 'Start Assessment'}
          </button>

          {generating && (
            <p className="mt-4 text-sm text-gray-600">
              This may take a few seconds...
            </p>
          )}

          <Link
            href={'/subjects/' + subjectId}
            className="block mt-4 text-gray-600 hover:text-gray-900"
          >
            Cancel
          </Link>
        </div>
      </div>
    )
  }

  if (!currentQuestion) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const currentLevel = levels[currentLevelIndex]

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="font-semibold text-gray-900">{subject.name} Assessment</h1>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <span>Level: {currentLevel?.name}</span>
              {lastDirection === 'up' && <span className="text-green-600 font-bold">UP</span>}
              {lastDirection === 'down' && <span className="text-red-600 font-bold">DOWN</span>}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>
              Question {questionNumber} of {TOTAL_QUESTIONS}
            </span>
            <span>{answers.filter(a => a.is_correct).length} correct</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: (questionNumber / TOTAL_QUESTIONS) * 100 + '%' }}
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-medium text-gray-900 mb-6">{currentQuestion.question}</h2>

        <div className="space-y-3">
          {currentQuestion.options.map((option, i) => (
            <button
              key={i}
              onClick={() => setSelectedAnswer(option)}
              className={'w-full text-left p-4 rounded-lg border-2 transition ' + (selectedAnswer === option ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300')}
            >
              <span className="font-medium mr-2">{String.fromCharCode(65 + i)}.</span>
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleAnswer}
          disabled={!selectedAnswer || submitting}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? 'Submitting...' : questionNumber === TOTAL_QUESTIONS ? 'Submit Assessment' : 'Next Question'}
        </button>
      </div>
    </div>
  )
}
