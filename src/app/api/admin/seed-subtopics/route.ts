import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'

// Subtopics data - copied from prisma/seed.ts
const subtopicsByLevel: Record<string, Record<string, { name: string; prompt: string }[]>> = {
  Math: {
    '1st Grade': [
      { name: 'Counting & Number Sense', prompt: 'Counting numbers to 120, skip counting by 2s, 5s, and 10s' },
      { name: 'Place Value', prompt: 'Understanding place value for tens and ones' },
      { name: 'Compare & Order Numbers', prompt: 'Comparing and ordering numbers using greater than, less than, and equal to' },
      { name: 'Addition & Subtraction', prompt: 'Addition and subtraction within 20, related facts and fact families' },
      { name: 'Number Patterns', prompt: 'Identifying and extending number patterns' },
      { name: 'Word Problems', prompt: 'Basic word problems involving addition and subtraction' },
      { name: 'Time', prompt: 'Telling time to the hour and half-hour on analog and digital clocks' },
      { name: 'Money', prompt: 'Identifying coins and counting simple totals' },
      { name: 'Measurement', prompt: 'Measuring length using nonstandard and standard units' },
      { name: '2D & 3D Shapes', prompt: 'Identifying and describing 2D and 3D shapes and their attributes' },
    ],
    '2nd Grade': [
      { name: 'Place Value', prompt: 'Understanding place value to 1,000 (ones, tens, hundreds)' },
      { name: 'Addition & Subtraction', prompt: 'Adding and subtracting within 100 and 1,000 with regrouping' },
      { name: 'Skip Counting & Patterns', prompt: 'Skip counting, even/odd numbers, and number patterns' },
      { name: 'Multiplication Foundations', prompt: 'Introduction to multiplication using arrays and repeated addition' },
      { name: 'Division Foundations', prompt: 'Introduction to division using equal groups and sharing' },
      { name: 'Fractions Introduction', prompt: 'Understanding halves, thirds, and fourths as equal parts' },
      { name: 'Measurement', prompt: 'Measuring length, mass, and volume using metric and customary units' },
      { name: 'Time', prompt: 'Telling time to 5-minute intervals and basic elapsed time' },
      { name: 'Money', prompt: 'Making change and solving money word problems' },
      { name: 'Geometry', prompt: 'Shapes, partitioning shapes, and symmetry basics' },
    ],
    '3rd Grade': [
      { name: 'Multiplication & Division Facts', prompt: 'Multiplication and division facts and strategies through 10x10' },
      { name: 'Multi-step Word Problems', prompt: 'Solving multi-step word problems with all operations' },
      { name: 'Place Value & Rounding', prompt: 'Place value to 10,000 and rounding to nearest 10 and 100' },
      { name: 'Multi-digit Add & Subtract', prompt: 'Adding and subtracting multi-digit numbers with regrouping' },
      { name: 'Fractions', prompt: 'Unit fractions, equivalent fractions, and comparing fractions' },
      { name: 'Area & Perimeter', prompt: 'Calculating area and perimeter of rectangles using arrays' },
      { name: 'Measurement', prompt: 'Measuring time, liquid volume, and mass' },
      { name: 'Data & Graphs', prompt: 'Creating and interpreting bar graphs and line plots' },
      { name: 'Geometry', prompt: 'Introduction to angles, quadrilaterals, and polygons' },
    ],
    '4th Grade': [
      { name: 'Place Value & Rounding', prompt: 'Place value to 1,000,000 and rounding multi-digit numbers' },
      { name: 'Multi-digit Multiplication', prompt: 'Multiplying multi-digit numbers using standard algorithm' },
      { name: 'Long Division', prompt: 'Dividing multi-digit numbers by 1-digit divisors' },
      { name: 'Factors & Multiples', prompt: 'Finding factors, multiples, prime and composite numbers' },
      { name: 'Fraction Operations', prompt: 'Adding and subtracting fractions with like denominators, equivalence' },
      { name: 'Decimals', prompt: 'Understanding decimals to hundredths, comparing and ordering' },
      { name: 'Measurement Conversions', prompt: 'Converting between units within metric and customary systems' },
      { name: 'Angle Measurement', prompt: 'Measuring angles with a protractor, understanding lines and rays' },
      { name: 'Area & Perimeter', prompt: 'Area and perimeter of various shapes, introduction to volume with unit cubes' },
      { name: 'Data Interpretation', prompt: 'Creating and interpreting multi-category graphs' },
    ],
    '5th Grade': [
      { name: 'Decimal Operations', prompt: 'Adding, subtracting, multiplying, and dividing decimals' },
      { name: 'Fraction Operations', prompt: 'All four operations with fractions and mixed numbers' },
      { name: 'Place Value', prompt: 'Place value with decimals to thousandths' },
      { name: 'Order of Operations', prompt: 'Order of operations and evaluating numerical expressions' },
      { name: 'Coordinate Plane', prompt: 'Graphing points and patterns on the coordinate plane' },
      { name: 'Volume', prompt: 'Volume of rectangular prisms and additive volume' },
      { name: 'Measurement Conversions', prompt: 'Measurement conversions and problem solving' },
      { name: 'Geometry', prompt: 'Classifying 2D figures and understanding angle relationships' },
      { name: 'Data Analysis', prompt: 'Line plots with fractions and decimals' },
    ],
    '6th Grade': [
      { name: 'Ratios & Rates', prompt: 'Understanding ratios, rates, and unit rates' },
      { name: 'Fractions, Decimals & Percents', prompt: 'Converting between fractions, decimals, and percents' },
      { name: 'Integers & Number Lines', prompt: 'Positive and negative integers on number lines' },
      { name: 'Expressions & Equations', prompt: 'Variables, simplifying expressions, solving 1-step and 2-step equations' },
      { name: 'Inequalities', prompt: 'Writing and solving simple inequalities' },
      { name: 'Area & Surface Area', prompt: 'Area of triangles and parallelograms, introduction to surface area' },
      { name: 'Volume', prompt: 'Volume of prisms' },
      { name: 'Statistics', prompt: 'Mean, median, variability, dot plots, and histograms' },
      { name: 'Coordinate Plane', prompt: 'All four quadrants and distance along axes' },
    ],
    '7th Grade': [
      { name: 'Proportional Relationships', prompt: 'Proportional relationships, scale drawings, percent increase/decrease' },
      { name: 'Rational Number Operations', prompt: 'Operations with fractions, decimals, and integers' },
      { name: 'Expressions', prompt: 'Distributing, combining like terms, and simplifying expressions' },
      { name: 'Linear Equations & Inequalities', prompt: 'Solving multi-step equations and inequalities' },
      { name: 'Geometry', prompt: 'Angles, triangles, and circles basics' },
      { name: 'Area & Volume', prompt: 'Area and volume of more complex shapes' },
      { name: 'Probability', prompt: 'Probability of compound events' },
      { name: 'Statistics', prompt: 'Sampling, inference basics, and comparing distributions' },
    ],
    '8th Grade': [
      { name: 'Linear Functions', prompt: 'Slope, intercepts, and graphing linear functions' },
      { name: 'Systems of Equations', prompt: 'Solving systems by graphing, substitution, and elimination' },
      { name: 'Exponents & Scientific Notation', prompt: 'Laws of exponents and scientific notation' },
      { name: 'Radicals & Irrational Numbers', prompt: 'Square roots and understanding irrational numbers' },
      { name: 'Pythagorean Theorem', prompt: 'Pythagorean theorem and introduction to distance formula' },
      { name: 'Transformations', prompt: 'Translations, rotations, reflections, and dilations' },
      { name: 'Similarity & Congruence', prompt: 'Foundations of similarity and congruence' },
      { name: 'Bivariate Data', prompt: 'Scatter plots and trend lines' },
      { name: 'Intro to Quadratics', prompt: 'Quadratic patterns and factoring intuition' },
    ],
    'Algebra 1': [
      { name: 'Solving Linear Equations', prompt: 'Solving linear equations with variables on both sides' },
      { name: 'Graphing Lines', prompt: 'Graphing lines in slope-intercept, point-slope, and standard form' },
      { name: 'Systems of Equations', prompt: 'Solving systems using substitution, elimination, and graphing' },
      { name: 'Systems of Inequalities', prompt: 'Graphing and solving systems of linear inequalities' },
      { name: 'Functions', prompt: 'Function notation, domain, range, and function types' },
      { name: 'Polynomials', prompt: 'Operations with polynomials, factoring, and special products' },
      { name: 'Quadratics', prompt: 'Factoring, completing the square, quadratic formula, and graphing parabolas' },
      { name: 'Exponents & Radicals', prompt: 'Laws of exponents and rational exponents' },
      { name: 'Rational Expressions', prompt: 'Simplifying and solving rational expressions and equations' },
      { name: 'Exponential Functions', prompt: 'Exponential growth and decay' },
      { name: 'Modeling', prompt: 'Modeling word problems with linear, quadratic, and exponential functions' },
    ],
    'Geometry': [
      { name: 'Points, Lines & Planes', prompt: 'Basic geometric elements, angles, and introduction to proofs' },
      { name: 'Triangle Congruence', prompt: 'Triangle congruence theorems: SSS, SAS, ASA, AAS, HL' },
      { name: 'Similarity', prompt: 'Scale factor, triangle similarity, and proportions' },
      { name: 'Parallel Lines & Transversals', prompt: 'Angle relationships with parallel lines and transversals' },
      { name: 'Polygons & Quadrilaterals', prompt: 'Properties of polygons, parallelograms, and special quadrilaterals' },
      { name: 'Circles', prompt: 'Arcs, chords, angles, and tangents in circles' },
      { name: 'Coordinate Geometry', prompt: 'Distance, midpoint, slope, and coordinate proofs' },
      { name: 'Area & Perimeter', prompt: 'Area and perimeter of 2D figures' },
      { name: 'Surface Area & Volume', prompt: 'Surface area and volume of 3D solids' },
      { name: 'Transformations', prompt: 'Rigid motions and symmetry' },
      { name: 'Right Triangle Trigonometry', prompt: 'Trigonometric ratios in right triangles' },
    ],
    'Algebra 2': [
      { name: 'Advanced Functions', prompt: 'Transformations, composition, and inverse functions' },
      { name: 'Polynomial Functions', prompt: 'End behavior, zeros, division, and remainder theorem' },
      { name: 'Complex Numbers', prompt: 'Operations with complex numbers' },
      { name: 'Rational Functions', prompt: 'Asymptotes and solving rational equations' },
      { name: 'Radical Functions', prompt: 'Radical functions and equations' },
      { name: 'Exponential & Logarithmic Functions', prompt: 'Properties of exponential and logarithmic functions and equations' },
      { name: 'Quadratic Systems', prompt: 'Quadratic systems and inequalities' },
      { name: 'Sequences & Series', prompt: 'Arithmetic and geometric sequences and series, sigma notation' },
      { name: 'Conic Sections', prompt: 'Parabolas, circles, ellipses, and hyperbolas' },
      { name: 'Probability & Statistics', prompt: 'Normal distribution, regression, and combinatorics' },
    ],
    'Pre-Calculus': [
      { name: 'Function Families', prompt: 'Polynomial, rational, exponential, logarithmic, and trig function families' },
      { name: 'Trigonometry', prompt: 'Unit circle, trig identities, and trig equations' },
      { name: 'Trig Graphs & Inverse Trig', prompt: 'Graphing trig functions and inverse trig functions' },
      { name: 'Vectors & Parametric Equations', prompt: 'Vector operations and parametric equations' },
      { name: 'Polar Coordinates', prompt: 'Polar coordinates and complex plane' },
      { name: 'Conic Sections Review', prompt: 'Review and extension of conic sections' },
      { name: 'Sequences & Series', prompt: 'Sequences, series, and convergence intuition' },
      { name: 'Matrices', prompt: 'Matrix operations, systems, and transformations' },
      { name: 'Limits & Continuity', prompt: 'Introduction to limits and continuity for calculus' },
      { name: 'Function Modeling', prompt: 'Modeling with periodic, exponential, logarithmic, and rational functions' },
    ],
    'Calculus': [
      { name: 'Limits & Continuity', prompt: 'Evaluating limits, limit laws, and continuity' },
      { name: 'Derivatives', prompt: 'Derivative rules, implicit differentiation, and related rates' },
      { name: 'Applications of Derivatives', prompt: 'Optimization, curve sketching, and motion' },
      { name: 'Integrals', prompt: 'Riemann sums, definite/indefinite integrals, and the Fundamental Theorem of Calculus' },
      { name: 'Integration Techniques', prompt: 'U-substitution and other integration techniques' },
      { name: 'Applications of Integrals', prompt: 'Area, volume, accumulation, and average value' },
      { name: 'Differential Equations', prompt: 'Growth/decay and separable differential equations' },
      { name: 'Sequences & Series', prompt: 'Sequences, series, and convergence tests (Calc BC)' },
      { name: 'Parametric & Polar Calculus', prompt: 'Derivatives and integrals in parametric and polar form' },
      { name: 'Numerical Methods', prompt: 'Approximation, error analysis, and trapezoidal rule' },
    ],
  },
}

