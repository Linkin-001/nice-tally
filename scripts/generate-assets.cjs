const fs = require('node:fs');
const path = require('node:path');
const sharp = require(process.env.TALLY_NODE_MODULES + '/sharp');
const root = path.resolve(__dirname, '../static/tally');
const paths = {
  home: '<path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/>',
  record: '<rect x="5" y="3" width="14" height="18" rx="3"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  chart: '<rect x="4" y="12" width="3" height="9" rx="1"/><rect x="10.5" y="4" width="3" height="17" rx="1"/><rect x="17" y="8" width="3" height="13" rx="1"/>',
  user: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-3a8 6 0 0 1 16 0v3Z"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M2 20v-3a7 5 0 0 1 14 0v3M17 5a3 3 0 0 1 0 6M18 14c3 0 4 2 4 5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  back: '<path d="m14 5-7 7 7 7"/>',
  right: '<path d="m9 5 7 7-7 7"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v5m10-5v5M3 11h18M7 15h3m4 0h3m-10 3h3"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  dining: '<path d="M5 3v7m3-7v7m3-7v7M5 7h6M8 10v11M19 21V3c-5 2-5 10 0 10"/>',
  cards: '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 7h8M8 11h8M8 15h8M12 7v11"/>',
  sport: '<ellipse cx="15" cy="7" rx="4" ry="5" transform="rotate(35 15 7)"/><path d="m12 11-8 10m2-3 3 2M5 5l3 3m-5 3 3-3"/>',
  flag: '<path d="M6 22V3c5-3 7 3 13 0v11c-6 3-8-3-13 0"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  shield: '<path d="M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6Z"/><path d="m12 6-3 7h4l-1 5 4-8h-4Z"/>',
  wifi: '<path d="M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0m-11 4a6 6 0 0 1 8 0"/><circle cx="12" cy="20" r="1"/>',
  lock: '<rect x="5" y="10" width="14" height="12" rx="3"/><path d="M8 10V6a4 4 0 0 1 8 0v4M12 15v3"/>',
  moon: '<path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10Z"/>',
  edit: '<path d="m4 16-1 5 5-1L21 7l-4-4Z"/><path d="m14 6 4 4"/>',
  copy: '<rect x="8" y="7" width="13" height="15" rx="2"/><path d="M16 7V2H3v15h5"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  download: '<path d="M12 2v13m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  folder: '<path d="M3 5h7l2 3h9v13H3Z"/><path d="M12 12v6m-3-3h6"/>',
  settings: '<path d="m9 3-1 3-3 1 1 4-2 2 2 4 4-1 2 3 4-2v-3l4-2-1-4-4-1-2-4Z"/><circle cx="12" cy="11" r="3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-11v1"/>',
  check: '<path d="m5 12 5 5L20 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  fingerprint: '<path d="M5 20c1-4-1-7 1-11a7 7 0 0 1 13 3M9 21c2-5-1-7 1-11a3 3 0 0 1 6 2c0 5 1 5 2 6M12 12c0 6-1 9-1 10M3 14C1 2 20-1 22 11M15 16l1 5"/>',
  backspace: '<path d="m3 12 6-8h12v16H9Zm9-4 6 8m0-8-6 8"/>'
};
const palette = { ink: '#26334b', muted: '#8b97a9', green: '#009e75', white: '#ffffff', red: '#f25b67', orange: '#fa7955', blue: '#3898ef', pink: '#ec6481', gold: '#edaa42' };
(async () => {
 fs.mkdirSync(root, { recursive: true });
 for (const [name, content] of Object.entries(paths)) for (const [tone, color] of Object.entries(palette)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${content}</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(root, `${name}-${tone}.png`));
 }
 const logo = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 128 128"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#19ba89"/><stop offset="1" stop-color="#007c59"/></linearGradient></defs><rect x="4" y="4" width="120" height="120" rx="32" fill="url(#g)"/><path d="M28 36q20-9 36 1 18-10 36-1v61q-19-9-36 0-18-9-36 0Z" fill="#fffdf2"/><path d="M64 40v50" stroke="#e8dcb6" stroke-width="3"/><path d="M36 48q10-3 19 1m-19 11q10-3 19 1m-19 11q10-3 19 1" fill="none" stroke="#efdab0" stroke-width="4" stroke-linecap="round"/><path d="M70 76C65 52 85 29 106 24c-3 24-9 44-36 52Z" fill="#0caa75"/><path d="m69 86 26-47" stroke="#fffdf2" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`;
 await sharp(Buffer.from(logo)).png().toFile(path.join(root, 'logo.png'));
 const landscape = `<svg xmlns="http://www.w3.org/2000/svg" width="1125" height="1000" viewBox="0 0 750 667"><defs><linearGradient id="mist" x2="0" y2="1"><stop stop-color="#f5fcf8"/><stop offset="1" stop-color="#e6f6ed"/></linearGradient><linearGradient id="hill" x2="1" y2="1"><stop stop-color="#b5ddc9" stop-opacity=".25"/><stop offset="1" stop-color="#a7d9be" stop-opacity=".8"/></linearGradient></defs><rect width="750" height="667" fill="url(#mist)"/><path d="M0 110Q65-70 130 100T300 225 530 170 750 260V667H0Z" fill="#d6eee2" opacity=".45"/><path d="M0 370Q100 180 260 335T540 300 750 255V667H0Z" fill="url(#hill)"/><path d="M0 420q210-150 360 30T750 320v347H0Z" fill="#c0e5cf" opacity=".6"/><path d="M0 550q150-190 410-10t340-120v247H0Z" fill="#e4f3e8"/><g stroke="#71b894" stroke-width="3"><path d="M118 530Q120 370 70 291M607 495q-5-80 37-142" fill="none"/><path d="M113 451q-72-30-63-88 64 13 63 88m-7-54q43-76 71-65-1 51-71 65m-8-36q-65-10-57-75 52 26 57 75m25 140q53-81 75-54-4 40-75 54M610 450q-50-7-44-49 41 10 44 49m11-40q59-12 64-54-51 5-64 54" fill="#8bc5a0" stroke="none"/></g><ellipse cx="378" cy="551" rx="210" ry="22" fill="#a9cfb7" opacity=".3"/><path d="m178 512 180-28 207 39-168 58Z" fill="#2d9470" opacity=".8"/><path d="M173 493q81-114 174-8 80-130 202 15l-176 64Z" fill="#fffdf4"/><path d="M347 485 373 564" fill="none" stroke="#e1d9bd" stroke-width="3"/><g fill="none" stroke="#e9e1cb" stroke-width="3"><path d="M208 475q60-60 122 9m-118 6q58-53 125 10m-109 4q58-40 114 12M373 483q68-77 137-5m-130 20q66-68 139-5m-132 20q71-59 141-7"/></g></svg>`;
 await sharp(Buffer.from(landscape)).png().toFile(path.join(root, 'welcome.png'));
 console.log('Generated local logo, welcome illustration and icons.');
})();
