import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { generateAllLessonsForSubtopic } from '@/lib/lesson-generator'

// POST /api/admin/seed-lessons - Start lesson seeding
export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get optional subtopicId from body for targeted seeding
    const body = await request.json().catch(() => ({}))
    const { subtopicId, limit } = body

    // If specific subtopic provided, seed just that one
    if (subtopicId) {
      const subtopic = await prisma.subtopic.findUnique({
        where: { id: subtopicId },
        include: {
          level: {
            include: {
              subject: true,
            },
          },
          lessons: true,
        },
      })

      if (!subtopic) {
        return NextResponse.json({ error: 'Subtopic not found' }, { status: 404 })
      }

      if (subtopic.lessons.length > 0) {
        return NextResponse.json({
          message: 'Subtopic already has lessons',
          lessonCount: subtopic.lessons.length
        })
      }

      const lessons = await generateAllLessonsForSubtopic({
        subjectName: subtopic.level.subject.name,
        levelName: subtopic.level.name,
        subtopicName: subtopic.name,
        subtopicPrompt: subtopic.prompt,
        lessonCount: 4,
      })

      // Save lessons to database
      for (let i = 0; i < lessons.length; i++) {
        await prisma.lesson.create({
          data: {
            subtopicId: subtopic.id,
            title: lessons[i].title,
            introduction: lessons[i].introduction,
            content: JSON.stringify({ sections: lessons[i].sections }),
            keyTakeaways: JSON.stringify(lessons[i].keyTakeaways),
            sortOrder: i + 1,
          },
        })
      }

      return NextResponse.json({
        message: 'Lessons generated successfully',
        subtopic: subtopic.name,
        lessonCount: lessons.length,
      })
    }

    // Otherwise, seed all subtopics that don't have lessons
    const subtopics = await prisma.subtopic.findMany({
      where: {
        lessons: { none: {} },
      },
      include: {
        level: {
          include: {
            subject: true,
          },
        },
      },
      take: limit || 5, // Process in batches of 5 by default
    })

    if (subtopics.length === 0) {
      const totalSubtopics = await prisma.subtopic.count()
      const subtopicsWithLessons = await prisma.subtopic.count({
        where: { lessons: { some: {} } },
      })
      return NextResponse.json({
        message: 'All subtopics already have lessons',
        total: totalSubtopics,
        completed: subtopicsWithLessons,
      })
    }

    const results = []

    for (const subtopic of subtopics) {
      try {
        const lessons = await generateAllLessonsForSubtopic({
          subjectName: subtopic.level.subject.name,
          levelName: subtopic.level.name,
          subtopicName: subtopic.name,
          subtopicPrompt: subtopic.prompt,
          lessonCount: 4,
        })

        // Save lessons to database
        for (let i = 0; i < lessons.length; i++) {
          await prisma.lesson.create({
            data: {
              subtopicId: subtopic.id,
              title: lessons[i].title,
              introduction: lessons[i].introduction,
              content: JSON.stringify({ sections: lessons[i].sections }),
              keyTakeaways: JSON.stringify(lessons[i].keyTakeaways),
              sortOrder: i + 1,
            },
          })
        }

        results.push({
          subtopic: subtopic.name,
          lessonCount: lessons.length,
          status: 'success',
        })
      } catch (error) {
        results.push({
          subtopic: subtopic.name,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    // Get remaining count
    const remaining = await prisma.subtopic.count({
      where: { lessons: { none: {} } },
    })

    return NextResponse.json({
      message: 'Batch seeding completed',
      processed: results,
      remaining,
    })
  } catch (error) {
    console.error('Seed lessons error:', error)
    return NextResponse.json(
      { error: 'Failed to seed lessons' },
      { status: 500 }
    )
  }
}

// GET /api/admin/seed-lessons - Check seeding status
export async function GET() {
  try {
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const totalSubtopics = await prisma.subtopic.count()
    const subtopicsWithLessons = await prisma.subtopic.count({
      where: { lessons: { some: {} } },
    })
    const totalLessons = await prisma.lesson.count()

    return NextResponse.json({
      totalSubtopics,
      subtopicsWithLessons,
      subtopicsRemaining: totalSubtopics - subtopicsWithLessons,
      totalLessons,
      percentComplete: totalSubtopics > 0
        ? Math.round((subtopicsWithLessons / totalSubtopics) * 100)
        : 0,
    })
  } catch (error) {
    console.error('Get seed status error:', error)
    return NextResponse.json(
      { error: 'Failed to get status' },
      { status: 500 }
    )
  }
}
