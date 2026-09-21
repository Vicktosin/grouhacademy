export function isCoursePricingEnabled() {
  return process.env.COURSE_PRICING_ENABLED === 'true'
}

export function effectiveCoursePrice(price: number) {
  return isCoursePricingEnabled() ? price : 0
}