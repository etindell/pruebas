import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { hashQuestion } from '@/lib/question-hash'

interface Answer {
  question_id: string
  selected_answer: string
  is_correct: boolean
}

interface Question {
  id: string
  question: string
  correct_answer: string
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const attempts = await prisma.attempt.findMany({
      where: {
        quizId: id,
        userId: session.userId,
      },
      orderBy: { completedAt: 'desc' },
    })

    // Check if any attempt is complete (all questions answered)
    const hasCompleteAttempt = attempts.some((a) => {
      const attemptAnswers = JSON.parse(a.answers) as { answers: Answer[] }
      const answeredCount = attemptAnswers.answers.filter(
        (ans) => ans.selected_answer && ans.selected_answer.trim() !== ''
      ).length
      return answeredCount === a.totalQuestions
    })

    return NextResponse.json({ attempts, hasCompleteAttempt })
  } catch (error) {
    console.error('Get attempts error:', error)
    return NextResponse.json({ error: 'Failed to get attempts' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.userId
    const { id } = await params
    const { answers, timeTakenSeconds, timezone } = await request.json()

    // Get the quiz with subtopic info
    const quiz = await prisma.quiz.findUnique({
      where: { id },
      include: { subtopic: true },
    })

    if (!quiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 })
    }

    // Parse questions and calculate score
    const questionsData = JSON.parse(quiz.questions) as { questions: Question[] }
    const questions = questionsData.questions

    let score = 0
    let answeredCount = 0
    const processedAnswers: Answer[] = answers.map((answer: { question_id: string; selected_answer: string }) => {
      const question = questions.find((q) => q.id === answer.question_id)
      const hasAnswer = answer.selected_answer && answer.selected_answer.trim() !== ''
      if (hasAnswer) answeredCount++
      const isCorrect = hasAnswer && question?.correct_answer === answer.selected_answer
      if (isCorrect) score++
      return {
        question_id: answer.question_id,
        selected_answer: answer.selected_answer,
        is_correct: isCorrect,
      }
    })

    const isComplete = answeredCount === questions.length

    // Check for existing COMPLETE attempts (all questions answered)
    // An attempt is "complete" if answeredCount equals totalQuestions
    const existingAttempts = await prisma.attempt.findMany({
      where: {
        quizId: id,
        userId,
      },
      orderBy: { completedAt: 'asc' },
    })

    // Find the first complete attempt (one where all questions were answered)
    const firstCompleteAttempt = existingAttempts.find((a) => {
      const attemptAnswers = JSON.parse(a.answers) as { answers: Answer[] }
      const attemptAnsweredCount = attemptAnswers.answers.filter(
        (ans) => ans.selected_answer && ans.selected_answer.trim() !== ''
      ).length
      return attemptAnsweredCount === a.totalQuestions
    })

    // This is the "scoring first attempt" if no complete attempt exists yet
    const isScoringFirstAttempt = !firstCompleteAttempt

    // If this would be the scoring first attempt, require all questions to be answered
    if (isScoringFirstAttempt && !isComplete) {
      return NextResponse.json(
        {
          error: 'All questions must be answered on your first attempt',
          answeredCount,
          totalQuestions: questions.length,
        },
        { status: 400 }
      )
    }

    // isFirstAttempt for stats purposes = this is the first COMPLETE attempt
    const isFirstAttempt = isScoringFirstAttempt && isComplete

    // Create the attempt
    const attempt = await prisma.attempt.create({
      data: {
        userId,
        quizId: id,
        isFirstAttempt,
        score,
        totalQuestions: questions.length,
        answers: JSON.stringify({ answers: processedAnswers }),
        timeTakenSeconds: timeTakenSeconds || null,
      },
    })

    // If this quiz is linked to a subtopic, record SubtopicQuestion entries for progress tracking
    if (quiz.subtopicId) {
      // Parse quiz data to get difficulty level
      const quizData = JSON.parse(quiz.questions) as { questions: Question[]; difficultyLevel?: number }
      const difficultyLevel = quizData.difficultyLevel || 1

      const subtopicQuestions = processedAnswers.map((answer) => {
        // Find the question to get its text
        const question = questions.find((q) => q.id === answer.question_id)
        const questionText = question?.question || ''
        const questionHash = questionText ? hashQuestion(questionText) : null

        return {
          subtopicId: quiz.subtopicId!,
          userId,
          questionId: answer.question_id,
          quizId: id,
          isCorrect: answer.is_correct,
          questionText,
          questionHash,
          difficultyLevel,
        }
      })

      await prisma.subtopicQuestion.createMany({
        data: subtopicQuestions,
      })
    }

    // Update streak if first attempt
    if (isFirstAttempt) {
      await updateStreak(userId, timezone || 'UTC')
    }

    return NextResponse.json({ attempt, score, totalQuestions: questions.length })
  } catch (error) {
    console.error('Submit attempt error:', error)
    return NextResponse.json({ error: 'Failed to submit attempt' }, { status: 500 })
  }
}

async function updateStreak(userId: string, timezone: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastQuizDate: true, currentStreak: true, longestStreak: true },
  })

  if (!user) return

  // Get today's date in user's timezone
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const todayStr = formatter.format(now)
  const today = new Date(todayStr + 'T00:00:00Z')

  let newStreak = 1

  if (user.lastQuizDate) {
    const lastDateStr = formatter.format(user.lastQuizDate)
    const lastDate = new Date(lastDateStr + 'T00:00:00Z')

    const diffDays = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      // Same day, no streak change
      return
    } else if (diffDays === 1) {
      // Consecutive day
      newStreak = user.currentStreak + 1
    }
    // Otherwise, reset to 1
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      currentStreak: newStreak,
      longestStreak: Math.max(newStreak, user.longestStreak),
      lastQuizDate: today,
    },
  })
}
