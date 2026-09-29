import React from 'react'
import LpIcon from './LpIcon'
import { COMMUNITY_URL } from '@/lib/community'

const requirements = [
  ['Pass the entrance examination', 'Complete and pass our simple examination before admission.'],
  ['Pay the ₦1,000 acceptance fee', 'Only successful applicants pay this fee to confirm their place.'],
]

const LpCommunity = () => {
  return (
    <section className="section bg-[#141650] text-white" id="community">
      <div className="mx-auto max-w-4xl px-5 text-center sm:px-8">
        <div>
          <p className="eyebrow text-[#8ed77d] before:bg-[#5FBB46]">Join our community</p>
          <h2 className="mt-5 text-5xl font-black leading-none tracking-[-0.04em] sm:text-6xl">
            Are you still <span className="text-[#73cf60]">undecided?</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-white/65">
            Join our community to learn more about the program
            and get answers to your questions. You can also connect with other applicants
            and interns to learn about their experiences.
          </p>
          <a
            className="button-primary mt-9 text-base"
            href={COMMUNITY_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Join our community
            <LpIcon name="group" />
          </a>
        </div>
       {/* <div className="rounded-[1.75rem] bg-white p-6 text-[#141650] shadow-2xl sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">
            Two admission requirements
          </p>
          <div className="mt-6 space-y-6">
            {requirements.map(([title, text], index) => (
              <React.Fragment key={title}>
                {index > 0 && <div className="h-px bg-slate-100" />}
                <div className="flex gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#eff9ed] font-black text-[#4aaa3e]">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h3 className="text-lg font-extrabold">{title}</h3>
                    <p className="mt-1 text-[0.9375rem] leading-6 text-slate-500">{text}</p>
                  </div>
                </div>
              </React.Fragment>
            ))}
          </div>
          <div className="mt-7 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
            The acceptance fee is only required after you successfully pass the entrance
            examination.
          </div>
        </div>*/}
      </div>
    </section>
  )
}

export default LpCommunity
