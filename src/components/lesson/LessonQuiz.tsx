'use client'

import { useState } from 'react'

interface Question {
  id: string
  question: string
  options: string[]
  correctAnswer: string
  explanation: string
}

interface QuizResult {
  questionId: string
  userAnswer: string
  correctAnswer: string
  isCorrect: boolean
  explanation: string
}

interface LessonQuizProps {
  lessonId: string
  onComplete: (score: number) => void
  themeColor?: string
}

export default function LessonQuiz({ lessonId, onComplete, themeColor = '#2563eb' }: LessonQuizProps) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [results, setResults] = useState<{
    score: number
    correct: number
    total: number
    results: QuizResult[]
  } | null>(null)

  const generateQuiz = async () => {
    setGenerating(true)
    try {
      const res = await fetch(`/api/lessons/${lessonId}/quiz`, {
        method: 'POST',
      })
      if (res.ok) {
        const data = await res.json()
        setQuestions(data.questions)
      }
    } catch (error) {
      console.error('Failed to generate quiz:', error)
    } finally {
      setGenerating(false)
    }
  }

  const handleAnswer = (answer: string) => {
    if (submitted) return
    setAnswers({ ...answers, [questions[currentIndex].id]: answer })
  }

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/lessons/${lessonId}/quiz`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers, questions }),
      })
      if (res.ok) {
        const data = await res.json()
        setResults(data)
        setSubmitted(true)
        onComplete(data.score)
      }
    } catch (error) {
      console.error('Failed to submit quiz:', error)
    } finally {
      setLoading(false)
    }
  }

  // Initial state - show start button
  if (questions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Ready for a quick quiz?</h3>
        <p className="text-gray-600 mb-4">
          Test your understanding with 5 questions about this lesson.
        </p>
        <button
          onClick={generateQuiz}
          disabled={generating}
          className="px-6 py-3 rounded-lg text-white font-medium transition disabled:opacity-50"
          style={{ backgroundColor: themeColor }}
        >
          {generating ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Generating Quiz...
            </span>
          ) : (
            'Take Quiz'
          )}
        </button>
      </div>
    )
  }

  // Results view
  if (submitted && results) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center mb-6">
          <div
            className={`text-5xl font-bold mb-2 ${
              results.score >= 80 ? 'text-green-600' : results.score >= 60 ? 'text-yellow-600' : 'text-red-600'
            }`}
          >
            {results.score}%
          </div>
          <p className="text-gray-600">
            You got {results.correct} out of {results.total} correct
          </p>
        </div>

        <div className="space-y-4">
          {results.results.map((result, index) => (
            <div
              key={result.questionId}
              className={`p-4 rounded-lg border ${
                result.isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
              }`}
            >
              <p className="font-medium text-gray-900 mb-2">
                {index + 1}. {questions[index].question}
              </p>
              <p className={`text-sm ${result.isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                Your answer: {result.userAnswer || 'No answer'}
              </p>
              {!result.isCorrect && (
                <p className="text-sm text-green-700">Correct: {result.correctAnswer}</p>
              )}
              <p className="text-sm text-gray-600 mt-2">{result.explanation}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Quiz in progress
  const currentQuestion = questions[currentIndex]
  const currentAnswer = answers[currentQuestion.id]
  const allAnswered = Object.keys(answers).length === questions.length

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {/* Progress */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-gray-600">
          Question {currentIndex + 1} of {questions.length}
        </span>
        <div className="flex space-x-1">
          {questions.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full ${
                answers[questions[i].id]
                  ? 'bg-green-500'
                  : i === currentIndex
                  ? 'bg-blue-500'
                  : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Question */}
      <h3 className="text-lg font-medium text-gray-900 mb-4">{currentQuestion.question}</h3>

      {/* Options */}
      <div className="space-y-3 mb-6">
        {currentQuestion.options.map((option, i) => (
          <button
            key={i}
            onClick={() => handleAnswer(option)}
            className={`w-full text-left p-4 rounded-lg border-2 transition ${
              currentAnswer === option
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <span className="font-medium mr-2">{String.fromCharCode(65 + i)}.</span>
            {option}
          </button>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={handlePrevious}
          disabled={currentIndex === 0}
          className="px-4 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>

        {currentIndex < questions.length - 1 ? (
          <button
            onClick={handleNext}
            className="px-4 py-2 rounded-lg text-white font-medium"
            style={{ backgroundColor: themeColor }}
          >
            Next
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!allAnswered || loading}
            className="px-4 py-2 rounded-lg text-white font-medium disabled:opacity-50"
            style={{ backgroundColor: themeColor }}
          >
            {loading ? 'Submitting...' : 'Submit Quiz'}
          </button>
        )}
      </div>
    </div>
  )
}
