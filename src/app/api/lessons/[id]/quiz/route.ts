import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { generateLessonQuiz } from '@/lib/lesson-quiz-generator'

// Generate quiz questions for a lesson
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: lessonId } = await params

    // Get lesson with context
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        subtopic: {
          include: {
            level: {
              include: {
                subject: true,
              },
            },
          },
        },
      },
    })

    if (!lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
    }

    // Parse lesson content
    const content = JSON.parse(lesson.content)
    const keyTakeaways = JSON.parse(lesson.keyTakeaways)

    // Generate quiz questions
    const questions = await generateLessonQuiz({
      lessonTitle: lesson.title,
      lessonIntroduction: lesson.introduction,
      lessonContent: content,
      keyTakeaways,
      subtopicName: lesson.subtopic.name,
      levelName: lesson.subtopic.level.name,
      subjectName: lesson.subtopic.level.subject.name,
      questionCount: 5,
    })

    return NextResponse.json({ questions })
  } catch (error) {
    console.error('Generate lesson quiz error:', error)
    return NextResponse.json(
      { error: 'Failed to generate quiz' },
      { status: 500 }
    )
  }
}

// Submit quiz answers
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: lessonId } = await params
    const body = await request.json()
    const { answers, questions } = body

    if (!answers || !questions) {
      return NextResponse.json(
        { error: 'Missing answers or questions' },
        { status: 400 }
      )
    }

    // Calculate score
    let correct = 0
    const results = questions.map((q: { id: string; correctAnswer: string; explanation: string }, index: number) => {
      const userAnswer = answers[q.id]
      const isCorrect = userAnswer === q.correctAnswer
      if (isCorrect) correct++
      return {
        questionId: q.id,
        userAnswer,
        correctAnswer: q.correctAnswer,
        isCorrect,
        explanation: q.explanation,
      }
    })

    const score = Math.round((correct / questions.length) * 100)

    // Update lesson progress
    await prisma.lessonProgress.upsert({
      where: {
        userId_lessonId: {
          userId: session.userId,
          lessonId,
        },
      },
      update: {
        completed: true,
        quizScore: score,
        completedAt: new Date(),
      },
      create: {
        userId: session.userId,
        lessonId,
        completed: true,
        quizScore: score,
        completedAt: new Date(),
      },
    })

    return NextResponse.json({
      score,
      correct,
      total: questions.length,
      results,
    })
  } catch (error) {
    console.error('Submit lesson quiz error:', error)
    return NextResponse.json(
      { error: 'Failed to submit quiz' },
      { status: 500 }
    )
  }
}
