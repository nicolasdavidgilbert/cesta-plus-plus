'use client'

import React from 'react'

interface PremiumInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  icon?: React.ReactNode
}

export function PremiumInput({ label, error, icon, ...props }: PremiumInputProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </label>
      <div className="group relative">
        {icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-[#fb923c]">
            {icon}
          </div>
        )}
        <input
          {...props}
          className={`w-full rounded-2xl border bg-white/5 px-4 py-3.5 text-sm text-white outline-none transition-all placeholder:text-slate-600 hover:bg-white/10 focus:bg-slate-900/50 ${
            icon ? 'pl-11' : 'pl-4'
          } ${
            error 
              ? 'border-rose-500/50 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10' 
              : 'border-white/10 focus:border-[#fb923c] focus:ring-4 focus:ring-[#fb923c]/10'
          }`}
        />
        <div className="pointer-events-none absolute inset-0 rounded-2xl shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.1)] opacity-50" />
      </div>
      {error && (
        <p className="mt-1 text-xs font-medium text-rose-400">{error}</p>
      )}
    </div>
  )
}
