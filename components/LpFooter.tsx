import React from 'react'
import Image from 'next/image'
import logo from '../public/logo.png'

const LpFooter = () => {
  return (
    <footer className="border-t border-slate-100 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-9 sm:px-8 md:flex-row md:items-center md:justify-between">
        <Image className="h-9 w-auto self-start md:self-center" src={logo} alt="Grouh Academy" />
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
