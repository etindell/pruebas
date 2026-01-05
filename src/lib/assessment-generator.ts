import { generateJSON } from './anthropic'

export interface AssessmentQuestion {
  id: string
  question: string
  options: string[]
  correct_answer: string
  explanation: string
  level: string
  level_id: string
}

interface AssessmentResponse {
  questions: AssessmentQuestion[]
}

export interface Level {
  id: string
  name: string
  sortOrder: number
}

export interface AdaptiveAssessmentPool {
  questionsByLevel: Record<string, AssessmentQuestion[]>
  levels: Level[]
}

const QUESTIONS_PER_LEVEL = 3

export async function generateAdaptiveAssessment(
  subject: string,
  levels: Level[]
): Promise<AdaptiveAssessmentPool> {
  const levelList = levels.map((l) => `- ${l.name} (ID: ${l.id})`).join('
')
  const totalQuestions = QUESTIONS_PER_LEVEL * levels.length

  const prompt = `Generate an adaptive placement assessment pool for ${subject} with ${totalQuestions} questions.

The levels for this subject, in order from beginner to advanced, are:
${levelList}

Generate exactly ${QUESTIONS_PER_LEVEL} questions for EACH level. Tag each question with its level name and level_id.

Return JSON in this exact format:
{
  "questions": [
    {
      "id": "q1",
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": "Option B",
      "explanation": "Brief explanation of why this is correct.",
      "level": "Level Name",
      "level_id": "uuid-of-level"
    }
  ]
}

Important:
- Make questions genuinely diagnostic of that specific level skills
- Each question must have exactly 4 options
- Questions for each level should vary in topic/skill tested
- Generate exactly ${totalQuestions} questions total (${QUESTIONS_PER_LEVEL} per level)
- Use IDs q1, q2, q3, etc.`

  const response = await generateJSON<AssessmentResponse>(prompt)

  // Organize questions by level_id
  const questionsByLevel: Record<string, AssessmentQuestion[]> = {}

  // Initialize empty arrays for each level
  for (const level of levels) {
    questionsByLevel[level.id] = []
  }

  // Sort questions into their level buckets
  for (const question of response.questions) {
    if (questionsByLevel[question.level_id]) {
      questionsByLevel[question.level_id].push(question)
    }
  }

  return {
    questionsByLevel,
    levels,
  }
}
