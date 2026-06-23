// Single stroke-icon set (currentColor, 24px grid). Used everywhere instead of
// emoji so the UI reads modern and consistent.
const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' }

const paths = {
  home: <><path d="M3 10.5 12 3l9 7.5" {...P} /><path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" {...P} /></>,
  book: <><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z" {...P} /><path d="M9 3v8l2.4-1.5L14 11V3" {...P} /></>,
  calendar: <><rect x="3" y="4.5" width="18" height="16" rx="3" {...P} /><path d="M3 9h18M8 2.5v4M16 2.5v4" {...P} /></>,
  cart: <><path d="M3 4h2l2.2 11.2a1.5 1.5 0 0 0 1.5 1.2h8.1a1.5 1.5 0 0 0 1.5-1.2L21 7H6" {...P} /><circle cx="9.5" cy="20" r="1.4" {...P} /><circle cx="17.5" cy="20" r="1.4" {...P} /></>,
  plus: <path d="M12 5v14M5 12h14" {...P} strokeWidth="2" />,
  sparkle: <><path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" {...P} /><path d="M19 14l.7 1.8L21.5 16.5 19.7 17.2 19 19l-.7-1.8L16.5 16.5 18.3 15.8z" {...P} /></>,
  link: <><path d="M9 15l6-6" {...P} /><path d="M10.5 6.5l1.2-1.2a4 4 0 0 1 5.7 5.7l-1.2 1.2" {...P} /><path d="M13.5 17.5l-1.2 1.2a4 4 0 0 1-5.7-5.7l1.2-1.2" {...P} /></>,
  camera: <><path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2L8 5h8l1.5 2h2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z" {...P} /><circle cx="12" cy="12.5" r="3.2" {...P} /></>,
  film: <><rect x="3" y="4.5" width="18" height="15" rx="3" {...P} /><path d="M3 9h18M3 15h18M8 4.5v15M16 4.5v15" {...P} /></>,
  pencil: <><path d="M4 20h4L19 9l-4-4L4 16z" {...P} /><path d="M14 6l4 4" {...P} /></>,
  globe: <><circle cx="12" cy="12" r="9" {...P} /><path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" {...P} /></>,
  flame: <path d="M12 3c.5 3-1.5 4.4-2.8 6.2C8 11 8 13 9.2 14.4 9.8 15 11 15.6 11 15.6S9.4 15.2 8.5 14c2 4 8 3.4 8-1.4 0-2.2-1.4-3.6-2.4-5-0.8-1.2-1-2.6-0.4-3.8 0 0-2 0.8-2.6 3C11 4 11 3.4 12 3z" {...P} />,
  clock: <><circle cx="12" cy="12" r="8.5" {...P} /><path d="M12 7.5V12l3 1.8" {...P} /></>,
  search: <><circle cx="11" cy="11" r="6.5" {...P} /><path d="M20 20l-3.8-3.8" {...P} /></>,
  check: <path d="M5 12.5l4.5 4.5L19 6.5" {...P} strokeWidth="2" />,
  x: <path d="M6 6l12 12M18 6L6 18" {...P} strokeWidth="2" />,
  heart: <path d="M12 20s-7-4.6-7-9.3A3.7 3.7 0 0 1 12 7a3.7 3.7 0 0 1 7 3.7C19 15.4 12 20 12 20z" {...P} />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" {...P} />,
  arrowLeft: <path d="M19 12H5M11 6l-6 6 6 6" {...P} />,
  chevron: <path d="M9 6l6 6-6 6" {...P} />,
  bell: <><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z" {...P} /><path d="M10 19a2 2 0 0 0 4 0" {...P} /></>,
  trash: <><path d="M4 6.5h16M9 6.5V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v1.5M6.5 6.5 7.5 20a1.5 1.5 0 0 0 1.5 1.4h6a1.5 1.5 0 0 0 1.5-1.4l1-13.5" {...P} /></>,
  settings: <><circle cx="12" cy="12" r="3" {...P} /><path d="M12 2.5l1.4 2.4 2.7-.4 .9 2.6 2.4 1.4-.9 2.6.9 2.6-2.4 1.4-.9 2.6-2.7-.4L12 21.5l-1.4-2.4-2.7.4-.9-2.6L4.6 15.5l.9-2.6-.9-2.6 2.4-1.4.9-2.6 2.7.4z" {...P} /></>,
  spark: <path d="M12 4v5M12 15v5M4 12h5M15 12h5" {...P} />,
  user: <><circle cx="12" cy="8" r="4" {...P} /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" {...P} /></>,
  users: <><circle cx="9" cy="8.5" r="3.4" {...P} /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" {...P} /><path d="M16 5.5a3.4 3.4 0 0 1 0 6.6M17 19a5.5 5.5 0 0 0-3-4.9" {...P} /></>,
  info: <><circle cx="12" cy="12" r="9" {...P} /><path d="M12 11v5M12 7.6v.1" {...P} /></>,
  minus: <path d="M5 12h14" {...P} strokeWidth="2" />,
}

export default function Icon({ name, size = 24, className = '', style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style} aria-hidden="true">
      {paths[name] || null}
    </svg>
  )
}
