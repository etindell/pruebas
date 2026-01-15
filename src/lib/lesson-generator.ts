import { generateJSON } from './anthropic'
import { GeneratedLesson } from '@/types/lesson'

interface GenerateLessonsParams {
  subjectName: string
  levelName: string
  subtopicName: string
  subtopicPrompt: string
  lessonCount?: number
}

interface LessonPlan {
  lessons: {
    title: string
    focus: string
  }[]
}

export async function generateLessonPlan(
  params: GenerateLessonsParams
): Promise<LessonPlan> {
  const { subjectName, levelName, subtopicName, subtopicPrompt, lessonCount = 4 } = params

  const prompt = `You are an expert curriculum designer. Create a lesson plan for teaching "${subtopicName}" in ${subjectName} at the ${levelName} level.

Context about this subtopic: ${subtopicPrompt}

Generate exactly ${lessonCount} lessons that progressively build understanding. Each lesson should focus on a specific sub-aspect of the topic.

Guidelines:
- Lesson 1: Introduction and fundamentals
- Lessons 2-3: Core concepts with increasing depth
- Final lesson: Application and synthesis

Return a JSON object with this structure:
{
  "lessons": [
    { "title": "Lesson title", "focus": "Brief description of what this lesson covers" },
    ...
  ]
}

Make titles specific and engaging (not generic like "Introduction to X").
Ensure each lesson builds on the previous one.`

  return generateJSON<LessonPlan>(prompt)
}

export async function generateLesson(
  params: GenerateLessonsParams & {
    lessonTitle: string
    lessonFocus: string
    lessonNumber: number
    totalLessons: number
  }
): Promise<GeneratedLesson> {
  const {
    subjectName,
    levelName,
    subtopicName,
    subtopicPrompt,
    lessonTitle,
    lessonFocus,
    lessonNumber,
    totalLessons,
  } = params

  const prompt = `You are an expert ${subjectName} teacher creating educational content for students at the ${levelName} level.

Topic: ${subtopicName}
Context: ${subtopicPrompt}

Create Lesson ${lessonNumber} of ${totalLessons}: "${lessonTitle}"
Focus: ${lessonFocus}

Guidelines:
- Use age-appropriate language for ${levelName} students
- Include concrete examples that relate to students' lives
- Build on concepts progressively
- Make content engaging and memorable
- Each section should be 2-4 paragraphs

Return a JSON object with this EXACT structure:
{
  "title": "${lessonTitle}",
  "introduction": "2-3 sentence overview that hooks the reader and explains what they'll learn",
  "sections": [
    {
      "heading": "Section heading",
      "content": "Detailed explanation (2-4 paragraphs)",
      "examples": ["Concrete example 1", "Concrete example 2"]
    },
    {
      "heading": "Another section heading",
      "content": "More detailed explanation",
      "examples": ["Example 1", "Example 2"]
    }
  ],
  "keyTakeaways": [
    "Key point 1 - something memorable",
    "Key point 2 - a core concept",
    "Key point 3 - practical application"
  ]
}

Include 2-3 sections and 3-4 key takeaways.`

  return generateJSON<GeneratedLesson>(prompt)
}

export async function generateAllLessonsForSubtopic(
  params: GenerateLessonsParams
): Promise<GeneratedLesson[]> {
  // First, generate the lesson plan
  const plan = await generateLessonPlan(params)

  // Then generate each lesson
  const lessons: GeneratedLesson[] = []

  for (let i = 0; i < plan.lessons.length; i++) {
    const lessonPlan = plan.lessons[i]

    // Add delay between lessons to avoid rate limiting
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    const lesson = await generateLesson({
      ...params,
      lessonTitle: lessonPlan.title,
      lessonFocus: lessonPlan.focus,
      lessonNumber: i + 1,
      totalLessons: plan.lessons.length,
    })

    lessons.push(lesson)
  }

  return lessons
}
