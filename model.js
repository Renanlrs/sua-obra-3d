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
    if (pr.itens.length) { gerar(pr.itens); if (tipoKey === 'sobrado') subirIntimos(); mobiliarAuto(); }
    pavAtual = 0;
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
    novos.forEach(function (m) { m.id = uid(); var r = m.amb && proj.ambientes.filter(function (a) { return a.id === m.amb; })[0]; if (r && pavDe(r)) m.pav = pavDe(r); });
    proj.moveis = novos;
    return novos;
  }
  function movelDe(id){
    if (!proj || !proj.moveis) return null;
    return proj.moveis.filter(function (m) { return m.id === id; })[0] || null;
  }
  function addMovel(k, x, y, rot, extra){
    if (!proj.moveis) proj.moveis = [];
    var m = {id:uid(), k:k, x:Math.round(x), y:Math.round(y), rot:((rot || 0) + 360) % 360, pav:pavAtual};
    if (extra) for (var p in extra) m[p] = extra[p];
    if (!m.pav) delete m.pav;
    var a = ambienteDe(m); if (a) m.amb = a.id;
    proj.moveis.push(m);
    return m;
  }
  /* ambiente que contém o centro do móvel (derivado; m.amb é só cache para o 3D) */
  function ambienteDe(m){
    for (var i = 0; i < proj.ambientes.length; i++) {
      var r = proj.ambientes[i];
      if (pavDe(r) !== (m.pav || 0)) continue;
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
  /* ---------- pavimentos: cada ambiente tem `pav` (0 = térreo); a lista de ambientes continua única ----------
     pavAtual é estado de tela (não é dado do projeto). */
  var pavAtual = 0;
  function pavDe(a){ return a.pav || 0; }
  function nPavs(){ return proj.ambientes.reduce(function (m, a) { return Math.max(m, pavDe(a) + 1); }, 1); }
  function ambsPav(n){ return proj.ambientes.filter(function (a) { return pavDe(a) === n; }); }
  function nomePav(n){ return n === 0 ? 'Térreo' : n + 'º andar'; }
  function setPav(n){ pavAtual = Math.max(0, Math.min(nPavs() - 1, n | 0)); return pavAtual; }
  function cobertoAmb(a){ return a.tipo !== 'externo' && a.tipo !== 'agua'; }
  /* fração (0..1) do ambiente apoiada em ambientes cobertos do andar de baixo */
  function apoio(a){
    if (!pavDe(a)) return 1;
    var tot = 0; ambsPav(pavDe(a) - 1).filter(cobertoAmb).forEach(function (b) {
      var w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (w > 0 && h > 0) tot += w * h;
    });
    return areaOf(a) ? Math.min(1, tot / areaOf(a)) : 1;
  }
  /* novo andar em cima: copia os cobertos do andar de baixo (sem garagem) ou cria um ambiente sobre o maior */
  function addPavimento(copiar){
    var n = nPavs(); if (n >= 4) return n - 1;
    var baixo = ambsPav(n - 1).filter(function (a) { return cobertoAmb(a) && a.tipo !== 'garagem'; });
    if (copiar && baixo.length) {
      baixo.forEach(function (a) { proj.ambientes.push({id:uid(), nome:a.nome, tipo:a.tipo, x:a.x, y:a.y, w:a.w, h:a.h, pav:n}); });
    } else {
      var maior = baixo.sort(function (a, b) { return areaOf(b) - areaOf(a); })[0] || {x:proj.terreno.recuoLateral, y:proj.terreno.recuoFrontal, w:400, h:400};
      proj.ambientes.push({id:uid(), nome:'Ambiente', tipo:'intimo', x:maior.x, y:maior.y, w:maior.w, h:maior.h, pav:n});
    }
    pavAtual = n; return n;
  }
  function removerPavimento(n){
    if (n <= 0 || n >= nPavs()) return;
    proj.ambientes = proj.ambientes.filter(function (a) { return pavDe(a) !== n; });
    proj.ambientes.forEach(function (a) { if (pavDe(a) > n) a.pav = pavDe(a) - 1; });
    proj.moveis = (proj.moveis || []).filter(function (m) { return (m.pav || 0) !== n; });
    proj.moveis.forEach(function (m) { if ((m.pav || 0) > n) m.pav = m.pav - 1; });
    proj.ambientes.forEach(function (a) { if (!a.pav) delete a.pav; }); proj.moveis.forEach(function (m) { if (!m.pav) delete m.pav; });
    pavAtual = Math.min(pavAtual, nPavs() - 1);
  }
  /* sobrado gerado: quartos/suíte/banheiro sobem e são empilhados sobre o bloco social, com um hall */
  function subirIntimos(){
    var sobem = proj.ambientes.filter(function (a) { return a.tipo === 'intimo' || (a.tipo === 'molhado' && /banheiro/i.test(a.nome)); });
    if (sobem.length < 2) return;
    sobem.forEach(function (a) { a.pav = 1; });
    proj.ambientes = proj.ambientes.filter(function (a) { return pavDe(a) === 0 || sobem.indexOf(a) >= 0; });
    var fica = ambsPav(0).filter(cobertoAmb);
    if (!fica.length) return;
    var bx = Math.min.apply(null, fica.map(function (a) { return a.x; })), by = Math.min.apply(null, fica.map(function (a) { return a.y; }));
    var bw = Math.max.apply(null, fica.map(function (a) { return a.x + a.w; })) - bx;
    var hall = {id:uid(), nome:'Hall', tipo:'circulacao', x:bx, y:by, w:Math.min(200, bw), h:200, pav:1};
    proj.ambientes.push(hall);
    var x = bx + hall.w, y = by, alt = hall.h;
    sobem.forEach(function (a) {
      if (a.w > bw) a.w = bw;
      if (x + a.w > bx + bw + 1) { x = bx; y += alt; alt = 0; }
      a.x = x; a.y = y; x += a.w; alt = Math.max(alt, a.h);
    });
  }
  /* escada (derivada): no maior ambiente de circulação do térreo, senão no maior social; encostada na parede esquerda, no fundo */
  function escada(){
    if (nPavs() < 2) return null;
    var cands = ambsPav(0).filter(function (a) { return a.tipo === 'circulacao' && a.w >= 100 && a.h >= 300; });
    if (!cands.length) cands = ambsPav(0).filter(function (a) { return a.tipo === 'social' && a.w >= 200 && a.h >= 300; });
    if (!cands.length) cands = ambsPav(0).filter(function (a) { return cobertoAmb(a) && a.tipo !== 'garagem' && a.h >= 300; });
    if (!cands.length) return null;
    var r = cands.sort(function (a, b) { return areaOf(b) - areaOf(a); })[0];
    var w = Math.min(100, r.w), h = Math.min(300, r.h - 20);
    return {amb:r, x:r.x, y:r.y + r.h - h, w:w, h:h, degraus:Math.max(10, Math.round(proj.peDireito / 18))};
  }
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
  /* projeção = só o térreo (andar de cima não ocupa terreno) */
  function projecao(){ return ambsPav(0).filter(cobertoAmb).reduce(function (s, a) { return s + areaOf(a); }, 0); }
  function ocupacao(){ return areaTerreno() ? projecao() / areaTerreno() * 100 : 0; }
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
  /* ---------- fachada: custo do que foi escolhido (centavos), separado do custo dos ambientes ---------- */
  var PRECO_FACHADA = {
    revestimento:{nenhum:0, ripado:42000, pedra:38000, tijolo:26000, cimento:14000},   /* por m² de testada */
    cobertura:{platibanda:0, telhado2:18000, telhado4:23000},                            /* por m² construído */
    telha:{ceramica:0, concreto:3000, metalica:-4000},                                   /* ajuste por m² construído */
    portao:{grade:350000, ripado:650000, chapa:480000},
    muro:{baixo:0, alto:26000, vidro:90000},                                             /* alto: por m linear de testada */
    jardim:180000, marquise:320000, iluminacao:240000,
    letreiro:{placa:120000, caixa:380000, led:650000, neon:550000, backlight:480000}, totem:450000,
    vitrine:95000,                                                                        /* por m² de frente envidraçada */
    pergolado:320000,
    /* detalhe fino (por unidade, exceto onde indicado) */
    janela:{correr:0, fixa:-4000, guilhotina:6000, basculante:3000, veneziana:9000, quadriculada:7000},   /* por janela */
    vidro:{incolor:0, fume:3500, verde:3000, espelhado:5500},                                          /* por janela */
    moldura:2800, gradeJanela:4500, brise:12000,                                                       /* por janela */
    porta:{madeira:0, pivotante:520000, vidro:380000, dupla:290000, ripada:260000, aco:180000, enrolar:240000, subir:210000, correr:890000, vidroDupla:520000, gradeLoja:160000, articulada:190000},   /* loja: por m² da abertura acima de 1,9 m² */
    letreiroTam:{p:.7, m:1, g:1.4, gg:1.9},
    garagem:{basculante:0, enrolar:180000, ripado:420000, vidro:650000},
    arandelas:38000, vasos:26000,
    pisoFrente:{concreto:0, pedra:18000, deck:26000, intertravado:9000, grama:-6000}                   /* por m² do caminho */
  };
  function fachadaCfg(){
    if (window.TRES) return TRES.fachadaDe(proj);
    var f = proj.fachada || {}; return {estilo:f.estilo || 'moderno', revestimento:f.revestimento || 'ripado', cobertura:f.cobertura || 'platibanda', telha:f.telha || 'concreto', portao:f.portao || 'ripado', muro:f.muro || 'baixo', jardim:f.jardim !== false, marquise:f.marquise !== false, iluminacao:f.iluminacao !== false, vitrine:!!f.vitrine, pergolado:!!f.pergolado, letreiro:f.letreiro || '', letreiroEstilo:f.letreiroEstilo || 'led', totem:!!f.totem, janela:f.janela || 'correr', vidro:f.vidro || 'incolor', moldura:!!f.moldura, gradeJanela:!!f.gradeJanela, brise:!!f.brise, porta:f.porta || 'madeira', garagem:f.garagem || 'basculante', arandelas:!!f.arandelas, vasos:!!f.vasos, pisoFrente:f.pisoFrente || 'concreto', portaLargura:f.portaLargura || 0, portaAltura:f.portaAltura || 0, letreiroTam:f.letreiroTam || 'm'};
  }
  function testada(){   /* largura da frente construída, em cm */
    var cob = ambientesCobertos(); if (!cob.length) return 0;
    var yMin = Math.min.apply(null, cob.map(function (a) { return a.y; }));
    var frente = cob.filter(function (a) { return a.y <= yMin + 60 && a.tipo !== 'garagem'; });
    return frente.reduce(function (s2, a) { return s2 + a.w; }, 0);
  }
  function custoFachadaItens(){
    var f = fachadaCfg(), P = PRECO_FACHADA, ac = areaConstruida() / 10000, tf = testada() / 100 * proj.peDireito / 100, itens = [];
    function add(rot, v){ if (v) itens.push({rot:rot, valor:Math.round(v)}); }
    add('Revestimento ' + f.revestimento + ' (' + num(tf) + ' m²)', tf * (P.revestimento[f.revestimento] || 0));
    add('Cobertura ' + (f.cobertura === 'platibanda' ? 'platibanda' : (f.cobertura === 'telhado2' ? '2 águas' : '4 águas')), ac * (P.cobertura[f.cobertura] || 0));
    if (f.cobertura !== 'platibanda') add('Telha ' + f.telha, ac * (P.telha[f.telha] || 0));
    add('Portão ' + f.portao, P.portao[f.portao] || 0);
    if (f.muro === 'alto') add('Muro alto', proj.terreno.largura / 100 * P.muro.alto);
    if (f.muro === 'vidro') add('Muro com vidro', P.muro.vidro);
    if (f.jardim) add('Jardim frontal', P.jardim);
    if (f.marquise) add('Marquise da entrada', P.marquise);
    if (f.iluminacao) add('Iluminação de fachada', P.iluminacao);
    if (f.vitrine) add('Vitrine (' + num(tf) + ' m² de vidro)', tf * P.vitrine);
    if (f.pergolado) add('Pergolado da entrada', P.pergolado);
    /* janelas: uma por ambiente coberto com parede externa (aproximação honesta: o motor decide as janelas) */
    var nJ = proj.ambientes.filter(function (a) { return ['externo', 'agua', 'circulacao', 'garagem'].indexOf(a.tipo) < 0; }).length;
    var ROT_J = {correr:'de correr', fixa:'vidro fixo', guilhotina:'guilhotina', basculante:'basculante', veneziana:'veneziana', quadriculada:'quadriculada'};
    if (f.janela && f.janela !== 'correr') add('Janelas ' + (ROT_J[f.janela] || f.janela) + ' (' + nJ + ')', nJ * (P.janela[f.janela] || 0));
    if (f.vidro && f.vidro !== 'incolor') add('Vidro ' + ({fume:'fumê', verde:'verde', espelhado:'espelhado'}[f.vidro] || f.vidro) + ' (' + nJ + ')', nJ * (P.vidro[f.vidro] || 0));
    if (f.moldura) add('Moldura nas janelas (' + nJ + ')', nJ * P.moldura);
    if (f.gradeJanela) add('Grade de proteção (' + nJ + ')', nJ * P.gradeJanela);
    if (f.brise) add('Brise na frente', Math.max(1, Math.round(nJ / 3)) * P.brise);
    var areaPorta = (f.portaLargura || .9) * (f.portaAltura || 2.1), fatorPorta = Math.max(1, areaPorta / 1.89);
    if (f.porta && f.porta !== 'madeira') add('Porta ' + ({pivotante:'pivotante', vidro:'de vidro', dupla:'dupla', ripada:'ripada', aco:'de aço', enrolar:'de enrolar', subir:'de subir', correr:'de vidro automática', vidroDupla:'de vidro 2 folhas', gradeLoja:'grade pantográfica', articulada:'articulada'}[f.porta] || f.porta) + (fatorPorta > 1 ? ' (' + num(f.portaLargura || .9) + ' × ' + num(f.portaAltura || 2.1) + ' m)' : ''), (P.porta[f.porta] || 0) * fatorPorta);
    if (f.garagem && f.garagem !== 'basculante') add('Porta da garagem ' + ({enrolar:'de enrolar', ripado:'ripada', vidro:'de vidro'}[f.garagem] || f.garagem), P.garagem[f.garagem] || 0);
    if (f.arandelas) add('Arandelas da entrada', P.arandelas);
    if (f.vasos) add('Vasos na entrada', P.vasos);
    if (f.pisoFrente && f.pisoFrente !== 'concreto') add('Piso da frente ' + f.pisoFrente, Math.max(1, proj.terreno.recuoFrontal / 100 * 3) * (P.pisoFrente[f.pisoFrente] || 0));
    if (f.letreiro) add('Letreiro ' + ({placa:'placa', caixa:'letra caixa', led:'LED', neon:'neon', backlight:'backlight'}[f.letreiroEstilo] || f.letreiroEstilo) + (f.letreiroTam && f.letreiroTam !== 'm' ? ' ' + f.letreiroTam.toUpperCase() : ''), (P.letreiroTam[f.letreiroTam] || 1) * (P.letreiro[f.letreiroEstilo] || P.letreiro.placa));
    if (f.letreiro && f.totem) add('Totem', P.totem);
    return itens;
  }
  function custoFachada(){ return custoFachadaItens().reduce(function (s2, i) { return s2 + i.valor; }, 0); }
  function custoGeral(){ return custoTotal() + custoFachada(); }
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
        if (pavDe(A) !== pavDe(B)) continue;
        var ov = A.x < B.x + B.w && B.x < A.x + A.w && A.y < B.y + B.h && B.y < A.y + A.h;
        if (ov) p.push({id:A.id, tipo:'sobrepoe', msg: A.nome + ' está sobrepondo ' + B.nome});
      }
    proj.ambientes.forEach(function (a) { var ap = apoio(a); if (pavDe(a) && cobertoAmb(a) && ap < .5) p.push({id:a.id, tipo:'balanco', msg: a.nome + ' está em balanço — só ' + fmtPct(ap * 100) + ' apoiado no andar de baixo'}); });
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
      if (window.CLOUD && window.parent !== window) window.parent.postMessage({type:'suaobra:salvar', proj:proj}, '*');   /* o pai grava no banco */
      if (window.UI) UI.saveState(window.CLOUD ? 'Salvando na nuvem…' : 'Salvo');
    }, 800);
  }
  /* modo nuvem (dentro do app do Lovable): recebe o projeto pronto do pai */
  function carregar(p){
    proj = p; hist = []; fut = [];
    if (!proj.moveis) mobiliarAuto();
    if (!proj.id) proj.id = uid();
    base = snap();
    emitir(); return proj;
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
    areaTotalAmbientes:areaTotalAmbientes, ocupacao:ocupacao, projecao:projecao, espelhoAgua:espelhoAgua,
    get pav(){ return pavAtual; }, setPav:setPav, pavDe:pavDe, nPavs:nPavs, ambsPav:ambsPav, nomePav:nomePav, apoio:apoio, addPavimento:addPavimento, removerPavimento:removerPavimento, escada:escada,
    custoDe:custoDe, custoTotal:custoTotal, custoPorM2:custoPorM2, custoFachada:custoFachada, custoFachadaItens:custoFachadaItens, custoGeral:custoGeral, fachadaCfg:fachadaCfg, testada:testada, PRECO_FACHADA:PRECO_FACHADA, bbox:bbox, problemas:problemas,
    fmtM:fmtM, fmtMs:fmtMs, fmtM2:fmtM2, fmtPct:fmtPct, fmtBRL:fmtBRL, num:num, parseM:parseM,
    commit:commit, undo:undo, redo:redo, podeUndo:podeUndo, podeRedo:podeRedo, proxUndo:proxUndo,
    salvar:salvar, abrir:abrir, carregar:carregar, excluir:excluir, todos:todos, ultimoId:ultimoId, onChange:onChange
  };
})();
