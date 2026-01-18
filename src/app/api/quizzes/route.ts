import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { generateQuiz, TopicOutOfLevelError } from '@/lib/quiz-generator'

/**
 * Calculate difficulty level based on questions answered (1-4)
 */
function calculateDifficultyLevel(questionsAnswered: number): number {
  // Level 1: 0-9 questions, Level 2: 10-19, Level 3: 20-29, Level 4: 30+
  return Math.min(4, Math.floor(questionsAnswered / 10) + 1)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const subjectId = searchParams.get('subjectId')
    const levelId = searchParams.get('levelId')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    const where: Record<string, unknown> = {}

    if (subjectId) {
      where.category = { subjectId }
    }
    if (levelId) {
      where.category = { ...where.category as object, levelId }
    }
    if (search) {
      where.category = {
        ...where.category as object,
        topicName: { contains: search },
      }
    }

    const [quizzes, total] = await Promise.all([
      prisma.quiz.findMany({
        where,
        include: {
          category: {
            include: {
              subject: true,
              level: true,
            },
          },
          creator: {
            select: { id: true, displayName: true },
          },
          _count: { select: { attempts: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.quiz.count({ where }),
    ])

    return NextResponse.json({
      quizzes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Get quizzes error:', error)
    return NextResponse.json({ error: 'Failed to get quizzes' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { subjectId, levelId, topicName, subtopicId, questionCount, timeLimitMinutes } = await request.json()

    // Validate inputs - either subtopicId or (subjectId + levelId + topicName) required
    if (subtopicId) {
      // Subtopic test - fetch subtopic details with lessons
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
        return NextResponse.json({ error: 'Invalid subtopic' }, { status: 400 })
      }

      // Check if all lessons are completed (required for subtopic tests)
      if (subtopic.lessons.length > 0) {
        const completedLessonsCount = await prisma.lessonProgress.count({
          where: {
            userId: session.userId,
            lessonId: { in: subtopic.lessons.map(l => l.id) },
            completed: true,
          },
        })

        if (completedLessonsCount < subtopic.lessons.length) {
          return NextResponse.json(
            {
              error: 'Complete all lessons first',
              lessonsCompleted: completedLessonsCount,
              lessonsTotal: subtopic.lessons.length,
            },
            { status: 400 }
          )
        }
      }

      const count = questionCount || 10
      if (count < 10 || count > 20) {
        return NextResponse.json({ error: 'Question count must be 10-20' }, { status: 400 })
      }

      // Get previously answered questions for this subtopic (for exclusion)
      const previousQuestions = await prisma.subtopicQuestion.findMany({
        where: {
          userId: session.userId,
          subtopicId,
          questionText: { not: null },
        },
        select: { questionText: true },
        orderBy: { answeredAt: 'desc' },
      })

      const excludeQuestions = previousQuestions
        .map(q => q.questionText)
        .filter((text): text is string => text !== null)

      // Calculate difficulty based on questions answered
      const questionsAnswered = previousQuestions.length
      const difficultyLevel = calculateDifficultyLevel(questionsAnswered)

      // Generate quiz using subtopic's fixed prompt with exclusions and difficulty
      const questions = await generateQuiz({
        subject: subtopic.level.subject.name,
        level: subtopic.level.name,
        topic: subtopic.prompt,
        questionCount: count,
        excludeQuestions,
        difficultyLevel,
      })

      // Create category with subtopic name as topic
      const category = await prisma.category.create({
        data: {
          subjectId: subtopic.level.subject.id,
          levelId: subtopic.level.id,
          topicName: subtopic.name,
          createdBy: session.userId,
        },
      })

      // Create quiz linked to subtopic
      const quiz = await prisma.quiz.create({
        data: {
          categoryId: category.id,
          subtopicId: subtopic.id,
          questions: JSON.stringify({ questions, difficultyLevel }),
          questionCount: count,
          timeLimitMinutes: timeLimitMinutes || null,
          createdBy: session.userId,
        },
        include: {
          category: {
            include: {
              subject: true,
              level: true,
            },
          },
          subtopic: true,
        },
      })

      return NextResponse.json({ quiz, difficultyLevel, questionsAnswered })
    } else {
      // Custom quiz - use provided topic
      if (!subjectId || !levelId || !topicName) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
      }

      const count = questionCount || 10
      if (count < 10 || count > 20) {
        return NextResponse.json({ error: 'Question count must be 10-20' }, { status: 400 })
      }

      // Get subject and level details
      const [subject, level] = await Promise.all([
        prisma.subject.findUnique({ where: { id: subjectId } }),
        prisma.level.findUnique({ where: { id: levelId } }),
      ])

      if (!subject || !level) {
        return NextResponse.json({ error: 'Invalid subject or level' }, { status: 400 })
      }

      // Generate quiz using custom topic
      const questions = await generateQuiz({
        subject: subject.name,
        level: level.name,
        topic: topicName,
        questionCount: count,
      })

      // Create category and quiz (no subtopic link)
      const category = await prisma.category.create({
        data: {
          subjectId,
          levelId,
          topicName,
          createdBy: session.userId,
        },
      })

      const quiz = await prisma.quiz.create({
        data: {
          categoryId: category.id,
          questions: JSON.stringify({ questions }),
          questionCount: count,
          timeLimitMinutes: timeLimitMinutes || null,
          createdBy: session.userId,
        },
        include: {
          category: {
            include: {
              subject: true,
              level: true,
            },
          },
        },
      })

      return NextResponse.json({ quiz })
    }
  } catch (error) {
    if (error instanceof TopicOutOfLevelError) {
      return NextResponse.json(
        {
          error: 'Topic outside current level',
          reason: error.reason,
          suggestedTopic: error.suggestedTopic,
        },
        { status: 400 }
      )
    }
    console.error('Create quiz error:', error)
    return NextResponse.json({ error: 'Failed to create quiz' }, { status: 500 })
  }
}
