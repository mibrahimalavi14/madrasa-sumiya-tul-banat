export default function Logo({ size = 48, className = "" }: { size?: number; className?: string }) {
  const id = "msb";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Madrasa Sumiya-tul-Banat Logo"
      role="img"
      shapeRendering="geometricPrecision"
    >
      <defs>
        <linearGradient id={`${id}-bg`} x1="40" y1="20" x2="160" y2="180" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0b3d2e" />
          <stop offset="0.55" stopColor="#14532d" />
          <stop offset="1" stopColor="#166534" />
        </linearGradient>
        <linearGradient id={`${id}-gold`} x1="60" y1="40" x2="150" y2="150" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fde68a" />
          <stop offset="0.45" stopColor="#f59e0b" />
          <stop offset="1" stopColor="#b45309" />
        </linearGradient>
        <radialGradient id={`${id}-shine`} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(78 62) rotate(55) scale(95)">
          <stop stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#052e16" floodOpacity="0.35" />
        </filter>
      </defs>

      <circle cx="100" cy="100" r="94" fill={`url(#${id}-bg)`} filter={`url(#${id}-shadow)`} />
      <circle cx="100" cy="100" r="94" fill={`url(#${id}-shine)`} />
      <circle cx="100" cy="100" r="84" stroke={`url(#${id}-gold)`} strokeWidth="3" />
      <circle cx="100" cy="100" r="78" stroke="#ecfdf5" strokeOpacity="0.28" strokeWidth="1.5" />
      <circle cx="100" cy="100" r="88.5" stroke="#fcd34d" strokeOpacity="0.35" strokeWidth="1" />

      {/* top ornament */}
      <path d="M100 18l4.2 8.6 9.5 1.3-6.9 6.6 1.7 9.4-8.5-4.5-8.5 4.5 1.7-9.4-6.9-6.6 9.5-1.3L100 18z" fill={`url(#${id}-gold)`} />
      <path d="M64 30l2.4 4.8 5.3.7-3.8 3.7.9 5.2-4.8-2.5-4.8 2.5.9-5.2-3.8-3.7 5.3-.7L64 30z" fill="#fde68a" opacity="0.9" />
      <path d="M136 30l2.4 4.8 5.3.7-3.8 3.7.9 5.2-4.8-2.5-4.8 2.5.9-5.2-3.8-3.7 5.3-.7L136 30z" fill="#fde68a" opacity="0.9" />

      {/* crescent */}
      <path
        d="M108 46c-20.5 0-37 16.8-37 37.5S87.5 121 108 121c6.2 0 12-1.5 17.1-4.2-6 10.2-17 17-29.6 17-19 0-34.5-15.6-34.5-34.8 0-19.2 15.5-34.8 34.5-34.8 4.4 0 8.6.8 12.5 2.4z"
        fill={`url(#${id}-gold)`}
      />

      {/* open book */}
      <g transform="translate(0,6)">
        <path d="M58 78c0-4.4 3.6-8 8-8h28c2.2 0 4 1.8 4 4v38c0 2.2-1.8 4-4 4H70c-6.6 0-12 4.5-12 10V78z" fill="#ffffff" fillOpacity="0.97" />
        <path d="M142 78c0-4.4-3.6-8-8-8h-28c-2.2 0-4 1.8-4 4v38c0 2.2 1.8 4 4 4h24c6.6 0 12 4.5 12 10V78z" fill="#f8fafc" fillOpacity="0.97" />
        <path d="M58 78c0-4.4 3.6-8 8-8h28c2.2 0 4 1.8 4 4v38c0 2.2-1.8 4-4 4H70c-6.6 0-12 4.5-12 10" stroke="#0f5132" strokeWidth="2.8" strokeLinejoin="round" />
        <path d="M142 78c0-4.4-3.6-8-8-8h-28c-2.2 0-4 1.8-4 4v38c0 2.2 1.8 4 4 4h24c6.6 0 12 4.5 12 10" stroke="#0f5132" strokeWidth="2.8" strokeLinejoin="round" />
        <path d="M100 74v46" stroke="#14532d" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M68 84h20M68 93h20M68 102h14" stroke="#166534" strokeWidth="2.4" strokeLinecap="round" opacity="0.85" />
        <path d="M112 84h20M112 93h20M112 102h14" stroke="#166534" strokeWidth="2.4" strokeLinecap="round" opacity="0.85" />
      </g>

      {/* banner */}
      <path d="M52 142h96c3 0 5 2.5 4.2 5.4l-3 10.6c-.6 2.1-2.5 3.5-4.7 3.5H55.5c-2.2 0-4.1-1.4-4.7-3.5l-3-10.6c-.8-2.9 1.2-5.4 4.2-5.4z" fill={`url(#${id}-gold)`} />
      <text x="100" y="156.5" textAnchor="middle" fontSize="18" fontWeight="800" fill="#052e16" letterSpacing="2" fontFamily="ui-sans-serif, system-ui, Arial">MSB</text>
    </svg>
  );
}
