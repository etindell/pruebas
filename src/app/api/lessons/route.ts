import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { generateJSON } from '@/lib/anthropic'

interface LessonContent {
  title: string
  introduction: string
  sections: Array<{
    heading: string
    content: string
    examples?: string[]
  }>
  keyTakeaways: string[]
  practicePrompts: string[]
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { subject, level, topic } = await request.json()

    if (!subject || !level) {
      return NextResponse.json({ error: 'Subject and level are required' }, { status: 400 })
    }

    const topicText = topic ? ` focusing on "${topic}"` : ''

    const prompt = `Generate an educational lesson for ${subject} at the ${level} level${topicText}.

Create an engaging, age-appropriate lesson with:
1. A clear title
2. A brief introduction (2-3 sentences)
3. 2-3 main sections with explanations and examples
4. 3-4 key takeaways
5. 2-3 practice prompts/questions for discussion

Return JSON in this exact format:
{
  "title": "Lesson title",
  "introduction": "Brief intro paragraph",
  "sections": [
    {
      "heading": "Section heading",
      "content": "Detailed explanation",
      "examples": ["Example 1", "Example 2"]
    }
  ],
  "keyTakeaways": ["Takeaway 1", "Takeaway 2"],
  "practicePrompts": ["Question 1?", "Question 2?"]
}`

    const lesson = await generateJSON<LessonContent>(prompt)

    return NextResponse.json({
      lesson,
      metadata: {
        subject,
        level,
        topic: topic || null,
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Lesson generation error:', error)
    return NextResponse.json({ error: 'Failed to generate lesson' }, { status: 500 })
  }
}
