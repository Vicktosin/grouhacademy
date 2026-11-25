import React from 'react'
import LpIcon, { EXAM_URL, type IconName } from './LpIcon'

const tracks: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'share',
    title: 'Digital Marketing',
    text: 'Attract customers, generate leads, build brands, and grow businesses online.',
  },
  {
    icon: 'code',
    title: 'Front-End Development',
    text: 'Build the visual and interactive parts of modern websites and applications.',
  },
  {
    icon: 'spark',
    title: 'AI for Content Creation',
    text: 'Use AI tools to create, enhance, and scale high-quality content.',
  },
  {
    icon: 'robot',
    title: 'AI Automation',
    text: 'Streamline repetitive tasks and workflows using AI and automation tools.',
  },
  {
    icon: 'web',
    title: 'Back-End Engineering',
    text: 'Learn the technology and logic that power applications behind the scenes.',
  },
  {
    icon: 'group',
    title: 'Social Media Marketing',
    text: 'Create, manage, grow, and market brands across social platforms.',
  },
  {
    icon: 'pen',
    title: 'WordPress / No-Code',
    text: 'Build functional websites and digital experiences without traditional programming.',
  },
  {
    icon: 'group',
    title: 'Virtual Assistant',
    text: 'Support clients from anywhere with email, calendars, research and admin.',
  },
  {
    icon: 'code',
    title: 'Cybersecurity',
    text: 'Protect people and companies from scams, leaks and attacks.',
  },
]

const LpTracks = () => {
  return (
    <section className="section bg-[#f7f8fd]" id="tracks">
      <div className="section-heading">
        <p className="eyebrow">Choose your career track</p>
        <h2>Explore the Skills We Have Below</h2>
        <p>Choose one focused path and build practical experience in a high-demand field.</p>
      </div>
      {/* Phones get an accordion so every track title fits on one screen; sharing a
          `name` makes the <details> exclusive, so opening one closes the others. */}
      <div className="mx-auto mt-10 max-w-xl space-y-3 px-5 sm:px-8 md:hidden">
        {tracks.map((track, index) => (
          <details
            className="group rounded-2xl border border-[#e8e9f8] bg-white transition open:border-[#5FBB46]/50 open:shadow-lg open:shadow-[#141650]/5"
            key={track.title}
            name="career-track"
            open={index === 0}
          >
            <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#141650] text-white">
                <LpIcon name={track.icon} />
              </span>
              <h3 className="flex-1 text-center text-base font-extrabold leading-snug">{track.title}</h3>
              <LpIcon
                name="chevron"
                className="h-5 w-5 shrink-0 text-slate-400 transition group-open:rotate-180 group-open:text-[#469f3c]"
              />
            </summary>
            <div className="px-4 pb-4 text-center">
              <p className="text-sm leading-6 text-slate-500">{track.text}</p>
              <a
                className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[#469f3c]"
                href={EXAM_URL}
              >
                Choose this track <LpIcon name="arrow" className="h-4 w-4" />
              </a>
            </div>
          </details>
        ))}
      </div>
      <div className="mx-auto mt-14 hidden max-w-7xl gap-4 px-5 sm:px-8 md:grid md:grid-cols-2 lg:grid-cols-3">
        {tracks.map((track, index) => (
          <article
            className={`group relative flex min-h-52 flex-col items-center rounded-2xl border border-[#e8e9f8] bg-white p-7 text-center transition duration-300 hover:border-[#5FBB46]/50 hover:shadow-xl hover:shadow-[#141650]/5 ${
              index === 6 ? 'md:col-span-2 lg:col-span-1 lg:col-start-2' : ''
            }`}
            key={track.title}
          >
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#141650] text-white">
              <LpIcon name={track.icon} />
            </span>
            <span className="absolute right-7 top-7 text-xs font-black text-slate-300">
              {String(index + 1).padStart(2, '0')}
            </span>
            <h3 className="mt-6 text-xl font-extrabold">{track.title}</h3>
            <p className="mt-3 text-[0.9375rem] leading-6 text-slate-500">{track.text}</p>
            {/* The link's overlay makes the whole card clickable. */}
            <a
              className="mt-auto flex items-center gap-2 pt-6 text-[0.9375rem] font-bold text-[#469f3c] opacity-80 transition after:absolute after:inset-0 after:rounded-2xl group-hover:gap-3 group-hover:opacity-100"
              href={EXAM_URL}
            >
              Choose this track <LpIcon name="arrow" className="h-4 w-4" />
            </a>
          </article>
        ))}
      </div>
    </section>
  )
}

export default LpTracks
