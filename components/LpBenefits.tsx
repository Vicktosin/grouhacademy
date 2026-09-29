import React from 'react'
import LpIcon, { type IconName } from './LpIcon'

const benefits: { icon: IconName; title: string; text: string }[] = [
  /*{
    icon: 'book',
    title: 'Learn in-demand skills',
    text: 'Build practical skills for your career, freelance work, business, or professional growth.',
  },*/
  {
    icon: 'phone',
    title: 'Learn 100% online',
    text: 'Access every class through our app and learn at your own pace, from wherever you are.',
  },
  {
    icon: 'pen',
    title: 'Take on Jobs/tasks',
    text: 'Experience work life by taking on real office-like responsibilities and tasks using the skills you learn.',
  },
  {
    icon: 'group',
    title: 'Work with a team',
    text: 'Work with other interns and gain practical experience in teamwork and communication.',
  },
  {
    icon: 'trophy',
    title: 'Certificate & graduation',
    text: 'Meet the programme requirements, download your certificate, and join our graduation ceremony.',
  },
]

const LpBenefits = () => {
  return (
    <section className="py-[6.5rem] max-sm:py-[4.75rem]" id="benefits">
          <div className="mx-auto max-w-3xl px-5 text-center">
            <p className="eyebrow">What you get</p>
            <h2 className="mt-5 text-[clamp(2.25rem,5vw,3.5rem)] font-black leading-[1.08] tracking-[-0.035em]">
              Why This is Unique
            </h2>
            <p className="mx-auto mt-5 max-w-[41rem] text-[1.08rem] leading-[1.8] text-slate-500">
              This is not just another online course. It is a focused experience designed
              to help you practise, collaborate, and build confidence.
            </p>
          </div>
          <div className="mx-auto mt-14 grid max-w-7xl gap-5 px-5 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
            {benefits.map((benefit, index) => (
              <article
                key={benefit.title}
                className={`group rounded-2xl border border-slate-200 bg-white p-6 text-center transition duration-300 hover:-translate-y-1 hover:border-[#5FBB46]/40 hover:shadow-xl hover:shadow-slate-200/60 ${
                  index === 4 ? "sm:col-span-2 lg:col-span-1" : ""
                }`}
              >
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#f0faed] text-[#429c38] transition group-hover:bg-[#5FBB46] group-hover:text-white">
                   <LpIcon name={benefit.icon} />
                </span>
                <h3 className="mt-5 text-lg font-extrabold">{benefit.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{benefit.text}</p>
              </article>
            ))}
          </div>
        </section>
  )
}

export default LpBenefits
