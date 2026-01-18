import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'

/**
 * Calculate difficulty level based on questions answered (1-4)
 */
function calculateDifficultyLevel(questionsAnswered: number): number {
  return Math.min(4, Math.floor(questionsAnswered / 10) + 1)
}

/**
 * Calculate test number based on questions answered (1-4, then "practice")
 */
function calculateTestNumber(questionsAnswered: number): number | 'practice' {
  if (questionsAnswered >= 40) return 'practice'
  return Math.floor(questionsAnswered / 10) + 1
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

    const { id: subtopicId } = await params

    // Get subtopic with lessons
    const subtopic = await prisma.subtopic.findUnique({
      where: { id: subtopicId },
      include: {
        lessons: true,
        level: {
          include: {
            subject: true,
          },
        },
      },
    })

    if (!subtopic) {
      return NextResponse.json({ error: 'Subtopic not found' }, { status: 404 })
    }

    // Count completed lessons
    const completedLessons = await prisma.lessonProgress.count({
      where: {
        userId: session.userId,
        lessonId: { in: subtopic.lessons.map(l => l.id) },
        completed: true,
      },
    })

    const lessonsTotal = subtopic.lessons.length
    const allLessonsCompleted = lessonsTotal === 0 || completedLessons >= lessonsTotal

    // Count questions answered for this subtopic
    const questionsAnswered = await prisma.subtopicQuestion.count({
      where: {
        userId: session.userId,
        subtopicId,
      },
    })

    // Calculate trailing-40 score if applicable
    let trailing40Score = 0
    if (questionsAnswered > 0) {
      const last40 = await prisma.subtopicQuestion.findMany({
        where: {
          userId: session.userId,
          subtopicId,
        },
        orderBy: { answeredAt: 'desc' },
        take: 40,
        select: { isCorrect: true },
      })

      const correct = last40.filter(q => q.isCorrect).length
      trailing40Score = Math.round((correct / last40.length) * 100)
    }

    const difficultyLevel = calculateDifficultyLevel(questionsAnswered)
    const testNumber = calculateTestNumber(questionsAnswered)
    const questionsUntilPass = Math.max(0, 40 - questionsAnswered)
    const passed = questionsAnswered >= 40 && trailing40Score > 90

    return NextResponse.json({
      eligible: allLessonsCompleted,
      lessonsCompleted: completedLessons,
      lessonsTotal,
      questionsAnswered,
      testNumber,
      difficultyLevel,
      questionsUntilPass,
      trailing40Score,
      passed,
      subtopic: {
        id: subtopic.id,
        name: subtopic.name,
        levelName: subtopic.level.name,
        subjectName: subtopic.level.subject.name,
      },
    })
  } catch (error) {
    console.error('Get test eligibility error:', error)
    return NextResponse.json({ error: 'Failed to get test eligibility' }, { status: 500 })
  }
}
