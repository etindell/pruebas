import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'

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

    // Get lesson with subtopic, level, subject info and user progress
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
            lessons: {
              orderBy: { sortOrder: 'asc' },
              select: { id: true, sortOrder: true },
            },
          },
        },
        progress: {
          where: { userId: session.userId },
        },
      },
    })

    if (!lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
    }

    // Find previous and next lesson IDs
    const allLessons = lesson.subtopic.lessons
    const currentIndex = allLessons.findIndex((l) => l.id === lessonId)
    const previousLessonId = currentIndex > 0 ? allLessons[currentIndex - 1].id : null
    const nextLessonId =
      currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1].id : null

    // Parse JSON content
    const content = JSON.parse(lesson.content)
    const keyTakeaways = JSON.parse(lesson.keyTakeaways)

    return NextResponse.json({
      lesson: {
        id: lesson.id,
        title: lesson.title,
        introduction: lesson.introduction,
        content,
        keyTakeaways,
        sortOrder: lesson.sortOrder,
        totalLessons: allLessons.length,
      },
      subtopic: {
        id: lesson.subtopic.id,
        name: lesson.subtopic.name,
      },
      level: {
        id: lesson.subtopic.level.id,
        name: lesson.subtopic.level.name,
      },
      subject: {
        id: lesson.subtopic.level.subject.id,
        name: lesson.subtopic.level.subject.name,
        icon: lesson.subtopic.level.subject.icon,
      },
      progress: lesson.progress[0]
        ? {
            completed: lesson.progress[0].completed,
            quizScore: lesson.progress[0].quizScore,
            completedAt: lesson.progress[0].completedAt,
          }
        : null,
      navigation: {
        previousLessonId,
        nextLessonId,
      },
    })
  } catch (error) {
    console.error('Get lesson error:', error)
    return NextResponse.json({ error: 'Failed to get lesson' }, { status: 500 })
  }
}

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

    // Mark lesson as viewed (create or update progress)
    await prisma.lessonProgress.upsert({
      where: {
        userId_lessonId: {
          userId: session.userId,
          lessonId,
        },
      },
      update: {
        // Don't override completed status, just track the view
      },
      create: {
        userId: session.userId,
        lessonId,
        completed: false,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Track lesson view error:', error)
    return NextResponse.json(
      { error: 'Failed to track lesson view' },
      { status: 500 }
    )
  }
}
