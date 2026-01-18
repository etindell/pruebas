import { createHash } from 'crypto'

/**
 * Normalizes question text for consistent hashing
 * - Converts to lowercase
 * - Removes extra whitespace
 * - Removes punctuation that might vary
 */
function normalizeQuestion(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,!?;:'"]/g, '')
    .trim()
}

/**
 * Creates a SHA-256 hash of normalized question text for deduplication
 */
export function hashQuestion(text: string): string {
  const normalized = normalizeQuestion(text)
  return createHash('sha256').update(normalized).digest('hex')
}

/**
 * Checks if a question hash already exists in the exclusion set
 */
export function isDuplicateQuestion(questionHash: string, existingHashes: Set<string>): boolean {
  return existingHashes.has(questionHash)
}
