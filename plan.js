/* =========================================================================
   PLAN — desenho e manipulação direta da planta em SVG.
   Todo movimento acontece no espaço do modelo (cm), nunca em pixels de tela.
   ========================================================================= */
var PLAN = (function () {

  var svg, gRoot, host;
  var view = {x:0, y:0, w:1000, h:1000};   // viewBox em cm
  var sel = null, selTipo = 'amb', tool = 'sel';   /* selTipo: 'amb' (ambiente) ou 'mov' (móvel) */
  /* seleção em GRUPO (laço): lista de {t:'amb'|'mov', id}. Arrastar qualquer item do grupo move todos juntos;
     um ambiente sempre leva os móveis que estão dentro dele (nada se separa). */
  var multi = [];
  function emMulti(t, id){ return multi.some(function (m) { return m.t === t && m.id === id; }); }
  function setMulti(lista){ multi = lista || []; sel = null; render(); UI.inspector(); UI.radial(null); }
  function toggleMulti(t, id){
    if (emMulti(t, id)) multi = multi.filter(function (m) { return !(m.t === t && m.id === id); });
    else { if (sel && !multi.length) multi.push({t:selTipo, id:sel}); multi.push({t:t, id:id}); }
    if (multi.length === 1) { var u = multi[0]; multi = []; if (u.t === 'mov') selecionarMovel(u.id); else selecionar(u.id); return; }
    sel = null; render(); UI.inspector(); UI.radial(null);
  }
  /* itens do grupo com posição inicial (para arrastar / cancelar): ambientes + móveis dentro deles + móveis avulsos */
  function itensGrupo(){
    var ambs = [], movs = [], vistos = {};
    multi.forEach(function (m) {
      if (m.t === 'amb') { var a = M.proj.ambientes.filter(function (x) { return x.id === m.id; })[0]; if (!a) return; ambs.push({a:a, x0:a.x, y0:a.y });
        M.moveisDe(a.id).forEach(function (mv) { if (!vistos[mv.id]) { vistos[mv.id] = 1; movs.push({m:mv, x0:mv.x, y0:mv.y}); } }); }
    });
    multi.forEach(function (m) { if (m.t === 'mov') { var mv = M.movelDe(m.id); if (mv && !vistos[mv.id]) { vistos[mv.id] = 1; movs.push({m:mv, x0:mv.x, y0:mv.y}); } } });
    return {ambs:ambs, movs:movs};
  }
  function moverGrupo(g, dx, dy){
    g.ambs.forEach(function (o) { o.a.x = o.x0 + dx; o.a.y = o.y0 + dy; });
    g.movs.forEach(function (o) { o.m.x = o.x0 + dx; o.m.y = o.y0 + dy; var amb = M.ambienteDe(o.m); o.m.amb = amb ? amb.id : undefined; });
  }
  function bboxGrupo(g){
    var x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    g.ambs.forEach(function (o) { x1 = Math.min(x1, o.a.x); y1 = Math.min(y1, o.a.y); x2 = Math.max(x2, o.a.x + o.a.w); y2 = Math.max(y2, o.a.y + o.a.h); });
    g.movs.forEach(function (o) { var d = MOVEIS.dims(o.m); x1 = Math.min(x1, o.m.x - d.w / 2); y1 = Math.min(y1, o.m.y - d.d / 2); x2 = Math.max(x2, o.m.x + d.w / 2); y2 = Math.max(y2, o.m.y + d.d / 2); });
    return x1 < Infinity ? {x:x1, y:y1, w:x2 - x1, h:y2 - y1} : null;
  }
  var VERDE = '#2FA36B';
  /* grade/cotas/móveis/etc. são CAMADAS do projeto (M.camada) — visível e bloqueada; vindo do ACQUA BELO */
  function vis(k){ return M.camada(k).vis; }
  function bloq(k){ return M.camada(k).bloq; }
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
    svg.addEventListener('contextmenu', function (e) { e.preventDefault(); UI.menuContexto(e); });   /* botão direito = menu com as ações do item */
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
    if (vis('grade')) s += grade(t);

    /* terreno + recuos */
    s += '<rect x="0" y="0" width="' + t.largura + '" height="' + t.profundidade + '" fill="#FFFFFF" stroke="#B6C0C9" stroke-width="' + (2 * esc) + '"/>';
    if (vis('terreno')) s += '<rect x="' + t.recuoLateral + '" y="' + t.recuoFrontal + '" width="' + (t.largura - t.recuoLateral * 2) +
         '" height="' + (t.profundidade - t.recuoFrontal - t.recuoFundo) + '" fill="none" stroke="#22B8D6" stroke-opacity=".45" stroke-width="' + (1.2 * esc) + '" stroke-dasharray="' + (10 * esc) + ' ' + (8 * esc) + '"/>';

    /* andar de baixo em fantasma (para alinhar o andar de cima) */
    var pav = M.pav;
    if (pav > 0 && vis('fantasma')) {
      M.ambsPav(pav - 1).forEach(function (b) {
        s += '<rect x="' + b.x + '" y="' + b.y + '" width="' + b.w + '" height="' + b.h + '" fill="#8FA3B1" fill-opacity=".08" stroke="#8FA3B1" stroke-width="' + (1.4 * esc) + '" stroke-dasharray="' + (8 * esc) + ' ' + (6 * esc) + '" style="pointer-events:none"/>';
      });
    }
    /* ambientes */
    var probs = M.problemas(), ruins = {};
    probs.forEach(function (q) { if (q.id) ruins[q.id] = true; });

    /* piscina por cima do salão que a contém (partido da escola de natação) */
    M.ambsPav(pav).slice().sort(function (a, b) { return (a.tipo === 'agua') - (b.tipo === 'agua'); }).forEach(function (a) {
      if (!vis(a.tipo === 'agua' ? 'piscina' : 'ambientes')) return;
      var ti = M.TIPOS[a.tipo] || M.TIPOS.social;
      var ruim = ruins[a.id], on = sel === a.id || emMulti('amb', a.id);
      s += '<g class="amb' + (bloq(a.tipo === 'agua' ? 'piscina' : 'ambientes') ? ' bloq' : '') + '" data-id="' + a.id + '">';
      s += '<rect x="' + a.x + '" y="' + a.y + '" width="' + a.w + '" height="' + a.h + '" rx="' + (2 * esc) +
           '" fill="' + ti.cor + '" fill-opacity="' + (a.tipo === 'agua' ? .5 : .13) + '"/>';
      /* parede: traço grosso por dentro */
      s += '<rect x="' + (a.x + PAREDE / 2) + '" y="' + (a.y + PAREDE / 2) + '" width="' + Math.max(1, a.w - PAREDE) +
           '" height="' + Math.max(1, a.h - PAREDE) + '" fill="none" stroke="' + (ruim ? '#E5533D' : '#1B2229') +
           '" stroke-width="' + PAREDE + '" stroke-opacity="' + (ruim ? .85 : .9) + '"/>';
      if (a.tipo === 'agua') {
        /* raias correm no sentido do comprimento; a largura (lado menor) é dividida em `raias` */
        var pc = M.piscinaCfg(a), raias = pc.raias, vert = a.h >= a.w, larg = vert ? a.w : a.h, passo = larg / raias;
        for (var i = 1; i < raias; i++) {
          var d0 = passo * i;
          s += vert
            ? '<line x1="' + (a.x + d0) + '" y1="' + (a.y + 25) + '" x2="' + (a.x + d0) + '" y2="' + (a.y + a.h - 25) + '" stroke="#1E7E96" stroke-width="' + (1.4 * esc) + '" stroke-dasharray="' + (22 * esc) + ' ' + (16 * esc) + '"/>'
            : '<line x1="' + (a.x + 25) + '" y1="' + (a.y + d0) + '" x2="' + (a.x + a.w - 25) + '" y2="' + (a.y + d0) + '" stroke="#1E7E96" stroke-width="' + (1.4 * esc) + '" stroke-dasharray="' + (22 * esc) + ' ' + (16 * esc) + '"/>';
        }
        /* linha de blocos de partida / profundidade */
        if (larg / esc > 40) { var fsP = Math.max(7.5 * esc, Math.min(11 * esc, larg * .1));
          s += '<text x="' + (a.x + a.w - 8 * esc) + '" y="' + (a.y + fsP * 1.3) + '" text-anchor="end" font-family="ui-monospace,monospace" font-size="' + fsP + '" fill="#0F5E72" style="pointer-events:none">' + M.fmtMs(pc.prof) + '–' + M.fmtMs(pc.profMax) + ' m · ' + raias + (raias > 1 ? ' raias' : ' raia') + '</text>'; }
      }
      /* rótulo — abrevia em vez de sumir; só desaparece quando é ilegível mesmo */
      var pxW = a.w / esc, pxH = a.h / esc;
      if (pxW > 34 && pxH > 22 && vis('rotulos')) {
        /* rótulo no canto inferior esquerdo, com fundo translúcido — legível por cima dos móveis */
        var fs = Math.min(a.w, a.h) * 0.13, fsMax = 13 * esc, fsMin = 7.5 * esc;
        fs = Math.max(fsMin, Math.min(fsMax, fs));
        var rot = rotuloQueCabe(a.nome, a.w - 24 * esc, fs), area = pxH > 40 ? '  ' + M.fmtM2(M.areaOf(a)) : '';
        var tw = (rot.length * .55 + area.length * .5) * fs, th = fs * 1.6, lx = a.x + PAREDE / 2 + 5 * esc, ly = a.y + a.h - PAREDE / 2 - 5 * esc - th;
        if (a.tipo !== 'agua' && M.piscinas().some(function (q) { return M.contem(a, q); })) ly = a.y + PAREDE / 2 + 5 * esc;   /* salão com piscina: rótulo em cima, longe do da piscina */
        s += '<g style="pointer-events:none"><rect x="' + lx + '" y="' + ly + '" width="' + (tw + fs * .9) + '" height="' + th + '" rx="' + (th / 2) + '" fill="#FFFFFF" fill-opacity=".82"/>';
        s += '<text x="' + (lx + fs * .45) + '" y="' + (ly + th * .68) + '" font-family="Inter,system-ui,sans-serif" font-size="' + fs + '" fill="#28313A">' + esc4(rot) +
             (area ? '<tspan font-family="ui-monospace,monospace" font-size="' + (fs * .82) + '" fill="#6B7885">' + area + '</tspan>' : '') + '</text></g>';
      }
      if (on) {
        s += '<rect x="' + (a.x - 3 * esc) + '" y="' + (a.y - 3 * esc) + '" width="' + (a.w + 6 * esc) + '" height="' + (a.h + 6 * esc) +
             '" fill="none" stroke="#0F7E96" stroke-width="' + (2 * esc) + '"/>';
        if (!bloq(a.tipo === 'agua' ? 'piscina' : 'ambientes') && !multi.length) s += alcas(a, esc);   /* no grupo não há redimensionar, só mover */
      }
      s += '</g>';
    });
    /* coberturas independentes: projeção tracejada + pilares + caimento (o telhado à parte, com pilares próprios) */
    if (vis('coberturas')) M.cobsPav(pav).forEach(function (c) {
      var f = M.cobCfg(c), on = (selTipo === 'cob' && sel === c.id), PM = M.PILAR_MATS[f.pilarMat] || M.PILAR_MATS.concreto, esp = f.pilarEsp || PM.esp;
      s += '<g class="cob' + (bloq('coberturas') ? ' bloq' : '') + '" data-id="' + c.id + '">';
      s += '<rect x="' + c.x + '" y="' + c.y + '" width="' + c.w + '" height="' + c.h + '" fill="#8B5E3C" fill-opacity=".07" stroke="#8B5E3C" stroke-width="' + (1.8 * esc) + '" stroke-dasharray="' + (14 * esc) + ' ' + (9 * esc) + '"/>';
      /* beiral */
      if (f.beiral > 0) s += '<rect x="' + (c.x - f.beiral) + '" y="' + (c.y - f.beiral) + '" width="' + (c.w + f.beiral * 2) + '" height="' + (c.h + f.beiral * 2) + '" fill="none" stroke="#8B5E3C" stroke-opacity=".45" stroke-width="' + (1 * esc) + '" stroke-dasharray="' + (5 * esc) + ' ' + (5 * esc) + '"/>';
      /* pilares nas bordas (mesma grade do 3D) */
      var nx = Math.max(2, f.nx | 0), ny = Math.max(2, f.ny | 0);
      for (var i = 0; i < nx; i++) for (var j = 0; j < ny; j++) {
        if (i > 0 && i < nx - 1 && j > 0 && j < ny - 1) continue;
        var px = c.x + esp / 2 + i * (c.w - esp) / (nx - 1), py = c.y + esp / 2 + j * (c.h - esp) / (ny - 1);
        s += f.pilarMat === 'tubo'
          ? '<circle cx="' + px + '" cy="' + py + '" r="' + (esp / 2) + '" fill="#1B2229" fill-opacity=".8"/>'
          : '<rect x="' + (px - esp / 2) + '" y="' + (py - esp / 2) + '" width="' + esp + '" height="' + esp + '" fill="#1B2229" fill-opacity=".8"/>';
      }
      /* caimento: seta do ponto alto para o baixo */
      var alongX = c.w >= c.h, cxm = c.x + c.w / 2, cym = c.y + c.h / 2;
      if (f.tipo === 'duas' || f.tipo === 'quatro') s += alongX
        ? '<line x1="' + c.x + '" y1="' + cym + '" x2="' + (c.x + c.w) + '" y2="' + cym + '" stroke="#8B5E3C" stroke-opacity=".7" stroke-width="' + (1.4 * esc) + '"/>'
        : '<line x1="' + cxm + '" y1="' + c.y + '" x2="' + cxm + '" y2="' + (c.y + c.h) + '" stroke="#8B5E3C" stroke-opacity=".7" stroke-width="' + (1.4 * esc) + '"/>';
      if (f.tipo === 'uma') { var ax0 = alongX ? cxm : cxm, ay0 = alongX ? c.y + c.h * .25 : c.y + c.h * .25;
        s += '<path d="M' + cxm + ' ' + (c.y + 20) + ' L' + cxm + ' ' + (c.y + c.h - 20) + ' M' + (cxm - 12 * esc) + ' ' + (c.y + c.h - 20 - 14 * esc) + ' L' + cxm + ' ' + (c.y + c.h - 20) + ' L' + (cxm + 12 * esc) + ' ' + (c.y + c.h - 20 - 14 * esc) + '" fill="none" stroke="#8B5E3C" stroke-opacity=".7" stroke-width="' + (1.4 * esc) + '"/>'; }
      /* rótulo */
      if (c.w / esc > 40 && c.h / esc > 24 && vis('rotulos')) {
        var fsC = Math.max(7.5 * esc, Math.min(12 * esc, Math.min(c.w, c.h) * .12));
        s += '<g style="pointer-events:none"><rect x="' + (c.x + 6 * esc) + '" y="' + (c.y + 6 * esc) + '" width="' + ((c.nome.length * .56 + 6) * fsC) + '" height="' + (fsC * 1.6) + '" rx="' + (fsC * .8) + '" fill="#FFFFFF" fill-opacity=".82"/>' +
          '<text x="' + (c.x + 6 * esc + fsC * .5) + '" y="' + (c.y + 6 * esc + fsC * 1.1) + '" font-family="Inter,system-ui,sans-serif" font-size="' + fsC + '" fill="#6B4423">' + esc4(c.nome) +
          '<tspan font-family="ui-monospace,monospace" font-size="' + (fsC * .8) + '" fill="#8B7355">  ' + M.fmtM2(M.areaCob(c) * 10000) + '</tspan></text></g>';
      }
      if (on) {
        s += '<rect x="' + (c.x - 3 * esc) + '" y="' + (c.y - 3 * esc) + '" width="' + (c.w + 6 * esc) + '" height="' + (c.h + 6 * esc) + '" fill="none" stroke="#0F7E96" stroke-width="' + (2 * esc) + '"/>';
        if (!bloq('coberturas')) s += alcas(c, esc);
      }
      s += '</g>';
    });
    /* escada (derivada de M.escada): degraus no térreo, vão no andar de cima */
    var esc2 = M.escada();
    if (esc2 && (pav === 0 || pav === 1) && vis('escada')) {
      s += '<g style="pointer-events:none"><rect x="' + esc2.x + '" y="' + esc2.y + '" width="' + esc2.w + '" height="' + esc2.h + '" fill="' + (pav === 0 ? '#FFFFFF' : '#F4F6F8') + '" fill-opacity=".9" stroke="#1B2229" stroke-width="' + (1.6 * esc) + '"' + (pav === 1 ? ' stroke-dasharray="' + (6 * esc) + ' ' + (4 * esc) + '"' : '') + '/>';
      if (pav === 0) { var dg = esc2.degraus, passo = esc2.h / dg; for (var di = 1; di < dg; di++) s += '<line x1="' + esc2.x + '" y1="' + (esc2.y + di * passo) + '" x2="' + (esc2.x + esc2.w) + '" y2="' + (esc2.y + di * passo) + '" stroke="#1B2229" stroke-width="' + (1 * esc) + '"/>';
        s += '<line x1="' + (esc2.x + esc2.w / 2) + '" y1="' + (esc2.y + esc2.h - 10) + '" x2="' + (esc2.x + esc2.w / 2) + '" y2="' + (esc2.y + 14) + '" stroke="#22B8D6" stroke-width="' + (1.6 * esc) + '"/><path d="M' + (esc2.x + esc2.w / 2 - 8) + ' ' + (esc2.y + 26) + ' l8 -14 l8 14" fill="none" stroke="#22B8D6" stroke-width="' + (1.6 * esc) + '"/>'; }
      else s += '<line x1="' + esc2.x + '" y1="' + esc2.y + '" x2="' + (esc2.x + esc2.w) + '" y2="' + (esc2.y + esc2.h) + '" stroke="#8FA3B1" stroke-width="' + (1 * esc) + '"/>';
      s += '</g>';
    }

    if (vis('ambientes')) s += aberturasSvg(esc, pav);
    if (vis('moveis')) s += moveisSvg(esc);
    if (vis('cotas')) s += cotas(esc);
    guias.forEach(function (g) {
      s += '<line x1="' + g.x1 + '" y1="' + g.y1 + '" x2="' + g.x2 + '" y2="' + g.y2 +
           '" stroke="#E5533D" stroke-width="' + (1 * esc) + '" stroke-dasharray="' + (14 * esc) + ' ' + (10 * esc) + '"/>';
    });
    if (drag && drag.modo === 'novo' && drag.novo)
      s += '<rect' + (drag.cob ? ' stroke-dasharray="' + (14 * esc) + ' ' + (9 * esc) + '"' : '') + ' x="' + drag.novo.x + '" y="' + drag.novo.y + '" width="' + drag.novo.w + '" height="' + drag.novo.h +
           '" fill="#22B8D6" fill-opacity=".18" stroke="#0F7E96" stroke-width="' + (1.6 * esc) + '"/>';
    /* laço de seleção */
    if (drag && drag.modo === 'laco') {
      var lx = Math.min(drag.p0.x, drag.p1.x), ly2 = Math.min(drag.p0.y, drag.p1.y), lw = Math.abs(drag.p1.x - drag.p0.x), lh = Math.abs(drag.p1.y - drag.p0.y);
      s += '<rect x="' + lx + '" y="' + ly2 + '" width="' + lw + '" height="' + lh + '" fill="#22B8D6" fill-opacity=".10" stroke="#0F7E96" stroke-width="' + (1.2 * esc) + '" stroke-dasharray="' + (8 * esc) + ' ' + (5 * esc) + '" style="pointer-events:none"/>';
    }
    /* moldura do grupo selecionado */
    if (multi.length > 1) {
      var bg = bboxGrupo(itensGrupo());
      if (bg) s += '<rect x="' + (bg.x - 8 * esc) + '" y="' + (bg.y - 8 * esc) + '" width="' + (bg.w + 16 * esc) + '" height="' + (bg.h + 16 * esc) + '" rx="' + (4 * esc) + '" fill="none" stroke="#0F7E96" stroke-width="' + (1.4 * esc) + '" stroke-dasharray="' + (10 * esc) + ' ' + (6 * esc) + '" style="pointer-events:none"/>';
    }

    svg.innerHTML = s;
  }

  /* ---------- portas e janelas na planta: saem do TRES.analise (a mesma fonte do 3D); clicáveis → mesmo popover ---------- */
  function aberturasSvg(esc, pav){
    if (!window.TRES || !M.proj.ambientes.length) return '';
    var an; try { an = TRES.analise(M.proj, pav); } catch (e) { return ''; }
    var s = '', sw = 1.4 * esc;
    an.pecas.forEach(function (pc) {
      pc.ab.forEach(function (ab) {
        var w = ab.e - ab.s, aLado = pc.A ? PAREDE : 0, bLado = pc.B ? PAREDE : 0;   /* espessura da parede de cada lado da linha */
        var fk = ab.tipo === 'janela' ? 'janela' : ab.tipo === 'portao' ? 'garagem' : ab.tipo === 'entrada' ? 'porta' : 'portaInt';
        var horiz = pc.o === 'h', x, y, rw, rh;
        if (horiz) { x = ab.s; y = pc.c - aLado; rw = w; rh = aLado + bLado; } else { x = pc.c - aLado; y = ab.s; rw = aLado + bLado; rh = w; }
        if (rw <= 0 || rh <= 0) return;
        s += '<g class="ab" data-fk="' + fk + '" data-id="' + (ab.chave || pc.chave || '') + '" style="cursor:pointer">';
        /* abre o vão na parede */
        s += '<rect x="' + x + '" y="' + y + '" width="' + rw + '" height="' + rh + '" fill="#FFFFFF"/>';
        if (ab.tipo === 'janela') {   /* janela: duas linhas finas no vão + vidro azul */
          s += '<rect x="' + x + '" y="' + y + '" width="' + rw + '" height="' + rh + '" fill="#BFE4F0"/>';
          if (horiz) { s += '<line x1="' + x + '" y1="' + (y + rh * .35) + '" x2="' + (x + rw) + '" y2="' + (y + rh * .35) + '" stroke="#1B2229" stroke-width="' + sw + '"/><line x1="' + x + '" y1="' + (y + rh * .65) + '" x2="' + (x + rw) + '" y2="' + (y + rh * .65) + '" stroke="#1B2229" stroke-width="' + sw + '"/>'; }
          else { s += '<line x1="' + (x + rw * .35) + '" y1="' + y + '" x2="' + (x + rw * .35) + '" y2="' + (y + rh) + '" stroke="#1B2229" stroke-width="' + sw + '"/><line x1="' + (x + rw * .65) + '" y1="' + y + '" x2="' + (x + rw * .65) + '" y2="' + (y + rh) + '" stroke="#1B2229" stroke-width="' + sw + '"/>'; }
          s += '<rect x="' + x + '" y="' + y + '" width="' + rw + '" height="' + rh + '" fill="none" stroke="#1B2229" stroke-width="' + sw + '"/>';
        } else if (ab.tipo === 'portao') {   /* portão da garagem: traço tracejado no vão */
          if (horiz) s += '<line x1="' + x + '" y1="' + (pc.c) + '" x2="' + (x + rw) + '" y2="' + (pc.c) + '" stroke="#1B2229" stroke-width="' + (2 * esc) + '" stroke-dasharray="' + (14 * esc) + ' ' + (8 * esc) + '"/>';
          else s += '<line x1="' + pc.c + '" y1="' + y + '" x2="' + pc.c + '" y2="' + (y + rh) + '" stroke="#1B2229" stroke-width="' + (2 * esc) + '" stroke-dasharray="' + (14 * esc) + ' ' + (8 * esc) + '"/>';
        } else {   /* porta: folha + arco de abertura, para dentro do ambiente (B, ou o único que existe) */
          var dentro = pc.B ? 1 : -1;   /* +1 = lado maior (baixo/direita) */
          var hx, hy, fx, fy, ex, ey, sweep;
          if (horiz) { hx = ab.s; hy = pc.c + dentro * bLado * (dentro > 0 ? 1 : 0) - (dentro < 0 ? aLado : 0); hy = pc.c; fx = hx; fy = hy + dentro * w; ex = hx + w; ey = hy; sweep = dentro > 0 ? 0 : 1; }
          else { hx = pc.c; hy = ab.s; fx = hx + dentro * w; fy = hy; ex = hx; ey = hy + w; sweep = dentro > 0 ? 1 : 0; }
          s += '<line x1="' + hx + '" y1="' + hy + '" x2="' + fx + '" y2="' + fy + '" stroke="#1B2229" stroke-width="' + (1.6 * esc) + '"/>';
          s += '<path d="M' + fx + ' ' + fy + ' A' + w + ' ' + w + ' 0 0 ' + sweep + ' ' + ex + ' ' + ey + '" fill="none" stroke="#6B7885" stroke-width="' + (0.9 * esc) + '" stroke-dasharray="' + (4 * esc) + ' ' + (3 * esc) + '"/>';
          if (ab.tipo === 'entrada' && !ab.secundaria) s += '<circle cx="' + (horiz ? ab.s + w / 2 : pc.c) + '" cy="' + (horiz ? pc.c : ab.s + w / 2) + '" r="' + (3.2 * esc) + '" fill="#22B8D6"/>';
        }
        s += '</g>';
      });
    });
    return s;
  }

  /* ---------- móveis: figurinhas de cima, giradas no lugar ---------- */
  function moveisSvg(esc){
    if (!window.MOVEIS || !M.proj.moveis) return '';
    var s = '', lista = M.proj.moveis.filter(function (m) { return (m.pav || 0) === M.pav; }).sort(function (a, b) { return MOVEIS.dims(a).alt - MOVEIS.dims(b).alt; });   /* tapete embaixo de tudo */
    lista.forEach(function (mv) {
      var m = MOVEIS.dims(mv), on = (selTipo === 'mov' && sel === mv.id) || emMulti('mov', mv.id);
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
  function selecionarMovel(id){ sel = id; selTipo = id ? 'mov' : 'amb'; multi = []; render(); UI.inspector(); UI.radial(id ? movAtual() : null); }
  function cobAtual(){ return selTipo === 'cob' && sel ? M.coberturaDe(sel) : null; }
  function selecionarCob(id){ sel = id; selTipo = id ? 'cob' : 'amb'; multi = []; render(); UI.inspector(); UI.radial(null); }
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
  function selecionar(id){ sel = id; selTipo = 'amb'; multi = []; render(); UI.inspector(); UI.radial(null); }

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

    /* porta/janela na planta → mesmo popover do 3D (trocar, excluir, medidas) */
    var alvoAb = e.target.closest ? e.target.closest('.ab') : null;
    if (alvoAb && tool === 'sel' && !UI.espaco && e.button === 0) { UI.popFachada(alvoAb.getAttribute('data-fk'), e.clientX, e.clientY, alvoAb.getAttribute('data-id') || null); return; }
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
    if (gm && bloq('moveis')) gm = null;   /* camada bloqueada: o clique passa para o ambiente */
    /* ⇧ clique: entra/sai do grupo (ambiente ou móvel) */
    var gAmb0 = e.target.closest ? e.target.closest('.amb') : null;
    if (e.shiftKey && tool === 'sel' && (gm || gAmb0)) { toggleMulti(gm ? 'mov' : 'amb', (gm || gAmb0).getAttribute('data-id')); return; }
    /* clicou num item do grupo → arrasta o grupo inteiro */
    if (multi.length > 1 && tool === 'sel' && !UI.espaco && ((gm && emMulti('mov', gm.getAttribute('data-id'))) || (gAmb0 && emMulti('amb', gAmb0.getAttribute('data-id'))))) {
      drag = {modo:'grupo', g:itensGrupo(), p0:p, mudou:false}; UI.radial(null); svg.setPointerCapture(e.pointerId); return;
    }
    if (multi.length && !e.shiftKey) { multi = []; render(); }
    if (gm && tool === 'sel' && !UI.espaco) {
      var mid = gm.getAttribute('data-id'), mv = M.movelDe(mid);
      if (mv) {
        drag = {modo:'movmove', id:mid, ini:{x:mv.x, y:mv.y}, off:{x:p.x - mv.x, y:p.y - mv.y}, mudou:false};
        selecionarMovel(mid); UI.radial(null);
        svg.setPointerCapture(e.pointerId); return;
      }
    }

    /* alça → redimensionar (ambiente ou cobertura independente) */
    var alca = e.target.closest ? e.target.closest('.alca') : null;
    if (alca && (atual() || cobAtual())) {
      var a0 = atual() || cobAtual();
      drag = {modo:'resize', cob:!atual(), h:alca.getAttribute('data-h'), id:a0.id, ini:{x:a0.x, y:a0.y, w:a0.w, h:a0.h}, p0:p, mudou:false};
      svg.setPointerCapture(e.pointerId); return;
    }
    /* cobertura independente → arrastar */
    var gc = e.target.closest ? e.target.closest('.cob') : null;
    if (gc && tool === 'sel' && !UI.espaco) {
      var cid = gc.getAttribute('data-id'), c0 = M.coberturaDe(cid);
      selecionarCob(cid);
      if (gc.classList.contains('bloq')) { UI.toast('Camada bloqueada — desbloqueie na aba Camadas para mover.'); return; }
      if (c0) { drag = {modo:'cobmove', id:cid, ini:{x:c0.x, y:c0.y}, off:{x:p.x - c0.x, y:p.y - c0.y}, mudou:false}; svg.setPointerCapture(e.pointerId); return; }
    }

    /* ferramenta mão / espaço / botão do meio → pan */
    if (tool === 'pan' || e.button === 1 || UI.espaco) {
      drag = {modo:'pan', p0:p, v0:{x:view.x, y:view.y}}; svg.setPointerCapture(e.pointerId); return;
    }

    /* ferramenta ambiente / cobertura → desenhar retângulo novo */
    if (tool === 'room' || tool === 'cob') {
      drag = {modo:'novo', cob:tool === 'cob', p0:{x:snap(p.x), y:snap(p.y)}, novo:null};
      svg.setPointerCapture(e.pointerId); return;
    }

    /* ambiente → arrastar */
    var g = e.target.closest ? e.target.closest('.amb') : null;
    if (g) {
      var id = g.getAttribute('data-id');
      var a = M.proj.ambientes.filter(function (x) { return x.id === id; })[0];
      selecionar(id);
      if (g.classList.contains('bloq')) { UI.toast('Camada bloqueada — desbloqueie na aba Camadas para mover.'); return; }
      /* o ambiente leva os móveis que estão dentro dele */
      drag = {modo:'move', id:id, ini:{x:a.x, y:a.y}, off:{x:p.x - a.x, y:p.y - a.y}, mudou:false, movs:M.moveisDe(id).map(function (mv) { return {m:mv, x0:mv.x, y0:mv.y}; })};
      svg.setPointerCapture(e.pointerId);
    } else {
      selecionar(null);
      /* vazio + ferramenta seleção: laço — tudo que ficar dentro vira um grupo */
      if (tool === 'sel' && !UI.espaco) { drag = {modo:'laco', p0:p, p1:p, mudou:false}; svg.setPointerCapture(e.pointerId); }
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
    if (drag.modo === 'laco') { drag.p1 = p; drag.mudou = Math.abs(p.x - drag.p0.x) > 10 || Math.abs(p.y - drag.p0.y) > 10; render(); return; }
    if (drag.modo === 'grupo') {
      var gdx = snap(p.x - drag.p0.x), gdy = snap(p.y - drag.p0.y);
      if (UI.shift) { if (Math.abs(gdx) > Math.abs(gdy)) gdy = 0; else gdx = 0; }
      moverGrupo(drag.g, gdx, gdy); drag.mudou = drag.mudou || gdx !== 0 || gdy !== 0;
      UI.hud((drag.g.ambs.length + drag.g.movs.length) + ' itens  ' + (gdx >= 0 ? '+' : '') + M.fmtMs(gdx) + ' ; ' + (gdy >= 0 ? '+' : '') + M.fmtMs(gdy) + ' m');
      render(); return;
    }
    if (drag.modo === 'novo') {
      var x = Math.min(drag.p0.x, snap(p.x)), y = Math.min(drag.p0.y, snap(p.y));
      drag.novo = {x:x, y:y, w:Math.abs(snap(p.x) - drag.p0.x), h:Math.abs(snap(p.y) - drag.p0.y)};
      UI.hud(M.fmtMs(drag.novo.w) + ' × ' + M.fmtMs(drag.novo.h) + ' m');
      render(); return;
    }

    if (drag.modo === 'cobmove') {
      var c2 = M.coberturaDe(drag.id); if (!c2) return;
      var cx2 = snap(p.x - drag.off.x), cy2 = snap(p.y - drag.off.y);
      if (UI.shift) { if (Math.abs(cx2 - drag.ini.x) > Math.abs(cy2 - drag.ini.y)) cy2 = drag.ini.y; else cx2 = drag.ini.x; }
      c2.x = cx2; c2.y = cy2; drag.mudou = true;
      UI.hud(c2.nome + '  ' + M.fmtMs(c2.w) + ' × ' + M.fmtMs(c2.h) + ' m');
      render(); UI.inspector(); return;
    }
    if (drag.modo === 'resize' && drag.cob) {
      var c3 = M.coberturaDe(drag.id); if (!c3) return;
      var ic = drag.ini, hc = drag.h, cx1 = ic.x, cy1 = ic.y, cx3 = ic.x + ic.w, cy3 = ic.y + ic.h;
      if (hc.indexOf('w') >= 0) cx1 = snap(p.x);
      if (hc.indexOf('e') >= 0) cx3 = snap(p.x);
      if (hc.indexOf('n') >= 0) cy1 = snap(p.y);
      if (hc.indexOf('s') >= 0) cy3 = snap(p.y);
      c3.x = Math.min(cx1, cx3); c3.y = Math.min(cy1, cy3);
      c3.w = Math.max(100, Math.abs(cx3 - cx1)); c3.h = Math.max(100, Math.abs(cy3 - cy1));
      drag.mudou = true;
      UI.hud(M.fmtMs(c3.w) + ' × ' + M.fmtMs(c3.h) + ' m   ' + M.fmtM2(M.areaCob(c3) * 10000));
      render(); UI.inspector(); return;
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
      (drag.movs || []).forEach(function (o) { o.m.x = o.x0 + (nx - drag.ini.x); o.m.y = o.y0 + (ny - drag.ini.y); });   /* móveis vão junto */
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
      (d.movs || []).forEach(function (o) { o.m.x = o.x0; o.m.y = o.y0; });
    }
    if (d.modo === 'grupo') moverGrupo(d.g, 0, 0);
    if (d.modo === 'cobmove' || (d.modo === 'resize' && d.cob)) { var cc = M.coberturaDe(d.id); if (cc) { cc.x = d.ini.x; cc.y = d.ini.y; if (d.ini.w) { cc.w = d.ini.w; cc.h = d.ini.h; } } }
    if (d.modo === 'movmove') { var mv = M.movelDe(d.id); if (mv) { mv.x = d.ini.x; mv.y = d.ini.y; } }
    if (d.modo === 'movrot') { var mv2 = M.movelDe(d.id); if (mv2) mv2.rot = d.rot0; }
    render();
  }

  function onUp(e){
    if (e && e.pointerId !== undefined) delete ptrs[e.pointerId];
    if (pinch) { if (Object.keys(ptrs).length < 2) pinch = null; return; }
    if (!drag) return;
    var d = drag; drag = null; guias = []; UI.hud(null);
    if (d.modo === 'laco') {
      if (!d.mudou) { render(); return; }
      var lx1 = Math.min(d.p0.x, d.p1.x), ly1 = Math.min(d.p0.y, d.p1.y), lx2 = Math.max(d.p0.x, d.p1.x), ly2 = Math.max(d.p0.y, d.p1.y), lista = [];
      function dentro(x, y){ return x >= lx1 && x <= lx2 && y >= ly1 && y <= ly2; }
      if (vis('ambientes') || vis('piscina')) M.ambsPav(M.pav).forEach(function (a) { if (!vis(a.tipo === 'agua' ? 'piscina' : 'ambientes') || bloq(a.tipo === 'agua' ? 'piscina' : 'ambientes')) return; if (dentro(a.x + a.w / 2, a.y + a.h / 2)) lista.push({t:'amb', id:a.id}); });
      if (vis('moveis') && !bloq('moveis')) (M.proj.moveis || []).forEach(function (mv) { if ((mv.pav || 0) !== M.pav) return; var amb = M.ambienteDe(mv); if (amb && lista.some(function (m) { return m.t === 'amb' && m.id === amb.id; })) return; /* já vai com o ambiente */ if (dentro(mv.x, mv.y)) lista.push({t:'mov', id:mv.id}); });
      if (lista.length === 1) { if (lista[0].t === 'mov') selecionarMovel(lista[0].id); else selecionar(lista[0].id); return; }
      setMulti(lista);
      if (lista.length) UI.toast(lista.length + ' itens selecionados — arraste qualquer um para mover todos juntos. Del exclui, Ctrl+D duplica.');
      return;
    }
    if (d.modo === 'grupo') {
      if (d.mudou) { M.commit('Mover ' + (d.g.ambs.length + d.g.movs.length) + ' itens'); UI.refreshTop(); }
      render(); UI.inspector(); return;
    }
    if (!d.mudou && d.modo !== 'novo' && d.modo !== 'pan') UI.selTap();
    if (d.modo === 'novo' && d.cob && d.novo && d.novo.w >= 100 && d.novo.h >= 100) {
      var nc = M.addCobertura({x:d.novo.x, y:d.novo.y, w:d.novo.w, h:d.novo.h, pav:M.pav});
      M.commit('Criar cobertura');
      selecionarCob(nc.id); UI.setTool('sel');
      UI.toast('Cobertura independente criada — pilares próprios e telhado à parte. Ajuste tipo, telha e pilares no painel.');
    } else if (d.modo === 'novo' && d.novo && d.novo.w >= 90 && d.novo.h >= 90) {
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
    } else if (d.mudou && (d.modo === 'cobmove' || (d.modo === 'resize' && d.cob))) {
      M.commit(d.modo === 'cobmove' ? 'Mover cobertura' : 'Redimensionar cobertura');
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
    cobAtual:cobAtual, selecionarCob:selecionarCob,
    movAtual:movAtual, selecionarMovel:selecionarMovel, telaDe:telaDe, PAREDE:PAREDE,
    setTool:function (t) { tool = t; }, get tool(){ return tool; },
    toggleGrid:function () { M.setCamada('grade', 'vis', !vis('grade')); M.salvar(); render(); return vis('grade'); },
    toggleCotas:function () { M.setCamada('cotas', 'vis', !vis('cotas')); M.salvar(); render(); return vis('cotas'); },
    vis:vis, bloq:bloq,
    get multi(){ return multi; }, setMulti:setMulti, toggleMulti:toggleMulti, itensGrupo:itensGrupo, moverGrupo:moverGrupo, bboxGrupo:bboxGrupo,
    onUp:onUp, toModel:toModel,
    get svgEl(){ return svg; }
  };
})();
document.addEventListener('pointerup', function (e) { PLAN.onUp(e); });
document.addEventListener('pointercancel', function (e) { PLAN.onUp(e); });
