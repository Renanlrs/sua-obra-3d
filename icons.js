/* Ícones — traço 1.5, 18px, vocabulário único (padrão lucide). */
var ICONS = {
  sofa:    '<path d="M4 11V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3"/><path d="M2 13a2 2 0 0 1 2-2 2 2 0 0 1 2 2v2h12v-2a2 2 0 0 1 2-2 2 2 0 0 1 2 2v5H2z"/><path d="M4 18v2M20 18v2"/>',
  home:    '<path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  undo:    '<path d="M3 8h11a5 5 0 0 1 0 10H8"/><path d="m7 4-4 4 4 4"/>',
  redo:    '<path d="M21 8H10a5 5 0 0 0 0 10h6"/><path d="m17 4 4 4-4 4"/>',
  plan:    '<rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 10h7M10 3v18M14 10h7"/>',
  rooms:   '<rect x="3" y="4" width="8" height="7" rx="1"/><rect x="13" y="4" width="8" height="16" rx="1"/><rect x="3" y="13" width="8" height="7" rx="1"/>',
  layers:  '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  cube:    '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12v9M12 12l8-4.5M12 12 4 7.5"/>',
  facade:  '<path d="M3 21h18M4 21V9l8-5 8 5v12"/><rect x="9" y="13" width="6" height="8"/>',
  cut:     '<path d="M3 20h18M4 20V8h16v12"/><path d="M4 14h16" stroke-dasharray="3 2"/>',
  money:   '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
  slider:  '<path d="M4 7h16M4 12h16M4 17h16"/><circle cx="9" cy="7" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="7" cy="17" r="2"/>',
  export:  '<path d="M12 15V3"/><path d="m8 7 4-4 4 4"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
  chev:    '<path d="m15 18-6-6 6-6"/>',
  cursor:  '<path d="m4 3 7 17 2.5-6.5L20 11z"/>',
  addroom: '<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M12 9v6M9 12h6"/>',
  cobertura: '<path d="m2 11 10-6 10 6"/><path d="M5 11v9M19 11v9"/><path d="M5 20h14" stroke-dasharray="3 2"/>',   /* telhado sobre dois pilares */
  hand:    '<path d="M8 13V5a1.5 1.5 0 0 1 3 0v6"/><path d="M11 11V4a1.5 1.5 0 0 1 3 0v7"/><path d="M14 11V6a1.5 1.5 0 0 1 3 0v7"/><path d="M17 11a1.5 1.5 0 0 1 3 0v3a7 7 0 0 1-7 7h-1a7 7 0 0 1-7-7v-1a1.5 1.5 0 0 1 3 0"/>',
  fit:     '<path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4"/>',
  grid:    '<path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
  dim:     '<path d="M3 6v12M21 6v12M3 12h18"/><path d="m7 9-3 3 3 3M17 9l3 3-3 3"/>',
  trash:   '<path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/>',
  copy:    '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M4 16V5a1 1 0 0 1 1-1h11"/>',
  rotate:  '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/>',
  close:   '<path d="M6 6l12 12M18 6 6 18"/>',
  search:  '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  pool:    '<path d="M3 16c1.5 1.2 3 1.2 4.5 0s3-1.2 4.5 0 3 1.2 4.5 0 3-1.2 4.5 0"/><path d="M3 20c1.5 1.2 3 1.2 4.5 0s3-1.2 4.5 0 3 1.2 4.5 0 3-1.2 4.5 0"/><path d="M8 13V5a2 2 0 0 1 4 0M12 13V9h4"/>',
  eye:     '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  photo:   '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="12" cy="12" r="3.5"/><path d="M8 5l1.5-2h5L16 5"/>',
  doc:     '<path d="M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5M8 13h8M8 17h8"/>'
};
function icon(name){
  return '<svg class="ic" viewBox="0 0 24 24">' + (ICONS[name] || '') + '</svg>';
}
function paintIcons(root){
  (root || document).querySelectorAll('i[data-icon]').forEach(function (el) {
    if (!el.firstChild) el.innerHTML = icon(el.getAttribute('data-icon'));
  });
}
