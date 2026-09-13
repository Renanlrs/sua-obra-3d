/* =========================================================================
   TRES — 3D de verdade, gerado da planta. Nada aqui guarda dado: paredes,
   portas, janelas, laje, estrutura e paradas do passeio saem de `M.proj`;
   os móveis saem de `M.proj.moveis` com as medidas do catálogo (MOVEIS).

   Está escrito como UMA função (TRES_ENGINE) de propósito: o exportador
   pega `TRES_ENGINE.toString()` e embute o motor num HTML autocontido que
   o cliente abre no celular.
   ========================================================================= */
function TRES_ENGINE(THREE, M){

  var CM = 0.01, ESP = 15, MEIA = ESP / 2;   /* centímetros → metros; espessura da parede */
  var reduzMov = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ======================= ANÁLISE (pura, sem WebGL) ======================= */
  function coberto(a){ return a.tipo !== 'externo' && a.tipo !== 'agua'; }
  function nomeTem(a, s){ return (a.nome || '').toLowerCase().indexOf(s) >= 0; }
  var PREF = {circulacao:5, social:4, garagem:2, servico:2, molhado:1, intimo:1};

  /* Paredes: cada aresta de ambiente vira segmento numa "linha" (h: y=c, v: x=c).
     A linha é quebrada em PEÇAS elementares nos pontos de todas as arestas;
     cada peça sabe quem está de cada lado → é interna (divisória) ou externa. */
  function analise(proj){
    var ambs = proj.ambientes.filter(coberto), H = proj.peDireito, t = proj.terreno;
    var linhas = {};
    function add(o, c, a, b, r){ var k = o + '|' + c; (linhas[k] = linhas[k] || {o:o, c:c, segs:[], pecas:[]}).segs.push({a:a, b:b, r:r}); }
    ambs.forEach(function (r) {
      add('h', r.y, r.x, r.x + r.w, r); add('h', r.y + r.h, r.x, r.x + r.w, r);
      add('v', r.x, r.y, r.y + r.h, r); add('v', r.x + r.w, r.y, r.y + r.h, r);
    });
    function dentro(x, y){
      for (var i = 0; i < ambs.length; i++) { var r = ambs[i]; if (x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) return r; }
      return null;
    }
    var pecas = [];
    Object.keys(linhas).forEach(function (k) {
      var L = linhas[k], bps = [];
      L.segs.forEach(function (s) { bps.push(s.a, s.b); });
      bps = bps.filter(function (v, i, arr) { return arr.indexOf(v) === i; }).sort(function (a, b) { return a - b; });
      for (var i = 0; i < bps.length - 1; i++) {
        var p = bps[i], q = bps[i + 1];
        if (q - p < 1) continue;
        if (!L.segs.some(function (s) { return s.a <= p && s.b >= q; })) continue;
        var m = (p + q) / 2;
        var A = L.o === 'h' ? dentro(m, L.c - 1) : dentro(L.c - 1, m);   /* lado menor (rua / esquerda) */
        var B = L.o === 'h' ? dentro(m, L.c + 1) : dentro(L.c + 1, m);
        var pc = {o:L.o, c:L.c, p:p, q:q, len:q - p, A:A, B:B, ext:!(A && B), ab:[]};
        pecas.push(pc); L.pecas.push(pc);
      }
    });

    /* estado de uma linha num ponto: há peça terminando / começando ali? */
    function estado(o, c, pos){
      var L = linhas[o + '|' + c]; if (!L) return {antes:false, depois:false};
      return {antes: L.pecas.some(function (x) { return x.q === pos; }), depois: L.pecas.some(function (x) { return x.p === pos; })};
    }
    /* ajuste das pontas: sem buraco no canto e sem volume duplicado (z-fight).
       H estende para dentro do V que termina ali; encurta quando o V atravessa.
       V encurta sempre que termina numa linha H (o H cobre a espessura). */
    function ajuste(pc, pos){
      var col = estado(pc.o, pc.c, pos), colContinua = col.antes && col.depois;
      var perp = estado(pc.o === 'h' ? 'v' : 'h', pos, pc.c);
      var perpExiste = perp.antes || perp.depois, perpContinua = perp.antes && perp.depois;
      if (pc.o === 'h') { if (perpContinua) return -MEIA; if (perpExiste && !colContinua) return MEIA; return 0; }
      return (!colContinua && perpExiste) ? -MEIA : 0;   /* v: só encurta */
    }
    pecas.forEach(function (pc) {
      pc.p2 = pc.p - ajuste(pc, pc.p);
      pc.q2 = pc.q + ajuste(pc, pc.q);
    });

    /* ---- portas internas: uma por par de ambientes, escolhida por preferência ---- */
    var pares = {};
    function chave(a, b){ return a.id < b.id ? a.id + '|' + b.id : b.id + '|' + a.id; }
    pecas.forEach(function (pc) {
      if (pc.ext || pc.len < 100) return;
      var k = chave(pc.A, pc.B);
      if (!pares[k] || pc.len > pares[k].len) pares[k] = pc;
    });
    var portas = {};
    ambs.forEach(function (r) {
      var cands = Object.keys(pares).map(function (k) { return pares[k]; })
        .filter(function (pc) { return pc.A === r || pc.B === r; })
        .map(function (pc) { return {pc:pc, outro: pc.A === r ? pc.B : pc.A}; });
      cands.sort(function (u, v) { return (PREF[v.outro.tipo] || 0) - (PREF[u.outro.tipo] || 0) || v.pc.len - u.pc.len; });
      if (cands.length) portas[chave(cands[0].pc.A, cands[0].pc.B)] = true;
    });
    Object.keys(pares).forEach(function (k) {   /* suíte ↔ banheiro sempre se comunicam */
      var pc = pares[k], s = nomeTem(pc.A, 'suíte') || nomeTem(pc.A, 'suite'), s2 = nomeTem(pc.B, 'suíte') || nomeTem(pc.B, 'suite');
      if ((s && pc.B.tipo === 'molhado') || (s2 && pc.A.tipo === 'molhado')) portas[k] = true;
    });
    var portaDe = {};   /* id do ambiente → peça da porta "principal" (para posicionar a câmera) */
    Object.keys(portas).forEach(function (k) {
      var pc = pares[k], m = (pc.p + pc.q) / 2;
      pc.ab.push({s: m - 40, e: m + 40, z0: 0, z1: 210, tipo: 'porta'});
      [pc.A, pc.B].forEach(function (r) {
        var outro = pc.A === r ? pc.B : pc.A;
        if (!portaDe[r.id] || (PREF[outro.tipo] || 0) > portaDe[r.id].pref) portaDe[r.id] = {pc:pc, pref: PREF[outro.tipo] || 0};
      });
    });

    /* ---- aberturas externas: entrada, portão da garagem, janelas ---- */
    function ladoDe(pc, r){
      if (pc.o === 'h') return pc.c === r.y ? 'frente' : 'fundo';
      return pc.c === r.x ? 'esq' : 'dir';
    }
    var externas = pecas.filter(function (pc) { return pc.ext && (pc.A || pc.B); });
    var entrada = null, melhor = -1;
    externas.forEach(function (pc) {
      var r = pc.A || pc.B;
      if (ladoDe(pc, r) !== 'frente' || pc.len < 100 || r.tipo === 'garagem') return;
      var sc = (PREF[r.tipo] || 0) * 1000 + pc.len;
      if (sc > melhor) { melhor = sc; entrada = {pc:pc, r:r}; }
    });
    if (!entrada) {   /* nenhum ambiente de frente: entra pela lateral com mais preferência */
      externas.forEach(function (pc) {
        var r = pc.A || pc.B; if (pc.len < 100 || r.tipo === 'garagem') return;
        var sc = (PREF[r.tipo] || 0) * 1000 + pc.len;
        if (sc > melhor) { melhor = sc; entrada = {pc:pc, r:r}; }
      });
    }
    var garagem = null;
    externas.forEach(function (pc) {
      var r = pc.A || pc.B, lado = ladoDe(pc, r);
      if (r.tipo === 'garagem' && lado === 'frente' && pc.len >= 200 && (!garagem || pc.len > garagem.len)) garagem = pc;
    });
    externas.forEach(function (pc) {
      var r = pc.A || pc.B, lado = ladoDe(pc, r), L = pc.len, jan = null;
      if (garagem === pc) { var gw = Math.min(L - 40, 280); pc.ab.push({s:(pc.p + pc.q) / 2 - gw / 2, e:(pc.p + pc.q) / 2 + gw / 2, z0:0, z1:Math.min(220, H - 20), tipo:'portao'}); return; }
      if (entrada && entrada.pc === pc) {
        var cx = L >= 300 ? pc.p + L * 0.3 : (pc.p + pc.q) / 2;
        pc.ab.push({s:cx - 45, e:cx + 45, z0:0, z1:210, tipo:'entrada'});
        if (L >= 300) { var jw = Math.min(L * 0.3, 160), jx = pc.p + L * 0.72; pc.ab.push({s:jx - jw / 2, e:jx + jw / 2, z0:100, z1:Math.min(230, H - 40), tipo:'janela'}); }
        return;
      }
      if (r.tipo === 'garagem' || L < 90) return;
      if (r.tipo === 'molhado')          jan = {w:Math.min(80, L - 30), z0:160, z1:Math.min(220, H - 30)};
      else if (r.tipo === 'servico')     jan = {w:Math.min(100, L - 30), z0:130, z1:Math.min(220, H - 40)};
      else if (r.tipo === 'circulacao') { if (L >= 200) jan = {w:80, z0:110, z1:Math.min(210, H - 40)}; }
      else                               jan = {w:Math.max(80, Math.min(L * 0.55, 240)), z0:100, z1:Math.min(230, H - 40)};
      if (!jan || jan.z1 - jan.z0 < 40) return;
      var m = (pc.p + pc.q) / 2;
      pc.ab.push({s:m - jan.w / 2, e:m + jan.w / 2, z0:jan.z0, z1:jan.z1, tipo:'janela'});
    });
    /* ambiente isolado (sem vizinho) ganha porta externa na maior peça */
    ambs.forEach(function (r) {
      if (portaDe[r.id] || (entrada && entrada.r === r)) return;
      var cand = externas.filter(function (pc) { return (pc.A || pc.B) === r && pc.len >= 100; }).sort(function (a, b) { return b.len - a.len; })[0];
      if (!cand) return;
      cand.ab = cand.ab.filter(function (ab) { return ab.tipo !== 'janela'; });
      var m = (cand.p + cand.q) / 2; cand.ab.push({s:m - 40, e:m + 40, z0:0, z1:210, tipo:'entrada'});
      portaDe[r.id] = {pc:cand, pref:0};
    });
    if (entrada) portaDe[entrada.r.id] = portaDe[entrada.r.id] || {pc:entrada.pc, pref:0};
    /* na entrada, a câmera olha a partir da porta da rua, não da porta interna */
    if (entrada) portaDe[entrada.r.id] = {pc:entrada.pc, pref:9};
    if (garagem) { var g = garagem.A || garagem.B; portaDe[g.id] = {pc:garagem, pref:9}; }

    /* ---- caixas sólidas de cada peça, descontando as aberturas ---- */
    pecas.forEach(function (pc) {
      var abs = pc.ab.slice().sort(function (a, b) { return a.s - b.s; }), cur = pc.p2, cx = [];
      abs.forEach(function (ab) {
        if (ab.s > cur) cx.push({p:cur, q:ab.s, z0:0, z1:H});
        if (ab.z0 > 0) cx.push({p:ab.s, q:ab.e, z0:0, z1:ab.z0});
        if (ab.z1 < H) cx.push({p:ab.s, q:ab.e, z0:ab.z1, z1:H});
        cur = ab.e;
      });
      if (pc.q2 > cur) cx.push({p:cur, q:pc.q2, z0:0, z1:H});
      pc.caixas = cx;
    });

    /* ---- lado da porta de cada ambiente (orienta móveis e câmera) ---- */
    var lado = {};
    ambs.forEach(function (r) {
      var pd = portaDe[r.id];
      lado[r.id] = pd ? ladoDe(pd.pc, r) : 'frente';
    });

    /* ---- ordem do passeio: da entrada, seguindo as portas ---- */
    var viz = {};
    Object.keys(portas).forEach(function (k) {
      var pc = pares[k]; (viz[pc.A.id] = viz[pc.A.id] || []).push(pc.B); (viz[pc.B.id] = viz[pc.B.id] || []).push(pc.A);
    });
    var inicio = entrada ? entrada.r : (garagem ? (garagem.A || garagem.B) : ambs[0]);
    var ordem = [], visto = {};
    if (inicio) {
      var fila = [inicio]; visto[inicio.id] = true;
      while (fila.length) {
        var r0 = fila.shift(); ordem.push(r0);
        (viz[r0.id] || []).slice().sort(function (a, b) { return (PREF[b.tipo] || 0) - (PREF[a.tipo] || 0); })
          .forEach(function (v) { if (!visto[v.id]) { visto[v.id] = true; fila.push(v); } });
      }
    }
    ambs.slice().sort(function (a, b) { return a.y - b.y || a.x - b.x; }).forEach(function (r) { if (!visto[r.id]) { visto[r.id] = true; ordem.push(r); } });

    return {ambs:ambs, pecas:pecas, externas:externas, entrada:entrada, garagem:garagem, portaDe:portaDe, lado:lado, ordem:ordem, H:H, terreno:t};
  }

  /* ---- frase por ambiente (o texto que aparece no passeio) ---- */
  var FRASES = [
    ['estar',    'Onde o dia desacelera.'],
    ['jantar',   'A mesa que junta todo mundo.'],
    ['cozinha',  'O coração da casa, com espaço para trabalhar.'],
    ['suíte',    'Seu canto. O banho a três passos da cama.'],
    ['suite',    'Seu canto. O banho a três passos da cama.'],
    ['quarto',   'Feche a porta. Deixe o dia lá fora.'],
    ['lavabo',   'Pequeno, e resolve a visita.'],
    ['banheiro', 'Luz, ventilação e conforto no seu ritmo.'],
    ['serviço',  'Tudo à mão, longe da vista.'],
    ['garagem',  'Chegar em casa começa aqui.'],
    ['varanda',  'Meio dentro, meio fora.'],
    ['gourmet',  'A parte da casa que ninguém quer sair.'],
    ['piscina',  'A hora do dia que ninguém quer que acabe.'],
    ['jardim',   'Verde de verdade, sem sair de casa.'],
    ['corredor', 'Liga tudo sem atrapalhar ninguém.'],
    ['hall',     'A primeira impressão, do lado de dentro.'],
    ['escritório','Silêncio para pensar.'],
    ['loja',     'Vitrine para dentro: quem entra, vê tudo.'],
    ['recepção', 'Quem chega é recebido antes de perguntar.'],
    ['vestiário','Troca rápida, sem fila.'],
    ['despensa', 'Estoque à mão, fora da cozinha.'],
    ['depósito', 'O que não se vê, mas faz falta.']
  ];
  var FRASE_TIPO = {social:'Cada metro com função.', intimo:'Um lugar para descansar.', molhado:'Água, luz e ventilação.',
    servico:'Feito para trabalhar.', circulacao:'Liga tudo sem atrapalhar.', garagem:'Chegar em casa começa aqui.',
    agua:'A hora do dia que ninguém quer que acabe.', externo:'Ar livre, do lado de casa.'};
  function frase(a){
    var n = (a.nome || '').toLowerCase();
    for (var i = 0; i < FRASES.length; i++) if (n.indexOf(FRASES[i][0]) >= 0) return FRASES[i][1];
    return FRASE_TIPO[a.tipo] || 'Cada metro com função.';
  }

  /* ---- quadro local do ambiente: u = largura, v = profundidade (porta em v = 0) ---- */
  function quadro(r, lado){
    var x = r.x * CM, z = r.y * CM, w = r.w * CM, d = r.h * CM, q = {};
    if (lado === 'fundo')     { q.W = w; q.D = d; q.rot = Math.PI;      q.px = x + w; q.pz = z + d; }
    else if (lado === 'esq')  { q.W = d; q.D = w; q.rot = Math.PI / 2;  q.px = x;     q.pz = z + d; }
    else if (lado === 'dir')  { q.W = d; q.D = w; q.rot = -Math.PI / 2; q.px = x + w; q.pz = z; }
    else                      { q.W = w; q.D = d; q.rot = 0;            q.px = x;     q.pz = z; }
    var c = Math.cos(q.rot), s = Math.sin(q.rot);
    q.mundo = function (u, v){ return {x: q.px + u * c + v * s, z: q.pz - u * s + v * c}; };
    return q;
  }

  /* ---- paradas do passeio (posição + alvo da câmera + legenda) ---- */
  function paradas(proj, an){
    var t = proj.terreno, out = [];
    var cob = an.ambs;
    var bx = cob.length ? Math.min.apply(null, cob.map(function (a) { return a.x; })) : 0;
    var bx2 = cob.length ? Math.max.apply(null, cob.map(function (a) { return a.x + a.w; })) : t.largura;
    var by = cob.length ? Math.min.apply(null, cob.map(function (a) { return a.y; })) : 0;
    var by2 = cob.length ? Math.max.apply(null, cob.map(function (a) { return a.y + a.h; })) : t.profundidade;
    var cx = (bx + bx2) / 2 * CM, cz = (by + by2) / 2 * CM, fz = by * CM;
    var recuo = Math.max(3.5, fz + 2.5);
    out.push({id:'fachada', titulo:'A chegada', sub:'Terreno ' + M.fmtM(t.largura) + ' × ' + M.fmtM(t.profundidade),
      frase:'Sua próxima história começa na calçada.', pos:[cx - (bx2 - bx) * CM * 0.35, 1.7, fz - recuo - 3.2], alvo:[cx, 1.6, fz + 1], externo:true});
    an.ordem.forEach(function (r) {
      var q = quadro(r, an.lado[r.id]), largo = q.W > 1.5 * q.D;   /* ambiente largo e raso: olha na diagonal */
      var u = largo ? q.W * 0.14 : q.W / 2, ua = largo ? q.W * 0.62 : q.W / 2;
      var pequeno = q.W < 1.9 || q.D < 2.3;   /* banheiro, lavabo, despensa: olha da porta */
      var v0 = pequeno ? -0.35 : Math.min(0.55, q.D * 0.18), alvoV = Math.max(v0 + 1, q.D * 0.85);
      var p = q.mundo(u, v0), a = q.mundo(ua, alvoV);
      out.push({id:r.id, titulo:r.nome, sub:M.fmtM2(M.areaOf(r)) + ' · ' + M.fmtM(r.w) + ' × ' + M.fmtM(r.h),
        frase:frase(r), pos:[p.x, 1.55, p.z], alvo:[a.x, 1.25, a.z], interno:true});
    });
    proj.ambientes.filter(function (a) { return !coberto(a); }).forEach(function (r) {
      /* área externa: câmera no lado mais próximo da casa, olhando para o fundo dela */
      var rx = (r.x + r.w / 2) * CM, rz = (r.y + r.h / 2) * CM, dx = rx - cx, dz = rz - cz, lado;
      if (Math.abs(dx) * (by2 - by) > Math.abs(dz) * (bx2 - bx)) lado = dx < 0 ? 'dir' : 'esq'; else lado = dz < 0 ? 'fundo' : 'frente';
      var q = quadro(r, lado), p = q.mundo(q.W / 2, -0.9), a = q.mundo(q.W / 2, q.D * 0.8);
      out.push({id:r.id, titulo:r.nome, sub:M.fmtM2(M.areaOf(r)) + ' · ' + M.fmtM(r.w) + ' × ' + M.fmtM(r.h),
        frase:frase(r), pos:[p.x, 1.65, p.z], alvo:[a.x, 0.6, a.z], externo:true});
    });
    var raio = Math.max((bx2 - bx) * CM, (by2 - by) * CM * .8) + 4;
    out.push({id:'aerea', titulo:'O conjunto', sub:M.fmtM2(M.areaConstruida()) + ' construídos · ' + M.fmtPct(M.ocupacao()) + ' do terreno',
      frase:'Tudo no lugar, visto de cima.', pos:[cx + raio * 0.95, raio * 0.95, cz - raio * 0.75], alvo:[cx, 0.5, cz], externo:true, aerea:true});
    return out;
  }

  /* ============================ MATERIAIS ============================ */
  function rnd(seed){ var s = seed >>> 0 || 1; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function hash(str){ var h = 7; for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0; return h; }

  function texCanvas(size, fn){
    var c = document.createElement('canvas'); c.width = c.height = size;
    fn(c.getContext('2d'), size);
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  }
  function ruido(ctx, size, n, cor, alfa, r){
    var R = rnd(r || 3);
    ctx.fillStyle = cor; ctx.globalAlpha = alfa;
    for (var i = 0; i < n; i++) ctx.fillRect(R() * size, R() * size, 1 + R() * 3, 1 + R() * 3);
    ctx.globalAlpha = 1;
  }
  var texs = null;
  function texturas(){
    if (texs) return texs;
    texs = {};
    texs.madeira = texCanvas(512, function (c, s) {   /* 4 tábuas por textura → 1 textura = 1 m */
      var R = rnd(11); c.fillStyle = '#C8A26E'; c.fillRect(0, 0, s, s);
      for (var i = 0; i < 4; i++) {
        var y = i * s / 4, tom = 190 + Math.floor(R() * 30);
        c.fillStyle = 'rgb(' + tom + ',' + Math.floor(tom * .78) + ',' + Math.floor(tom * .5) + ')';
        c.fillRect(0, y, s, s / 4);
        c.strokeStyle = 'rgba(90,60,30,.35)'; c.lineWidth = 2; c.strokeRect(0, y, s, s / 4);
        c.strokeStyle = 'rgba(120,80,40,.18)'; c.lineWidth = 1;
        for (var k = 0; k < 6; k++) { c.beginPath(); var yy = y + R() * s / 4; c.moveTo(0, yy); c.bezierCurveTo(s / 3, yy + R() * 8 - 4, s * 2 / 3, yy + R() * 8 - 4, s, yy); c.stroke(); }
        c.fillStyle = 'rgba(90,60,30,.35)'; c.fillRect(R() * s, y, 2, s / 4);
      }
    });
    texs.ceramica = texCanvas(512, function (c, s) {   /* 2 × 2 peças de 50 cm → 1 m */
      c.fillStyle = '#B9BDBF'; c.fillRect(0, 0, s, s);
      var R = rnd(5);
      for (var i = 0; i < 2; i++) for (var j = 0; j < 2; j++) {
        var tom = 226 + Math.floor(R() * 10);
        c.fillStyle = 'rgb(' + tom + ',' + (tom - 1) + ',' + (tom - 4) + ')';
        c.fillRect(i * s / 2 + 3, j * s / 2 + 3, s / 2 - 6, s / 2 - 6);
      }
      ruido(c, s, 900, '#000', .03, 8);
    });
    texs.concreto = texCanvas(256, function (c, s) { c.fillStyle = '#B7B6B0'; c.fillRect(0, 0, s, s); ruido(c, s, 2200, '#000', .06, 2); ruido(c, s, 1400, '#fff', .07, 4); });
    texs.grama = texCanvas(256, function (c, s) { c.fillStyle = '#6B934C'; c.fillRect(0, 0, s, s); ruido(c, s, 3200, '#2F5A22', .4, 6); ruido(c, s, 1600, '#9CC06E', .28, 7); });
    texs.asfalto = texCanvas(256, function (c, s) { c.fillStyle = '#4C4F53'; c.fillRect(0, 0, s, s); ruido(c, s, 2600, '#000', .18, 9); ruido(c, s, 1200, '#8a8d90', .12, 10); });
    texs.calcada = texCanvas(256, function (c, s) { c.fillStyle = '#C9C6BC'; c.fillRect(0, 0, s, s); ruido(c, s, 1500, '#000', .05, 12); c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 2; c.strokeRect(1, 1, s - 2, s - 2); });
    texs.deck = texCanvas(512, function (c, s) {
      var R = rnd(21); c.fillStyle = '#9C7048'; c.fillRect(0, 0, s, s);
      for (var i = 0; i < 8; i++) { var tom = 140 + Math.floor(R() * 30); c.fillStyle = 'rgb(' + tom + ',' + Math.floor(tom * .7) + ',' + Math.floor(tom * .45) + ')'; c.fillRect(0, i * s / 8 + 2, s, s / 8 - 4); }
    });
    return texs;
  }
  function std(cor, op){
    var o = {color: cor, roughness: .85, metalness: 0};
    if (op) for (var k in op) o[k] = op[k];
    return new THREE.MeshStandardMaterial(o);
  }
  function mapa(tex, rep, op){
    var t = tex.clone(); t.needsUpdate = true; t.repeat.set(rep, rep);
    var m = std('#FFFFFF', op); m.map = t; return m;
  }
  var mats = null;
  function materiais(){
    if (mats) return mats;
    var T = texturas();
    mats = {
      parede:   std('#F2EFE8'),
      paredeExt:std('#E7E1D3'),
      laje:     std('#D6D2C8'),
      teto:     std('#FAF9F5'),
      esquadria:std('#2B2F33', {roughness:.5, metalness:.4}),
      vidro:    new THREE.MeshStandardMaterial({color:'#BFE6F2', transparent:true, opacity:.34, roughness:.05, metalness:.15, side:THREE.DoubleSide, depthWrite:false}),
      porta:    std('#7A5230'),
      portao:   std('#7D838A', {roughness:.45, metalness:.5}),
      muro:     std('#DDD8CC'),
      agua:     new THREE.MeshStandardMaterial({color:'#3FB2D6', transparent:true, opacity:.72, roughness:.08, metalness:.05}),
      piscina:  std('#CDEBF3'),
      madeira:  mapa(T.madeira, 1),
      ceramica: mapa(T.ceramica, 1),
      concreto: mapa(T.concreto, .5),
      grama:    mapa(T.grama, .5),
      asfalto:  mapa(T.asfalto, .5),
      calcada:  mapa(T.calcada, 1),
      deck:     mapa(T.deck, 1),
      /* obra crua (etapas 1–3) */
      cruPiso:  mapa(T.concreto, .5),
      cruParede:std('#C98F6A'),
      cruLaje:  std('#B9B7B0'),
      /* mobiliário */
      tecido:   std('#E8E2D6'), tecido2: std('#B9C4B0'), madEsc: std('#8B5E3C'), madClara: std('#D8B98C'),
      branco:   std('#F5F5F2'), preto: std('#25282C'), metal: std('#A6ACB2', {roughness:.35, metalness:.6}),
      tronco:   std('#6F4E37'), folhas: std('#4F8A3E'), folhas2: std('#6AA24C'), pele: std('#D9C7A6'),
      carro:    std('#8FA3B5', {roughness:.35, metalness:.5}), pneu: std('#1E1F22'), vidroCarro: std('#2C3A44', {roughness:.2, metalness:.5}),
      terraExt: std('#9DB088'),
      /* estrutura (etapa 2) */
      concretoEstr: std('#C9C6BE', {roughness:.9}), ferro: std('#D9722B', {roughness:.5, metalness:.3}),
      inox: std('#C9CED3', {roughness:.25, metalness:.7}), louca: std('#FAFAF8', {roughness:.3}),
      azul: std('#6E7F9A'), azul2: std('#8FA0BA'), bege: std('#B8A88F'), vidroBox: new THREE.MeshStandardMaterial({color:'#CFE9F2', transparent:true, opacity:.28, roughness:.05, side:THREE.DoubleSide, depthWrite:false})
    };
    return mats;
  }

  /* ============================ CONSTRUÇÃO ============================ */
  function caixa(g, w, h, d, mat, x, y, z, sombra){
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y + h / 2, z);
    m.castShadow = sombra !== false; m.receiveShadow = true;
    g.add(m); return m;
  }
  function plano(g, w, d, mat, x, y, z, rep){   /* plano horizontal virado para cima, UV em metros */
    var geo = new THREE.PlaneGeometry(w, d);
    if (rep !== false) { var uv = geo.attributes.uv; for (var i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * d); }
    var m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true;
    g.add(m); return m;
  }
  function cil(g, r, h, mat, x, y, z, seg){
    var m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg || 10), mat);
    m.position.set(x, y + h / 2, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
  }
  function arvore(g, x, z, esc, R){
    var M2 = materiais(), s = esc || 1;
    cil(g, .09 * s, 1.6 * s, M2.tronco, x, 0, z, 7);
    var f = new THREE.Mesh(new THREE.IcosahedronGeometry(.85 * s, 1), R && R() > .5 ? M2.folhas2 : M2.folhas);
    f.position.set(x, 2.1 * s, z); f.castShadow = true; g.add(f);
    var f2 = new THREE.Mesh(new THREE.IcosahedronGeometry(.6 * s, 1), M2.folhas2);
    f2.position.set(x + .35 * s, 2.7 * s, z - .2 * s); f2.castShadow = true; g.add(f2);
  }
  function arbusto(g, x, z, r){
    var b = new THREE.Mesh(new THREE.IcosahedronGeometry(r || .35, 1), materiais().folhas2);
    b.position.set(x, (r || .35) * .8, z); b.castShadow = true; g.add(b);
  }

  /* ---- um móvel do catálogo, em coordenadas locais: x = largura, z = profundidade,
          encosto em -z, frente em +z, centro em (0, 0). Medidas em metros. ---- */
  function movel3d(mv){
    var lib = (typeof MOVEIS !== 'undefined') ? MOVEIS : null;
    var d = lib ? lib.def(mv.k) : null, dm = lib ? lib.dims(mv) : {w:60, d:60, alt:60};
    var w = dm.w * CM, dp = dm.d * CM, alt = dm.alt * CM, tipo = d ? d.m3d : 'caixa';
    var g = new THREE.Group(), Mt = materiais();
    function bx(W, H, D, mat, x, z, y, semSombra){ return caixa(g, W, H, D, mat, x, y || 0, z, semSombra === true ? false : undefined); }
    function cl(r, h, mat, x, z, y, seg){ return cil(g, r, h, mat, x, y || 0, z, seg); }
    function pernas(W, D, H, esp, mat){ [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (p) { bx(esp, H, esp, mat, p[0] * (W / 2 - esp / 2 - .02), p[1] * (D / 2 - esp / 2 - .02)); }); }
    function cadeira(W, D, H, mat){ bx(W, .05, D, mat, 0, 0, .43); bx(W, H - .45, .05, mat, 0, -D / 2 + .025, .45); pernas(W, D, .43, .04, Mt.madEsc); }
    var nA;

    if (tipo === 'sofa' || tipo === 'poltrona') {
      bx(w, .42, dp, Mt.azul, 0, 0); bx(w, alt - .42, .22, Mt.azul, 0, -dp / 2 + .11, .42);
      bx(.18, .24, dp, Mt.azul, -w / 2 + .09, 0, .42); bx(.18, .24, dp, Mt.azul, w / 2 - .09, 0, .42);
      nA = Math.max(1, Math.round((w - .36) / .68)); var cw = (w - .36) / nA;
      for (var i = 0; i < nA; i++) bx(cw - .04, .12, dp - .3, Mt.azul2, -w / 2 + .18 + cw * (i + .5), .06, .42);
      if (w >= 1.5) { var alm = bx(.42, .42, .12, Mt.tecido, -w / 2 + .42, -dp / 2 + .3, .54); alm.rotation.y = .3; }
    } else if (tipo === 'mesaRedonda' || tipo === 'mesaRedondaAlta') {
      cl(w / 2, .04, Mt.madEsc, 0, 0, alt - .04, 22); cl(.05, alt - .04, Mt.metal, 0, 0, 0, 10); cl(.2, .03, Mt.metal, 0, 0, 0, 16);
    } else if (tipo === 'rack') {
      bx(w, alt, dp, Mt.madEsc, 0, 0); bx(w * .7, .5, .04, Mt.preto, 0, -dp / 2 + .1, alt + .02); bx(.2, .03, .12, Mt.preto, 0, -dp / 2 + .1, alt);
    } else if (tipo === 'estante') {
      bx(w, alt, dp, Mt.madClara, 0, 0);
      var cores = [Mt.preto, Mt.tecido2, Mt.madEsc, Mt.azul, Mt.tecido];
      for (var s2 = 0; s2 < 4; s2++) { bx(w - .04, .02, dp, Mt.madEsc, 0, 0, .4 + s2 * .42); var x0 = -w / 2 + .06, k2 = 0; while (x0 < w / 2 - .1) { var lw = .04 + (k2 % 3) * .015; bx(lw, .26, dp - .08, cores[k2 % cores.length], x0 + lw / 2, .01, .42 + s2 * .42); x0 += lw + .012; k2++; } }
    } else if (tipo === 'prateleira') {
      for (var k3 = 0; k3 < 4; k3++) bx(w, .03, dp, Mt.madClara, 0, 0, .4 + k3 * (alt - .4) / 3);
      bx(.03, alt, dp, Mt.metal, -w / 2 + .015, 0); bx(.03, alt, dp, Mt.metal, w / 2 - .015, 0);
    } else if (tipo === 'tapete') {
      var tp = plano(g, w, dp, Mt.tecido2, 0, .012, 0, false); tp.castShadow = false;
    } else if (tipo === 'tapeteRedondo') {
      var tr = cl(w / 2, .01, Mt.tecido2, 0, 0, .005, 28); tr.castShadow = false;
    } else if (tipo === 'mesa') {
      bx(w, .04, dp, Mt.madEsc, 0, 0, alt - .04); pernas(w, dp, alt - .04, .05, Mt.madEsc);
    } else if (tipo === 'cadeira') {
      cadeira(w, dp, alt, Mt.madClara);
    } else if (tipo === 'cadeiraEscr') {
      cl(.28, .03, Mt.metal, 0, 0, 0, 12); cl(.03, .42, Mt.metal, 0, 0, .03, 8);
      bx(w, .08, dp, Mt.preto, 0, 0, .45); bx(w * .9, alt - .53, .06, Mt.preto, 0, -dp / 2 + .03, .53);
    } else if (tipo === 'buffet') {
      bx(w, alt, dp, Mt.madEsc, 0, 0); cl(.08, .22, Mt.branco, -w * .25, 0, alt, 10); bx(.28, .34, .03, Mt.tecido2, w * .2, -dp / 2 + .05, alt);
    } else if (tipo === 'bancada') {
      bx(w, alt - .04, dp, Mt.madClara, 0, 0); bx(w + .02, .04, dp + .02, Mt.branco, 0, 0, alt - .04);
    } else if (tipo === 'pia') {
      bx(w, alt - .04, dp, Mt.madClara, 0, 0); bx(w + .02, .04, dp + .02, Mt.branco, 0, 0, alt - .04);
      bx(w * .72, .02, dp * .58, Mt.inox, 0, .02, alt); cl(.015, .22, Mt.inox, 0, -dp / 2 + .1, alt, 8); var bic = bx(.03, .03, .16, Mt.inox, 0, -dp / 2 + .17, alt + .2); bic.castShadow = false;
    } else if (tipo === 'fogao') {
      bx(w, alt - .02, dp, Mt.branco, 0, 0); bx(w, .02, dp, Mt.preto, 0, 0, alt - .02);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (p) { cl(.07, .012, Mt.metal, p[0] * w * .24, p[1] * dp * .22, alt, 12); });
      bx(w - .06, .01, .01, Mt.metal, 0, dp / 2 - .02, alt + .0);
    } else if (tipo === 'geladeira') {
      bx(w, alt, dp, Mt.inox, 0, 0); bx(w - .04, .005, .01, Mt.preto, 0, dp / 2 + .003, alt * .62); bx(.02, alt * .42, .02, Mt.preto, -w * .32, dp / 2 + .012, alt * .12); bx(.02, alt * .28, .02, Mt.preto, -w * .32, dp / 2 + .012, alt * .66);
    } else if (tipo === 'cama') {
      bx(w + .1, .25, dp + .1, Mt.madEsc, 0, 0); bx(w, .22, dp, Mt.branco, 0, 0, .25);
      bx(w - .1, .07, dp * .55, Mt.azul2, 0, dp * .2, .47);
      if (w < 1.2) bx(w * .7, .1, .5, Mt.branco, 0, -dp / 2 + .35, .47); else { bx(w * .38, .1, .5, Mt.branco, -w * .22, -dp / 2 + .35, .47); bx(w * .38, .1, .5, Mt.branco, w * .22, -dp / 2 + .35, .47); }
      bx(w + .1, .9, .06, Mt.madEsc, 0, -dp / 2 - .03);
    } else if (tipo === 'berco') {
      bx(w - .1, .14, dp - .1, Mt.branco, 0, 0, .5); pernas(w, dp, alt, .04, Mt.madClara);
      bx(w, .04, .03, Mt.madClara, 0, -dp / 2 + .015, alt - .04); bx(w, .04, .03, Mt.madClara, 0, dp / 2 - .015, alt - .04);
      bx(.03, .04, dp, Mt.madClara, -w / 2 + .015, 0, alt - .04); bx(.03, .04, dp, Mt.madClara, w / 2 - .015, 0, alt - .04);
      for (var zb = -dp / 2 + .1; zb < dp / 2 - .05; zb += .09) { bx(.015, alt - .1, .015, Mt.madClara, -w / 2 + .015, zb, .05); bx(.015, alt - .1, .015, Mt.madClara, w / 2 - .015, zb, .05); }
    } else if (tipo === 'criado') {
      bx(w, alt, dp, Mt.madClara, 0, 0); cl(.05, .2, Mt.metal, 0, 0, alt, 8); cl(.11, .14, Mt.branco, 0, 0, alt + .2, 12);
    } else if (tipo === 'armario') {
      bx(w, alt, dp, Mt.madClara, 0, 0); var np = Math.max(2, Math.round(w / .5));
      for (var pi = 1; pi < np; pi++) bx(.008, alt - .06, .006, Mt.madEsc, -w / 2 + w * pi / np, dp / 2 + .003, .03);
      for (var pj = 0; pj < np; pj++) bx(.02, .12, .015, Mt.metal, -w / 2 + w * (pj + .5) / np + (pj % 2 ? -.05 : .05), dp / 2 + .01, alt * .45);
    } else if (tipo === 'comoda') {
      bx(w, alt, dp, Mt.madClara, 0, 0);
      for (var gv = 1; gv <= 3; gv++) { bx(w - .08, .006, .006, Mt.madEsc, 0, dp / 2 + .003, alt * gv / 4); bx(.14, .015, .015, Mt.metal, 0, dp / 2 + .01, alt * gv / 4 + .06); }
      bx(.26, .32, .03, Mt.tecido2, w * .15, -dp / 2 + .04, alt); cl(.07, .18, Mt.branco, -w * .3, 0, alt, 10);
    } else if (tipo === 'vaso') {
      bx(w, .45, .18, Mt.louca, 0, -dp / 2 + .09, .35); var bowl = cl(w / 2, .4, Mt.louca, 0, .06, 0, 18); bowl.scale.z = (dp - .2) / w; bx(w - .02, .03, dp - .24, Mt.louca, 0, .06, .4);
    } else if (tipo === 'lavatorio') {
      cl(.09, alt - .15, Mt.louca, 0, 0, 0, 10); bx(w, .15, dp, Mt.louca, 0, 0, alt - .15); bx(w - .12, .01, dp - .14, Mt.branco, 0, .02, alt); cl(.015, .18, Mt.inox, 0, -dp / 2 + .08, alt, 8);
    } else if (tipo === 'box') {
      var gb = caixa(g, w, alt, .012, Mt.vidroBox, 0, 0, dp / 2, false); gb.castShadow = false;
      var gb2 = caixa(g, .012, alt, dp, Mt.vidroBox, w / 2, 0, 0, false); gb2.castShadow = false;
      bx(w, .03, .03, Mt.metal, 0, dp / 2, alt - .03); bx(.03, .03, dp, Mt.metal, w / 2, 0, alt - .03);
      bx(.12, .03, .12, Mt.metal, 0, -dp / 2 + .16, alt - .1); cl(.012, .3, Mt.metal, 0, -dp / 2 + .02, alt - .32, 6);
    } else if (tipo === 'banheira') {
      bx(w, alt, .08, Mt.louca, 0, -dp / 2 + .04); bx(w, alt, .08, Mt.louca, 0, dp / 2 - .04); bx(.08, alt, dp, Mt.louca, -w / 2 + .04, 0); bx(.08, alt, dp, Mt.louca, w / 2 - .04, 0); bx(w, .1, dp, Mt.louca, 0, 0);
      var ag = plano(g, w - .16, dp - .16, Mt.agua, 0, alt - .14, 0, false); ag.receiveShadow = false; cl(.015, .16, Mt.inox, w / 2 - .12, 0, alt, 8);
    } else if (tipo === 'escrivaninha') {
      bx(w, .04, dp, Mt.madClara, 0, 0, alt - .04); bx(.03, alt - .04, dp - .1, Mt.metal, -w / 2 + .04, 0); bx(.03, alt - .04, dp - .1, Mt.metal, w / 2 - .04, 0);
      bx(.14, .02, .14, Mt.preto, 0, -dp / 2 + .2, alt); cl(.015, .1, Mt.preto, 0, -dp / 2 + .2, alt + .02, 6); bx(.52, .3, .02, Mt.preto, 0, -dp / 2 + .2, alt + .12); bx(.4, .015, .14, Mt.preto, 0, .05, alt);
    } else if (tipo === 'lavadora') {
      bx(w, alt, dp, Mt.branco, 0, 0); var porta = cl(.22, .02, Mt.metal, 0, dp / 2 + .005, 0, 20); porta.rotation.x = Math.PI / 2; porta.position.y = alt * .48; var vis = cl(.15, .01, Mt.vidroCarro, 0, dp / 2 + .022, 0, 16); vis.rotation.x = Math.PI / 2; vis.position.y = alt * .48; bx(w - .08, .06, .02, Mt.metal, 0, dp / 2 + .005, alt - .1);
    } else if (tipo === 'tanque') {
      bx(w, alt, dp, Mt.louca, 0, 0); bx(w - .1, .02, dp - .1, Mt.inox, 0, 0, alt - .02); cl(.015, .16, Mt.inox, 0, -dp / 2 + .06, alt, 8);
    } else if (tipo === 'carro') {
      bx(w, .55, dp, Mt.carro, 0, 0, .3); bx(w * .9, .5, dp * .52, Mt.vidroCarro, 0, -dp * .03, .85); bx(w * .87, .06, dp * .5, Mt.carro, 0, -dp * .03, 1.35);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (p) { var pn = cl(.32, .22, Mt.pneu, p[0] * (w / 2 - .1), p[1] * dp * .32, 0, 12); pn.rotation.z = Math.PI / 2; pn.position.y = .32; });
      bx(.16, .07, .03, Mt.tecido, -w * .3, -dp / 2 + .015, .5); bx(.16, .07, .03, Mt.tecido, w * .3, -dp / 2 + .015, .5);
    } else if (tipo === 'churrasqueira') {
      bx(w, .9, dp, Mt.cruParede, 0, 0); bx(w * .6, .03, dp * .5, Mt.preto, 0, 0, .9); bx(w * .8, alt - 1.5, dp * .6, Mt.laje, 0, -dp * .15, 1.5); bx(w * .5, .6, dp * .5, Mt.laje, 0, -dp * .2, .93);
    } else if (tipo === 'espreguicadeira') {
      bx(w, .06, dp, Mt.branco, 0, 0, .3); pernas(w, dp, .3, .04, Mt.metal); var enc = bx(w, .06, dp * .35, Mt.branco, 0, -dp / 2 + dp * .12, .36); enc.rotation.x = -.55;
    } else if (tipo === 'arvore') {
      var sc = alt / 3.5; cl(.09 * sc, 1.6 * sc, Mt.tronco, 0, 0, 0, 7);
      var f = new THREE.Mesh(new THREE.IcosahedronGeometry(.85 * sc, 1), Mt.folhas); f.position.set(0, 2.1 * sc, 0); f.castShadow = true; g.add(f);
      var f2 = new THREE.Mesh(new THREE.IcosahedronGeometry(.6 * sc, 1), Mt.folhas2); f2.position.set(.35 * sc, 2.7 * sc, -.2 * sc); f2.castShadow = true; g.add(f2);
    } else if (tipo === 'planta') {
      var sp = alt / 1.1; cl(.16 * sp, .36 * sp, Mt.madEsc, 0, 0, 0, 8);
      var fp = new THREE.Mesh(new THREE.IcosahedronGeometry(.32 * sp, 1), Mt.folhas); fp.position.set(0, .75 * sp, 0); fp.castShadow = true; g.add(fp);
    } else if (tipo === 'luminaria') {
      cl(.12, .02, Mt.metal, 0, 0, 0, 12); cl(.015, alt - .3, Mt.metal, 0, 0, .02, 6); cl(w / 2, .3, Mt.tecido, 0, 0, alt - .3, 16);
    } else {
      bx(w, alt, dp, Mt.madClara, 0, 0);
    }
    g.traverse(function (o) { if (o.isMesh) o.userData.mid = mv.id; });
    g.userData.mid = mv.id; g.userData.alt = alt;
    return g;
  }
  /* põe o móvel no mundo: centro (x, y) em cm, giro horário da planta, espelho, elevação */
  function posicionar(g, mv){
    g.position.set(mv.x * CM, (mv.elev || 0) * CM, mv.y * CM);
    g.rotation.y = -(mv.rot || 0) * Math.PI / 180;
    g.scale.x = mv.esp ? -1 : 1;
  }

  /* ---- monta a cena inteira ---- */
  function construir(proj){
    var an = analise(proj), Mt = materiais(), t = proj.terreno, H = an.H * CM;
    var raiz = new THREE.Group();
    var G = {terreno:new THREE.Group(), pisos:new THREE.Group(), estrutura:new THREE.Group(), paredes:new THREE.Group(), cobertura:new THREE.Group(), acabamento:new THREE.Group(), moveis:new THREE.Group()};
    Object.keys(G).forEach(function (k) { G[k].name = k; raiz.add(G[k]); });
    var TL = t.largura * CM, TP = t.profundidade * CM;
    var pisos = [];   /* meshes clicáveis (id do ambiente) */

    /* ---------- terreno, calçada, rua, muro ---------- */
    plano(G.terreno, 260, 260, Mt.terraExt, TL / 2, -.03, TP / 2);
    plano(G.terreno, TL, TP, Mt.grama, TL / 2, 0, TP / 2);
    plano(G.terreno, TL + 40, 2.6, Mt.calcada, TL / 2, .0, -1.3);
    caixa(G.terreno, TL + 40, .12, .15, Mt.laje, TL / 2, -.1, -2.55, false);
    plano(G.terreno, TL + 40, 7, Mt.asfalto, TL / 2, -.1, -6.1);
    /* muros laterais e de fundo */
    caixa(G.terreno, .15, 1.8, TP, Mt.muro, .075, 0, TP / 2); caixa(G.terreno, .15, 1.8, TP, Mt.muro, TL - .075, 0, TP / 2);
    caixa(G.terreno, TL, 1.8, .15, Mt.muro, TL / 2, 0, TP - .075);
    /* muro frontal com portão alinhado à garagem ou à entrada */
    var gx = TL / 2, gw = 3;
    if (an.garagem) { var ga = an.garagem.A || an.garagem.B; gx = (ga.x + ga.w / 2) * CM; gw = Math.min(3.2, ga.w * CM); }
    else if (an.entrada) { var ab = an.entrada.pc.ab.filter(function (a) { return a.tipo === 'entrada'; })[0]; gx = an.entrada.pc.o === 'h' ? (ab ? (ab.s + ab.e) / 2 : (an.entrada.pc.p + an.entrada.pc.q) / 2) * CM : an.entrada.pc.c * CM; gw = 1.2; }
    var x1 = gx - gw / 2, x2 = gx + gw / 2;
    if (x1 > .2) caixa(G.terreno, x1, 1.0, .15, Mt.muro, x1 / 2, 0, .075);
    if (TL - x2 > .2) caixa(G.terreno, TL - x2, 1.0, .15, Mt.muro, x2 + (TL - x2) / 2, 0, .075);
    caixa(G.terreno, gw - .1, .06, .06, Mt.portao, gx, 1.34, .075); caixa(G.terreno, gw - .1, .06, .06, Mt.portao, gx, .1, .075);   /* portão gradeado */
    for (var gi = 0; gi <= Math.round((gw - .1) / .13); gi++) caixa(G.terreno, .035, 1.4, .035, Mt.portao, gx - (gw - .1) / 2 + gi * ((gw - .1) / Math.round((gw - .1) / .13)), 0, .075);
    /* caminho do portão até a casa */
    var frenteCasa = an.ambs.length ? Math.min.apply(null, an.ambs.map(function (a) { return a.y; })) * CM : TP;
    if (frenteCasa > .3) plano(G.terreno, gw - .2, frenteCasa - .2, Mt.concreto, gx, .005, .1 + (frenteCasa - .2) / 2);
    /* árvores no recuo frontal */
    var R = rnd(hash(proj.id || 'x'));
    if (t.recuoFrontal >= 250) { if (Math.abs(1 - gx) > 1.6) arvore(G.terreno, .9, 1.2, .9, R); if (Math.abs(TL - 1 - gx) > 1.6) arvore(G.terreno, TL - .9, 1.2, .8, R); }

    /* ---------- pisos, tetos, laje ---------- */
    an.ambs.forEach(function (r) {
      var x = r.x * CM, z = r.y * CM, w = r.w * CM, d = r.h * CM;
      var mat = r.tipo === 'molhado' || r.tipo === 'servico' ? Mt.ceramica : (r.tipo === 'garagem' ? Mt.concreto : Mt.madeira);
      var base = caixa(G.pisos, w, .1, d, Mt.laje, x + w / 2, 0, z + d / 2, false);
      var p = plano(G.pisos, w, d, mat, x + w / 2, .101, z + d / 2);
      p.userData.ambId = r.id; p.userData.pronto = mat; p.userData.cru = Mt.cruPiso; pisos.push(p);
      var teto = plano(G.cobertura, w, d, Mt.teto, x + w / 2, H - .005, z + d / 2, false); teto.rotation.x = Math.PI / 2;
      var laje = caixa(G.cobertura, w, .15, d, Mt.laje, x + w / 2, H, z + d / 2); laje.userData.pronto = Mt.laje; laje.userData.cru = Mt.cruLaje;
    });
    /* ---------- paredes ---------- */
    an.pecas.forEach(function (pc) {
      var mat = pc.ext ? Mt.paredeExt : Mt.parede;
      pc.caixas.forEach(function (c) {
        var len = (c.q - c.p) * CM, alt = (c.z1 - c.z0) * CM, mid = (c.p + c.q) / 2 * CM, y0 = c.z0 * CM;
        var m = pc.o === 'h' ? caixa(G.paredes, len, alt, ESP * CM, mat, mid, y0, pc.c * CM) : caixa(G.paredes, ESP * CM, alt, len, mat, pc.c * CM, y0, mid);
        m.userData.pronto = mat; m.userData.cru = Mt.cruParede;
      });
      /* platibanda nas peças externas */
      if (pc.ext) {
        var len2 = (pc.q2 - pc.p2) * CM, mid2 = (pc.p2 + pc.q2) / 2 * CM;
        var pl = pc.o === 'h' ? caixa(G.cobertura, len2, .6, ESP * CM, Mt.paredeExt, mid2, H + .15, pc.c * CM) : caixa(G.cobertura, ESP * CM, .6, len2, Mt.paredeExt, pc.c * CM, H + .15, mid2);
        pl.userData.pronto = Mt.paredeExt; pl.userData.cru = Mt.cruParede;
      }
      /* esquadrias, vidros e portas */
      pc.ab.forEach(function (ab) {
        var len = (ab.e - ab.s) * CM, alt = (ab.z1 - ab.z0) * CM, mid = (ab.s + ab.e) / 2 * CM, y0 = ab.z0 * CM;
        var horiz = pc.o === 'h', cx = horiz ? mid : pc.c * CM, cz = horiz ? pc.c * CM : mid;
        function peça(w, h, d, mat, dx, dy, dz, sombra){ return horiz ? caixa(G.acabamento, w, h, d, mat, cx + dx, y0 + dy, cz + dz, sombra) : caixa(G.acabamento, d, h, w, mat, cx + dz, y0 + dy, cz + dx, sombra); }
        if (ab.tipo === 'janela') {
          peça(len, alt, .02, Mt.vidro, 0, 0, 0, false);
          peça(len, .05, .08, Mt.esquadria, 0, 0, 0); peça(len, .05, .08, Mt.esquadria, 0, alt - .05, 0);
          peça(.05, alt, .08, Mt.esquadria, -len / 2 + .025, 0, 0); peça(.05, alt, .08, Mt.esquadria, len / 2 - .025, 0, 0);
          peça(.03, alt, .04, Mt.esquadria, 0, 0, 0);
          peça(len + .2, .06, .3, Mt.laje, 0, -.06, 0);   /* peitoril */
        } else if (ab.tipo === 'portao') {
          peça(len, alt, .04, Mt.portao, 0, 0, 0);
          for (var i = 1; i < 5; i++) peça(len, .02, .06, Mt.esquadria, 0, alt * i / 5, 0);
        } else if (ab.tipo === 'entrada') {
          peça(len, alt, .06, Mt.porta, 0, 0, 0); peça(.03, .03, .1, Mt.metal, len / 2 - .12, 1.0, .06);
          peça(.05, alt, .1, Mt.esquadria, -len / 2 + .025, 0, 0); peça(.05, alt, .1, Mt.esquadria, len / 2 - .025, 0, 0); peça(len, .05, .1, Mt.esquadria, 0, alt - .05, 0);
        } else {   /* porta interna: aberta a 75° para dentro do ambiente B */
          peça(.05, alt, .12, Mt.esquadria, -len / 2 + .025, 0, 0); peça(.05, alt, .12, Mt.esquadria, len / 2 - .025, 0, 0); peça(len, .05, .12, Mt.esquadria, 0, alt - .05, 0);
          var folha = new THREE.Mesh(new THREE.BoxGeometry(len - .06, alt - .05, .04), Mt.porta); folha.castShadow = true;
          var piv = new THREE.Group(); piv.position.set(horiz ? cx - len / 2 + .03 : cx, y0 + (alt - .05) / 2, horiz ? cz : cz - len / 2 + .03);
          folha.position.set((len - .06) / 2, 0, 0); piv.add(folha);
          piv.rotation.y = horiz ? -Math.PI * .42 : Math.PI / 2 - Math.PI * .42;
          G.acabamento.add(piv);
        }
      });
    });
    /* ---------- piscina e jardim ---------- */
    proj.ambientes.filter(function (a) { return !coberto(a); }).forEach(function (r) {
      var x = r.x * CM, z = r.y * CM, w = r.w * CM, d = r.h * CM, cx = x + w / 2, cz = z + d / 2;
      if (r.tipo === 'agua') {
        caixa(G.pisos, w + .8, .06, d + .8, Mt.deck, cx, 0, cz, false);
        caixa(G.pisos, w + .16, .1, d + .16, Mt.piscina, cx, .02, cz, false);
        plano(G.pisos, w, d, Mt.piscina, cx, -1.4, cz, false);
        caixa(G.pisos, .1, 1.4, d, Mt.piscina, x + .05, -1.4, cz, false); caixa(G.pisos, .1, 1.4, d, Mt.piscina, x + w - .05, -1.4, cz, false);
        caixa(G.pisos, w, 1.4, .1, Mt.piscina, cx, -1.4, z + .05, false); caixa(G.pisos, w, 1.4, .1, Mt.piscina, cx, -1.4, z + d - .05, false);
        var ag = plano(G.acabamento, w - .2, d - .2, Mt.agua, cx, -.25, cz, false); ag.userData.agua = true; ag.receiveShadow = false;
        var lp = caixa(G.pisos, w - .2, .12, d - .2, Mt.laje, cx, -.01, cz, false); lp.visible = false; lp.userData.lp = true;   /* tampa na obra crua */
        /* espreguiçadeiras */
        if (w > 3 && d > 3) { caixa(G.acabamento, .6, .3, 1.6, Mt.branco, x - .9, .06, cz - 1); caixa(G.acabamento, .6, .3, 1.6, Mt.branco, x - .9, .06, cz + 1); }
      } else {
        var gp = plano(G.pisos, w, d, Mt.grama, cx, .012, cz); gp.userData.ambId = r.id; pisos.push(gp);
        var Rj = rnd(hash(r.id)), n = Math.max(1, Math.min(4, Math.floor(w * d / 9)));
        for (var i = 0; i < n; i++) { var ax = x + .8 + Rj() * Math.max(.1, w - 1.6), az = z + .8 + Rj() * Math.max(.1, d - 1.6); arvore(G.acabamento, ax, az, .7 + Rj() * .5, Rj); }
        for (var j = 0; j < n + 2; j++) arbusto(G.acabamento, x + .4 + Rj() * Math.max(.1, w - .8), z + .4 + Rj() * Math.max(.1, d - .8), .25 + Rj() * .2);
      }
    });
    /* ---------- estrutura: sapatas, pilares, baldrames e vigas (etapa 2) ---------- */
    var nos = {};   /* pilar em cada ponta / encontro de parede */
    an.pecas.forEach(function (pc) {
      var a = pc.o === 'h' ? [pc.p, pc.c] : [pc.c, pc.p], b = pc.o === 'h' ? [pc.q, pc.c] : [pc.c, pc.q];
      nos[a.join('|')] = a; nos[b.join('|')] = b;
      var len = pc.len * CM, mid = (pc.p + pc.q) / 2 * CM;
      var bald = pc.o === 'h' ? caixa(G.estrutura, len, .3, .2, Mt.concretoEstr, mid, -.3, pc.c * CM) : caixa(G.estrutura, .2, .3, len, Mt.concretoEstr, pc.c * CM, -.3, mid);
      var viga = pc.o === 'h' ? caixa(G.estrutura, len, .3, .2, Mt.concretoEstr, mid, H - .3, pc.c * CM) : caixa(G.estrutura, .2, .3, len, Mt.concretoEstr, pc.c * CM, H - .3, mid);
      bald.receiveShadow = viga.receiveShadow = false;
    });
    Object.keys(nos).forEach(function (k) {
      var x = nos[k][0] * CM, z = nos[k][1] * CM;
      caixa(G.estrutura, .9, .35, .9, Mt.concretoEstr, x, -.75, z, false);           /* sapata */
      caixa(G.estrutura, .2, H + .5, .2, Mt.concretoEstr, x, -.45, z);                /* pilar */
      [[-.05, -.05], [.05, -.05], [-.05, .05], [.05, .05]].forEach(function (o) {  /* arranques de ferro */
        var f = cil(G.estrutura, .008, .6, Mt.ferro, x + o[0], H + .05, z + o[1], 5); f.userData.ferro = true; f.castShadow = false;
      });
    });
    /* ---------- móveis: cada item de proj.moveis, com as medidas do catálogo ---------- */
    var moveis = {}, movMeshes = [];
    (proj.moveis || []).forEach(function (mv) {
      var g = movel3d(mv); posicionar(g, mv);
      G.moveis.add(g); moveis[mv.id] = g;
      g.traverse(function (o) { if (o.isMesh) movMeshes.push(o); });
    });

    return {raiz:raiz, G:G, pisos:pisos, moveis:moveis, movMeshes:movMeshes, an:an, paradas:paradas(proj, an), H:H, TL:TL, TP:TP, portaoX:gx};
  }

  /* ============================ INSTÂNCIA ============================ */
  var ETAPAS = ['Terreno', 'Fundação e piso', 'Estrutura', 'Alvenaria', 'Cobertura', 'Acabamento'];
  function ease(t){ return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function clamp(v, a, b){ return v < a ? a : (v > b ? b : v); }

  function montar(el, op){
    op = op || {};
    var canvas = document.createElement('canvas'); canvas.className = 't3-canvas'; canvas.tabIndex = 0;
    el.appendChild(canvas);
    var renderer;
    try { renderer = new THREE.WebGLRenderer({canvas:canvas, antialias:true, powerPreference:'high-performance'}); }
    catch (e) { el.innerHTML = '<div class="t3-sem">Este navegador não conseguiu abrir o 3D (WebGL indisponível).</div>'; return null; }
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .95;

    var scene = new THREE.Scene();
    scene.background = new THREE.Color('#D9E7F2');
    scene.fog = new THREE.Fog('#D9E7F2', 60, 170);
    var camera = new THREE.PerspectiveCamera(62, 1, .05, 400);
    var hemi = new THREE.HemisphereLight('#DCE9F5', '#7D8A6C', .85); scene.add(hemi);
    var amb = new THREE.AmbientLight('#FFFFFF', .28); scene.add(amb);
    var sol = new THREE.DirectionalLight('#FFF3DC', 1.9); sol.castShadow = true;
    sol.shadow.mapSize.set(2048, 2048); sol.shadow.bias = -.0006; sol.shadow.normalBias = .03; sol.shadow.radius = 3;
    scene.add(sol); scene.add(sol.target);
    var fill = new THREE.DirectionalLight('#EAF2FF', .55); fill.position.set(6, 4, -8); scene.add(fill);   /* dá volume onde o sol não entra */

    var cena = null, modo = op.modo || 'orbit', etapa = 5, teto = true, vivo = true, sujo = true, luzManual = false;
    var sel3 = null, caixaSel = null, arrastoMov = null;   /* móvel selecionado / arrastado no 3D */
    var pos = new THREE.Vector3(), alvo = new THREE.Vector3();          /* pose atual */
    var orb = {theta:2.45, phi:1.08, dist:22, alvo:new THREE.Vector3()}, orbD = {theta:2.45, phi:1.08, dist:22, alvo:new THREE.Vector3()};
    var walk = {yaw:0, pitch:0, pos:new THREE.Vector3(), vel:new THREE.Vector3()};
    var tour = {i:0, t:1, de:null, para:null, olhaYaw:0, olhaPitch:0, auto:false, autoT:0};
    var teclas = {}, ouvintes = [];
    var raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
    var cb = op.on || {};

    function reconstruir(){
      if (cena) { scene.remove(cena.raiz); descartar(cena.raiz); }
      cena = construir(M.proj);
      scene.add(cena.raiz);
      var R = Math.max(cena.TL, cena.TP) / 2 + 8;
      sol.position.set(cena.TL / 2 - R * .8, R * 1.4, cena.TP / 2 - R * .6); sol.target.position.set(cena.TL / 2, 0, cena.TP / 2);
      sol.shadow.camera.left = -R; sol.shadow.camera.right = R; sol.shadow.camera.top = R; sol.shadow.camera.bottom = -R; sol.shadow.camera.near = 1; sol.shadow.camera.far = R * 4;
      sol.shadow.camera.updateProjectionMatrix();
      var bb = cena.an.ambs.length ? cena.an.ambs : M.proj.ambientes;
      var bx0 = bb.length ? Math.min.apply(null, bb.map(function (a) { return a.x; })) * CM : 0, bx1 = bb.length ? Math.max.apply(null, bb.map(function (a) { return a.x + a.w; })) * CM : cena.TL;
      var bz0 = bb.length ? Math.min.apply(null, bb.map(function (a) { return a.y; })) * CM : 0, bz1 = bb.length ? Math.max.apply(null, bb.map(function (a) { return a.y + a.h; })) * CM : cena.TP;
      cena.casa = {cx:(bx0 + bx1) / 2, cz:(bz0 + bz1) / 2, w:bx1 - bx0, d:bz1 - bz0};
      orbD.alvo.set(cena.casa.cx, 1, cena.casa.cz); orb.alvo.copy(orbD.alvo);
      if (!walk.pos.length()) { walk.pos.set(cena.portaoX, 1.6, -2.2); walk.yaw = 0; }
      aplicarEtapa(); aplicarTeto();
      if (tour.i >= cena.paradas.length) tour.i = 0;
      if (modo === 'tour') { var p = cena.paradas[tour.i]; tour.de = null; tour.para = p; tour.t = 1; pos.fromArray(p.pos); alvo.fromArray(p.alvo); legenda(); }
      sujo = true;
      if (cb.paradas) cb.paradas(cena.paradas);
      if (sel3) selecionarMovel(cena.moveis[sel3] ? sel3 : null, true);
    }
    /* ---------- seleção de móvel no 3D: caixa verde + posição na tela para o menu ---------- */
    function selecionarMovel(id, silencioso){
      if (caixaSel) { scene.remove(caixaSel); caixaSel.geometry.dispose(); caixaSel = null; }
      sel3 = id && cena && cena.moveis[id] ? id : null;
      if (sel3) { caixaSel = new THREE.BoxHelper(cena.moveis[sel3], 0x2FA36B); caixaSel.material.depthTest = false; caixaSel.renderOrder = 9; scene.add(caixaSel); }
      sujo = true;
      if (!silencioso && cb.selMov) cb.selMov(sel3, sel3 ? telaDeMovel(sel3) : null);
    }
    function telaDeMovel(id){
      var g = cena && cena.moveis[id]; if (!g) return null;
      var box = new THREE.Box3().setFromObject(g), r = canvas.getBoundingClientRect();
      var xs = [], ys = [];
      [[box.min.x, box.min.y, box.min.z], [box.max.x, box.min.y, box.min.z], [box.min.x, box.max.y, box.min.z], [box.max.x, box.max.y, box.min.z],
       [box.min.x, box.min.y, box.max.z], [box.max.x, box.min.y, box.max.z], [box.min.x, box.max.y, box.max.z], [box.max.x, box.max.y, box.max.z]].forEach(function (c) {
        var v = new THREE.Vector3(c[0], c[1], c[2]).project(camera);
        xs.push((v.x + 1) / 2 * r.width + r.left); ys.push((1 - v.y) / 2 * r.height + r.top);
      });
      var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
      return {x:(x0 + x1) / 2, y:(y0 + y1) / 2, rx:(x1 - x0) / 2, ry:(y1 - y0) / 2};
    }
    function descartar(obj){
      obj.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
    }
    function aplicarEtapa(){
      if (!cena) return;
      var G = cena.G;
      G.pisos.visible = etapa >= 1; G.estrutura.visible = etapa >= 2; G.paredes.visible = etapa >= 3; G.cobertura.visible = etapa >= 4 && teto; G.acabamento.visible = etapa >= 5; G.moveis.visible = etapa >= 5;
      var cru = etapa < 5;
      cena.raiz.traverse(function (o) {
        if (o.userData && o.userData.pronto) o.material = cru ? o.userData.cru : o.userData.pronto;
        if (o.userData && o.userData.lp) o.visible = cru;
        if (o.userData && o.userData.ferro) o.visible = etapa === 2;
      });
      sujo = true;
    }
    function aplicarTeto(){ if (cena) { cena.G.cobertura.visible = etapa >= 4 && teto; sujo = true; } }

    /* ---------- legenda (passeio) ---------- */
    var cap = document.createElement('div'); cap.className = 't3-cap'; el.appendChild(cap);
    function legenda(){
      if (modo !== 'tour' || !cena) { cap.classList.remove('show'); return; }
      var p = cena.paradas[tour.i];
      cap.innerHTML = '<span class="k">' + (tour.i + 1) + ' / ' + cena.paradas.length + ' · ' + esc(p.sub) + '</span><h3>' + esc(p.titulo) + '</h3><p>' + esc(p.frase) + '</p>';
      cap.classList.add('show');
      if (cb.parada) cb.parada(tour.i, p);
    }
    function esc(s){ return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

    /* ---------- modos ---------- */
    function setModo(m){
      if (m === modo) return;
      var prevPos = pos.clone(), prevAlvo = alvo.clone();
      modo = m;
      if (m === 'orbit') {
        /* parte da pose atual para não dar pulo */
        var d = prevPos.clone().sub(orbD.alvo); orb.dist = orbD.dist = clamp(d.length(), 3, 90);
        orb.theta = orbD.theta = Math.atan2(d.x, d.z); orb.phi = orbD.phi = clamp(Math.acos(clamp(d.y / Math.max(.001, d.length()), -1, 1)), .1, 1.5);
      } else if (m === 'walk') {
        var longe = prevPos.x < -3 || prevPos.x > cena.TL + 3 || prevPos.z < -9 || prevPos.z > cena.TP + 3 || prevPos.y > 6;
        if (longe) { walk.pos.set(cena.portaoX, 1.6, -2.2); walk.yaw = 0; walk.pitch = 0; }
        else { walk.pos.copy(prevPos); walk.pos.y = 1.6; var dir = prevAlvo.clone().sub(prevPos); walk.yaw = Math.atan2(dir.x, dir.z); walk.pitch = 0; }
      } else if (m === 'tour') {
        tour.de = {pos:prevPos.toArray(), alvo:prevAlvo.toArray()}; tour.para = cena.paradas[tour.i]; tour.t = 0; tour.olhaYaw = tour.olhaPitch = 0;
      }
      legenda(); sujo = true;
      if (cb.modo) cb.modo(m);
    }
    function irParada(i, imediato){
      if (!cena) return;
      i = clamp(i, 0, cena.paradas.length - 1);
      if (modo !== 'tour') { modo = 'tour'; if (cb.modo) cb.modo('tour'); }
      tour.de = {pos:pos.toArray(), alvo:alvo.toArray()}; tour.para = cena.paradas[i]; tour.i = i;
      tour.t = imediato || reduzMov ? 1 : 0; tour.olhaYaw = tour.olhaPitch = 0; tour.autoT = 0;
      legenda(); sujo = true;
    }
    function irAmbiente(id){ if (!cena) return; var i = cena.paradas.findIndex(function (p) { return p.id === id; }); if (i >= 0) irParada(i); }

    /* ---------- entrada ---------- */
    var ptr = {}, arrasto = null, ultimoWheel = 0;
    function on(t, ev, fn, o){ t.addEventListener(ev, fn, o); ouvintes.push([t, ev, fn, o]); }
    on(canvas, 'pointerdown', function (e) {
      canvas.focus(); ptr[e.pointerId] = {x:e.clientX, y:e.clientY, x0:e.clientX, y0:e.clientY};
      canvas.setPointerCapture(e.pointerId);
      /* pegou um móvel com o botão esquerdo → arrasta o móvel pelo piso, não a câmera */
      if (op.editar !== false && e.button === 0 && !e.shiftKey && modo !== 'tour') {
        var hm = sobMovel(e);
        if (hm) {
          var mv = M.movelDe ? M.movelDe(hm) : null, g = cena.moveis[hm];
          if (mv && g) {
            var pt = noPlano(e, g.position.y);
            arrastoMov = {id:hm, mv:mv, g:g, off:{x:(pt ? pt.x : g.position.x) - g.position.x, z:(pt ? pt.z : g.position.z) - g.position.z}, x0:mv.x, y0:mv.y, mudou:false};
            if (sel3 !== hm) selecionarMovel(hm);
          }
        }
      }
      if (Object.keys(ptr).length === 2) { var k = Object.keys(ptr); arrasto = {pinch: dist2(ptr[k[0]], ptr[k[1]]), dist: orbD.dist}; }
    });
    on(canvas, 'pointermove', function (e) {
      var p = ptr[e.pointerId]; if (!p) return;
      var dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if (arrastoMov) {
        var pt = noPlano(e, arrastoMov.g.position.y); if (!pt) return;
        var nx = Math.round((pt.x - arrastoMov.off.x) / CM / 5) * 5, nz = Math.round((pt.z - arrastoMov.off.z) / CM / 5) * 5;
        if (nx !== arrastoMov.mv.x || nz !== arrastoMov.mv.y) {
          arrastoMov.mv.x = nx; arrastoMov.mv.y = nz; arrastoMov.mudou = true;
          posicionar(arrastoMov.g, arrastoMov.mv); if (caixaSel) caixaSel.update();
          if (cb.movMove) cb.movMove(arrastoMov.mv, telaDeMovel(arrastoMov.id));
          sujo = true;
        }
        return;
      }
      var ks = Object.keys(ptr);
      if (ks.length === 2) {   /* pinça: zoom + pan */
        var a = ptr[ks[0]], b = ptr[ks[1]], d = dist2(a, b);
        if (modo === 'orbit') { orbD.dist = clamp(arrasto.dist * arrasto.pinch / Math.max(1, d), 2, 90); pan(dx * .5, dy * .5); }
        sujo = true; return;
      }
      var pan2 = e.buttons === 2 || e.buttons === 4 || e.shiftKey;
      if (modo === 'orbit') {
        if (pan2) pan(dx, dy); else { orbD.theta -= dx * .006; orbD.phi = clamp(orbD.phi - dy * .006, .08, Math.PI / 2 - .03); }
      } else if (modo === 'walk') {
        walk.yaw -= dx * .0045; walk.pitch = clamp(walk.pitch - dy * .0045, -1.2, 1.2);
      } else if (modo === 'tour') {
        tour.olhaYaw = clamp(tour.olhaYaw - dx * .004, -1.3, 1.3); tour.olhaPitch = clamp(tour.olhaPitch - dy * .004, -.9, .9);
      }
      sujo = true;
    });
    on(canvas, 'pointerup', soltar); on(canvas, 'pointercancel', soltar);
    function soltar(e){
      var p = ptr[e.pointerId]; delete ptr[e.pointerId]; arrasto = null;
      if (arrastoMov) {
        var am = arrastoMov; arrastoMov = null;
        if (am.mudou) { if (cb.movFim) cb.movFim(am.mv); }
        else if (cb.selMov) cb.selMov(sel3, telaDeMovel(sel3));
        return;
      }
      if (!p || Object.keys(ptr).length) return;
      if (Math.abs(e.clientX - p.x0) < 4 && Math.abs(e.clientY - p.y0) < 4) clique(e);
    }
    function sobMovel(e){
      if (!cena || !cena.movMeshes.length || !cena.G.moveis.visible) return null;
      var r = canvas.getBoundingClientRect();
      ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      var hits = raycaster.intersectObjects(cena.movMeshes, false);
      return hits.length ? hits[0].object.userData.mid : null;
    }
    function noPlano(e, y){
      var r = canvas.getBoundingClientRect();
      ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      var alvo = new THREE.Vector3();
      return raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -(y || 0)), alvo) ? alvo : null;
    }
    function dist2(a, b){ return Math.hypot(a.x - b.x, a.y - b.y); }
    function pan(dx, dy){
      var right = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
      right.setFromMatrixColumn(camera.matrix, 0);
      var f = orbD.dist * .0016;
      orbD.alvo.addScaledVector(right, -dx * f).addScaledVector(up, dy * f);
    }
    on(canvas, 'wheel', function (e) {
      e.preventDefault();
      if (modo === 'orbit') orbD.dist = clamp(orbD.dist * Math.exp(e.deltaY * .0012), 2, 90);
      else if (modo === 'walk') { var f = frente(walk.yaw, 0); walk.pos.addScaledVector(f, -e.deltaY * .01); limitar(); }
      else if (modo === 'tour' && !op.scroll) { var agora = performance.now(); if (agora - ultimoWheel > 650 && Math.abs(e.deltaY) > 8) { ultimoWheel = agora; irParada(tour.i + (e.deltaY > 0 ? 1 : -1)); } }
      sujo = true;
    }, {passive:false});
    on(canvas, 'contextmenu', function (e) { e.preventDefault(); });
    on(canvas, 'dblclick', function (e) {
      var hit = sob(e); if (hit && hit.userData.ambId) irAmbiente(hit.userData.ambId);
    });
    on(canvas, 'keydown', function (e) {
      teclas[e.key.toLowerCase()] = true;
      if (modo === 'tour' && !op.scroll) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); irParada(tour.i + 1); }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); irParada(tour.i - 1); }
        if (e.key === 'Home') irParada(0); if (e.key === 'End') irParada(cena.paradas.length - 1);
      }
      if (modo === 'walk' && ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].indexOf(e.key.toLowerCase()) >= 0) e.preventDefault();
    });
    on(canvas, 'keyup', function (e) { teclas[e.key.toLowerCase()] = false; });
    on(canvas, 'blur', function () { teclas = {}; });
    function clique(e){
      if (op.editar !== false && sel3) { selecionarMovel(null); }   /* clicou fora: solta a seleção */
      var hit = sob(e);
      if (hit && hit.userData.ambId && cb.clique) cb.clique(hit.userData.ambId);
      if (hit && hit.userData.ambId && modo !== 'walk' && op.cliqueVai !== false) irAmbiente(hit.userData.ambId);
    }
    function sob(e){
      if (!cena) return null;
      var r = canvas.getBoundingClientRect();
      ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      var hits = raycaster.intersectObjects(cena.pisos, false);
      return hits.length ? hits[0].object : null;
    }
    function frente(yaw, pitch){ return new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)); }
    function limitar(){ if (!cena) return; walk.pos.x = clamp(walk.pos.x, -3, cena.TL + 3); walk.pos.z = clamp(walk.pos.z, -9, cena.TP + 3); walk.pos.y = 1.6; }

    /* ---------- scroll externo (apresentação): progresso 0..N-1 ---------- */
    var progresso = null;
    function setProgresso(p){ progresso = p; sujo = true; }

    /* ---------- laço ---------- */
    var ultimo = performance.now();
    function quadroAnim(agora){
      if (!vivo) return;
      requestAnimationFrame(quadroAnim);
      var dt = Math.max(0, Math.min(.05, (agora - ultimo) / 1000)); ultimo = agora;   /* nunca negativo: relógio virtual do headless */
      if (!cena) return;
      var k = 1 - Math.exp(-dt * 9);
      if (modo === 'orbit') {
        orb.theta += (orbD.theta - orb.theta) * k; orb.phi += (orbD.phi - orb.phi) * k; orb.dist += (orbD.dist - orb.dist) * k; orb.alvo.lerp(orbD.alvo, k);
        pos.set(orb.alvo.x + orb.dist * Math.sin(orb.phi) * Math.sin(orb.theta), orb.alvo.y + orb.dist * Math.cos(orb.phi), orb.alvo.z + orb.dist * Math.sin(orb.phi) * Math.cos(orb.theta));
        if (pos.y < .4) pos.y = .4;
        alvo.copy(orb.alvo);
        if (Math.abs(orbD.theta - orb.theta) > 1e-4 || Math.abs(orbD.dist - orb.dist) > 1e-3 || orb.alvo.distanceTo(orbD.alvo) > 1e-3) sujo = true;
      } else if (modo === 'walk') {
        var v = (teclas.shift ? 4.5 : 2.3) * dt, f = frente(walk.yaw, 0), r = new THREE.Vector3(f.z, 0, -f.x);
        var mov = false;
        if (teclas.w || teclas.arrowup) { walk.pos.addScaledVector(f, v); mov = true; }
        if (teclas.s || teclas.arrowdown) { walk.pos.addScaledVector(f, -v); mov = true; }
        if (teclas.a || teclas.arrowleft) { walk.pos.addScaledVector(r, v); mov = true; }
        if (teclas.d || teclas.arrowright) { walk.pos.addScaledVector(r, -v); mov = true; }
        if (mov) { limitar(); sujo = true; }
        pos.copy(walk.pos); alvo.copy(walk.pos).add(frente(walk.yaw, walk.pitch));
      } else if (modo === 'tour') {
        var P = cena.paradas;
        if (progresso !== null) {   /* dirigido pelo scroll */
          var pr = clamp(progresso, 0, P.length - 1), i0 = Math.floor(pr), i1 = Math.min(P.length - 1, i0 + 1), fr = ease(pr - i0);
          pos.fromArray(P[i0].pos).lerp(new THREE.Vector3().fromArray(P[i1].pos), fr);
          alvo.fromArray(P[i0].alvo).lerp(new THREE.Vector3().fromArray(P[i1].alvo), fr);
          var ni = Math.round(pr); if (ni !== tour.i) { tour.i = ni; legenda(); }
        } else {
          if (tour.t < 1) { tour.t = Math.min(1, tour.t + dt / 1.7); sujo = true; }
          var e = ease(tour.t), de = tour.de, pa = tour.para;
          if (de && tour.t < 1) {
            pos.fromArray(de.pos).lerp(new THREE.Vector3().fromArray(pa.pos), e);
            alvo.fromArray(de.alvo).lerp(new THREE.Vector3().fromArray(pa.alvo), e);
            var L = new THREE.Vector3().fromArray(de.pos).distanceTo(new THREE.Vector3().fromArray(pa.pos));
            if (L > 6) pos.y += Math.sin(tour.t * Math.PI) * Math.min(3, L * .12);   /* arco leve em voos longos */
          } else { pos.fromArray(pa.pos); alvo.fromArray(pa.alvo); }
          if (tour.auto) { tour.autoT += dt; if (tour.autoT > 4.2) { tour.autoT = 0; irParada((tour.i + 1) % P.length); } sujo = true; }
        }
        if (tour.olhaYaw || tour.olhaPitch) {   /* olhar em volta com o mouse, sem sair da parada */
          var d = alvo.clone().sub(pos), len = d.length(), yaw = Math.atan2(d.x, d.z) + tour.olhaYaw, pitch = clamp(Math.asin(clamp(d.y / len, -1, 1)) + tour.olhaPitch, -1.3, 1.3);
          alvo.copy(pos).addScaledVector(frente(yaw, pitch), len);
        }
      }
      /* dentro da casa a laje esconde o sol: reforça a luz ambiente */
      var dentroCasa = modo !== 'orbit' && pos.y < cena.H && pos.x > 0 && pos.x < cena.TL && pos.z > 0 && pos.z < cena.TP;
      var ambAlvo = dentroCasa ? 1.7 : .28; if (!luzManual) amb.intensity += (ambAlvo - amb.intensity) * k;
      if (Math.abs(ambAlvo - amb.intensity) > .01) sujo = true;
      /* água ondula devagar */
      if (etapa >= 4) cena.G.acabamento.traverse(function (o) { if (o.userData.agua) { o.position.y = -.25 + Math.sin(agora * .0012) * .012; sujo = true; } });

      camera.position.copy(pos); camera.lookAt(alvo);
      if (sujo) {
        renderer.render(scene, camera); sujo = false;
        if (sel3 && !arrastoMov && cb.selPos) cb.selPos(sel3, telaDeMovel(sel3));
      }
    }
    function redimensionar(){
      var w = el.clientWidth || 300, h = el.clientHeight || 200;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); sujo = true;
    }
    var ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(redimensionar) : null;
    if (ro) ro.observe(el); else on(window, 'resize', redimensionar);

    reconstruir(); redimensionar();
    if (modo === 'tour') { var p0 = cena.paradas[0]; pos.fromArray(p0.pos); alvo.fromArray(p0.alvo); legenda(); }
    else if (modo === 'walk') { pos.copy(walk.pos); alvo.copy(walk.pos).add(frente(0, 0)); }
    else { orb.dist = orbD.dist = Math.max(cena.casa.w, cena.casa.d) * 1.25 + 5; pos.set(orb.alvo.x + orb.dist * Math.sin(orb.phi) * Math.sin(orb.theta), orb.alvo.y + orb.dist * Math.cos(orb.phi), orb.alvo.z + orb.dist * Math.sin(orb.phi) * Math.cos(orb.theta)); alvo.copy(orb.alvo); }
    requestAnimationFrame(quadroAnim);

    return {
      get modo(){ return modo; }, setModo:setModo,
      get etapa(){ return etapa; }, setEtapa:function (n) { etapa = clamp(n | 0, 0, 5); aplicarEtapa(); if (cb.etapa) cb.etapa(etapa); },
      get selMovel(){ return sel3; }, selecionarMovel:selecionarMovel, telaDeMovel:telaDeMovel,
      get teto(){ return teto; }, setTeto:function (v) { teto = !!v; aplicarTeto(); },
      get parada(){ return tour.i; }, get paradas(){ return cena ? cena.paradas : []; },
      irParada:irParada, irAmbiente:irAmbiente, proxima:function () { irParada(tour.i + 1); }, anterior:function () { irParada(tour.i - 1); },
      get auto(){ return tour.auto; }, setAuto:function (v) { tour.auto = !!v; tour.autoT = 0; sujo = true; },
      setProgresso:setProgresso,
      luz:function (a, b, c, d) { luzManual = true; sol.intensity = a; hemi.intensity = b; amb.intensity = c; if (d !== undefined) sol.castShadow = !!d; sujo = true; }, _cena:function () { return cena; },
      atualizar:reconstruir,
      foto:function () { renderer.render(scene, camera); return canvas.toDataURL('image/png'); },
      desmontar:function () {
        vivo = false; if (ro) ro.disconnect();
        ouvintes.forEach(function (o) { o[0].removeEventListener(o[1], o[2], o[3]); });
        if (caixaSel) scene.remove(caixaSel);
        if (cena) { scene.remove(cena.raiz); descartar(cena.raiz); }
        renderer.dispose(); try { renderer.forceContextLoss(); } catch (e) {}
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas); if (cap.parentNode) cap.parentNode.removeChild(cap);
      }
    };
  }

  /* ---------- seção de passeio dirigida pelo scroll (apresentação / export) ---------- */
  function passeio(container, op){
    op = op || {};
    var n = paradas(M.proj, analise(M.proj)).length;
    container.classList.add('tp');
    container.style.height = (n * 100) + 'vh';
    var sticky = document.createElement('div'); sticky.className = 'tp-sticky'; container.appendChild(sticky);
    var inst = montar(sticky, {modo:'tour', scroll:true, cliqueVai:false, editar:false});
    if (!inst) return null;
    var dots = document.createElement('div'); dots.className = 'tp-dots'; sticky.appendChild(dots);
    for (var i = 0; i < n; i++) { var d = document.createElement('i'); dots.appendChild(d); }
    var dica = document.createElement('div'); dica.className = 'tp-dica'; dica.textContent = 'Role para passear pela casa'; sticky.appendChild(dica);
    function tick(){
      var r = container.getBoundingClientRect(), vh = sticky.clientHeight || innerHeight;
      var p = -r.top / Math.max(1, r.height - vh) * (n - 1);
      inst.setProgresso(p);
      var i = Math.round(clamp(p, 0, n - 1));
      for (var k = 0; k < dots.children.length; k++) dots.children[k].classList.toggle('on', k === i);
      dica.classList.toggle('off', p > .15);
    }
    var scroller = op.scroller || window;
    scroller.addEventListener('scroll', tick, {passive:true}); window.addEventListener('resize', tick);
    tick(); setTimeout(tick, 50);
    return {inst:inst, desmontar:function () { scroller.removeEventListener('scroll', tick); window.removeEventListener('resize', tick); inst.desmontar(); }};
  }

  return {analise:analise, paradas:paradas, quadro:quadro, frase:frase, montar:montar, passeio:passeio, ETAPAS:ETAPAS, coberto:coberto};
}

var TRES = (typeof THREE !== 'undefined' && typeof M !== 'undefined') ? TRES_ENGINE(THREE, M) : null;
