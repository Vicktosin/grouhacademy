import React from 'react'

const requirements = [
  ['Pass the entrance examination', 'Complete and pass our simple examination before admission.'],
  ['Pay the ₦1,000 acceptance fee', 'Only successful applicants pay this fee to confirm their place.'],
]

const LpTuition = () => {
  return (
    <section className="section bg-[#141650] text-white" id="tuition">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[1fr_.9fr] lg:items-center lg:gap-20">
        <div>
          <p className="eyebrow text-[#8ed77d] before:bg-[#5FBB46]">Tuition is free</p>
          <h2 className="mt-5 text-5xl font-black leading-none tracking-[-0.04em] sm:text-6xl">
            Yes. Your tuition costs <span className="text-[#73cf60]">₦0.</span>
          </h2>
          <p className="mt-6 max-w-xl text-lg leading-8 text-white/65">
            Financial limitations should not prevent you from gaining valuable digital skills.
            That is why tuition for this internship is completely free.
          </p>
        </div>
        <div className="rounded-[1.75rem] bg-white p-6 text-[#141650] shadow-2xl sm:p-8">
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
        </div>
      </div>
    </section>
  )
}

export default LpTuition
