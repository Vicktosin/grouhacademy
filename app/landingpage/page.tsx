import React from 'react'
import { Lato } from 'next/font/google'
import HeaderLP from '@/components/HeaderLP'
import LpHero from '@/components/LpHero'
import LpBenefits from '@/components/LpBenefits'
import LpTracks from '@/components/LpTracks'
import LpHowItWorks from '@/components/LpHowItWorks'
import LpCommunity from '@/components/LpCommunity'
import LpRegister from '@/components/LpRegister'
import LpFooter from '@/components/LpFooter'

// The landing page's display headings need Lato's heavy face, which the
// root layout does not load.
const lato = Lato({ subsets: ['latin'], weight: ['400', '700', '900'], display: 'swap' })

const page = () => {
  return (
    <div className={`lp ${lato.className} min-h-screen bg-white text-[#141650]`}>
      <HeaderLP />
      <main id="top">
        <LpHero />
        <LpTracks />
        <LpBenefits />
        <LpHowItWorks />
        <LpRegister />
        <LpCommunity />
      </main>
      <LpFooter />
    </div>
  )
}

export default page
