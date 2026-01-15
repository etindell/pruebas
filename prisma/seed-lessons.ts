import { PrismaClient } from '@prisma/client'
import { generateAllLessonsForSubtopic } from '../src/lib/lesson-generator'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

const CHECKPOINT_FILE = path.join(__dirname, 'lesson-seed-checkpoint.json')
const CONCURRENT_SUBTOPICS = 3
const DELAY_BETWEEN_BATCHES_MS = 2000

interface Checkpoint {
  completedSubtopicIds: string[]
  lastUpdated: string
}

function loadCheckpoint(): Checkpoint {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      const data = fs.readFileSync(CHECKPOINT_FILE, 'utf-8')
      return JSON.parse(data)
    }
  } catch (error) {
    console.log('No checkpoint found, starting fresh')
  }
  return { completedSubtopicIds: [], lastUpdated: new Date().toISOString() }
}

function saveCheckpoint(checkpoint: Checkpoint) {
  checkpoint.lastUpdated = new Date().toISOString()
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2))
}

async function seedLessonsForSubtopic(subtopic: {
  id: string
  name: string
  prompt: string
  level: {
    name: string
    subject: { name: string }
  }
}): Promise<boolean> {
  try {
    // Check if lessons already exist
    const existingCount = await prisma.lesson.count({
      where: { subtopicId: subtopic.id }
    })

    if (existingCount > 0) {
      console.log(`  Skipping ${subtopic.name} - already has ${existingCount} lessons`)
      return true
    }

    console.log(`  Generating lessons for: ${subtopic.name}`)

    const lessons = await generateAllLessonsForSubtopic({
      subjectName: subtopic.level.subject.name,
      levelName: subtopic.level.name,
      subtopicName: subtopic.name,
      subtopicPrompt: subtopic.prompt,
      lessonCount: 4, // Generate 4 lessons per subtopic
    })

    // Save lessons to database
    for (let i = 0; i < lessons.length; i++) {
      const lesson = lessons[i]
      await prisma.lesson.create({
        data: {
          subtopicId: subtopic.id,
          title: lesson.title,
          introduction: lesson.introduction,
          content: JSON.stringify({ sections: lesson.sections }),
          keyTakeaways: JSON.stringify(lesson.keyTakeaways),
          sortOrder: i + 1,
        },
      })
    }

    console.log(`  Created ${lessons.length} lessons for: ${subtopic.name}`)
    return true
  } catch (error) {
    console.error(`  Error generating lessons for ${subtopic.name}:`, error)
    return false
  }
}

async function main() {
  console.log('Starting lesson seeding...')
  console.log('')

  const checkpoint = loadCheckpoint()
  console.log(`Checkpoint: ${checkpoint.completedSubtopicIds.length} subtopics already completed`)

  // Get all subtopics with their level and subject info
  const subtopics = await prisma.subtopic.findMany({
    include: {
      level: {
        include: {
          subject: true
        }
      }
    },
    orderBy: [
      { level: { subject: { sortOrder: 'asc' } } },
      { level: { sortOrder: 'asc' } },
      { sortOrder: 'asc' },
    ],
  })

  // Filter out already completed subtopics
  const pendingSubtopics = subtopics.filter(
    s => !checkpoint.completedSubtopicIds.includes(s.id)
  )

  console.log(`Total subtopics: ${subtopics.length}`)
  console.log(`Pending subtopics: ${pendingSubtopics.length}`)
  console.log('')

  let currentSubject = ''
  let currentLevel = ''
  let processedCount = 0
  let errorCount = 0

  // Process subtopics in batches
  for (let i = 0; i < pendingSubtopics.length; i += CONCURRENT_SUBTOPICS) {
    const batch = pendingSubtopics.slice(i, i + CONCURRENT_SUBTOPICS)

    // Log subject/level changes
    for (const subtopic of batch) {
      if (subtopic.level.subject.name !== currentSubject) {
        currentSubject = subtopic.level.subject.name
        console.log(`\n=== ${currentSubject} ===`)
      }
      if (subtopic.level.name !== currentLevel) {
        currentLevel = subtopic.level.name
        console.log(`\n${currentLevel}:`)
      }
    }

    // Process batch concurrently
    const results = await Promise.all(
      batch.map(subtopic => seedLessonsForSubtopic(subtopic))
    )

    // Update checkpoint
    for (let j = 0; j < batch.length; j++) {
      if (results[j]) {
        checkpoint.completedSubtopicIds.push(batch[j].id)
        processedCount++
      } else {
        errorCount++
      }
    }
    saveCheckpoint(checkpoint)

    // Progress update
    const progress = ((i + batch.length) / pendingSubtopics.length * 100).toFixed(1)
    console.log(`\nProgress: ${progress}% (${i + batch.length}/${pendingSubtopics.length})`)

    // Delay between batches
    if (i + CONCURRENT_SUBTOPICS < pendingSubtopics.length) {
      console.log(`Waiting ${DELAY_BETWEEN_BATCHES_MS}ms before next batch...`)
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS))
    }
  }

  console.log('\n')
  console.log('=================================')
  console.log('Lesson seeding complete!')
  console.log(`Processed: ${processedCount} subtopics`)
  console.log(`Errors: ${errorCount} subtopics`)

  // Final stats
  const totalLessons = await prisma.lesson.count()
  console.log(`Total lessons in database: ${totalLessons}`)
}

main()
  .catch((e) => {
    console.error('Fatal error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
