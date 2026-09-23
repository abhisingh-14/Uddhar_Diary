export default function Logo({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none"
         xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Uddhar Diary logo">
      <defs>
        <linearGradient id="ud-g" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#34D399" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill="url(#ud-g)" />
      {/* bookmark ribbon */}
      <path d="M28 0h6v14l-3-2.5L28 14z" fill="#FBBF24" />
      {/* rupee sign */}
      <g transform="translate(0 2)" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 15h14M17 20.5h14M19 15c5 0 8 2 8 5.5S24 26 19 26h-2l12 12" />
      </g>
    </svg>
  );
}