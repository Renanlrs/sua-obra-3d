/* =========================================================================
   PLAN — desenho e manipulação direta da planta em SVG.
   Todo movimento acontece no espaço do modelo (cm), nunca em pixels de tela.
   ========================================================================= */
var PLAN = (function () {

  var svg, gRoot, host;
  var view = {x:0, y:0, w:1000, h:1000};   // viewBox em cm
  var sel = null, selTipo = 'amb', tool = 'sel';   /* selTipo: 'amb' (ambiente) ou 'mov' (móvel) */
  var VERDE = '#2FA36B';
  var showGrid = true, showCotas = true;
  var drag = null, guias = [], PAREDE = 15, SNAP = 5, IMA = 12;
  var ptrs = {}, pinch = null;   /* dedos na tela; dois dedos = pinça (zoom + pan) no celular */

  /* ---------- montagem ---------- */
  function montar(hostEl){
    host = hostEl;
    host.innerHTML = '<svg id="svg" xmlns="http://www.w3.org/2000/svg"></svg>';
    svg = host.querySelector('svg');
    svg.addEventListener('pointerdown', onDown);
    svg.addEventListener('pointermove', onHover);
    svg.addEventListener('wheel', onWheel, {passive:false});
    svg.addEventListener('dblclick', onDbl);
    svg.addEventListener('contextmenu', function (e) { e.preventDefault(); onDbl(e); });
    /* soltar um móvel arrastado do catálogo em cima da planta */
    svg.addEventListener('dragover', function (e) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
    svg.addEventListener('drop', function (e) {
      e.preventDefault();
      var k = e.dataTransfer.getData('text/movel'); if (!k) return;
      var p = toModel(e);
      UI.addMovel(k, snap(p.x), snap(p.y));
    });
    enquadrar();
  }

  function toModel(e){
    var pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    var m = svg.getScreenCTM();
    if (!m) return {x:0, y:0};
    var p = pt.matrixTransform(m.inverse());
    return {x: p.x, y: p.y};
  }
  function enquadrar(){
    var t = M.proj.terreno, mg = Math.max(t.largura, t.profundidade) * 0.17;
    setView(-mg, -mg, t.largura + mg * 2, t.profundidade + mg * 2);
  }
  function enquadrarAmb(a, folga){
    var mg = folga || 120;
    setView(a.x - mg, a.y - mg, a.w + mg * 2, a.h + mg * 2); render();
  }
  function setView(x, y, w, h){
    var r = host.getBoundingClientRect(), ar = r.width / Math.max(1, r.height);
    if (w / h > ar) h = w / ar; else w = h * ar;
    view = {x:x, y:y, w:w, h:h};
    if (svg) svg.setAttribute('viewBox', [x, y, w, h].join(' '));
    if (window.UI) UI.zoomLabel(Math.round(host.clientWidth / w * 100 * (100 / 100)));
  }
  function zoom(f, cx, cy){
    var nx = cx - (cx - view.x) * f, ny = cy - (cy - view.y) * f;
    setView(nx, ny, view.w * f, view.h * f);
    render(); UI.radial(movAtual());
  }

  /* ---------- desenho ---------- */
  function render(){
    if (!svg || !M.proj) return;
    var p = M.proj, t = p.terreno, s = '';
    var esc = view.w / Math.max(1, host.clientWidth);   // cm por pixel

    s += defs();
    if (showGrid) s += grade(t);

    /* terreno + recuos */
    s += '<rect x="0" y="0" width="' + t.largura + '" height="' + t.profundidade + '" fill="#FFFFFF" stroke="#B6C0C9" stroke-width="' + (2 * esc) + '"/>';
    s += '<rect x="' + t.recuoLateral + '" y="' + t.recuoFrontal + '" width="' + (t.largura - t.recuoLateral * 2) +
         '" height="' + (t.profundidade - t.recuoFrontal - t.recuoFundo) + '" fill="none" stroke="#22B8D6" stroke-opacity=".45" stroke-width="' + (1.2 * esc) + '" stroke-dasharray="' + (10 * esc) + ' ' + (8 * esc) + '"/>';

    /* andar de baixo em fantasma (para alinhar o andar de cima) */
    var pav = M.pav;
    if (pav > 0) {
      M.ambsPav(pav - 1).forEach(function (b) {
        s += '<rect x="' + b.x + '" y="' + b.y + '" width="' + b.w + '" height="' + b.h + '" fill="#8FA3B1" fill-opacity=".08" stroke="#8FA3B1" stroke-width="' + (1.4 * esc) + '" stroke-dasharray="' + (8 * esc) + ' ' + (6 * esc) + '" style="pointer-events:none"/>';
      });
    }
    /* ambientes */
    var probs = M.problemas(), ruins = {};
    probs.forEach(function (q) { if (q.id) ruins[q.id] = true; });

    M.ambsPav(pav).forEach(function (a) {
      var ti = M.TIPOS[a.tipo] || M.TIPOS.social;
      var ruim = ruins[a.id], on = sel === a.id;
      s += '<g class="amb" data-id="' + a.id + '">';
      s += '<rect x="' + a.x + '" y="' + a.y + '" width="' + a.w + '" height="' + a.h + '" rx="' + (2 * esc) +
           '" fill="' + ti.cor + '" fill-opacity="' + (a.tipo === 'agua' ? .5 : .13) + '"/>';
      /* parede: traço grosso por dentro */
      s += '<rect x="' + (a.x + PAREDE / 2) + '" y="' + (a.y + PAREDE / 2) + '" width="' + Math.max(1, a.w - PAREDE) +
           '" height="' + Math.max(1, a.h - PAREDE) + '" fill="none" stroke="' + (ruim ? '#E5533D' : '#1B2229') +
           '" stroke-width="' + PAREDE + '" stroke-opacity="' + (ruim ? .85 : .9) + '"/>';
      if (a.tipo === 'agua') {
        var raias = Math.max(1, Math.round(a.w / 150));
        for (var i = 1; i < raias; i++)
          s += '<line x1="' + (a.x + a.w / raias * i) + '" y1="' + (a.y + 25) + '" x2="' + (a.x + a.w / raias * i) +
               '" y2="' + (a.y + a.h - 25) + '" stroke="#1E7E96" stroke-width="' + (1.4 * esc) + '" stroke-dasharray="' + (22 * esc) + ' ' + (16 * esc) + '"/>';
      }
      /* rótulo — abrevia em vez de sumir; só desaparece quando é ilegível mesmo */
      var pxW = a.w / esc, pxH = a.h / esc;
      if (pxW > 34 && pxH > 22) {
        /* rótulo no canto inferior esquerdo, com fundo translúcido — legível por cima dos móveis */
        var fs = Math.min(a.w, a.h) * 0.13, fsMax = 13 * esc, fsMin = 7.5 * esc;
        fs = Math.max(fsMin, Math.min(fsMax, fs));
        var rot = rotuloQueCabe(a.nome, a.w - 24 * esc, fs), area = pxH > 40 ? '  ' + M.fmtM2(M.areaOf(a)) : '';
        var tw = (rot.length * .55 + area.length * .5) * fs, th = fs * 1.6, lx = a.x + PAREDE / 2 + 5 * esc, ly = a.y + a.h - PAREDE / 2 - 5 * esc - th;
        s += '<g style="pointer-events:none"><rect x="' + lx + '" y="' + ly + '" width="' + (tw + fs * .9) + '" height="' + th + '" rx="' + (th / 2) + '" fill="#FFFFFF" fill-opacity=".82"/>';
        s += '<text x="' + (lx + fs * .45) + '" y="' + (ly + th * .68) + '" font-family="Inter,system-ui,sans-serif" font-size="' + fs + '" fill="#28313A">' + esc4(rot) +
             (area ? '<tspan font-family="ui-monospace,monospace" font-size="' + (fs * .82) + '" fill="#6B7885">' + area + '</tspan>' : '') + '</text></g>';
      }
      if (on) {
        s += '<rect x="' + (a.x - 3 * esc) + '" y="' + (a.y - 3 * esc) + '" width="' + (a.w + 6 * esc) + '" height="' + (a.h + 6 * esc) +
             '" fill="none" stroke="#0F7E96" stroke-width="' + (2 * esc) + '"/>';
        s += alcas(a, esc);
      }
      s += '</g>';
    });
    /* escada (derivada de M.escada): degraus no térreo, vão no andar de cima */
    var esc2 = M.escada();
    if (esc2 && (pav === 0 || pav === 1)) {
      s += '<g style="pointer-events:none"><rect x="' + esc2.x + '" y="' + esc2.y + '" width="' + esc2.w + '" height="' + esc2.h + '" fill="' + (pav === 0 ? '#FFFFFF' : '#F4F6F8') + '" fill-opacity=".9" stroke="#1B2229" stroke-width="' + (1.6 * esc) + '"' + (pav === 1 ? ' stroke-dasharray="' + (6 * esc) + ' ' + (4 * esc) + '"' : '') + '/>';
      if (pav === 0) { var dg = esc2.degraus, passo = esc2.h / dg; for (var di = 1; di < dg; di++) s += '<line x1="' + esc2.x + '" y1="' + (esc2.y + di * passo) + '" x2="' + (esc2.x + esc2.w) + '" y2="' + (esc2.y + di * passo) + '" stroke="#1B2229" stroke-width="' + (1 * esc) + '"/>';
        s += '<line x1="' + (esc2.x + esc2.w / 2) + '" y1="' + (esc2.y + esc2.h - 10) + '" x2="' + (esc2.x + esc2.w / 2) + '" y2="' + (esc2.y + 14) + '" stroke="#22B8D6" stroke-width="' + (1.6 * esc) + '"/><path d="M' + (esc2.x + esc2.w / 2 - 8) + ' ' + (esc2.y + 26) + ' l8 -14 l8 14" fill="none" stroke="#22B8D6" stroke-width="' + (1.6 * esc) + '"/>'; }
      else s += '<line x1="' + esc2.x + '" y1="' + esc2.y + '" x2="' + (esc2.x + esc2.w) + '" y2="' + (esc2.y + esc2.h) + '" stroke="#8FA3B1" stroke-width="' + (1 * esc) + '"/>';
      s += '</g>';
    }

    s += moveisSvg(esc);
    if (showCotas) s += cotas(esc);
    guias.forEach(function (g) {
      s += '<line x1="' + g.x1 + '" y1="' + g.y1 + '" x2="' + g.x2 + '" y2="' + g.y2 +
           '" stroke="#E5533D" stroke-width="' + (1 * esc) + '" stroke-dasharray="' + (14 * esc) + ' ' + (10 * esc) + '"/>';
    });
    if (drag && drag.modo === 'novo' && drag.novo)
      s += '<rect x="' + drag.novo.x + '" y="' + drag.novo.y + '" width="' + drag.novo.w + '" height="' + drag.novo.h +
           '" fill="#22B8D6" fill-opacity=".18" stroke="#0F7E96" stroke-width="' + (1.6 * esc) + '"/>';

    svg.innerHTML = s;
  }

  /* ---------- móveis: figurinhas de cima, giradas no lugar ---------- */
  function moveisSvg(esc){
    if (!window.MOVEIS || !M.proj.moveis) return '';
    var s = '', lista = M.proj.moveis.filter(function (m) { return (m.pav || 0) === M.pav; }).sort(function (a, b) { return MOVEIS.dims(a).alt - MOVEIS.dims(b).alt; });   /* tapete embaixo de tudo */
    lista.forEach(function (mv) {
      var m = MOVEIS.dims(mv), on = selTipo === 'mov' && sel === mv.id;
      var sym = MOVEIS.symDe(mv).replace(/stroke-width="([\d.]+)"/g, function (_, v) { return 'stroke-width="' + (parseFloat(v) * esc * .85) + '"'; });
      s += '<g class="mov" data-id="' + mv.id + '" transform="translate(' + mv.x + ' ' + mv.y + ') rotate(' + (mv.rot || 0) + ')" style="cursor:move">';
      s += '<g transform="scale(' + (mv.esp ? -1 : 1) + ' 1)">' + sym + '</g>';
      if (on) {
        var g = 3 * esc;
        s += '<rect x="' + (-m.w / 2 - g) + '" y="' + (-m.d / 2 - g) + '" width="' + (m.w + g * 2) + '" height="' + (m.d + g * 2) + '" rx="' + (2 * esc) + '" fill="none" stroke="' + VERDE + '" stroke-width="' + (1.8 * esc) + '"/>';
        /* alça de giro, acima do encosto */
        var hy = -m.d / 2 - g - 22 * esc;
        s += '<line x1="0" y1="' + (-m.d / 2 - g) + '" x2="0" y2="' + hy + '" stroke="' + VERDE + '" stroke-width="' + (1.2 * esc) + '"/>';
        s += '<circle class="mov-rot" cx="0" cy="' + hy + '" r="' + (6 * esc) + '" fill="#fff" stroke="' + VERDE + '" stroke-width="' + (1.6 * esc) + '" style="cursor:grab"/>';
        s += '<path d="M' + (-2.6 * esc) + ' ' + (hy - .8 * esc) + ' a' + (2.8 * esc) + ' ' + (2.8 * esc) + ' 0 1 1 ' + (2.2 * esc) + ' ' + (2.6 * esc) + '" fill="none" stroke="' + VERDE + '" stroke-width="' + (1.1 * esc) + '" style="pointer-events:none"/>';
      }
      s += '</g>';
    });
    var mv = movAtual();
    if (mv) s += cotasMovel(mv, esc);
    return s;
  }
  /* distâncias do móvel selecionado até as 4 paredes do ambiente onde ele está (chips verdes, como no Planner 5D) */
  function cotasMovel(mv, esc){
    var r = M.ambienteDe(mv); if (!r) return '';
    var b = MOVEIS.aabb(mv), fs = 10.5 * esc, s = '';
    var x0 = r.x + PAREDE / 2, x1 = r.x + r.w - PAREDE / 2, y0 = r.y + PAREDE / 2, y1 = r.y + r.h - PAREDE / 2;
    var cy = b.y + b.h / 2, cx = b.x + b.w / 2;
    function chip(xa, ya, xb, yb){
      var d = Math.hypot(xb - xa, yb - ya); if (d < 1) return '';
      var mx = (xa + xb) / 2, my = (ya + yb) / 2, txt = M.fmtMs(d), bw = txt.length * fs * .62 + fs * .9, bh = fs * 1.5;
      return '<line x1="' + xa + '" y1="' + ya + '" x2="' + xb + '" y2="' + yb + '" stroke="' + VERDE + '" stroke-width="' + (1 * esc) + '" stroke-dasharray="' + (5 * esc) + ' ' + (4 * esc) + '"/>' +
        '<rect x="' + (mx - bw / 2) + '" y="' + (my - bh / 2) + '" width="' + bw + '" height="' + bh + '" rx="' + (bh / 2) + '" fill="' + VERDE + '"/>' +
        '<text x="' + mx + '" y="' + (my + fs * .36) + '" text-anchor="middle" font-family="ui-monospace,monospace" font-size="' + fs + '" fill="#fff" style="pointer-events:none">' + txt + '</text>';
    }
    if (b.x > x0) s += chip(x0, cy, b.x, cy);
    if (b.x + b.w < x1) s += chip(b.x + b.w, cy, x1, cy);
    if (b.y > y0) s += chip(cx, y0, cx, b.y);
    if (b.y + b.h < y1) s += chip(cx, b.y + b.h, cx, y1);
    return s;
  }
  function movAtual(){
    if (selTipo !== 'mov' || !sel) return null;
    return M.movelDe(sel);
  }
  function selecionarMovel(id){ sel = id; selTipo = id ? 'mov' : 'amb'; render(); UI.inspector(); UI.radial(id ? movAtual() : null); }
  /* ímã do móvel: encosta a caixa envolvente nas faces internas das paredes e nas bordas dos vizinhos */
  function grudarMovel(mv, nx, ny){
    var b = MOVEIS.aabb(mv), hw = b.w / 2, hh = b.h / 2, r = M.ambienteDe({x:nx, y:ny}) || M.ambienteDe(mv);
    var ax = [], ay = [];
    if (r) { ax.push(r.x + PAREDE / 2 + hw, r.x + r.w - PAREDE / 2 - hw); ay.push(r.y + PAREDE / 2 + hh, r.y + r.h - PAREDE / 2 - hh); }
    (M.proj.moveis || []).forEach(function (o) {
      if (o.id === mv.id || (o.pav || 0) !== (mv.pav || 0)) return;
      var ob = MOVEIS.aabb(o);
      ax.push(ob.x - hw, ob.x + ob.w + hw, ob.x + ob.w / 2); ay.push(ob.y - hh, ob.y + ob.h + hh, ob.y + ob.h / 2);
    });
    var bx = null, by = null;
    ax.forEach(function (v) { if (Math.abs(nx - v) <= IMA && (bx === null || Math.abs(nx - v) < Math.abs(nx - bx))) bx = v; });
    ay.forEach(function (v) { if (Math.abs(ny - v) <= IMA && (by === null || Math.abs(ny - v) < Math.abs(ny - by))) by = v; });
    return {x: bx === null ? nx : Math.round(bx), y: by === null ? ny : Math.round(by)};
  }
  /* posição do centro do móvel na tela (para o menu radial) */
  function telaDe(mv){
    if (!svg || !mv) return null;
    var pt = svg.createSVGPoint(); pt.x = mv.x; pt.y = mv.y;
    var m = svg.getScreenCTM(); if (!m) return null;
    var p = pt.matrixTransform(m);
    var b = MOVEIS.aabb(mv), esc = view.w / Math.max(1, host.clientWidth);
    return {x: p.x, y: p.y, rx: b.w / 2 / esc, ry: b.h / 2 / esc};
  }

  /* Largura de texto estimada em 0,55 em por caractere. Tenta o nome inteiro,
     depois a forma abreviada ("Área de serviço" -> "A. serviço"), depois as
     iniciais. Sempre devolve alguma coisa legível. */
  function rotuloQueCabe(nome, largura, fs){
    function cabe(t){ return t.length * fs * 0.55 <= largura; }
    if (cabe(nome)) return nome;
    var ps = nome.split(/\s+/).filter(function (p) { return p.length > 2; });
    if (ps.length > 1) {
      var abrev = ps[0].charAt(0).toUpperCase() + '. ' + ps.slice(1).join(' ');
      if (cabe(abrev)) return abrev;
      var ult = ps[ps.length - 1];
      if (cabe(ult)) return ult;
      var ini = ps.map(function (p) { return p.charAt(0).toUpperCase(); }).join('');
      if (cabe(ini)) return ini;   /* iniciais só fazem sentido com 2+ palavras */
    }
    var n = Math.max(1, Math.floor(largura / (fs * 0.55)) - 1);
    return nome.length > n ? nome.slice(0, n) + '…' : nome;
  }

  function esc4(s){ return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function defs(){
    return '<defs><marker id="ar" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">' +
      '<path d="M1 4 L7 1 M1 4 L7 7" stroke="#6B7885" stroke-width="1" fill="none"/></marker></defs>';
  }
  function grade(t){
    var esc = view.w / Math.max(1, host.clientWidth);
    var passo = esc > 3 ? 500 : 100, s = '', w = .6 * esc;
    for (var x = 0; x <= t.largura; x += passo)
      s += '<line x1="' + x + '" y1="0" x2="' + x + '" y2="' + t.profundidade + '" stroke="#DDE3E9" stroke-width="' + w + '"/>';
    for (var y = 0; y <= t.profundidade; y += passo)
      s += '<line x1="0" y1="' + y + '" x2="' + t.largura + '" y2="' + y + '" stroke="#DDE3E9" stroke-width="' + w + '"/>';
    return s;
  }
  function alcas(a, esc){
    var r = 4.5 * esc, s = '';
    pontos(a).forEach(function (p) {
      s += '<rect class="alca" data-h="' + p.k + '" x="' + (p.x - r) + '" y="' + (p.y - r) + '" width="' + (r * 2) +
           '" height="' + (r * 2) + '" rx="' + (1.2 * esc) + '" fill="#fff" stroke="#0F7E96" stroke-width="' + (1.4 * esc) + '"/>';
    });
    return s;
  }
  function pontos(a){
    return [
      {k:'nw', x:a.x,           y:a.y},
      {k:'n',  x:a.x + a.w / 2, y:a.y},
      {k:'ne', x:a.x + a.w,     y:a.y},
      {k:'e',  x:a.x + a.w,     y:a.y + a.h / 2},
      {k:'se', x:a.x + a.w,     y:a.y + a.h},
      {k:'s',  x:a.x + a.w / 2, y:a.y + a.h},
      {k:'sw', x:a.x,           y:a.y + a.h},
      {k:'w',  x:a.x,           y:a.y + a.h / 2}
    ];
  }

  /* cotas externas do terreno + cotas do ambiente selecionado */
  function cotas(esc){
    var t = M.proj.terreno, fs = 11 * esc, s = '';
    var off = Math.max(t.largura, t.profundidade) * 0.05;
    s += cota(0, -off, t.largura, -off, M.fmtMs(t.largura), fs, esc, 'terreno-larg');
    s += cota(-off, 0, -off, t.profundidade, M.fmtMs(t.profundidade), fs, esc, 'terreno-prof');
    var a = atual();
    if (a) {
      s += cota(a.x, a.y - off * .55, a.x + a.w, a.y - off * .55, M.fmtMs(a.w), fs, esc, 'amb-w:' + a.id);
      s += cota(a.x + a.w + off * .55, a.y, a.x + a.w + off * .55, a.y + a.h, M.fmtMs(a.h), fs, esc, 'amb-h:' + a.id);
    }
    return s;
  }
  function cota(x1, y1, x2, y2, txt, fs, esc, key){
    var horiz = y1 === y2, mx = (x1 + x2) / 2, my = (y1 + y2) / 2, s = '';
    s += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="#6B7885" stroke-width="' + (0.9 * esc) + '" marker-start="url(#ar)" marker-end="url(#ar)"/>';
    var tick = 5 * esc;
    if (horiz) {
      s += '<line x1="' + x1 + '" y1="' + (y1 - tick) + '" x2="' + x1 + '" y2="' + (y1 + tick) + '" stroke="#6B7885" stroke-width="' + (0.9 * esc) + '"/>';
      s += '<line x1="' + x2 + '" y1="' + (y2 - tick) + '" x2="' + x2 + '" y2="' + (y2 + tick) + '" stroke="#6B7885" stroke-width="' + (0.9 * esc) + '"/>';
    } else {
      s += '<line x1="' + (x1 - tick) + '" y1="' + y1 + '" x2="' + (x1 + tick) + '" y2="' + y1 + '" stroke="#6B7885" stroke-width="' + (0.9 * esc) + '"/>';
      s += '<line x1="' + (x2 - tick) + '" y1="' + y2 + '" x2="' + (x2 + tick) + '" y2="' + y2 + '" stroke="#6B7885" stroke-width="' + (0.9 * esc) + '"/>';
    }
    var bw = txt.length * fs * .62 + fs * .7, bh = fs * 1.45;
    s += '<g class="cota" data-cota="' + key + '" style="cursor:text">';
    s += '<rect x="' + (mx - bw / 2) + '" y="' + (my - bh / 2) + '" width="' + bw + '" height="' + bh + '" rx="' + (2 * esc) + '" fill="#F4F6F8"/>';
    s += '<text x="' + mx + '" y="' + (my + fs * .36) + '" text-anchor="middle" font-family="ui-monospace,monospace" font-size="' + fs + '" fill="#28313A">' + txt + '</text>';
    s += '</g>';
    return s;
  }

  /* ---------- seleção ---------- */
  function atual(){
    if (!sel || selTipo !== 'amb') return null;
    return M.proj.ambientes.filter(function (a) { return a.id === sel; })[0] || null;
  }
  function selecionar(id){ sel = id; selTipo = 'amb'; render(); UI.inspector(); UI.radial(null); }

  /* ---------- interação ---------- */
  function onDown(e){
    if (e.button === 2) return;
    ptrs[e.pointerId] = {x:e.clientX, y:e.clientY};
    if (Object.keys(ptrs).length === 2) {
      if (drag) cancelarDrag();          /* segundo dedo cancela o arrasto que tinha começado */
      var ks = Object.keys(ptrs), pa = ptrs[ks[0]], pb = ptrs[ks[1]];
      pinch = {d0:Math.max(1, Math.hypot(pa.x - pb.x, pa.y - pb.y)),
               c0:toModel({clientX:(pa.x + pb.x) / 2, clientY:(pa.y + pb.y) / 2}),
               v0:{x:view.x, y:view.y, w:view.w, h:view.h}};
      svg.setPointerCapture(e.pointerId); return;
    }
    if (pinch) return;
    var p = toModel(e);

    /* cota → edição no lugar */
    var alvoCota = e.target.closest ? e.target.closest('[data-cota]') : null;
    if (alvoCota) { UI.editarCota(alvoCota.getAttribute('data-cota'), e.clientX, e.clientY); return; }

    /* alça de giro do móvel */
    var rot = e.target.closest ? e.target.closest('.mov-rot') : null;
    if (rot && movAtual()) {
      var mv0 = movAtual();
      drag = {modo:'movrot', id:mv0.id, rot0:mv0.rot || 0, mudou:false};
      UI.radial(null); svg.setPointerCapture(e.pointerId); return;
    }
    /* móvel → arrastar (tem prioridade sobre o ambiente embaixo) */
    var gm = e.target.closest ? e.target.closest('.mov') : null;
    if (gm && tool === 'sel' && !UI.espaco) {
      var mid = gm.getAttribute('data-id'), mv = M.movelDe(mid);
      if (mv) {
        drag = {modo:'movmove', id:mid, ini:{x:mv.x, y:mv.y}, off:{x:p.x - mv.x, y:p.y - mv.y}, mudou:false};
        selecionarMovel(mid); UI.radial(null);
        svg.setPointerCapture(e.pointerId); return;
      }
    }

    /* alça → redimensionar */
    var alca = e.target.closest ? e.target.closest('.alca') : null;
    if (alca && atual()) {
      var a0 = atual();
      drag = {modo:'resize', h:alca.getAttribute('data-h'), id:a0.id, ini:{x:a0.x, y:a0.y, w:a0.w, h:a0.h}, p0:p, mudou:false};
      svg.setPointerCapture(e.pointerId); return;
    }

    /* ferramenta mão / espaço / botão do meio → pan */
    if (tool === 'pan' || e.button === 1 || UI.espaco) {
      drag = {modo:'pan', p0:p, v0:{x:view.x, y:view.y}}; svg.setPointerCapture(e.pointerId); return;
    }

    /* ferramenta ambiente → desenhar retângulo novo */
    if (tool === 'room') {
      drag = {modo:'novo', p0:{x:snap(p.x), y:snap(p.y)}, novo:null};
      svg.setPointerCapture(e.pointerId); return;
    }

    /* ambiente → arrastar */
    var g = e.target.closest ? e.target.closest('.amb') : null;
    if (g) {
      var id = g.getAttribute('data-id');
      var a = M.proj.ambientes.filter(function (x) { return x.id === id; })[0];
      drag = {modo:'move', id:id, ini:{x:a.x, y:a.y}, off:{x:p.x - a.x, y:p.y - a.y}, mudou:false};
      selecionar(id);
      svg.setPointerCapture(e.pointerId);
    } else {
      selecionar(null);
    }
  }

  function onHover(e){
    if (ptrs[e.pointerId]) ptrs[e.pointerId] = {x:e.clientX, y:e.clientY};
    if (pinch) {
      var ks = Object.keys(ptrs); if (ks.length < 2) return;
      var pa = ptrs[ks[0]], pb = ptrs[ks[1]];
      var f = pinch.d0 / Math.max(1, Math.hypot(pa.x - pb.x, pa.y - pb.y));
      setView(pinch.v0.x, pinch.v0.y, pinch.v0.w * f, pinch.v0.h * f);
      var pm = toModel({clientX:(pa.x + pb.x) / 2, clientY:(pa.y + pb.y) / 2});
      setView(view.x + (pinch.c0.x - pm.x), view.y + (pinch.c0.y - pm.y), view.w, view.h);
      render(); UI.radial(movAtual()); return;
    }
    var p = toModel(e);
    UI.coord(p.x, p.y);
    if (!drag) return;

    if (drag.modo === 'pan') {
      setView(drag.v0.x - (p.x - drag.p0.x), drag.v0.y - (p.y - drag.p0.y), view.w, view.h);
      render(); UI.radial(movAtual()); return;
    }
    if (drag.modo === 'novo') {
      var x = Math.min(drag.p0.x, snap(p.x)), y = Math.min(drag.p0.y, snap(p.y));
      drag.novo = {x:x, y:y, w:Math.abs(snap(p.x) - drag.p0.x), h:Math.abs(snap(p.y) - drag.p0.y)};
      UI.hud(M.fmtMs(drag.novo.w) + ' × ' + M.fmtMs(drag.novo.h) + ' m');
      render(); return;
    }

    if (drag.modo === 'movmove' || drag.modo === 'movrot') {
      var mv = M.movelDe(drag.id); if (!mv) return;
      if (drag.modo === 'movmove') {
        var mx = snap(p.x - drag.off.x), my = snap(p.y - drag.off.y);
        if (!UI.alt) { var gm2 = grudarMovel(mv, mx, my); mx = gm2.x; my = gm2.y; }
        if (UI.shift) { if (Math.abs(mx - drag.ini.x) > Math.abs(my - drag.ini.y)) my = drag.ini.y; else mx = drag.ini.x; }
        mv.x = mx; mv.y = my;
        var amb = M.ambienteDe(mv); mv.amb = amb ? amb.id : undefined;
        var dm = MOVEIS.dims(mv);
        UI.hud(MOVEIS.def(mv.k).nome + '  ' + M.fmtMs(dm.w) + ' × ' + M.fmtMs(dm.d) + ' m' + (amb ? '  ·  ' + amb.nome : ''));
      } else {
        var ang = Math.atan2(p.y - mv.y, p.x - mv.x) * 180 / Math.PI + 90;
        ang = Math.round(ang / 5) * 5;
        var q = Math.round(ang / 45) * 45; if (Math.abs(ang - q) <= 7) ang = q;
        mv.rot = (ang + 360) % 360;
        UI.hud(mv.rot + '°');
      }
      drag.mudou = true; render(); UI.inspector(); return;
    }

    var a = M.proj.ambientes.filter(function (x) { return x.id === drag.id; })[0];
    if (!a) return;

    if (drag.modo === 'move') {
      var nx = snap(p.x - drag.off.x), ny = snap(p.y - drag.off.y);
      if (!UI.alt) { var g = grudar(a, nx, ny); nx = g.x; ny = g.y; guias = g.guias; } else guias = [];
      if (UI.shift) {   /* trava no eixo de maior deslocamento */
        if (Math.abs(nx - drag.ini.x) > Math.abs(ny - drag.ini.y)) ny = drag.ini.y; else nx = drag.ini.x;
      }
      a.x = nx; a.y = ny; drag.mudou = true;
      UI.hud(a.nome + '  ' + M.fmtMs(a.w) + ' × ' + M.fmtMs(a.h) + ' m');
    }
    if (drag.modo === 'resize') {
      var i = drag.ini, h = drag.h;
      var x1 = i.x, y1 = i.y, x2 = i.x + i.w, y2 = i.y + i.h;
      if (h.indexOf('w') >= 0) x1 = snap(p.x);
      if (h.indexOf('e') >= 0) x2 = snap(p.x);
      if (h.indexOf('n') >= 0) y1 = snap(p.y);
      if (h.indexOf('s') >= 0) y2 = snap(p.y);
      a.x = Math.min(x1, x2); a.y = Math.min(y1, y2);
      a.w = Math.max(90, Math.abs(x2 - x1)); a.h = Math.max(90, Math.abs(y2 - y1));
      drag.mudou = true;
      UI.hud(M.fmtMs(a.w) + ' × ' + M.fmtMs(a.h) + ' m   ' + M.fmtM2(M.areaOf(a)));
    }
    render(); UI.inspector();
  }

  /* desfaz o arrasto em andamento sem gravar (segundo dedo encostou) */
  function cancelarDrag(){
    var d = drag; drag = null; guias = []; UI.hud(null);
    if (d.modo === 'move' || d.modo === 'resize') {
      var a = M.proj.ambientes.filter(function (x) { return x.id === d.id; })[0];
      if (a) { a.x = d.ini.x; a.y = d.ini.y; if (d.ini.w) { a.w = d.ini.w; a.h = d.ini.h; } }
    }
    if (d.modo === 'movmove') { var mv = M.movelDe(d.id); if (mv) { mv.x = d.ini.x; mv.y = d.ini.y; } }
    if (d.modo === 'movrot') { var mv2 = M.movelDe(d.id); if (mv2) mv2.rot = d.rot0; }
    render();
  }

  function onUp(e){
    if (e && e.pointerId !== undefined) delete ptrs[e.pointerId];
    if (pinch) { if (Object.keys(ptrs).length < 2) pinch = null; return; }
    if (!drag) return;
    var d = drag; drag = null; guias = []; UI.hud(null);
    if (!d.mudou && d.modo !== 'novo' && d.modo !== 'pan') UI.selTap();
    if (d.modo === 'novo' && d.novo && d.novo.w >= 90 && d.novo.h >= 90) {
      var a = {id:M.uid(), nome:'Ambiente', tipo:M.pav > 0 ? 'intimo' : 'social', x:d.novo.x, y:d.novo.y, w:d.novo.w, h:d.novo.h};
      if (M.pav > 0) a.pav = M.pav;
      M.proj.ambientes.push(a);
      M.commit('Criar ambiente');
      selecionar(a.id); UI.setTool('sel');
      UI.toast('Ambiente criado. Dê um duplo clique para renomear.');
    } else if (d.mudou && (d.modo === 'movmove' || d.modo === 'movrot')) {
      M.commit(d.modo === 'movmove' ? 'Mover móvel' : 'Girar móvel');
      render(); UI.inspector(); UI.refreshTop(); UI.radial(movAtual()); return;
    } else if (d.modo === 'movmove' || d.modo === 'movrot') {
      UI.radial(movAtual());
    } else if (d.mudou) {
      var nome = d.modo === 'move' ? 'Mover ambiente' : 'Redimensionar ambiente';
      M.commit(nome);
      var probs = M.problemas().filter(function (q) { return q.id === d.id; });
      if (probs.length) UI.toast(probs[0].msg, null, true);
    }
    render(); UI.inspector(); UI.refreshTop();
  }

  function onDbl(e){
    if (e.target.closest && e.target.closest('.mov')) return;
    var g = e.target.closest ? e.target.closest('.amb') : null;
    if (!g) return;
    var id = g.getAttribute('data-id');
    selecionar(id);
    UI.renomearInline(id, e.clientX, e.clientY);
  }

  function onWheel(e){
    e.preventDefault();
    var p = toModel(e);
    zoom(e.deltaY > 0 ? 1.12 : 0.89, p.x, p.y);
  }

  function snap(v){ return Math.round(v / SNAP) * SNAP; }

  /* grude em bordas e eixos dos vizinhos, devolvendo as guias para desenhar */
  function grudar(a, nx, ny){
    var gs = [], t = M.proj.terreno;
    var alvosX = [0, t.largura, t.recuoLateral, t.largura - t.recuoLateral];
    var alvosY = [0, t.profundidade, t.recuoFrontal, t.profundidade - t.recuoFundo];
    /* vizinhos do mesmo andar + paredes do andar de baixo (o de cima gruda no de baixo) */
    var pa = M.pavDe(a), alvos = M.ambsPav(pa).concat(pa > 0 ? M.ambsPav(pa - 1) : []);
    alvos.forEach(function (o) {
      if (o.id === a.id) return;
      alvosX.push(o.x, o.x + o.w, o.x - a.w, o.x + o.w - a.w);
      alvosY.push(o.y, o.y + o.h, o.y - a.h, o.y + o.h - a.h);
    });
    var bx = null, by = null;
    alvosX.forEach(function (v) { if (Math.abs(nx - v) <= IMA && (bx === null || Math.abs(nx - v) < Math.abs(nx - bx))) bx = v; });
    alvosY.forEach(function (v) { if (Math.abs(ny - v) <= IMA && (by === null || Math.abs(ny - v) < Math.abs(ny - by))) by = v; });
    if (bx !== null) { nx = bx; gs.push({x1:bx, y1:-999999, x2:bx, y2:999999}); }
    if (by !== null) { ny = by; gs.push({x1:-999999, y1:by, x2:999999, y2:by}); }
    return {x:nx, y:ny, guias:gs};
  }

  /* ---------- API ---------- */
  return {
    montar:montar, render:render, enquadrar:enquadrar, enquadrarAmb:enquadrarAmb, zoom:zoom, setView:setView,
    get view(){ return view; },
    get sel(){ return sel; }, get selTipo(){ return selTipo; }, selecionar:selecionar, atual:atual,
    movAtual:movAtual, selecionarMovel:selecionarMovel, telaDe:telaDe, PAREDE:PAREDE,
    setTool:function (t) { tool = t; }, get tool(){ return tool; },
    toggleGrid:function () { showGrid = !showGrid; render(); return showGrid; },
    toggleCotas:function () { showCotas = !showCotas; render(); return showCotas; },
    onUp:onUp, toModel:toModel,
    get svgEl(){ return svg; }
  };
})();
document.addEventListener('pointerup', function (e) { PLAN.onUp(e); });
document.addEventListener('pointercancel', function (e) { PLAN.onUp(e); });
