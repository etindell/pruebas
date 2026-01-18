import { generateJSON } from './anthropic'

export interface Question {
  id: string
  question: string
  options: string[]
  correct_answer: string
  explanation: string
}

interface QuizResponse {
  questions: Question[]
}

interface TopicValidationResponse {
  is_appropriate: boolean
  reason: string
  suggested_topic?: string
}

interface GenerateQuizParams {
  subject: string
  level: string
  topic: string
  questionCount: number
  excludeQuestions?: string[]  // Previously asked question texts to avoid
  difficultyLevel?: number     // 1-4 difficulty scale
}

export class TopicOutOfLevelError extends Error {
  reason: string
  suggestedTopic?: string

  constructor(reason: string, suggestedTopic?: string) {
    super(`Topic is outside current level: ${reason}`)
    this.name = 'TopicOutOfLevelError'
    this.reason = reason
    this.suggestedTopic = suggestedTopic
  }
}

/**
 * Returns difficulty instructions based on the level (1-4)
 */
function getDifficultyInstructions(level: number): string {
  switch (level) {
    case 1:
      return `DIFFICULTY LEVEL 1 - FOUNDATIONAL:
- Focus on basic recall and recognition
- Questions should be straightforward with clear, unambiguous answers
- Use simple, direct language
- Test one concept at a time
- Avoid tricky wording or complex scenarios`

    case 2:
      return `DIFFICULTY LEVEL 2 - DEVELOPING:
- Include simple application of concepts
- Questions may combine two related concepts
- Introduce basic problem-solving scenarios
- Some questions may require a single step of reasoning
- Still avoid overly complex wording`

    case 3:
      return `DIFFICULTY LEVEL 3 - PROFICIENT:
- Include word problems and real-world applications
- Questions should require multi-step thinking
- Combine multiple concepts in meaningful ways
- Include some analysis and comparison questions
- Require deeper understanding beyond memorization`

    case 4:
      return `DIFFICULTY LEVEL 4 - ADVANCED:
- Focus on complex reasoning and critical thinking
- Include nuanced scenarios with subtle distinctions
- Questions may require synthesis of multiple concepts
- Include some questions where wrong answers are plausible
- Test ability to apply knowledge in novel situations
- May include questions about edge cases or exceptions`

    default:
      return getDifficultyInstructions(1)
  }
}

async function validateTopicForLevel(
  subject: string,
  level: string,
  topic: string
): Promise<TopicValidationResponse> {
  const prompt = `You are validating whether a quiz topic is appropriate for a student's current level.

Subject: ${subject}
Student's Current Level: ${level}
Requested Topic: ${topic}

Analyze whether the requested topic is appropriate for this level. Consider:
1. Is the topic within the curriculum scope of ${level} ${subject}?
2. Does the topic require prerequisite knowledge beyond ${level}?
3. If the user included a different grade level in their topic (e.g., "8th grade algebra" when level is "7th Grade"), IGNORE the grade level they specified and evaluate whether the core topic concept can be taught at ${level}.

Return JSON in this exact format:
{
  "is_appropriate": true/false,
  "reason": "Brief explanation of why this topic is or isn't appropriate for this level",
  "suggested_topic": "If not appropriate, suggest a similar topic that IS appropriate for this level (optional)"
}

Examples:
- Topic "Systems of equations" at level "1st Grade" Math → NOT appropriate (too advanced)
- Topic "Basic addition" at level "Calculus" Math → appropriate (but could specify "limits" or "derivatives" instead)
- Topic "8th grade algebra" at level "7th Grade" Math → appropriate (evaluate as "algebra", which has 7th grade components)
- Topic "Quadratic equations" at level "7th Grade" Math → NOT appropriate (typically 9th grade+)
- Topic "Fractions" at level "8th Grade" Math → appropriate`

  return await generateJSON<TopicValidationResponse>(prompt)
}

export async function generateQuiz({
  subject,
  level,
  topic,
  questionCount,
  excludeQuestions,
  difficultyLevel,
}: GenerateQuizParams): Promise<Question[]> {
  // First, validate that the topic is appropriate for the level
  const validation = await validateTopicForLevel(subject, level, topic)

  if (!validation.is_appropriate) {
    throw new TopicOutOfLevelError(validation.reason, validation.suggested_topic)
  }

  // Build exclusion instructions if there are questions to avoid
  let exclusionInstructions = ''
  if (excludeQuestions && excludeQuestions.length > 0) {
    const recentExamples = excludeQuestions.slice(-20) // Show last 20 as examples
    exclusionInstructions = `
IMPORTANT - AVOID DUPLICATE QUESTIONS:
The student has already been asked ${excludeQuestions.length} questions on this topic.
DO NOT generate questions that are similar to or cover the same concept as these recent examples:
${recentExamples.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Generate COMPLETELY NEW questions that test different aspects of the topic.
`
  }

  // Get difficulty instructions if specified
  const difficultyInstructions = difficultyLevel
    ? `\n${getDifficultyInstructions(difficultyLevel)}\n`
    : ''

  const prompt = `Generate a ${questionCount}-question multiple choice quiz.

Subject: ${subject}
Level: ${level}
Topic: ${topic}
${difficultyInstructions}
${exclusionInstructions}
IMPORTANT INSTRUCTIONS:
- All questions MUST be appropriate for ${level} level students
- If the topic mentions a different grade level (e.g., "8th grade algebra"), IGNORE that and generate questions at ${level} difficulty
- Do NOT exceed the complexity expected at ${level}
- Focus on concepts that students at ${level} would be learning

Each question should:
- Be appropriate for the ${level} level
- Focus on the topic: ${topic}
- Have exactly 4 answer options
- Have one clear correct answer
- Include a brief explanation of why the answer is correct

Return JSON in this exact format:
{
  "questions": [
    {
      "id": "q1",
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": "Option B",
      "explanation": "Brief explanation of why this is correct."
    }
  ]
}

Generate exactly ${questionCount} questions with IDs q1, q2, q3, etc.`

  const response = await generateJSON<QuizResponse>(prompt)
  return response.questions
}
