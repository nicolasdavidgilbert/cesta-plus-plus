'use client'

export function MeshBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-slate-950">
      {/* Immersive Gradients */}
      <div className="absolute -left-[10%] -top-[10%] h-[60%] w-[60%] animate-pulse opacity-40 [background:radial-gradient(circle_at_50%_50%,rgba(251,146,60,0.15)_0%,transparent_50%)]" />
      <div className="absolute -right-[5%] top-[20%] h-[50%] w-[50%] animate-pulse opacity-25 [background:radial-gradient(circle_at_80%_20%,rgba(245,158,11,0.1)_0%,transparent_40%)] [animation-delay:2s]" />
      <div className="absolute bottom-[0%] left-[20%] h-[40%] w-[40%] animate-pulse opacity-15 [background:radial-gradient(circle_at_50%_50%,rgba(251,146,60,0.15)_0%,transparent_50%)] [animation-delay:4s]" />
      
      {/* Noise Texture Overlay */}
      <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay" 
           style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }} 
      />

      {/* Grid Pattern */}
      <div className="absolute inset-x-0 top-0 h-full w-full bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
    </div>
  )
}
