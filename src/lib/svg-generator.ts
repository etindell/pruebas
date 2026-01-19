import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Use Opus for higher quality SVG generation (~$0.1125 per diagram)
export const SVG_MODEL = 'claude-opus-4-20250514'

export interface DiagramType {
  name: string
  description: string
  promptTemplate: string
}

// Diagram type templates for different math concepts
export const DIAGRAM_TYPES: Record<string, DiagramType> = {
  'right-triangle': {
    name: 'Right Triangle with Labels',
    description: 'Right triangle showing sides a, b, c with Pythagorean theorem visualization',
    promptTemplate: `Create an SVG diagram of a right triangle for teaching the Pythagorean theorem.

Requirements:
- Draw a right triangle with the right angle in the bottom-left corner
- Label the sides as 'a' (vertical), 'b' (horizontal), and 'c' (hypotenuse)
- Show the right angle marker (small square in the corner)
- Optionally show squares on each side to visualize a² + b² = c²
- Use clear, readable labels with appropriate font sizes
- Use a clean, educational style with dark blue (#1e40af) for lines and labels
- Make it 400x300 pixels with proper padding`,
  },
  'coordinate-grid': {
    name: 'Coordinate Grid with Transformation',
    description: 'Coordinate plane showing geometric transformations',
    promptTemplate: `Create an SVG diagram of a coordinate grid for teaching geometric transformations.

Requirements:
- Draw a coordinate plane with x and y axes from -6 to 6
- Include grid lines with light gray color
- Show axis labels at intervals of 2
- Display an original shape (simple triangle or rectangle) in one quadrant
- Show the transformed shape (translation, reflection, or rotation) with a different color
- Use arrows or dotted lines to show the transformation movement
- Label the original as "Original" and transformed as "Image"
- Use dark blue (#1e40af) for original, teal (#0d9488) for transformed
- Make it 400x400 pixels`,
  },
  'slope-graph': {
    name: 'Linear Function with Slope',
    description: 'Coordinate plane showing a line with rise/run visualization',
    promptTemplate: `Create an SVG diagram for teaching slope and linear functions.

Requirements:
- Draw a coordinate plane with x and y axes from -5 to 5
- Include light grid lines
- Draw a linear function line (e.g., y = 2x + 1 or similar)
- Clearly show "rise" and "run" with labeled arrows/brackets
- Mark at least 2 points on the line with coordinates
- Show the y-intercept point highlighted
- Include the equation of the line
- Use dark blue (#1e40af) for the line, red (#dc2626) for rise, green (#16a34a) for run
- Make it 400x400 pixels`,
  },
  'similar-triangles': {
    name: 'Similar Triangles Comparison',
    description: 'Two similar triangles with proportional sides labeled',
    promptTemplate: `Create an SVG diagram for teaching similar triangles.

Requirements:
- Draw two similar triangles side by side
- One smaller and one larger (scale factor visible)
- Label corresponding sides with letters (a, b, c for small; A, B, C for large)
- Show equal angles with matching arc marks
- Display the proportional relationships (a/A = b/B = c/C)
- Use dark blue (#1e40af) for the smaller triangle, teal (#0d9488) for larger
- Include dashed lines or annotations showing correspondence
- Make it 500x250 pixels`,
  },
  'scatter-plot': {
    name: 'Scatter Plot with Trend Line',
    description: 'Scatter plot showing bivariate data with line of best fit',
    promptTemplate: `Create an SVG diagram for teaching scatter plots and bivariate data.

Requirements:
- Draw coordinate axes with appropriate labels (e.g., "Hours Studied" vs "Test Score")
- Plot 8-12 data points showing a positive correlation
- Draw a line of best fit (trend line) through the data
- Use dots/circles for data points (filled, ~8px radius)
- Label axes with title and scale values
- Show the trend line in a different color from the points
- Use dark blue (#1e40af) for points, red (#dc2626) for trend line
- Make it 450x350 pixels`,
  },
  'systems-of-equations': {
    name: 'Systems of Equations Graph',
    description: 'Two intersecting lines showing the solution to a system',
    promptTemplate: `Create an SVG diagram for teaching systems of linear equations.

Requirements:
- Draw a coordinate plane with x and y axes from -5 to 5
- Include light grid lines
- Draw two lines that intersect (e.g., y = x + 1 and y = -x + 3)
- Clearly mark the intersection point with a dot and coordinates
- Label each line with its equation
- Use dark blue (#1e40af) for line 1, teal (#0d9488) for line 2
- Highlight the intersection point in red (#dc2626)
- Include text showing "Solution: (x, y)"
- Make it 400x400 pixels`,
  },
  'exponents': {
    name: 'Exponents Visual',
    description: 'Visual representation of powers and exponential growth',
    promptTemplate: `Create an SVG diagram for teaching exponents and powers.

Requirements:
- Show a visual representation of powers of 2 (2¹, 2², 2³, 2⁴)
- Use squares/rectangles to represent the values (1, 2, 4, 8, 16)
- Each subsequent power should be visually twice the previous
- Label each with the exponent notation (2¹ = 2, 2² = 4, etc.)
- Use a consistent color scheme with dark blue (#1e40af)
- Show the pattern of doubling clearly
- Include a title "Powers of 2"
- Make it 500x300 pixels`,
  },
  'number-line': {
    name: 'Number Line with Radicals',
    description: 'Number line showing rational and irrational numbers',
    promptTemplate: `Create an SVG diagram for teaching radicals and irrational numbers.

Requirements:
- Draw a horizontal number line from 0 to 4
- Mark whole numbers (0, 1, 2, 3, 4) with tick marks and labels
- Mark the positions of √2 (≈1.414), √3 (≈1.732), and √4 (=2)
- Use different colors: blue for rational, red for irrational
- Label √2 and √3 as irrational, √4 as rational (equals 2)
- Show approximate decimal values below irrational numbers
- Use dark blue (#1e40af) for the line, red (#dc2626) for irrational markers
- Make it 500x200 pixels`,
  },
  'parabola': {
    name: 'Quadratic Function Graph',
    description: 'Parabola showing key features of quadratic functions',
    promptTemplate: `Create an SVG diagram for teaching quadratic functions.

Requirements:
- Draw a coordinate plane with x-axis from -4 to 4, y-axis from -2 to 8
- Include light grid lines
- Draw a parabola y = x² centered at the origin
- Mark and label the vertex at (0, 0)
- Draw and label the axis of symmetry (dashed vertical line at x=0)
- Mark points at x = -2, -1, 1, 2 with their y-values
- Show the symmetric nature of the parabola
- Use dark blue (#1e40af) for the parabola
- Make it 400x400 pixels`,
  },
}

