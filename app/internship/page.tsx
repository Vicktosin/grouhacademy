import React from 'react'
import InternshipHero from '@/components/InternshipHero'
import HowItWorks from '@/components/HowItWorks'
import WhoShouldApply from '@/components/WhoShouldApply'
import Benefits from '@/components/Benefits'
import Requirements from '@/components/Requirements'
import InternshipTimeline from '@/components/InternshipTimeline'
import AssessmentProcess from '@/components/AssessmentProcess'
import InternshipPricing from '@/components/InternshipPricing'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tech Internship Programs and Career Experience',
  description: 'Apply for a practical tech internship with structured learning, expert mentorship, assessments, projects, and career-focused support.',
  alternates: { canonical: '/internship' },
};

const page = () => {
  return (
    <div>
      < InternshipHero />
      < HowItWorks />
      < WhoShouldApply />
      <Benefits />
      <Requirements />
      <InternshipTimeline />
      <AssessmentProcess />
      <InternshipPricing />
    </div>
  )
}

export default page
