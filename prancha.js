/* =========================================================================
   PRANCHA — folha técnica A3 (estilo LayOut do SketchUp), tirada do MESMO desenho.

   Folha 1 · ARQUITETÔNICA: planta baixa de cada pavimento numa escala técnica real
   (1:50 · 1:75 · 1:100 · 1:125 · 1:150 · 1:200 — a maior que cabe), perspectiva 3D,
   quadro de áreas e carimbo.
   Folha 2 · MARCENARIA: cada móvel sob medida com vista frontal e lateral cotadas
   (1:10 · 1:15 · 1:20 · 1:25), acabamentos e lista de corte.

   Nada é digitado na folha a não ser o carimbo (cliente, endereço, responsável, registro),
   que mora em proj.prancha. Áreas, medidas e peças são sempre calculadas.
   Imprimir = window.print() com @page A3 paisagem → "Salvar como PDF".
   ========================================================================= */
var PRANCHA = (function () {
  var PX_MM = 3.7795;                          /* 96 dpi */
  var ESC_PLANTA = [50, 75, 100, 125, 150, 200, 250];
  var ESC_MOVEL = [10, 15, 20, 25, 30];
  var st = {folha:'arquitetonica', mov:null, foto:null, fotoPend:false};

  function esc(s){ return String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function coberto(a){ return a.tipo !== 'externo' && a.tipo !== 'agua'; }
  function hoje(){ var d = new Date(); return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear(); }
  function dados(){ var p = M.proj; p.prancha = p.prancha || {}; return p.prancha; }
  function escolheEscala(lista, cmW, cmH, mmW, mmH){   /* a MAIOR escala (menor denominador) que cabe */
    for (var i = 0; i < lista.length; i++) if (cmW * 10 / lista[i] <= mmW && cmH * 10 / lista[i] <= mmH) return lista[i];
    return lista[lista.length - 1];
  }
  function marcenarias(){
    if (!window.MOVEIS || !MOVEIS.eMarcenaria) return [];
    var L = M.proj.moveis.filter(function (mv) { return MOVEIS.eMarcenaria(mv); });
    L.sort(function (a, b) { return (b.id === st.mov) - (a.id === st.mov) || (!!b.marc) - (!!a.marc); });
    return L;
  }

  /* ---------------- planta baixa técnica de um pavimento (SVG em cm) ---------------- */
  function bboxPav(pav){
    var A = M.proj.ambientes.filter(function (a) { return (a.pav || 0) === pav; });
    if (!A.length) return null;
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    A.forEach(function (a) { x0 = Math.min(x0, a.x); y0 = Math.min(y0, a.y); x1 = Math.max(x1, a.x + a.w); y1 = Math.max(y1, a.y + a.h); });
    return {x0:x0, y0:y0, x1:x1, y1:y1, w:x1 - x0, h:y1 - y0, A:A};
  }
  function plantaSvg(pav, escala, mm){
    var b = bboxPav(pav); if (!b) return '';
    var mg = 130, vx = b.x0 - mg, vy = b.y0 - mg, vw = b.w + mg * 2, vh = b.h + mg * 2;
    var k = vw / (vw * 10 / escala * PX_MM);            /* cm por px impresso: traço/texto em "px de papel" */
    var s = '<svg class="pr-planta" viewBox="' + vx + ' ' + vy + ' ' + vw + ' ' + vh + '" width="' + (vw * 10 / escala).toFixed(2) + 'mm" height="' + (vh * 10 / escala).toFixed(2) + 'mm" xmlns="http://www.w3.org/2000/svg">';
    /* pisos */
    b.A.forEach(function (a) {
      var fill = a.tipo === 'agua' ? '#CFE9F2' : a.tipo === 'externo' ? '#EEF2EA' : a.tipo === 'molhado' ? '#F1F4F6' : '#FFFFFF';
      s += '<rect x="' + a.x + '" y="' + a.y + '" width="' + a.w + '" height="' + a.h + '" fill="' + fill + '"/>';
      if (a.tipo === 'molhado') {   /* hachura de área molhada */
        for (var hx = a.x + 30; hx < a.x + a.w; hx += 30) s += '<line x1="' + hx + '" y1="' + a.y + '" x2="' + hx + '" y2="' + (a.y + a.h) + '" stroke="#DCE3E8" stroke-width="' + (.5 * k) + '"/>';
      }
    });
    /* móveis (figurinha de cima, traço fino) */
    if (window.MOVEIS) M.proj.moveis.filter(function (mv) { return (mv.pav || 0) === pav; }).forEach(function (mv) {
      var sym = MOVEIS.symDe(mv).replace(/stroke-width="([\d.]+)"/g, 'stroke-width="' + (.5 * k) + '"').replace(/fill="#[0-9A-Fa-f]{6}"/g, 'fill="#FFFFFF"');
      s += '<g transform="translate(' + mv.x + ' ' + mv.y + ') rotate(' + (mv.rot || 0) + ') scale(' + (mv.esp ? -1 : 1) + ' 1)" opacity=".75">' + sym + '</g>';
    });
    /* paredes: contorno de cada ambiente coberto em traço grosso (alvenaria) */
    b.A.forEach(function (a) {
      if (!coberto(a)) { s += '<rect x="' + a.x + '" y="' + a.y + '" width="' + a.w + '" height="' + a.h + '" fill="none" stroke="#5E6A74" stroke-width="' + (.6 * k) + '" stroke-dasharray="' + (6 * k) + ' ' + (3 * k) + '"/>'; return; }
      s += '<rect x="' + (a.x + 7.5) + '" y="' + (a.y + 7.5) + '" width="' + Math.max(1, a.w - 15) + '" height="' + Math.max(1, a.h - 15) + '" fill="none" stroke="#14181C" stroke-width="15"/>';
    });
    /* portas e janelas: as mesmas da planta do editor */
    if (window.PLAN && PLAN.aberturasSvg) s += PLAN.aberturasSvg(k, pav).replace(/ style="cursor:pointer"/g, '');
    /* nome, área e medidas internas de cada ambiente */
    b.A.forEach(function (a) {
      var fs = Math.min(3.0 * k, a.w / 7, a.h / 4);
      if (fs < 1.2 * k) return;
      var cx = a.x + a.w / 2, cy = a.y + a.h / 2;
      s += '<text x="' + cx + '" y="' + (cy - fs * .25) + '" text-anchor="middle" font-size="' + fs + '" font-family="Arial" font-weight="700" fill="#14181C">' + esc(a.nome.toUpperCase()) + '</text>';
      s += '<text x="' + cx + '" y="' + (cy + fs * 1.0) + '" text-anchor="middle" font-size="' + fs * .8 + '" font-family="Arial" fill="#3A444D">A = ' + M.fmtM2(M.areaOf(a)) + '</text>';
      s += '<text x="' + cx + '" y="' + (cy + fs * 2.0) + '" text-anchor="middle" font-size="' + fs * .7 + '" font-family="Arial" fill="#6B7885">' + M.fmtMs(a.w) + ' × ' + M.fmtMs(a.h) + '</text>';
    });
    /* cotas: corrente de cada ambiente encostado no topo e na esquerda + total */
    s += cadeia(b, 'h', k) + cadeia(b, 'v', k);
    return s + '</svg>';
  }
  function cadeia(b, o, k){
    var cor = '#14181C', fs = 2.3 * k, s = '', pts = {};
    var borda = o === 'h' ? b.A.filter(function (a) { return a.y <= b.y0 + 1; }) : b.A.filter(function (a) { return a.x <= b.x0 + 1; });
    borda.forEach(function (a) { if (o === 'h') { pts[a.x] = 1; pts[a.x + a.w] = 1; } else { pts[a.y] = 1; pts[a.y + a.h] = 1; } });
    var P = Object.keys(pts).map(Number).sort(function (x, y) { return x - y; });
    function linha(a1, a2, off, txt){
      var r = '';
      if (o === 'h') {
        var y = b.y0 - off;
        r += '<line x1="' + a1 + '" y1="' + y + '" x2="' + a2 + '" y2="' + y + '" stroke="' + cor + '" stroke-width="' + (.35 * k) + '"/>';
        [a1, a2].forEach(function (x) { r += '<line x1="' + (x - 1.4 * k) + '" y1="' + (y + 1.4 * k) + '" x2="' + (x + 1.4 * k) + '" y2="' + (y - 1.4 * k) + '" stroke="' + cor + '" stroke-width="' + (.6 * k) + '"/><line x1="' + x + '" y1="' + (y - 1.8 * k) + '" x2="' + x + '" y2="' + (b.y0 - 4) + '" stroke="' + cor + '" stroke-width="' + (.2 * k) + '"/>'; });
        r += '<text x="' + (a1 + a2) / 2 + '" y="' + (y - .9 * k) + '" text-anchor="middle" font-size="' + fs + '" font-family="Arial" fill="' + cor + '">' + txt + '</text>';
      } else {
        var x2 = b.x0 - off, my = (a1 + a2) / 2;
        r += '<line x1="' + x2 + '" y1="' + a1 + '" x2="' + x2 + '" y2="' + a2 + '" stroke="' + cor + '" stroke-width="' + (.35 * k) + '"/>';
        [a1, a2].forEach(function (yy) { r += '<line x1="' + (x2 - 1.4 * k) + '" y1="' + (yy + 1.4 * k) + '" x2="' + (x2 + 1.4 * k) + '" y2="' + (yy - 1.4 * k) + '" stroke="' + cor + '" stroke-width="' + (.6 * k) + '"/><line x1="' + (x2 - 1.8 * k) + '" y1="' + yy + '" x2="' + (b.x0 - 4) + '" y2="' + yy + '" stroke="' + cor + '" stroke-width="' + (.2 * k) + '"/>'; });
        r += '<text x="' + (x2 - .9 * k) + '" y="' + my + '" text-anchor="middle" font-size="' + fs + '" font-family="Arial" fill="' + cor + '" transform="rotate(-90 ' + (x2 - .9 * k) + ' ' + my + ')">' + txt + '</text>';
      }
      return r;
    }
    for (var i = 0; i + 1 < P.length; i++) if (P[i + 1] - P[i] >= 20) s += linha(P[i], P[i + 1], 45, M.fmtMs(P[i + 1] - P[i]));
    s += linha(o === 'h' ? b.x0 : b.y0, o === 'h' ? b.x1 : b.y1, 95, M.fmtMs(o === 'h' ? b.w : b.h));
    return s;
  }

  /* ---------------- carimbo ---------------- */
  function carimbo(titulo, folha, total, escala){
    var d = dados(), p = M.proj;
    function campo(k, rot, ph){ return '<div class="cb-c"><label>' + rot + '</label><input data-cb="' + k + '" value="' + esc(d[k] || '') + '" placeholder="' + ph + '"></div>'; }
    return '<div class="pr-carimbo">' +
      '<div class="cb-marca"><b>SUA OBRA 3D</b><span>do projeto à realidade</span></div>' +
      '<div class="cb-c cb-proj"><label>PROJETO</label><strong>' + esc(p.nome || 'Projeto') + '</strong></div>' +
      '<div class="cb-c cb-tit"><label>CONTEÚDO</label><strong>' + esc(titulo) + '</strong></div>' +
      campo('cliente', 'PROPRIETÁRIO / CLIENTE', 'nome do cliente') +
      campo('endereco', 'ENDEREÇO DA OBRA', 'rua, nº, bairro, cidade') +
      '<div class="cb-row">' + campo('responsavel', 'RESPONSÁVEL TÉCNICO', 'nome') + campo('registro', 'CAU / CREA', 'nº') + '</div>' +
      '<div class="cb-row">' +
        '<div class="cb-c"><label>ÁREA CONSTRUÍDA</label><strong>' + M.fmtM2(M.areaConstruida()) + '</strong></div>' +
        '<div class="cb-c"><label>TERRENO</label><strong>' + M.fmtM2(M.areaTerreno()) + '</strong></div>' +
      '</div>' +
      '<div class="cb-row cb-fim">' +
        '<div class="cb-c"><label>ESCALA</label><strong>' + esc(escala) + '</strong></div>' +
        '<div class="cb-c"><label>DATA</label><strong>' + hoje() + '</strong></div>' +
        '<div class="cb-c cb-folha"><label>FOLHA</label><strong>' + String(folha).padStart(2, '0') + '/' + String(total).padStart(2, '0') + '</strong></div>' +
      '</div></div>';
  }

  /* ---------------- folha 1: arquitetônica ---------------- */
  /* área útil (mm) da folha A3 paisagem: 420×297, margens 25 (esq.) e 10; coluna da direita 112 mm */
  var UTIL_W = 420 - 25 - 10 - 112 - 8, UTIL_H = 297 - 20 - 14;
  function folhaArq(nF){
    var n = M.nPavs(), pavs = [];
    for (var i = 0; i < n; i++) if (bboxPav(i)) pavs.push(i);
    var mg = 260, wSoma = 0, hMax = 0;
    pavs.forEach(function (i) { var b = bboxPav(i); wSoma += b.w + mg; hMax = Math.max(hMax, b.h + mg); });
    var gap = (pavs.length - 1) * 8, escala = pavs.length ? escolheEscala(ESC_PLANTA, wSoma, hMax, UTIL_W - gap, UTIL_H - 10) : 100;
    var h = '<div class="pr-folha" data-folha="arquitetonica"><div class="pr-moldura">';
    h += '<div class="pr-area"><div class="pr-plantas">';
    if (!pavs.length) h += '<div class="pr-vazio">Desenhe os ambientes na planta para gerar a prancha.</div>';
    pavs.forEach(function (i) {
      h += '<figure class="pr-fig">' + plantaSvg(i, escala) + '<figcaption><b>PLANTA BAIXA — ' + esc(M.nomePav(i).toUpperCase()) + '</b><span>ESC. 1:' + escala + '</span></figcaption></figure>';
    });
    h += '</div><div class="pr-norte" title="Norte">' + norte() + '</div></div>';
    h += '<aside class="pr-lado">';
    h += '<figure class="pr-3d">' + (st.foto ? '<img src="' + st.foto + '" alt="Perspectiva">' : (window.VIEWS ? VIEWS.iso() : '')) + '<figcaption><b>PERSPECTIVA</b><span>sem escala</span></figcaption></figure>';
    h += quadroAreas();
    h += carimbo('Planta baixa, perspectiva e quadro de áreas', 1, nF, '1:' + escala);
    h += '</aside></div></div>';
    return h;
  }
  function norte(){
    var ang = (M.proj.sol && M.proj.sol.norte) || 0;
    return '<svg viewBox="-20 -20 40 40" width="14mm" height="14mm"><g transform="rotate(' + ang + ')"><circle r="14" fill="none" stroke="#14181C" stroke-width="1"/><path d="M0 -17 L6 8 L0 4 L-6 8 Z" fill="#14181C"/></g><text y="19" text-anchor="middle" font-size="7" font-family="Arial" font-weight="700">N</text></svg>';
  }
  function quadroAreas(){
    var h = '<div class="pr-quadro"><div class="pq-t">QUADRO DE ÁREAS</div><table>';
    for (var i = 0; i < M.nPavs(); i++) {
      var A = M.proj.ambientes.filter(function (a) { return (a.pav || 0) === i; });
      if (!A.length) continue;
      if (M.nPavs() > 1) h += '<tr class="pq-pav"><td colspan="2">' + esc(M.nomePav(i).toUpperCase()) + '</td></tr>';
      A.forEach(function (a) { h += '<tr><td>' + esc(a.nome) + '</td><td class="n">' + M.fmtM2(M.areaOf(a)) + '</td></tr>'; });
    }
    h += '<tr class="pq-tot"><td>Área construída</td><td class="n">' + M.fmtM2(M.areaConstruida()) + '</td></tr>';
    h += '<tr class="pq-tot"><td>Taxa de ocupação</td><td class="n">' + M.fmtPct(M.ocupacao()) + '</td></tr>';
    return h + '</table></div>';
  }

  /* ---------------- folha 2: marcenaria ---------------- */
  function folhaMarc(nF){
    var L = marcenarias().slice(0, 3), h = '<div class="pr-folha" data-folha="marcenaria"><div class="pr-moldura"><div class="pr-area pr-marc">';
    if (!L.length) h += '<div class="pr-vazio">Nenhum móvel de marcenaria no projeto (armário, aéreo, bancada, pia, gabinete, cômoda, rack).<br>Adicione um pelo catálogo e configure portas e gavetas no painel do móvel.</div>';
    var hLin = (UTIL_H - 6) / Math.max(1, L.length), escala = 10;
    L.forEach(function (mv) { var F = MOVEIS.frentes(mv); escala = Math.max(escala, escolheEscala(ESC_MOVEL, F.w + F.d + 40, F.alt + 25, UTIL_W - 120, hLin - 16)); });
    var temUI = window.UI && UI.vistaFrontalMovel;
    L.forEach(function (mv, i) {
      var F = MOVEIS.frentes(mv), d = MOVEIS.def(mv.k), amb = M.ambienteDe ? M.ambienteDe(mv) : null, f = 10 / escala * PX_MM;   /* px de papel por cm */
      var fw = F.w * f + 2 * 34 * 1, fh = F.alt * f + 2 * 34, lw = F.d * f + 60, lh = F.alt * f + 60;
      h += '<div class="pm-item"><div class="pm-vistas">' +
        '<figure>' + (temUI ? mm(UI.vistaFrontalMovel(mv, fw, fh, {cotas:true})) : '') + '<figcaption>VISTA FRONTAL · ESC. 1:' + escala + '</figcaption></figure>' +
        '<figure>' + (temUI ? mm(UI.vistaLateralMovel(mv, lw, lh)) : '') + '<figcaption>LATERAL</figcaption></figure></div>';
      h += '<div class="pm-info"><div class="pm-t">' + String(i + 1).padStart(2, '0') + ' · ' + esc((d && d.nome) || 'Móvel').toUpperCase() + (amb ? ' <span>' + esc(amb.nome) + '</span>' : '') + '</div>' +
        '<div class="pm-spec">' + M.fmtMs(F.w) + ' × ' + M.fmtMs(F.d) + ' × ' + M.fmtMs(F.alt) + ' m · ' + F.c.portas + ' porta(s) · ' + F.c.gavetas + ' gaveta(s) · puxador ' + esc((MOVEIS.PUXADORES.filter(function (p) { return p.k === F.c.puxador; })[0] || {rot:''}).rot.toLowerCase()) + '</div>' +
        '<div class="pm-acab"><i style="background:' + F.cor + '"></i>Frentes: ' + esc(MOVEIS.acabamento(F.c.frente).rot) + ' <i style="background:' + F.corCorpo + '"></i>Caixa: ' + esc(MOVEIS.acabamento(F.c.corpo).rot) + '</div>' +
        '<table class="pm-pecas"><tr><th>Peça (MDF 18 mm)</th><th>Qtd</th><th>Medida (cm)</th></tr>' +
        MOVEIS.pecas(mv).map(function (p) { return '<tr><td>' + esc(p.nome) + '</td><td class="n">' + p.qtd + '</td><td class="n">' + num(p.a) + ' × ' + num(p.b) + '</td></tr>'; }).join('') +
        '</table></div></div>';
    });
    h += '</div><aside class="pr-lado">';
    h += '<div class="pr-quadro"><div class="pq-t">NOTAS</div><ol class="pr-notas"><li>Medidas em metros, exceto a lista de corte (cm).</li><li>Conferir as medidas no local antes da produção.</li><li>Na vista frontal, o “V” tracejado aponta para o lado das dobradiças.</li><li>Corrediças telescópicas nas gavetas; dobradiças com amortecedor.</li></ol></div>';
    if (marcenarias().length > 3) h += '<div class="pr-quadro"><div class="pq-t">OUTROS MÓVEIS</div><p class="pr-mini">' + (marcenarias().length - 3) + ' móvel(is) de marcenaria não couberam nesta folha — selecione-o no painel e clique em “Ver vistas na prancha”.</p></div>';
    h += carimbo('Marcenaria — vistas e lista de corte', 2, nF, '1:' + escala);
    h += '</aside></div></div>';
    return h;
  }
  function num(v){ return String(v).replace('.', ','); }
  function mm(svg){   /* largura/altura em px de tela → mm de papel (o viewBox fica igual) */
    return svg.replace(/ width="([\d.]+)" height="([\d.]+)"/, function (_, w, hh) { return ' width="' + (w / PX_MM).toFixed(2) + 'mm" height="' + (hh / PX_MM).toFixed(2) + 'mm"'; });
  }

  /* ---------------- view ---------------- */
  function html(){
    var nF = 2;
    var h = '<div class="pr-bar"><h2>Prancha</h2><div class="seg" id="pr-folhas">' +
      '<button data-folha="arquitetonica"' + (st.folha === 'arquitetonica' ? ' class="on"' : '') + '>01 · Arquitetônica</button>' +
      '<button data-folha="marcenaria"' + (st.folha === 'marcenaria' ? ' class="on"' : '') + '>02 · Marcenaria</button>' +
      '<button data-folha="todas"' + (st.folha === 'todas' ? ' class="on"' : '') + '>Todas</button></div>' +
      '<span class="grow"></span>' +
      '<button class="btn sm" id="pr-foto" title="Tira uma foto nova do 3D para a perspectiva">↻ Foto do 3D</button>' +
      '<button class="btn solid sm" id="pr-print" title="Abre a impressão em A3 paisagem — escolha “Salvar como PDF”">Imprimir / PDF (A3)</button></div>';
    h += '<p class="vsub">Folha A3 gerada do desenho: a planta sai em escala real, as áreas e as peças são calculadas. Só o carimbo é digitado.</p>';
    h += '<div class="pr-palco" id="pr-palco">';
    if (st.folha !== 'marcenaria') h += folhaArq(nF);
    if (st.folha !== 'arquitetonica') h += folhaMarc(nF);
    return h + '</div>';
  }
  function ajustar(pad){
    var palco = pad.querySelector('#pr-palco'); if (!palco) return;
    var W = palco.clientWidth - 8, z = Math.min(1, W / (420 * PX_MM));
    palco.querySelectorAll('.pr-folha').forEach(function (f) { f.style.zoom = z; });
  }
  function fotografar(cb){
    if (!window.TRES || st.fotoPend) return;
    st.fotoPend = true;
    var box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:-4000px;top:0;width:1200px;height:820px;';
    document.body.appendChild(box);
    var inst = null;
    try { inst = TRES.montar(box, {modo:'orbit', editar:false, arrastar:false, cliqueVai:false}); } catch (e) { inst = null; }
    if (!inst) { box.remove(); st.fotoPend = false; return; }
    setTimeout(function () {
      try { st.foto = inst.foto(); } catch (e) {}
      inst.desmontar(); box.remove(); st.fotoPend = false;
      if (cb) cb();
    }, 900);
  }
  function ligar(pad, reabrir){
    pad.querySelectorAll('#pr-folhas button').forEach(function (b) { b.onclick = function () { st.folha = b.getAttribute('data-folha'); reabrir(); }; });
    pad.querySelector('#pr-print').onclick = function () { document.body.classList.add('imprimindo-prancha'); setTimeout(function () { window.print(); }, 60); };
    pad.querySelector('#pr-foto').onclick = function () { fotografar(reabrir); };
    pad.querySelectorAll('[data-cb]').forEach(function (inp) {
      inp.onchange = function () {
        var d = dados(), k = inp.getAttribute('data-cb'), v = inp.value.trim();
        if (v) d[k] = v; else delete d[k];
        M.commit('Carimbo da prancha');
        pad.querySelectorAll('[data-cb="' + k + '"]').forEach(function (o) { if (o !== inp) o.value = v; });
      };
    });
    ajustar(pad);
    if (!st.foto && st.folha !== 'marcenaria') {
      var rs = (M.proj.renders || []).filter(function (r) { return r && r.src; });
      if (rs.length) { st.foto = rs[rs.length - 1].src; reabrir(); }
      else fotografar(reabrir);
    }
  }
  window.addEventListener('afterprint', function () { document.body.classList.remove('imprimindo-prancha'); });
  window.addEventListener('resize', function () { var pad = document.querySelector('.view-pad'); if (pad && pad.querySelector('#pr-palco')) ajustar(pad); });

  return {html:html, ligar:ligar, ajustar:ajustar, plantaSvg:plantaSvg, escolheEscala:escolheEscala, ESC_PLANTA:ESC_PLANTA,
    get folha(){ return st.folha; }, set folha(v){ st.folha = v; },
    get mov(){ return st.mov; }, set mov(v){ st.mov = v; },
    get foto(){ return st.foto; }, set foto(v){ st.foto = v; }};
})();
