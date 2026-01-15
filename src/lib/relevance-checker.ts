import { generateJSON } from './anthropic'

interface RelevanceCheckResult {
  isRelevant: boolean
  confidence: number
  reason: string
  suggestedRedirect?: string
}

interface LessonContext {
  title: string
  introduction: string
  keyTakeaways: string[]
  subtopicName: string
  levelName: string
  subjectName: string
}

export async function checkRelevance(
  lessonContext: LessonContext,
  userPrompt: string
): Promise<RelevanceCheckResult> {
  const prompt = `You are a strict relevance checker for an educational platform. Your job is to determine if a student's question is directly related to a specific lesson they just completed.

LESSON CONTEXT:
- Subject: ${lessonContext.subjectName}
- Level: ${lessonContext.levelName}
- Subtopic: ${lessonContext.subtopicName}
- Lesson Title: "${lessonContext.title}"
- Lesson Introduction: "${lessonContext.introduction}"
- Key Takeaways: ${JSON.stringify(lessonContext.keyTakeaways)}

STUDENT'S QUESTION:
"${userPrompt}"

STRICT RULES:
1. The question must be DIRECTLY about concepts covered in THIS specific lesson
2. Questions about related topics (even in the same subtopic) should be marked NOT relevant
3. Questions asking to explain concepts from the lesson in more detail ARE relevant
4. Questions asking for more examples of concepts from the lesson ARE relevant
5. Questions about entirely different subjects are NOT relevant
6. Questions about the next lesson or different topics are NOT relevant

Analyze the question and return a JSON object:
{
  "isRelevant": true/false,
  "confidence": 0.0-1.0,
  "reason": "Brief explanation of your decision",
  "suggestedRedirect": "If not relevant, suggest what the student should do instead (e.g., 'Check the next lesson on X' or 'This is covered in a different subtopic')"
}

Be STRICT - when in doubt, mark as NOT relevant. We want students to stay focused on mastering one concept at a time.`

  return generateJSON<RelevanceCheckResult>(prompt)
}

export async function generateDeeperExplanation(
  lessonContext: LessonContext,
  userPrompt: string
): Promise<string> {
  const prompt = `You are an expert ${lessonContext.subjectName} tutor helping a ${lessonContext.levelName} student understand a concept more deeply.

The student just completed a lesson titled "${lessonContext.title}" about ${lessonContext.subtopicName}.

Key concepts from the lesson:
${lessonContext.keyTakeaways.map((t, i) => `${i + 1}. ${t}`).join('\n')}

The student asks: "${userPrompt}"

Provide a detailed, helpful explanation that:
1. Directly addresses their question
2. Uses age-appropriate language for ${lessonContext.levelName} students
3. Includes concrete examples they can relate to
4. Connects back to concepts from the lesson
5. Is encouraging and supportive

Keep your response focused and helpful (3-5 paragraphs). Do not introduce new topics not covered in the lesson.`

  const response = await generateJSON<{ explanation: string }>(
    prompt + '\n\nReturn as JSON: { "explanation": "your detailed response here" }'
  )

  return response.explanation
}
