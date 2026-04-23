export function Logo({ size = 32, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="apogee-gradient" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="50%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
        <linearGradient id="apogee-gradient-2" x1="0" y1="32" x2="32" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.8" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#apogee-gradient)" />
      <path d="M9 22V10L16 16L23 10V22" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="16" cy="16" r="1.5" fill="white" />
      <path d="M9 22L16 16L23 22" stroke="url(#apogee-gradient-2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.6" />
    </svg>
  );
}

export function LogoText({ size = 24 }) {
  return (
    <div className="flex items-center gap-2.5">
      <Logo size={size} />
      <div className="flex flex-col">
        <span className="font-bold text-sm gradient-text leading-none">Apogee</span>
      </div>
    </div>
  );
}
