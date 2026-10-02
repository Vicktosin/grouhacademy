'use client'

import React, { useSyncExternalStore } from 'react'

const DAY_MS = 24 * 60 * 60 * 1000
// The countdown resets at midnight West Africa Time (UTC+1, no daylight
// saving), so every visitor sees the same deadline.
const WAT_OFFSET_MS = 60 * 60 * 1000

const subscribe = (onTick: () => void) => {
  const id = setInterval(onTick, 1000)
  return () => clearInterval(id)
}

// Snapshot is whole seconds so it stays stable between ticks.
const getSeconds = () => Math.floor(Date.now() / 1000)
const getServerSeconds = () => null

const pad = (value: number) => String(value).padStart(2, '0')

const LpCountdown = () => {
  const seconds = useSyncExternalStore(subscribe, getSeconds, getServerSeconds)

  let units: [string, string][] = [
    ['--', 'Hrs'],
    ['--', 'Min'],
    ['--', 'Sec'],
  ]
  if (seconds !== null) {
    const remaining = Math.ceil((DAY_MS - ((seconds * 1000 + WAT_OFFSET_MS) % DAY_MS)) / 1000)
    units = [
      [pad(Math.floor(remaining / 3600) % 24), 'Hrs'],
      [pad(Math.floor(remaining / 60) % 60), 'Min'],
      [pad(remaining % 60), 'Sec'],
    ]
  }

  return (
    <div className="bg-[#141650] text-white">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-center gap-2 px-5 py-3 sm:flex-row sm:gap-5 sm:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#9cdb8d]">
          Applications for today close in
        </p>
        <div className="flex items-center gap-2" role="timer" aria-live="off">
          {units.map(([value, label], index) => (
            <React.Fragment key={label}>
              {index > 0 && <span className="text-lg font-black text-white/40">:</span>}
              <span className="flex items-baseline gap-1">
                <span className="min-w-[2ch] text-xl font-black tabular-nums">{value}</span>
                <span className="text-[0.65rem] font-bold uppercase text-white/60">{label}</span>
              </span>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}

export default LpCountdown
