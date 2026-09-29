import React from 'react'
import Image from 'next/image'
import LpIcon, { EXAM_URL } from './LpIcon'
import heroImage from '../public/internship-team.jpg'

const LpHero = () => {
  return (
    <section className="relative overflow-hidden bg-[#f7faf7]">
      <div className="hero-grid pointer-events-none absolute inset-0" />
      <div className="mx-auto grid min-h-[calc(100vh-76px)] max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:py-20">
        <div className="relative z-10 max-w-2xl">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#5FBB46]/25 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#368a30] shadow-sm">
            <span className="h-2 w-2 rounded-full bg-[#5FBB46]" />
            Applications are now open
          </div>
          <h1 className="text-[clamp(2.8rem,6vw,5.3rem)] font-black leading-[.98] tracking-[-0.045em] text-[#141650]">
            Our internship builds{' '}
            <span className="relative whitespace-nowrap text-[#5FBB46]">experience.</span>
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-slate-600 sm:text-xl">
            A 1-month virtual internship for aspiring digital professionals. Learn
            career-ready skills through practical lessons, weekly tasks, and real group projects.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <a className="button-primary text-base" href={EXAM_URL}>
              Take the entrance exam
              <LpIcon name="arrow" />
            </a>
            <a className="button-secondary text-base" href="#tracks">
              Explore career tracks
            </a>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-7 gap-y-3 text-sm font-semibold text-[#141650]/70">
            {['₦0 tuition', '100% virtual', 'Certificate included'].map((item) => (
              <span className="flex items-center gap-2" key={item}>
                <span className="grid h-5 w-5 place-items-center rounded-full bg-[#5FBB46]/15 text-[#429c38]">
                  <LpIcon name="check" className="h-3.5 w-3.5" />
                </span>
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[570px] lg:mx-0 lg:ml-auto">
          <div className="absolute -left-6 top-14 h-32 w-32 rounded-full bg-[#5FBB46]/15 blur-2xl" />
          <div className="relative overflow-hidden rounded-[2rem] bg-[#141650] p-2.5 shadow-[0_30px_80px_-28px_rgba(20,22,80,.45)]">
            <Image
              className="aspect-[4/3] w-full rounded-[1.45rem] object-cover"
              src={heroImage}
              alt="Young professionals collaborating on a digital project"
              priority
            />
            <div className="absolute inset-x-6 bottom-6 rounded-2xl border border-white/20 bg-[#141650]/90 p-4 text-white shadow-xl backdrop-blur-md">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#9cdb8d]">
                    1 month. Real experience.
                  </p>
                  <p className="mt-1 font-bold">Learn, practise, collaborate.</p>
                </div>
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#5FBB46]">
                  <LpIcon name="play" />
                </span>
              </div>
            </div>
          </div>
          <div className="absolute -right-3 -top-5 hidden rounded-2xl bg-white p-4 shadow-xl sm:block">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#f0faed] text-[#4aaa3e]">
                <LpIcon name="trophy" />
              </span>
              <div>
                <p className="text-xs text-slate-500">Graduate with a</p>
                <p className="text-sm font-extrabold text-[#141650]">Certificate</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default LpHero
