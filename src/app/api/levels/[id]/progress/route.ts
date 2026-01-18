import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'

interface SubtopicScore {
  id: string
  name: string
  score: number
  questionsAnswered: number
  passed: boolean
  totalLessons: number
  completedLessons: number
  questionsUntilPass: number
  testNumber: number | 'practice'
  difficultyLevel: number
}

// Calculate trailing 40 question score for a subtopic
async function getTrailing40Score(userId: string, subtopicId: string): Promise<{ score: number; count: number }> {
  const last40 = await prisma.subtopicQuestion.findMany({
    where: { userId, subtopicId },
    orderBy: { answeredAt: 'desc' },
    take: 40,
  })

  if (last40.length === 0) {
    return { score: 0, count: 0 }
  }

  const correct = last40.filter((q) => q.isCorrect).length
  return {
    score: Math.round((correct / last40.length) * 100),
    count: last40.length,
  }
}

// Record or update today's daily score
async function recordDailyScore(
  userId: string,
  levelId: string,
  subtopicScores: SubtopicScore[]
): Promise<void> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Calculate average score (subtopics with 0 questions count as 0%)
  const totalScore = subtopicScores.reduce((sum, s) => sum + s.score, 0)
  const avgScore = subtopicScores.length > 0 ? totalScore / subtopicScores.length : 0

  const scoresJson: Record<string, number> = {}
  subtopicScores.forEach((s) => {
    scoresJson[s.id] = s.score
  })

  await prisma.dailyLevelScore.upsert({
    where: {
      userId_levelId_date: {
        userId,
        levelId,
        date: today,
      },
    },
    update: {
      avgScore,
      subtopicScores: JSON.stringify(scoresJson),
    },
    create: {
      userId,
      levelId,
      date: today,
      avgScore,
      subtopicScores: JSON.stringify(scoresJson),
    },
  })
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

    const userId = session.userId
    const { id: levelId } = await params

    // Get level with subtopics
    const level = await prisma.level.findUnique({
      where: { id: levelId },
      include: {
        subject: true,
        subtopics: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    })

    if (!level) {
      return NextResponse.json({ error: 'Level not found' }, { status: 404 })
    }

    // Calculate trailing-40 scores and lesson progress for each subtopic
    const subtopicScores: SubtopicScore[] = await Promise.all(
      level.subtopics.map(async (subtopic) => {
        // Get total questions answered for this subtopic (not just last 40)
        const totalQuestionsAnswered = await prisma.subtopicQuestion.count({
          where: { userId, subtopicId: subtopic.id },
        })

        const { score } = await getTrailing40Score(userId, subtopic.id)

        // Get lesson counts
        const totalLessons = await prisma.lesson.count({
          where: { subtopicId: subtopic.id },
        })

        const completedLessons = await prisma.lessonProgress.count({
          where: {
            userId,
            lesson: { subtopicId: subtopic.id },
            completed: true,
          },
        })

        // Pass requires: at least 40 questions AND score > 90%
        const passed = totalQuestionsAnswered >= 40 && score > 90

        // Calculate test number and difficulty
        const questionsUntilPass = Math.max(0, 40 - totalQuestionsAnswered)
        const testNumber = totalQuestionsAnswered >= 40 ? 'practice' as const : Math.floor(totalQuestionsAnswered / 10) + 1
        const difficultyLevel = Math.min(4, Math.floor(totalQuestionsAnswered / 10) + 1)

        return {
          id: subtopic.id,
          name: subtopic.name,
          score,
          questionsAnswered: totalQuestionsAnswered,
          passed,
          totalLessons,
          completedLessons,
          questionsUntilPass,
          testNumber,
          difficultyLevel,
        }
      })
    )

    // Calculate progress stats
    const totalSubtopics = subtopicScores.length
    const passedSubtopics = subtopicScores.filter((s) => s.passed).length
    const progressPercent = totalSubtopics > 0 ? Math.round((passedSubtopics / totalSubtopics) * 100) : 0

    // Record today's daily score
    await recordDailyScore(userId, levelId, subtopicScores)

    // Get daily score history (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    thirtyDaysAgo.setHours(0, 0, 0, 0)

    const dailyHistory = await prisma.dailyLevelScore.findMany({
      where: {
        userId: userId,
        levelId,
        date: { gte: thirtyDaysAgo },
      },
      orderBy: { date: 'asc' },
      select: {
        date: true,
        avgScore: true,
      },
    })

    return NextResponse.json({
      level: {
        id: level.id,
        name: level.name,
        subject: level.subject,
      },
      subtopics: subtopicScores,
      progress: {
        total: totalSubtopics,
        passed: passedSubtopics,
        percent: progressPercent,
      },
      dailyHistory: dailyHistory.map((d) => ({
        date: d.date.toISOString().split('T')[0],
        score: Math.round(d.avgScore),
      })),
    })
  } catch (error) {
    console.error('Get level progress error:', error)
    return NextResponse.json({ error: 'Failed to get progress' }, { status: 500 })
  }
}
