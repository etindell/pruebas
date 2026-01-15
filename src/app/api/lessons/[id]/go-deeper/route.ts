import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { checkRelevance, generateDeeperExplanation } from '@/lib/relevance-checker'

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
    const body = await request.json()
    const { prompt } = body

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid prompt' },
        { status: 400 }
      )
    }

    if (prompt.length > 500) {
      return NextResponse.json(
        { error: 'Prompt too long (max 500 characters)' },
        { status: 400 }
      )
    }

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
    const keyTakeaways = JSON.parse(lesson.keyTakeaways)

    const lessonContext = {
      title: lesson.title,
      introduction: lesson.introduction,
      keyTakeaways,
      subtopicName: lesson.subtopic.name,
      levelName: lesson.subtopic.level.name,
      subjectName: lesson.subtopic.level.subject.name,
    }

    // Check relevance
    const relevanceResult = await checkRelevance(lessonContext, prompt)

    let aiResponse = ''

    if (relevanceResult.isRelevant) {
      // Generate deeper explanation
      aiResponse = await generateDeeperExplanation(lessonContext, prompt)
    } else {
      aiResponse = relevanceResult.suggestedRedirect ||
        `That question doesn't seem to be directly related to this lesson on "${lesson.title}". Try asking about the specific concepts we covered, like ${keyTakeaways[0]?.toLowerCase() || 'the main ideas'}.`
    }

    // Save the interaction
    await prisma.goDeeper.create({
      data: {
        userId: session.userId,
        lessonId,
        userPrompt: prompt,
        aiResponse,
        isRelevant: relevanceResult.isRelevant,
      },
    })

    return NextResponse.json({
      isRelevant: relevanceResult.isRelevant,
      response: aiResponse,
      confidence: relevanceResult.confidence,
    })
  } catch (error) {
    console.error('Go deeper error:', error)
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}

// Get go deeper history for a lesson
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: lessonId } = await params

    const history = await prisma.goDeeper.findMany({
      where: {
        userId: session.userId,
        lessonId,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    return NextResponse.json({ history })
  } catch (error) {
    console.error('Get go deeper history error:', error)
    return NextResponse.json(
      { error: 'Failed to get history' },
      { status: 500 }
    )
  }
}
