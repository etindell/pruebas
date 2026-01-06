import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const subjects = await prisma.subject.findMany({
    include: {
      levels: { orderBy: { sortOrder: 'asc' } },
    },
  })

  const stats = await Promise.all(
    subjects.map(async (subject) => {
      const levelStats = await Promise.all(
        subject.levels.map(async (level) => {
          const count = await prisma.question.count({
            where: { subjectId: subject.id, levelId: level.id },
          })
          return { level: level.name, count }
        })
      )
      const total = levelStats.reduce((sum, l) => sum + l.count, 0)
      return {
        subject: subject.name,
        total,
        levels: levelStats,
      }
    })
  )

  return NextResponse.json({ stats })
}
