export interface LessonSection {
  heading: string
  content: string
  examples?: string[]
}

export interface LessonContent {
  sections: LessonSection[]
}

export interface GeneratedLesson {
  title: string
  introduction: string
  sections: LessonSection[]
  keyTakeaways: string[]
}

export interface LessonWithProgress {
  id: string
  title: string
  introduction: string
  content: LessonContent
  keyTakeaways: string[]
  sortOrder: number
  subtopicId: string
  progress?: {
    completed: boolean
    quizScore: number | null
    completedAt: string | null
  } | null
}

export interface LessonListItem {
  id: string
  title: string
  sortOrder: number
  completed: boolean
  quizScore: number | null
}

export interface SubtopicWithLessons {
  id: string
  name: string
  levelName: string
  subjectName: string
  lessons: LessonListItem[]
  totalLessons: number
  completedLessons: number
}

export interface LessonQuizQuestion {
  id: string
  question: string
  options: string[]
  correctAnswer: string
  explanation: string
}

export interface GoDeepRequest {
  prompt: string
}

export interface GoDeepResponse {
  isRelevant: boolean
  response?: string
  rejectionReason?: string
}
