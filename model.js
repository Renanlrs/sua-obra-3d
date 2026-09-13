/* =========================================================================
   MODEL — fonte única da verdade.
   Tudo em CENTÍMETROS INTEIROS. Nenhuma área, total ou percentual é
   guardado: é sempre calculado por função pura a partir de `M.proj`.
   ========================================================================= */
var M = (function () {

  /* ---------- catálogo de tipos de ambiente ---------- */
  var TIPOS = {
    social:     {rot:'Social',      cor:'#3D7EA6', custo:{economico:2000, padrao:2600, superior:3600}},
    intimo:     {rot:'Íntimo',      cor:'#5B6FA6', custo:{economico:1900, padrao:2500, superior:3500}},
    molhado:    {rot:'Molhado',     cor:'#2E93A8', custo:{economico:2600, padrao:3400, superior:4600}},
    servico:    {rot:'Serviço',     cor:'#6B7885', custo:{economico:1500, padrao:2000, superior:2700}},
    circulacao: {rot:'Circulação',  cor:'#8A9199', custo:{economico:1400, padrao:1800, superior:2400}},
    garagem:    {rot:'Garagem',     cor:'#7A8794', custo:{economico:900,  padrao:1200, superior:1700}},
    agua:       {rot:'Piscina',     cor:'#7FD6E8', custo:{economico:4200, padrao:5700, superior:7400}},
    externo:    {rot:'Externo',     cor:'#8FAE7C', custo:{economico:300,  padrao:500,  superior:900}}
  };

  /* biblioteca — largura x profundidade típicas, em cm */
  var LIB = [
    {nome:'Sala de estar',    tipo:'social',     w:400, h:450},
    {nome:'Sala de jantar',   tipo:'social',     w:300, h:350},
    {nome:'Cozinha',          tipo:'molhado',    w:300, h:350},
    {nome:'Quarto',           tipo:'intimo',     w:300, h:350},
    {nome:'Suíte',            tipo:'intimo',     w:350, h:400},
    {nome:'Banheiro',         tipo:'molhado',    w:170, h:250},
    {nome:'Lavabo',           tipo:'molhado',    w:120, h:180},
    {nome:'Área de serviço',  tipo:'servico',    w:200, h:250},
    {nome:'Despensa',         tipo:'servico',    w:150, h:180},
    {nome:'Escritório',       tipo:'social',     w:280, h:300},
    {nome:'Corredor',         tipo:'circulacao', w:120, h:400},
    {nome:'Hall',             tipo:'circulacao', w:200, h:200},
    {nome:'Garagem',          tipo:'garagem',    w:280, h:500},
    {nome:'Varanda',          tipo:'social',     w:300, h:200},
    {nome:'Piscina',          tipo:'agua',       w:300, h:600},
    {nome:'Jardim',           tipo:'externo',    w:300, h:300},
    {nome:'Loja',             tipo:'social',     w:380, h:400},
    {nome:'Recepção',         tipo:'social',     w:350, h:350},
    {nome:'Vestiário',        tipo:'molhado',    w:360, h:420},
    {nome:'Depósito',         tipo:'servico',    w:200, h:250}
  ];

  /* programas iniciais por tipo de projeto */
  var PROGRAMAS = {
    'casa-terrea':  {rot:'Casa térrea',      desc:'3 quartos, sala, cozinha',
      itens:['Garagem','Varanda','Sala de estar','Cozinha','Área de serviço','Banheiro','Quarto','Quarto','Suíte','Corredor']},
    'casa-compacta':{rot:'Casa compacta',    desc:'2 quartos, econômica',
      itens:['Varanda','Sala de estar','Cozinha','Área de serviço','Banheiro','Quarto','Quarto','Corredor']},
    'sobrado':      {rot:'Sobrado',          desc:'2 pavimentos',
      itens:['Garagem','Sala de estar','Sala de jantar','Cozinha','Lavabo','Área de serviço','Quarto','Quarto','Suíte','Banheiro','Corredor']},
    'apartamento':  {rot:'Apartamento',      desc:'2 quartos, planta compacta',
      itens:['Sala de estar','Cozinha','Área de serviço','Banheiro','Quarto','Suíte','Corredor']},
    'loja':         {rot:'Loja / comércio',  desc:'salão, estoque, WC',
      itens:['Loja','Recepção','Depósito','Banheiro','Corredor']},
    'piscina':      {rot:'Área de lazer',    desc:'piscina, deck, apoio',
      itens:['Piscina','Varanda','Banheiro','Depósito','Jardim']},
    'zero':         {rot:'Do zero',          desc:'terreno vazio', itens:[]}
  };

  var PADROES = {
    economico:{rot:'Econômico', fator:1},
    padrao:   {rot:'Padrão',    fator:1},
    superior: {rot:'Superior',  fator:1}
  };

  /* ---------- estado ---------- */
  var proj = null, hist = [], fut = [], saveTimer = null, listeners = [];

  function uid(){ return Math.random().toString(36).slice(2, 9); }

  function novo(tipoKey, largCm, profCm, nome){
    var pr = PROGRAMAS[tipoKey] || PROGRAMAS.zero;
    proj = {
      id: uid(),
      nome: nome || pr.rot,
      tipoKey: tipoKey,
      criado: Date.now(),
      terreno: {largura: largCm, profundidade: profCm, recuoFrontal: 400, recuoLateral: 150, recuoFundo: 300},
      peDireito: 280,
      padrao: 'padrao',
      meta: 0,
      ambientes: [],
      moveis: []
    };
    if (pr.itens.length) { gerar(pr.itens); mobiliarAuto(); }
    hist = []; fut = []; base = snap();
    return proj;
  }

  /* ---------- móveis (a lista mora em proj.moveis; medidas padrão vêm do catálogo) ---------- */
  function lados(){
    /* lado da porta de cada ambiente — sai da análise do 3D quando ela existe */
    try { if (window.TRES && proj.ambientes.length) return TRES.analise(proj).lado || {}; } catch (e) {}
    return {};
  }
  function mobiliarAuto(){
    if (!window.MOVEIS) return [];
    var novos = MOVEIS.auto(proj, lados());
    novos.forEach(function (m) { m.id = uid(); });
    proj.moveis = novos;
    return novos;
  }
  function movelDe(id){
    if (!proj || !proj.moveis) return null;
    return proj.moveis.filter(function (m) { return m.id === id; })[0] || null;
  }
  function addMovel(k, x, y, rot, extra){
    if (!proj.moveis) proj.moveis = [];
    var m = {id:uid(), k:k, x:Math.round(x), y:Math.round(y), rot:((rot || 0) + 360) % 360};
    if (extra) for (var p in extra) m[p] = extra[p];
    var a = ambienteDe(m); if (a) m.amb = a.id;
    proj.moveis.push(m);
    return m;
  }
  /* ambiente que contém o centro do móvel (derivado; m.amb é só cache para o 3D) */
  function ambienteDe(m){
    for (var i = 0; i < proj.ambientes.length; i++) {
      var r = proj.ambientes[i];
      if (m.x >= r.x && m.x <= r.x + r.w && m.y >= r.y && m.y <= r.y + r.h) return r;
    }
    return null;
  }
  function moveisDe(ambId){
    return (proj.moveis || []).filter(function (m) { var a = ambienteDe(m); return a && a.id === ambId; });
  }

  /* ---------- gerador determinístico de planta ----------
     Não é IA: empacota os ambientes em faixas dentro da área útil,
     abre corredor quando há ambientes íntimos, e nunca deixa nada
     fora do terreno. Zonas: frente = social, fundo = íntimo.         */
  function gerar(nomes){
    var t = proj.terreno;
    var x0 = t.recuoLateral, y0 = t.recuoFrontal;
    var largUtil = t.largura - t.recuoLateral * 2;
    var profUtil = t.profundidade - t.recuoFrontal - t.recuoFundo;
    if (largUtil < 200 || profUtil < 200) return;

    var itens = nomes.map(function (n) {
      var b = LIB.filter(function (l) { return l.nome === n; })[0];
      return b ? {nome: b.nome, tipo: b.tipo, w: b.w, h: b.h} : null;
    }).filter(Boolean);

    /* ordem: externo/garagem, social, molhado+serviço, íntimo */
    var ordem = {garagem:0, externo:0, social:1, circulacao:2, molhado:3, servico:3, intimo:4, agua:5};
    function zona(t){ return t in ordem ? ordem[t] : 9; }   /* 'in': garagem tem zona 0, e 0 é falsy */
    itens.sort(function (a, b) { return zona(a.tipo) - zona(b.tipo); });

    /* empacota em faixas horizontais; cada faixa vira uma linha da planta */
    var faixas = [], linha = [], larguraLinha = 0;
    function fechaLinha(){
      if (!linha.length) return;
      var alt = Math.max.apply(null, linha.map(function (i) { return i.h; }));
      /* estica a linha para ocupar a largura útil inteira, sem sobra nem folga */
      var sobra = largUtil - larguraLinha, add = Math.floor(sobra / linha.length);
      var x = x0, itensLinha = [];
      linha.forEach(function (it, k) {
        var w = it.w + add + (k === linha.length - 1 ? sobra - add * linha.length : 0);
        itensLinha.push({id: uid(), nome: it.nome, tipo: it.tipo, x: x, y: 0, w: w, h: alt});
        x += w;
      });
      faixas.push({alt: alt, itens: itensLinha});
      linha = []; larguraLinha = 0;
    }
    itens.forEach(function (it) {
      if (larguraLinha + it.w > largUtil && linha.length) fechaLinha();
      linha.push(it); larguraLinha += it.w;
    });
    fechaLinha();

    /* comprime se estourou a profundidade — com piso de 90 cm por faixa */
    var usado = faixas.reduce(function (s, f) { return s + f.alt; }, 0);
    if (usado > profUtil && usado > 0) {
      var f = profUtil / usado;
      faixas.forEach(function (fx) { fx.alt = Math.max(90, Math.round(fx.alt * f)); });
    }

    /* empilha as faixas na sequência — é isto que garante que nada se sobrepõe,
       mesmo depois de o piso de 90 cm ter quebrado a proporção da compressão */
    var out = [], y = y0;
    faixas.forEach(function (fx) {
      fx.itens.forEach(function (a) { a.y = y; a.h = fx.alt; out.push(a); });
      y += fx.alt;
    });
    proj.ambientes = out;
  }

  /* ---------- derivadas (funções puras) ---------- */
  function areaOf(a){ return a.w * a.h; }                        // cm²
  function areaTerreno(){ return proj.terreno.largura * proj.terreno.profundidade; }
  function ambientesCobertos(){
    return proj.ambientes.filter(function (a) { return a.tipo !== 'externo' && a.tipo !== 'agua'; });
  }
  function areaConstruida(){
    return ambientesCobertos().reduce(function (s, a) { return s + areaOf(a); }, 0);
  }
  function areaTotalAmbientes(){
    return proj.ambientes.reduce(function (s, a) { return s + areaOf(a); }, 0);
  }
  function ocupacao(){ return areaTerreno() ? areaConstruida() / areaTerreno() * 100 : 0; }
  function espelhoAgua(){
    return proj.ambientes.filter(function (a) { return a.tipo === 'agua'; })
      .reduce(function (s, a) { return s + areaOf(a); }, 0);
  }
  function custoDe(a){
    var t = TIPOS[a.tipo]; if (!t) return 0;
    return Math.round(areaOf(a) / 10000 * t.custo[proj.padrao] * 100); // centavos
  }
  function custoTotal(){
    return proj.ambientes.reduce(function (s, a) { return s + custoDe(a); }, 0);
  }
  function custoPorM2(){
    var ac = areaConstruida() / 10000;
    return ac ? Math.round(custoTotal() / ac) : 0;
  }
  function bbox(){
    if (!proj.ambientes.length) return {x:0, y:0, w:proj.terreno.largura, h:proj.terreno.profundidade};
    var xs = proj.ambientes.map(function(a){return a.x;}), ys = proj.ambientes.map(function(a){return a.y;});
    var xe = proj.ambientes.map(function(a){return a.x+a.w;}), ye = proj.ambientes.map(function(a){return a.y+a.h;});
    var x = Math.min.apply(null, xs), y = Math.min.apply(null, ys);
    return {x:x, y:y, w: Math.max.apply(null, xe) - x, h: Math.max.apply(null, ye) - y};
  }

  /* ---------- validação (avisa, nunca quebra) ---------- */
  function problemas(){
    var p = [], t = proj.terreno;
    proj.ambientes.forEach(function (a) {
      if (a.x < 0 || a.y < 0 || a.x + a.w > t.largura || a.y + a.h > t.profundidade)
        p.push({id:a.id, tipo:'fora', msg: a.nome + ' está fora do terreno'});
      if (a.w < 90 || a.h < 90)
        p.push({id:a.id, tipo:'pequeno', msg: a.nome + ' ficou menor que 0,90 m'});
    });
    for (var i = 0; i < proj.ambientes.length; i++)
      for (var j = i + 1; j < proj.ambientes.length; j++) {
        var A = proj.ambientes[i], B = proj.ambientes[j];
        var ov = A.x < B.x + B.w && B.x < A.x + A.w && A.y < B.y + B.h && B.y < A.y + A.h;
        if (ov) p.push({id:A.id, tipo:'sobrepoe', msg: A.nome + ' está sobrepondo ' + B.nome});
      }
    if (ocupacao() > 70)
      p.push({id:null, tipo:'ocupacao', msg:'Taxa de ocupação em ' + fmtPct(ocupacao()) + ' — a maioria dos municípios limita em 50% a 70%'});
    return p;
  }

  /* ---------- formatação — vírgula decimal, 2 casas, sufixo ---------- */
  function fmtM(cm){ return num(cm / 100) + ' m'; }
  function fmtMs(cm){ return num(cm / 100); }
  function fmtM2(cm2){ return num(cm2 / 10000) + ' m²'; }
  function fmtPct(n){ return num(n) + '%'; }
  function fmtBRL(cent){
    return (cent / 100).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
  }
  function num(n){
    return Number(n).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
  }
  /* aceita "3,60", "3.60" e "360" (>=40 vira centímetro) */
  function parseM(txt){
    var s = String(txt).trim().replace(/\s|m²|m/g, '').replace(',', '.');
    var v = parseFloat(s);
    if (isNaN(v)) return null;
    return v >= 40 ? Math.round(v) : Math.round(v * 100);
  }

  /* ---------- histórico ---------- */
  /* `base` é o estado logo depois do último commit (ou da abertura). Como as
     mudanças são feitas no lugar e o commit vem DEPOIS, é a base que vai para
     o histórico — assim o primeiro Ctrl+Z desfaz de verdade. */
  var base = null;
  function snap(){ return JSON.stringify(proj); }
  function commit(nome){
    hist.push({nome: nome, dado: base || snap()});
    if (hist.length > 100) hist.shift();
    base = snap(); fut = [];
    salvar(); emitir();
  }
  function undo(){
    if (!hist.length) return null;
    var p = hist.pop();
    fut.push({nome: p.nome, dado: snap()});
    proj = JSON.parse(p.dado); base = p.dado;
    salvar(); emitir();
    return p.nome;
  }
  function redo(){
    if (!fut.length) return null;
    var p = fut.pop();
    hist.push({nome: p.nome, dado: snap()});
    proj = JSON.parse(p.dado); base = p.dado;
    salvar(); emitir();
    return p.nome;
  }
  function podeUndo(){ return hist.length > 0; }
  function podeRedo(){ return fut.length > 0; }
  function proxUndo(){ return hist.length ? hist[hist.length - 1].nome : ''; }

  /* ---------- persistência ---------- */
  var KEY = 'suaobra3d.v1';
  function todos(){
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; }
  }
  function salvar(){
    if (!proj) return;
    clearTimeout(saveTimer);
    if (window.UI) UI.saveState('Salvando…');
    saveTimer = setTimeout(function () {
      var all = todos();
      proj.salvo = Date.now();
      all[proj.id] = proj;
      try { localStorage.setItem(KEY, JSON.stringify(all)); localStorage.setItem(KEY + '.ultimo', proj.id); }
      catch (e) { if (window.UI) UI.toast('Não consegui salvar: armazenamento cheio.', null, true); }
      if (window.UI) UI.saveState('Salvo');
    }, 800);
  }
  function abrir(id){
    var all = todos();
    if (!all[id]) return false;
    proj = all[id]; hist = []; fut = [];
    if (!proj.moveis) mobiliarAuto();   /* projeto salvo antes dos móveis existirem */
    base = snap();
    emitir(); return true;
  }
  function excluir(id){
    var all = todos(); delete all[id];
    localStorage.setItem(KEY, JSON.stringify(all));
  }
  function ultimoId(){ return localStorage.getItem(KEY + '.ultimo'); }

  function onChange(fn){ listeners.push(fn); }
  function emitir(){ listeners.forEach(function (f) { f(); }); }

  return {
    TIPOS:TIPOS, LIB:LIB, PROGRAMAS:PROGRAMAS, PADROES:PADROES,
    get proj(){ return proj; }, set proj(v){ proj = v; },
    uid:uid, novo:novo, gerar:gerar,
    mobiliarAuto:mobiliarAuto, movelDe:movelDe, addMovel:addMovel, ambienteDe:ambienteDe, moveisDe:moveisDe,
    areaOf:areaOf, areaTerreno:areaTerreno, areaConstruida:areaConstruida,
    areaTotalAmbientes:areaTotalAmbientes, ocupacao:ocupacao, espelhoAgua:espelhoAgua,
    custoDe:custoDe, custoTotal:custoTotal, custoPorM2:custoPorM2, bbox:bbox, problemas:problemas,
    fmtM:fmtM, fmtMs:fmtMs, fmtM2:fmtM2, fmtPct:fmtPct, fmtBRL:fmtBRL, num:num, parseM:parseM,
    commit:commit, undo:undo, redo:redo, podeUndo:podeUndo, podeRedo:podeRedo, proxUndo:proxUndo,
    salvar:salvar, abrir:abrir, excluir:excluir, todos:todos, ultimoId:ultimoId, onChange:onChange
  };
})();
