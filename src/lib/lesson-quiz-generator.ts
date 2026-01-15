import { generateJSON } from './anthropic'
import { LessonQuizQuestion, LessonContent } from '@/types/lesson'

interface GenerateLessonQuizParams {
  lessonTitle: string
  lessonIntroduction: string
  lessonContent: LessonContent
  keyTakeaways: string[]
  subtopicName: string
  levelName: string
  subjectName: string
  questionCount?: number
}

interface QuizResponse {
  questions: LessonQuizQuestion[]
}

export async function generateLessonQuiz(
  params: GenerateLessonQuizParams
): Promise<LessonQuizQuestion[]> {
  const {
    lessonTitle,
    lessonIntroduction,
    lessonContent,
    keyTakeaways,
    subtopicName,
    levelName,
    subjectName,
    questionCount = 5,
  } = params

  // Summarize the lesson content for the prompt
  const sectionsText = lessonContent.sections
    .map(s => `${s.heading}: ${s.content.substring(0, 200)}...`)
    .join('\n')

  const prompt = `You are creating a quiz to test a student's understanding of a lesson they just completed.

LESSON DETAILS:
- Subject: ${subjectName}
- Level: ${levelName}
- Subtopic: ${subtopicName}
- Title: "${lessonTitle}"
- Introduction: ${lessonIntroduction}
- Sections covered:
${sectionsText}
- Key Takeaways:
${keyTakeaways.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Generate exactly ${questionCount} multiple-choice questions that test understanding of THIS specific lesson.

Guidelines:
- Questions should directly test concepts from the lesson content
- Use age-appropriate language for ${levelName} students
- Each question should have exactly 4 options
- Include a mix of recall and application questions
- Make wrong answers plausible but clearly incorrect
- Explanations should help students learn, not just state the answer

Return a JSON object with this structure:
{
  "questions": [
    {
      "id": "q1",
      "question": "Question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "The exact text of the correct option",
      "explanation": "Why this is correct and how it relates to the lesson"
    },
    ...
  ]
}

Make questions unique and ensure they cover different aspects of the lesson.`

  const response = await generateJSON<QuizResponse>(prompt)
  return response.questions
}
