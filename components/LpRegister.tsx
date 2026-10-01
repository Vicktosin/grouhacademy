import React from 'react'
import ApplyButton from './ApplyButton'

const LpRegister = () => {
  return (
    <section className="px-5 py-20 sm:px-8 sm:py-28" id="register">
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] bg-[#f0faed] px-6 py-14 text-center sm:px-12 sm:py-16">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full border-[40px] border-white/60" />
        <div className="relative">
          <p className="eyebrow">Ready to start?</p>
          <h2 className="mx-auto mt-5 max-w-3xl text-4xl font-black leading-tight tracking-[-0.035em] sm:text-5xl">
            Ready for your entrance examination? If you are admitted, you will pay a <span className="text-[#5FBB46]">₦3,000</span> acceptance fee to secure your internship.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-600">
            Take the entrance exam, choose your preferred track, and begin building practical
            digital skills and experience.
          </p>
          <ApplyButton />
          <div className="mx-auto mt-8 max-w-2xl rounded-xl border border-[#5FBB46]/25 bg-white/80 p-5 text-center text-[0.9375rem] leading-7 text-slate-600">
            <strong className="font-extrabold text-[#141650]">Please read before you register:</strong>{' '}
            Continue only if you understand and agree to pay the <span className="text-[#5FBB46]">₦3,000</span> acceptance fee after
            successfully passing the entrance examination.
          </div>
        </div>
      </div>
    </section>
  )
}

export default LpRegister
