import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { generateAdaptiveAssessment } from '@/lib/assessment-generator'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: subjectId } = await params

    const assessments = await prisma.assessment.findMany({
      where: {
        userId: session.userId,
        subjectId,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        suggestedLevel: true,
      },
    })

    return NextResponse.json({ assessments })
  } catch (error) {
    console.error('Get assessments error:', error)
    return NextResponse.json({ error: 'Failed to get assessments' }, { status: 500 })
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

    const { id: subjectId } = await params
    
    // Get optional starting level from request body
    let startingLevelId: string | null = null
    try {
      const body = await request.json()
      startingLevelId = body.startingLevelId || null
    } catch {
      // No body or invalid JSON, use default
    }

    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
      include: {
        levels: { orderBy: { sortOrder: 'asc' } },
      },
    })

    if (!subject) {
      return NextResponse.json({ error: 'Subject not found' }, { status: 404 })
    }

    // Generate adaptive assessment question pool
    const pool = await generateAdaptiveAssessment(
      subject.name,
      subject.levels.map((l) => ({ id: l.id, name: l.name, sortOrder: l.sortOrder }))
    )

    // Determine starting level index
    let startingLevelIndex = Math.floor(subject.levels.length / 2) // Default to middle
    if (startingLevelId) {
      const idx = subject.levels.findIndex((l) => l.id === startingLevelId)
      if (idx !== -1) {
        startingLevelIndex = idx
      }
    }

    // Create assessment with pool data
    const assessment = await prisma.assessment.create({
      data: {
        userId: session.userId,
        subjectId,
        questions: JSON.stringify({
          type: 'adaptive',
          questionsByLevel: pool.questionsByLevel,
          startingLevelId: subject.levels[startingLevelIndex].id,
          startingLevelIndex,
        }),
      },
    })

    return NextResponse.json({
      assessment,
      questionsByLevel: pool.questionsByLevel,
      levels: subject.levels.map((l) => ({ id: l.id, name: l.name, sortOrder: l.sortOrder })),
      startingLevelIndex,
      startingLevelId: subject.levels[startingLevelIndex].id,
    })
  } catch (error) {
    console.error('Create assessment error:', error)
    return NextResponse.json({ error: 'Failed to create assessment' }, { status: 500 })
  }
}
