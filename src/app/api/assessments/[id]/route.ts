import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'

interface AdaptiveAnswer {
  question_id: string
  selected_answer: string
  is_correct: boolean
  level_id: string
  level_name: string
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

    const assessment = await prisma.assessment.findUnique({
      where: { id },
      include: {
        subject: true,
        suggestedLevel: true,
      },
    })

    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 })
    }

    if (assessment.userId !== session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    return NextResponse.json({ assessment })
  } catch (error) {
    console.error('Get assessment error:', error)
    return NextResponse.json({ error: 'Failed to get assessment' }, { status: 500 })
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

    const { id } = await params
    const body = await request.json()
    
    const assessment = await prisma.assessment.findUnique({
      where: { id },
      include: {
        subject: {
          include: {
            levels: { orderBy: { sortOrder: 'asc' } },
          },
        },
      },
    })

    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 })
    }

    if (assessment.userId !== session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (assessment.completedAt) {
      return NextResponse.json({ error: 'Assessment already completed' }, { status: 400 })
    }

    // Handle adaptive assessment format
    const { answers, finalLevelId, startingLevelId } = body as {
      answers: AdaptiveAnswer[]
      finalLevelId: string
      startingLevelId: string
    }

    // Calculate per-level stats from the adaptive answers
    const levelStats: Record<string, { correct: number; total: number; level_name: string }> = {}
    
    for (const answer of answers) {
      if (!levelStats[answer.level_id]) {
        levelStats[answer.level_id] = { correct: 0, total: 0, level_name: answer.level_name }
      }
      levelStats[answer.level_id].total++
      if (answer.is_correct) {
        levelStats[answer.level_id].correct++
      }
    }

    const scores = Object.entries(levelStats).map(([level_id, stats]) => ({
      level_id,
      level_name: stats.level_name,
      correct: stats.correct,
      total: stats.total,
    }))

    // For adaptive assessment, suggested level is the final level
    const suggestedLevelId = finalLevelId

    // Update assessment
    const updatedAssessment = await prisma.assessment.update({
      where: { id },
      data: {
        answers: JSON.stringify({
          type: 'adaptive',
          answers,
          startingLevelId,
          finalLevelId,
        }),
        scoreByLevel: JSON.stringify({ scores }),
        suggestedLevelId,
        completedAt: new Date(),
      },
      include: {
        suggestedLevel: true,
      },
    })

    // Update user subject level
    if (suggestedLevelId) {
      await prisma.userSubjectLevel.upsert({
        where: {
          userId_subjectId: {
            userId: session.userId,
            subjectId: assessment.subjectId,
          },
        },
        update: {
          suggestedLevelId,
          lastAssessedAt: new Date(),
        },
        create: {
          userId: session.userId,
          subjectId: assessment.subjectId,
          currentLevelId: suggestedLevelId,
          suggestedLevelId,
          lastAssessedAt: new Date(),
        },
      })
    }

    // Find starting and final level names
    const startingLevel = assessment.subject.levels.find((l) => l.id === startingLevelId)
    const finalLevel = assessment.subject.levels.find((l) => l.id === finalLevelId)

    return NextResponse.json({
      assessment: updatedAssessment,
      scores,
      suggestedLevel: updatedAssessment.suggestedLevel,
      startingLevel: startingLevel ? { id: startingLevel.id, name: startingLevel.name } : null,
      finalLevel: finalLevel ? { id: finalLevel.id, name: finalLevel.name } : null,
    })
  } catch (error) {
    console.error('Submit assessment error:', error)
    return NextResponse.json({ error: 'Failed to submit assessment' }, { status: 500 })
  }
}
