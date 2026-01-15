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

    const { id: subtopicId } = await params

    // Get subtopic with its lessons and level/subject info
    const subtopic = await prisma.subtopic.findUnique({
      where: { id: subtopicId },
      include: {
        level: {
          include: {
            subject: true,
          },
        },
        lessons: {
          orderBy: { sortOrder: 'asc' },
          include: {
            progress: {
              where: { userId: session.userId },
            },
          },
        },
      },
    })

    if (!subtopic) {
      return NextResponse.json({ error: 'Subtopic not found' }, { status: 404 })
    }

    // Format response
    const lessons = subtopic.lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      sortOrder: lesson.sortOrder,
      completed: lesson.progress[0]?.completed ?? false,
      quizScore: lesson.progress[0]?.quizScore ?? null,
    }))

    const completedLessons = lessons.filter((l) => l.completed).length

    return NextResponse.json({
      subtopic: {
        id: subtopic.id,
        name: subtopic.name,
        levelName: subtopic.level.name,
        subjectName: subtopic.level.subject.name,
        subjectIcon: subtopic.level.subject.icon,
      },
      lessons,
      totalLessons: lessons.length,
      completedLessons,
      nextLessonId: lessons.find((l) => !l.completed)?.id ?? null,
    })
  } catch (error) {
    console.error('Get subtopic lessons error:', error)
    return NextResponse.json(
      { error: 'Failed to get lessons' },
      { status: 500 }
    )
  }
}
