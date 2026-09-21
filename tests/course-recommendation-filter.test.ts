import test from 'node:test'
import assert from 'node:assert/strict'

import { buildCourseRecommendationFilter } from '../lib/course-recommendation-filter'

type FilterClause = {
  category?: {
    is?: {
      name?: {
        contains?: string
        mode?: 'insensitive'
      }
    }
  }
  title?: {
    contains?: string
    mode?: 'insensitive'
  }
  slug?: {
    contains?: string
    mode?: 'insensitive'
  }
}

test('buildCourseRecommendationFilter prefers matching category and title tokens', () => {
  const filter = buildCourseRecommendationFilter(['Product Design', 'UX Research']) as { OR?: FilterClause[] } | undefined

  assert.ok(filter)
  assert.ok(Array.isArray(filter.OR))
  assert.equal((filter.OR?.length ?? 0) > 0, true)
  assert.equal(filter.OR?.some((clause) => clause.category?.is?.name?.contains === 'product design') ?? false, true)
  assert.equal(filter.OR?.some((clause) => clause.title?.contains === 'product design') ?? false, true)
})