const mathLevels = [
  '1st Grade', '2nd Grade', '3rd Grade', '4th Grade', '5th Grade',
  '6th Grade', '7th Grade', '8th Grade', 'Algebra 1', 'Geometry',
  'Algebra 2', 'Pre-Calculus', 'Calculus',
]

// POST /api/admin/seed-subtopics - Seed Math subtopics
export async function POST(request: Request) {
  try {
    // Allow authentication via session or admin secret key
    const adminKey = request.headers.get('x-admin-key')
    const validAdminKey = process.env.SESSION_SECRET

    if (adminKey !== validAdminKey) {
      const session = await getSession()
      if (!session.userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    // Get or create Math subject
    const mathSubject = await prisma.subject.upsert({
      where: { name: 'Math' },
      update: {},
      create: { name: 'Math', icon: '📐', sortOrder: 1 },
    })

    const results = {
      levelsCreated: 0,
      subtopicsCreated: 0,
      subtopicsUpdated: 0,
    }

    for (let i = 0; i < mathLevels.length; i++) {
      const levelName = mathLevels[i]

      // Upsert level
      const level = await prisma.level.upsert({
        where: {
          subjectId_name: {
            subjectId: mathSubject.id,
            name: levelName,
          },
        },
        update: {},
        create: {
          subjectId: mathSubject.id,
          name: levelName,
          sortOrder: i + 1,
        },
      })

      // Track if level was just created (no subtopics yet)
      const existingSubtopics = await prisma.subtopic.count({
        where: { levelId: level.id },
      })
      if (existingSubtopics === 0) {
        results.levelsCreated++
      }

      // Seed subtopics for this level
      const subtopics = subtopicsByLevel.Math?.[levelName] || []
      for (let j = 0; j < subtopics.length; j++) {
        const existing = await prisma.subtopic.findUnique({
          where: {
            levelId_name: {
              levelId: level.id,
              name: subtopics[j].name,
            },
          },
        })

        await prisma.subtopic.upsert({
          where: {
            levelId_name: {
              levelId: level.id,
              name: subtopics[j].name,
            },
          },
          update: {
            prompt: subtopics[j].prompt,
            sortOrder: j + 1,
          },
          create: {
            levelId: level.id,
            name: subtopics[j].name,
            prompt: subtopics[j].prompt,
            sortOrder: j + 1,
          },
        })

        if (existing) {
          results.subtopicsUpdated++
        } else {
          results.subtopicsCreated++
        }
      }
    }

    // Get total counts
    const totalMathSubtopics = await prisma.subtopic.count({
      where: {
        level: {
          subject: { name: 'Math' },
        },
      },
    })

    return NextResponse.json({
      message: 'Math subtopics seeded successfully',
      results,
      totalMathSubtopics,
    })
  } catch (error) {
    console.error('Seed subtopics error:', error)
    return NextResponse.json(
      { error: 'Failed to seed subtopics', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// GET /api/admin/seed-subtopics - Check current Math subtopic status
export async function GET(request: Request) {
  try {
    const adminKey = request.headers.get('x-admin-key')
    const validAdminKey = process.env.SESSION_SECRET

    if (adminKey !== validAdminKey) {
      const session = await getSession()
      if (!session.userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const mathSubject = await prisma.subject.findUnique({
      where: { name: 'Math' },
      include: {
        levels: {
          include: {
            _count: { select: { subtopics: true } },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    })

    if (!mathSubject) {
      return NextResponse.json({ error: 'Math subject not found' }, { status: 404 })
    }

    const levelStats = mathSubject.levels.map((level) => ({
      name: level.name,
      subtopicCount: level._count.subtopics,
    }))

    const totalSubtopics = levelStats.reduce((sum, l) => sum + l.subtopicCount, 0)

    return NextResponse.json({
      subject: 'Math',
      levels: levelStats,
      totalLevels: mathSubject.levels.length,
      totalSubtopics,
    })
  } catch (error) {
    console.error('Get subtopics status error:', error)
    return NextResponse.json(
      { error: 'Failed to get status' },
      { status: 500 }
    )
  }
}