export interface SVGGenerationParams {
  lessonTitle: string
  subtopicName: string
  levelName: string
  diagramType: keyof typeof DIAGRAM_TYPES
  specificInstructions?: string
}

export async function generateSVG(params: SVGGenerationParams, maxRetries = 3): Promise<string> {
  const { lessonTitle, subtopicName, levelName, diagramType, specificInstructions } = params
  const diagram = DIAGRAM_TYPES[diagramType]

  if (!diagram) {
    throw new Error(`Unknown diagram type: ${diagramType}`)
  }

  const prompt = `You are an expert at creating clean, educational SVG diagrams for 8th grade math students.

Context:
- Subject: Math
- Level: ${levelName}
- Subtopic: ${subtopicName}
- Lesson: ${lessonTitle}

${diagram.promptTemplate}

${specificInstructions ? `Additional instructions: ${specificInstructions}` : ''}

Technical requirements:
- Return ONLY the SVG code, no markdown, no explanation
- Use viewBox for proper scaling
- Include xmlns="http://www.w3.org/2000/svg"
- Use readable fonts (Arial or sans-serif)
- Ensure all text is legible at the specified size
- Use stroke-width of 2 for main lines, 1 for grid lines
- Add appropriate padding/margins within the SVG

Return the complete, valid SVG code:`

  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: SVG_MODEL,
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      })

      const content = response.content[0]
      if (content.type !== 'text') {
        throw new Error('Unexpected response type')
      }

      // Extract SVG from the response
      const text = content.text.trim()

      // Try to find SVG tag
      const svgMatch = text.match(/<svg[\s\S]*<\/svg>/i)
      if (!svgMatch) {
        throw new Error('No valid SVG found in response')
      }

      const svg = svgMatch[0]

      // Basic validation
      if (!svg.includes('xmlns')) {
        // Add xmlns if missing
        return svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
      }

      return svg
    } catch (error) {
      lastError = error as Error
      console.error(`SVG generation attempt ${attempt + 1} failed:`, error)
      if (attempt < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)))
      }
    }
  }

  throw lastError || new Error('Failed to generate SVG')
}

// Helper function to determine the best diagram type for a lesson
export function getDiagramTypeForLesson(subtopicName: string, lessonTitle: string): keyof typeof DIAGRAM_TYPES | null {
  const subtopicLower = subtopicName.toLowerCase()
  const titleLower = lessonTitle.toLowerCase()

  if (subtopicLower.includes('pythagorean')) {
    return 'right-triangle'
  }
  if (subtopicLower.includes('transformation') || titleLower.includes('translation') || titleLower.includes('reflection')) {
    return 'coordinate-grid'
  }
  if (subtopicLower.includes('linear function') || titleLower.includes('slope') || titleLower.includes('graphing')) {
    return 'slope-graph'
  }
  if (subtopicLower.includes('similar') || subtopicLower.includes('congruence')) {
    return 'similar-triangles'
  }
  if (subtopicLower.includes('bivariate') || titleLower.includes('scatter')) {
    return 'scatter-plot'
  }
  if (subtopicLower.includes('system') && subtopicLower.includes('equation')) {
    return 'systems-of-equations'
  }
  if (subtopicLower.includes('exponent') || subtopicLower.includes('scientific notation')) {
    return 'exponents'
  }
  if (subtopicLower.includes('radical') || subtopicLower.includes('irrational')) {
    return 'number-line'
  }
  if (subtopicLower.includes('quadratic') || titleLower.includes('parabola')) {
    return 'parabola'
  }

  return null
}

// Generate SVG for a specific lesson with automatic diagram type detection
export async function generateLessonSVG(
  lessonTitle: string,
  subtopicName: string,
  levelName: string = '8th Grade',
  specificInstructions?: string
): Promise<{ svg: string; diagramType: string } | null> {
  const diagramType = getDiagramTypeForLesson(subtopicName, lessonTitle)

  if (!diagramType) {
    console.log(`No diagram type found for: ${subtopicName} - ${lessonTitle}`)
    return null
  }

  const svg = await generateSVG({
    lessonTitle,
    subtopicName,
    levelName,
    diagramType,
    specificInstructions,
  })

  return { svg, diagramType }
}
