'use client'

import React from 'react'
import Link from 'next/link'
import { MeshBackground } from './MeshBackground'

interface AuthLayoutProps {
  children: React.ReactNode
  title: string
  subtitle: string
  marketing?: React.ReactNode
}

export function AuthLayout({ children, title, subtitle, marketing }: AuthLayoutProps) {
  return (
    <main className="relative min-h-screen selection:bg-brand-orange/30">
      <MeshBackground />
      
      <div className="container mx-auto flex min-h-screen flex-col items-center justify-center px-4 py-12">
        {/* Logo/Branding */}
        <Link href="/" className="group mb-12 flex items-center gap-3 transition-transform hover:scale-105 active:scale-95">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#fb923c] to-[#f59e0b] text-2xl font-bold text-white shadow-lg shadow-[#fb923c]/20 ring-1 ring-white/20">
            C+
          </div>
          <span className="text-2xl font-bold tracking-tight text-white transition-colors group-hover:text-[#fb923c]">
            Cesta<span className="text-[#fb923c]">++</span>
          </span>
        </Link>

        <div className="grid w-full max-w-5xl gap-8 lg:grid-cols-12 lg:items-center">
          {/* Main Card */}
          <section className="lg:col-span-6 xl:col-span-5">
            <div className="bg-white/10 backdrop-blur-2xl border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.2)] [background:linear-gradient(135deg,rgba(255,255,255,0.1),rgba(255,255,255,0.05))] rounded-[2.5rem] p-8 sm:p-10">
              <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl bg-clip-text text-transparent bg-gradient-to-br from-white via-white/90 to-white/60">
                  {title}
                </h1>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {subtitle}
                </p>
              </div>
              
              {children}
            </div>
          </section>

          {/* Marketing/Preview Section */}
          <section className="hidden lg:col-span-6 lg:block xl:col-start-8 xl:col-span-5">
            {marketing ? (
              marketing
            ) : (
              <div className="space-y-8">
                <div className="space-y-4">
                  <span className="inline-flex rounded-full bg-[#fb923c]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#fb923c] ring-1 ring-[#fb923c]/20">
                    Proxima generación
                  </span>
                  <h2 className="text-4xl font-bold leading-[1.1] text-white bg-clip-text text-transparent bg-gradient-to-br from-white via-white/90 to-white/60">
                    Tu compra, <br />
                    mas inteligente que nunca.
                  </h2>
                  <p className="max-w-md text-lg leading-relaxed text-slate-400">
                    Únete a miles de personas que ahorran tiempo y dinero cada semana con nuestras listas inteligentes.
                  </p>
                </div>

                <div className="relative aspect-square max-w-sm">
                  <div className="absolute inset-0 animate-pulse rounded-full bg-[#fb923c]/20 blur-[100px]" />
                  <div className="bg-white/10 backdrop-blur-2xl border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.2)] [background:linear-gradient(135deg,rgba(255,255,255,0.1),rgba(255,255,255,0.05))] relative h-full w-full rounded-[3rem] p-1 shadow-2xl overflow-hidden">
                    <div className="h-full w-full rounded-[2.8rem] bg-slate-900 border border-white/5 p-6 animate-pulse">
                      {/* App Preview Mockup */}
                      <div className="mb-6 flex items-center justify-between">
                        <div className="h-2 w-16 rounded-full bg-white/10" />
                        <div className="h-2 w-8 rounded-full bg-white/10" />
                      </div>
                      <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="flex items-center gap-4 rounded-2xl bg-white/5 p-4 border border-white/5">
                            <div className="h-8 w-8 rounded-lg bg-[#fb923c]/20" />
                            <div className="flex-1 space-y-2">
                              <div className="h-2 w-1/2 rounded-full bg-white/10" />
                              <div className="h-2 w-1/3 rounded-full bg-white/5" />
                            </div>
                            <div className="h-4 w-4 rounded bg-[#fb923c]/20" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
