import React from 'react'
import Image from 'next/image'
import logo from '../public/logo.png'

const LpFooter = () => {
  return (
    <footer className="border-t border-slate-100 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-5 py-9 text-center sm:px-8">
        <Image className="h-9 w-auto" src={logo} alt="Grouh Academy" />
        <p className="text-sm text-slate-500">
          Practical digital skills. Real experience. A stronger start.
        </p>
        <div className="flex items-center gap-5 text-sm font-semibold text-[#141650]">
          <a className="hover:text-[#4aaa3e]" href="mailto:hello@grouhacademy.space">
            Contact
          </a>
          <a className="hover:text-[#4aaa3e]" href="#tuition">
            Admissions
          </a>
        </div>
      </div>
    </footer>
  )
}

export default LpFooter
