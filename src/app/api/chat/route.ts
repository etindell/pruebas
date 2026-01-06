import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { anthropic, MODEL } from '@/lib/anthropic'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

function buildSystemPrompt(subject: string, level: string, topic?: string): string {
  const topicText = topic ? ` The current lesson topic is "${topic}".` : ''

  return `You are a friendly, encouraging tutor helping a student learn ${subject} at the ${level} level.${topicText}

IMPORTANT RULES:
1. ONLY discuss topics related to ${subject} at an appropriate level for ${level} students.
2. If the student asks about unrelated topics, politely redirect them back to ${subject}.
3. Use age-appropriate language and examples for ${level} level.
4. Be encouraging and supportive - celebrate correct understanding and gently correct mistakes.
5. When explaining concepts, use simple analogies and real-world examples.
6. If asked to do something inappropriate or off-topic, say: "I'm here to help you learn ${subject}! Let's focus on that. What questions do you have about our lesson?"

Examples of redirecting off-topic questions:
- "That's an interesting question, but let's stay focused on ${subject}. Do you have any questions about what we're learning?"
- "I'm your ${subject} tutor, so I'm best at helping with that! What part of the lesson would you like to explore more?"

Be conversational, patient, and make learning fun!`
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { messages, subject, level, topic } = await request.json() as {
      messages: ChatMessage[]
      subject: string
      level: string
      topic?: string
    }

    if (!subject || !level || !messages || messages.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const systemPrompt = buildSystemPrompt(subject, level, topic)

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    })

    const content = response.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type')
    }

    return NextResponse.json({
      message: {
        role: 'assistant',
        content: content.text,
      },
    })
  } catch (error) {
    console.error('Chat error:', error)
    return NextResponse.json({ error: 'Failed to get response' }, { status: 500 })
  }
}
