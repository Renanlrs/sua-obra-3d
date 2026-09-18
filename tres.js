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
  function analise(proj, pav){
    pav = pav || 0;
    var ambs = proj.ambientes.filter(function (r) { return coberto(r) && (r.pav || 0) === pav; }), H = proj.peDireito, t = proj.terreno;
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
    var OVI = proj.aberturas || {};
    Object.keys(portas).forEach(function (k) {
      var pc = pares[k], m = (pc.p + pc.q) / 2, oi = OVI['int|' + k];
      pc.chave = 'int|' + k;
      if (oi && oi.tipo === 'nenhuma') { delete portas[k]; return; }   /* porta interna excluída pelo usuário */
      var pw0 = Math.max(60, Math.min(pc.len - 20, (oi && oi.pw) || 80)), ph0 = Math.min(H - 15, Math.max(180, (oi && oi.palt) || 210));
      pc.ab.push({s: m - pw0 / 2, e: m + pw0 / 2, z0: 0, z1: ph0, tipo: 'porta', chave: pc.chave});
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
    /* chave estável de cada parede externa: ambiente | lado | índice na sequência daquele lado — é a que
       proj.aberturas usa para guardar o que o usuário decidiu (excluir/mudar janela, pôr porta, entrada aqui) */
    externas.forEach(function (pc) {
      var r = pc.A || pc.B, lado = ladoDe(pc, r);
      var irmas = externas.filter(function (x) { return (x.A || x.B) === r && ladoDe(x, r) === lado; }).sort(function (a, b) { return a.p - b.p; });
      pc.chave = r.id + '|' + lado + '|' + irmas.indexOf(pc); pc.lado = lado;
    });
    var OV = proj.aberturas || {};
    var entrada = null, melhor = -1;
    var pedida = proj.entradaEm ? externas.filter(function (pc) { return pc.chave === proj.entradaEm && pc.len >= 100; })[0] : null;
    if (pedida) entrada = {pc:pedida, r:pedida.A || pedida.B};
    else externas.forEach(function (pc) {
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
    if (pav > 0) { entrada = null; garagem = null; }   /* andar de cima: sem porta da rua nem portão — chega-se pela escada */
    externas.forEach(function (pc) {
      var r = pc.A || pc.B, lado = ladoDe(pc, r), L = pc.len, jan = null;
      if (garagem === pc) { var gw = Math.min(L - 40, 280); pc.ab.push({s:(pc.p + pc.q) / 2 - gw / 2, e:(pc.p + pc.q) / 2 + gw / 2, z0:0, z1:Math.min(220, H - 20), tipo:'portao'}); return; }
      if (entrada && entrada.pc === pc) {
        var Fp = fachadaDe(proj), pw = Math.max(70, Math.min(L - 40, Math.round((Fp.portaLargura || .9) * 100))), ph = Math.max(200, Math.min(H - 15, Math.round((Fp.portaAltura || 2.1) * 100)));
        var cx = L >= 300 ? Math.max(pc.p + pw / 2 + 15, pc.p + L * 0.3) : (pc.p + pc.q) / 2;
        cx = Math.min(cx, pc.q - pw / 2 - 15);
        pc.ab.push({s:cx - pw / 2, e:cx + pw / 2, z0:0, z1:ph, tipo:'entrada'});
        if (L >= 300) { var jw = Math.min(L * 0.3, 160), jx = pc.p + L * 0.72; if (jx - jw / 2 > cx + pw / 2 + 20) pc.ab.push({s:jx - jw / 2, e:jx + jw / 2, z0:100, z1:Math.min(230, H - 40), tipo:'janela'}); }
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
    /* o que o usuário decidiu parede por parede (clicando no 3D) — depois do automático, antes das caixas */
    externas.forEach(function (pc) {
      var o = OV[pc.chave]; if (!o) return;
      var jans = pc.ab.filter(function (ab) { return ab.tipo === 'janela'; }), base = jans[0];
      if (o.tipo === 'nenhuma') { pc.ab = pc.ab.filter(function (ab) { return ab.tipo !== 'janela'; }); return; }
      if (o.tipo === 'porta') {   /* porta externa nesta parede (não é a entrada principal) */
        pc.ab = pc.ab.filter(function (ab) { return ab.tipo !== 'janela'; });
        if (!pc.ab.some(function (ab) { return ab.tipo === 'entrada' || ab.tipo === 'portao'; })) { var mp = (pc.p + pc.q) / 2, pw2 = Math.min(pc.len - 30, o.w || 90); pc.ab.push({s:mp - pw2 / 2, e:mp + pw2 / 2, z0:0, z1:Math.min(H - 15, o.alt || 210), tipo:'entrada', chave:pc.chave, secundaria:true}); }
        return;
      }
      /* janela(s) com medida/tipo/vidro próprios */
      var n = Math.max(1, Math.min(4, o.n || 1)), w = o.w || (base ? base.e - base.s : 120), z0 = o.peitoril != null ? o.peitoril : (base ? base.z0 : 100), alt = o.alt || (base ? base.z1 - base.z0 : 120);
      var z1 = Math.min(H - 10, z0 + alt); if (z1 - z0 < 30) z0 = Math.max(0, z1 - 30);
      pc.ab = pc.ab.filter(function (ab) { return ab.tipo !== 'janela'; });
      /* trechos livres (sem porta), com folga de 15 cm; as janelas se espalham no maior */
      var livres = [[pc.p + 15, pc.q - 15]];
      pc.ab.forEach(function (ab) { var out = []; livres.forEach(function (t) { if (ab.e + 15 <= t[0] || ab.s - 15 >= t[1]) { out.push(t); return; } if (ab.s - 15 > t[0]) out.push([t[0], ab.s - 15]); if (ab.e + 15 < t[1]) out.push([ab.e + 15, t[1]]); }); livres = out; });
      var tr = livres.sort(function (a, b) { return (b[1] - b[0]) - (a[1] - a[0]); })[0]; if (!tr) return;
      var span = tr[1] - tr[0]; w = Math.min(w, Math.floor((span - (n - 1) * 20) / n)); if (w < 30) return;
      var passo = span / n;
      for (var i = 0; i < n; i++) { var c = tr[0] + passo * (i + .5); pc.ab.push({s:c - w / 2, e:c + w / 2, z0:z0, z1:z1, tipo:'janela', janela:o.janela, vidro:o.vidro, chave:pc.chave}); }
    });
    externas.forEach(function (pc) {
      var o = OV[pc.chave];
      pc.ab.forEach(function (ab) {
        if (!ab.chave) ab.chave = pc.chave;
        if (o && (ab.tipo === 'entrada' || ab.tipo === 'portao') && (o.pw || o.palt)) {   /* tamanho só desta porta/portão */
          var c = (ab.s + ab.e) / 2, w = Math.max(60, Math.min(pc.len - 30, o.pw || (ab.e - ab.s)));
          ab.s = Math.max(pc.p + 15, c - w / 2); ab.e = ab.s + w; if (ab.e > pc.q - 15) { ab.e = pc.q - 15; ab.s = ab.e - w; }
          if (o.palt) ab.z1 = Math.min(H - 15, Math.max(180, o.palt));
        }
      });
    });
    /* ambiente isolado (sem vizinho) ganha porta externa na maior peça */
    ambs.forEach(function (r) {
      if (portaDe[r.id] || (entrada && entrada.r === r)) return;
      var cand = externas.filter(function (pc) { return (pc.A || pc.B) === r && pc.len >= 100; }).sort(function (a, b) { return b.len - a.len; })[0];
      if (!cand) return;
      cand.ab = cand.ab.filter(function (ab) { return ab.tipo !== 'janela'; });
      var m = (cand.p + cand.q) / 2;
      if (pav > 0) cand.ab.push({s:m - 60, e:m + 60, z0:100, z1:Math.min(230, H - 40), tipo:'janela'});   /* em cima, ambiente isolado ganha janela */
      else cand.ab.push({s:m - 40, e:m + 40, z0:0, z1:210, tipo:'entrada'});
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
    var inicio = entrada ? entrada.r : (garagem ? (garagem.A || garagem.B) : (ambs.filter(function (r) { return r.tipo === 'circulacao'; }).sort(function (a, b) { return b.w * b.h - a.w * a.h; })[0] || ambs[0]));
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

    return {ambs:ambs, pecas:pecas, externas:externas, entrada:entrada, garagem:garagem, portaDe:portaDe, lado:lado, ordem:ordem, H:H, terreno:t, pav:pav};
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
  function paradas(proj, an, andares){
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
      var pp = pontoPraia(proj, r, 'frente');   /* salão com piscina: a câmera fica na praia, olhando as raias */
      if (pp) { p = pp.pos; a = pp.alvo; }
      out.push({id:r.id, titulo:r.nome, sub:M.fmtM2(M.areaOf(r)) + ' · ' + M.fmtM(r.w) + ' × ' + M.fmtM(r.h),
        frase:frase(r), pos:[p.x, 1.55, p.z], alvo:[a.x, pp ? 0.4 : 1.25, a.z], interno:true});
    });
    (andares || []).forEach(function (d) {   /* andar de cima: mesmos enquadramentos, subindo a laje */
      d.an.ordem.forEach(function (r) {
        var q = quadro(r, d.an.lado[r.id]), largo = q.W > 1.5 * q.D;
        var u = largo ? q.W * 0.14 : q.W / 2, ua = largo ? q.W * 0.62 : q.W / 2;
        var pequeno = q.W < 1.9 || q.D < 2.3, v0 = pequeno ? -0.35 : Math.min(0.55, q.D * 0.18), alvoV = Math.max(v0 + 1, q.D * 0.85);
        var p = q.mundo(u, v0), a = q.mundo(ua, alvoV);
        out.push({id:r.id, titulo:r.nome, sub:(d.pav === 1 ? '1º andar' : d.pav + 'º andar') + ' · ' + M.fmtM2(M.areaOf(r)) + ' · ' + M.fmtM(r.w) + ' × ' + M.fmtM(r.h),
          frase:frase(r), pos:[p.x, 1.55 + d.yb, p.z], alvo:[a.x, 1.25 + d.yb, a.z], interno:true, pav:d.pav});
      });
    });
    proj.ambientes.filter(function (a) { return !coberto(a); }).forEach(function (r) {
      /* área externa: câmera no lado mais próximo da casa, olhando para o fundo dela */
      var rx = (r.x + r.w / 2) * CM, rz = (r.y + r.h / 2) * CM, dx = rx - cx, dz = rz - cz, lado;
      if (Math.abs(dx) * (by2 - by) > Math.abs(dz) * (bx2 - bx)) lado = dx < 0 ? 'dir' : 'esq'; else lado = dz < 0 ? 'fundo' : 'frente';
      var q = quadro(r, lado), p = q.mundo(q.W / 2, -0.9), a = q.mundo(q.W / 2, q.D * 0.8);
      var salao = r.tipo === 'agua' ? proj.ambientes.filter(function (b) { return b !== r && coberto(b) && (b.pav || 0) === (r.pav || 0) && piscinasDentro(proj, b).indexOf(r) >= 0; })[0] : null;
      var pp = salao ? pontoPraia(proj, salao, 'fundo') : null;   /* piscina coberta: vista da praia do fundo, de volta para a entrada */
      if (pp) { p = pp.pos; a = pp.alvo; }
      out.push({id:r.id, titulo:r.nome, sub:M.fmtM2(M.areaOf(r)) + ' · ' + M.fmtM(r.w) + ' × ' + M.fmtM(r.h),
        frase:frase(r), pos:[p.x, 1.65, p.z], alvo:[a.x, pp ? 0.2 : 0.6, a.z], externo:pp ? false : true, interno:!!pp});
    });
    var raio = Math.max((bx2 - bx) * CM, (by2 - by) * CM * .8) + 4;
    out.push({id:'aerea', titulo:'O conjunto', sub:M.fmtM2(M.areaConstruida()) + ' construídos · ' + M.fmtPct(M.ocupacao()) + ' do terreno',
      frase:'Tudo no lugar, visto de cima.', pos:[cx + raio * 0.95, raio * 0.95, cz - raio * 0.75], alvo:[cx, 0.5, cz], externo:true, aerea:true});
    return out;
  }

  /* câmera na praia de um salão com piscina (frente ou fundo), olhando ao longo das raias — em metros */
  function pontoPraia(proj, r, lado){
    var pis = piscinasDentro(proj, r); if (!pis.length) return null;
    var pw = pis[0], fr = pw.y - r.y, fu = r.y + r.h - pw.y - pw.h, usaFrente = lado === 'frente' ? fr >= 40 || fr >= fu : !(fu >= 40 || fu >= fr);
    var praia = usaFrente ? fr : fu, zc = usaFrente ? r.y + Math.max(25, praia * .5) : r.y + r.h - Math.max(25, praia * .5);
    var xc = (pw.x + pw.w / 2) * CM;
    return {pos:{x:xc, z:zc * CM}, alvo:{x:xc, z:(usaFrente ? pw.y + pw.h * .75 : pw.y + pw.h * .25) * CM}};
  }

  /* ============================ FACHADA ============================
     A configuração mora em proj.fachada; o que faltar vem do preset do estilo. */
  var FACHADA_PRESETS = {
    moderno:      {rot:'Moderno',       desc:'Platibanda, ripado de madeira, esquadrias pretas', cobertura:'platibanda', telha:'concreto', corParede:'#F2EFE8', corDestaque:'#2B2F33', revestimento:'ripado', esquadria:'preto', portao:'ripado', muro:'baixo', jardim:true, marquise:true, iluminacao:true},
    classico:     {rot:'Clássico',      desc:'Telhado 4 águas cerâmico, esquadrias brancas',     cobertura:'telhado4',   telha:'ceramica', corParede:'#F6F1E4', corDestaque:'#B7B0A3', revestimento:'nenhum', esquadria:'branco', portao:'grade', muro:'baixo', jardim:true, marquise:false, iluminacao:true},
    contemporaneo:{rot:'Contemporâneo', desc:'Cimento queimado, volumes pretos, muro alto',      cobertura:'platibanda', telha:'concreto', corParede:'#D9D9D4', corDestaque:'#1F2326', revestimento:'cimento', esquadria:'preto', portao:'chapa', muro:'alto', jardim:false, marquise:true, iluminacao:true},
    rustico:      {rot:'Rústico',       desc:'Telhado 2 águas, pedra e madeira',                 cobertura:'telhado2',   telha:'ceramica', corParede:'#EFE3CF', corDestaque:'#8B5E3C', revestimento:'pedra', esquadria:'madeira', portao:'ripado', muro:'baixo', jardim:true, marquise:false, iluminacao:true},
    industrial:   {rot:'Industrial',    desc:'Telhado metálico, cimento, portão de chapa, muro alto', cobertura:'telhado2', telha:'metalica', corParede:'#B9BDC1', corDestaque:'#3A3F45', revestimento:'cimento', esquadria:'preto', portao:'chapa', muro:'alto', jardim:false, marquise:false, iluminacao:true},
    minimalista:  {rot:'Minimalista',   desc:'Branco total, platibanda, muro de vidro, sem enfeite', cobertura:'platibanda', telha:'concreto', corParede:'#F7F7F5', corDestaque:'#E4E4E0', revestimento:'nenhum', esquadria:'branco', portao:'chapa', muro:'vidro', jardim:false, marquise:false, iluminacao:true},
    mediterraneo: {rot:'Mediterrâneo',  desc:'Telhado 4 águas cerâmico, terracota, madeira, vasos', cobertura:'telhado4', telha:'ceramica', corParede:'#F1E3C8', corDestaque:'#B5533A', revestimento:'nenhum', esquadria:'madeira', portao:'grade', muro:'baixo', jardim:true, marquise:false, iluminacao:true},
    tropical:     {rot:'Tropical',      desc:'Telhado 2 águas, ripado, pergolado e muito verde',   cobertura:'telhado2',   telha:'ceramica', corParede:'#F4EFE2', corDestaque:'#6B4A2B', revestimento:'ripado', esquadria:'madeira', portao:'ripado', muro:'baixo', jardim:true, marquise:false, iluminacao:true}
  };
  /* campos que não dependem do estilo (comercial e extras) */
  var FACHADA_EXTRA = {vitrine:false, pergolado:false, letreiro:'', letreiroEstilo:'led', letreiroCor:'#22B8D6', letreiroLuz:true, letreiroPos:'parede', totem:false,
    /* detalhe fino (15/09): janelas, vidro, porta de entrada, portão da garagem, cores livres e a frente da casa */
    janela:'correr', vidro:'incolor', moldura:false, gradeJanela:false, brise:false,
    porta:'madeira', portaCor:'', arandelas:false, vasos:false, garagem:'basculante',
    esquadriaCor:'', portaoCor:'', muroCor:'', pisoFrente:'concreto',
    /* porta: medida da abertura (m; 0 = padrão 0,90 × 2,10) · letreiro: formato, tamanho, fonte, subtítulo, fundo */
    portaLargura:0, portaAltura:0,
    letreiroFormato:'retangular', letreiroTam:'m', letreiroLargura:0, letreiroAltura:0, letreiroFonte:'sans', letreiroSub:'', letreiroFundoCor:'',
    /* placas publicitárias (18/09): bandeira lateral, placa no muro, faixa/banner com texto próprio, adesivo na vitrine; letreiroPos ganha 'topo' */
    bandeira:false, placaMuro:false, faixa:'', faixaCor:'#E4574F', adesivo:false};
  var LETREIRO_POS = {parede:'Na parede', marquise:'Sobre a marquise', topo:'No topo (outdoor)'};
  var JANELAS = {correr:'De correr', fixa:'Vidro fixo', guilhotina:'Guilhotina', basculante:'Basculante', veneziana:'Veneziana', quadriculada:'Quadriculada'};
  var VIDROS = {incolor:'Incolor', fume:'Fumê', verde:'Verde', espelhado:'Espelhado'};
  var PORTAS = {madeira:'Madeira', pivotante:'Pivotante', vidro:'De vidro', dupla:'Dupla', ripada:'Ripada', aco:'Aço'};
  /* portas de loja / comércio (a abertura pode ser bem mais larga: portaLargura) */
  var PORTAS_LOJA = {enrolar:'De enrolar', subir:'De subir (basculante)', correr:'Vidro de correr (automática)', vidroDupla:'Vidro 2 folhas', gradeLoja:'Grade pantográfica', articulada:'Aço articulada'};
  var LETREIRO_FORMATOS = {retangular:'Retangular', arredondado:'Arredondado', redondo:'Redondo', oval:'Oval', faixa:'Faixa (frente toda)'};
  var LETREIRO_TAMS = {p:'P', m:'M', g:'G', gg:'GG'};
  var LETREIRO_FATOR = {p:.7, m:1, g:1.4, gg:1.9};
  var LETREIRO_FONTES = {sans:'Moderna', serif:'Clássica', script:'Manuscrita', condensada:'Condensada', display:'Impacto'};
  var LETREIRO_CSSFONT = {sans:'Inter, Arial, sans-serif', serif:'Georgia, "Times New Roman", serif', script:'"Segoe Script", "Brush Script MT", cursive', condensada:'"Arial Narrow", "Roboto Condensed", sans-serif', display:'Impact, "Arial Black", sans-serif'};
  var GARAGENS = {basculante:'Basculante', enrolar:'De enrolar', ripado:'Ripado', vidro:'Vidro'};
  var PISOS_FRENTE = {concreto:'Concreto', pedra:'Pedra', deck:'Deck', intertravado:'Intertravado', grama:'Só grama'};
  function fachadaDe(proj){
    var f = proj.fachada || {}, pr = FACHADA_PRESETS[f.estilo] || FACHADA_PRESETS.moderno, out = {estilo: f.estilo || 'moderno'};
    for (var k in pr) out[k] = (k in f) ? f[k] : pr[k];
    for (var k2 in FACHADA_EXTRA) out[k2] = (k2 in f) ? f[k2] : FACHADA_EXTRA[k2];
    out.logo = proj.logo || '';
    if (!('pergolado' in f) && out.estilo === 'tropical') out.pergolado = true;
    if (!('vasos' in f) && (out.estilo === 'mediterraneo' || out.estilo === 'tropical')) out.vasos = true;
    if (!('moldura' in f) && out.estilo === 'mediterraneo') out.moldura = true;
    out.numero = f.numero || '';
    return out;
  }
  /* ---- criar por prompt: texto em português → escolhas de fachada (regras, sem IA, sem internet) ---- */
  var CORES_NOME = {branco:'#F2EFE8', branca:'#F2EFE8', 'off white':'#F6F1E4', bege:'#EFE3CF', areia:'#EFE3CF', creme:'#F6F1E4', cinza:'#D9D9D4', chumbo:'#6B7885', grafite:'#2B2F33', preto:'#1F2326', preta:'#1F2326',
    azul:'#2F5D8A', verde:'#4E9A5D', terracota:'#C4553B', vermelho:'#C4553B', vermelha:'#C4553B', laranja:'#D9722B', amarelo:'#E0B44C', amarela:'#E0B44C', roxa:'#6B4E9E', dourada:'#C9A227', lilas:'#A98BD6', vinho:'#7A2E3B', bordo:'#7A2E3B', coral:'#E8735A', salmao:'#F0A08A', mostarda:'#C9A227', oliva:'#7C8A4E', petroleo:'#1F4E5A', gelo:'#EEF2F5', nude:'#E8D7C3', caramelo:'#B0742F', prata:'#C9CED3', prateado:'#C9CED3', prateada:'#C9CED3', 'azul marinho':'#1B2A4A', marinho:'#1B2A4A', 'azul claro':'#9FB4C4', 'verde claro':'#A9C7A2', 'verde escuro':'#2F5E3C', 'cinza escuro':'#3D4A56', 'cinza claro':'#E8ECEF', marrom:'#8B5E3C', madeira:'#8B5E3C', turquesa:'#1E7E96', ciano:'#22B8D6', rosa:'#D96AA0', roxo:'#6B4E9E', dourado:'#C9A227'};
  function norm(t){ return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ' ').replace(/[\u0300-\u036f]/g, ''); }
  function fachadaPorPrompt(txt, atual){
    var t = ' ' + String(txt || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') + ' ', f = {}, lidos = [];
    function tem(){ for (var i = 0; i < arguments.length; i++) if (t.indexOf(' ' + arguments[i]) >= 0 || t.indexOf(arguments[i]) >= 0) return true; return false; }
    function corApos(){   /* cor citada logo depois de uma das palavras */
      for (var i = 0; i < arguments.length; i++) {
        var m = t.match(new RegExp(arguments[i] + '[a-z]*\\s+(?:de\\s+|em\\s+|na\\s+cor\\s+)?([a-z]+(?:\\s+(?:white|marinho|claro|escuro))?)'));
        if (m && CORES_NOME[m[1]]) return CORES_NOME[m[1]];
        /* uma palavra no meio: "porta pivotante azul", "muro alto cinza" */
        m = t.match(new RegExp(arguments[i] + '[a-z]*\\s+(?:de\\s+|em\\s+)?[a-z]+\\s+([a-z]+(?:\\s+(?:white|marinho|claro|escuro))?)'));
        if (m && CORES_NOME[m[1]]) return CORES_NOME[m[1]];
      }
      return null;
    }
    /* estilo */
    if (tem('modern')) { f.estilo = 'moderno'; lidos.push('estilo moderno'); }
    else if (tem('classic', 'colonial', 'tradicional')) { f.estilo = 'classico'; lidos.push('estilo clássico'); }
    else if (tem('contempor', 'industrial', 'minimal')) { f.estilo = 'contemporaneo'; lidos.push('estilo contemporâneo'); }
    else if (tem('rustic', 'campo', 'chale', 'sitio')) { f.estilo = 'rustico'; lidos.push('estilo rústico'); }
    /* cobertura e telha */
    if (tem('platibanda', 'laje', 'telhado embutido', 'sem telhado')) { f.cobertura = 'platibanda'; lidos.push('platibanda'); }
    else if (tem('4 aguas', 'quatro aguas')) { f.cobertura = 'telhado4'; lidos.push('telhado 4 águas'); }
    else if (tem('2 aguas', 'duas aguas')) { f.cobertura = 'telhado2'; lidos.push('telhado 2 águas'); }
    else if (tem('telhado')) { var prC = FACHADA_PRESETS[f.estilo] ? FACHADA_PRESETS[f.estilo].cobertura : 'platibanda'; f.cobertura = prC !== 'platibanda' ? prC : 'telhado4'; lidos.push('telhado'); }
    if (tem('ceramic', 'barro', 'colonial')) { f.telha = 'ceramica'; if (!f.cobertura) f.cobertura = 'telhado4'; lidos.push('telha cerâmica'); }
    if (tem('metalic', 'zinco', 'sanduiche')) { f.telha = 'metalica'; if (!f.cobertura) f.cobertura = 'telhado2'; lidos.push('telha metálica'); }
    if (tem('telha de concreto', 'telha concreto')) { f.telha = 'concreto'; lidos.push('telha de concreto'); }
    /* revestimento */
    if (tem('ripad', 'ripa', 'madeira na frente', 'brise')) { f.revestimento = 'ripado'; lidos.push('ripado'); }
    else if (tem('pedra', 'canjiquinha', 'sao tome')) { f.revestimento = 'pedra'; lidos.push('pedra'); }
    else if (tem('tijol', 'tijolinho')) { f.revestimento = 'tijolo'; lidos.push('tijolinho'); }
    else if (tem('cimento queimado', 'concreto aparente', 'cimento')) { f.revestimento = 'cimento'; lidos.push('cimento queimado'); }
    else if (tem('sem revestimento', 'so pintura', 'so pintada', 'apenas pintura')) { f.revestimento = 'nenhum'; lidos.push('sem revestimento'); }
    /* cores */
    var cp = corApos('parede', 'pintad', 'pintur', 'casa', 'fachada', 'cor');
    if (cp) { f.corParede = cp; lidos.push('parede ' + cp); }
    var cd = corApos('destaque', 'detalhe', 'volume', 'marquise');
    if (cd) { f.corDestaque = cd; lidos.push('destaque ' + cd); }
    /* esquadrias, portão, muro */
    var ce = corApos('esquadria', 'janela', 'caixilho');
    if (ce === '#1F2326' || ce === '#2B2F33' || tem('esquadria preta', 'esquadrias pretas', 'janelas pretas')) { f.esquadria = 'preto'; lidos.push('esquadrias pretas'); }
    else if (ce === '#F2EFE8' || tem('esquadria branca', 'esquadrias brancas', 'janelas brancas')) { f.esquadria = 'branco'; lidos.push('esquadrias brancas'); }
    else if (ce === '#8B5E3C' || tem('esquadria de madeira', 'esquadrias de madeira', 'janelas de madeira')) { f.esquadria = 'madeira'; lidos.push('esquadrias de madeira'); }
    if (tem('portao de grade', 'portao grade', 'portao gradeado', 'grade')) { f.portao = 'grade'; lidos.push('portão de grade'); }
    else if (tem('portao ripado', 'portao de madeira', 'portao de ripa')) { f.portao = 'ripado'; lidos.push('portão ripado'); }
    else if (tem('portao de chapa', 'portao fechado', 'portao chapa', 'chapa')) { f.portao = 'chapa'; lidos.push('portão de chapa'); }
    if (tem('muro alto', 'muro fechado')) { f.muro = 'alto'; lidos.push('muro alto'); }
    else if (tem('muro de vidro', 'muro vidro', 'vidro no muro', 'gradil de vidro')) { f.muro = 'vidro'; lidos.push('muro com vidro'); }
    else if (tem('muro baixo', 'mureta', 'sem muro')) { f.muro = 'baixo'; lidos.push('muro baixo'); }
    /* extras */
    if (tem('sem jardim')) { f.jardim = false; lidos.push('sem jardim'); } else if (tem('jardim', 'plantas', 'paisagismo', 'flores')) { f.jardim = true; lidos.push('jardim'); }
    if (tem('sem marquise')) { f.marquise = false; } else if (tem('marquise', 'cobertura na entrada', 'pergola', 'pergolado')) { if (tem('pergola', 'pergolado')) { f.pergolado = true; lidos.push('pergolado'); } else { f.marquise = true; lidos.push('marquise'); } }
    if (tem('sem iluminacao', 'sem luz')) { f.iluminacao = false; } else if (tem('iluminac', 'iluminad', 'spots', 'spot ', 'luz')) { f.iluminacao = true; lidos.push('iluminação'); }
    if (tem('vitrine', 'fachada de vidro', 'frente de vidro', 'pele de vidro', 'toda de vidro')) { f.vitrine = true; lidos.push('vitrine'); }
    /* janelas, vidro, porta, garagem, frente */
    if (tem('guilhotina')) { f.janela = 'guilhotina'; lidos.push('janela guilhotina'); }
    else if (tem('basculante') && !tem('garagem')) { f.janela = 'basculante'; lidos.push('janela basculante'); }
    else if (tem('veneziana', 'persiana')) { f.janela = 'veneziana'; lidos.push('janela veneziana'); }
    else if (tem('quadriculad', 'janela inglesa')) { f.janela = 'quadriculada'; lidos.push('janela quadriculada'); }
    else if (tem('vidro fixo', 'janela fixa', 'janelao', 'janela ampla')) { f.janela = 'fixa'; lidos.push('vidro fixo'); }
    else if (tem('janela de correr', 'janelas de correr')) { f.janela = 'correr'; lidos.push('janela de correr'); }
    if (tem('fume', 'vidro escuro', 'vidro preto')) { f.vidro = 'fume'; lidos.push('vidro fumê'); }
    else if (tem('vidro verde')) { f.vidro = 'verde'; lidos.push('vidro verde'); }
    else if (tem('espelhad', 'vidro refletivo', 'reflecta')) { f.vidro = 'espelhado'; lidos.push('vidro espelhado'); }
    if (tem('moldura')) { f.moldura = true; lidos.push('moldura nas janelas'); }
    if (tem('grade nas janelas', 'grades nas janelas', 'janelas com grade', 'grade de protecao')) { f.gradeJanela = true; lidos.push('grade nas janelas'); }
    if (tem('brise')) { f.brise = true; lidos.push('brise'); }
    if (tem('porta de enrolar', 'porta de aco de enrolar')) { f.porta = 'enrolar'; lidos.push('porta de enrolar'); }
    else if (tem('porta de subir', 'porta basculante')) { f.porta = 'subir'; lidos.push('porta de subir'); }
    else if (tem('porta automatica', 'porta de correr', 'vidro de correr')) { f.porta = 'correr'; lidos.push('porta de vidro de correr'); }
    else if (tem('porta pantografica', 'grade pantografica', 'grade de loja')) { f.porta = 'gradeLoja'; lidos.push('grade pantográfica'); }
    else if (tem('porta articulada', 'porta sanfonada')) { f.porta = 'articulada'; lidos.push('porta articulada'); }
    else if (tem('porta de vidro dupla', 'porta dupla de vidro', 'duas folhas de vidro')) { f.porta = 'vidroDupla'; lidos.push('porta de vidro 2 folhas'); }
    else if (tem('pivotante')) { f.porta = 'pivotante'; lidos.push('porta pivotante'); }
    else if (tem('porta de vidro', 'porta em vidro')) { f.porta = 'vidro'; lidos.push('porta de vidro'); }
    else if (tem('porta dupla', 'duas folhas', 'porta de duas')) { f.porta = 'dupla'; lidos.push('porta dupla'); }
    else if (tem('porta ripada', 'porta de ripa')) { f.porta = 'ripada'; lidos.push('porta ripada'); }
    else if (tem('porta de aco', 'porta metalica', 'porta de ferro')) { f.porta = 'aco'; lidos.push('porta de aço'); }
    else if (tem('porta de madeira')) { f.porta = 'madeira'; lidos.push('porta de madeira'); }
    var mpl = t.match(/porta(?!o)[a-z]*(?:\s+[a-z]+){0,4}?\s+(?:de\s+|com\s+)?([0-9]+(?:[.,][0-9]+)?)\s*(?:m\b|metros?)/);
    if (mpl) { f.portaLargura = parseFloat(mpl[1].replace(',', '.')); lidos.push('porta de ' + mpl[1] + ' m'); }
    if (tem('letreiro redondo', 'placa redonda')) { f.letreiroFormato = 'redondo'; lidos.push('letreiro redondo'); }
    else if (tem('letreiro oval', 'placa oval')) { f.letreiroFormato = 'oval'; lidos.push('letreiro oval'); }
    else if (tem('letreiro arredondado', 'placa arredondada', 'cantos arredondados')) { f.letreiroFormato = 'arredondado'; lidos.push('letreiro arredondado'); }
    else if (tem('em faixa', 'formato faixa', 'letreiro faixa', 'letreiro na frente toda', 'letreiro inteiro')) { f.letreiroFormato = 'faixa'; lidos.push('letreiro em faixa'); }
    if (tem('letreiro pequeno', 'placa pequena')) { f.letreiroTam = 'p'; lidos.push('letreiro P'); }
    else if (tem('letreiro enorme', 'letreiro gigante', 'placa gigante')) { f.letreiroTam = 'gg'; lidos.push('letreiro GG'); }
    else if (tem('letreiro grande', 'placa grande')) { f.letreiroTam = 'g'; lidos.push('letreiro G'); }
    if (tem('manuscrit', 'cursiv', 'script')) { f.letreiroFonte = 'script'; lidos.push('fonte manuscrita'); }
    else if (tem('fonte classica', 'serifa', 'elegante')) { f.letreiroFonte = 'serif'; lidos.push('fonte clássica'); }
    else if (tem('impacto', 'fonte grossa', 'fonte pesada')) { f.letreiroFonte = 'display'; lidos.push('fonte de impacto'); }
    else if (tem('condensad', 'fonte estreita')) { f.letreiroFonte = 'condensada'; lidos.push('fonte condensada'); }
    var cpo = corApos('porta(?!o)');
    if (cpo) { f.portaCor = cpo; lidos.push('porta ' + cpo); }
    if (tem('garagem de enrolar', 'garagem com porta de enrolar', 'portao de enrolar')) { f.garagem = 'enrolar'; lidos.push('garagem de enrolar'); }
    else if (tem('garagem ripad', 'garagem de madeira')) { f.garagem = 'ripado'; lidos.push('garagem ripada'); }
    else if (tem('garagem de vidro', 'garagem em vidro')) { f.garagem = 'vidro'; lidos.push('garagem de vidro'); }
    if (tem('arandela')) { f.arandelas = true; lidos.push('arandelas'); }
    if (tem('vaso', 'vasos')) { f.vasos = true; lidos.push('vasos na entrada'); }
    if (tem('deck')) { f.pisoFrente = 'deck'; lidos.push('deck na frente'); }
    else if (tem('piso de pedra', 'caminho de pedra')) { f.pisoFrente = 'pedra'; lidos.push('piso de pedra'); }
    else if (tem('intertravado', 'bloquete', 'paver')) { f.pisoFrente = 'intertravado'; lidos.push('intertravado'); }
    var cmu = corApos('muro');
    if (cmu) { f.muroCor = cmu; lidos.push('muro ' + cmu); }
    var cpt = corApos('portao');
    if (cpt) { f.portaoCor = cpt; lidos.push('portão ' + cpt); }
    /* letreiro: "letreiro/placa/nome ... 'X'" ou nome entre aspas */
    var nome = t.match(/["\u201c\u201d']([^"\u201c\u201d']{2,40})["\u201c\u201d']/);
    if (!nome) nome = t.match(/(?:letreiro|placa|nome|escrito|chamad[ao])\s+(?:com\s+|de\s+|do\s+|da\s+|escrito\s+)?(?:o\s+nome\s+)?([a-z0-9][a-z0-9 &\-]{1,30}?)(?=\s+(?:em|com|de|no|na|led|neon|luminos|ilumin|azul|verm|verde|preto|branc|amarel|laranja|rosa|roxo|dourad)\b|[.,;]|$)/);
    if (nome && nome[1] && nome[1].trim().length > 1 && !/^(led|neon|luminoso|iluminado|na fachada|na frente|em faixa|faixa|no topo|no alto|bandeira|lateral)$/.test(nome[1].trim())) {
      var nm = txt.match(new RegExp(nome[1].trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
      /* o texto normalizado perdeu os acentos → pega o trecho original pela posição (CAFÉ, não CAFE) */
      var ini = nome.index + nome[0].indexOf(nome[1]) - 1, origSub = String(txt).substr(ini, nome[1].length);
      if (!nm && origSub && origSub.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') === nome[1]) nm = [origSub];
      f.letreiro = (nm ? nm[0] : nome[1]).trim().toUpperCase(); lidos.push('letreiro "' + f.letreiro + '"');
    } else if (tem('letreiro', 'placa', 'fachada comercial', 'nome da loja', 'nome do estabelecimento')) { f.letreiro = f.letreiro || (atual && atual.letreiro) || (atual && atual.nomeProjeto) || 'MINHA LOJA'; lidos.push('letreiro'); }
    if (tem('neon')) { f.letreiroEstilo = 'neon'; f.letreiroLuz = true; lidos.push('neon'); }
    else if (tem('led', 'luminos', 'iluminad', 'acesa', 'aceso')) { f.letreiroEstilo = 'led'; f.letreiroLuz = true; lidos.push('LED'); }
    else if (tem('backlight', 'retroilumin')) { f.letreiroEstilo = 'backlight'; f.letreiroLuz = true; lidos.push('backlight'); }
    else if (tem('caixa alta', 'letra caixa', 'letras caixa')) { f.letreiroEstilo = 'caixa'; lidos.push('letra caixa'); }
    else if (tem('placa simples', 'placa pintada', 'placa de acm', 'acm')) { f.letreiroEstilo = 'placa'; lidos.push('placa'); }
    else if (tem('placa')) { f.letreiroEstilo = 'placa'; f.letreiroLuz = false; lidos.push('placa'); }
    var cl = corApos('letreiro', 'led', 'neon', 'placa', 'letras', 'letra', 'caixa', 'luz');
    if (cl) { f.letreiroCor = cl; lidos.push('letreiro ' + cl); }
    if (tem('totem', 'pilone', 'pylon')) { f.totem = true; lidos.push('totem'); }
    if (tem('na marquise', 'sobre a marquise', 'em cima da marquise')) { f.letreiroPos = 'marquise'; f.marquise = true; }
    if (tem('no topo', 'no alto', 'outdoor', 'em cima do telhado', 'sobre o telhado')) { f.letreiroPos = 'topo'; lidos.push('letreiro no topo'); }
    if (tem('bandeira', 'placa lateral', 'placa perpendicular')) { f.bandeira = true; lidos.push('bandeira'); }
    if (tem('placa no muro', 'placa do muro')) { f.placaMuro = true; lidos.push('placa no muro'); }
    if (tem('adesivo', 'vitrine com o nome')) { f.adesivo = true; f.vitrine = true; lidos.push('adesivo na vitrine'); }
    var mFaixa = t.match(/(?:faixa|banner|lona)\s*(?:com|escrito|dizendo|:)?\s*"([^"]{2,40})"/) || t.match(/(?:faixa|banner|lona)\s+(?:com|escrit[ao]|dizendo)\s+([a-z0-9 %!]{3,30}?)(?=\s+(?:e|em|com|no|na)\s|[,.]|$)/i);
    if (mFaixa) {
      var iniF = mFaixa.index + mFaixa[0].indexOf(mFaixa[1]) - 1, origF = String(txt).substr(iniF, mFaixa[1].length);   /* texto original, com acento */
      f.faixa = (origF && origF.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') === mFaixa[1] ? origF : mFaixa[1]).trim().toUpperCase(); lidos.push('faixa “' + f.faixa + '”');
    } else if (tem(' faixa', 'banner', 'lona') && !tem('em faixa', 'formato faixa', 'letreiro faixa')) { f.faixa = 'PROMOÇÃO'; lidos.push('faixa'); }
    var num = t.match(/numero\s+(\d{1,5})/); if (num) { f.numero = num[1]; lidos.push('número ' + num[1]); }
    return {fachada: f, lidos: lidos};
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
    texs.ripado = texCanvas(256, function (c, s) {   /* ripas verticais de madeira: 8 por textura → textura = 1 m */
      c.fillStyle = '#3B3128'; c.fillRect(0, 0, s, s);
      var R = rnd(31);
      for (var i = 0; i < 8; i++) { var tom = 150 + Math.floor(R() * 40); c.fillStyle = 'rgb(' + tom + ',' + Math.floor(tom * .62) + ',' + Math.floor(tom * .36) + ')'; c.fillRect(i * s / 8 + 3, 0, s / 8 - 6, s); }
    });
    texs.pedra = texCanvas(512, function (c, s) {   /* canjiquinha: fileiras de pedras irregulares */
      c.fillStyle = '#8E8A80'; c.fillRect(0, 0, s, s);
      var R = rnd(41), y = 0;
      while (y < s) { var h = 22 + R() * 26, x = -R() * 40; while (x < s) { var w = 40 + R() * 70, tom = 150 + Math.floor(R() * 60); c.fillStyle = 'rgb(' + tom + ',' + Math.floor(tom * .93) + ',' + Math.floor(tom * .82) + ')'; c.fillRect(x + 2, y + 2, w - 4, h - 4); x += w; } y += h; }
      ruido(c, s, 1200, '#000', .06, 3);
    });
    texs.tijolo = texCanvas(512, function (c, s) {   /* tijolinho à vista: 8 fiadas → textura = 0,5 m */
      c.fillStyle = '#CFC3B4'; c.fillRect(0, 0, s, s);
      var R = rnd(51), fh = s / 8, bw = s / 4;
      for (var r = 0; r < 8; r++) for (var i = -1; i < 5; i++) { var tom = 150 + Math.floor(R() * 40); c.fillStyle = 'rgb(' + tom + ',' + Math.floor(tom * .5) + ',' + Math.floor(tom * .38) + ')'; c.fillRect(i * bw + (r % 2 ? bw / 2 : 0) + 3, r * fh + 3, bw - 6, fh - 6); }
    });
    texs.cimento = texCanvas(256, function (c, s) { c.fillStyle = '#9C9A94'; c.fillRect(0, 0, s, s); ruido(c, s, 2600, '#000', .07, 14); ruido(c, s, 1600, '#fff', .09, 18); c.fillStyle = 'rgba(0,0,0,.08)'; c.fillRect(0, s / 2 - 1, s, 2); c.fillRect(s / 2 - 1, 0, 2, s); });
    texs.telhaCeramica = texCanvas(256, function (c, s) {   /* 6 fiadas de telha → textura = 1 m */
      c.fillStyle = '#8A3F27'; c.fillRect(0, 0, s, s);
      var R = rnd(61), fh = s / 6, tw = s / 5;
      for (var r = 0; r < 6; r++) for (var i = 0; i < 5; i++) { var tom = 175 + Math.floor(R() * 40); c.fillStyle = 'rgb(' + tom + ',' + Math.floor(tom * .45) + ',' + Math.floor(tom * .3) + ')'; c.fillRect(i * tw + 1, r * fh + 1, tw - 2, fh - 6); c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(i * tw + 1, r * fh + fh - 8, tw - 2, 3); }
    });
    texs.telhaConcreto = texCanvas(256, function (c, s) { c.fillStyle = '#6F6E6B'; c.fillRect(0, 0, s, s); var fh = s / 6; for (var r = 0; r < 6; r++) { c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(0, r * fh + fh - 6, s, 3); c.fillStyle = 'rgba(255,255,255,.06)'; c.fillRect(0, r * fh, s, 2); } ruido(c, s, 900, '#000', .06, 3); });
    texs.telhaMetal = texCanvas(256, function (c, s) { c.fillStyle = '#3F4448'; c.fillRect(0, 0, s, s); for (var i = 0; i < 8; i++) { c.fillStyle = 'rgba(255,255,255,.10)'; c.fillRect(i * s / 8, 0, 3, s); c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(i * s / 8 + s / 16, 0, 2, s); } });
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
  var mats = null, corCache = {}, vidroCache = {};
  /* vidro das janelas por tipo (incolor, fumê, verde, espelhado) */
  function vidroMat(tipo){
    if (!tipo || tipo === 'incolor') return materiais().vidro;
    if (!vidroCache[tipo]) {
      var c = {fume:['#3C4146', .62, .25], verde:['#8FCFB8', .42, .12], espelhado:['#A9C2CF', .82, .85]}[tipo] || ['#BFE6F2', .34, .15];
      vidroCache[tipo] = new THREE.MeshStandardMaterial({color:c[0], transparent:true, opacity:c[1], roughness:.05, metalness:c[2], side:THREE.DoubleSide, depthWrite:false});
    }
    return vidroCache[tipo];
  }
  function corMat(hex, op){ var k = hex + (op ? JSON.stringify(op) : ''); if (!corCache[k]) corCache[k] = std(hex, op); return corCache[k]; }
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
      /* fachada */
      ripado: mapa(T.ripado, 1), pedra: mapa(T.pedra, 1), tijolo: mapa(T.tijolo, 2), cimento: mapa(T.cimento, 1),
      telhaCeramica: mapa(T.telhaCeramica, 1, {side:THREE.DoubleSide}), telhaConcreto: mapa(T.telhaConcreto, 1, {side:THREE.DoubleSide}), telhaMetal: mapa(T.telhaMetal, 1, {side:THREE.DoubleSide}),
      esqBranca: std('#F4F4F1', {roughness:.5}), esqMadeira: std('#7A5230', {roughness:.6}),
      vidroNoite: new THREE.MeshStandardMaterial({color:'#FFE3A6', emissive:'#FFD27A', emissiveIntensity:.9, transparent:true, opacity:.85, roughness:.2, side:THREE.DoubleSide}),
      letreiroFundo: std('#1B1F24', {roughness:.6}), letreiroBranco: std('#F4F4F1', {roughness:.5}),
      flor1: std('#E4574F'), flor2: std('#F2C14E'), flor3: std('#F6F1E4'), poste: std('#3A3F45', {roughness:.5, metalness:.4}),
      /* estrutura (etapa 2) */
      concretoEstr: std('#C9C6BE', {roughness:.9}), ferro: std('#D9722B', {roughness:.5, metalness:.3}),
      inox: std('#C9CED3', {roughness:.25, metalness:.7}), louca: std('#FAFAF8', {roughness:.3}),
      azul: std('#6E7F9A'), azul2: std('#8FA0BA'), bege: std('#B8A88F'), vidroBox: new THREE.MeshStandardMaterial({color:'#CFE9F2', transparent:true, opacity:.28, roughness:.05, side:THREE.DoubleSide, depthWrite:false})
    };
    return mats;
  }

  /* ============================ CONSTRUÇÃO ============================ */
  /* FK = elemento de fachada em construção ('janela', 'porta', 'muro'…): cada primitiva criada enquanto
     FK está ligado recebe userData.fk — é o que permite CLICAR no item no 3D e trocar só ele. */
  var FK = null, FKID = null;
  function fk(tag, id){ FK = tag || null; FKID = id || null; }
  function caixa(g, w, h, d, mat, x, y, z, sombra){
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y + h / 2, z);
    m.castShadow = sombra !== false; m.receiveShadow = true;
    if (FK) { m.userData.fk = FK; if (FKID) m.userData.fkid = FKID; }
    g.add(m); return m;
  }
  /* piso horizontal com furos (a piscina dentro do salão): Shape no plano XZ, extrudado para cima `esp` metros.
     x0/z0 = canto, w/d = tamanho, furos = [{x,z,w,d}] em metros; UV do Extrude já sai em metros. */
  function pisoFurado(g, x0, z0, w, d, furos, mat, y, esp){
    var sh = new THREE.Shape(); sh.moveTo(x0, -z0); sh.lineTo(x0 + w, -z0); sh.lineTo(x0 + w, -(z0 + d)); sh.lineTo(x0, -(z0 + d)); sh.closePath();
    furos.forEach(function (f) { var h = new THREE.Path(); h.moveTo(f.x, -f.z); h.lineTo(f.x, -(f.z + f.d)); h.lineTo(f.x + f.w, -(f.z + f.d)); h.lineTo(f.x + f.w, -f.z); h.closePath(); sh.holes.push(h); });
    var geo = esp > .01 ? new THREE.ExtrudeGeometry(sh, {depth:esp, bevelEnabled:false}) : new THREE.ShapeGeometry(sh);
    var m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.y = y; m.receiveShadow = true; m.castShadow = false;
    g.add(m); return m;
  }
  /* piscinas (do mesmo andar) inteiramente dentro do ambiente r — em cm */
  function piscinasDentro(proj, r){
    return proj.ambientes.filter(function (a) { return a.tipo === 'agua' && (a.pav || 0) === (r.pav || 0) && a.x >= r.x && a.y >= r.y && a.x + a.w <= r.x + r.w && a.y + a.h <= r.y + r.h; });
  }
  function plano(g, w, d, mat, x, y, z, rep){   /* plano horizontal virado para cima, UV em metros */
    var geo = new THREE.PlaneGeometry(w, d);
    if (rep !== false) { var uv = geo.attributes.uv; for (var i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * d); }
    var m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true;
    if (FK) { m.userData.fk = FK; if (FKID) m.userData.fkid = FKID; }
    g.add(m); return m;
  }
  function cil(g, r, h, mat, x, y, z, seg){
    var m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg || 10), mat);
    m.position.set(x, y + h / 2, z); m.castShadow = true; m.receiveShadow = true; if (FK) m.userData.fk = FK; g.add(m); return m;
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
    g.position.set(mv.x * CM, (mv.elev || 0) * CM + (mv.pav || 0) * (g.userData.andarH || 0), mv.y * CM);
    g.rotation.y = -(mv.rot || 0) * Math.PI / 180;
    g.scale.x = mv.esp ? -1 : 1;
  }

  /* placa com o número da casa (canvas → textura) */
  var numCache = {};
  function numeroMat(txt, fundo, tinta){
    var k = txt + fundo + tinta; if (numCache[k]) return numCache[k];
    var tex = texCanvas(128, function (c, s) { c.fillStyle = fundo; c.fillRect(0, 0, s, s); c.fillStyle = tinta; c.font = 'bold ' + (txt.length > 3 ? 40 : 54) + 'px Inter,Arial,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, s / 2, s / 2 + 2); });
    var m = std('#FFFFFF', {roughness:.6}); m.map = tex; numCache[k] = m; return m;
  }

  /* letreiro: texto em canvas; `estilo` decide fundo e cor; acende à noite pelo emissiveMap */
  var letCache = {};
  /* opts: {formato, fonte, sub, fundoCor} — letra caixa e neon têm fundo transparente (só as letras) */
  /* imagem anexada (logo/arte): carrega uma vez; quando fica pronta, avisa quem estiver montado para reconstruir */
  var imgCache = {}, aoCarregarImg = [];
  function imagem(src){
    if (!src) return null;
    var im = imgCache[src];
    if (im) return im.complete && im.naturalWidth ? im : null;
    im = new Image(); imgCache[src] = im;
    im.onload = function () { aoCarregarImg.slice().forEach(function (fn) { try { fn(); } catch (e) {} }); };
    im.src = src; return null;
  }
  function chaveImg(src){ return src ? src.length + ':' + src.slice(-48) : ''; }
  function letreiroMat(txt, estilo, cor, W, H, opts){
    opts = opts || {};
    var formato = opts.formato || 'retangular', fonteK = opts.fonte || 'sans', sub = opts.sub || '', fundoCor = opts.fundoCor || '', logo = opts.logo || null;
    var k = [txt, estilo, cor, Math.round(W * 10), Math.round(H * 10), formato, fonteK, sub, fundoCor, logo ? chaveImg(logo.src) : ''].join('|'); if (letCache[k]) return letCache[k];
    var pw = 1024, ph = Math.max(128, Math.round(1024 * H / W));
    var semFundo = estilo === 'caixa' || estilo === 'neon';
    var fundo = fundoCor || (estilo === 'placa' ? cor : (estilo === 'backlight' ? '#FFFFFF' : '#14171B'));
    var tinta = estilo === 'placa' ? (fundoCor ? cor : '#FFFFFF') : (estilo === 'backlight' ? '#1B1F24' : cor);
    if (estilo === 'placa' && fundoCor && fundoCor.toUpperCase() === cor.toUpperCase()) tinta = '#FFFFFF';
    if (estilo === 'caixa') tinta = cor;
    var c = document.createElement('canvas'); c.width = pw; c.height = ph; var g = c.getContext('2d');
    g.clearRect(0, 0, pw, ph);
    /* forma do fundo (também recorta as letras) */
    g.beginPath();
    if (formato === 'redondo' || formato === 'oval') g.ellipse(pw / 2, ph / 2, pw / 2 - 2, ph / 2 - 2, 0, 0, Math.PI * 2);
    else if (formato === 'arredondado') { var r = ph * .5; g.moveTo(r, 0); g.lineTo(pw - r, 0); g.arc(pw - r, r, r, -Math.PI / 2, Math.PI / 2); g.lineTo(r, ph); g.arc(r, r, r, Math.PI / 2, Math.PI * 1.5); }
    else g.rect(0, 0, pw, ph);
    g.closePath();
    if (!semFundo) { g.fillStyle = fundo; g.fill(); }
    g.save(); if (!semFundo) g.clip();
    var fam = LETREIRO_CSSFONT[fonteK] || LETREIRO_CSSFONT.sans;
    var peso = estilo === 'neon' ? 'italic 700 ' : (estilo === 'caixa' ? '800 ' : '700 ');
    if (fonteK === 'script') peso = '400 ';
    var areaW = (formato === 'redondo' || formato === 'oval') ? pw * .74 : pw * .88;
    if (logo) {   /* arte anexada: entra inteira (contain), com respiro; o texto não é desenhado */
      var areaH = (formato === 'redondo' || formato === 'oval') ? ph * .74 : ph * .86, kk = Math.min(areaW / logo.naturalWidth, areaH / logo.naturalHeight), dw = logo.naturalWidth * kk, dh = logo.naturalHeight * kk;
      if (estilo === 'led' || estilo === 'neon') { g.shadowColor = cor; g.shadowBlur = ph * .12; }
      g.drawImage(logo, (pw - dw) / 2, (ph - dh) / 2, dw, dh); g.shadowBlur = 0;
      g.restore();
      var texL = new THREE.CanvasTexture(c); texL.colorSpace = THREE.SRGBColorSpace; texL.anisotropy = 4;
      var mL = new THREE.MeshStandardMaterial({color:'#FFFFFF', map:texL, roughness:.5, emissive:'#FFFFFF', emissiveMap:texL, emissiveIntensity:0, transparent:true, alphaTest:.05, side:THREE.DoubleSide});
      mL.userData.acende = estilo !== 'placa' && estilo !== 'caixa';
      letCache[k] = mL; return mL;
    }
    var fs = ph * (sub ? .46 : .58); g.font = peso + fs + 'px ' + fam;
    while (g.measureText(txt).width > areaW && fs > 20) { fs -= 4; g.font = peso + fs + 'px ' + fam; }
    var cy = sub ? ph * .42 : ph / 2 + fs * .04;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (estilo === 'neon') { g.shadowColor = cor; g.shadowBlur = fs * .5; g.strokeStyle = cor; g.lineWidth = fs * .06; g.strokeText(txt, pw / 2, cy); g.fillStyle = '#FFFFFF'; g.fillText(txt, pw / 2, cy); }
    else { if (estilo === 'led') { g.shadowColor = cor; g.shadowBlur = fs * .25; } g.fillStyle = tinta; g.fillText(txt, pw / 2, cy); }
    if (sub) {   /* segunda linha, menor */
      var fs2 = Math.max(18, fs * .38); g.font = '500 ' + fs2 + 'px ' + LETREIRO_CSSFONT.sans; g.shadowBlur = 0;
      while (g.measureText(sub).width > areaW && fs2 > 12) { fs2 -= 2; g.font = '500 ' + fs2 + 'px ' + LETREIRO_CSSFONT.sans; }
      g.fillStyle = estilo === 'neon' ? '#FFFFFF' : tinta; g.fillText(sub, pw / 2, ph * .42 + fs * .62);
    }
    g.restore();
    var tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    var m = new THREE.MeshStandardMaterial({color:'#FFFFFF', map:tex, roughness:.5, emissive:'#FFFFFF', emissiveMap:tex, emissiveIntensity:0, transparent:true, alphaTest:.05, side:THREE.DoubleSide});
    m.userData.acende = estilo !== 'placa' && estilo !== 'caixa';
    letCache[k] = m; return m;
  }

  /* ---- monta a cena inteira ---- */
  function construir(proj){
    var an = analise(proj), Mt = materiais(), t = proj.terreno, H = an.H * CM, F = fachadaDe(proj);
    var matExt = corMat(F.corParede), matDest = corMat(F.corDestaque);
    var matEsq = F.esquadriaCor ? corMat(F.esquadriaCor, {roughness:.5, metalness:.3}) : (F.esquadria === 'branco' ? Mt.esqBranca : (F.esquadria === 'madeira' ? Mt.esqMadeira : Mt.esquadria));
    var matVidro = vidroMat(F.vidro), matPortao = F.portaoCor ? corMat(F.portaoCor, {roughness:.45, metalness:.4}) : Mt.portao, matMuroBase = F.muroCor ? corMat(F.muroCor) : Mt.muro;
    var matPorta = F.portaCor ? corMat(F.portaCor, {roughness:.55}) : (F.porta === 'aco' ? Mt.esquadria : (['enrolar', 'subir', 'articulada', 'gradeLoja'].indexOf(F.porta) >= 0 ? Mt.portao : (F.porta === 'madeira' && F.esquadria === 'preto' ? Mt.esquadria : Mt.porta)));
    var matPisoFrente = {concreto:Mt.concreto, pedra:Mt.pedra, deck:Mt.deck, intertravado:Mt.calcada}[F.pisoFrente] || null;
    /* pavimentos: o térreo é `an`; cada andar de cima tem a própria análise e sobe uma laje */
    var nP = 1; proj.ambientes.forEach(function (a) { nP = Math.max(nP, (a.pav || 0) + 1); });
    var LAJE = .15, andarH = H + LAJE, altTotal = H * nP + LAJE * (nP - 1), luzes = [];
    var andares = []; for (var ip = 1; ip < nP; ip++) andares.push({pav:ip, an:analise(proj, ip), yb:ip * andarH});
    function cobertoAcima(pav, x, y){   /* ponto (cm) sob algum ambiente do andar de cima (bordas inclusive) */
      var d = andares.filter(function (q) { return q.pav === pav + 1; })[0]; if (!d) return false;
      return d.an.ambs.some(function (r) { return x >= r.x - 1 && x <= r.x + r.w + 1 && y >= r.y - 1 && y <= r.y + r.h + 1; });
    }
    var matRev = {ripado:Mt.ripado, pedra:Mt.pedra, tijolo:Mt.tijolo, cimento:Mt.cimento}[F.revestimento] || null;
    var matTelha = F.telha === 'ceramica' ? Mt.telhaCeramica : (F.telha === 'metalica' ? Mt.telhaMetal : Mt.telhaConcreto);
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
    fk('muro');
    caixa(G.terreno, .15, 1.8, TP, matMuroBase, .075, 0, TP / 2); caixa(G.terreno, .15, 1.8, TP, matMuroBase, TL - .075, 0, TP / 2);
    caixa(G.terreno, TL, 1.8, .15, matMuroBase, TL / 2, 0, TP - .075);
    /* muro frontal com portão alinhado à garagem ou à entrada */
    var gx = TL / 2, gw = 3;
    if (an.garagem) { var ga = an.garagem.A || an.garagem.B; gx = (ga.x + ga.w / 2) * CM; gw = Math.min(3.2, ga.w * CM); }
    else if (an.entrada) { var ab = an.entrada.pc.ab.filter(function (a) { return a.tipo === 'entrada'; })[0]; gx = an.entrada.pc.o === 'h' ? (ab ? (ab.s + ab.e) / 2 : (an.entrada.pc.p + an.entrada.pc.q) / 2) * CM : an.entrada.pc.c * CM; gw = 1.2; }
    var x1 = gx - gw / 2, x2 = gx + gw / 2, muroH = F.muro === 'alto' ? 1.8 : 1.0, matMuro = F.muro === 'vidro' ? Mt.vidro : matMuroBase;
    if (F.muro === 'vidro') {   /* mureta baixa + painéis de vidro entre pilaretes */
      if (x1 > .2) { caixa(G.terreno, x1, .4, .15, matMuroBase, x1 / 2, 0, .075); caixa(G.terreno, x1 - .1, 1.2, .02, Mt.vidro, x1 / 2, .4, .075, false); }
      if (TL - x2 > .2) { caixa(G.terreno, TL - x2, .4, .15, matMuroBase, x2 + (TL - x2) / 2, 0, .075); caixa(G.terreno, TL - x2 - .1, 1.2, .02, Mt.vidro, x2 + (TL - x2) / 2, .4, .075, false); }
      for (var pv = 0; pv <= TL; pv += 2) if (pv < x1 - .1 || pv > x2 + .1) caixa(G.terreno, .08, 1.6, .08, Mt.esquadria, Math.min(TL - .04, pv), 0, .075);
      muroH = 1.6;
    } else {
      if (x1 > .2) caixa(G.terreno, x1, muroH, .15, matMuro, x1 / 2, 0, .075);
      if (TL - x2 > .2) caixa(G.terreno, TL - x2, muroH, .15, matMuro, x2 + (TL - x2) / 2, 0, .075);
      if (matRev && F.muro === 'alto') { var mr1 = x1 > .2 ? caixa(G.terreno, x1 - .04, muroH - .02, .02, matRev, x1 / 2, 0, -.01, false) : null; var mr2 = TL - x2 > .2 ? caixa(G.terreno, TL - x2 - .04, muroH - .02, .02, matRev, x2 + (TL - x2) / 2, 0, -.01, false) : null; }
    }
    /* pilaretes do portão */
    caixa(G.terreno, .25, muroH + .3, .25, matDest, x1 - .125, 0, .075); caixa(G.terreno, .25, muroH + .3, .25, matDest, x2 + .125, 0, .075);
    fk('portao');
    var pH = Math.min(muroH + .2, 1.9);
    if (F.portao === 'chapa') {
      caixa(G.terreno, gw - .1, pH, .05, matPortao, gx, .05, .075); caixa(G.terreno, gw - .3, .02, .06, Mt.esquadria, gx, pH * .5, .075);
    } else if (F.portao === 'ripado') {
      caixa(G.terreno, gw - .1, .06, .06, matPortao, gx, pH - .06, .075); caixa(G.terreno, gw - .1, .06, .06, matPortao, gx, .1, .075);
      for (var rp = 0; rp <= Math.round((gw - .1) / .1); rp++) caixa(G.terreno, .06, pH - .16, .03, Mt.esqMadeira, gx - (gw - .1) / 2 + .03 + rp * .1, .1, .075);
    } else {
      caixa(G.terreno, gw - .1, .06, .06, matPortao, gx, pH - .06, .075); caixa(G.terreno, gw - .1, .06, .06, matPortao, gx, .1, .075);   /* portão gradeado */
      for (var gi = 0; gi <= Math.round((gw - .1) / .13); gi++) caixa(G.terreno, .035, pH, .035, matPortao, gx - (gw - .1) / 2 + gi * ((gw - .1) / Math.round((gw - .1) / .13)), 0, .075);
    }
    /* caminho do portão até a casa */
    fk('pisoFrente');
    var frenteCasa = an.ambs.length ? Math.min.apply(null, an.ambs.map(function (a) { return a.y; })) * CM : TP;
    if (frenteCasa > .3) plano(G.terreno, gw - .2, frenteCasa - .2, matPisoFrente || Mt.calcada, gx, .005, .1 + (frenteCasa - .2) / 2);
    fk('jardim');
    /* árvores no recuo frontal */
    var R = rnd(hash(proj.id || 'x'));
    if (t.recuoFrontal >= 250) { if (Math.abs(1 - gx) > 1.6) arvore(G.terreno, .9, 1.2, .9, R); if (Math.abs(TL - 1 - gx) > 1.6) arvore(G.terreno, TL - .9, 1.2, .8, R); }
    /* jardim frontal: cerca-viva rente ao muro + canteiro com flores */
    if (F.jardim && t.recuoFrontal >= 150) {
      var Rj0 = rnd(hash((proj.id || 'x') + 'j')), flores = [Mt.flor1, Mt.flor2, Mt.flor3];
      [[.3, x1 - .4], [x2 + .4, TL - .3]].forEach(function (seg) {
        var a0 = seg[0], a1 = seg[1]; if (a1 - a0 < .6) return;
        caixa(G.terreno, a1 - a0, .55, .45, Mt.folhas2, (a0 + a1) / 2, 0, .45);
        for (var fx = a0 + .2; fx < a1 - .1; fx += .28) { var fl = new THREE.Mesh(new THREE.SphereGeometry(.07, 6, 5), flores[Math.floor(Rj0() * 3)]); fl.position.set(fx, .3 + Rj0() * .2, .85 + Rj0() * .25); G.terreno.add(fl); }
        plano(G.terreno, a1 - a0, .5, Mt.terraExt, (a0 + a1) / 2, .008, .95);
      });
    }
    /* poste na calçada (acende à noite) */
    fk(null);
    caixa(G.terreno, .12, 4.2, .12, Mt.poste, Math.min(TL - .8, gx + gw / 2 + 2.2), 0, -1.9); caixa(G.terreno, .6, .12, .3, Mt.poste, Math.min(TL - .8, gx + gw / 2 + 2.2) - .24, 4.1, -1.9);
    var posteLuz = {x: Math.min(TL - .8, gx + gw / 2 + 2.2) - .48, y: 4.0, z: -1.9};

    /* ---------- um andar: pisos, tetos, laje e paredes (G aponta para os grupos do andar) ---------- */
    function montarAndar(an, ehTerreo, ehTopo, G){
    /* ---------- pisos, tetos, laje ---------- */
    an.ambs.forEach(function (r) {
      var x = r.x * CM, z = r.y * CM, w = r.w * CM, d = r.h * CM;
      var mat = r.tipo === 'molhado' || r.tipo === 'servico' ? Mt.ceramica : (r.tipo === 'garagem' ? Mt.concreto : Mt.madeira);
      var furos = piscinasDentro(proj, r).map(function (a) { return {x:a.x * CM, z:a.y * CM, w:a.w * CM, d:a.h * CM}; }), base, p;
      if (furos.length) {   /* salão com piscina: laje e piso recortados na lâmina d'água */
        base = pisoFurado(G.pisos, x, z, w, d, furos, Mt.laje, -.05, .1);
        p = pisoFurado(G.pisos, x, z, w, d, furos, mat, .101, 0);
      } else {
        base = caixa(G.pisos, w, .1, d, Mt.laje, x + w / 2, 0, z + d / 2, false);
        p = plano(G.pisos, w, d, mat, x + w / 2, .101, z + d / 2);
      }
      p.userData.ambId = r.id; p.userData.pronto = mat; p.userData.cru = Mt.cruPiso; pisos.push(p);
      var teto = plano(G.cobertura, w, d, Mt.teto, x + w / 2, H - .005, z + d / 2, false); teto.rotation.x = Math.PI / 2;
      var laje = caixa(G.cobertura, w, .15, d, Mt.laje, x + w / 2, H, z + d / 2); laje.userData.pronto = Mt.laje; laje.userData.cru = Mt.cruLaje;
    });
    /* ---------- paredes ---------- */
    var frenteCm = an.ambs.length ? Math.min.apply(null, an.ambs.map(function (a) { return a.y; })) : 0;
    var casaX0 = an.ambs.length ? Math.min.apply(null, an.ambs.map(function (a) { return a.x; })) * CM : 0, casaX1 = an.ambs.length ? Math.max.apply(null, an.ambs.map(function (a) { return a.x + a.w; })) * CM : TL;
    var entradaInfo = null;
    an.pecas.forEach(function (pc) {
      var mat = pc.ext ? matExt : Mt.parede;
      var naFrente = pc.ext && pc.o === 'h' && pc.c === frenteCm, salaF = naFrente ? (pc.A || pc.B) : null;
      /* vitrine: a parede da frente dos ambientes sociais vira vidro do piso ao teto (loja, recepção, sala) */
      var ehVitrine = F.vitrine && ehTerreo && naFrente && salaF && salaF.tipo === 'social';
      if (ehVitrine) {
        fk('vitrine');
        var lenV = (pc.q2 - pc.p2) * CM, midV = (pc.p2 + pc.q2) / 2 * CM, zV = pc.c * CM;
        var vid2 = caixa(G.paredes, lenV, H - .1, .04, Mt.vidro, midV, .1, zV, false); vid2.userData.janela = true; vid2.userData.pronto = Mt.vidro; vid2.userData.cru = Mt.cruParede;
        caixa(G.paredes, lenV, .1, ESP * CM, matEsq, midV, 0, zV); caixa(G.paredes, lenV, .1, ESP * CM, matEsq, midV, H - .1, zV);
        var nB = Math.max(1, Math.round(lenV / 1.6)); for (var bi = 0; bi <= nB; bi++) caixa(G.paredes, .06, H, .1, matEsq, midV - lenV / 2 + lenV * bi / nB, 0, zV);
        if (F.adesivo && (F.letreiro || F.logo)) {   /* adesivo com o nome/arte no vidro da vitrine */
          if (!F.letreiro) F.letreiro = ' ';
          var adw = Math.min(lenV - .4, Math.max(1.2, F.letreiro.length * .2)), adh = .42;
          var matAd = letreiroMat(F.letreiro, 'neon', F.letreiroCor, adw, adh, {fonte:F.letreiroFonte, logo:F.logo ? imagem(F.logo) : null});
          var pAd = plano(G.acabamento, adw, adh, matAd, midV, 1.55 + adh / 2, zV - .03, false); pAd.rotation.set(0, Math.PI, 0); pAd.material = pAd.material.clone(); pAd.material.opacity = .9; pAd.material.transparent = true;
        }
        pc.ab.forEach(function (ab) { if (ab.tipo === 'entrada') { var lenE = (ab.e - ab.s) * CM, midE = (ab.s + ab.e) / 2 * CM; caixa(G.paredes, lenE + .1, .08, .12, matEsq, midE, ab.z1 * CM + .02, zV); caixa(G.acabamento, .03, .03, .1, Mt.metal, midE + lenE / 2 - .12, 1.0, zV - .04); } });
      }
      /* revestimento na frente da casa (peças da testada que não são garagem) */
      fk('revestimento');
      if (matRev && pc.ext && pc.o === 'h' && pc.c === frenteCm) {
        var salaFrente = pc.A || pc.B, ehGar = salaFrente && salaFrente.tipo === 'garagem';
        if (!ehGar && !ehVitrine) {
          /* trechos da peça sem abertura (porta/janela ficam livres) */
          var zR = pc.c * CM - ESP * CM / 2 - .02, altR = H + (F.cobertura === 'platibanda' ? .6 : 0) - .03, trechos = [[pc.p2 + 1, pc.q2 - 1]];
          pc.ab.forEach(function (ab) { var out = []; trechos.forEach(function (tr) { if (ab.e + 8 <= tr[0] || ab.s - 8 >= tr[1]) { out.push(tr); return; } if (ab.s - 8 > tr[0]) out.push([tr[0], ab.s - 8]); if (ab.e + 8 < tr[1]) out.push([ab.e + 8, tr[1]]); }); trechos = out; });
          trechos.forEach(function (tr) {
            var lenR = (tr[1] - tr[0]) * CM, midR = (tr[0] + tr[1]) / 2 * CM; if (lenR < .12) return;
            if (F.revestimento === 'ripado') { var nR = Math.floor(lenR / .09); for (var ri = 0; ri < nR; ri++) caixa(G.acabamento, .05, altR, .04, Mt.ripado, midR - lenR / 2 + .045 + ri * .09 + (lenR - nR * .09) / 2, 0, zR); }
            else { var rv = caixa(G.acabamento, lenR, altR, .03, matRev, midR, 0, zR); rv.userData.pronto = matRev; rv.userData.cru = Mt.cruParede; }
          });
        }
      }
      fk(pc.ext ? 'parede' : null, pc.chave);
      pc.caixas.forEach(function (c) {
        if (ehVitrine) return;
        var len = (c.q - c.p) * CM, alt = (c.z1 - c.z0) * CM, mid = (c.p + c.q) / 2 * CM, y0 = c.z0 * CM;
        var m = pc.o === 'h' ? caixa(G.paredes, len, alt, ESP * CM, mat, mid, y0, pc.c * CM) : caixa(G.paredes, ESP * CM, alt, len, mat, pc.c * CM, y0, mid);
        m.userData.pronto = mat; m.userData.cru = Mt.cruParede;
      });
      /* platibanda nas peças externas (só quando a cobertura é platibanda) */
      fk('cobertura');
      if (pc.ext && F.cobertura === 'platibanda' && (ehTopo || !cobertoAcima(an.pav, pc.o === 'h' ? (pc.p2 + pc.q2) / 2 : pc.c, pc.o === 'h' ? pc.c : (pc.p2 + pc.q2) / 2))) {
        var len2 = (pc.q2 - pc.p2) * CM, mid2 = (pc.p2 + pc.q2) / 2 * CM;
        var pl = pc.o === 'h' ? caixa(G.cobertura, len2, .6, ESP * CM, matExt, mid2, H + .15, pc.c * CM) : caixa(G.cobertura, ESP * CM, .6, len2, matExt, pc.c * CM, H + .15, mid2);
        pl.userData.pronto = matExt; pl.userData.cru = Mt.cruParede;
      }
      /* esquadrias, vidros e portas */
      pc.ab.forEach(function (ab) {
        if (ehVitrine && ab.tipo === 'janela') return;   /* a vitrine já é o vidro */
        fk(!pc.ext ? null : ab.tipo === 'janela' ? 'janela' : ab.tipo === 'portao' ? 'garagem' : ab.tipo === 'entrada' ? 'porta' : null, ab.chave || pc.chave);
        var len = (ab.e - ab.s) * CM, alt = (ab.z1 - ab.z0) * CM, mid = (ab.s + ab.e) / 2 * CM, y0 = ab.z0 * CM;
        var horiz = pc.o === 'h', cx = horiz ? mid : pc.c * CM, cz = horiz ? pc.c * CM : mid;
        if (ab.tipo === 'entrada' && horiz && pc.c === frenteCm && !ab.secundaria) entradaInfo = {cx:cx, cz:cz, len:len, p2:pc.p2 * CM, q2:pc.q2 * CM};
        function peça(w, h, d, mat, dx, dy, dz, sombra){ return horiz ? caixa(G.acabamento, w, h, d, mat, cx + dx, y0 + dy, cz + dz, sombra) : caixa(G.acabamento, d, h, w, mat, cx + dz, y0 + dy, cz + dx, sombra); }
        if (ab.tipo === 'janela') {
          var matVidroAb = ab.vidro ? vidroMat(ab.vidro) : matVidro;
          var vid = peça(len, alt, .02, matVidroAb, 0, 0, 0, false); vid.userData.janela = true;
          peça(len, .05, .08, matEsq, 0, 0, 0); peça(len, .05, .08, matEsq, 0, alt - .05, 0);
          peça(.05, alt, .08, matEsq, -len / 2 + .025, 0, 0); peça(.05, alt, .08, matEsq, len / 2 - .025, 0, 0);
          var J = ab.janela || F.janela || 'correr';
          if (J === 'correr') peça(.03, alt, .04, matEsq, 0, 0, 0);
          else if (J === 'guilhotina') peça(len, .04, .06, matEsq, 0, alt / 2 - .02, 0);
          else if (J === 'basculante') {   /* folha de cima inclinada para fora */
            peça(len, .04, .06, matEsq, 0, alt * .6, 0);
            var fb = peça(len - .1, alt * .4 - .08, .02, matVidroAb, 0, alt * .6 + .04, 0, false); fb.userData.janela = true;
            if (horiz) fb.rotation.x = -.3; else fb.rotation.z = .3;
          } else if (J === 'quadriculada') {
            for (var qi = 1; qi < 3; qi++) peça(.025, alt, .04, matEsq, -len / 2 + len * qi / 3, 0, 0);
            for (var qj = 1; qj < 3; qj++) peça(len, .025, .04, matEsq, 0, alt * qj / 3, 0);
          } else if (J === 'veneziana') {   /* uma folha de vidro, outra de palhetas */
            peça(.03, alt, .04, matEsq, 0, 0, 0);
            for (var sv = .07; sv < alt - .07; sv += .08) peça(len / 2 - .08, .03, .05, matEsq, len / 4, sv, 0);
          }
          if (F.gradeJanela) for (var gj = .1; gj < len - .05; gj += .12) peça(.015, alt - .08, .11, Mt.preto, -len / 2 + gj, .04, 0);
          if (F.moldura && pc.ext) { peça(len + .28, .14, .22, matDest, 0, alt, 0); peça(.14, alt + .14, .22, matDest, -len / 2 - .07, -.07, 0); peça(.14, alt + .14, .22, matDest, len / 2 + .07, -.07, 0); }
          if (F.brise && horiz && pc.c === frenteCm) for (var bk = 0; bk < 4; bk++) peça(len + .3, .03, .45, matDest, 0, alt + .14 + bk * .11, -.3);
          peça(len + .2, .06, .3, Mt.laje, 0, -.06, 0);   /* peitoril */
        } else if (ab.tipo === 'portao') {
          var GT = F.garagem || 'basculante';
          if (GT === 'vidro') {
            var vg = peça(len, alt, .02, matVidro, 0, 0, 0, false); vg.userData.janela = true;
            peça(len, .05, .08, matEsq, 0, 0, 0); peça(len, .05, .08, matEsq, 0, alt - .05, 0);
            for (var gv = 1; gv < 4; gv++) peça(.04, alt, .06, matEsq, -len / 2 + len * gv / 4, 0, 0);
            for (var gh = 1; gh < 3; gh++) peça(len, .04, .06, matEsq, 0, alt * gh / 3, 0);
          } else if (GT === 'ripado') {
            peça(len, alt, .03, matPortao, 0, 0, 0);
            for (var gr = .05; gr < len - .04; gr += .1) peça(.06, alt - .1, .04, Mt.esqMadeira, -len / 2 + gr, .05, .02);
          } else if (GT === 'enrolar') {
            peça(len, alt, .04, matPortao, 0, 0, 0);
            for (var ge = .1; ge < alt - .05; ge += .1) peça(len, .015, .06, Mt.esquadria, 0, ge, 0);
            peça(len + .2, .22, .22, matEsq, 0, alt - .02, 0);   /* caixa do rolo */
          } else {   /* basculante */
            peça(len, alt, .04, matPortao, 0, 0, 0);
            for (var i = 1; i < 5; i++) peça(len, .02, .06, Mt.esquadria, 0, alt * i / 5, 0);
          }
        } else if (ab.tipo === 'entrada') {
          var PT = F.porta || 'madeira';
          if (PT === 'vidro') { var pv2 = peça(len - .1, alt - .05, .02, matVidro, 0, 0, 0, false); pv2.userData.janela = true; peça(len - .1, .12, .05, matEsq, 0, 0, 0); peça(.06, alt - .05, .05, matEsq, 0, 0, 0); peça(.03, 1.1, .03, Mt.metal, .12, .55, .05); }
          else if (PT === 'dupla') { peça(len, alt, .06, matPorta, 0, 0, 0); peça(.02, alt, .1, matEsq, 0, 0, 0); peça(.03, .03, .1, Mt.metal, -.1, 1.0, .06); peça(.03, .03, .1, Mt.metal, .1, 1.0, .06); }
          else if (PT === 'ripada') { peça(len, alt, .05, matPorta, 0, 0, 0); for (var pr2 = .06; pr2 < len - .05; pr2 += .09) peça(.05, alt - .08, .04, Mt.esqMadeira, -len / 2 + pr2, .04, .03); peça(.03, .9, .03, Mt.metal, len / 2 - .12, .6, .06); }
          else if (PT === 'pivotante') { peça(len, alt, .07, matPorta, 0, 0, 0); peça(.03, 1.4, .03, Mt.metal, len / 2 - .16, .45, .07); peça(len, .015, .075, Mt.metal, 0, alt * .33, 0); peça(len, .015, .075, Mt.metal, 0, alt * .66, 0); }
          else if (PT === 'aco') { peça(len, alt, .06, matPorta, 0, 0, 0); for (var pa2 = .3; pa2 < alt - .1; pa2 += .3) peça(len - .1, .012, .07, Mt.metal, 0, pa2, 0); peça(.03, .03, .1, Mt.metal, len / 2 - .12, 1.0, .06); }
          /* ---- portas de loja ---- */
          else if (PT === 'enrolar') { peça(len, alt, .04, matPorta, 0, 0, 0); for (var pe = .1; pe < alt - .05; pe += .1) peça(len, .015, .06, Mt.esquadria, 0, pe, 0); peça(len + .2, .24, .24, matEsq, 0, alt - .02, 0); }
          else if (PT === 'subir') { peça(len, alt, .05, matPorta, 0, 0, 0); for (var ps = .35; ps < alt - .1; ps += .35) peça(len - .08, .015, .07, Mt.metal, 0, ps, 0); peça(.06, alt + .1, .12, matEsq, -len / 2 - .03, 0, 0); peça(.06, alt + .1, .12, matEsq, len / 2 + .03, 0, 0); peça(len - .3, .05, .06, Mt.metal, 0, alt * .45, .04); }
          else if (PT === 'correr') { var pc2 = peça(len - .08, alt - .06, .02, matVidro, 0, 0, 0, false); pc2.userData.janela = true; peça(len, .1, .1, matEsq, 0, alt - .1, 0); peça(len, .06, .06, matEsq, 0, 0, 0); peça(.04, alt - .06, .05, matEsq, 0, 0, 0); peça(.04, alt - .06, .05, matEsq, -len / 4, 0, 0); peça(.04, alt - .06, .05, matEsq, len / 4, 0, 0); peça(.16, .06, .1, Mt.preto, 0, alt - .16, .06); }
          else if (PT === 'vidroDupla') { var pd2 = peça(len - .08, alt - .06, .02, matVidro, 0, 0, 0, false); pd2.userData.janela = true; peça(len - .08, .1, .05, matEsq, 0, 0, 0); peça(.05, alt - .06, .05, matEsq, 0, 0, 0); peça(.03, 1.0, .03, Mt.metal, -.12, .6, .05); peça(.03, 1.0, .03, Mt.metal, .12, .6, .05); }
          else if (PT === 'gradeLoja') { for (var gl = .05; gl < len - .03; gl += .11) peça(.02, alt, .02, Mt.metal, -len / 2 + gl, 0, 0); for (var gl2 = .3; gl2 < alt; gl2 += .3) peça(len, .02, .02, Mt.metal, 0, gl2, 0); peça(len, .06, .06, matEsq, 0, alt - .06, 0); }
          else if (PT === 'articulada') { var nf = Math.max(2, Math.round(len / .4)); for (var fi = 0; fi < nf; fi++) { var fw = len / nf; var fl = peça(fw - .02, alt, .04, matPorta, -len / 2 + fw * (fi + .5), 0, 0); if (horiz) fl.rotation.y = (fi % 2 ? -.12 : .12); } for (var fa = .3; fa < alt - .1; fa += .3) peça(len, .012, .06, Mt.metal, 0, fa, 0); }
          else { peça(len, alt, .06, matPorta, 0, 0, 0); peça(.03, .03, .1, Mt.metal, len / 2 - .12, 1.0, .06); }
          peça(.05, alt, .1, matEsq, -len / 2 + .025, 0, 0); peça(.05, alt, .1, matEsq, len / 2 - .025, 0, 0); peça(len, .05, .1, matEsq, 0, alt - .05, 0);
          if (F.arandelas && horiz && pc.c === frenteCm) {   /* arandelas dos dois lados da porta (acendem à noite) */
            [-1, 1].forEach(function (sg) { var ax = cx + sg * (len / 2 + .3 + (sg < 0 ? .35 : 0)); caixa(G.acabamento, .1, .22, .07, matDest, ax, y0 + 1.9, cz - .1); luzes.push({tipo:'ponto', x:ax, y:y0 + 2.0, z:cz - .3, cor:'#FFD9A0', int:3, dist:3.5}); });
          }
          if (F.vasos && horiz && pc.c === frenteCm) {   /* vasos de concreto com folhagem */
            [-1, 1].forEach(function (sg) { var vx = cx + sg * (len / 2 + .55 + (sg < 0 ? .35 : 0)); cil(G.acabamento, .2, .42, Mt.cimento, vx, y0, cz - .45, 12); var fo = new THREE.Mesh(new THREE.SphereGeometry(.26, 8, 6), Mt.folhas2); fo.position.set(vx, y0 + .6, cz - .45); fo.castShadow = true; G.acabamento.add(fo); });
          }
          if (horiz && pc.c === frenteCm && !ab.secundaria) {   /* fachada: volume de destaque, marquise, número e luz da entrada */
            var ladoX = cx - len / 2 - .35;
            fk('destaque'); caixa(G.acabamento, .35, altTotal + (F.cobertura === 'platibanda' ? .75 : .1), .3, matDest, ladoX, 0, cz - .08);
            fk('marquise'); if (F.marquise) caixa(G.acabamento, len + 1.2, .12, 1.1, matDest, cx + .1, 2.25, cz - .55);
            if (F.pergolado) {   /* pergolado de madeira sobre a entrada */
              var pw2 = Math.max(2.4, len + 1.6), pd2 = 1.6;
              caixa(G.acabamento, .12, 2.5, .12, Mt.esqMadeira, cx - pw2 / 2 + .06, 0, cz - pd2 + .06); caixa(G.acabamento, .12, 2.5, .12, Mt.esqMadeira, cx + pw2 / 2 - .06, 0, cz - pd2 + .06);
              caixa(G.acabamento, pw2, .12, .12, Mt.esqMadeira, cx, 2.5, cz - pd2 + .06); caixa(G.acabamento, pw2, .12, .12, Mt.esqMadeira, cx, 2.5, cz - .1);
              for (var pi2 = 0; pi2 <= Math.round(pw2 / .3); pi2++) caixa(G.acabamento, .05, .1, pd2, Mt.esqMadeira, cx - pw2 / 2 + pi2 * (pw2 / Math.round(pw2 / .3)), 2.62, cz - pd2 / 2);
            }
            if (F.numero) { var np2 = plano(G.acabamento, .34, .34, numeroMat(F.numero, F.esquadria === 'preto' ? '#1B1F24' : '#F4F4F1', F.esquadria === 'preto' ? '#F4F4F1' : '#1B1F24'), ladoX, 1.55, cz, false); np2.rotation.set(0, Math.PI, 0); np2.position.set(ladoX, 1.55, cz - .08 - .156); }
            luzes.push({tipo:'ponto', x:cx, y:2.15, z:cz - .5, cor:'#FFD9A0', int:8, dist:6});
          }
        } else {   /* porta interna: aberta a 75° para dentro do ambiente B */
          fk('portaInt', ab.chave || pc.chave);
          peça(.05, alt, .12, Mt.esquadria, -len / 2 + .025, 0, 0); peça(.05, alt, .12, Mt.esquadria, len / 2 - .025, 0, 0); peça(len, .05, .12, Mt.esquadria, 0, alt - .05, 0);
          var folha = new THREE.Mesh(new THREE.BoxGeometry(len - .06, alt - .05, .04), Mt.porta); folha.castShadow = true;
          var piv = new THREE.Group(); piv.position.set(horiz ? cx - len / 2 + .03 : cx, y0 + (alt - .05) / 2, horiz ? cz : cz - len / 2 + .03);
          folha.position.set((len - .06) / 2, 0, 0); piv.add(folha);
          piv.rotation.y = horiz ? -Math.PI * .42 : Math.PI / 2 - Math.PI * .42;
          folha.userData.fk = 'portaInt'; folha.userData.fkid = ab.chave || pc.chave;
          G.acabamento.add(piv);
          fk(null);
        }
      });
    });
    return {frenteCm:frenteCm, casaX0:casaX0, casaX1:casaX1, entradaInfo:entradaInfo};
    }
    var r0 = montarAndar(an, true, nP === 1, G);
    var frenteCm = r0.frenteCm, casaX0 = r0.casaX0, casaX1 = r0.casaX1, entradaInfo = r0.entradaInfo;
    andares.forEach(function (d) {
      var Gp = {terreno:G.terreno, estrutura:G.estrutura, moveis:G.moveis};
      ['pisos', 'paredes', 'cobertura', 'acabamento'].forEach(function (k) { var g = new THREE.Group(); g.position.y = d.yb; g.name = k + d.pav; G[k].add(g); Gp[k] = g; });
      d.res = montarAndar(d.an, false, d.pav === nP - 1, Gp);
    });
    fk(null);
    var anTopo = nP > 1 ? andares[nP - 2].an : an, yTopo = (nP - 1) * andarH;
    var frenteTopo = anTopo.ambs.length ? Math.min.apply(null, anTopo.ambs.map(function (a) { return a.y; })) : frenteCm;
    var topoX0 = anTopo.ambs.length ? Math.min.apply(null, anTopo.ambs.map(function (a) { return a.x; })) * CM : casaX0, topoX1 = anTopo.ambs.length ? Math.max.apply(null, anTopo.ambs.map(function (a) { return a.x + a.w; })) * CM : casaX1;
    /* ---------- escada (derivada de M.escada): degraus maciços do térreo até a laje + guarda-corpo do vão ---------- */
    var escd = nP > 1 && M.escada ? M.escada() : null;
    if (escd) {
      var nd = escd.degraus, rise = andarH / nd, run = escd.h * CM / nd, ex = escd.x * CM, ez = escd.y * CM, ew = escd.w * CM, eh = escd.h * CM;
      for (var si = 0; si < nd; si++) caixa(G.acabamento, ew - .04, rise * (si + 1), run, Mt.madeira, ex + ew / 2, 0, ez + eh - run * (si + .5));
      caixa(G.acabamento, .04, .95, eh, matEsq, ex + ew - .02, andarH, ez + eh / 2);            /* guarda-corpo do vão, lado aberto */
      caixa(G.acabamento, ew, .95, .04, matEsq, ex + ew / 2, andarH, ez + eh + .02);           /* fechamento no pé do vão */
      for (var bi2 = 0; bi2 <= Math.round(eh / .12); bi2++) caixa(G.acabamento, .02, .9, .02, matEsq, ex + ew - .02, andarH, ez + bi2 * (eh / Math.round(eh / .12)), false);
      caixa(G.acabamento, .04, .9, eh, matEsq, ex + ew + .01, 0, ez + eh / 2).rotation.x = 0;   /* corrimão simplificado ao longo da escada */
    }
    /* ---------- telhado (2 ou 4 águas) sobre a caixa da casa ---------- */
    fk('cobertura');
    if (F.cobertura !== 'platibanda' && anTopo.ambs.length) {
      var bz0 = frenteTopo * CM, bz1 = Math.max.apply(null, anTopo.ambs.map(function (a) { return a.y + a.h; })) * CM, e = .5;
      var X0 = topoX0 - e, X1 = topoX1 + e, Z0 = bz0 - e, Z1 = bz1 + e, W = X1 - X0, D = Z1 - Z0, y0 = yTopo + H + .15, alongX = W >= D;
      var meia = (alongX ? D : W) / 2, rise = meia * .42, y1 = y0 + rise, tri = [];
      function q(a, b, c, d){ tri.push(a, b, c, a, c, d); }
      if (F.cobertura === 'telhado2') {
        if (alongX) { q([X0, y0, Z0], [X1, y0, Z0], [X1, y1, (Z0 + Z1) / 2], [X0, y1, (Z0 + Z1) / 2]); q([X1, y0, Z1], [X0, y0, Z1], [X0, y1, (Z0 + Z1) / 2], [X1, y1, (Z0 + Z1) / 2]); }
        else { q([X0, y0, Z1], [X0, y0, Z0], [(X0 + X1) / 2, y1, Z0], [(X0 + X1) / 2, y1, Z1]); q([X1, y0, Z0], [X1, y0, Z1], [(X0 + X1) / 2, y1, Z1], [(X0 + X1) / 2, y1, Z0]); }
        /* oitões (fechamento triangular) na cor da parede */
        var oit = [];
        if (alongX) { oit.push([X0 + e, y0, Z0 + e], [X0 + e, y0, Z1 - e], [X0 + e, y1 - e * .42, (Z0 + Z1) / 2], [X1 - e, y0, Z1 - e], [X1 - e, y0, Z0 + e], [X1 - e, y1 - e * .42, (Z0 + Z1) / 2]); }
        else { oit.push([X0 + e, y0, Z0 + e], [X1 - e, y0, Z0 + e], [(X0 + X1) / 2, y1 - e * .42, Z0 + e], [X1 - e, y0, Z1 - e], [X0 + e, y0, Z1 - e], [(X0 + X1) / 2, y1 - e * .42, Z1 - e]); }
        var go = new THREE.BufferGeometry(); go.setAttribute('position', new THREE.Float32BufferAttribute([].concat.apply([], oit), 3)); go.computeVertexNormals();
        var mo = new THREE.Mesh(go, new THREE.MeshStandardMaterial({color: F.corParede, roughness:.85, side:THREE.DoubleSide})); mo.castShadow = true; mo.userData.pronto = mo.material; mo.userData.cru = Mt.cruParede; mo.userData.fk = 'cobertura'; G.cobertura.add(mo);
      } else {   /* 4 águas: cumeeira curta no eixo maior */
        if (alongX) { var rx0 = X0 + meia, rx1 = X1 - meia, zm = (Z0 + Z1) / 2;
          q([X0, y0, Z0], [X1, y0, Z0], [rx1, y1, zm], [rx0, y1, zm]); q([X1, y0, Z1], [X0, y0, Z1], [rx0, y1, zm], [rx1, y1, zm]);
          tri.push([X0, y0, Z1], [X0, y0, Z0], [rx0, y1, zm], [X1, y0, Z0], [X1, y0, Z1], [rx1, y1, zm]);
        } else { var rz0 = Z0 + meia, rz1 = Z1 - meia, xm = (X0 + X1) / 2;
          q([X0, y0, Z1], [X0, y0, Z0], [xm, y1, rz0], [xm, y1, rz1]); q([X1, y0, Z0], [X1, y0, Z1], [xm, y1, rz1], [xm, y1, rz0]);
          tri.push([X0, y0, Z0], [X1, y0, Z0], [xm, y1, rz0], [X1, y0, Z1], [X0, y0, Z1], [xm, y1, rz1]);
        }
      }
      var pos = [], uv = [];
      tri.forEach(function (v) { pos.push(v[0], v[1], v[2]); uv.push(v[0], v[2] + v[1] * 1.2); });
      var gt = new THREE.BufferGeometry(); gt.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gt.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); gt.computeVertexNormals();
      var telhado = new THREE.Mesh(gt, matTelha); telhado.castShadow = true; telhado.receiveShadow = true; telhado.userData.pronto = matTelha; telhado.userData.cru = Mt.cruLaje; telhado.userData.fk = 'cobertura'; G.cobertura.add(telhado);
      /* forro do beiral + calha */
      var fb = caixa(G.cobertura, W, .08, D, corMat(F.corParede), (X0 + X1) / 2, y0 - .08, (Z0 + Z1) / 2, false); fb.userData.pronto = fb.material; fb.userData.cru = Mt.cruLaje;
    }
    /* ---------- letreiro com o nome do estabelecimento + totem ---------- */
    fk('letreiro');
    var logoImg = F.logo ? imagem(F.logo) : null;
    if ((F.letreiro || logoImg) && an.ambs.length) {
      if (!F.letreiro) F.letreiro = ' ';   /* só a arte */
      var lz = frenteCm * CM - ESP * CM / 2, larguraFrente = casaX1 - casaX0, fat = LETREIRO_FATOR[F.letreiroTam] || 1, fmt = F.letreiroFormato || 'retangular';
      var lh = (F.cobertura === 'platibanda' ? .7 : .6) * fat * (F.letreiroSub ? 1.35 : 1), lw, lx;
      var lwIdeal = Math.max(2.6, logoImg ? Math.min(6, lh * logoImg.naturalWidth / logoImg.naturalHeight) : F.letreiro.length * .36) * fat;
      if (fmt === 'redondo') lwIdeal = Math.max(1.4, lh * 2.2);
      if (fmt === 'faixa') lwIdeal = larguraFrente - .4;
      var trechoEntrada = entradaInfo ? entradaInfo.q2 - entradaInfo.p2 : 0;
      if (fmt === 'faixa' || F.cobertura === 'platibanda' || !entradaInfo || trechoEntrada < lwIdeal + .4) {   /* platibanda corre a frente toda: centraliza na casa */
        lw = Math.min(larguraFrente - .4, lwIdeal); lx = (casaX0 + casaX1) / 2;
      } else { lw = Math.min(trechoEntrada - .3, lwIdeal); lx = Math.max(entradaInfo.p2 + lw / 2 + .1, Math.min(entradaInfo.q2 - lw / 2 - .1, entradaInfo.cx + .2)); }
      if (F.letreiroLargura > 0) lw = Math.min(larguraFrente - .2, F.letreiroLargura);   /* medida digitada manda */
      if (F.letreiroAltura > 0) lh = F.letreiroAltura;
      if (fmt === 'redondo') lh = lw;   /* círculo de verdade */
      var ly = F.letreiroPos === 'marquise' && (F.marquise || F.pergolado) ? 2.4 : (F.cobertura === 'platibanda' ? Math.min(altTotal + .75 - lh, altTotal + .1) : Math.min(H - lh - .05, 2.32));
      if (F.letreiroPos === 'marquise' && (F.marquise || F.pergolado)) ly = Math.min(2.4, altTotal + .75 - lh);
      var semFundo = F.letreiroEstilo === 'caixa' || F.letreiroEstilo === 'neon';
      var matL = letreiroMat(F.letreiro, F.letreiroEstilo, F.letreiroCor, lw, lh, {formato:fmt, fonte:F.letreiroFonte, sub:F.letreiroSub, fundoCor:F.letreiroFundoCor, logo:logoImg}), prof = F.letreiroEstilo === 'caixa' ? .12 : .06;
      if (!semFundo && (fmt === 'retangular' || fmt === 'faixa')) caixa(G.acabamento, lw + .1, lh + .1, prof, Mt.letreiroFundo, lx, ly - .05, lz - prof / 2 - .01);
      var placa = plano(G.acabamento, lw, lh, matL, lx, ly + lh / 2, lz - prof - .012, false); placa.rotation.set(0, Math.PI, 0); placa.userData.letreiro = F.letreiroLuz;
      if (F.letreiroEstilo === 'caixa') { var placa2 = plano(G.acabamento, lw, lh, matL, lx, ly + lh / 2, lz - prof - .09, false); placa2.rotation.set(0, Math.PI, 0); placa2.userData.letreiro = F.letreiroLuz; }   /* espessura das letras caixa */
      if (F.letreiroLuz) luzes.push({tipo:'ponto', x:lx, y:ly + lh / 2, z:lz - .5, cor:F.letreiroCor, int:6, dist:4});
      /* ---- placas publicitárias ---- */
      var optsL = {fonte:F.letreiroFonte, sub:F.letreiroSub, fundoCor:F.letreiroFundoCor, logo:logoImg};
      if (F.letreiroPos === 'topo') {   /* outdoor sobre a platibanda/cumeeira, em dois montantes */
        var ty = altTotal + (F.cobertura === 'platibanda' ? .75 : 1.2) + .35, tw = Math.min(larguraFrente - .4, Math.max(2.4, lw)), th2 = Math.max(.9, lh * 1.3), tzz = lz + .6;
        placa.visible = false; if (F.letreiroEstilo === 'caixa' && typeof placa2 !== 'undefined') placa2.visible = false;
        caixa(G.acabamento, .1, .5, .1, Mt.metal, lx - tw / 2 + .2, ty - .5, tzz); caixa(G.acabamento, .1, .5, .1, Mt.metal, lx + tw / 2 - .2, ty - .5, tzz);
        caixa(G.acabamento, tw + .1, th2 + .1, .12, Mt.letreiroFundo, lx, ty - .05, tzz);
        var matTopo = letreiroMat(F.letreiro, F.letreiroEstilo === 'caixa' || F.letreiroEstilo === 'neon' ? 'backlight' : F.letreiroEstilo, F.letreiroCor, tw, th2, optsL);
        var pTopo = plano(G.acabamento, tw, th2, matTopo, lx, ty + th2 / 2, tzz - .07, false); pTopo.rotation.set(0, Math.PI, 0); pTopo.userData.letreiro = F.letreiroLuz;
        if (F.letreiroLuz) luzes.push({tipo:'ponto', x:lx, y:ty + th2 / 2, z:tzz - .6, cor:F.letreiroCor, int:8, dist:5});
      }
      if (F.bandeira) {   /* bandeira: placa perpendicular à fachada, ao lado da entrada, lida por quem passa na calçada */
        var bx = entradaInfo ? Math.max(casaX0 + .3, entradaInfo.cx - (entradaInfo.len / 2) - .55) : casaX0 + .6, by = Math.min(H - .9, 2.2), bw = Math.min(1.2, Math.max(.8, F.letreiro.length * .12)), bh = .5;
        caixa(G.acabamento, .06, .06, .7, Mt.metal, bx, by + bh - .03, lz - .35); caixa(G.acabamento, .06, .06, .7, Mt.metal, bx, by + .03, lz - .35);
        var matB = letreiroMat(F.letreiro, F.letreiroEstilo === 'neon' ? 'led' : F.letreiroEstilo, F.letreiroCor, bw, bh, {fonte:F.letreiroFonte, fundoCor:F.letreiroFundoCor, logo:logoImg});
        caixa(G.acabamento, .05, bh, bw, Mt.letreiroFundo, bx, by, lz - .3 - bw / 2);
        var b1 = plano(G.acabamento, bw, bh, matB, bx - .03, by + bh / 2, lz - .3 - bw / 2, false); b1.rotation.set(0, -Math.PI / 2, 0); b1.userData.letreiro = F.letreiroLuz;
        var b2 = plano(G.acabamento, bw, bh, matB, bx + .03, by + bh / 2, lz - .3 - bw / 2, false); b2.rotation.set(0, Math.PI / 2, 0); b2.userData.letreiro = F.letreiroLuz;
        if (F.letreiroLuz) luzes.push({tipo:'ponto', x:bx, y:by + .3, z:lz - .9, cor:F.letreiroCor, int:3, dist:3});
      }
      if (F.placaMuro) {   /* placa no muro da frente, ao lado do portão */
        var pmx = x2 + .12 + Math.min(1.1, (TL - x2) / 2), pmw = Math.min(1.6, Math.max(.9, TL - x2 - .3)), pmh = Math.min(.55, muroH - .25);
        if (TL - x2 > .9 && pmh > .25) {
          var matPM = letreiroMat(F.letreiro, F.letreiroEstilo === 'neon' ? 'placa' : F.letreiroEstilo, F.letreiroCor, pmw, pmh, {fonte:F.letreiroFonte, sub:F.letreiroSub, fundoCor:F.letreiroFundoCor, logo:logoImg});
          caixa(G.terreno, pmw + .06, pmh + .06, .04, Mt.letreiroFundo, pmx, muroH / 2 - pmh / 2 + .1, .02);
          var ppm = plano(G.terreno, pmw, pmh, matPM, pmx, muroH / 2 + .1, -.006, false); ppm.rotation.set(0, Math.PI, 0); ppm.userData.letreiro = F.letreiroLuz;
        }
      }
      if (F.faixa) {   /* faixa/banner de lona com texto próprio (promoção, inauguração…), abaixo do letreiro */
        var fxw = Math.min(larguraFrente - .6, Math.max(2.2, F.faixa.length * .22)), fxh = .55, fxy = Math.max(1.35, Math.min(ly - fxh - .15, H - fxh - .3));
        var matFx = letreiroMat(F.faixa, 'placa', '#FFFFFF', fxw, fxh, {fonte:'display', fundoCor:F.faixaCor || '#E4574F'});
        var fxp = plano(G.acabamento, fxw, fxh, matFx, lx, fxy + fxh / 2, lz - .09, false); fxp.rotation.set(0, Math.PI, 0);
        caixa(G.acabamento, .03, .03, .1, Mt.metal, lx - fxw / 2 + .05, fxy + fxh - .03, lz - .05); caixa(G.acabamento, .03, .03, .1, Mt.metal, lx + fxw / 2 - .05, fxy + fxh - .03, lz - .05);
      }
      if (F.totem) {   /* totem ao lado do portão, virado para a rua */
        var tx = Math.min(TL - .5, gx + gw / 2 + .55), tz = .55, th = 2.6;
        caixa(G.terreno, .5, th, .25, matDest, tx, 0, tz);
        var matT = letreiroMat(F.letreiro, F.letreiroEstilo, F.letreiroCor, .46, .7, {fonte:F.letreiroFonte, sub:F.letreiroSub, fundoCor:F.letreiroFundoCor, logo:logoImg});
        var pt = plano(G.terreno, .46, .7, matT, tx, th - .45, tz - .13, false); pt.rotation.set(0, Math.PI, 0); pt.userData.letreiro = F.letreiroLuz;
        if (F.letreiroLuz) luzes.push({tipo:'ponto', x:tx, y:th - .4, z:tz - .5, cor:F.letreiroCor, int:4, dist:3});
      }
    }

    fk(null);
    /* ---------- luzes da fachada (só acendem à noite) ---------- */
    luzes.push({tipo:'ponto', x:posteLuz.x, y:posteLuz.y, z:posteLuz.z, cor:'#FFE9C4', int:30, dist:14});
    if (F.iluminacao) {
      var nUp = Math.max(2, Math.min(5, Math.round((casaX1 - casaX0) / 2.2)));
      for (var ui = 0; ui < nUp; ui++) luzes.push({tipo:'spot', x: casaX0 + (casaX1 - casaX0) * (ui + .5) / nUp, y:.12, z: frenteCm * CM - .55, cor:'#FFE2B0', int:14, dist:5, alvoY:altTotal});
      if (an.garagem) { var gaL = an.garagem.A || an.garagem.B; luzes.push({tipo:'ponto', x:(gaL.x + gaL.w / 2) * CM, y:H - .3, z:gaL.y * CM - .4, cor:'#FFF1D6', int:6, dist:5}); }
    }

    /* ---------- piscina e jardim ---------- */
    proj.ambientes.filter(function (a) { return !coberto(a); }).forEach(function (r) {
      var x = r.x * CM, z = r.y * CM, w = r.w * CM, d = r.h * CM, cx = x + w / 2, cz = z + d / 2;
      if (r.tipo === 'agua') {
        /* profundidade, raias e salão vêm do próprio ambiente (mesmos campos do model.piscinaCfg) */
        var prof = ((r.prof || 140) + (r.profMax || r.prof || 140)) / 200, vert = r.h >= r.w, larg = vert ? w : d;
        var raias = r.raias || Math.max(1, Math.floor(Math.min(r.w, r.h) / (r.raia || 150)));
        var coberta = proj.ambientes.some(function (b) { return b !== r && coberto(b) && (b.pav || 0) === (r.pav || 0) && r.x >= b.x && r.y >= b.y && r.x + r.w <= b.x + b.w && r.y + r.h <= b.y + b.h; });
        if (!coberta) caixa(G.pisos, w + .8, .06, d + .8, Mt.deck, cx, 0, cz, false);
        caixa(G.pisos, w + .16, coberta ? .13 : .1, d + .16, Mt.piscina, cx, coberta ? 0 : .02, cz, false);   /* borda: dentro do salão sobe 3 cm acima do piso */
        plano(G.pisos, w, d, Mt.piscina, cx, -prof, cz, false);
        caixa(G.pisos, .1, prof + .1, d, Mt.piscina, x + .05, -prof, cz, false); caixa(G.pisos, .1, prof + .1, d, Mt.piscina, x + w - .05, -prof, cz, false);
        caixa(G.pisos, w, prof + .1, .1, Mt.piscina, cx, -prof, z + .05, false); caixa(G.pisos, w, prof + .1, .1, Mt.piscina, cx, -prof, z + d - .05, false);
        var ag = plano(G.acabamento, w - .2, d - .2, Mt.agua, cx, -.25, cz, false); ag.userData.agua = true; ag.receiveShadow = false;
        var lp = caixa(G.pisos, w - .2, .12, d - .2, Mt.laje, cx, -.01, cz, false); lp.visible = false; lp.userData.lp = true;   /* tampa na obra crua */
        /* raias: cordas flutuantes no sentido do comprimento + linha de fundo */
        for (var ri = 1; ri < raias; ri++) {
          var off = larg * ri / raias, matR = ri % 2 ? Mt.branco : Mt.inox;
          if (vert) { caixa(G.acabamento, .06, .05, d - .3, matR, x + off, -.27, cz, false); caixa(G.acabamento, .25, .01, d - .6, Mt.preto, x + off, -prof + .005, cz, false); }
          else      { caixa(G.acabamento, w - .3, .05, .06, matR, cx, -.27, z + off, false); caixa(G.acabamento, w - .6, .01, .25, Mt.preto, cx, -prof + .005, z + off, false); }
        }
        /* blocos de partida na cabeceira, quando é piscina de raias */
        if (raias > 1 && Math.max(w, d) >= 10) for (var bi = 0; bi < raias; bi++) {
          var offB = larg * (bi + .5) / raias;
          if (vert) caixa(G.acabamento, .5, .45, .5, Mt.branco, x + offB, coberta ? .1 : .06, z - .35); else caixa(G.acabamento, .5, .45, .5, Mt.branco, x - .35, coberta ? .1 : .06, z + offB);
        }
        /* espreguiçadeiras (só ao ar livre) */
        if (!coberta && w > 3 && d > 3) { caixa(G.acabamento, .6, .3, 1.6, Mt.branco, x - .9, .06, cz - 1); caixa(G.acabamento, .6, .3, 1.6, Mt.branco, x - .9, .06, cz + 1); }
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
    andares.forEach(function (d) {   /* vigas de cada andar de cima */
      d.an.pecas.forEach(function (pc) {
        var len = pc.len * CM, mid = (pc.p + pc.q) / 2 * CM;
        var vg = pc.o === 'h' ? caixa(G.estrutura, len, .3, .2, Mt.concretoEstr, mid, d.yb + H - .3, pc.c * CM) : caixa(G.estrutura, .2, .3, len, Mt.concretoEstr, pc.c * CM, d.yb + H - .3, mid);
        vg.receiveShadow = false;
      });
    });
    Object.keys(nos).forEach(function (k) {
      var x = nos[k][0] * CM, z = nos[k][1] * CM;
      caixa(G.estrutura, .9, .35, .9, Mt.concretoEstr, x, -.75, z, false);           /* sapata */
      caixa(G.estrutura, .2, altTotal + .5, .2, Mt.concretoEstr, x, -.45, z);         /* pilar até o último andar */
      [[-.05, -.05], [.05, -.05], [-.05, .05], [.05, .05]].forEach(function (o) {  /* arranques de ferro */
        var f = cil(G.estrutura, .008, .6, Mt.ferro, x + o[0], H + .05, z + o[1], 5); f.userData.ferro = true; f.castShadow = false;
      });
    });
    /* ---------- móveis: cada item de proj.moveis, com as medidas do catálogo ---------- */
    var moveis = {}, movMeshes = [];
    (proj.moveis || []).forEach(function (mv) {
      var g = movel3d(mv); g.userData.andarH = andarH; posicionar(g, mv);
      G.moveis.add(g); moveis[mv.id] = g;
      g.traverse(function (o) { if (o.isMesh) movMeshes.push(o); });
    });

    return {raiz:raiz, G:G, pisos:pisos, moveis:moveis, movMeshes:movMeshes, an:an, paradas:paradas(proj, an, andares), H:H, altTotal:altTotal, nPavs:nP, andarH:andarH, TL:TL, TP:TP, portaoX:gx, luzes:luzes, frenteZ:frenteCm * CM, casaX0:casaX0, casaX1:casaX1, entradaX:entradaInfo ? entradaInfo.cx : null, fachada:F};
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
    var noite = !!op.noite, grupoLuz = new THREE.Group(); scene.add(grupoLuz);
    var CEU_DIA = '#D9E7F2', CEU_NOITE = '#0B1522';
    var pos = new THREE.Vector3(), alvo = new THREE.Vector3();          /* pose atual */
    var orb = {theta:2.45, phi:1.08, dist:22, alvo:new THREE.Vector3()}, orbD = {theta:2.45, phi:1.08, dist:22, alvo:new THREE.Vector3()};
    var walk = {yaw:0, pitch:0, pos:new THREE.Vector3(), vel:new THREE.Vector3()};
    var tour = {i:0, t:1, de:null, para:null, olhaYaw:0, olhaPitch:0, auto:false, autoT:0};
    var teclas = {}, ouvintes = [];
    var raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
    var cb = op.on || {};
    function aoImg(){ if (cena) reconstruir(); }
    aoCarregarImg.push(aoImg);

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
      aplicarEtapa(); aplicarTeto(); montarLuzes(); aplicarNoite();
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
      grupoLuz.visible = noite && etapa >= 5;
      sujo = true;
    }
    function aplicarTeto(){ if (cena) { cena.G.cobertura.visible = etapa >= 4 && teto; sujo = true; } }
    /* ---------- noite: céu escuro, sol vira lua, janelas acesas, luzes da fachada ---------- */
    function montarLuzes(){
      while (grupoLuz.children.length) { var c0 = grupoLuz.children[0]; grupoLuz.remove(c0); if (c0.target) grupoLuz.remove(c0.target); }
      if (!cena) return;
      cena.luzes.forEach(function (L) {
        if (L.tipo === 'spot') {
          var sp = new THREE.SpotLight(L.cor, L.int, L.dist, .55, .6, 1.2); sp.position.set(L.x, L.y, L.z); sp.target.position.set(L.x, L.alvoY, L.z + .5); grupoLuz.add(sp); grupoLuz.add(sp.target);
          var bulb = new THREE.Mesh(new THREE.SphereGeometry(.05, 6, 5), new THREE.MeshBasicMaterial({color:'#FFE2B0'})); bulb.position.set(L.x, L.y, L.z); grupoLuz.add(bulb);
        } else {
          var pl = new THREE.PointLight(L.cor, L.int, L.dist, 1.6); pl.position.set(L.x, L.y, L.z); grupoLuz.add(pl);
          var bulb2 = new THREE.Mesh(new THREE.SphereGeometry(.07, 6, 5), new THREE.MeshBasicMaterial({color:L.cor})); bulb2.position.set(L.x, L.y, L.z); grupoLuz.add(bulb2);
        }
      });
    }
    function aplicarNoite(){
      var Mt = materiais();
      scene.background = new THREE.Color(noite ? CEU_NOITE : CEU_DIA); scene.fog.color.set(noite ? CEU_NOITE : CEU_DIA);
      if (!luzManual) { sol.intensity = noite ? .12 : 1.9; sol.color.set(noite ? '#9FB4D6' : '#FFF3DC'); hemi.intensity = noite ? .12 : .85; fill.intensity = noite ? .05 : .55; }
      grupoLuz.visible = noite && etapa >= 5;
      renderer.toneMappingExposure = noite ? 1.15 : .95;
      if (cena) cena.raiz.traverse(function (o) {
        if (o.userData && o.userData.janela) o.material = noite && etapa >= 5 ? Mt.vidroNoite : Mt.vidro;
        if (o.userData && o.userData.letreiro !== undefined && o.material && o.material.userData) o.material.emissiveIntensity = noite && o.userData.letreiro && o.material.userData.acende ? 1.35 : 0;
      });
      sujo = true;
    }
    function setNoite(v){ noite = !!v; aplicarNoite(); if (cb.noite) cb.noite(noite); }
    /* câmera de frente para a fachada, na altura de quem está na calçada */
    function verFachada(imediato, fator){   /* fator < 1 aproxima (conferência: &fz=0.5) */
      if (!cena) return;
      if (modo !== 'orbit') setModo('orbit');
      var w = cena.casaX1 - cena.casaX0;
      orbD.alvo.set(fator && fator < 1 && cena.entradaX !== null ? cena.entradaX : (cena.casaX0 + cena.casaX1) / 2, fator && fator < 1 ? 1.6 : 1.4, cena.frenteZ + 1.5); orbD.theta = Math.PI + .28; orbD.phi = 1.32; orbD.dist = Math.max(9, w * 1.35 + 5) * (fator || 1);
      if (imediato) {   /* sem interpolação: a foto sai já do ângulo certo */
        orb.theta = orbD.theta; orb.phi = orbD.phi; orb.dist = orbD.dist; orb.alvo.copy(orbD.alvo);
        pos.set(orb.alvo.x + orb.dist * Math.sin(orb.phi) * Math.sin(orb.theta), orb.alvo.y + orb.dist * Math.cos(orb.phi), orb.alvo.z + orb.dist * Math.sin(orb.phi) * Math.cos(orb.theta));
        alvo.copy(orb.alvo); camera.position.copy(pos); camera.lookAt(alvo);
      }
      sujo = true;
    }

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
    var fkHover = null;
    on(canvas, 'pointermove', function (e) {
      var p = ptr[e.pointerId];
      if (!p) {   /* só passando o mouse: destaca o elemento de fachada clicável */
        if (cb.fachadaHover && e.pointerType !== 'touch') { var fh = sobFachada(e), fhk = fh ? fh.fk + '|' + fh.id : null; if (fhk !== fkHover) { fkHover = fhk; canvas.style.cursor = fh ? 'pointer' : ''; cb.fachadaHover(fh ? fh.fk : null, e.clientX, e.clientY, fh ? fh.id : null); } }
        return;
      }
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
      if (cb.fachadaClique) { var fkh = sobFachada(e); if (fkh) { cb.fachadaClique(fkh.fk, e.clientX, e.clientY, fkh.id); return; } }
      var hit = sob(e);
      if (hit && hit.userData.ambId && cb.clique) cb.clique(hit.userData.ambId);
      if (hit && hit.userData.ambId && modo !== 'walk' && op.cliqueVai !== false) irAmbiente(hit.userData.ambId);
    }
    /* elemento de fachada sob o ponteiro (janela, porta, muro…) — lista de malhas etiquetadas, refeita a cada construção */
    var fkCache = null;
    function sobFachada(e){
      if (!cena) return null;
      var r = canvas.getBoundingClientRect();
      ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      if (!fkCache || fkCache.cena !== cena) { fkCache = []; fkCache.cena = cena; cena.raiz.traverse(function (o) { if (o.isMesh && o.userData.fk) fkCache.push(o); }); }
      var hits = raycaster.intersectObjects(fkCache, false);
      for (var i = 0; i < hits.length; i++) { var o = hits[i].object, vis = true, p = o; while (p) { if (p.visible === false) { vis = false; break; } p = p.parent; } if (vis) return {fk:o.userData.fk, id:o.userData.fkid || null}; }
      return null;
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
      var ambAlvo = dentroCasa ? (noite ? .9 : 1.7) : (noite ? .06 : .28); if (!luzManual) amb.intensity += (ambAlvo - amb.intensity) * k;
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
      get noite(){ return noite; }, setNoite:setNoite, verFachada:verFachada,
      get teto(){ return teto; }, setTeto:function (v) { teto = !!v; aplicarTeto(); },
      get parada(){ return tour.i; }, get paradas(){ return cena ? cena.paradas : []; },
      irParada:irParada, irAmbiente:irAmbiente, proxima:function () { irParada(tour.i + 1); }, anterior:function () { irParada(tour.i - 1); },
      get auto(){ return tour.auto; }, setAuto:function (v) { tour.auto = !!v; tour.autoT = 0; sujo = true; },
      setProgresso:setProgresso,
      luz:function (a, b, c, d) { luzManual = true; if (a === null) { luzManual = false; aplicarNoite(); return; } sol.intensity = a; hemi.intensity = b; amb.intensity = c; if (d !== undefined) sol.castShadow = !!d; sujo = true; }, _cena:function () { return cena; },
      atualizar:reconstruir,
      foto:function () { renderer.render(scene, camera); return canvas.toDataURL('image/png'); },
      desmontar:function () { var ii = aoCarregarImg.indexOf(aoImg); if (ii >= 0) aoCarregarImg.splice(ii, 1);
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

  return {analise:analise, paradas:paradas, quadro:quadro, frase:frase, montar:montar, passeio:passeio, ETAPAS:ETAPAS, coberto:coberto, FACHADA_PRESETS:FACHADA_PRESETS, FACHADA_EXTRA:FACHADA_EXTRA, JANELAS:JANELAS, VIDROS:VIDROS, PORTAS:PORTAS, PORTAS_LOJA:PORTAS_LOJA, LETREIRO_FORMATOS:LETREIRO_FORMATOS, LETREIRO_POS:LETREIRO_POS, LETREIRO_TAMS:LETREIRO_TAMS, LETREIRO_FONTES:LETREIRO_FONTES, GARAGENS:GARAGENS, PISOS_FRENTE:PISOS_FRENTE, fachadaDe:fachadaDe, fachadaPorPrompt:fachadaPorPrompt};
}

var TRES = (typeof THREE !== 'undefined' && typeof M !== 'undefined') ? TRES_ENGINE(THREE, M) : null;
