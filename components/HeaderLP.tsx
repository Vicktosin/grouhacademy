'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import LpIcon, { EXAM_URL } from './LpIcon'
import logo from '../public/logo.png'

const navLinks = [
  ['What you get', '#benefits'],
  ['Career tracks', '#tracks'],
  ['How it works', '#how-it-works'],
  ['Tuition', '#tuition'],
] as const

const HeaderLP = () => {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 sm:px-8">
        <a href="#top" aria-label="Grouh Academy home">
          <Image className="h-10 w-auto" src={logo} alt="Grouh Academy" priority />
        </a>
        <nav className="hidden items-center gap-8 text-sm font-semibold text-[#141650]/75 lg:flex">
          {navLinks.map(([label, href]) => (
            <a className="nav-link" href={href} key={href}>
              {label}
            </a>
          ))}
        </nav>
        <a className="button-primary hidden lg:inline-flex" href={EXAM_URL}>
          Take the entrance exam
          <LpIcon name="arrow" className="h-4 w-4" />
        </a>
        <button
          className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 text-[#141650] lg:hidden"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
        >
          <LpIcon name={menuOpen ? 'x' : 'menu'} />
        </button>
      </div>
      {menuOpen && (
        <nav className="border-t border-slate-100 bg-white px-5 py-5 lg:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1">
            {navLinks.map(([label, href]) => (
              <a
                className="rounded-xl px-3 py-3 font-semibold hover:bg-slate-50"
                href={href}
                key={href}
                onClick={() => setMenuOpen(false)}
              >
                {label}
              </a>
            ))}
            <a className="button-primary mt-3" href={EXAM_URL} onClick={() => setMenuOpen(false)}>
              Take the entrance exam
            </a>
          </div>
        </nav>
      )}
    </header>
  )
}

export default HeaderLP
