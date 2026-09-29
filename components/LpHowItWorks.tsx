import React from 'react'
import LpIcon, { EXAM_URL } from './LpIcon'

const steps = [
  ['Apply', 'Register and take our simple entrance examination.'],
  ['Entrance examination', 'Pass the examination and proceed with your admission.'],
  ['Confirm your place', 'Pay the ₦3,000 acceptance fee after selection.'],
  ['Start learning', 'Access your courses through our app at your own pace.'],
  ['Complete your tasks', 'Submit weekly work and participate in group projects.'],
  ['Graduate', 'Complete the programme, get certified, and join graduation.'],
]

const LpHowItWorks = () => {
  return (
    <section className="section" id="how-it-works">
      <div className="mx-auto grid max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-[.75fr_1.25fr] lg:gap-24">
        <div className="lg:sticky lg:top-32 lg:self-start">
          <p className="eyebrow justify-start">How it works</p>
          <h2 className="mt-4 max-w-md text-4xl font-black leading-tight tracking-[-0.03em] sm:text-5xl">Six simple steps to graduation.</h2>
          <p className="mt-5 max-w-md text-lg leading-8 text-slate-500">
            From application to certification, the process is clear and designed to keep you
            moving forward.
          </p>
          <a className="button-secondary mt-8" href={EXAM_URL}>
            Begin step one
            <LpIcon name="arrow" />
          </a>
        </div>
        <ol className="relative border-l border-[#dfe1f3] pl-7 sm:pl-10">
          {steps.map(([title, text], index) => (
            <li className="relative pb-10 last:pb-0" key={title}>
              <span className="absolute -left-[2.9rem] grid h-10 w-10 place-items-center rounded-full border-4 border-white bg-[#141650] text-xs font-black text-white sm:-left-[3.75rem]">
                {index + 1}
              </span>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#5FBB46]">
                Step {index + 1}
              </p>
              <h3 className="mt-1.5 text-xl font-extrabold sm:text-[1.375rem]">{title}</h3>
              <p className="mt-3 text-base leading-7 text-slate-500 sm:text-[1.0625rem]">{text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

export default LpHowItWorks
