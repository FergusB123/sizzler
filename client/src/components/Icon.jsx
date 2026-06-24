// Sizzler brand icon set — single-weight line icons, 24px grid, 1.6px stroke,
// round caps/joins. Brand-defined glyphs (skillet, flame, plan, groceries, etc.)
// use the exact paths from the guidelines; the rest are drawn to match.
const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }

const paths = {
  // ---- brand-defined ----
  home: <path d="M4 12.5h11v1.5a3.5 3.5 0 0 1-3.5 3.5h-4A3.5 3.5 0 0 1 4 14Z M15 13.2h5" {...P} />,
  skillet: <path d="M4 12.5h11v1.5a3.5 3.5 0 0 1-3.5 3.5h-4A3.5 3.5 0 0 1 4 14Z M15 13.2h5" {...P} />,
  book: <><path d="M12 7C10 5.6 7.2 5.6 5 6.2v12c2.2-.6 5-.6 7 .8 2-1.4 4.8-1.4 7-.8v-12c-2.2-.6-5-.6-7 .8Z" {...P} /><path d="M12 7v12.8" {...P} /></>,
  calendar: <><rect x="4" y="5" width="16" height="16" rx="2.5" {...P} /><path d="M4 9.5h16M8.5 3v4M15.5 3v4M9.5 14.5l2 2 3.5-3.5" {...P} /></>,
  cart: <><path d="M3 4h1.8l1.9 10.3a1.5 1.5 0 0 0 1.5 1.2h7.4a1.5 1.5 0 0 0 1.5-1.2L19 7.5H6.2" {...P} /><circle cx="9" cy="19.5" r="1.3" {...P} /><circle cx="16.5" cy="19.5" r="1.3" {...P} /></>,
  clock: <><circle cx="12" cy="13.5" r="7.5" {...P} /><path d="M12 13.5V9.5M9.5 3.5h5M12 3.5V6" {...P} /></>,
  heart: <path d="M12 20S4 15.2 4 9.6A3.9 3.9 0 0 1 12 7a3.9 3.9 0 0 1 8 2.6C20 15.2 12 20 12 20Z" {...P} />,
  bell: <><path d="M12 4.5a4.7 4.7 0 0 0-4.7 4.7c0 4-1.5 5.6-2 6.5h13.4c-.5-.9-2-2.5-2-6.5A4.7 4.7 0 0 0 12 4.5Z" {...P} /><path d="M10 19a2 2 0 0 0 4 0" {...P} /></>,
  flame: <><path d="M12 21c4 0 6.8-2.6 6.8-6.3 0-2.6-1.5-4.4-2.8-5.8-.4 1.3-1.1 1.9-1.9 2 .4-2.5-.9-4.8-3.6-6.4.4 2.6-.6 4-2 5.4C7 11.5 5.2 13.2 5.2 16 5.2 19 8 21 12 21Z" {...P} /><path d="M12 21c1.9 0 3.2-1.3 3.2-3 0-1.4-1-2.4-2-3.2-.6 1.3-1.5 1.8-2.6 2.2-.9.4-1.6 1.2-1.6 2.3 0 1 .9 1.7 3 1.7Z" {...P} /></>,
  leaf: <><path d="M12 21v-8" {...P} /><path d="M12 15c-3.2 0-5.3-2.1-5.3-5.3C9.9 9.7 12 11.8 12 15Z" {...P} /><path d="M12 12.5c0-3.2 2.1-5.5 5.3-5.5C17.3 10.2 15.2 12.5 12 12.5Z" {...P} /></>,
  star: <path d="M12 3.6l2.5 5.16 5.5.72-4 3.86 1 5.46L12 16.6l-5 2.66 1-5.46-4-3.86 5.5-.72Z" {...P} />,
  bookmark: <path d="M7 4.5h10v16l-5-3.4-5 3.4Z" {...P} />,
  dish: <><path d="M4 16a8 8 0 0 1 16 0" {...P} /><path d="M2.8 16h18.4M12 8V6.4" {...P} /></>,
  // ---- supporting (drawn to match stroke/grid) ----
  plus: <path d="M12 5v14M5 12h14" {...P} strokeWidth="2" />,
  minus: <path d="M5 12h14" {...P} strokeWidth="2" />,
  sparkle: <><path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" {...P} /><path d="M19 14l.6 1.6 1.6.6-1.6.6L19 19l-.6-1.6-1.6-.6 1.6-.6z" {...P} /></>,
  link: <><path d="M9 15l6-6" {...P} /><path d="M10.5 6.5l1.2-1.2a4 4 0 0 1 5.7 5.7l-1.2 1.2M13.5 17.5l-1.2 1.2a4 4 0 0 1-5.7-5.7l1.2-1.2" {...P} /></>,
  camera: <><path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2L8 5h8l1.5 2h2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z" {...P} /><circle cx="12" cy="12.5" r="3.2" {...P} /></>,
  film: <><rect x="3" y="4.5" width="18" height="15" rx="3" {...P} /><path d="M3 9h18M3 15h18M8 4.5v15M16 4.5v15" {...P} /></>,
  pencil: <><path d="M4 20h4L19 9l-4-4L4 16z" {...P} /><path d="M14 6l4 4" {...P} /></>,
  globe: <><circle cx="12" cy="12" r="9" {...P} /><path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" {...P} /></>,
  search: <><circle cx="11" cy="11" r="6.5" {...P} /><path d="M20 20l-3.8-3.8" {...P} /></>,
  check: <path d="M5 12.5l4.5 4.5L19 6.5" {...P} strokeWidth="2" />,
  x: <path d="M6 6l12 12M18 6L6 18" {...P} strokeWidth="2" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" {...P} />,
  arrowLeft: <path d="M19 12H5M11 6l-6 6 6 6" {...P} />,
  chevron: <path d="M9 6l6 6-6 6" {...P} />,
  trash: <><path d="M4 6.5h16M9 6.5V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v1.5M6.5 6.5 7.5 20a1.5 1.5 0 0 0 1.5 1.4h6a1.5 1.5 0 0 0 1.5-1.4l1-13.5" {...P} /></>,
  settings: <><circle cx="12" cy="12" r="3" {...P} /><path d="M12 2.5l1.4 2.4 2.7-.4 .9 2.6 2.4 1.4-.9 2.6.9 2.6-2.4 1.4-.9 2.6-2.7-.4L12 21.5l-1.4-2.4-2.7.4-.9-2.6L4.6 15.5l.9-2.6-.9-2.6 2.4-1.4.9-2.6 2.7.4z" {...P} /></>,
  user: <><circle cx="12" cy="8" r="4" {...P} /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" {...P} /></>,
  users: <><circle cx="9" cy="8.5" r="3.4" {...P} /><path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 5.5a3.4 3.4 0 0 1 0 6.6M17 19a5.5 5.5 0 0 0-3-4.9" {...P} /></>,
  info: <><circle cx="12" cy="12" r="9" {...P} /><path d="M12 11v5M12 7.6v.1" {...P} /></>,
}

export default function Icon({ name, size = 24, className = '', style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style} aria-hidden="true">
      {paths[name] || null}
    </svg>
  )
}
