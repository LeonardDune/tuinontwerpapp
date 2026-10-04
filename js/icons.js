// Lijn-iconen (24×24, stroke = currentColor).

const P = {
  select: '<path d="M5 3l6 16 2.2-6.6L20 10Z"/><path d="M13.4 12.6 19 18.2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  height: '<path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4"/><path d="M4 21h16" opacity=".5"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
  pen: '<path d="M4 20l1.5-5.5L16 4a2.1 2.1 0 0 1 3 3L8.5 17.5Z"/><path d="m14 6 3 3"/>',
  eraser: '<path d="m7 21-4-4a2 2 0 0 1 0-2.8L13.2 4a2 2 0 0 1 2.8 0l5 5a2 2 0 0 1 0 2.8L11 21"/><path d="M7 21h14"/><path d="m9 11 6 6"/>',
  lasso: '<path d="M7 18c-2.5-1.3-4-3.4-4-6 0-4.4 4-8 9-8s9 3.6 9 8-4 8-9 8c-1 0-2-.1-2.9-.4"/><circle cx="7" cy="18" r="2"/><path d="M7 20c0 1.5-1 2.5-2 2.5"/><path d="m14 12 2 2 4-4" stroke-dasharray="0" opacity="0"/>',
  line: '<path d="M5 19 19 5"/><circle cx="5" cy="19" r="1.6"/><circle cx="19" cy="5" r="1.6"/>',
  rect: '<rect x="4" y="6" width="16" height="12" rx="1"/>',
  circle: '<circle cx="12" cy="12" r="8"/><path d="M12 12h8"/>',
  polygon: '<path d="m12 3 8.5 6.2-3.2 10H6.7l-3.2-10Z"/>',
  area: '<path d="M4 15c0-5 3-10 9-10 4 0 7 2.5 7 6 0 6-6 9-10 9-3.5 0-6-2-6-5Z"/><path d="M8 15l3-3M10 18l6-6M14 17l3-3M7 12l4-4" opacity=".6"/>',
  dim: '<path d="M4 8v8M20 8v8M4 12h16"/><path d="m3 13 2-2M19 13l2-2"/>',
  text: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
  stencil: '<circle cx="8" cy="8" r="4.5"/><path d="M14 13h7v7h-7z"/><path d="m4 20 3.5-6 3.5 6Z"/><path d="M15 4.5l2 2 3-3" opacity="0"/>',
  tree: '<path d="M12 21v-6"/><path d="M7 15a4.5 4.5 0 0 1-1.5-8.6A5 5 0 0 1 15 4.5a4.5 4.5 0 0 1 3 8.5 3.5 3.5 0 0 1-2.5 2Z"/>',
  ruler: '<rect x="2" y="8" width="20" height="8" rx="1" transform="rotate(-30 12 12)"/><path d="m7.3 13.3 1-1.8M10.2 11.6l1.5-2.6M13.2 9.9l1-1.8M16.1 8.2l1.5-2.6" transform="translate(-.5 1.3)"/>',
  tri45: '<path d="M4 20V4l16 16Z"/><path d="M8 16V12l4 4Z"/>',
  tri30: '<path d="M4 20V9l19 11Z" transform="translate(-1 0)"/><path d="M7 17.3v-2.6l4.5 2.6Z" transform="translate(-1 0)"/>',
  protractor: '<path d="M2 18a10 10 0 0 1 20 0Z"/><path d="M12 18 7 10M12 18V9M12 18l5-8"/>',
  calibrate: '<path d="M3 17h18M3 14v6M21 14v6"/><path d="M8 11l4-7 4 7"/><path d="M12 4v8"/>',
  hand: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11"/><path d="M11 11V4.5a1.5 1.5 0 0 1 3 0V11"/><path d="M14 11V6.5a1.5 1.5 0 0 1 3 0V14"/><path d="M8 13V9.5a1.5 1.5 0 0 0-3 0V14a7 7 0 0 0 7 7h1a5 5 0 0 0 4.2-2.3c.7-1 1.4-2.5 1.8-4V11a1.5 1.5 0 0 0-3 0"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5Z"/><path d="m3 13 9 5 9-5"/>',
  map: '<path d="m9 4-6 2.5v13L9 17l6 3 6-2.5v-13L15 7Z"/><path d="M9 4v13M15 7v13"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  pdf: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M14 3v6h6"/><path d="M8 15h8M8 18h5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.9M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.9-1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  up: '<path d="m6 15 6-6 6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m12 5 3 8h-6Z"/>',
  palette: '<circle cx="12" cy="12" r="9"/><circle cx="8" cy="10" r="1.3"/><circle cx="12" cy="7.5" r="1.3"/><circle cx="16" cy="10" r="1.3"/><path d="M12 21a2 2 0 0 1 0-4h1.5a2.5 2.5 0 0 0 0-5"/>',
  front: '<rect x="8" y="8" width="12" height="12" rx="1"/><path d="M4 16V5a1 1 0 0 1 1-1h11"/>',
  back: '<rect x="4" y="4" width="12" height="12" rx="1"/><path d="M20 8v11a1 1 0 0 1-1 1H8"/>',
  share: '<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/>',
};

export function icon(name, size = 22) {
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
}

/** Vervang alle <i data-icon="naam"> door SVG. */
export function hydrateIcons(root = document) {
  for (const el of root.querySelectorAll('[data-icon]')) {
    el.innerHTML = icon(el.dataset.icon, Number(el.dataset.size) || 22);
  }
}
