/* =========================================================================
   UI — casca, navegação, inspector, atalhos, command palette, telas.
   ========================================================================= */
var UI = (function () {

  var viewAtual = 'planta', shift = false, alt = false, espaco = false;
  var $ = function (s) { return document.querySelector(s); };
  var stage, insp, canvasWrap;
  var t3 = null, t3Apres = null;   /* instâncias do 3D (editor / apresentação) */

  /* ================= INÍCIO ================= */
  function boot(){
    paintIcons();
    stage = $('#stage'); insp = $('#insp'); canvasWrap = $('#canvas-wrap');
    montarHome();
    ligarAtalhos();
    M.onChange(function () { refreshTop(); if (t3) t3.atualizar(); if (viewAtual === 'planta' && M.proj) PLAN.render(); });

    $('#btn-criar').onclick = criarDaHome;
    $('#btn-home').onclick = voltarHome;
    $('#btn-undo').onclick = function () { fazerUndo(); };
    $('#btn-redo').onclick = function () { fazerRedo(); };
    $('#btn-cmdk').onclick = abrirCmdk;
    $('#btn-ajuda').onclick = abrirAjuda;
    $('#btn-apresentar').onclick = abrirApres;
    $('#btn-insp').onclick = function () { setInsp(!inspAberto, false); };
    $('#btn-collapse').onclick = function () { document.getElementById('app').classList.toggle('side-off'); PLAN.render(); };
    $('#btn-fit').onclick = function () { PLAN.enquadrar(); PLAN.render(); };
    $('#btn-grid').onclick = function () { this.classList.toggle('on', PLAN.toggleGrid()); };
    $('#btn-cotas').onclick = function () { this.classList.toggle('on', PLAN.toggleCotas()); };
    $('#btn-mob').onclick = function () { toggleCatalogo(); };
    $('#btn-foto').onclick = function () { $('#foto-in').click(); };
    $('#foto-in').onchange = function () { if (this.files[0]) copiarDeFoto('planta', this.files[0]); this.value = ''; };
    $('#home-foto-in').onchange = function () {   /* na tela inicial: cria o projeto vazio no terreno digitado e copia a foto */
      var file = this.files[0]; this.value = ''; if (!file) return;
      var l = M.parseM($('#t-larg').value) || 1000, p = M.parseM($('#t-prof').value) || 2500;
      M.novo('zero', l, p, 'Planta da foto'); entrarApp(); copiarDeFoto('planta', file);
    };
    document.querySelectorAll('#pill23 button').forEach(function (b) { b.onclick = function () { irPara(b.getAttribute('data-v')); }; });
    document.addEventListener('pointerdown', function (e) {
      var fp = document.getElementById('fpop'), cx2 = document.getElementById('ctx');
      if (fp && !fp.hidden && !fp.contains(e.target) && !(e.target.closest && e.target.closest('canvas'))) fp.hidden = true;
      if (cx2 && !cx2.hidden && !cx2.contains(e.target)) cx2.hidden = true;
      /* clicar fora do catálogo e do menu radial fecha o radial (o catálogo fica) */
      if (!e.target.closest('#radial') && !e.target.closest('#stage') && !e.target.closest('.t3-canvas')) $('#radial').hidden = true;
    });
    $('#proj-nome').addEventListener('blur', function () {
      var n = this.textContent.trim() || 'Sem nome';
      if (n !== M.proj.nome) { M.proj.nome = n; M.commit('Renomear projeto'); }
      this.textContent = n;
    });
    $('#proj-nome').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); this.blur(); } });

    document.querySelectorAll('.side a').forEach(function (a) {
      a.onclick = function () { irPara(a.getAttribute('data-view')); };
    });
    document.querySelectorAll('#tools [data-tool]').forEach(function (b) {
      b.onclick = function () { setTool(b.getAttribute('data-tool')); };
    });
    ['t-larg', 't-prof'].forEach(function (id) {
      $('#' + id).addEventListener('input', dicaTerreno);
    });
    window.addEventListener('resize', function () { if (viewAtual === 'planta' && M.proj) { PLAN.setView(PLAN.view.x, PLAN.view.y, PLAN.view.w, PLAN.view.h); PLAN.render(); } });

    var q = new URLSearchParams(location.search);
    /* ?cloud=1 — rodando dentro do app do Lovable: o pai manda o projeto e grava no banco */
    if (q.has('cloud') && window.parent !== window) {
      window.CLOUD = true;
      document.body.classList.add('cloud');
      window.addEventListener('message', function (e) {
        var m = e.data || {};
        if (m.type === 'suaobra:projeto') {
          if (m.proj && m.proj.terreno) M.carregar(m.proj);
          else { M.novo(m.tipoKey || 'casa-terrea', m.largura || 1000, m.profundidade || 2500, m.nome); if (m.nome) M.proj.nome = m.nome; M.salvar(); }   /* planta gerada vai logo para o banco */
          if (m.nome) M.proj.nome = m.nome;
          localStorage.setItem('suaobra3d.coach', '1');
          entrarApp();
          if (m.view) irPara(m.view);
        }
        if (m.type === 'suaobra:salvo') saveState('Salvo na nuvem');
      });
      window.parent.postMessage({type:'suaobra:pronto'}, '*');
      return;
    }
    /* ?demo=casa-terrea&l=10&p=25&v=planta — abre direto, para conferência e print */
    if (q.has('demo')) {
      var k = q.get('demo') || 'casa-terrea';
      M.novo(M.PROGRAMAS[k] ? k : 'casa-terrea', M.parseM(q.get('l') || '10') , M.parseM(q.get('p') || '25'));
      localStorage.setItem('suaobra3d.coach', '1');
      entrarApp();
      if (q.get('pav')) M.setPav(+q.get('pav'));   /* &pav=1 abre o 1º andar */
      if (q.get('v')) irPara(q.get('v'));
      if (t3) {   /* &t3=tour&i=3&teto=0&etapa=2 — para conferência e print */
        if (q.get('teto') === '0') t3.setTeto(false);
        if (q.get('luz')) { var L = q.get('luz').split(',').map(Number); t3.luz(L[0], L[1], L[2]); }
        if (q.has('etapa')) t3.setEtapa(+q.get('etapa'));
        if (q.get('t3') === 'tour') { t3.setModo('tour'); t3.irParada(+(q.get('i') || 0), true); }
        else if (q.get('t3')) t3.setModo(q.get('t3'));
      }
      /* &cat=1 abre o catálogo · &selmov=N seleciona o N-ésimo móvel e enquadra o ambiente dele · &catk=quarto abre uma categoria */
      if (q.has('insp')) setInsp(true, q.get('insp') === 'sel');   /* &insp=1 abre a folha do inspector (celular) */
      if (q.has('cat')) { toggleCatalogo(true); if (q.get('catk')) { catCat = q.get('catk'); catalogo(); } }
      if (q.has('selmov')) {
        var mvq = M.proj.moveis[+q.get('selmov') || 0];
        if (mvq) { var ambq = M.ambienteDe(mvq); if (ambq && viewAtual === 'planta') PLAN.enquadrarAmb(ambq); selecionarMovel(mvq.id); }
      }
      if (q.get('estilo')) { M.proj.fachada = {estilo:q.get('estilo'), numero:q.get('num') || ''}; if (t3) t3.atualizar(); if (viewAtual === 'tresd') { fachPanel(); t3.verFachada(true); } }
      if (q.get('fprompt') && viewAtual === 'tresd') { fachadaPorPrompt(q.get('fprompt')); var pq = document.querySelector('#fach-prompt'); if (pq) pq.value = q.get('fprompt'); if (t3) t3.verFachada(true, +q.get('fz') || 1); }
      if (q.get('fach')) { try { M.proj.fachada = Object.assign(M.proj.fachada || {}, JSON.parse(q.get('fach'))); } catch (e) {} if (t3) t3.atualizar(); if (viewAtual === 'tresd') { fachPanel(); t3.verFachada(true, +q.get('fz') || 1); } }   /* &fach={"cobertura":"galpao"} (conferência) */
      if (q.has('painel') && viewAtual === 'tresd') { var ptg = document.querySelector('#fach-tg'); if (ptg) { var quer = q.get('painel') !== '0'; if (quer !== ptg.classList.contains('on')) ptg.click(); } }   /* &painel=1|0 força o painel da fachada */
      if (q.has('noite') && t3) t3.setNoite(true);
      /* &fpop=janela abre o popover de troca · &ctx=amb|mov|vazio abre o menu de contexto — conferência e print */
      if (q.get('fpop')) setTimeout(function () {
        var fid = null;   /* &fpid=auto acha a primeira abertura/parede daquele tipo (conferência) */
        if (q.get('fpid') === 'auto' && window.TRES) { var anq = TRES.analise(M.proj); anq.pecas.forEach(function (pc) { if (fid || !pc.ext) return; if (q.get('fpop') === 'parede') fid = pc.chave; else pc.ab.forEach(function (ab) { if (!fid && ((q.get('fpop') === 'janela' && ab.tipo === 'janela') || (q.get('fpop') === 'porta' && ab.tipo === 'entrada'))) fid = ab.chave; }); }); }
        popFachada(q.get('fpop'), 520, 220, fid);
      }, 200);
      if (q.has('chave')) { if ((q.get('chave') || '').length > 10) VISAO.setChave(q.get('chave')); else setTimeout(function () { pedirChave(null); }, 200); }   /* &chave=1 abre o diálogo · &chave=AIza… grava (conferência) */
      if (q.get('logo')) fetch(q.get('logo')).then(function (r) { return r.blob(); }).then(function (b) { lerArte(new File([b], 'logo.png', {type:b.type || 'image/png'}), function (u) { M.proj.logo = u; M.salvar(); if (t3) t3.atualizar(); fachPanel(); }); });   /* &logo=url (conferência) */
      if (q.get('foto')) fetch(q.get('foto')).then(function (r) { return r.blob(); }).then(function (b) { copiarDeFoto(q.get('modo') || 'planta', new File([b], 'foto.png', {type:b.type || 'image/png'})); });   /* &foto=url&modo=planta|fachada */
      if (q.has('laco') && viewAtual === 'planta') setTimeout(function () { var tudo = M.ambsPav(M.pav).slice(0, +q.get('laco') || 3).map(function (a) { return {t:'amb', id:a.id}; }); PLAN.setMulti(tudo); }, 150);   /* &laco=N seleciona N ambientes como grupo */
      if (q.get('ctx') && viewAtual === 'planta') setTimeout(function () {
        var alvo = q.get('ctx') === 'amb' ? PLAN.svgEl.querySelector('.amb rect') : q.get('ctx') === 'mov' ? PLAN.svgEl.querySelector('.mov') : PLAN.svgEl;
        var r = alvo.getBoundingClientRect(), ev = {target:alvo, clientX:r.left + r.width / 2, clientY:r.top + r.height / 2};
        if (q.get('ctx') === 'vazio') { ev.clientX = r.left + 40; ev.clientY = r.top + 60; }
        menuContexto(ev);
      }, 200);
      if (q.has('estilos4')) setTimeout(compararEstilos, 100);
      if (q.has('htmlpasseio')) { location.href = URL.createObjectURL(new Blob([htmlPasseio()], {type:'text/html'})) + (q.get('scroll') ? '#s=' + q.get('scroll') : ''); return; }   /* testa o export in loco */
      if (q.has('apres')) { abrirApres(); if (q.has('scroll')) setTimeout(function () { $('#apres').scrollTop = +q.get('scroll'); }, 100); }
    }
  }

  /* ================= TELA INICIAL ================= */
  var tipoSel = 'casa-terrea';
  function montarHome(){
    var h = '';
    Object.keys(M.PROGRAMAS).forEach(function (k) {
      var p = M.PROGRAMAS[k];
      h += '<button class="tipo' + (k === tipoSel ? ' on' : '') + '" data-k="' + k + '"><b>' + p.rot + '</b><span>' + p.desc + '</span></button>';
    });
    $('#tipos').innerHTML = h;
    document.querySelectorAll('.tipo').forEach(function (b) {
      b.onclick = function () {
        tipoSel = b.getAttribute('data-k');
        document.querySelectorAll('.tipo').forEach(function (o) { o.classList.remove('on'); });
        b.classList.add('on');
        var tp = M.PROGRAMAS[tipoSel].terreno;   /* programa com terreno típico (escola de natação: 15 × 20) */
        if (tp) { $('#t-larg').value = M.fmtMs(tp.l); $('#t-prof').value = M.fmtMs(tp.p); dicaTerreno(); }
      };
    });
    dicaTerreno();
    listarRecentes();
    var ult = M.ultimoId(), todos = M.todos();
    if (ult && todos[ult]) {
      var b = $('#btn-abrir-ultimo');
      b.hidden = false;
      b.textContent = 'Continuar: ' + todos[ult].nome;
      b.onclick = function () { if (M.abrir(ult)) entrarApp(); };
    }
  }
  function dicaTerreno(){
    var l = M.parseM($('#t-larg').value), p = M.parseM($('#t-prof').value);
    if (!l || !p) { $('#home-hint').textContent = 'Informe largura e profundidade em metros.'; return; }
    $('#home-hint').textContent = 'Terreno de ' + M.fmtM2(l * p) + '. Você muda tudo depois.';
  }
  function listarRecentes(){
    var all = M.todos(), ids = Object.keys(all);
    if (!ids.length) { $('#recentes').innerHTML = ''; return; }
    ids.sort(function (a, b) { return (all[b].salvo || 0) - (all[a].salvo || 0); });
    var h = '<h6>MEUS PROJETOS</h6><div class="rec-grid">';
    ids.forEach(function (id) {
      var p = all[id], guarda = M.proj;
      M.proj = p;
      h += '<div class="rec" data-id="' + id + '"><div class="th">' + VIEWS.miniPlanta({}) + '</div>' +
        '<div class="inf"><b>' + esc(p.nome) + '</b><span>' + M.fmtM2(M.areaConstruida()) + ' · ' + M.fmtBRL(M.custoTotal()) + '</span></div></div>';
      M.proj = guarda;
    });
    $('#recentes').innerHTML = h + '</div>';
    document.querySelectorAll('.rec').forEach(function (c) {
      c.onclick = function () { if (M.abrir(c.getAttribute('data-id'))) entrarApp(); };
    });
  }
  function criarDaHome(){
    var l = M.parseM($('#t-larg').value), p = M.parseM($('#t-prof').value);
    if (!l || !p || l < 300 || p < 300) { toast('Terreno mínimo de 3,00 m em cada lado.', null, true); return; }
    M.novo(tipoSel, l, p);
    entrarApp();
    setTimeout(coach, 400);
  }
  function entrarApp(){
    $('#home').hidden = true; $('#app').hidden = false;
    $('#proj-nome').textContent = M.proj.nome;
    irPara('planta');
    PLAN.montar(stage);
    PLAN.enquadrar(); PLAN.render();
    inspector(); refreshTop();
    $('#btn-grid').classList.toggle('on', PLAN.vis('grade')); $('#btn-cotas').classList.toggle('on', PLAN.vis('cotas'));
  }
  function voltarHome(){
    if (window.CLOUD) { window.parent.postMessage({type:'suaobra:voltar'}, '*'); return; }
    fecharApres();
    $('#app').hidden = true; $('#home').hidden = false;
    montarHome();
  }

  /* ================= NAVEGAÇÃO ================= */
  var abrirFachada = false;   /* irPara('fachada') = a tela 3D com o painel da fachada aberto e a câmera na frente da casa */
  function irPara(v){
    if (v === 'fachada') { v = 'tresd'; abrirFachada = true; }
    viewAtual = v;
    if (t3) { t3.desmontar(); t3 = null; }
    document.querySelectorAll('.side a').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-view') === v); });
    $('#tools').hidden = v !== 'planta';
    $('#empty').hidden = true;
    $('#pill23').hidden = v !== 'planta' && v !== 'tresd';
    var ps = $('#pavsel'); if (ps) ps.hidden = v !== 'planta';
    $('#app').setAttribute('data-view', v);
    document.querySelectorAll('#pill23 button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-v') === v); });
    if (v !== 'planta' && v !== 'tresd') { $('#catalogo').hidden = true; $('#btn-mob').classList.remove('on'); }
    $('#radial').hidden = true;

    if (v === 'planta') {
      stage.hidden = false;
      var old = canvasWrap.querySelector('.view-pad'); if (old) old.remove();
      PLAN.montar(stage); PLAN.enquadrar(); PLAN.render(); pavSel();
      $('#empty').hidden = M.proj.ambientes.length > 0;
    } else {
      stage.hidden = true;
      var pad = canvasWrap.querySelector('.view-pad');
      if (!pad) { pad = document.createElement('div'); pad.className = 'view-pad'; canvasWrap.appendChild(pad); }
      pad.innerHTML = conteudoView(v);
      ligarView(v, pad);
    }
    inspector();
  }

  /* seletor de pavimento (Térreo · 1º andar · +) — só na planta */
  function pavSel(){
    var el = $('#pavsel'); if (!el) return;
    var n = M.nPavs(), h = '';
    for (var i = 0; i < n; i++) h += '<button data-pav="' + i + '"' + (M.pav === i ? ' class="on"' : '') + '>' + M.nomePav(i) + '</button>';
    if (n < 4) h += '<button data-pav="+" title="Adicionar andar em cima">+</button>';
    el.innerHTML = h; el.hidden = viewAtual !== 'planta';
    el.querySelectorAll('button').forEach(function (b) {
      b.onclick = function () {
        var v = b.getAttribute('data-pav');
        if (v === '+') { M.addPavimento(true); M.commit('Adicionar ' + M.nomePav(M.pav)); toast(M.nomePav(M.pav) + ' criado copiando o andar de baixo. Ajuste os ambientes.'); }
        else M.setPav(+v);
        PLAN.selecionar(null); PLAN.render(); pavSel(); inspector(); refreshTop();
      };
    });
  }
  function conteudoView(v){
    var p = M.proj;
    if (v === 'ambientes') {
      var h = '<h2>Ambientes</h2><p class="vsub">' + p.ambientes.length + ' ambientes · ' + M.fmtM2(M.areaTotalAmbientes()) + ' no total. Clique para selecionar na planta.</p>';
      var multi = M.nPavs() > 1;
      h += '<table class="tbl"><tr><th>AMBIENTE</th><th>TIPO</th>' + (multi ? '<th>ANDAR</th>' : '') + '<th class="n">LARGURA</th><th class="n">PROFUND.</th><th class="n">ÁREA</th><th class="n">CUSTO</th><th></th></tr>';
      p.ambientes.slice().sort(function (a, b) { return M.pavDe(a) - M.pavDe(b); }).forEach(function (a) {
        var ti = M.TIPOS[a.tipo] || M.TIPOS.social;
        h += '<tr data-id="' + a.id + '"><td><span class="sw" style="background:' + ti.cor + '"></span>' + esc(a.nome) + '</td>' +
          '<td>' + ti.rot + '</td>' + (multi ? '<td>' + M.nomePav(M.pavDe(a)) + '</td>' : '') + '<td class="n">' + M.fmtM(a.w) + '</td><td class="n">' + M.fmtM(a.h) + '</td>' +
          '<td class="n">' + M.fmtM2(M.areaOf(a)) + '</td><td class="n">' + M.fmtBRL(M.custoDe(a)) + '</td>' +
          '<td class="n"><button data-del="' + a.id + '" title="Excluir">✕</button></td></tr>';
      });
      h += '<tr class="tot"><td colspan="' + (multi ? 5 : 4) + '">TOTAL</td><td class="n">' + M.fmtM2(M.areaTotalAmbientes()) + '</td><td class="n">' + M.fmtBRL(M.custoTotal()) + '</td><td></td></tr></table>';
      h += '<div style="margin-top:14px"><button class="btn" onclick="document.getElementById(\'foto-in\').click()">📷 Copiar planta de uma foto</button></div>';
      h += '<h2 style="margin-top:32px;font-size:15px">Adicionar da biblioteca</h2><div class="lib">';
      M.LIB.forEach(function (l, i) {
        var ti = M.TIPOS[l.tipo];
        h += '<button data-lib="' + i + '"><span class="sw" style="background:' + ti.cor + '"></span>' + l.nome + '</button>';
      });
      return h + '</div>';
    }
    if (v === 'pavimentos') {
      var n = M.nPavs(), hp = '<h2>Pavimentos</h2><p class="vsub">' + n + (n > 1 ? ' pavimentos' : ' pavimento') + ' · ' + M.fmtM2(M.areaConstruida()) + ' construídos · projeção de ' + M.fmtM2(M.projecao()) + ' no terreno. Cada ambiente pertence a um andar; o de cima gruda nas paredes do de baixo.</p>';
      hp += '<div class="cards">' + card(M.fmtM2(M.areaTerreno()), 'TERRENO') + card(M.fmtM2(M.areaConstruida()), 'ÁREA CONSTRUÍDA') + card(M.fmtPct(M.ocupacao()), 'TAXA DE OCUPAÇÃO (PROJEÇÃO)') + card(M.fmtM(p.peDireito), 'PÉ-DIREITO') + '</div>';
      hp += '<table class="tbl"><tr><th>PAVIMENTO</th><th class="n">AMBIENTES</th><th class="n">ÁREA</th><th class="n">CUSTO</th><th>APOIO</th><th></th></tr>';
      for (var pi = n - 1; pi >= 0; pi--) {
        var ambsP = M.ambsPav(pi), areaP = ambsP.reduce(function (s2, a) { return s2 + M.areaOf(a); }, 0), custoP = ambsP.reduce(function (s2, a) { return s2 + M.custoDe(a); }, 0);
        var bal = ambsP.filter(function (a) { return M.apoio(a) < .5; });
        hp += '<tr><td><b>' + M.nomePav(pi) + '</b></td><td class="n">' + ambsP.length + '</td><td class="n">' + M.fmtM2(areaP) + '</td><td class="n">' + M.fmtBRL(custoP) + '</td>' +
          '<td>' + (pi === 0 ? 'no terreno' : (bal.length ? '<span style="color:#B4432F">' + bal.length + ' em balanço</span>' : 'apoiado')) + '</td>' +
          '<td class="n"><button data-pav-ir="' + pi + '" title="Editar na planta">✎ planta</button>' + (pi > 0 ? '<button data-pav-del="' + pi + '" title="Remover este andar">✕</button>' : '') + '</td></tr>';
      }
      hp += '</table>';
      var esc3 = M.escada();
      hp += '<p class="vsub" style="margin-top:14px">' + (n > 1 ? (esc3 ? 'Escada em <b>' + esc(esc3.amb.nome) + '</b> (' + M.fmtMs(esc3.w) + ' × ' + M.fmtMs(esc3.h) + ' m, ' + esc3.degraus + ' degraus), encostada na parede esquerda, no fundo. Ela nasce do maior ambiente de circulação do térreo — crie um "Hall" ou "Corredor" para escolher onde.' : 'Nenhum ambiente do térreo tem 3,00 m de fundo para a escada — aumente um corredor ou a sala.') : 'Casa térrea. Adicione um andar para virar sobrado.') + '</p>';
      hp += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">' + (n < 4 ? '<button class="btn solid" data-pav-add="copia">+ Adicionar andar copiando o de baixo</button><button class="btn" data-pav-add="vazio">+ Adicionar andar vazio</button>' : '') + '</div>';
      return hp;
    }
    if (v === 'tresd') {   /* 3D + fachada numa tela só: passeio, obra 4D, móveis, dia/noite, estilos, prompt, foto e o painel de design à direita */
      if (!window.TRES) return '<h2>3D</h2><p class="vsub">O motor 3D não carregou (three.min.js ausente).</p><div style="height:60%">' + VIEWS.iso() + '</div><div style="height:40%">' + VIEWS.fachada() + '</div>';
      return '<div class="t3-bar">' +
        '<div class="seg" id="t3-modos"><button data-modo="orbit" class="on" title="Arraste para girar · roda para aproximar · botão direito move">Girar</button>' +
        '<button data-modo="walk" title="W A S D anda · arraste para olhar">Andar</button>' +
        '<button data-modo="tour" title="Cômodo a cômodo · setas ou roda do mouse">Passeio</button></div>' +
        '<div class="seg" id="fach-hora" title="Hora do dia"><button data-hora="dia" class="on" title="Ver de dia">☀</button><button data-hora="noite" title="Ver à noite, com as luzes e o letreiro acesos">☾</button></div>' +
        '<button class="tg on" id="t3-teto" title="Mostrar ou esconder a laje e o telhado">Teto</button>' +
        '<span class="sep"></span>' +
        '<label class="etapa" title="Etapas da obra (4D)">OBRA <input type="range" id="t3-etapa" min="0" max="5" step="1" value="5"><b id="t3-etapa-v">Acabamento</b></label>' +
        '<span class="sep"></span>' +
        '<button class="tg fach-tg" id="fach-tg" title="Painel da fachada: estilo, prompt, cobertura, cores, janelas, porta, letreiro (F)">🎨 Fachada</button>' +
        '<button class="tg" id="t3-mob" title="Catálogo de móveis (M)">Mobiliar</button>' +
        '<span class="grow"></span>' +
        '<select id="t3-amb" title="Levar a câmera para…"><option value="">Ir para…</option></select>' +
        '<button class="btn solid sm" id="t3-render" title="Guarda esta vista na aba Renders (entra na apresentação)">+ Render</button>' +
        '<button class="tg" id="t3-mais" title="Mais: elevação, estilos, foto">⋯</button>' +
        '</div>' +
        '<div class="fach-body"><div class="t3-stage" id="t3-stage">' +
        '<div class="fach-elev" id="fach-elev-pad" hidden></div>' +
        '<div class="t3-nav" id="t3-nav" hidden><button id="t3-ant" title="Anterior (←)">‹</button><button id="t3-auto" title="Passeio automático">▶</button><button id="t3-prox" title="Próximo (→)">›</button></div>' +
        '<div class="t3-dica" id="t3-dica">Arraste para girar · roda para aproximar · duplo clique num ambiente para entrar</div>' +
        '</div><aside class="fach-panel" id="fach-panel"><button class="icon-btn fach-panel-close" id="fach-close" title="Fechar painel">' + icon('close') + '</button></aside></div>';
    }
    if (v === 'corte')   return '<h2>Corte longitudinal</h2><p class="vsub">Seção no meio do terreno, no sentido da profundidade.</p><div style="height:calc(100% - 90px);min-height:360px">' + VIEWS.corte() + '</div>';

    if (v === 'orcamento') {
      var h2 = '<h2>Orçamento estimado</h2><p class="vsub">Custo por m² por tipo de ambiente, no padrão <b>' + M.PADROES[p.padrao].rot + '</b>. Estimativa de estudo, não substitui orçamento de construtor.</p>';
      h2 += '<div class="cards">' + card(M.fmtBRL(M.orcamento().total), 'INVESTIMENTO ESTIMADO (C/ RESERVA)') +
        card(M.fmtBRL(M.custoPorM2()), 'CUSTO POR M²') + card(M.fmtM2(M.areaConstruida()), 'ÁREA CONSTRUÍDA') +
        card(M.fmtPct(M.ocupacao()), 'OCUPAÇÃO') + '</div>';
      h2 += '<table class="tbl"><tr><th>AMBIENTE</th><th class="n">ÁREA</th><th class="n">R$/M²</th><th class="n">SUBTOTAL</th></tr>';
      p.ambientes.slice().sort(function (a, b) { return M.custoDe(b) - M.custoDe(a); }).forEach(function (a) {
        var ti = M.TIPOS[a.tipo] || M.TIPOS.social;
        h2 += '<tr><td><span class="sw" style="background:' + ti.cor + '"></span>' + esc(a.nome) + '</td>' +
          '<td class="n">' + M.fmtM2(M.areaOf(a)) + '</td><td class="n">' + M.fmtBRL(ti.custo[p.padrao] * 100) + '</td>' +
          '<td class="n">' + M.fmtBRL(M.custoDe(a)) + '</td></tr>';
      });
      h2 += '<tr class="tot"><td>AMBIENTES</td><td class="n">' + M.fmtM2(M.areaTotalAmbientes()) + '</td><td></td><td class="n">' + M.fmtBRL(M.custoTotal()) + '</td></tr>';
      M.custoFachadaItens().forEach(function (it) { h2 += '<tr><td><span class="sw" style="background:#2B2F33"></span>Fachada · ' + esc(it.rot) + '</td><td class="n"></td><td class="n"></td><td class="n">' + M.fmtBRL(it.valor) + '</td></tr>'; });
      M.custoPiscinaItens().forEach(function (it) { h2 += '<tr><td><span class="sw" style="background:#7FD6E8"></span>Piscina · ' + esc(it.rot) + '</td><td class="n"></td><td class="n"></td><td class="n">' + M.fmtBRL(it.valor) + '</td></tr>'; });
      h2 += '<tr class="tot"><td>TOTAL SEM RESERVA</td><td class="n"></td><td></td><td class="n">' + M.fmtBRL(M.custoGeral()) + '</td></tr></table>';
      /* composição por etapa da obra — a mesma sequência do slider 4D do 3D */
      var oc = M.orcamento();
      h2 += '<h2 style="margin-top:34px;font-size:15px">Por etapa da obra</h2><p class="vsub">O custo dos ambientes cobertos repartido na sequência em que a obra acontece — a mesma do slider OBRA no 3D. Piscina, fachada e reserva técnica entram como grupos próprios.</p>';
      h2 += '<div class="etapas-bar">' + oc.etapas.filter(function (e) { return e.valor > 0; }).map(function (e) { return '<div class="et" style="flex:' + Math.max(1, e.valor) + '" title="' + esc(e.rot) + ' · ' + M.fmtBRL(e.valor) + '"><b>' + esc(e.rot) + '</b><span>' + M.fmtPct(e.valor / Math.max(1, oc.subtotal) * 100) + '</span></div>'; }).join('') + '</div>';
      h2 += '<table class="tbl"><tr><th>ETAPA</th><th>ITEM</th><th>BASE</th><th class="n">VALOR</th></tr>';
      oc.etapas.forEach(function (e) {
        oc.linhas.filter(function (l) { return l.etapa === e.i; }).forEach(function (l, i2) {
          h2 += '<tr><td>' + (i2 === 0 ? '<b>' + e.i + ' · ' + esc(e.rot) + '</b>' : '') + '</td><td>' + esc(l.rot) + (l.campo ? ' <button class="chip sm" data-equip="' + l.campo + '">editar</button>' : '') + '</td><td class="dim">' + esc(l.base) + '</td><td class="n">' + M.fmtBRL(l.valor) + '</td></tr>';
        });
      });
      h2 += '<tr class="tot"><td colspan="3">SUBTOTAL</td><td class="n">' + M.fmtBRL(oc.subtotal) + '</td></tr>';
      h2 += '<tr><td colspan="3">Reserva técnica <input class="range" id="orc-res" type="range" min="0" max="25" step="1" value="' + oc.reservaPct + '" style="width:140px;vertical-align:middle;margin:0 8px"><b id="orc-res-v">' + M.fmtPct(oc.reservaPct) + '</b></td><td class="n">' + M.fmtBRL(oc.reserva) + '</td></tr>';
      h2 += '<tr class="tot"><td colspan="3">INVESTIMENTO ESTIMADO</td><td class="n">' + M.fmtBRL(oc.total) + '</td></tr>';
      h2 += '<tr><td colspan="3" class="dim">Faixa estimada (−12% / +18%) · ' + M.fmtBRL(oc.porM2) + '/m² construído</td><td class="n dim">' + M.fmtBRL(oc.minimo) + ' – ' + M.fmtBRL(oc.maximo) + '</td></tr></table>';
      h2 += '<div class="cards" style="margin-top:14px">' + oc.grupos.map(function (g) { return card(M.fmtBRL(g.valor), g.grupo.toUpperCase() + ' · ' + M.fmtPct(g.valor / Math.max(1, oc.subtotal) * 100)); }).join('') + '</div>';
      var pr = M.problemas();
      if (pr.length) {
        h2 += '<div class="alertbox"><b>' + pr.length + (pr.length > 1 ? ' PONTOS' : ' PONTO') + ' PARA RESOLVER</b><p>' +
          pr.slice(0, 4).map(function (q) { return esc(q.msg); }).join('<br>') + '</p></div>';
      } else {
        h2 += '<div class="okbox"><b>Planta consistente.</b><p style="font-size:12.5px;margin-top:5px">Nenhum ambiente fora do terreno, sobreposto ou menor que o mínimo.</p></div>';
      }
      return h2;
    }
    if (v === 'simulador') {
      var tot0 = M.orcamento().total, meta = p.meta || Math.round(tot0 * 0.8);
      var h3 = '<h2>Simulador</h2><p class="vsub">Mexa e veja o efeito no custo. Nada aqui altera a planta sozinho.</p>';
      h3 += '<div class="cards">' + card(M.fmtBRL(tot0), 'ESTIMADO (C/ RESERVA)') + card(M.fmtBRL(meta), 'SUA META') +
        card(M.fmtBRL(Math.abs(tot0 - meta)), tot0 > meta ? 'FALTAM' : 'SOBRAM') + '</div>';
      h3 += '<div class="sim-row"><b>Padrão de acabamento</b><div>' +
        Object.keys(M.PADROES).map(function (k) {
          return '<button class="chip' + (p.padrao === k ? ' on' : '') + '" data-padrao="' + k + '" style="margin-right:6px">' + M.PADROES[k].rot + '</button>';
        }).join('') + '</div><div class="v">' + M.fmtBRL(M.custoPorM2()) + '/m²</div></div>';
      h3 += '<div class="sim-row"><b>Meta de investimento</b><input class="range" id="sim-meta" type="range" min="0" max="' +
        Math.max(100000, Math.round(tot0 / 100 * 1.5)) + '" step="5000" value="' + Math.round(meta / 100) + '"><div class="v" id="sim-meta-v">' + M.fmtBRL(meta) + '</div></div>';
      h3 += '<div class="sim-row"><b>Pé-direito</b><input class="range" id="sim-pd" type="range" min="240" max="400" step="5" value="' + p.peDireito + '"><div class="v" id="sim-pd-v">' + M.fmtM(p.peDireito) + '</div></div>';
      if (tot0 > meta) {
        var excedente = tot0 - meta;
        var m2cortar = M.custoPorM2() ? excedente / M.custoPorM2() : 0;
        h3 += '<div class="alertbox"><b>PARA CABER NA META</b><p>Seria preciso cortar cerca de <b>' + M.num(m2cortar) +
          ' m²</b> de área construída, ou descer um padrão de acabamento. O app não encolhe o projeto sozinho — a decisão é sua.</p></div>';
      }
      /* cenários (vindo do ACQUA BELO): cada um é calculado num clone; "aplicar" muda o projeto de verdade, com desfazer */
      var oc2 = M.orcamento(), cns = M.cenarios();
      h3 += '<h2 style="margin-top:34px;font-size:15px">Cenários</h2><p class="vsub">Investimento estimado hoje: <b>' + M.fmtBRL(oc2.total) + '</b> (com reserva). Cada linha mostra quanto muda se você aplicar — e aplica com um clique, com desfazer.</p>';
      if (!cns.length) h3 += '<p class="vsub">Nenhum cenário aplicável a este projeto.</p>';
      h3 += '<div class="cenarios">' + cns.map(function (c, i) {
        var neg = c.delta < 0;
        return '<div class="cen"><div class="cen-t"><b>' + esc(c.nome) + '</b>' + (c.nota ? '<span>' + esc(c.nota) + '</span>' : '') +
          (c.problemas > M.problemas().length ? '<span class="cen-warn">⚠ gera ' + (c.problemas - M.problemas().length) + ' ponto(s) para resolver</span>' : '') + '</div>' +
          '<div class="cen-v ' + (neg ? 'neg' : 'pos') + '">' + (neg ? '−' : '+') + M.fmtBRL(Math.abs(c.delta)) + '<small>' + M.fmtBRL(c.total) + '</small></div>' +
          '<button class="btn sm" data-cen="' + i + '">aplicar</button></div>';
      }).join('') + '</div>';
      return h3;
    }
    if (v === 'exportar') {
      return '<h2>Exportar</h2><p class="vsub">Tudo sai do mesmo desenho.</p>' +
        '<div class="lib" style="grid-template-columns:repeat(auto-fill,minmax(210px,1fr))">' +
        '<button data-exp="svg">Planta em SVG (vetor)</button>' +
        '<button data-exp="png">Planta em PNG (imagem)</button>' +
        '<button data-exp="apres">Apresentação para o cliente</button>' +
        '<button data-exp="html">Passeio 3D em HTML (mandar pelo WhatsApp)</button>' +
        '<button data-exp="pdf">Imprimir / salvar PDF</button>' +
        '<button data-exp="json">Arquivo do projeto (.json)</button>' +
        '<button data-exp="csv">Orçamento em CSV (planilha)</button>' +
        '<button data-exp="txt">Relatório técnico (.txt)</button>' +
        '</div><p class="vsub" style="margin-top:26px">O arquivo .json guarda o projeto inteiro e pode ser reaberto aqui depois.</p>' +
        '<h2 style="margin-top:34px;font-size:15px">Versões do estudo</h2><p class="vsub">Guarde o estado atual com um nome (Estudo 01, Versão econômica…) e volte a ele quando quiser. Renders não entram na versão.</p>' +
        '<div class="ver-add"><input id="ver-nome" placeholder="Nome da versão" value="Estudo ' + (((p.versoes || []).length) + 1).toString().padStart(2, '0') + '"><button class="btn solid sm" id="ver-salvar">Salvar versão</button>' +
        ['Versão econômica', 'Versão padrão', 'Versão otimizada'].map(function (n) { return '<button class="chip" data-ver-nome="' + n + '">' + n + '</button>'; }).join('') + '</div>' +
        ((p.versoes || []).length ? '<table class="tbl"><tr><th>VERSÃO</th><th>QUANDO</th><th class="n">ÁREA</th><th class="n">INVESTIMENTO</th><th></th></tr>' +
          p.versoes.slice().reverse().map(function (v) { return '<tr><td><b>' + esc(v.nome) + '</b></td><td>' + new Date(v.quando).toLocaleString('pt-BR') + '</td><td class="n">' + M.fmtM2(v.resumo.area) + '</td><td class="n">' + M.fmtBRL(v.resumo.total) + '</td><td class="n"><button class="chip sm" data-ver-ir="' + v.id + '">carregar</button> <button class="chip sm" data-ver-del="' + v.id + '">✕</button></td></tr>'; }).join('') + '</table>' : '');
    }
    if (v === 'piscina') return viewPiscina();
    if (v === 'camadas') {
      var hc = '<h2>Camadas</h2><p class="vsub">Mostre, esconda ou bloqueie o que aparece na planta. Camada bloqueada não se move nem se redimensiona — evita esbarrar no que já está resolvido.</p>';
      hc += '<table class="tbl"><tr><th>CAMADA</th><th>VISÍVEL</th><th>EDIÇÃO</th></tr>';
      M.CAMADAS.forEach(function (c) {
        var st = M.camada(c.k), temBloq = ['ambientes', 'piscina', 'moveis'].indexOf(c.k) >= 0;
        hc += '<tr' + (st.vis ? '' : ' class="dim"') + '><td>' + esc(c.rot) + '</td><td><button class="chip' + (st.vis ? ' on' : '') + '" data-cam-vis="' + c.k + '">' + (st.vis ? 'visível' : 'oculta') + '</button></td>' +
          '<td>' + (temBloq ? '<button class="chip' + (st.bloq ? ' on warn' : '') + '" data-cam-bloq="' + c.k + '">' + (st.bloq ? '🔒 bloqueada' : 'editável') + '</button>' : '<span class="dim">—</span>') + '</td></tr>';
      });
      return hc + '</table>';
    }
    if (v === 'cotas') {
      var lst = M.cotasLista(), hk = '<h2>Cotas</h2><p class="vsub">Todas as medidas do projeto, com duas casas decimais, recalculadas a cada mudança. As editáveis aceitam um valor novo direto aqui (Enter aplica). Também dá para clicar no número da cota dentro da planta.</p>';
      hk += '<table class="tbl cotas-tbl"><tr><th>COTA</th><th class="n">MEDIDA</th></tr>';
      lst.forEach(function (c, i) {
        hk += '<tr><td>' + esc(c.rot) + '</td><td class="n">' + (c.campo ? '<input class="cota-in" data-cota-i="' + i + '" value="' + M.fmtMs(c.cm) + '"> m' : '<span class="dim">' + M.fmtM(c.cm) + '</span>') + '</td></tr>';
      });
      hk += '</table>';
      hk += '<h2 style="margin-top:30px;font-size:15px">Cotas livres</h2><p class="vsub">Medidas que você quer registrar (entre dois pontos, um vão, uma folga). Ficam no projeto e saem no relatório.</p>';
      hk += '<div class="ver-add"><input id="cota-nome" placeholder="Nome / entre quais pontos"><input id="cota-val" placeholder="Distância (m)" style="max-width:130px"><input id="cota-obs" placeholder="Observação"><button class="btn solid sm" id="cota-add">Adicionar</button></div>';
      if ((p.cotas || []).length) { hk += '<table class="tbl"><tr><th>COTA</th><th>OBS.</th><th class="n">MEDIDA</th><th></th></tr>';
        p.cotas.forEach(function (c) { hk += '<tr><td>' + esc(c.nome) + '</td><td class="dim">' + esc(c.obs || '') + '</td><td class="n">' + M.fmtM(c.cm) + '</td><td class="n"><button class="chip sm" data-cota-del="' + c.id + '">✕</button></td></tr>'; });
        hk += '</table>'; }
      return hk;
    }
    if (v === 'relatorio') {
      var hr = '<h2>Relatório técnico</h2><p class="vsub">Quantitativos e áreas calculados do desenho. Nada aqui é digitado.</p>';
      hr += '<div class="cards">' + card(M.fmtM2(M.areaConstruida()), 'ÁREA CONSTRUÍDA') + card(M.fmtPct(M.ocupacao()), 'OCUPAÇÃO') + card(M.fmtBRL(M.orcamento().total), 'INVESTIMENTO') + card(M.fmtBRL(M.orcamento().porM2), 'POR M²') + '</div>';
      hr += '<table class="tbl">' + M.relatorio().map(function (l) { return '<tr><td>' + esc(l[0]) + '</td><td class="n">' + esc(l[1]) + '</td></tr>'; }).join('') + '</table>';
      var al = alertasTodos();
      hr += '<h2 style="margin-top:30px;font-size:15px">Alertas inteligentes</h2><div class="alertas">' + al.map(function (q) { return '<div class="al ' + q.nivel + '"><i></i>' + esc(q.msg) + '</div>'; }).join('') + '</div>';
      hr += '<div style="display:flex;gap:8px;margin-top:22px;flex-wrap:wrap"><button class="btn solid" data-exp="pdf">Imprimir / salvar PDF</button><button class="btn" data-exp="txt">Baixar relatório (.txt)</button><button class="btn" data-exp="csv">Orçamento em CSV</button></div>';
      return hr;
    }
    if (v === 'renders') {
      var rs = p.renders || [], hv = '<h2>Renders</h2><p class="vsub">Imagens do projeto para mostrar ao cliente: capture do 3D e da fachada com o botão <b>+ Render</b>, ou envie imagens prontas. Entram na apresentação. Até ' + M.MAX_RENDERS + ' por projeto.</p>';
      hv += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px"><button class="btn solid sm" data-go="tresd">📷 Capturar do 3D</button><button class="btn sm" data-go="fachada">📷 Capturar da fachada</button><label class="btn sm" for="rend-file">⬆ Enviar imagem</label><input id="rend-file" type="file" accept="image/*" multiple hidden></div>';
      if (!rs.length) hv += '<div class="okbox"><b>Nenhum render ainda.</b><p style="font-size:12.5px;margin-top:5px">Vá ao 3D, escolha um ângulo e clique em <b>+ Render</b>.</p></div>';
      hv += '<div class="rend-grid">' + rs.map(function (r) {
        return '<figure class="rend"><img src="' + r.src + '" alt=""><figcaption><input data-rend-cap="' + r.id + '" value="' + esc(r.titulo || '') + '" placeholder="Legenda"><button class="chip sm" data-rend-del="' + r.id + '" title="Excluir">✕</button></figcaption></figure>';
      }).join('') + '</div>';
      return hv;
    }
    return '';
  }
  function card(v, k){ return '<div class="c"><b>' + v + '</b><span>' + k + '</span></div>'; }

  /* ---------- PISCINA (vinda do ACQUA BELO): raias, profundidade, praias, volume, equipamentos ---------- */
  function viewPiscina(){
    var p = M.proj, ps = M.piscinas();
    var h = '<h2>Piscina</h2><p class="vsub">Lâmina d’água, raias, profundidade e praias — tudo derivado do retângulo da piscina na planta. Dentro de um salão, as praias são medidas até as paredes dele.</p>';
    if (!ps.length) {
      return h + '<div class="okbox"><b>Este projeto não tem piscina.</b><p style="font-size:12.5px;margin-top:5px">Adicione uma da biblioteca e arraste para o lugar. Se ficar dentro de um ambiente coberto, ele vira o salão da piscina.</p></div>' +
        '<div style="margin-top:14px"><button class="btn solid" id="pis-add">+ Adicionar piscina</button></div>';
    }
    ps.forEach(function (a) {
      var i = M.piscinaInfo(a), pr = i.praias, al = M.piscinaAlertas(a);
      h += '<section class="pis"><h3>' + esc(a.nome) + (pr.salao ? ' <small>dentro de ' + esc(pr.salao.nome) + '</small>' : ' <small>ao ar livre</small>') + '</h3>';
      h += '<div class="cards">' + card(M.num(i.comp) + ' × ' + M.num(i.larg) + ' m', 'LÂMINA D’ÁGUA · ' + M.num(i.area) + ' M²') + card(M.num(i.volume) + ' m³', 'VOLUME DE ÁGUA') + card(i.raias + ' × ' + M.fmtMs(i.raia) + ' m', i.raiasCabem ? 'RAIAS' : 'RAIAS — NÃO CABEM') + card(M.fmtMs(i.prof) + '–' + M.fmtMs(i.profMax) + ' m', 'PROFUNDIDADE') + '</div>';
      h += '<div class="f-row pis-f">' + campo('pis-comp-' + a.id, 'COMPRIMENTO', M.fmtMs(i.comp), 'm') + campo('pis-larg-' + a.id, 'LARGURA', M.fmtMs(i.larg), 'm') + campo('pis-prof-' + a.id, 'PROF. MÍN.', M.fmtMs(i.prof), 'm') + campo('pis-profmax-' + a.id, 'PROF. MÁX.', M.fmtMs(i.profMax), 'm') + '</div>';
      h += '<div class="f-row pis-f">' + campo('pis-raias-' + a.id, 'RAIAS', i.raias, 'un') + campo('pis-raia-' + a.id, 'LARGURA DA RAIA', M.fmtMs(i.raia), 'm') + '</div>';
      h += '<div class="chips" style="margin:6px 0 12px">' + [[1100, 600, '11,00 × 6,00 compacta'], [1250, 600, '12,50 × 6,00 escola'], [1500, 700, '15,00 × 7,00'], [2500, 1250, '25,00 × 12,50 semiolímpica']].map(function (d) { return '<button class="chip" data-pis-dim="' + a.id + '|' + d[0] + '|' + d[1] + '">' + d[2] + '</button>'; }).join('') + '</div>';
      h += '<div class="praias"><b>PRAIAS</b> <span>esquerda <b>' + M.fmtM(pr.esq) + '</b></span><span>direita <b>' + M.fmtM(pr.dir) + '</b></span><span>frente <b>' + M.fmtM(pr.frente) + '</b></span><span>fundo <b>' + M.fmtM(pr.fundo) + '</b></span>' + (pr.salao ? '<span class="dim">mín. 1,50 m laterais · 0,50 m cabeceiras</span>' : '<span class="dim">até a divisa do terreno</span>') + '</div>';
      h += '<div class="alertas">' + al.map(function (q) { return '<div class="al ' + q.nivel + '"><i></i>' + esc(q.msg) + '</div>'; }).join('') + '</div>';
      h += '<p class="vsub" style="margin-top:8px">Perímetro ' + M.num(i.perimetro) + ' m · área molhada (fundo + paredes) ' + M.num(i.molhada) + ' m² · <button class="chip sm" data-pis-ir="' + a.id + '">ver na planta</button></p></section>';
    });
    var eq = p.equip || {};
    h += '<section class="pis"><h3>Equipamentos</h3><p class="vsub">Valores em reais, editáveis — entram no orçamento no grupo Piscina.</p><div class="f-row pis-f">' + campo('pis-aq', 'AQUECIMENTO', M.num((eq.aquecimento || 0) / 100), 'R$') + campo('pis-fi', 'FILTRAGEM E TRATAMENTO', M.num((eq.filtragem || 0) / 100), 'R$') + '</div>';
    h += '<table class="tbl">' + M.custoPiscinaItens().map(function (it) { return '<tr><td>' + esc(it.rot) + '</td><td class="n">' + M.fmtBRL(it.valor) + '</td></tr>'; }).join('') +
      ps.map(function (a) { return '<tr><td>' + esc(a.nome) + ' em concreto armado (' + M.fmtM2(M.areaOf(a)) + ')</td><td class="n">' + M.fmtBRL(M.custoDe(a)) + '</td></tr>'; }).join('') +
      '<tr class="tot"><td>PISCINA — TOTAL</td><td class="n">' + M.fmtBRL(M.custoPiscina() + ps.reduce(function (s2, a) { return s2 + M.custoDe(a); }, 0)) + '</td></tr></table></section>';
    return h;
  }
  function alertasTodos(){
    var out = [];
    M.problemas().forEach(function (q) { if (q.tipo !== 'piscina') out.push({nivel:'erro', msg:q.msg}); });
    M.piscinas().forEach(function (a) { M.piscinaAlertas(a).forEach(function (q) { out.push(q); }); });
    if (M.ocupacao() <= 70) out.push({nivel:'ok', msg:'Taxa de ocupação de ' + M.fmtPct(M.ocupacao()) + ' (' + M.fmtM2(M.projecao()) + ' em ' + M.fmtM2(M.areaTerreno()) + ')'});
    var oc = M.orcamento();
    if (M.proj.meta > 0) out.push(oc.total > M.proj.meta ? {nivel:'aviso', msg:'Estimativa ' + M.fmtBRL(oc.total) + ' acima da meta de ' + M.fmtBRL(M.proj.meta) + ' (+' + M.fmtPct((oc.total - M.proj.meta) / M.proj.meta * 100) + ')'} : {nivel:'ok', msg:'Estimativa dentro da meta de ' + M.fmtBRL(M.proj.meta)});
    var gp = oc.grupos.filter(function (g) { return g.grupo === 'Piscina'; })[0];
    if (gp && gp.valor / oc.subtotal > .35) out.push({nivel:'aviso', msg:'A piscina representa ' + M.fmtPct(gp.valor / oc.subtotal * 100) + ' do investimento — verificar viabilidade'});
    if (M.nPavs() > 1) { var bal = M.proj.ambientes.filter(function (a) { return M.pavDe(a) && M.apoio(a) < .5; }); if (!bal.length) out.push({nivel:'ok', msg:'Todos os ambientes do andar de cima apoiam no de baixo'}); }
    if (!M.proj.ambientes.some(function (a) { return a.tipo === 'molhado'; })) out.push({nivel:'aviso', msg:'Nenhum ambiente molhado (banheiro, cozinha ou vestiário)'});
    return out;
  }
  /* guarda uma foto do 3D como render (JPEG até 1280 px, para caber no armazenamento) */
  function guardarRender(dataUrl, titulo){
    var img = new Image();
    img.onload = function () {
      var k = Math.min(1, 1280 / img.width), cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      var cx = cv.getContext('2d'); cx.fillStyle = '#FFFFFF'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(img, 0, 0, cv.width, cv.height);
      var n = (M.proj.renders || []).length + 1;
      M.addRender({titulo:titulo + ' ' + String(n).padStart(2, '0'), src:cv.toDataURL('image/jpeg', .82)});
      toast('Render guardado (' + M.proj.renders.length + '/' + M.MAX_RENDERS + '). Veja em Renders.', function () { irPara('renders'); }, false, 'Abrir');
    };
    img.src = dataUrl;
  }

  function ligarView(v, pad){
    if (v === 'tresd' && window.TRES) { ligar3D(pad); return; }
    if (v === 'piscina') {
      var addP = pad.querySelector('#pis-add'); if (addP) addP.onclick = function () { var i2 = M.LIB.map(function (l) { return l.nome; }).indexOf('Piscina'); addDaLib(i2); irPara('piscina'); };
      M.piscinas().forEach(function (a) {
        function bindP(id, fn){ var el = pad.querySelector('#' + id); if (!el) return; el.onkeydown = function (e) { if (e.key === 'Enter') this.blur(); }; el.onchange = function () { fn(this.value); }; }
        var vert = a.h >= a.w;
        bindP('pis-comp-' + a.id, function (v2) { var n = M.parseM(v2); if (n) { if (vert) a.h = Math.max(200, n); else a.w = Math.max(200, n); M.commit('Comprimento da piscina'); irPara('piscina'); } });
        bindP('pis-larg-' + a.id, function (v2) { var n = M.parseM(v2); if (n) { if (vert) a.w = Math.max(150, n); else a.h = Math.max(150, n); M.commit('Largura da piscina'); irPara('piscina'); } });
        bindP('pis-prof-' + a.id, function (v2) { var n = M.parseM(v2); if (n) { a.prof = Math.max(40, n); if ((a.profMax || 0) < a.prof) a.profMax = a.prof; M.commit('Profundidade da piscina'); irPara('piscina'); } });
        bindP('pis-profmax-' + a.id, function (v2) { var n = M.parseM(v2); if (n) { a.profMax = Math.max(a.prof || 40, n); M.commit('Profundidade máxima da piscina'); irPara('piscina'); } });
        bindP('pis-raias-' + a.id, function (v2) { var n = parseInt(v2, 10); if (n > 0) { a.raias = Math.min(12, n); M.commit('Raias da piscina'); irPara('piscina'); } });
        bindP('pis-raia-' + a.id, function (v2) { var n = M.parseM(v2); if (n) { a.raia = Math.max(100, n); M.commit('Largura da raia'); irPara('piscina'); } });
      });
      pad.querySelectorAll('[data-pis-dim]').forEach(function (b) { b.onclick = function () {
        var q = b.getAttribute('data-pis-dim').split('|'), a = M.proj.ambientes.filter(function (x) { return x.id === q[0]; })[0]; if (!a) return;
        var vert = a.h >= a.w, cx2 = a.x + a.w / 2, cy2 = a.y + a.h / 2, comp = +q[1], larg = +q[2];
        a.w = vert ? larg : comp; a.h = vert ? comp : larg; a.x = Math.round(cx2 - a.w / 2); a.y = Math.round(cy2 - a.h / 2); a.raias = Math.max(1, Math.floor(larg / (a.raia || 150)));
        M.commit('Piscina ' + M.fmtMs(comp) + ' × ' + M.fmtMs(larg)); irPara('piscina'); toast('Piscina ' + M.fmtMs(comp) + ' × ' + M.fmtMs(larg) + ' m — confira as praias.', function () { fazerUndo(); });
      }; });
      pad.querySelectorAll('[data-pis-ir]').forEach(function (b) { b.onclick = function () { var id2 = b.getAttribute('data-pis-ir'); irPara('planta'); var a = M.proj.ambientes.filter(function (x) { return x.id === id2; })[0]; if (a) { M.setPav(M.pavDe(a)); PLAN.enquadrarAmb(a); PLAN.selecionar(id2); } }; });
      var aq = pad.querySelector('#pis-aq'), fi = pad.querySelector('#pis-fi');
      function reais(v2){ var n = parseFloat(String(v2).replace(/\./g, '').replace(',', '.')); return isNaN(n) ? null : Math.round(n * 100); }
      if (aq) aq.onchange = function () { var n = reais(this.value); if (n !== null) { M.proj.equip = M.proj.equip || {}; M.proj.equip.aquecimento = n; M.commit('Aquecimento da piscina'); irPara('piscina'); } };
      if (fi) fi.onchange = function () { var n = reais(this.value); if (n !== null) { M.proj.equip = M.proj.equip || {}; M.proj.equip.filtragem = n; M.commit('Filtragem da piscina'); irPara('piscina'); } };
      return;
    }
    if (v === 'camadas') {
      pad.querySelectorAll('[data-cam-vis]').forEach(function (b) { b.onclick = function () { var k = b.getAttribute('data-cam-vis'); M.setCamada(k, 'vis', !M.camada(k).vis); M.salvar(); irPara('camadas'); }; });
      pad.querySelectorAll('[data-cam-bloq]').forEach(function (b) { b.onclick = function () { var k = b.getAttribute('data-cam-bloq'); M.setCamada(k, 'bloq', !M.camada(k).bloq); M.salvar(); irPara('camadas'); }; });
      return;
    }
    if (v === 'cotas') {
      var lst2 = M.cotasLista();
      pad.querySelectorAll('.cota-in').forEach(function (el) {
        el.onkeydown = function (e) { if (e.key === 'Enter') this.blur(); if (e.key === 'Escape') { this.value = M.fmtMs(lst2[+this.getAttribute('data-cota-i')].cm); this.blur(); } };
        el.onchange = function () { var c = lst2[+this.getAttribute('data-cota-i')], n = M.parseM(this.value); if (!c || !n) { irPara('cotas'); return; } M.setCota(c.ref, c.campo, Math.max(c.ref === 'terreno' && /recuo/.test(c.campo) ? 0 : 40, n)); M.commit('Cota: ' + c.rot); irPara('cotas'); };
      });
      var addC = pad.querySelector('#cota-add');
      if (addC) addC.onclick = function () { var nm = pad.querySelector('#cota-nome').value.trim(), vl = M.parseM(pad.querySelector('#cota-val').value), ob = pad.querySelector('#cota-obs').value.trim(); if (!nm || !vl) { toast('Informe nome e distância.', null, true); return; } M.proj.cotas = M.proj.cotas || []; M.proj.cotas.push({id:M.uid(), nome:nm, cm:vl, obs:ob}); M.commit('Adicionar cota'); irPara('cotas'); };
      pad.querySelectorAll('[data-cota-del]').forEach(function (b) { b.onclick = function () { var id2 = b.getAttribute('data-cota-del'); M.proj.cotas = (M.proj.cotas || []).filter(function (c) { return c.id !== id2; }); M.commit('Excluir cota'); irPara('cotas'); }; });
      return;
    }
    if (v === 'renders') {
      pad.querySelectorAll('[data-go]').forEach(function (b) { b.onclick = function () { irPara(b.getAttribute('data-go')); toast('Escolha o ângulo e clique em + Render.'); }; });
      var fin = pad.querySelector('#rend-file');
      if (fin) fin.onchange = function () { Array.prototype.forEach.call(this.files, function (file) { var rd = new FileReader(); rd.onload = function () { guardarRender(rd.result, file.name.replace(/\.[^.]+$/, '')); setTimeout(function () { if (viewAtual === 'renders') irPara('renders'); }, 300); }; rd.readAsDataURL(file); }); };
      pad.querySelectorAll('[data-rend-cap]').forEach(function (el) { el.onkeydown = function (e) { if (e.key === 'Enter') this.blur(); }; el.onchange = function () { var r = (M.proj.renders || []).filter(function (x) { return x.id === el.getAttribute('data-rend-cap'); })[0]; if (r) { r.titulo = this.value.trim(); M.salvar(); } }; });
      pad.querySelectorAll('[data-rend-del]').forEach(function (b) { b.onclick = function () { M.delRender(b.getAttribute('data-rend-del')); irPara('renders'); }; });
      return;
    }
    if (v === 'relatorio') {
      pad.querySelectorAll('[data-exp]').forEach(function (b) { b.onclick = function () { exportar(b.getAttribute('data-exp')); }; });
      return;
    }
    if (v === 'orcamento') {
      var res = pad.querySelector('#orc-res');
      if (res) { res.oninput = function () { pad.querySelector('#orc-res-v').textContent = M.fmtPct(+this.value); }; res.onchange = function () { M.proj.reservaPct = +this.value; M.commit('Reserva técnica'); irPara('orcamento'); }; }
      pad.querySelectorAll('[data-equip]').forEach(function (b) { b.onclick = function () { irPara('piscina'); }; });
    }
    if (v === 'pavimentos') {
      pad.querySelectorAll('[data-pav-add]').forEach(function (b) { b.onclick = function () { M.addPavimento(b.getAttribute('data-pav-add') === 'copia'); M.commit('Adicionar ' + M.nomePav(M.pav)); irPara('planta'); toast(M.nomePav(M.pav) + ' criado. Ajuste os ambientes na planta.'); }; });
      pad.querySelectorAll('[data-pav-ir]').forEach(function (b) { b.onclick = function () { M.setPav(+b.getAttribute('data-pav-ir')); irPara('planta'); }; });
      pad.querySelectorAll('[data-pav-del]').forEach(function (b) { b.onclick = function () { var n2 = +b.getAttribute('data-pav-del'); M.removerPavimento(n2); M.commit('Remover ' + M.nomePav(n2)); irPara('pavimentos'); toast(M.nomePav(n2) + ' removido.', function () { fazerUndo(); }); }; });
      return;
    }
    if (v === 'ambientes') {
      pad.querySelectorAll('tr[data-id]').forEach(function (tr) {
        tr.onclick = function (e) {
          if (e.target.getAttribute('data-del')) return;
          var idA = tr.getAttribute('data-id'), amb2 = M.proj.ambientes.filter(function (x) { return x.id === idA; })[0];
          if (amb2) M.setPav(M.pavDe(amb2));
          irPara('planta'); PLAN.selecionar(idA);
        };
      });
      pad.querySelectorAll('[data-del]').forEach(function (b) {
        b.onclick = function (e) { e.stopPropagation(); excluir(b.getAttribute('data-del')); irPara('ambientes'); };
      });
      pad.querySelectorAll('[data-lib]').forEach(function (b) {
        b.onclick = function () { addDaLib(parseInt(b.getAttribute('data-lib'), 10)); };
      });
    }
    if (v === 'simulador') {
      pad.querySelectorAll('[data-padrao]').forEach(function (b) {
        b.onclick = function () { M.proj.padrao = b.getAttribute('data-padrao'); M.commit('Mudar padrão'); irPara('simulador'); };
      });
      var meta = pad.querySelector('#sim-meta');
      if (meta) {
        meta.oninput = function () { pad.querySelector('#sim-meta-v').textContent = M.fmtBRL(this.value * 100); };
        meta.onchange = function () { M.proj.meta = this.value * 100; M.commit('Definir meta'); irPara('simulador'); };
      }
      var pd = pad.querySelector('#sim-pd');
      if (pd) {
        pd.oninput = function () { pad.querySelector('#sim-pd-v').textContent = M.fmtM(this.value); };
        pd.onchange = function () { M.proj.peDireito = parseInt(this.value, 10); M.commit('Mudar pé-direito'); };
      }
      var cns2 = M.cenarios();
      pad.querySelectorAll('[data-cen]').forEach(function (b) { b.onclick = function () { var c = cns2[+b.getAttribute('data-cen')]; if (!c) return; M.aplicarCenario(c); M.commit('Cenário: ' + c.nome); irPara('simulador'); toast('“' + c.nome + '” aplicado.', function () { fazerUndo(); }); }; });
    }
    if (v === 'exportar') {
      pad.querySelectorAll('[data-exp]').forEach(function (b) {
        b.onclick = function () { exportar(b.getAttribute('data-exp')); };
      });
      var vs = pad.querySelector('#ver-salvar');
      if (vs) vs.onclick = function () { var v2 = M.salvarVersao(pad.querySelector('#ver-nome').value.trim()); irPara('exportar'); toast('Versão “' + v2.nome + '” guardada.'); };
      pad.querySelectorAll('[data-ver-nome]').forEach(function (b) { b.onclick = function () { pad.querySelector('#ver-nome').value = b.getAttribute('data-ver-nome'); }; });
      pad.querySelectorAll('[data-ver-ir]').forEach(function (b) { b.onclick = function () { if (M.carregarVersao(b.getAttribute('data-ver-ir'))) { irPara('planta'); toast('Versão carregada.', function () { fazerUndo(); }); } }; });
      pad.querySelectorAll('[data-ver-del]').forEach(function (b) { b.onclick = function () { M.excluirVersao(b.getAttribute('data-ver-del')); irPara('exportar'); }; });
    }
  }

  /* ================= INSPECTOR ================= */
  /* ---- celular: o inspector é uma folha que sobe de baixo ----
     abre ao TOCAR (sem arrastar) num ambiente/móvel ou pelo botão de ajustes;
     fecha ao tocar fora, no ✕, ou quando a seleção some (se foi aberta por seleção). */
  var inspAberto = false, inspPorSel = false;
  function isMobile(){ return window.matchMedia && window.matchMedia('(max-width:900px)').matches; }
  function setInsp(on, porSel){
    inspAberto = !!on; inspPorSel = !!on && !!porSel;
    document.getElementById('app').classList.toggle('insp-on', inspAberto);
  }
  function selTap(){ if (isMobile() && (PLAN.atual() || PLAN.movAtual())) setInsp(true, true); }

  function inspector(){
    var a = PLAN.atual(), p = M.proj, h = '', mv = PLAN.movAtual();
    if (PLAN.multi.length > 1) { inspectorGrupo(); return; }
    if (isMobile()) {
      if (!a && !mv && inspPorSel) setInsp(false);
      h += '<button class="icon-btn insp-close" onclick="UI.fecharInsp()" title="Fechar">' + icon('close') + '</button>';
    }
    if (mv && window.MOVEIS) {
      var d = MOVEIS.def(mv.k) || {nome:'Móvel', cat:''}, dm = MOVEIS.dims(mv), amb = M.ambienteDe(mv);
      var cat = MOVEIS.CATS.filter(function (c) { return c.k === d.cat; })[0];
      h += '<h4><span class="insp-thumb">' + MOVEIS.thumb(mv.k, 26) + '</span>' + esc(d.nome) + '</h4>';
      h += '<div class="sub">' + (cat ? cat.rot : 'Móvel') + (amb ? ' · em ' + esc(amb.nome) : ' · fora dos ambientes') + '</div>';
      h += '<section><h6>MEDIDAS</h6><div class="f-row">' +
        campo('m-w', 'LARGURA', M.fmtMs(dm.w), 'm') + campo('m-d', 'PROFUND.', M.fmtMs(dm.d), 'm') + '</div>' +
        '<div class="f-row">' + campo('m-alt', 'ALTURA', M.fmtMs(dm.alt), 'm') + campo('m-elev', 'ELEVAÇÃO', M.fmtMs(mv.elev || 0), 'm') + '</div></section>';
      h += '<section><h6>POSIÇÃO</h6><div class="f-row">' +
        campo('m-x', 'X (CENTRO)', M.fmtMs(mv.x), 'm') + campo('m-y', 'Y (CENTRO)', M.fmtMs(mv.y), 'm') + '</div>' +
        '<div class="f-row">' + campo('m-rot', 'ÂNGULO', String(mv.rot || 0), '°') +
        '<div class="f"><label>ESPELHADO</label><div class="chips"><button class="chip' + (mv.esp ? ' on' : '') + '" data-mact="esp">' + (mv.esp ? 'Sim' : 'Não') + '</button></div></div></div></section>';
      h += '<section><h6>AÇÕES</h6><div class="acts">' +
        '<button class="btn" data-mact="rot">Girar 90° <kbd style="margin-left:auto">⇧ R</kbd></button>' +
        '<button class="btn" data-mact="dup">Duplicar <kbd style="margin-left:auto">Ctrl D</kbd></button>' +
        '<button class="btn" data-mact="reset">Medidas de fábrica</button>' +
        '<button class="btn danger" data-mact="del">Excluir <kbd style="margin-left:auto">Del</kbd></button>' +
        '</div></section>';
      insp.innerHTML = h;
      ligarInspectorMovel(mv);
      return;
    }
    if (a) {
      var ti = M.TIPOS[a.tipo] || M.TIPOS.social;
      h += '<h4><span style="width:9px;height:9px;border-radius:2px;background:' + ti.cor + ';display:inline-block"></span>' + esc(a.nome) + '</h4>';
      h += '<div class="sub">' + ti.rot + '</div>';
      h += '<section><h6>NOME</h6><div class="f"><div class="inp"><input id="i-nome" value="' + esc(a.nome) + '"></div></div></section>';
      h += '<section><h6>MEDIDAS</h6><div class="f-row">' +
        campo('i-w', 'LARGURA', M.fmtMs(a.w), 'm') + campo('i-h', 'PROFUND.', M.fmtMs(a.h), 'm') + '</div>' +
        '<div class="f-row">' + campo('i-x', 'X', M.fmtMs(a.x), 'm') + campo('i-y', 'Y', M.fmtMs(a.y), 'm') + '</div>' +
        '<div class="kv derived" title="' + M.fmtM(a.w) + ' × ' + M.fmtM(a.h) + '"><span>Área</span><b>' + M.fmtM2(M.areaOf(a)) + '</b></div>' +
        '<div class="kv derived" title="' + M.fmtM2(M.areaOf(a)) + ' × ' + M.fmtBRL(ti.custo[p.padrao] * 100) + '/m²"><span>Custo estimado</span><b>' + M.fmtBRL(M.custoDe(a)) + '</b></div>' +
        '</section>';
      if (a.tipo === 'agua') {
        var pi = M.piscinaInfo(a), prs = pi.praias;
        h += '<section><h6>PISCINA</h6><div class="f-row">' + campo('i-prof', 'PROF. MÍN.', M.fmtMs(pi.prof), 'm') + campo('i-profmax', 'PROF. MÁX.', M.fmtMs(pi.profMax), 'm') + '</div>' +
          '<div class="f-row">' + campo('i-raias', 'RAIAS', pi.raias, 'un') + campo('i-raia', 'LARG. RAIA', M.fmtMs(pi.raia), 'm') + '</div>' +
          kv('Volume de água', M.num(pi.volume) + ' m³', 'área × profundidade média') +
          (prs.salao ? kv('Praias', M.fmtMs(prs.esq) + ' · ' + M.fmtMs(prs.dir) + ' · ' + M.fmtMs(prs.frente) + ' · ' + M.fmtMs(prs.fundo), 'esq · dir · frente · fundo, até as paredes de ' + prs.salao.nome) : '') +
          (!pi.raiasCabem ? '<div class="ins-empty" style="color:#FF9583">As raias não cabem na largura.</div>' : '') +
          '<button class="btn" data-act="piscina" style="margin-top:8px">Abrir aba Piscina</button></section>';
      }
      if (M.nPavs() > 1 || M.pavDe(a) > 0) {
        h += '<section><h6>PAVIMENTO</h6><div class="chips">';
        for (var pv2 = 0; pv2 < M.nPavs(); pv2++) h += '<button class="chip' + (M.pavDe(a) === pv2 ? ' on' : '') + '" data-pav-amb="' + pv2 + '">' + M.nomePav(pv2) + '</button>';
        h += '</div>' + (M.pavDe(a) > 0 ? '<div class="kv derived" title="área sobre ambientes cobertos do andar de baixo"><span>Apoio no andar de baixo</span><b>' + M.fmtPct(M.apoio(a) * 100) + '</b></div>' : '') + '</section>';
      }
      h += '<section><h6>TIPO</h6><div class="chips">' +
        Object.keys(M.TIPOS).map(function (k) {
          return '<button class="chip' + (a.tipo === k ? ' on' : '') + '" data-tipo="' + k + '">' + M.TIPOS[k].rot + '</button>';
        }).join('') + '</div></section>';
      h += '<section><h6>AÇÕES</h6><div class="acts">' +
        '<button class="btn" data-act="dup">Duplicar <kbd style="margin-left:auto">Ctrl D</kbd></button>' +
        '<button class="btn" data-act="rot">Girar 90°</button>' +
        '<button class="btn danger" data-act="del">Excluir <kbd style="margin-left:auto">Del</kbd></button>' +
        '</div></section>';
    } else {
      h += '<h4>' + esc(p.nome) + '</h4><div class="sub">' + M.fmtMs(p.terreno.largura) + ' × ' + M.fmtMs(p.terreno.profundidade) + ' m · ' + M.fmtM2(M.areaTerreno()) + '</div>';
      h += '<section><h6>TERRENO</h6><div class="f-row">' +
        campo('i-tl', 'LARGURA', M.fmtMs(p.terreno.largura), 'm') + campo('i-tp', 'PROFUND.', M.fmtMs(p.terreno.profundidade), 'm') + '</div>' +
        '<div class="f-row">' + campo('i-rf', 'RECUO FRENTE', M.fmtMs(p.terreno.recuoFrontal), 'm') + campo('i-rl', 'RECUO LADO', M.fmtMs(p.terreno.recuoLateral), 'm') + '</div>' +
        '<div class="f-row">' + campo('i-rb', 'RECUO FUNDO', M.fmtMs(p.terreno.recuoFundo), 'm') + campo('i-pd', 'PÉ-DIREITO', M.fmtMs(p.peDireito), 'm') + '</div></section>';
      h += '<section><h6>NÚMEROS</h6>' +
        kv('Área do terreno', M.fmtM2(M.areaTerreno()), 'largura × profundidade') +
        kv('Área construída', M.fmtM2(M.areaConstruida()), 'soma dos ambientes cobertos') +
        kv('Taxa de ocupação', M.fmtPct(M.ocupacao()), 'construída ÷ terreno') +
        (M.espelhoAgua() ? kv('Espelho d’água', M.fmtM2(M.espelhoAgua()), '') : '') +
        kv('Investimento', M.fmtBRL(M.orcamento().total), 'ambientes ' + M.fmtBRL(M.custoTotal()) + ' + fachada ' + M.fmtBRL(M.custoFachada()) + (M.custoPiscina() ? ' + piscina ' + M.fmtBRL(M.custoPiscina()) : '') + ' + reserva ' + M.fmtPct(M.orcamento().reservaPct)) +
        '</section>';
      var pr = M.problemas();
      if (pr.length) {
        h += '<section><h6>ATENÇÃO</h6><div class="ins-empty" style="color:#FF9583;line-height:1.7">' +
          pr.slice(0, 5).map(function (q) { return '• ' + esc(q.msg); }).join('<br>') + '</div></section>';
      }
      h += '<section><div class="ins-empty">Clique num ambiente da planta para editar. Nada selecionado mostra o projeto.</div></section>';
    }
    insp.innerHTML = h;
    ligarInspector(a);
  }
  /* grupo selecionado pelo laço: N itens, ações em bloco */
  function inspectorGrupo(){
    var g = PLAN.itensGrupo(), n = g.ambs.length + g.movs.length, bb = PLAN.bboxGrupo(g), h = '';
    if (isMobile()) h += '<button class="icon-btn insp-close" onclick="UI.fecharInsp()" title="Fechar">' + icon('close') + '</button>';
    h += '<h4>' + n + ' itens selecionados</h4><div class="sub">' + g.ambs.length + (g.ambs.length === 1 ? ' ambiente' : ' ambientes') + ' · ' + g.movs.length + (g.movs.length === 1 ? ' móvel' : ' móveis') + (bb ? ' · ' + M.fmtMs(bb.w) + ' × ' + M.fmtMs(bb.h) + ' m' : '') + '</div>';
    h += '<section><h6>NO GRUPO</h6><div class="ins-empty" style="line-height:1.7">' + g.ambs.map(function (o) { return '▪ ' + esc(o.a.nome); }).concat(g.movs.filter(function (o) { return !g.ambs.some(function (q) { return M.contem(q.a, {x:o.m.x, y:o.m.y, w:0, h:0}); }); }).map(function (o) { return '▫ ' + esc((MOVEIS.def(o.m.k) || {}).nome || 'Móvel'); })).join('<br>') + '</div></section>';
    h += '<section><h6>MOVER</h6><div class="f-row">' + campo('g-dx', 'DESLOCAR X', '0,00', 'm') + campo('g-dy', 'DESLOCAR Y', '0,00', 'm') + '</div><div class="ins-empty" style="margin-top:-2px">Ou arraste qualquer item do grupo na planta. Setas movem 5 cm (⇧ 50 cm).</div></section>';
    h += '<section><h6>AÇÕES</h6><div class="acts">' +
      '<button class="btn" data-gact="dup">Duplicar grupo <kbd style="margin-left:auto">Ctrl D</kbd></button>' +
      (M.nPavs() > 1 && g.ambs.length ? Array.apply(null, Array(M.nPavs())).map(function (_, pv) { return pv === M.pav ? '' : '<button class="btn" data-gact="pav" data-pv="' + pv + '">Enviar para ' + M.nomePav(pv) + '</button>'; }).join('') : '') +
      '<button class="btn" data-gact="none">Desmarcar <kbd style="margin-left:auto">Esc</kbd></button>' +
      '<button class="btn danger" data-gact="del">Excluir tudo <kbd style="margin-left:auto">Del</kbd></button></div></section>';
    insp.innerHTML = h;
    function bindG(id, fn){ var el = insp.querySelector('#' + id); if (!el) return; el.onkeydown = function (e) { if (e.key === 'Enter') this.blur(); e.stopPropagation(); }; el.onchange = function () { fn(this.value); }; }
    bindG('g-dx', function (v) { var n = M.parseM(v); if (n) { PLAN.moverGrupo(PLAN.itensGrupo(), n, 0); M.commit('Mover grupo'); PLAN.render(); inspector(); } });
    bindG('g-dy', function (v) { var n = M.parseM(v); if (n) { PLAN.moverGrupo(PLAN.itensGrupo(), 0, n); M.commit('Mover grupo'); PLAN.render(); inspector(); } });
    insp.querySelectorAll('[data-gact]').forEach(function (b) { b.onclick = function () { acaoGrupo(b.getAttribute('data-gact'), b.getAttribute('data-pv')); }; });
  }
  function acaoGrupo(k, pv){
    var g = PLAN.itensGrupo(), n = g.ambs.length + g.movs.length; if (!n) return;
    if (k === 'none') { PLAN.setMulti([]); return; }
    if (k === 'del') {
      var idsA = g.ambs.map(function (o) { return o.a.id; }), idsM = g.movs.map(function (o) { return o.m.id; });
      M.proj.ambientes = M.proj.ambientes.filter(function (a) { return idsA.indexOf(a.id) < 0; });
      M.proj.moveis = (M.proj.moveis || []).filter(function (m) { return idsM.indexOf(m.id) < 0; });
      PLAN.setMulti([]); M.commit('Excluir ' + n + ' itens'); PLAN.render(); inspector();
      toast(n + ' itens excluídos.', function () { fazerUndo(); }); return;
    }
    if (k === 'dup') {
      var bb = PLAN.bboxGrupo(g), dx = bb ? Math.min(bb.w + 30, 300) : 50, novos = [], mapa = {};
      g.ambs.forEach(function (o) { var c = JSON.parse(JSON.stringify(o.a)); c.id = M.uid(); c.x += dx; mapa[o.a.id] = c.id; M.proj.ambientes.push(c); novos.push({t:'amb', id:c.id}); });
      g.movs.forEach(function (o) { var c = JSON.parse(JSON.stringify(o.m)); c.id = M.uid(); c.x += dx; if (c.amb && mapa[c.amb]) c.amb = mapa[c.amb]; M.proj.moveis.push(c); if (!(o.m.amb && mapa[o.m.amb])) novos.push({t:'mov', id:c.id}); });
      M.commit('Duplicar ' + n + ' itens'); PLAN.setMulti(novos); toast('Grupo duplicado ao lado — arraste para o lugar.'); return;
    }
    if (k === 'pav') {
      var pv2 = +pv;
      g.ambs.forEach(function (o) { if (pv2) o.a.pav = pv2; else delete o.a.pav; });
      g.movs.forEach(function (o) { if (pv2) o.m.pav = pv2; else delete o.m.pav; });
      M.commit('Enviar grupo para ' + M.nomePav(pv2)); M.setPav(pv2); irPara('planta'); toast(n + ' itens enviados para ' + M.nomePav(pv2) + '.', function () { fazerUndo(); });
    }
  }
  function campo(id, rot, val, un){
    return '<div class="f"><label>' + rot + '</label><div class="inp"><input id="' + id + '" value="' + val + '"><span class="un">' + un + '</span></div></div>';
  }
  function kv(k, v, dica){
    return '<div class="kv' + (dica ? ' derived' : '') + '"' + (dica ? ' title="' + dica + '"' : '') + '><span>' + k + '</span><b>' + v + '</b></div>';
  }
  function ligarInspector(a){
    function bind(id, aplicar){
      var el = insp.querySelector('#' + id); if (!el) return;
      el.onkeydown = function (e) {
        if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
        if (e.key === 'Escape') { inspector(); }
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          var v = M.parseM(el.value); if (v === null) return;
          var passo = e.shiftKey ? 50 : 5;
          el.value = M.fmtMs(v + (e.key === 'ArrowUp' ? passo : -passo));
          el.dispatchEvent(new Event('change'));
        }
      };
      el.onchange = function () { aplicar(el.value); };
    }
    if (a) {
      var el = insp.querySelector('#i-nome');
      if (el) el.onchange = function () { a.nome = this.value.trim() || 'Ambiente'; M.commit('Renomear ambiente'); PLAN.render(); inspector(); };
      if (el) el.onkeydown = function (e) { if (e.key === 'Enter') this.blur(); };
      bind('i-w', function (v) { var n = M.parseM(v); if (n) { a.w = Math.max(90, n); M.commit('Mudar largura'); PLAN.render(); inspector(); } });
      bind('i-h', function (v) { var n = M.parseM(v); if (n) { a.h = Math.max(90, n); M.commit('Mudar profundidade'); PLAN.render(); inspector(); } });
      bind('i-x', function (v) { var n = M.parseM(v); if (n !== null) { a.x = n; M.commit('Mover ambiente'); PLAN.render(); inspector(); } });
      bind('i-y', function (v) { var n = M.parseM(v); if (n !== null) { a.y = n; M.commit('Mover ambiente'); PLAN.render(); inspector(); } });
      bind('i-prof', function (v) { var n = M.parseM(v); if (n) { a.prof = Math.max(40, n); if ((a.profMax || 0) < a.prof) a.profMax = a.prof; M.commit('Profundidade da piscina'); PLAN.render(); inspector(); } });
      bind('i-profmax', function (v) { var n = M.parseM(v); if (n) { a.profMax = Math.max(a.prof || 40, n); M.commit('Profundidade máxima'); PLAN.render(); inspector(); } });
      bind('i-raias', function (v) { var n = parseInt(v, 10); if (n > 0) { a.raias = Math.min(12, n); M.commit('Raias da piscina'); PLAN.render(); inspector(); } });
      bind('i-raia', function (v) { var n = M.parseM(v); if (n) { a.raia = Math.max(100, n); M.commit('Largura da raia'); PLAN.render(); inspector(); } });
      insp.querySelectorAll('[data-tipo]').forEach(function (b) {
        b.onclick = function () { a.tipo = b.getAttribute('data-tipo'); M.commit('Mudar tipo'); PLAN.render(); inspector(); };
      });
      insp.querySelectorAll('[data-pav-amb]').forEach(function (b) {
        b.onclick = function () {
          var n3 = +b.getAttribute('data-pav-amb'); if (n3) a.pav = n3; else delete a.pav;
          (M.proj.moveis || []).forEach(function (m) { if (m.amb === a.id) { if (n3) m.pav = n3; else delete m.pav; } });
          M.commit('Mover para ' + M.nomePav(n3)); M.setPav(n3); PLAN.render(); pavSel(); inspector();
        };
      });
      insp.querySelectorAll('[data-act]').forEach(function (b) {
        b.onclick = function () {
          var k = b.getAttribute('data-act');
          if (k === 'dup') duplicar(a.id);
          if (k === 'rot') { var w = a.w; a.w = a.h; a.h = w; M.commit('Girar ambiente'); PLAN.render(); inspector(); }
          if (k === 'del') excluir(a.id);
          if (k === 'piscina') irPara('piscina');
        };
      });
    } else {
      var t = M.proj.terreno;
      bind('i-tl', function (v) { var n = M.parseM(v); if (n) { t.largura = n; M.commit('Mudar terreno'); PLAN.enquadrar(); PLAN.render(); inspector(); } });
      bind('i-tp', function (v) { var n = M.parseM(v); if (n) { t.profundidade = n; M.commit('Mudar terreno'); PLAN.enquadrar(); PLAN.render(); inspector(); } });
      bind('i-rf', function (v) { var n = M.parseM(v); if (n !== null) { t.recuoFrontal = n; M.commit('Mudar recuo'); PLAN.render(); inspector(); } });
      bind('i-rl', function (v) { var n = M.parseM(v); if (n !== null) { t.recuoLateral = n; M.commit('Mudar recuo'); PLAN.render(); inspector(); } });
      bind('i-rb', function (v) { var n = M.parseM(v); if (n !== null) { t.recuoFundo = n; M.commit('Mudar recuo'); PLAN.render(); inspector(); } });
      bind('i-pd', function (v) { var n = M.parseM(v); if (n) { M.proj.peDireito = n; M.commit('Mudar pé-direito'); inspector(); } });
    }
  }

  function ligarInspectorMovel(mv){
    function bind(id, aplicar){
      var el = insp.querySelector('#' + id); if (!el) return;
      el.onkeydown = function (e) {
        if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
        if (e.key === 'Escape') { inspector(); }
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          var v = id === 'm-rot' ? parseFloat(el.value) : M.parseM(el.value); if (v === null || isNaN(v)) return;
          var passo = id === 'm-rot' ? (e.shiftKey ? 45 : 5) : (e.shiftKey ? 50 : 5);
          el.value = id === 'm-rot' ? String(v + (e.key === 'ArrowUp' ? passo : -passo)) : M.fmtMs(v + (e.key === 'ArrowUp' ? passo : -passo));
          el.dispatchEvent(new Event('change'));
        }
      };
      el.onchange = function () { aplicar(el.value); };
    }
    function fim(nome){ M.commit(nome); PLAN.render(); inspector(); radial(PLAN.movAtual()); }
    bind('m-w',   function (v) { var n = M.parseM(v); if (n) { mv.w = Math.max(10, n); fim('Mudar largura do móvel'); } });
    bind('m-d',   function (v) { var n = M.parseM(v); if (n) { mv.d = Math.max(10, n); fim('Mudar profundidade do móvel'); } });
    bind('m-alt', function (v) { var n = M.parseM(v); if (n) { mv.alt = Math.max(1, n); fim('Mudar altura do móvel'); } });
    bind('m-elev',function (v) { var n = M.parseM(v); if (n !== null) { mv.elev = Math.max(0, n); fim('Elevar móvel'); } });
    bind('m-x',   function (v) { var n = M.parseM(v); if (n !== null) { mv.x = n; fim('Mover móvel'); } });
    bind('m-y',   function (v) { var n = M.parseM(v); if (n !== null) { mv.y = n; fim('Mover móvel'); } });
    bind('m-rot', function (v) { var n = parseFloat(String(v).replace(',', '.')); if (!isNaN(n)) { mv.rot = ((Math.round(n) % 360) + 360) % 360; fim('Girar móvel'); } });
    insp.querySelectorAll('[data-mact]').forEach(function (b) { b.onclick = function () { acaoMovel(b.getAttribute('data-mact'), mv.id); }; });
  }
  /* ações do móvel — servem ao inspector, ao menu radial, ao 3D e aos atalhos */
  function acaoMovel(k, id){
    var mv = M.movelDe(id); if (!mv) return;
    if (k === 'rot')   { mv.rot = ((mv.rot || 0) + 90) % 360; M.commit('Girar móvel'); }
    if (k === 'rotm')  { mv.rot = ((mv.rot || 0) + 270) % 360; M.commit('Girar móvel'); }
    if (k === 'esp')   { mv.esp = !mv.esp; M.commit('Espelhar móvel'); }
    if (k === 'reset') { delete mv.w; delete mv.d; delete mv.alt; M.commit('Medidas de fábrica'); }
    if (k === 'dup') {
      var n = JSON.parse(JSON.stringify(mv)); n.id = M.uid(); n.x += 30; n.y += 30;
      M.proj.moveis.push(n); M.commit('Duplicar móvel'); selecionarMovel(n.id); return;
    }
    if (k === 'del') {
      var nome = (MOVEIS.def(mv.k) || {}).nome || 'Móvel';
      M.proj.moveis = M.proj.moveis.filter(function (x) { return x.id !== id; });
      M.commit('Excluir ' + nome); selecionarMovel(null);
      toast('“' + nome + '” excluído.', function () { fazerUndo(); }); return;
    }
    selecionarMovel(id);
  }
  /* seleção de móvel válida nas duas vistas */
  function selecionarMovel(id){
    if (viewAtual === 'tresd' && t3) { t3.selecionarMovel(id); PLAN.selecionarMovel(id); return; }
    PLAN.selecionarMovel(id);
  }
  function addMovel(k, x, y, rot){
    var d = MOVEIS.def(k); if (!d) return;
    var mv = M.addMovel(k, x, y, rot || 0);
    M.commit('Adicionar ' + d.nome);
    selecionarMovel(mv.id);
    if (viewAtual === 'planta') PLAN.render();
    toast('“' + d.nome + '” adicionado. Arraste para posicionar.');
    return mv;
  }
  /* ponto onde um item clicado no catálogo nasce: centro do ambiente selecionado, senão do maior ambiente visível */
  function ondeNasce(){
    var a = PLAN.atual();
    if (!a) { var mv = PLAN.movAtual(); if (mv) a = M.ambienteDe(mv); }
    if (!a && viewAtual === 'planta') {
      var v = PLAN.view, cx = v.x + v.w / 2, cy = v.y + v.h / 2, melhor = null, dist = 1e12;
      M.proj.ambientes.forEach(function (r) { var d = Math.hypot(r.x + r.w / 2 - cx, r.y + r.h / 2 - cy); if (d < dist) { dist = d; melhor = r; } });
      a = melhor;
    }
    if (!a) a = M.proj.ambientes[0];
    if (!a) { var t = M.proj.terreno; return {x: t.largura / 2, y: t.profundidade / 2}; }
    return {x: Math.round(a.x + a.w / 2), y: Math.round(a.y + a.h / 2)};
  }

  /* ================= CATÁLOGO DE MÓVEIS ================= */
  var catCat = null, catBusca = '';
  function toggleCatalogo(force){
    var c = $('#catalogo'), abrir = force !== undefined ? force : c.hidden;
    c.hidden = !abrir; $('#btn-mob').classList.toggle('on', abrir);
    var b3 = document.getElementById('t3-mob'); if (b3) b3.classList.toggle('on', abrir);
    if (abrir) catalogo();
  }
  function catalogo(){
    var c = $('#catalogo'), h = '';
    var lista = catBusca ? MOVEIS.buscar(catBusca) : (catCat ? MOVEIS.porCat(catCat) : null);
    var cat = catCat ? MOVEIS.CATS.filter(function (x) { return x.k === catCat; })[0] : null;
    h += '<div class="cat-hd">' + (catCat || catBusca ? '<button class="icon-btn" id="cat-back" title="Voltar"><i data-icon="chev"></i></button>' : '') +
      '<b>' + (catBusca ? 'Busca' : (cat ? cat.rot : 'Mobiliar')) + '</b><button class="icon-btn" id="cat-close" title="Fechar (M)">✕</button></div>';
    h += '<div class="cat-busca"><input id="cat-q" placeholder="Buscar móvel…" value="' + esc(catBusca) + '" autocomplete="off"></div>';
    if (!lista) {
      h += '<div class="cat-grid">';
      MOVEIS.CATS.forEach(function (c2) {
        h += '<button class="cat-item" data-cat="' + c2.k + '"><span class="th">' + MOVEIS.thumb(c2.capa, 64) + '</span><span>' + c2.rot + '</span><small>' + MOVEIS.porCat(c2.k).length + ' itens</small></button>';
      });
      h += '</div>';
      h += '<div class="cat-foot"><button class="btn sm" id="cat-auto">✨ Mobiliar automaticamente</button><p>Um móvel de cada ambiente, no lugar certo. Depois é só ajustar.</p></div>';
    } else {
      h += '<div class="cat-grid">';
      if (!lista.length) h += '<p class="cat-vazio">Nada com esse nome.</p>';
      lista.forEach(function (it) {
        h += '<button class="cat-item" draggable="true" data-k="' + it.k + '" title="Clique para adicionar, ou arraste para a planta"><span class="th">' + MOVEIS.thumb(it.k, 64) + '</span><span>' + esc(it.nome) + '</span><small>' + M.fmtMs(it.w) + ' × ' + M.fmtMs(it.d) + ' m</small></button>';
      });
      h += '</div>';
    }
    c.innerHTML = h; paintIcons(c);
    var q = c.querySelector('#cat-q');
    q.oninput = function () { catBusca = this.value.trim(); var pos = this.selectionStart; catalogo(); var q2 = $('#cat-q'); q2.focus(); q2.setSelectionRange(pos, pos); };
    q.onkeydown = function (e) { e.stopPropagation(); if (e.key === 'Escape') { catBusca = ''; catalogo(); } };
    var back = c.querySelector('#cat-back'); if (back) back.onclick = function () { catCat = null; catBusca = ''; catalogo(); };
    c.querySelector('#cat-close').onclick = function () { toggleCatalogo(false); };
    var auto = c.querySelector('#cat-auto');
    if (auto) auto.onclick = function () {
      M.mobiliarAuto(); M.commit('Mobiliar automaticamente');
      if (viewAtual === 'planta') PLAN.render(); inspector();
      toast((M.proj.moveis.length) + ' móveis colocados. Ctrl+Z desfaz.');
    };
    c.querySelectorAll('[data-cat]').forEach(function (b) { b.onclick = function () { catCat = b.getAttribute('data-cat'); catalogo(); }; });
    c.querySelectorAll('[data-k]').forEach(function (b) {
      b.onclick = function () {
        if (trocaMovel) {   /* substitui o móvel mantendo lugar e giro */
          var mv0 = M.movelDe(trocaMovel); trocaMovel = null;
          if (mv0) { var novo = {id:M.uid(), k:b.getAttribute('data-k'), x:mv0.x, y:mv0.y, rot:mv0.rot || 0}; if (mv0.esp) novo.esp = true; if (mv0.pav) novo.pav = mv0.pav; if (mv0.amb) novo.amb = mv0.amb;
            M.proj.moveis = M.proj.moveis.map(function (m) { return m.id === mv0.id ? novo : m; }); M.commit('Trocar móvel'); toggleCatalogo(false); selecionarMovel(novo.id); toast('Móvel trocado.', function () { fazerUndo(); }); return; }
        }
        var o = ondeNasce(); addMovel(b.getAttribute('data-k'), o.x, o.y);
      };
      b.ondragstart = function (e) { e.dataTransfer.setData('text/movel', b.getAttribute('data-k')); e.dataTransfer.effectAllowed = 'copy'; };
    });
  }

  /* ================= MENU RADIAL (2D e 3D) ================= */
  var RADIAL = [
    {k:'rot',  t:'Girar 90° (⇧ R)',  i:'<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v4h-4"/>'},
    {k:'esp',  t:'Espelhar',         i:'<path d="M12 3v18"/><path d="M8 7 4 12l4 5"/><path d="m16 7 4 5-4 5"/>'},
    {k:'dup',  t:'Duplicar (Ctrl D)',i:'<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M15 9V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4"/>'},
    {k:'up',   t:'Elevar 10 cm',     i:'<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>'},
    {k:'del',  t:'Excluir (Del)',    i:'<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/>'}
  ];
  function radial(mv, pos){
    var r = $('#radial'); if (!r) return;
    if (!mv) { r.hidden = true; return; }
    pos = pos || (viewAtual === 'tresd' && t3 ? t3.telaDeMovel(mv.id) : PLAN.telaDe(mv));
    if (!pos) { r.hidden = true; return; }
    var wrap = canvasWrap.getBoundingClientRect();
    var cx = pos.x - wrap.left, cy = pos.y - wrap.top, R = Math.max(pos.rx, pos.ry) + 30;
    R = Math.min(R, 120);
    if (r.getAttribute('data-id') !== mv.id) {
      var h = '';
      RADIAL.forEach(function (b, i) {
        var a = (-160 + i * 35) * Math.PI / 180;
        h += '<button data-rk="' + b.k + '" title="' + b.t + '" style="--dx:' + Math.cos(a).toFixed(3) + ';--dy:' + Math.sin(a).toFixed(3) + '"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + b.i + '</svg></button>';
      });
      r.innerHTML = h; r.setAttribute('data-id', mv.id);
      r.querySelectorAll('[data-rk]').forEach(function (b) {
        b.onclick = function (e) {
          e.stopPropagation();
          var k = b.getAttribute('data-rk');
          if (k === 'up') { mv.elev = (mv.elev || 0) + 10; M.commit('Elevar móvel'); selecionarMovel(mv.id); return; }
          acaoMovel(k, mv.id);
        };
      });
    }
    r.style.setProperty('--r', R + 'px');
    r.style.left = cx + 'px'; r.style.top = cy + 'px';
    r.hidden = false;
  }

  /* ================= OPERAÇÕES ================= */
  function addDaLib(i){
    var l = M.LIB[i]; if (!l) return;
    var t = M.proj.terreno;
    var a = {id:M.uid(), nome:l.nome, tipo:l.tipo, w:l.w, h:l.h,
             x:Math.round((t.largura - l.w) / 2), y:Math.round(t.recuoFrontal + 20)};
    if (M.pav > 0) a.pav = M.pav;
    /* empurra para baixo até não sobrepor ninguém do mesmo andar */
    var tent = 0;
    while (tent++ < 200 && M.ambsPav(M.pav).some(function (o) {
      return a.x < o.x + o.w && o.x < a.x + a.w && a.y < o.y + o.h && o.y < a.y + a.h;
    })) a.y += 25;
    M.proj.ambientes.push(a);
    M.commit('Adicionar ' + l.nome);
    irPara('planta'); PLAN.selecionar(a.id);
    toast('“' + l.nome + '” adicionado.');
  }
  function addRoomDefault(){ addDaLib(0); }
  function duplicar(id){
    var a = M.proj.ambientes.filter(function (x) { return x.id === id; })[0]; if (!a) return;
    var n = JSON.parse(JSON.stringify(a));
    n.id = M.uid(); n.x += 25; n.y += 25;
    M.proj.ambientes.push(n);
    M.commit('Duplicar ambiente');
    PLAN.selecionar(n.id); PLAN.render();
  }
  function excluir(id){
    var a = M.proj.ambientes.filter(function (x) { return x.id === id; })[0]; if (!a) return;
    M.proj.ambientes = M.proj.ambientes.filter(function (x) { return x.id !== id; });
    M.commit('Excluir ' + a.nome);
    PLAN.selecionar(null); PLAN.render(); inspector();
    toast('“' + a.nome + '” excluído.', function () { fazerUndo(); });
  }

  /* ================= EDIÇÃO NO LUGAR ================= */
  function editarCota(key, cx, cy){
    var parte = key.split(':'), tipo = parte[0], id = parte[1];
    var val, aplicar;
    var t = M.proj.terreno;
    if (tipo === 'terreno-larg') { val = t.largura; aplicar = function (n) { t.largura = n; M.commit('Mudar largura do terreno'); PLAN.enquadrar(); }; }
    else if (tipo === 'terreno-prof') { val = t.profundidade; aplicar = function (n) { t.profundidade = n; M.commit('Mudar profundidade do terreno'); PLAN.enquadrar(); }; }
    else {
      var a = M.proj.ambientes.filter(function (x) { return x.id === id; })[0]; if (!a) return;
      if (tipo === 'amb-w') { val = a.w; aplicar = function (n) { a.w = Math.max(90, n); M.commit('Mudar largura'); }; }
      else { val = a.h; aplicar = function (n) { a.h = Math.max(90, n); M.commit('Mudar profundidade'); }; }
    }
    caixaInline(cx, cy, M.fmtMs(val), 'm', function (txt) {
      var n = M.parseM(txt); if (!n) return;
      aplicar(n); PLAN.render(); inspector(); refreshTop();
    });
  }
  function renomearInline(id, cx, cy){
    var a = M.proj.ambientes.filter(function (x) { return x.id === id; })[0]; if (!a) return;
    caixaInline(cx, cy, a.nome, '', function (txt) {
      a.nome = txt.trim() || a.nome; M.commit('Renomear ambiente'); PLAN.render(); inspector();
    }, true);
  }
  function caixaInline(cx, cy, valor, un, ok, wide){
    var old = document.querySelector('.inline-edit'); if (old) old.remove();
    var box = document.createElement('div');
    box.className = 'inline-edit' + (wide ? ' wide' : '');
    box.style.left = (cx - (wide ? 90 : 55)) + 'px';
    box.style.top = (cy - 15) + 'px';
    box.innerHTML = '<input value="' + esc(valor) + '">' + (un ? '<span class="un">' + un + '</span>' : '');
    document.body.appendChild(box);
    var inp = box.querySelector('input');
    inp.focus(); inp.select();
    function fim(salvar){
      if (salvar) ok(inp.value);
      box.remove();
    }
    inp.onkeydown = function (e) {
      if (e.key === 'Enter') { e.preventDefault(); fim(true); }
      if (e.key === 'Escape') { e.preventDefault(); fim(false); }
      e.stopPropagation();
    };
    inp.onblur = function () { fim(true); };
  }

  /* ================= DESFAZER ================= */
  function fazerUndo(){
    var n = M.undo();
    if (!n) { toast('Nada para desfazer.'); return; }
    PLAN.selecionar(null); PLAN.render(); inspector(); refreshTop(); radial(null);
    if (viewAtual !== 'planta') irPara(viewAtual);
    toast('Desfeito: ' + n.toLowerCase());
  }
  function fazerRedo(){
    var n = M.redo();
    if (!n) { toast('Nada para refazer.'); return; }
    PLAN.render(); inspector(); refreshTop();
    if (viewAtual !== 'planta') irPara(viewAtual);
    toast('Refeito: ' + n.toLowerCase());
  }
  function refreshTop(){
    var u = $('#btn-undo'), r = $('#btn-redo');
    if (!u) return;
    u.disabled = !M.podeUndo(); r.disabled = !M.podeRedo();
    u.title = M.podeUndo() ? 'Desfazer: ' + M.proxUndo() + ' (Ctrl+Z)' : 'Desfazer (Ctrl+Z)';
    if (viewAtual === 'planta') $('#empty').hidden = M.proj.ambientes.length > 0;
  }

  /* ================= ATALHOS + COMMAND PALETTE ================= */
  var COMANDOS = [
    {n:'Planta',              g:'P',      f:function(){ irPara('planta'); }},
    {n:'Ambientes',           g:'A',      f:function(){ irPara('ambientes'); }},
    {n:'3D e fachada',        g:'3',      f:function(){ irPara('tresd'); }},
    {n:'Passeio 3D pela casa', g:'',       f:function(){ irPara('tresd'); if (t3) t3.setModo('tour'); }},
    {n:'Exportar passeio 3D (.html)', g:'', f:function(){ exportar('html'); }},
    {n:'Mobiliar (catálogo de móveis)', g:'M', f:function(){ if (viewAtual !== 'planta' && viewAtual !== 'tresd') irPara('planta'); toggleCatalogo(true); }},
    {n:'Mobiliar automaticamente', g:'', f:function(){ M.mobiliarAuto(); M.commit('Mobiliar automaticamente'); if (viewAtual === 'planta') PLAN.render(); inspector(); toast(M.proj.moveis.length + ' móveis colocados.'); }},
    {n:'Ver em 2D (planta)',   g:'2',      f:function(){ irPara('planta'); }},
    {n:'Fachada (painel de design no 3D)', g:'F', f:function(){ irPara('fachada'); }},
    {n:'Fachada à noite',     g:'',       f:function(){ irPara('fachada'); if (t3) t3.setNoite(true); }},
    {n:'Criar fachada por prompt', g:'',  f:function(){ irPara('fachada'); setTimeout(function(){ var p = document.querySelector('#fach-prompt'); if (p) p.focus(); }, 60); }},
    {n:'Copiar planta de uma foto', g:'', f:function(){ irPara('planta'); $('#foto-in').click(); }},
    {n:'Copiar fachada de uma foto', g:'', f:function(){ irPara('fachada'); setTimeout(function(){ var i = document.querySelector('#fach-foto-in'); if (i) i.click(); }, 60); }},
    {n:'Chave do Gemini (copiar de fotos)', g:'', f:function(){ pedirChave(null, ''); }},
    {n:'Ver a casa nos 4 estilos de fachada', g:'', f:function(){ irPara('fachada'); setTimeout(compararEstilos, 60); }},
    {n:'Corte',               g:'',       f:function(){ irPara('corte'); }},
    {n:'Piscina (raias, profundidade, praias)', g:'', f:function(){ irPara('piscina'); }},
    {n:'Camadas',             g:'',       f:function(){ irPara('camadas'); }},
    {n:'Cotas',               g:'',       f:function(){ irPara('cotas'); }},
    {n:'Relatório técnico',   g:'',       f:function(){ irPara('relatorio'); }},
    {n:'Renders',             g:'',       f:function(){ irPara('renders'); }},
    {n:'Salvar versão do estudo', g:'',   f:function(){ var v2 = M.salvarVersao(''); toast('Versão “' + v2.nome + '” guardada.'); }},
    {n:'Exportar orçamento em CSV', g:'', f:function(){ exportar('csv'); }},
    {n:'Orçamento',           g:'O',      f:function(){ irPara('orcamento'); }},
    {n:'Simulador',           g:'S',      f:function(){ irPara('simulador'); }},
    {n:'Exportar',            g:'',       f:function(){ irPara('exportar'); }},
    {n:'Apresentar ao cliente', g:'',     f:function(){ abrirApres(); }},
    {n:'Desfazer',            g:'Ctrl Z', f:function(){ fazerUndo(); }},
    {n:'Refazer',             g:'Ctrl ⇧Z',f:function(){ fazerRedo(); }},
    {n:'Enquadrar projeto',   g:'Ctrl 0', f:function(){ irPara('planta'); PLAN.enquadrar(); PLAN.render(); }},
    {n:'Duplicar selecionado',g:'Ctrl D', f:function(){ if (PLAN.sel) duplicar(PLAN.sel); }},
    {n:'Excluir selecionado', g:'Del',    f:function(){ if (PLAN.sel) excluir(PLAN.sel); }},
    {n:'Meus projetos',       g:'Esc',    f:function(){ voltarHome(); }},
    {n:'Atalhos do teclado',  g:'?',      f:function(){ abrirAjuda(); }}
  ];
  function comandos(){
    var c = COMANDOS.slice();
    M.LIB.forEach(function (l, i) { c.push({n:'Adicionar ' + l.nome, g:'ambiente', f:function(){ addDaLib(i); }}); });
    M.proj.ambientes.forEach(function (a) {
      c.push({n:'Ir para ' + a.nome, g:M.fmtM2(M.areaOf(a)), f:function(){ irPara('planta'); PLAN.selecionar(a.id); }});
    });
    return c;
  }
  var cmdIdx = 0, cmdFiltrados = [];
  function abrirCmdk(){
    $('#cmdk').hidden = false;
    var i = $('#cmdk-input'); i.value = ''; i.focus();
    filtrarCmd('');
    i.oninput = function () { filtrarCmd(this.value); };
  }
  function filtrarCmd(q){
    var t = q.toLowerCase().trim();
    cmdFiltrados = comandos().filter(function (c) { return !t || c.n.toLowerCase().indexOf(t) >= 0; }).slice(0, 40);
    cmdIdx = 0; pintarCmd();
  }
  function pintarCmd(){
    var l = $('#cmdk-list');
    if (!cmdFiltrados.length) { l.innerHTML = '<div class="none">Nada encontrado.</div>'; return; }
    l.innerHTML = cmdFiltrados.map(function (c, i) {
      return '<div class="it' + (i === cmdIdx ? ' on' : '') + '" data-i="' + i + '">' + esc(c.n) + '<span class="g">' + esc(c.g) + '</span></div>';
    }).join('');
    l.querySelectorAll('.it').forEach(function (el) {
      el.onclick = function () { execCmd(parseInt(el.getAttribute('data-i'), 10)); };
    });
  }
  function execCmd(i){
    var c = cmdFiltrados[i]; closeOverlays();
    if (c) setTimeout(c.f, 10);
  }
  function abrirAjuda(){
    var pares = [
      ['V','Selecionar'], ['R','Novo ambiente'], ['Espaço','Mover a tela'], ['G','Grade'],
      ['C','Cotas'], ['P','Planta'], ['A','Ambientes'], ['3','3D'], ['O','Orçamento'], ['S','Simulador'],
      ['Ctrl+Z','Desfazer'], ['Ctrl+Shift+Z','Refazer'], ['Ctrl+D','Duplicar'], ['Delete','Excluir'], ['Arrastar no vazio','Laço: seleciona tudo que ficar dentro'], ['⇧ clique','Adiciona ao grupo'], ['Ctrl+A','Seleciona o andar inteiro'],
      ['Ctrl+0','Enquadrar'], ['Ctrl+K','Buscar / executar'], ['Alt (segurar)','Desligar o ímã'],
      ['Shift (segurar)','Travar no eixo'], ['Duplo clique','Renomear ambiente'], ['Clique na cota','Editar a medida']
    ];
    $('#keys').innerHTML = pares.map(function (p) { return '<div><span>' + p[1] + '</span><kbd>' + p[0] + '</kbd></div>'; }).join('');
    $('#ajuda').hidden = false;
  }
  function closeOverlays(){
    var vo = document.getElementById('visao'); if (vo) vo.hidden = true; $('#cmdk').hidden = true; $('#ajuda').hidden = true; $('#estilos').hidden = true; }

  function ligarAtalhos(){
    document.addEventListener('keydown', function (e) {
      var emCampo = /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); abrirCmdk(); return; }
      if (!$('#cmdk').hidden) {
        if (e.key === 'ArrowDown') { e.preventDefault(); cmdIdx = Math.min(cmdIdx + 1, cmdFiltrados.length - 1); pintarCmd(); }
        if (e.key === 'ArrowUp')   { e.preventDefault(); cmdIdx = Math.max(cmdIdx - 1, 0); pintarCmd(); }
        if (e.key === 'Enter')     { e.preventDefault(); execCmd(cmdIdx); }
        if (e.key === 'Escape')    { closeOverlays(); }
        return;
      }
      if (e.key === 'Escape') {
        var fp0 = document.getElementById('fpop'), cx0 = document.getElementById('ctx');
        if ((fp0 && !fp0.hidden) || (cx0 && !cx0.hidden)) { fecharPop(); return; }
        if (!$('#apres').hidden) { fecharApres(); return; }
        if (!$('#ajuda').hidden) { closeOverlays(); return; }
        if (PLAN.multi.length) { PLAN.setMulti([]); return; }
        if (PLAN.sel) { PLAN.selecionar(null); return; }
        if (!$('#app').hidden) voltarHome();
        return;
      }
      if (emCampo) return;
      if (!M.proj || $('#app').hidden) return;

      shift = e.shiftKey; alt = e.altKey;
      if (e.key === ' ') { espaco = true; e.preventDefault(); }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? fazerRedo() : fazerUndo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); if (PLAN.multi.length > 1) acaoGrupo('dup'); else if (PLAN.movAtual()) acaoMovel('dup', PLAN.sel); else if (PLAN.sel) duplicar(PLAN.sel); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a' && viewAtual === 'planta') {   /* Ctrl+A: seleciona tudo do andar */
        e.preventDefault(); var tudo = M.ambsPav(M.pav).map(function (a) { return {t:'amb', id:a.id}; }); if (tudo.length > 1) { PLAN.setMulti(tudo); toast(tudo.length + ' ambientes selecionados (os móveis vão junto).'); } return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '0') { e.preventDefault(); irPara('planta'); PLAN.enquadrar(); PLAN.render(); return; }
      if (e.ctrlKey || e.metaKey) return;

      var k = e.key.toLowerCase();
      if (k === 'delete' || k === 'backspace') { if (PLAN.multi.length > 1) { e.preventDefault(); acaoGrupo('del'); } else if (PLAN.movAtual()) { e.preventDefault(); acaoMovel('del', PLAN.sel); } else if (PLAN.sel) { e.preventDefault(); excluir(PLAN.sel); } return; }
      if (k === 'm') { if (viewAtual === 'planta' || viewAtual === 'tresd') toggleCatalogo(); return; }
      if (k === '2') { irPara('planta'); return; }
      if (k === 'r' && e.shiftKey && PLAN.movAtual()) { acaoMovel('rot', PLAN.sel); return; }
      if (k === 'escape') { if (PLAN.movAtual()) { selecionarMovel(null); return; } }
      if (k === '?') { abrirAjuda(); return; }
      if (k === '[') { document.getElementById('app').classList.toggle('side-off'); PLAN.render(); return; }
      if (k === 'v') setTool('sel');
      if (k === 'r') setTool('room');
      if (k === 'g') $('#btn-grid').click();
      if (k === 'c') $('#btn-cotas').click();
      if (k === 'p') irPara('planta');
      if (k === 'a') irPara('ambientes');
      if (k === '3') irPara('tresd');
      if (k === 'f') { if (viewAtual === 'tresd') { var ftg = document.querySelector('#fach-tg'); if (ftg) ftg.click(); } else irPara('fachada'); }
      if (k === 'o') irPara('orcamento');
      if (k === 's') irPara('simulador');
      /* setas movem o selecionado (ou o grupo) */
      if (k.indexOf('arrow') === 0 && PLAN.multi.length > 1) {
        e.preventDefault();
        var pg = e.shiftKey ? 50 : 5, gdx = k === 'arrowleft' ? -pg : k === 'arrowright' ? pg : 0, gdy = k === 'arrowup' ? -pg : k === 'arrowdown' ? pg : 0;
        PLAN.moverGrupo(PLAN.itensGrupo(), gdx, gdy); M.commit('Mover grupo'); PLAN.render(); inspector(); return;
      }
      if (k.indexOf('arrow') === 0 && PLAN.movAtual()) {
        e.preventDefault();
        var mv = PLAN.movAtual(), pm = e.shiftKey ? 50 : 5;
        if (k === 'arrowleft') mv.x -= pm; if (k === 'arrowright') mv.x += pm;
        if (k === 'arrowup') mv.y -= pm;   if (k === 'arrowdown') mv.y += pm;
        M.commit('Mover móvel'); selecionarMovel(mv.id); if (viewAtual === 'planta') PLAN.render(); return;
      }
      if (k.indexOf('arrow') === 0 && PLAN.sel) {
        e.preventDefault();
        var a = PLAN.atual(), passo = e.shiftKey ? 50 : 5;
        if (k === 'arrowleft') a.x -= passo; if (k === 'arrowright') a.x += passo;
        if (k === 'arrowup') a.y -= passo;   if (k === 'arrowdown') a.y += passo;
        M.commit('Mover ambiente'); PLAN.render(); inspector();
      }
    });
    document.addEventListener('keyup', function (e) {
      shift = e.shiftKey; alt = e.altKey;
      if (e.key === ' ') espaco = false;
    });
    window.addEventListener('blur', function () { shift = alt = espaco = false; });
  }
  function setTool(t){
    PLAN.setTool(t);
    document.querySelectorAll('#tools [data-tool]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tool') === t); });
    if (stage) stage.style.cursor = t === 'pan' ? 'grab' : (t === 'room' ? 'crosshair' : 'default');
  }

  /* ================= 3D ================= */
  var DICAS = {orbit:'Arraste para girar · roda para aproximar · duplo clique num ambiente para entrar',
               walk:'W A S D ou setas para andar · arraste para olhar · Shift corre',
               tour:'← → ou roda do mouse para trocar de ambiente · arraste para olhar em volta'};
  function ligar3D(pad){
    pad.classList.add('pad-3d');
    var st = pad.querySelector('#t3-stage'), sel = pad.querySelector('#t3-amb'), nav = pad.querySelector('#t3-nav'), dica = pad.querySelector('#t3-dica');
    function modos(m){
      pad.querySelectorAll('#t3-modos button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-modo') === m); });
      nav.hidden = m !== 'tour'; dica.textContent = DICAS[m] || '';
    }
    t3 = TRES.montar(st, {modo:'orbit', on:{
      fachadaClique: popFachada, fachadaHover: dicaFachada,
      abMove: abMove3d, abFim: abFim3d, abCancel: abCancel3d, letreiroMove: letreiroMove3d, letreiroFim: letreiroFim3d, letreiroCancel: letreiroCancel3d,
      noite: function (n) { pad.querySelectorAll('#fach-hora button').forEach(function (b) { b.classList.toggle('on', (b.getAttribute('data-hora') === 'noite') === n); }); },
      modo: modos,
      paradas: function (ps) {
        sel.innerHTML = '<option value="">Ir para…</option><option value="fachada">🏠 Frente da casa</option><option value="entrada">🚪 Entrada (perto)</option><option disabled>── ambientes ──</option>' + ps.map(function (p, i) { return '<option value="' + i + '">' + esc(p.titulo) + '</option>'; }).join('');
      },
      parada: function (i) { sel.value = String(i); },
      clique: function (id) { PLAN.selecionar(id); inspector(); },
      selMov: function (id, pos) { PLAN.selecionarMovel(id); if (id) radial(M.movelDe(id), pos); else radial(null); },
      selPos: function (id, pos) { var r = $('#radial'); if (!r.hidden || PLAN.sel === id) radial(M.movelDe(id), pos); },
      movMove: function (mv) { $('#radial').hidden = true; inspector(); },
      movFim: function (mv) { var a = M.ambienteDe(mv); mv.amb = a ? a.id : undefined; M.commit('Mover móvel'); inspector(); radial(mv); },
      etapa: function (n) { var rg2 = pad.querySelector('#t3-etapa'), rv2 = pad.querySelector('#t3-etapa-v'); if (rg2) { rg2.value = n; rv2.textContent = TRES.ETAPAS[n]; } }
    }});
    if (!t3) return;
    pad.querySelector('#t3-mob').onclick = function () { toggleCatalogo(); };
    if (!$('#catalogo').hidden) pad.querySelector('#t3-mob').classList.add('on');
    if (PLAN.movAtual()) t3.selecionarMovel(PLAN.sel);
    pad.querySelectorAll('#t3-modos button').forEach(function (b) { b.onclick = function () { t3.setModo(b.getAttribute('data-modo')); }; });
    pad.querySelector('#t3-teto').onclick = function () { t3.setTeto(!t3.teto); this.classList.toggle('on', t3.teto); };
    var rg = pad.querySelector('#t3-etapa'), rv = pad.querySelector('#t3-etapa-v');
    rg.oninput = function () { t3.setEtapa(+this.value); rv.textContent = TRES.ETAPAS[+this.value]; };
    rv.textContent = TRES.ETAPAS[t3.etapa]; rg.value = t3.etapa;
    sel.onchange = function () { if (this.value === 'fachada') t3.verFachada(); else if (this.value === 'entrada') t3.verFachada(false, .5); else if (this.value !== '') t3.irParada(+this.value); this.value = ''; };
    pad.querySelector('#t3-ant').onclick = function () { t3.anterior(); };
    pad.querySelector('#t3-prox').onclick = function () { t3.proxima(); };
    pad.querySelector('#t3-auto').onclick = function () { t3.setAuto(!t3.auto); this.textContent = t3.auto ? '❚❚' : '▶'; };
    pad.querySelector('#t3-render').onclick = function () { guardarRender(t3.foto(), t3.modo === 'tour' ? 'Passeio' : (t3.noite ? 'Fachada à noite' : 'Vista 3D')); };
    /* ---- fachada, na mesma tela ---- */
    pad.querySelectorAll('#fach-hora button').forEach(function (b) { b.onclick = function () { t3.setNoite(b.getAttribute('data-hora') === 'noite'); }; });
    function elevacao(){ var e = pad.querySelector('#fach-elev-pad'); e.hidden = !e.hidden; if (!e.hidden) e.innerHTML = VIEWS.fachada(); }
    pad.querySelector('#t3-mais').onclick = function (ev) {   /* ⋯ = o que não precisa estar sempre à vista */
      ev.stopPropagation();
      var c = document.getElementById('ctx'); if (!c) { c = document.createElement('div'); c.id = 'ctx'; c.className = 'ctx'; document.body.appendChild(c); }
      var elev = !pad.querySelector('#fach-elev-pad').hidden;
      c.innerHTML = '<div class="ctx-hd">3D e fachada</div>' +
        '<button class="ctx-it" data-m="elev">' + (elev ? '✓ ' : '') + 'Elevação frontal (desenho técnico)</button>' +
        '<button class="ctx-it" data-m="estilos">✨ Ver a casa nos ' + Object.keys(TRES.FACHADA_PRESETS).length + ' estilos</button>' +
        '<button class="ctx-it" data-m="frente">🏠 Câmera na frente da casa</button>' +
        '<button class="ctx-it" data-m="foto">📷 Salvar imagem (PNG)</button>' +
        '<button class="ctx-it" data-m="apres">▶ Apresentar ao cliente</button>';
      var r = this.getBoundingClientRect(); c.style.left = Math.max(8, Math.min(window.innerWidth - 268, r.right - 260)) + 'px'; c.style.top = (r.bottom + 6) + 'px'; c.hidden = false;
      c.querySelectorAll('[data-m]').forEach(function (b) { b.onclick = function () {
        var m = b.getAttribute('data-m'); c.hidden = true;
        if (m === 'elev') elevacao(); else if (m === 'estilos') compararEstilos(); else if (m === 'frente') t3.verFachada();
        else if (m === 'foto') { var a = document.createElement('a'); a.href = t3.foto(); a.download = slug() + '-3d.png'; a.click(); toast('Imagem salva.'); }
        else if (m === 'apres') { var ap = document.getElementById('btn-apresentar'); if (ap) ap.click(); }
      }; });
    };
    function painel(abrir){
      painelFachada = abrir === undefined ? !painelFachada : !!abrir;
      pad.classList.toggle('panel-on', painelFachada); pad.querySelector('#fach-tg').classList.toggle('on', painelFachada); $('#app').classList.toggle('fach-on', painelFachada);   /* painel aberto esconde o inspector: o 3D fica largo */
      if (painelFachada) fachPanel(pad);
      try { localStorage.setItem('so3d-painel-fachada', painelFachada ? '1' : '0'); } catch (e) {}
    }
    pad.querySelector('#fach-tg').onclick = function () { painel(); };
    pad.querySelector('#fach-close').onclick = function () { painel(false); };
    var lembrado = null; try { lembrado = localStorage.getItem('so3d-painel-fachada'); } catch (e) {}
    painel(abrirFachada || (lembrado === null ? window.innerWidth > 900 : lembrado === '1'));
    if (abrirFachada) { t3.verFachada(true); dica.textContent = 'Clique numa janela, porta, parede, telhado, muro ou portão para trocar · arraste a janela ou o letreiro para mover'; }
    abrirFachada = false;
  }
  var painelFachada = false;

  /* ================= FACHADA (designer) ================= */
  var CORES_PAREDE = ['#F2EFE8', '#F6F1E4', '#D9D9D4', '#EFE3CF', '#C9D3D9', '#B9C4B0', '#F0D9C2', '#8E9BA6', '#E8D7B5', '#D6C7B0', '#A9B7A2', '#9FB4C4', '#DCC5C0', '#6B7885', '#3D4A56', '#2B2F33'];
  var CORES_DEST = ['#2B2F33', '#8B5E3C', '#1F2326', '#B7B0A3', '#2F5D8A', '#6B7885', '#C4553B', '#1E7E96', '#4E9A5D', '#D9722B', '#E0B44C', '#6B4E9E', '#C9A227', '#F4F4F1', '#D96AA0', '#22B8D6'];
  var CORES_ESQ = ['#2B2F33', '#F4F4F1', '#7A5230', '#5B6169', '#8C6A3F', '#1E7E96', '#2F5D8A', '#C4553B'];
  var CORES_PORTA = ['#7A5230', '#2B2F33', '#F4F4F1', '#C4553B', '#2F5D8A', '#4E9A5D', '#E0B44C', '#1E7E96', '#6B4E9E', '#D96AA0'];
  var CORES_MURO = ['#DDD8CC', '#F2EFE8', '#D9D9D4', '#B7B0A3', '#8B5E3C', '#6B7885', '#2B2F33', '#4E9A5D'];
  var ROT = {cobertura:{platibanda:'Platibanda', telhado2:'2 águas', telhado4:'4 águas'}, telha:{ceramica:'Cerâmica', concreto:'Concreto', metalica:'Metálica'},
    revestimento:{nenhum:'Nenhum', ripado:'Ripado', pedra:'Pedra', tijolo:'Tijolinho', cimento:'Cimento'}, esquadria:{preto:'Preto', branco:'Branco', madeira:'Madeira'},
    portao:{grade:'Grade', ripado:'Ripado', chapa:'Chapa'}, muro:{baixo:'Baixo', alto:'Alto', vidro:'Vidro'}};
  function fachPanel(pad){
    pad = pad || canvasWrap.querySelector('.view-pad'); if (!pad) return;
    var el = pad.querySelector('#fach-panel'); if (!el || !pad.classList.contains('panel-on')) return;   /* painel fechado: monta quando abrir */
    var scrollAntes = el.scrollTop;
    var F = TRES.fachadaDe(M.proj), h = '';
    function chips(k, mapa){ return '<div class="chips">' + Object.keys(mapa).map(function (v) { return '<button class="chip' + (F[k] === v ? ' on' : '') + '" data-fk="' + k + '" data-fv="' + v + '">' + mapa[v] + '</button>'; }).join('') + '</div>'; }
    function cores(k, lista){ return '<div class="swatches">' + lista.map(function (c) { return '<button class="sw-btn' + (F[k].toUpperCase() === c ? ' on' : '') + '" data-fk="' + k + '" data-fv="' + c + '" style="background:' + c + '" title="' + c + '"></button>'; }).join('') + '</div>'; }
    function tg(k, rot){ return '<button class="chip' + (F[k] ? ' on' : '') + '" data-fk="' + k + '" data-fv="' + (F[k] ? '0' : '1') + '">' + rot + '</button>'; }
    /* criar por prompt: descreve em português, o app entende as escolhas */
    h += '<section class="fach-prompt"><h6>CRIAR POR PROMPT</h6><div class="inp"><textarea id="fach-prompt" rows="2" placeholder="ex.: loja moderna com vitrine, ripado, letreiro &quot;Acqua Belo&quot; em LED azul, totem, número 128"></textarea></div>' +
      '<div class="fach-prompt-acts"><button class="btn solid sm" id="fach-prompt-ok">✨ Criar fachada</button><label class="btn sm" for="fach-foto-in" title="Mande a foto de uma casa ou loja: o app copia telhado, cores, revestimento, janelas, porta, muro e portão">📷 Copiar de uma foto</label><input id="fach-foto-in" type="file" accept="image/*" hidden><span id="fach-prompt-msg"></span></div></section>';
    h += '<section><h6>ESTILO</h6><div class="estilos">';
    Object.keys(TRES.FACHADA_PRESETS).forEach(function (k) {
      var pr = TRES.FACHADA_PRESETS[k], telha = pr.cobertura === 'platibanda' ? pr.corParede : (pr.telha === 'ceramica' ? '#B5533A' : '#6F6E6B');
      h += '<button class="estilo' + (F.estilo === k ? ' on' : '') + '" data-fk="estilo" data-fv="' + k + '"><span class="dots"><i style="background:' + pr.corParede + '"></i><i style="background:' + pr.corDestaque + '"></i><i style="background:' + telha + '"></i></span><b>' + pr.rot + '</b><small>' + pr.desc + '</small></button>';
    });
    h += '</div></section>';
    h += '<section><h6>COBERTURA</h6>' + chips('cobertura', TRES.COBERTURAS) + coberturaExtra(F, chips, function (k, lista) { return corLivre(k, lista, F[k]); }) + '</section>';
    h += '<section><h6>COR DA PAREDE</h6>' + corLivre('corParede', CORES_PAREDE, F.corParede) + '<h6 style="margin-top:10px">COR DE DESTAQUE</h6>' + corLivre('corDestaque', CORES_DEST, F.corDestaque) + '</section>';
    h += '<section><h6>REVESTIMENTO DA FRENTE</h6>' + chips('revestimento', ROT.revestimento) + '</section>';
    /* cor livre: paleta + seletor de qualquer cor (o chip "Outra" abre o seletor nativo) */
    function corLivre(k, lista, atual){
      var custom = atual && lista.indexOf(String(atual).toUpperCase()) < 0;
      return '<div class="swatches">' + lista.map(function (c) { return '<button class="sw-btn' + (String(atual || '').toUpperCase() === c ? ' on' : '') + '" data-fk="' + k + '" data-fv="' + c + '" style="background:' + c + '" title="' + c + '"></button>'; }).join('') +
        '<label class="sw-btn sw-custom' + (custom ? ' on' : '') + '" title="Qualquer cor" style="background:' + (custom ? atual : 'conic-gradient(#E4574F,#F2C14E,#4E9A5D,#22B8D6,#6B4E9E,#E4574F)') + '"><input type="color" data-fc="' + k + '" value="' + (atual || '#888888') + '"></label></div>';
    }
    h += '<section><h6>ESQUADRIAS</h6>' + chips('esquadria', ROT.esquadria) + '<h6 style="margin-top:10px">COR DA ESQUADRIA</h6>' + corLivre('esquadriaCor', CORES_ESQ, F.esquadriaCor) + '</section>';
    h += '<section><h6>JANELAS</h6>' + chips('janela', TRES.JANELAS) + '<h6 style="margin-top:10px">VIDRO</h6>' + chips('vidro', TRES.VIDROS) +
      '<div class="chips" style="margin-top:10px">' + tg('moldura', 'Moldura de destaque') + tg('gradeJanela', 'Grade de proteção') + tg('brise', 'Brise na frente') + '</div></section>';
    h += '<section><h6>PORTA DE ENTRADA · CASA</h6>' + chips('porta', TRES.PORTAS) + '<h6 style="margin-top:10px">PORTA DE ENTRADA · LOJA</h6>' + chips('porta', TRES.PORTAS_LOJA) +
      '<div class="f-row" style="margin-top:10px">' + campo('fach-pl', 'LARGURA DA PORTA', F.portaLargura ? M.fmtMs(F.portaLargura * 100) : '', 'm') + campo('fach-pa', 'ALTURA', F.portaAltura ? M.fmtMs(F.portaAltura * 100) : '', 'm') + '</div>' +
      '<div class="ins-empty" style="margin-top:-2px">Vazio = 0,90 × 2,10. Loja costuma ter 2,00 a 4,00 m.' + (function () { try { var an = TRES.analise(M.proj); if (an.entrada) { var L = an.entrada.pc.len, r = an.entrada.r; return ' A entrada está na parede de <b>' + esc(r.nome) + '</b> (' + M.fmtMs(L) + ' m) → porta de até <b>' + M.fmtMs(L - 40) + ' m</b>; para mais, alargue esse ambiente na planta.'; } } catch (e) {} return ''; })() + '</div>' +
      '<h6 style="margin-top:10px">COR DA PORTA</h6>' + corLivre('portaCor', CORES_PORTA, F.portaCor) +
      '<div class="chips" style="margin-top:10px">' + tg('arandelas', 'Arandelas') + tg('vasos', 'Vasos') + '</div>' +
      '<h6 style="margin-top:10px">PISO DA FRENTE</h6>' + chips('pisoFrente', TRES.PISOS_FRENTE) + '</section>';
    h += '<section><h6>PORTÃO DO MURO</h6>' + chips('portao', ROT.portao) + '<h6 style="margin-top:10px">COR DO PORTÃO</h6>' + corLivre('portaoCor', CORES_PORTA, F.portaoCor) +
      '<h6 style="margin-top:10px">PORTA DA GARAGEM</h6>' + chips('garagem', TRES.GARAGENS) +
      '<h6 style="margin-top:10px">MURO</h6>' + chips('muro', ROT.muro) + '<h6 style="margin-top:10px">COR DO MURO</h6>' + corLivre('muroCor', CORES_MURO, F.muroCor) + '</section>';
    h += '<section><h6>EXTRAS</h6><div class="chips">' + tg('jardim', 'Jardim') + tg('marquise', 'Marquise') + tg('pergolado', 'Pergolado') + tg('iluminacao', 'Iluminação') + tg('vitrine', 'Vitrine') + '</div>' +
      '<div class="f" style="margin-top:10px"><label>NÚMERO DA CASA</label><div class="inp"><input id="fach-num" value="' + esc(F.numero) + '" placeholder="ex.: 128" maxlength="5"></div></div></section>';
    /* letreiro comercial */
    h += '<section><h6>LETREIRO · NOME DO ESTABELECIMENTO</h6>' + logoBloco() +
      '<div class="f"><div class="inp"><input id="fach-let" value="' + esc(F.letreiro) + '" placeholder="ex.: ACQUA BELO" maxlength="40"></div></div>' +
      (F.letreiro || M.proj.logo ? '<div class="f" style="margin-top:8px"><label>SUBTÍTULO (2ª LINHA)</label><div class="inp"><input id="fach-sub" value="' + esc(F.letreiroSub) + '" placeholder="ex.: Escola de Natação" maxlength="50"></div></div>' +
      '<h6 style="margin-top:10px">TIPO</h6>' + chips('letreiroEstilo', {placa:'Placa', caixa:'Letra caixa', led:'LED', neon:'Neon', backlight:'Backlight'}) +
      '<h6 style="margin-top:10px">FORMATO</h6>' + chips('letreiroFormato', TRES.LETREIRO_FORMATOS) +
      '<h6 style="margin-top:10px">TAMANHO</h6><div class="chips">' + Object.keys(TRES.LETREIRO_TAMS).map(function (v) { return '<button class="chip' + (F.letreiroTam === v && !F.letreiroLargura ? ' on' : '') + '" data-fk="letreiroTam" data-fv="' + v + '">' + TRES.LETREIRO_TAMS[v] + '</button>'; }).join('') + '</div>' +
      '<h6 style="margin-top:10px">POSIÇÃO E MEDIDA</h6>' + letreiroPosHtml(F) +
      '<div class="ins-empty" style="margin-top:-2px">Vazio = automático pelo tamanho P/M/G/GG.</div>' +
      (M.proj.logo ? '<h6 style="margin-top:10px">ARTE NO LETREIRO</h6>' + logoAjusteHtml(F) : '') +
      '<h6 style="margin-top:10px">FONTE</h6>' + chips('letreiroFonte', TRES.LETREIRO_FONTES) +
      '<h6 style="margin-top:10px">COR DAS LETRAS</h6>' + corLivre('letreiroCor', ['#22B8D6', '#2F5D8A', '#C4553B', '#E0B44C', '#4E9A5D', '#D96AA0', '#F4F4F1', '#1F2326', '#D9722B', '#6B4E9E', '#C9A227', '#1E7E96'], F.letreiroCor) +
      (F.letreiroEstilo !== 'caixa' && F.letreiroEstilo !== 'neon' ? '<h6 style="margin-top:10px">COR DO FUNDO</h6>' + corLivre('letreiroFundoCor', ['#14171B', '#FFFFFF', '#F4F4F1', '#2F5D8A', '#C4553B', '#4E9A5D', '#E0B44C', '#1E7E96'], F.letreiroFundoCor) : '') +
      '<h6 style="margin-top:10px">ONDE</h6>' + chips('letreiroPos', TRES.LETREIRO_POS) +
      '<h6 style="margin-top:10px">PLACAS PUBLICITÁRIAS</h6><div class="chips">' + tg('bandeira', 'Bandeira lateral') + tg('placaMuro', 'Placa no muro') + tg('totem', 'Totem no portão') + tg('adesivo', 'Adesivo na vitrine') + '</div>' +
      '<div class="f" style="margin-top:8px"><label>FAIXA / BANNER (TEXTO)</label><div class="inp"><input id="fach-faixa" value="' + esc(F.faixa || '') + '" placeholder="ex.: PROMOÇÃO · INAUGURAÇÃO" maxlength="40"></div></div>' + (F.faixa ? '<h6 style="margin-top:8px">COR DA FAIXA</h6>' + corLivre('faixaCor', ['#E4574F', '#E0B44C', '#1E7E96', '#4E9A5D', '#2F5D8A', '#1F2326', '#D96AA0'], F.faixaCor) : '') +
      '<div class="chips" style="margin-top:10px">' + tg('letreiroLuz', 'Acende à noite') + '</div>' : '<div class="ins-empty">Digite o nome para a placa aparecer na frente.</div>') + '</section>';
    var abKeys = Object.keys(M.proj.aberturas || {});
    if (abKeys.length || M.proj.entradaEm) {
      h += '<section><h6>JANELAS E PORTAS DECIDIDAS NO 3D</h6><div class="ins-empty" style="line-height:1.8">' + abKeys.map(function (k) { var o = M.proj.aberturas[k], pt = k.split('|'), am = M.proj.ambientes.filter(function (a) { return a.id === pt[0]; })[0]; return '• ' + esc(am ? am.nome : '?') + ' · ' + pt[1] + ': ' + (o.tipo === 'nenhuma' ? 'sem janela' : o.tipo === 'porta' ? 'porta' : (o.n || 1) + ' janela(s)' + (o.w ? ' ' + M.fmtMs(o.w) + ' m' : '')) + ' <button class="chip sm" data-ab-clear="' + k + '">↺</button>'; }).join('<br>') +
        (M.proj.entradaEm ? '<br>★ Entrada principal em ' + esc((M.proj.ambientes.filter(function (a) { return a.id === M.proj.entradaEm.split('|')[0]; })[0] || {}).nome || '?') + ' <button class="chip sm" data-ab-clear="entrada">↺</button>' : '') + '</div></section>';
    }
    var itens = M.custoFachadaItens();
    h += '<section><h6>QUANTO ESSA FACHADA CUSTA</h6>' + (itens.length ? itens.map(function (it) { return kv(it.rot, M.fmtBRL(it.valor), ''); }).join('') : '<div class="ins-empty">Nada além da alvenaria.</div>') +
      '<div class="kv tot"><span>Fachada</span><b>' + M.fmtBRL(M.custoFachada()) + '</b></div>' +
      '<div class="kv derived" title="ambientes ' + M.fmtBRL(M.custoTotal()) + ' + fachada ' + M.fmtBRL(M.custoFachada()) + '"><span>Investimento total</span><b>' + M.fmtBRL(M.custoGeral()) + '</b></div></section>';
    /* atalhos no topo: pulam para a seção (o painel é longo) */
    var JUMP = [['PROMPT', 'CRIAR POR PROMPT'], ['Estilo', 'ESTILO'], ['Cobertura', 'COBERTURA'], ['Cores', 'COR DA PAREDE'], ['Janelas', 'JANELAS'], ['Porta', 'PORTA DE ENTRADA'], ['Muro', 'MURO'], ['Letreiro', 'LETREIRO'], ['Custo', 'QUANTO ESSA FACHADA']];
    el.innerHTML = '<button class="icon-btn fach-panel-close" id="fach-close" title="Fechar painel">' + icon('close') + '</button><nav class="fach-jump">' + JUMP.map(function (j) { return '<button data-jump="' + j[1] + '">' + j[0] + '</button>'; }).join('') + '</nav>' + h;
    el.scrollTop = scrollAntes;
    el.querySelector('#fach-close').onclick = function () { pad.classList.remove('panel-on'); $('#app').classList.remove('fach-on'); painelFachada = false; var tg2 = pad.querySelector('#fach-tg'); if (tg2) tg2.classList.remove('on'); try { localStorage.setItem('so3d-painel-fachada', '0'); } catch (e) {} };
    el.querySelectorAll('[data-jump]').forEach(function (b) { b.onclick = function () {
      var alvo = null, t = b.getAttribute('data-jump'); el.querySelectorAll('section h6').forEach(function (h6) { if (!alvo && h6.textContent.toUpperCase().indexOf(t) === 0) alvo = h6.closest('section'); });
      if (alvo) { el.scrollTo({top:alvo.offsetTop - 44, behavior:'smooth'}); alvo.classList.add('flash'); setTimeout(function () { alvo.classList.remove('flash'); }, 900); }
    }; });
    el.querySelectorAll('[data-fk]').forEach(function (b) {
      b.onclick = function () {
        var k = b.getAttribute('data-fk'), v = b.getAttribute('data-fv');
        if (FK_TOGGLES.indexOf(k) >= 0) v = v === '1';
        if (k === 'esquadria') { M.proj.fachada = M.proj.fachada || {}; M.proj.fachada.esquadriaCor = ''; }   /* chip de esquadria volta à cor padrão */
        if (k === 'letreiroTam') { M.proj.fachada = M.proj.fachada || {}; M.proj.fachada.letreiroLargura = 0; M.proj.fachada.letreiroAltura = 0; }   /* P/M/G/GG volta ao automático */
        setFachada(k, v);
      };
    });
    /* seletor nativo de cor (qualquer cor): aplica ao soltar */
    el.querySelectorAll('input[data-fc]').forEach(function (inp) {
      inp.onchange = function () { setFachada(inp.getAttribute('data-fc'), inp.value.toUpperCase()); };
      inp.onclick = function (e) { e.stopPropagation(); };
    });
    var fin = el.querySelector('#fach-foto-in');
    if (fin) fin.onchange = function () { if (this.files[0]) copiarDeFoto('fachada', this.files[0]); this.value = ''; };
    ligarLogo(el, null);
    el.querySelectorAll('[data-ab-clear]').forEach(function (b) { b.onclick = function () { var k = b.getAttribute('data-ab-clear'); if (k === 'entrada') delete M.proj.entradaEm; else M.limparAbertura(k); M.commit('Abertura automática'); fachPanel(); }; });
    var fx = el.querySelector('#fach-faixa');
    if (fx) { fx.onchange = function () { setFachada('faixa', this.value.trim().toUpperCase()); }; fx.onkeydown = function (e) { e.stopPropagation(); if (e.key === 'Enter') this.blur(); }; }
    var num = el.querySelector('#fach-num');
    num.onchange = function () { setFachada('numero', this.value.trim()); };
    num.onkeydown = function (e) { e.stopPropagation(); if (e.key === 'Enter') this.blur(); };
    /* medidas em metros (vazio = automático) */
    ligarAjustes(el, null);
    [['fach-pl', 'portaLargura', .7, 6], ['fach-pa', 'portaAltura', 2, 4]].forEach(function (d) {
      var inp = el.querySelector('#' + d[0]); if (!inp) return;
      inp.onkeydown = function (e) { e.stopPropagation(); if (e.key === 'Enter') this.blur(); };
      inp.onchange = function () { var v = M.parseM(this.value); setFachada(d[1], v === null || !this.value.trim() ? 0 : Math.max(d[2], Math.min(d[3], v / 100))); };
    });
    var sub = el.querySelector('#fach-sub');
    if (sub) { sub.onchange = function () { setFachada('letreiroSub', this.value.trim()); }; sub.onkeydown = function (e) { e.stopPropagation(); if (e.key === 'Enter') this.blur(); }; }
    var let2 = el.querySelector('#fach-let');
    let2.onchange = function () { setFachada('letreiro', this.value.trim().toUpperCase()); };
    let2.onkeydown = function (e) { e.stopPropagation(); if (e.key === 'Enter') this.blur(); };
    var pr = el.querySelector('#fach-prompt'), prOk = el.querySelector('#fach-prompt-ok');
    pr.onkeydown = function (e) { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); prOk.click(); } };
    prOk.onclick = function () { fachadaPorPrompt(pr.value); };
  }
  /* texto → fachada: aplica o que entendeu, diz o que entendeu */
  function fachadaPorPrompt(txt){
    if (!txt || !txt.trim()) { toast('Descreva a fachada primeiro.', null, true); return; }
    var atual = TRES.fachadaDe(M.proj); atual.nomeProjeto = (M.proj.nome || '').toUpperCase();
    var r = TRES.fachadaPorPrompt(txt, atual);
    if (!r.lidos.length) { toast('Não entendi nada aí. Tente: "moderna com ripado, esquadrias pretas, letreiro em LED azul".', null, true); return; }
    var f = M.proj.fachada || {};
    if (r.fachada.estilo && r.fachada.estilo !== f.estilo) f = {estilo:r.fachada.estilo, numero:f.numero || '', letreiro:f.letreiro};   /* estilo novo zera o resto, como no cartão */
    for (var k in r.fachada) f[k] = r.fachada[k];
    M.proj.fachada = f;
    M.commit('Fachada por prompt');
    fachPanel();
    var msg = document.querySelector('#fach-prompt-msg'); if (msg) msg.textContent = 'Entendi: ' + r.lidos.join(' · ');
    var e = document.querySelector('#fach-elev-pad'); if (e && !e.hidden) e.innerHTML = VIEWS.fachada();
    if (t3 && r.fachada.letreiroLuz && r.fachada.letreiro) t3.setNoite(true);   /* pediu letreiro aceso: mostra à noite */
  }
  /* ================= COPIAR DE UMA FOTO (visão) =================
     Planta: a foto de uma planta baixa vira os ambientes do andar atual (substitui o que havia nele, com desfazer).
     Fachada: a foto de uma casa/loja vira as escolhas da aba Fachada. A chave do Gemini é do usuário e fica só no navegador. */
  function copiarDeFoto(modo, file){
    if (!window.VISAO) return;
    if (!VISAO.chave()) { pedirChave(function () { copiarDeFoto(modo, file); }); return; }
    var msg = document.querySelector('#fach-prompt-msg'); if (msg) msg.textContent = 'Lendo a foto…';
    toast(modo === 'planta' ? 'Lendo a planta da foto… (uns segundos)' : 'Lendo a fachada da foto… (uns segundos)');
    hud('📷 lendo a foto…');
    VISAO.analisar(file, modo).then(function (r) {
      hud(null);
      if (modo === 'planta') {
        /* a planta da foto manda no tamanho: os recuos cedem para ela caber (nunca abaixo de zero) */
        var t = M.proj.terreno, Lm = +r.bruto.largura_m || 0, Pm = +r.bruto.profundidade_m || 0;
        if (/esquerda|direita/.test(String(r.bruto.frente || ''))) { var tmp = Lm; Lm = Pm; Pm = tmp; }
        if (Lm > 0 && Lm * 100 > t.largura - t.recuoLateral * 2) t.recuoLateral = Math.max(0, Math.floor((t.largura - Lm * 100) / 2 / 5) * 5);
        if (Pm > 0 && Pm * 100 > t.profundidade - t.recuoFrontal - t.recuoFundo) { t.recuoFundo = Math.max(0, Math.floor((t.profundidade - Pm * 100 - t.recuoFrontal) / 5) * 5); if (Pm * 100 > t.profundidade - t.recuoFrontal - t.recuoFundo) t.recuoFrontal = Math.max(0, Math.floor((t.profundidade - Pm * 100) / 5) * 5); }
        var np = VISAO.normalizarPlanta(r.bruto, M.proj.terreno), pav = M.pav;
        var antes = M.proj.ambientes.filter(function (a) { return M.pavDe(a) === pav; }).length;
        M.proj.ambientes = M.proj.ambientes.filter(function (a) { return M.pavDe(a) !== pav; }).concat(np.ambientes.map(function (a) { a.id = M.uid(); if (pav) a.pav = pav; return a; }));
        M.proj.moveis = (M.proj.moveis || []).filter(function (m) { return (m.pav || 0) !== pav; });
        var outros = M.proj.moveis, novos = M.mobiliarAuto().filter(function (m) { return (m.pav || 0) === pav; }); M.proj.moveis = outros.concat(novos);
        M.commit('Copiar planta da foto');
        if (viewAtual !== 'planta') irPara('planta'); else { PLAN.enquadrar(); PLAN.render(); inspector(); }
        toast('Copiei ' + np.ambientes.length + ' ambientes da foto' + (np.largura_m ? ' (' + M.num(np.largura_m) + ' × ' + M.num(np.profundidade_m) + ' m)' : '') + (antes ? ' — substituíram os ' + antes + ' que havia no ' + M.nomePav(pav).toLowerCase() : '') + '. Ajuste o que precisar.', function () { fazerUndo(); });
      } else {
        var nf = VISAO.normalizarFachada(r.bruto), atual = M.proj.fachada || {};
        var f = nf.fachada; if (!f.numero && atual.numero) f.numero = atual.numero;
        M.proj.fachada = f; M.commit('Copiar fachada da foto');
        if (viewAtual !== 'tresd') irPara('fachada'); else { fachPanel(); if (t3) t3.verFachada(true); }
        var m2 = document.querySelector('#fach-prompt-msg'); if (m2) m2.textContent = 'Entendi: ' + (nf.descricao || nf.lidos.join(', '));
        toast('Fachada copiada da foto: ' + (nf.descricao || nf.lidos.slice(0, 5).join(', ')), function () { fazerUndo(); });
      }
    }).catch(function (e) {
      hud(null); if (msg) msg.textContent = '';
      var m = String(e && e.message || e);
      if (m === 'SEM_CHAVE') { pedirChave(function () { copiarDeFoto(modo, file); }); return; }
      if (m.indexOf('CHAVE_INVALIDA') === 0) { pedirChave(function () { copiarDeFoto(modo, file); }, 'A chave não foi aceita: ' + m.slice(15, 120)); return; }
      toast('Não consegui ler a foto: ' + m, null, true);
    });
  }
  function pedirChave(depois, aviso){
    var ov = $('#visao'); if (!ov) return;
    ov.innerHTML = '<div class="sheet"><h3>Copiar de uma foto</h3>' +
      '<p class="vsub" style="margin-top:6px">Para ler fotos o app usa o <b>Gemini</b> (Google) com uma chave sua — grátis, criada em 1 minuto. Ela fica guardada só neste navegador e nunca vai para nenhum servidor nosso.</p>' +
      '<ol class="vsub" style="margin:10px 0 12px 18px;line-height:1.7"><li>Abra <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a></li><li>Clique em <b>Create API key</b> e copie</li><li>Cole aqui</li></ol>' +
      (aviso ? '<div class="alertbox" style="margin-bottom:10px"><b>' + esc(aviso) + '</b></div>' : '') +
      '<div class="f"><div class="inp"><input id="visao-key" placeholder="AIza…" value="' + esc(VISAO.chave()) + '" autocomplete="off" spellcheck="false"></div></div>' +
      '<div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn solid" id="visao-ok">Salvar e continuar</button><button class="btn ghost" id="visao-cancel">Cancelar</button>' + (VISAO.chave() ? '<button class="btn ghost" id="visao-del" style="margin-left:auto">Apagar chave</button>' : '') + '</div></div>';
    ov.hidden = false;
    var inp = ov.querySelector('#visao-key'); inp.focus();
    inp.onkeydown = function (e) { e.stopPropagation(); if (e.key === 'Enter') ov.querySelector('#visao-ok').click(); if (e.key === 'Escape') ov.hidden = true; };
    ov.querySelector('#visao-ok').onclick = function () { var k = inp.value.trim(); if (!k) { inp.focus(); return; } VISAO.setChave(k); ov.hidden = true; toast('Chave guardada neste navegador.'); if (depois) depois(); };
    ov.querySelector('#visao-cancel').onclick = function () { ov.hidden = true; };
    var del = ov.querySelector('#visao-del'); if (del) del.onclick = function () { VISAO.setChave(''); ov.hidden = true; toast('Chave apagada.'); };
    ov.onclick = function (e) { if (e.target === ov) ov.hidden = true; };
  }

  /* ================= CLICAR NO ITEM PARA TROCAR (fachada) =================
     O 3D etiqueta cada elemento (userData.fk). Clicou → popover ao lado do clique com SÓ as opções daquele item;
     cada escolha aplica na hora (com desfazer) e o popover continua aberto para comparar. */
  var FK_ROT = {janela:'Janela', porta:'Porta de entrada', garagem:'Porta da garagem', cobertura:'Cobertura', parede:'Parede', revestimento:'Revestimento da frente',
    destaque:'Volume de destaque', portao:'Portão', muro:'Muro', pisoFrente:'Piso da frente', jardim:'Jardim', marquise:'Marquise', letreiro:'Letreiro', vitrine:'Vitrine', portaInt:'Porta interna'};
  var FK_TOGGLES = ['jardim', 'marquise', 'iluminacao', 'pergolado', 'vitrine', 'letreiroLuz', 'totem', 'moldura', 'gradeJanela', 'brise', 'arandelas', 'vasos', 'bandeira', 'placaMuro', 'adesivo', 'logoComTexto'];
  function dicaFachada(fk, x, y, id){
    var d = document.getElementById('fhint');
    if (!fk) { if (d) d.hidden = true; return; }
    if (!d) { d = document.createElement('div'); d.id = 'fhint'; d.className = 'fhint'; document.body.appendChild(d); }
    var amb = id ? M.proj.ambientes.filter(function (a) { return a.id === id.split('|')[0]; })[0] : null;
    var arrasta = (id && (fk === 'janela' || fk === 'porta' || fk === 'garagem' || fk === 'portaInt')) || fk === 'letreiro';
    d.textContent = (FK_ROT[fk] || fk) + (amb ? ' · ' + amb.nome : '') + ' — ' + (arrasta ? 'arraste para mover · clique para ' : 'clique para ') + (fk === 'janela' || fk === 'porta' ? 'trocar ou excluir' : fk === 'parede' ? 'pôr janela/porta ou trocar' : fk === 'letreiro' ? 'tamanho, arte e tipo' : 'trocar'); d.hidden = false;
    d.style.left = Math.min(window.innerWidth - 220, x + 14) + 'px'; d.style.top = (y + 16) + 'px';
  }
  /* ---- arrasto no 3D: janela/porta/portão pela parede (pos/ppos em cm a partir do início da parede) e letreiro pela fachada (m) ---- */
  var dragAntes = null;   /* valor antes do arrasto começar (para cancelar com o 2º dedo sem gravar) */
  function abMove3d(id, k, v){ if (!dragAntes) { var o0 = M.abertura(id); dragAntes = {id:id, k:k, v:o0 ? o0[k] : null}; } var p = {}; p[k] = v; M.setAbertura(id, p); if (t3) t3.atualizar(true); }
  function abFim3d(id, fk){
    dragAntes = null;
    var rot = {janela:'janela', porta:'porta', garagem:'portão', portaInt:'porta interna'}[fk] || 'abertura';
    M.commit('Mover ' + rot); fachPanel(); fecharPop();
    toast(rot.charAt(0).toUpperCase() + rot.slice(1) + ' movida. Clique nela para medidas e tipo.', function () { fazerUndo(); });
  }
  function abCancel3d(id, k){ if (dragAntes && dragAntes.id === id) { var p = {}; p[k] = dragAntes.v == null ? null : dragAntes.v; M.setAbertura(id, p); } dragAntes = null; if (t3) t3.atualizar(true); }
  function letreiroMove3d(v){ M.proj.fachada = M.proj.fachada || {}; if (!dragAntes) dragAntes = {let:true, x:M.proj.fachada.letreiroX, y:M.proj.fachada.letreiroY}; M.proj.fachada.letreiroX = v.x; M.proj.fachada.letreiroY = v.y; if (t3) t3.atualizar(true); }
  function letreiroFim3d(){ dragAntes = null; M.commit('Mover letreiro'); fachPanel(); fecharPop(); toast('Letreiro movido. Clique nele para tamanho e arte.', function () { fazerUndo(); }); }
  function letreiroCancel3d(){ if (dragAntes && dragAntes.let) { M.proj.fachada.letreiroX = dragAntes.x; M.proj.fachada.letreiroY = dragAntes.y; } dragAntes = null; if (t3) t3.atualizar(true); }
  /* campos compartilhados pelo painel e pelo popover: cobertura (tipo, telha, inclinação, beiral, cor da estrutura), posição/tamanho do letreiro e arte dentro dele */
  var CORES_ESTR = ['#3A3F45', '#1F2326', '#A6ACB2', '#F4F4F1', '#C4553B', '#2F5D8A', '#4E9A5D', '#E0B44C', '#D9722B', '#6B4E9E'];
  function telhasDe(F){ if (!TRES.SEM_LAJE[F.cobertura]) return TRES.TELHAS; return {metalica:TRES.TELHAS.metalica, fibrocimento:TRES.TELHAS.fibrocimento, sanduiche:TRES.TELHAS.sanduiche}; }
  function campoM(k, rot, val, ph, min, max){ return '<div class="f"><label>' + rot + '</label><div class="inp"><input data-fm="' + k + '" data-min="' + min + '" data-max="' + max + '" value="' + (val > 0 ? M.fmtMs(val * 100) : '') + '" placeholder="' + (ph || 'auto') + '"><span class="un">m</span></div></div>'; }
  function coberturaExtra(F, chipsFn, corFn){
    if (F.cobertura === 'platibanda') return '';
    var h = '<h6 style="margin-top:10px">TELHA</h6>' + chipsFn('telha', telhasDe(F));
    if (F.cobertura !== 'arco' && F.cobertura !== 'shed') h += '<h6 style="margin-top:10px">INCLINAÇÃO</h6>' + chipsFn('inclinacao', Object.assign({'':'Padrão'}, TRES.INCLINACOES));
    h += '<div class="f-row" style="margin-top:8px">' + campoM('beiral', 'BEIRAL', F.beiral, F.cobertura === 'galpao' || TRES.SEM_LAJE[F.cobertura] ? '0,60' : '0,50', .1, 2.5) + '</div>';
    if (TRES.SEM_LAJE[F.cobertura]) h += '<h6 style="margin-top:10px">COR DA ESTRUTURA</h6>' + corFn('estruturaCor', CORES_ESTR) + '<div class="ins-empty" style="margin-top:6px">Sem laje: tesouras, terças e pilares ficam à vista por dentro (Andar / Passeio).</div>';
    return h;
  }
  function letreiroPosHtml(F){
    var manual = F.letreiroX > 0 || F.letreiroY > 0;
    return '<div class="ins-empty">Arraste o letreiro no 3D para mudar de lugar.</div><div class="f-row" style="margin-top:6px">' + campoM('letreiroLargura', 'LARGURA', F.letreiroLargura, 'auto', .4, 30) + campoM('letreiroAltura', 'ALTURA', F.letreiroAltura, 'auto', .2, 4) + campoM('letreiroY', 'DO CHÃO', F.letreiroY, 'auto', .2, 12) + '</div>' +
      (manual ? '<div class="chips" style="margin-top:6px"><button class="chip" data-fclear="letreiroX,letreiroY">↺ Posição automática</button></div>' : '');
  }
  function logoAjusteHtml(F){
    if (!M.proj.logo) return '';
    function rng(k, rot, min, max, step, val, fmt){ return '<div class="f"><label>' + rot + ' <b data-fr-val="' + k + '">' + fmt(val) + '</b></label><input type="range" data-fr="' + k + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '" style="width:100%"></div>'; }
    var pct = function (v) { return Math.round(v * 100) + '%'; }, des = function (v) { return v === 0 ? 'centro' : (v > 0 ? '+' : '') + Math.round(v * 100) + '%'; };
    return rng('logoEscala', 'TAMANHO DA ARTE', .3, 1.5, .05, F.logoEscala || 1, pct) + rng('logoX', 'ESQUERDA ⇄ DIREITA', -1, 1, .05, F.logoX || 0, des) + rng('logoY', 'BAIXO ⇅ CIMA', -1, 1, .05, F.logoY || 0, des) +
      '<div class="chips" style="margin-top:6px"><button class="chip' + (F.logoComTexto ? ' on' : '') + '" data-fk="logoComTexto" data-fv="' + (F.logoComTexto ? '0' : '1') + '">Nome ao lado da arte</button>' + ((F.logoEscala && F.logoEscala !== 1) || F.logoX || F.logoY ? '<button class="chip" data-fclear="logoEscala,logoX,logoY">↺ Centralizar</button>' : '') + '</div>';
  }
  /* liga campos em metros (data-fm), controles deslizantes (data-fr, ao vivo sem gravar; grava ao soltar) e botões de limpar (data-fclear) */
  function ligarAjustes(raiz, depois){
    raiz.querySelectorAll('input[data-fm]').forEach(function (inp) {
      inp.onkeydown = function (e) { e.stopPropagation(); if (e.key === 'Enter') this.blur(); };
      inp.onchange = function () { var v = M.parseM(this.value), k = inp.getAttribute('data-fm'); setFachada(k, v === null || !this.value.trim() ? 0 : Math.max(+inp.getAttribute('data-min'), Math.min(+inp.getAttribute('data-max'), v / 100))); if (depois) depois(); };
    });
    raiz.querySelectorAll('input[data-fr]').forEach(function (inp) {
      var k = inp.getAttribute('data-fr'), lbl = raiz.querySelector('[data-fr-val="' + k + '"]');
      inp.oninput = function () { M.proj.fachada = M.proj.fachada || {}; M.proj.fachada[k] = +this.value; if (lbl) lbl.textContent = k === 'logoEscala' ? Math.round(this.value * 100) + '%' : (+this.value === 0 ? 'centro' : (this.value > 0 ? '+' : '') + Math.round(this.value * 100) + '%'); if (t3) t3.atualizar(true); };
      inp.onchange = function () { M.commit('Arte no letreiro'); fachPanel(); if (depois) depois(); };
      inp.onkeydown = function (e) { e.stopPropagation(); }; inp.onpointerdown = function (e) { e.stopPropagation(); };
    });
    raiz.querySelectorAll('[data-fclear]').forEach(function (b) { b.onclick = function () { M.proj.fachada = M.proj.fachada || {}; b.getAttribute('data-fclear').split(',').forEach(function (k) { delete M.proj.fachada[k]; }); M.commit('Fachada: automático'); fachPanel(); if (depois) depois(); }; });
  }
  /* arte anexada (logo do estabelecimento): vai para o letreiro, outdoor, bandeira, placa do muro, totem e adesivo */
  function logoBloco(){
    var lg = M.proj.logo;
    return '<div class="logo-bloco">' + (lg ? '<img src="' + lg + '" alt="" class="logo-thumb">' : '<span class="dim" style="font-size:11.5px">Nenhuma arte. Anexe o logo (PNG com fundo transparente fica melhor) e ele substitui o texto em todas as placas.</span>') +
      '<div class="chips"><button class="chip" data-logo-btn>📎 ' + (lg ? 'Trocar arte' : 'Anexar logo / arte') + '</button>' + (lg ? '<button class="chip danger" data-logo-del>✕ Remover</button>' : '') + '</div><input class="logo-in" type="file" accept="image/*" hidden></div>';
  }
  function ligarLogo(raiz, depois){
    var inp = raiz.querySelector('input.logo-in'); if (!inp) return;
    var btn = raiz.querySelector('[data-logo-btn]'); if (btn) btn.onclick = function () { inp.click(); };
    inp.onchange = function () { var file = this.files[0]; this.value = ''; if (!file) return; lerArte(file, function (url) { M.proj.logo = url; M.commit('Anexar arte'); M.salvar(); fachPanel(); if (t3) t3.atualizar(); toast('Arte anexada: entra no letreiro e em todas as placas.'); if (depois) depois(); }); };
    var del = raiz.querySelector('[data-logo-del]'); if (del) del.onclick = function () { delete M.proj.logo; M.commit('Remover arte'); M.salvar(); fachPanel(); if (t3) t3.atualizar(); if (depois) depois(); };
  }
  /* reduz a arte a 1024 px; PNG mantém transparência, o resto vira JPEG */
  function lerArte(file, cb){
    var rd = new FileReader();
    rd.onload = function () { var img = new Image(); img.onload = function () {
      var k = Math.min(1, 1024 / Math.max(img.width, img.height)), cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      var cx = cv.getContext('2d'), png = /png|webp|svg/i.test(file.type); if (!png) { cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); }
      cx.drawImage(img, 0, 0, cv.width, cv.height); cb(png ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', .88));
    }; img.onerror = function () { toast('Arquivo não é uma imagem.', null, true); }; img.src = rd.result; };
    rd.readAsDataURL(file);
  }
  function popFachada(fk, x, y, id){
    var F = TRES.fachadaDe(M.proj), h = '';
    var ov = id ? (M.abertura(id) || {}) : {}, partes = id ? id.split('|') : [], ambAb = partes[0] ? M.proj.ambientes.filter(function (a) { return a.id === partes[0]; })[0] : null;
    var LADO = {frente:'frente', fundo:'fundo', esq:'lateral esquerda', dir:'lateral direita'}, ondeAb = ambAb ? esc(ambAb.nome) + ' · parede da ' + (LADO[partes[1]] || partes[1]) : '';
    if (partes[0] === 'int') { var nA = (M.proj.ambientes.filter(function (a) { return a.id === partes[1]; })[0] || {}).nome, nB = (M.proj.ambientes.filter(function (a) { return a.id === partes[2]; })[0] || {}).nome; ondeAb = esc(nA || '?') + ' ↔ ' + esc(nB || '?'); }
    function campoPorta(){ return '<div class="f-row" style="margin-top:8px">' + campoAb('pw', 'LARGURA DESTA PORTA', ov.pw) + campoAb('palt', 'ALTURA', ov.palt) + '</div><div class="ins-empty" style="margin-top:-2px">Vazio = automático (0,80 × 2,10 interna · 0,90 × 2,10 entrada · garagem até 2,80).</div>'; }
    function campoAb(k, rot, val){ return '<div class="f"><label>' + rot + '</label><div class="inp"><input data-ab="' + k + '" value="' + (val != null ? M.fmtMs(val) : '') + '" placeholder="auto"><span class="un">m</span></div></div>'; }
    function abChips(k, mapa){ return '<div class="chips">' + Object.keys(mapa).map(function (v) { return '<button class="chip' + (ov[k] === v ? ' on' : '') + '" data-abk="' + k + '" data-abv="' + v + '">' + mapa[v] + '</button>'; }).join('') + (ov[k] ? '<button class="chip" data-abk="' + k + '" data-abv="">= geral</button>' : '') + '</div>'; }
    /* ---- o item clicado (só ele) ---- */
    function posChip(k){ return ov[k] != null ? '<button class="chip" data-abk="' + k + '" data-abv="">↺ Posição automática</button>' : ''; }
    var dicaMover = '<div class="ins-empty">Arraste no 3D para mover pela parede.</div>';
    if (id && fk === 'janela') {
      h += '<section class="ab-sec"><h6>ESTA JANELA <small>' + ondeAb + '</small></h6>' + dicaMover +
        '<div class="chips"><button class="chip danger" data-abk="tipo" data-abv="nenhuma">✕ Excluir janela</button>' + posChip('pos') + (Object.keys(ov).length ? '<button class="chip" data-ab-reset>↺ Automático</button>' : '') + '</div>' +
        '<h6 style="margin-top:8px">QUANTAS NESTA PAREDE</h6><div class="chips">' + [1, 2, 3, 4].map(function (n) { return '<button class="chip' + ((ov.n || 1) === n ? ' on' : '') + '" data-abk="n" data-abv="' + n + '">' + n + '</button>'; }).join('') + '</div>' +
        '<div class="f-row" style="margin-top:8px">' + campoAb('w', 'LARGURA', ov.w) + campoAb('alt', 'ALTURA', ov.alt) + campoAb('peitoril', 'PEITORIL', ov.peitoril) + '</div>' +
        '<h6 style="margin-top:8px">TIPO SÓ DESTA</h6>' + abChips('janela', TRES.JANELAS) + '<h6 style="margin-top:8px">VIDRO SÓ DESTA</h6>' + abChips('vidro', TRES.VIDROS) + '</section>';
    }
    if (id && fk === 'parede') {
      h += '<section class="ab-sec"><h6>ESTA PAREDE <small>' + ondeAb + '</small></h6><div class="chips">' +
        '<button class="chip" data-abk="tipo" data-abv="janela">+ Janela aqui</button><button class="chip" data-abk="tipo" data-abv="porta">+ Porta aqui</button>' +
        (M.proj.entradaEm === id ? '<button class="chip on" data-entrada="">★ Entrada principal (voltar ao automático)</button>' : '<button class="chip" data-entrada="' + id + '">★ Entrada principal aqui</button>') +
        (Object.keys(ov).length ? '<button class="chip" data-ab-reset>↺ Automático</button>' : '') + '</div></section>';
    }
    if (id && fk === 'porta') {
      h += '<section class="ab-sec"><h6>ESTA PORTA <small>' + ondeAb + '</small></h6>' + dicaMover + '<div class="chips">' +
        (ov.tipo === 'porta' ? '<button class="chip danger" data-abk="tipo" data-abv="nenhuma">✕ Excluir porta</button>' : '<span class="dim" style="font-size:11.5px">É a entrada principal. Para levá-la a outra parede, clique nela e escolha “Entrada principal aqui”.</span>') +
        posChip('ppos') + (M.proj.entradaEm ? '<button class="chip" data-entrada="">↺ Entrada automática</button>' : '') + ((ov.pw || ov.palt) ? '<button class="chip" data-ab-reset>↺ Tamanho automático</button>' : '') + '</div>' + campoPorta() + '</section>';
    }
    if (id && fk === 'garagem') {
      h += '<section class="ab-sec"><h6>ESTE PORTÃO <small>' + ondeAb + '</small></h6>' + dicaMover + campoPorta() + ((ov.pw || ov.palt || ov.ppos != null) ? '<div class="chips">' + posChip('ppos') + ((ov.pw || ov.palt) ? '<button class="chip" data-ab-reset>↺ Tamanho automático</button>' : '') + '</div>' : '') + '</section>';
    }
    if (id && fk === 'portaInt') {
      h += '<section class="ab-sec"><h6>PORTA INTERNA <small>' + ondeAb + '</small></h6>' + dicaMover + '<div class="chips"><button class="chip danger" data-abk="tipo" data-abv="nenhuma">✕ Excluir porta</button>' + posChip('ppos') + (Object.keys(ov).length ? '<button class="chip" data-ab-reset>↺ Automático</button>' : '') + '</div>' + campoPorta() + '</section>' +
        sec('PORTAS INTERNAS (TODAS)', '<div class="ins-empty">A cor e o material das portas internas seguem a esquadria: ' + chips('esquadria', ROT.esquadria) + '</div>');
    }
    function chips(k, mapa){ return '<div class="chips">' + Object.keys(mapa).map(function (v) { return '<button class="chip' + (F[k] === v ? ' on' : '') + '" data-fk="' + k + '" data-fv="' + v + '">' + mapa[v] + '</button>'; }).join('') + '</div>'; }
    function tg(k, rot){ return '<button class="chip' + (F[k] ? ' on' : '') + '" data-fk="' + k + '" data-fv="' + (F[k] ? '0' : '1') + '">' + rot + '</button>'; }
    function cor(k, lista){ var atual = F[k] || '', custom = atual && lista.indexOf(String(atual).toUpperCase()) < 0;
      return '<div class="swatches">' + lista.map(function (c) { return '<button class="sw-btn' + (String(atual).toUpperCase() === c ? ' on' : '') + '" data-fk="' + k + '" data-fv="' + c + '" style="background:' + c + '" title="' + c + '"></button>'; }).join('') +
        '<label class="sw-btn sw-custom' + (custom ? ' on' : '') + '" title="Qualquer cor" style="background:' + (custom ? atual : 'conic-gradient(#E4574F,#F2C14E,#4E9A5D,#22B8D6,#6B4E9E,#E4574F)') + '"><input type="color" data-fc="' + k + '" value="' + (atual || '#888888') + '"></label></div>'; }
    function sec(t, inner){ return '<section><h6>' + t + '</h6>' + inner + '</section>'; }
    if (fk === 'janela') h += sec('TIPO DE JANELA', chips('janela', TRES.JANELAS)) + sec('VIDRO', chips('vidro', TRES.VIDROS)) + sec('DETALHES', '<div class="chips">' + tg('moldura', 'Moldura') + tg('gradeJanela', 'Grade') + tg('brise', 'Brise') + '</div>') + sec('ESQUADRIA', chips('esquadria', ROT.esquadria) + cor('esquadriaCor', CORES_ESQ));
    else if (fk === 'porta') h += sec('PORTA · CASA', chips('porta', TRES.PORTAS)) + sec('PORTA · LOJA', chips('porta', TRES.PORTAS_LOJA)) + sec('COR', cor('portaCor', CORES_PORTA)) + sec('NA ENTRADA', '<div class="chips">' + tg('arandelas', 'Arandelas') + tg('vasos', 'Vasos') + tg('marquise', 'Marquise') + tg('pergolado', 'Pergolado') + '</div>');
    else if (fk === 'garagem') h += sec('PORTA DA GARAGEM', chips('garagem', TRES.GARAGENS)) + sec('COR', cor('portaCor', CORES_PORTA));
    else if (fk === 'cobertura') h += sec('COBERTURA', chips('cobertura', TRES.COBERTURAS) + coberturaExtra(F, chips, cor)) + (F.cobertura === 'platibanda' ? sec('COR DA PLATIBANDA', cor('corParede', CORES_PAREDE)) : '');
    else if (fk === 'parede') h += sec('COR DA PAREDE', cor('corParede', CORES_PAREDE)) + sec('REVESTIMENTO DA FRENTE', chips('revestimento', ROT.revestimento)) + sec('ESTILO', chips('estilo', (function () { var o = {}; Object.keys(TRES.FACHADA_PRESETS).forEach(function (k) { o[k] = TRES.FACHADA_PRESETS[k].rot; }); return o; })()));
    else if (fk === 'revestimento') h += sec('REVESTIMENTO', chips('revestimento', ROT.revestimento)) + sec('COR DA PAREDE', cor('corParede', CORES_PAREDE));
    else if (fk === 'destaque') h += sec('COR DE DESTAQUE', cor('corDestaque', CORES_DEST)) + sec('NA ENTRADA', '<div class="chips">' + tg('marquise', 'Marquise') + tg('pergolado', 'Pergolado') + tg('arandelas', 'Arandelas') + '</div>');
    else if (fk === 'portao') h += sec('PORTÃO', chips('portao', ROT.portao)) + sec('COR', cor('portaoCor', CORES_PORTA)) + sec('LETREIRO', '<div class="chips">' + tg('totem', 'Totem no portão') + '</div>');
    else if (fk === 'muro') h += sec('MURO', chips('muro', ROT.muro)) + sec('COR', cor('muroCor', CORES_MURO)) + sec('FRENTE', '<div class="chips">' + tg('jardim', 'Jardim') + tg('iluminacao', 'Iluminação') + '</div>');
    else if (fk === 'pisoFrente') h += sec('PISO DA FRENTE', chips('pisoFrente', TRES.PISOS_FRENTE)) + sec('FRENTE', '<div class="chips">' + tg('jardim', 'Jardim') + tg('vasos', 'Vasos') + '</div>');
    else if (fk === 'jardim') h += sec('JARDIM', '<div class="chips">' + tg('jardim', 'Jardim') + tg('vasos', 'Vasos') + tg('iluminacao', 'Iluminação') + '</div>') + sec('PISO DA FRENTE', chips('pisoFrente', TRES.PISOS_FRENTE));
    else if (fk === 'marquise') h += sec('ENTRADA', '<div class="chips">' + tg('marquise', 'Marquise') + tg('pergolado', 'Pergolado') + tg('arandelas', 'Arandelas') + '</div>') + sec('COR DE DESTAQUE', cor('corDestaque', CORES_DEST));
    else if (fk === 'vitrine') h += sec('VITRINE', '<div class="chips">' + tg('vitrine', 'Vitrine na frente') + '</div>') + sec('VIDRO', chips('vidro', TRES.VIDROS)) + sec('ESQUADRIA', chips('esquadria', ROT.esquadria));
    else if (fk === 'letreiro') h += sec('POSIÇÃO E MEDIDA', letreiroPosHtml(F)) + sec('ARTE / LOGO', logoBloco() + logoAjusteHtml(F)) + sec('TIPO', chips('letreiroEstilo', {placa:'Placa', caixa:'Letra caixa', led:'LED', neon:'Neon', backlight:'Backlight'})) + sec('FORMATO', chips('letreiroFormato', TRES.LETREIRO_FORMATOS)) +
      sec('TAMANHO', '<div class="chips">' + Object.keys(TRES.LETREIRO_TAMS).map(function (v) { return '<button class="chip' + (F.letreiroTam === v && !F.letreiroLargura ? ' on' : '') + '" data-fk="letreiroTam" data-fv="' + v + '">' + TRES.LETREIRO_TAMS[v] + '</button>'; }).join('') + '</div>') +
      sec('FONTE', chips('letreiroFonte', TRES.LETREIRO_FONTES)) + sec('COR DAS LETRAS', cor('letreiroCor', ['#22B8D6', '#2F5D8A', '#C4553B', '#E0B44C', '#4E9A5D', '#D96AA0', '#F4F4F1', '#1F2326', '#D9722B', '#6B4E9E', '#C9A227', '#1E7E96'])) +
      sec('ONDE', chips('letreiroPos', TRES.LETREIRO_POS)) +
      sec('PLACAS PUBLICITÁRIAS', '<div class="chips">' + tg('bandeira', 'Bandeira lateral') + tg('placaMuro', 'Placa no muro') + tg('totem', 'Totem') + tg('adesivo', 'Adesivo na vitrine') + '</div>' +
        '<div class="f" style="margin-top:8px"><label>FAIXA / BANNER (TEXTO)</label><div class="inp"><input data-ftxt="faixa" value="' + esc(F.faixa || '') + '" placeholder="ex.: PROMOÇÃO · INAUGURAÇÃO" maxlength="40"></div></div>' + (F.faixa ? cor('faixaCor', ['#E4574F', '#E0B44C', '#1E7E96', '#4E9A5D', '#2F5D8A', '#1F2326', '#D96AA0']) : '')) +
      sec('LUZ', '<div class="chips">' + tg('letreiroLuz', 'Acende à noite') + '</div>');
    if (!h) return;
    var pop = document.getElementById('fpop');
    if (!pop) { pop = document.createElement('div'); pop.id = 'fpop'; pop.className = 'fpop'; document.body.appendChild(pop); }
    pop.innerHTML = '<div class="fpop-hd"><b>' + (FK_ROT[fk] || fk) + '</b><span>clique para trocar · Esc fecha</span><button class="icon-btn" data-close>' + icon('close') + '</button></div><div class="fpop-bd">' + h + '</div>' +
      '<div class="fpop-ft"><button class="btn ghost sm" data-undo' + (M.podeUndo() ? '' : ' disabled') + '>↶ Desfazer</button><button class="btn ghost sm" data-panel>Todas as opções</button></div>';
    pop.hidden = false; pop.dataset.fk = fk;
    if (x != null) { var W = 340, Hh = Math.min(window.innerHeight - 40, 520); pop.style.left = Math.max(8, Math.min(window.innerWidth - W - 8, x + 12)) + 'px'; pop.style.top = Math.max(8, Math.min(window.innerHeight - Hh - 8, y - 40)) + 'px'; }
    dicaFachada(null);
    pop.querySelectorAll('[data-fk]').forEach(function (b) {
      b.onclick = function () {
        var k = b.getAttribute('data-fk'), v = b.getAttribute('data-fv');
        if (FK_TOGGLES.indexOf(k) >= 0) v = v === '1';
        if (k === 'esquadria') { M.proj.fachada = M.proj.fachada || {}; M.proj.fachada.esquadriaCor = ''; }
        if (k === 'letreiroTam') { M.proj.fachada = M.proj.fachada || {}; M.proj.fachada.letreiroLargura = 0; M.proj.fachada.letreiroAltura = 0; }
        setFachada(k, v); popFachada(fk, null, null, id);   /* reabre no mesmo lugar, já com a escolha marcada */
      };
    });
    pop.querySelectorAll('input[data-fc]').forEach(function (inp) { inp.onchange = function () { setFachada(inp.getAttribute('data-fc'), inp.value.toUpperCase()); popFachada(fk, null, null, id); }; inp.onclick = function (e) { e.stopPropagation(); }; });
    pop.querySelectorAll('input[data-ftxt]').forEach(function (inp) { inp.onkeydown = function (e) { e.stopPropagation(); if (e.key === 'Enter') this.blur(); }; inp.onchange = function () { setFachada(inp.getAttribute('data-ftxt'), this.value.trim().toUpperCase()); popFachada(fk, null, null, id); }; });
    /* abertura clicada: excluir, quantidade, tipo/vidro só dela, medidas, porta/janela nesta parede, entrada aqui */
    pop.querySelectorAll('[data-abk]').forEach(function (b) { b.onclick = function () {
      var k = b.getAttribute('data-abk'), v = b.getAttribute('data-abv'), patch = {};
      if (k === 'n') patch.n = +v; else if (k === 'tipo') { patch.tipo = v; if (v === 'janela') { patch.n = ov.n || 1; } } else patch[k] = v || null;
      if (k === 'tipo' && v === 'nenhuma') { patch.n = null; patch.w = null; patch.alt = null; patch.peitoril = null; patch.janela = null; patch.vidro = null; patch.pos = null; }
      M.setAbertura(id, patch); M.commit(v === 'nenhuma' ? 'Excluir abertura' : 'Abertura: ' + k); fachPanel();
      if (fk === 'portaInt' && v === 'nenhuma') { fecharPop(); toast('Porta interna excluída — os dois ambientes deixam de se comunicar por ali.', function () { fazerUndo(); }); return; }
      popFachada(v === 'nenhuma' ? 'parede' : (v === 'porta' ? 'porta' : (k === 'tipo' ? 'janela' : fk)), null, null, id);
      toast(v === 'nenhuma' ? 'Abertura excluída.' : 'Aplicado só nesta parede.', function () { fazerUndo(); });
    }; });
    pop.querySelectorAll('input[data-ab]').forEach(function (inp) { inp.onkeydown = function (e) { e.stopPropagation(); if (e.key === 'Enter') this.blur(); }; inp.onchange = function () {
      var k = inp.getAttribute('data-ab'), n = inp.value.trim() ? M.parseM(inp.value) : null, patch = {}; patch[k] = n === null ? null : Math.max(k === 'peitoril' ? 0 : 30, n);
      if (!ov.tipo && (k === 'w' || k === 'alt' || k === 'peitoril' || k === 'n')) patch.tipo = 'janela'; M.setAbertura(id, patch); M.commit(k === 'pw' || k === 'palt' ? 'Tamanho da porta' : 'Medida da janela'); fachPanel(); popFachada(fk, null, null, id);
    }; });
    var rst = pop.querySelector('[data-ab-reset]'); if (rst) rst.onclick = function () { M.limparAbertura(id); M.commit('Abertura automática'); fachPanel(); popFachada(fk === 'porta' ? 'parede' : fk, null, null, id); };
    pop.querySelectorAll('[data-entrada]').forEach(function (b) { b.onclick = function () { var v = b.getAttribute('data-entrada'); if (v) M.proj.entradaEm = v; else delete M.proj.entradaEm; M.commit(v ? 'Entrada principal aqui' : 'Entrada automática'); fachPanel(); if (t3) t3.verFachada(true); popFachada(v ? 'porta' : 'parede', null, null, id); toast(v ? 'A entrada principal agora é nesta parede.' : 'Entrada volta ao automático.', function () { fazerUndo(); }); }; });
    ligarLogo(pop, function () { popFachada(fk, null, null, id); });
    ligarAjustes(pop, function () { popFachada(fk, null, null, id); });
    pop.querySelector('[data-close]').onclick = fecharPop;
    pop.querySelector('[data-undo]').onclick = function () { fazerUndo(); popFachada(fk, null, null, id); };
    pop.querySelector('[data-panel]').onclick = function () { fecharPop(); var pad3 = canvasWrap.querySelector('.view-pad.pad-3d'); if (viewAtual !== 'tresd') irPara('fachada'); else if (pad3 && !pad3.classList.contains('panel-on')) { var tgb = pad3.querySelector('#fach-tg'); if (tgb) tgb.click(); } var el = document.querySelector('#fach-panel'); if (el) { el.scrollTop = 0; el.classList.add('flash'); setTimeout(function () { el.classList.remove('flash'); }, 900); } };
  }
  function fecharPop(){ var p = document.getElementById('fpop'); if (p) p.hidden = true; var c = document.getElementById('ctx'); if (c) c.hidden = true; }

  /* ================= MENU DE CONTEXTO (botão direito na planta) =================
     Ambiente: renomear, tipo, mobiliar, duplicar, girar, andar, excluir · Móvel: girar, espelhar, duplicar, trocar, excluir ·
     Vazio: adicionar ambiente aqui, mobiliar, enquadrar. Tudo o que o inspector faz, a um clique de distância. */
  function menuContexto(e){
    var alvoAbx = e.target.closest ? e.target.closest('.ab') : null;
    if (alvoAbx) { popFachada(alvoAbx.getAttribute('data-fk'), e.clientX, e.clientY, alvoAbx.getAttribute('data-id') || null); return; }
    var alvoMov = e.target.closest ? e.target.closest('.mov') : null, alvoAmb = e.target.closest ? e.target.closest('.amb') : null;
    var p = PLAN.toModel(e), itens = [], titulo = '';
    function it(rot, fn, cls){ itens.push({rot:rot, fn:fn, cls:cls || ''}); }
    var noGrupo = PLAN.multi.length > 1 && ((alvoMov && PLAN.multi.some(function (m) { return m.t === 'mov' && m.id === alvoMov.getAttribute('data-id'); })) || (alvoAmb && PLAN.multi.some(function (m) { return m.t === 'amb' && m.id === alvoAmb.getAttribute('data-id'); })));
    if (noGrupo) {
      var gg = PLAN.itensGrupo(); titulo = (gg.ambs.length + gg.movs.length) + ' itens selecionados';
      it('Duplicar grupo', function () { acaoGrupo('dup'); });
      if (M.nPavs() > 1 && gg.ambs.length) for (var pvg = 0; pvg < M.nPavs(); pvg++) if (pvg !== M.pav) (function (pv3) { it('Enviar grupo para ' + M.nomePav(pv3), function () { acaoGrupo('pav', pv3); }); })(pvg);
      it('Desmarcar', function () { PLAN.setMulti([]); });
      it('Excluir tudo', function () { acaoGrupo('del'); }, 'danger');
    } else if (alvoMov && !PLAN.bloq('moveis')) {
      var mid = alvoMov.getAttribute('data-id'), mv = M.movelDe(mid), d = mv && MOVEIS.def(mv.k);
      if (!mv) return; PLAN.selecionarMovel(mid); titulo = d ? d.nome : 'Móvel';
      it('Girar 90°', function () { acaoMovel('rot', mid); }); it('Girar −90°', function () { acaoMovel('rotm', mid); }); it('Espelhar', function () { acaoMovel('esp', mid); });
      it('Duplicar', function () { acaoMovel('dup', mid); }); it('Elevar 10 cm', function () { acaoMovel('up', mid); });
      it('Trocar por outro…', function () { catCat = d ? d.cat : null; catBusca = ''; toggleCatalogo(true); toast('Escolha o novo móvel no catálogo — ele nasce no mesmo lugar.', null); trocaMovel = mid; });
      it('Medidas de fábrica', function () { acaoMovel('reset', mid); });
      it('Excluir', function () { acaoMovel('del', mid); }, 'danger');
    } else if (alvoAmb) {
      var id = alvoAmb.getAttribute('data-id'), a = M.proj.ambientes.filter(function (x) { return x.id === id; })[0]; if (!a) return;
      PLAN.selecionar(id); titulo = a.nome;
      var bloqA = alvoAmb.classList.contains('bloq');
      it('Renomear', function () { renomearInline(id, e.clientX, e.clientY); });
      itens.push({tipos:true});
      if (!bloqA) {
        it('Mobiliar só este ambiente', function () { mobiliarAmbiente(id); });
        it('Duplicar', function () { duplicar(id); });
        it('Girar 90°', function () { var w = a.w; a.w = a.h; a.h = w; M.commit('Girar ambiente'); PLAN.render(); inspector(); });
        if (a.tipo === 'agua') it('Piscina: raias e profundidade', function () { irPara('piscina'); });
        if (M.nPavs() > 1) for (var pv = 0; pv < M.nPavs(); pv++) if (pv !== M.pavDe(a)) (function (pv2) { it('Enviar para ' + M.nomePav(pv2), function () { a.pav = pv2 || undefined; if (!pv2) delete a.pav; (M.proj.moveis || []).forEach(function (m) { if (m.amb === a.id) { if (pv2) m.pav = pv2; else delete m.pav; } }); M.commit('Mudar andar'); M.setPav(pv2); irPara('planta'); }); })(pv);
        it('Excluir', function () { excluir(id); }, 'danger');
      } else it('Desbloquear camada', function () { M.setCamada('ambientes', 'bloq', false); M.setCamada('piscina', 'bloq', false); M.salvar(); PLAN.render(); });
    } else {
      titulo = 'Aqui (' + M.fmtMs(p.x) + ' ; ' + M.fmtMs(p.y) + ' m)';
      it('Adicionar ambiente aqui…', function () { escolherAmbiente(e.clientX, e.clientY, p); });
      it('Copiar planta de uma foto…', function () { $('#foto-in').click(); });
      it('Mobiliar (catálogo)', function () { toggleCatalogo(true); });
      it('Mobiliar tudo automaticamente', function () { M.mobiliarAuto(); M.commit('Mobiliar automaticamente'); PLAN.render(); inspector(); });
      it('Enquadrar', function () { PLAN.enquadrar(); PLAN.render(); });
      it('Selecionar tudo do andar', function () { var tudo = M.ambsPav(M.pav).map(function (a) { return {t:'amb', id:a.id}; }); if (tudo.length) PLAN.setMulti(tudo); });
      if (M.podeUndo()) it('Desfazer: ' + M.proxUndo(), function () { fazerUndo(); });
    }
    var c = document.getElementById('ctx');
    if (!c) { c = document.createElement('div'); c.id = 'ctx'; c.className = 'ctx'; document.body.appendChild(c); }
    var h = '<div class="ctx-hd">' + esc(titulo) + '</div>';
    itens.forEach(function (x, i) {
      if (x.tipos) { var a2 = PLAN.atual(); h += '<div class="ctx-tipos">' + Object.keys(M.TIPOS).map(function (k) { return '<button class="chip' + (a2 && a2.tipo === k ? ' on' : '') + '" data-tipo="' + k + '" style="--c:' + M.TIPOS[k].cor + '"><i></i>' + M.TIPOS[k].rot + '</button>'; }).join('') + '</div>'; return; }
      h += '<button class="ctx-it ' + x.cls + '" data-i="' + i + '">' + esc(x.rot) + '</button>';
    });
    c.innerHTML = h; c.hidden = false;
    c.style.left = Math.min(window.innerWidth - 250, e.clientX + 2) + 'px'; c.style.top = Math.min(window.innerHeight - 40 - itens.length * 32, e.clientY + 2) + 'px';
    c.querySelectorAll('.ctx-it').forEach(function (b) { b.onclick = function () { c.hidden = true; itens[+b.getAttribute('data-i')].fn(); }; });
    c.querySelectorAll('[data-tipo]').forEach(function (b) { b.onclick = function () { var a3 = PLAN.atual(); if (a3) { a3.tipo = b.getAttribute('data-tipo'); M.commit('Mudar tipo'); PLAN.render(); inspector(); } c.hidden = true; }; });
  }
  var trocaMovel = null;   /* "Trocar por outro…": o próximo item do catálogo substitui este móvel */
  function mobiliarAmbiente(id){
    if (!window.MOVEIS) return;
    var antes = (M.proj.moveis || []).filter(function (m) { var a = M.ambienteDe(m); return !a || a.id !== id; });
    var todos = M.mobiliarAuto(), novos = todos.filter(function (m) { var a = M.ambienteDe(m); return a && a.id === id; });
    M.proj.moveis = antes.concat(novos); M.commit('Mobiliar ambiente'); PLAN.render(); inspector();
    toast(novos.length + (novos.length === 1 ? ' móvel colocado.' : ' móveis colocados.'), function () { fazerUndo(); });
  }
  /* mini-biblioteca no ponto clicado: escolhe o ambiente e ele nasce ali */
  function escolherAmbiente(cx, cy, p){
    var c = document.getElementById('ctx');
    var h = '<div class="ctx-hd">Adicionar ambiente aqui</div><div class="ctx-lib">' + M.LIB.map(function (l, i) { return '<button data-lib="' + i + '"><span class="sw" style="background:' + M.TIPOS[l.tipo].cor + '"></span>' + esc(l.nome) + '</button>'; }).join('') + '</div>';
    c.innerHTML = h; c.hidden = false;
    c.querySelectorAll('[data-lib]').forEach(function (b) { b.onclick = function () {
      var l = M.LIB[+b.getAttribute('data-lib')], t = M.proj.terreno;
      var a = {id:M.uid(), nome:l.nome, tipo:l.tipo, w:l.w, h:l.h, x:Math.max(0, Math.min(t.largura - l.w, Math.round((p.x - l.w / 2) / 5) * 5)), y:Math.max(0, Math.min(t.profundidade - l.h, Math.round((p.y - l.h / 2) / 5) * 5))};
      if (M.pav) a.pav = M.pav;
      M.proj.ambientes.push(a); M.commit('Adicionar ' + l.nome); PLAN.render(); PLAN.selecionar(a.id); c.hidden = true;
    }; });
  }

  function setFachada(k, v){
    if (k === 'estilo') M.proj.fachada = {estilo:v, numero:(M.proj.fachada || {}).numero || ''};   /* trocar de estilo zera as escolhas manuais */
    else { M.proj.fachada = M.proj.fachada || {}; M.proj.fachada[k] = v; }
    M.commit('Fachada: ' + k);   /* onChange reconstrói o 3D */
    fachPanel();
    var e = document.querySelector('#fach-elev-pad'); if (e && !e.hidden) e.innerHTML = VIEWS.fachada();
  }
  /* fotografa a casa nos 4 estilos, lado a lado, com o custo de cada um */
  function compararEstilos(){
    if (!t3) return;
    var orig = M.proj.fachada ? JSON.parse(JSON.stringify(M.proj.fachada)) : null, fotos = [];
    var noiteAntes = t3.noite;
    Object.keys(TRES.FACHADA_PRESETS).forEach(function (k) {
      M.proj.fachada = {estilo:k, numero:(orig || {}).numero || ''};
      t3.atualizar(); t3.verFachada(true);
      fotos.push({k:k, rot:TRES.FACHADA_PRESETS[k].rot, desc:TRES.FACHADA_PRESETS[k].desc, img:t3.foto(), custo:M.custoFachada()});
    });
    M.proj.fachada = orig; t3.atualizar(); t3.verFachada(true);
    var ov = $('#estilos'), F = TRES.fachadaDe(M.proj);
    ov.innerHTML = '<div class="estilos-box"><div class="estilos-hd"><h3>Sua casa nos ' + fotos.length + ' estilos</h3><p>Mesma planta, mesma rua' + (noiteAntes ? ', à noite' : '') + '. Clique no que mais combina com você.</p><button class="icon-btn" id="estilos-x">✕</button></div><div class="estilos-grid">' +
      fotos.map(function (f) { return '<button class="estilo-foto' + (F.estilo === f.k ? ' on' : '') + '" data-est="' + f.k + '"><img src="' + f.img + '" alt="' + f.rot + '"><div class="leg"><b>' + f.rot + '</b><span>' + f.desc + '</span><em>' + M.fmtBRL(f.custo) + '</em></div></button>'; }).join('') + '</div></div>';
    ov.hidden = false;
    ov.querySelector('#estilos-x').onclick = function () { ov.hidden = true; };
    ov.querySelectorAll('[data-est]').forEach(function (b) { b.onclick = function () { ov.hidden = true; setFachada('estilo', b.getAttribute('data-est')); toast('Estilo ' + TRES.FACHADA_PRESETS[b.getAttribute('data-est')].rot + ' aplicado. Ctrl+Z volta.'); }; });
  }

  /* HTML autocontido com o passeio: three.js pela CDN, motor embutido pelo toString, projeto inline */
  function htmlPasseio(){
    var p = M.proj, t = p.terreno;
    var quartos = p.ambientes.filter(function (a) { return a.tipo === 'intimo'; }).length;
    var css = '*{box-sizing:border-box;margin:0;padding:0}html{scroll-behavior:smooth}body{font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#041D31;color:#E6EDF3;-webkit-font-smoothing:antialiased}' +
      '.hero{min-height:88vh;display:flex;flex-direction:column;justify-content:flex-end;padding:0 6vw 10vh;background:radial-gradient(90% 70% at 78% 8%,#0d3350 0%,#041D31 60%)}' +
      '.hero .k{font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.24em;color:#7FD6E8;margin-bottom:18px}.hero h1{font-size:clamp(2.2rem,6vw,4.4rem);font-weight:600;letter-spacing:-.03em;line-height:1.04}' +
      '.hero p{font-size:1.05rem;line-height:1.65;color:#B7C8D5;max-width:60ch;margin-top:18px}.hero .seta{margin-top:40px;font-size:12px;color:#7FD6E8;letter-spacing:.2em}' +
      '.tp{position:relative}.tp-sticky{position:sticky;top:0;height:100vh;overflow:hidden;background:#D9E7F2}.t3-canvas{display:block;width:100%;height:100%;outline:none;touch-action:pan-y}' +
      '.t3-cap{position:absolute;left:5vw;bottom:8vh;max-width:min(520px,80vw);padding:22px 26px;background:rgba(4,29,49,.78);backdrop-filter:blur(10px);border-left:3px solid #7FD6E8;border-radius:0 12px 12px 0;color:#E6EDF3;opacity:0;transform:translateY(12px);transition:opacity .5s,transform .5s;pointer-events:none}' +
      '.t3-cap.show{opacity:1;transform:none}.t3-cap .k{font-family:ui-monospace,monospace;font-size:10.5px;letter-spacing:.2em;color:#7FD6E8}.t3-cap h3{font-size:clamp(1.4rem,3.2vw,2.2rem);font-weight:600;letter-spacing:-.02em;margin:6px 0 8px}.t3-cap p{font-size:1rem;line-height:1.5;color:#C6D3DC}' +
      '.tp-dots{position:absolute;right:18px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:8px}.tp-dots i{width:6px;height:6px;border-radius:50%;background:rgba(4,29,49,.25);transition:.2s}.tp-dots i.on{background:#041D31;transform:scale(1.5)}' +
      '.tp-dica{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#041D31;opacity:.75;transition:opacity .4s;white-space:nowrap}.tp-dica.off{opacity:0}' +
      'section{padding:12vh 6vw;max-width:1180px;margin:0 auto}.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1px;background:rgba(127,214,232,.15);border:1px solid rgba(127,214,232,.15);border-radius:12px;overflow:hidden}' +
      '.stats div{background:#041D31;padding:22px 20px}.stats b{display:block;font-family:ui-monospace,monospace;font-size:1.4rem;color:#fff}.stats span{display:block;font-size:10px;letter-spacing:.2em;color:#7FA3B5;margin-top:6px}' +
      'footer{padding:40px 6vw;border-top:1px solid rgba(127,214,232,.15);font-size:12px;line-height:1.7;color:#8FA3B1}footer b{display:block;font-family:ui-monospace,monospace;font-size:10.5px;letter-spacing:.16em;color:#FFC24D;margin-bottom:8px}' +
      '@media(prefers-reduced-motion:reduce){*{transition:none!important}}';
    var shim = 'var M={proj:' + JSON.stringify(p, function (k, v) { return k === 'renders' || k === 'versoes' ? undefined : v; }) + ',TIPOS:' + JSON.stringify(M.TIPOS) + ',' +
      'movelDe:function(id){return (M.proj.moveis||[]).filter(function(m){return m.id===id})[0]||null},' +
      'escada:function(){return ' + JSON.stringify(M.escada()) + '},' +
      'areaOf:function(a){return a.w*a.h},num:function(n){return Number(n).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})},' +
      'fmtM:function(cm){return M.num(cm/100)+" m"},fmtM2:function(c){return M.num(c/10000)+" m²"},fmtPct:function(n){return M.num(n)+"%"},' +
      'areaConstruida:function(){return M.proj.ambientes.filter(function(a){return a.tipo!=="externo"&&a.tipo!=="agua"}).reduce(function(s,a){return s+a.w*a.h},0)},' +
      'ocupacao:function(){var t=M.proj.terreno.largura*M.proj.terreno.profundidade;return t?M.areaConstruida()/t*100:0}};';
    function st(k, v){ return '<div><b>' + v + '</b><span>' + k + '</span></div>'; }
    return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(p.nome) + ' — passeio 3D</title><style>' + css + '</style></head><body>' +
      '<div class="hero"><div class="k">SUA OBRA 3D · TERRENO ' + M.fmtMs(t.largura) + ' × ' + M.fmtMs(t.profundidade) + ' M</div><h1>' + esc(p.nome) + '</h1>' +
      '<p>' + M.fmtM2(M.areaConstruida()) + ' de área construída' + (quartos ? ', ' + quartos + (quartos > 1 ? ' quartos' : ' quarto') : '') + ', ' + p.ambientes.length + ' ambientes. Role para entrar.</p><div class="seta">↓ ROLE</div></div>' +
      '<div id="passeio"></div>' +
      '<section><div class="stats">' + st('TERRENO', M.fmtM2(M.areaTerreno())) + st('ÁREA CONSTRUÍDA', M.fmtM2(M.areaConstruida())) + st('OCUPAÇÃO', M.fmtPct(M.ocupacao())) + st('AMBIENTES', p.ambientes.length) + '</div></section>' +
      '<footer><b>ESTUDO CONCEITUAL PRELIMINAR</b>Representação conceitual para estudo de implantação e dimensionamento. Não substitui projeto executivo, licenciamento ou ART/RRT. Gerado pelo SUA OBRA 3D a partir da planta.</footer>' +
      '<script src="https://unpkg.com/three@0.158.0/build/three.min.js"><\/script>' +
      '<script>' + shim + '\nvar MOVEIS_LIB=' + MOVEIS_LIB.toString() + ';var MOVEIS=MOVEIS_LIB();\nvar TRES_ENGINE=' + TRES_ENGINE.toString() + ';\nvar TRES=TRES_ENGINE(THREE,M);TRES.passeio(document.getElementById("passeio"),{scroller:window});if(location.hash.indexOf("#s=")===0)setTimeout(function(){scrollTo(0,+location.hash.slice(3))},1200);<\/script>' +
      '</body></html>';
  }

  /* ================= APRESENTAÇÃO / EXPORT ================= */
  function abrirApres(){
    var ap = $('#apres');
    if (t3Apres) { t3Apres.desmontar(); t3Apres = null; }
    ap.innerHTML = VIEWS.apresentacao();
    ap.hidden = false;
    ap.scrollTop = 0;
    var alvo = ap.querySelector('#ap-3d');
    if (alvo && window.TRES) t3Apres = TRES.passeio(alvo, {scroller: ap});
    else if (alvo) alvo.remove();
  }
  function fecharApres(){ $('#apres').hidden = true; if (t3Apres) { t3Apres.desmontar(); t3Apres = null; } }

  function exportar(tipo){
    if (tipo === 'apres') { abrirApres(); return; }
    if (tipo === 'pdf')   { window.print(); return; }
    if (tipo === 'html') {
      if (!window.TRES) { toast('O motor 3D não carregou.', null, true); return; }
      baixar(new Blob([htmlPasseio()], {type:'text/html'}), slug() + '-passeio-3d.html');
      toast('Passeio 3D exportado. Abre em qualquer navegador com internet.'); return;
    }
    if (tipo === 'json') {
      baixar(new Blob([JSON.stringify(M.proj, null, 2)], {type:'application/json'}), slug() + '.json');
      toast('Projeto exportado.'); return;
    }
    if (tipo === 'csv') {
      var oc = M.orcamento(), csv = 'Etapa;Grupo;Item;Base;Valor (R$)\n';
      oc.linhas.forEach(function (l) { csv += [M.ETAPAS_OBRA[l.etapa], l.grupo, l.rot, l.base, M.num(l.valor / 100)].map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(';') + '\n'; });
      csv += ';;Subtotal;;' + M.num(oc.subtotal / 100) + '\n;;Reserva técnica ' + M.fmtPct(oc.reservaPct) + ';;' + M.num(oc.reserva / 100) + '\n;;TOTAL;;' + M.num(oc.total / 100) + '\n';
      baixar(new Blob(['\ufeff' + csv], {type:'text/csv;charset=utf-8'}), slug() + '-orcamento.csv');
      toast('Orçamento exportado em CSV (abre no Excel).'); return;
    }
    if (tipo === 'txt') {
      var L = [M.proj.nome.toUpperCase(), 'ESTUDO CONCEITUAL PRELIMINAR — SUA OBRA 3D', new Date().toLocaleString('pt-BR'), ''];
      M.relatorio().forEach(function (l) { L.push(l[0] + ': ' + l[1]); });
      L.push('', 'AMBIENTES'); M.proj.ambientes.forEach(function (a) { L.push('- ' + a.nome + (M.nPavs() > 1 ? ' (' + M.nomePav(M.pavDe(a)) + ')' : '') + ': ' + M.fmtM(a.w) + ' × ' + M.fmtM(a.h) + ' = ' + M.fmtM2(M.areaOf(a))); });
      if ((M.proj.cotas || []).length) { L.push('', 'COTAS LIVRES'); M.proj.cotas.forEach(function (c) { L.push('- ' + c.nome + ': ' + M.fmtM(c.cm) + (c.obs ? ' (' + c.obs + ')' : '')); }); }
      L.push('', 'ALERTAS'); alertasTodos().forEach(function (q) { L.push('[' + q.nivel.toUpperCase() + '] ' + q.msg); });
      L.push('', 'Este material é uma representação conceitual para estudo. Não substitui projeto executivo, licenciamento ou ART/RRT.');
      baixar(new Blob([L.join('\n')], {type:'text/plain;charset=utf-8'}), slug() + '-relatorio.txt');
      toast('Relatório exportado.'); return;
    }
    var svgTxt = VIEWS.miniPlanta({labels:true});
    if (tipo === 'svg') {
      baixar(new Blob([svgTxt], {type:'image/svg+xml'}), slug() + '-planta.svg');
      toast('Planta exportada em SVG.'); return;
    }
    if (tipo === 'png') {
      var t = M.proj.terreno, W = 1800, H = Math.round(W * (t.profundidade + 120) / (t.largura + 120));
      var img = new Image();
      img.onload = function () {
        var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
        var cx = cv.getContext('2d');
        cx.fillStyle = '#FFFFFF'; cx.fillRect(0, 0, W, H);
        cx.drawImage(img, 0, 0, W, H);
        cv.toBlob(function (b) { baixar(b, slug() + '-planta.png'); toast('Planta exportada em PNG.'); });
      };
      img.onerror = function () { toast('Não consegui gerar o PNG. Use o SVG.', null, true); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgTxt);
    }
  }
  function slug(){
    return (M.proj.nome || 'projeto').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  function baixar(blob, nome){
    var u = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = u; a.download = nome; a.click();
    setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
  }

  /* ================= FEEDBACK ================= */
  var toastT = null;
  function toast(msg, desfazer, erro, rotulo){   /* rotulo: texto do botão de ação (padrão "Desfazer") */
    var t = $('#toast');
    t.className = 'toast' + (erro ? ' err' : '');
    t.innerHTML = esc(msg) + (desfazer ? ' <span class="u">' + esc(rotulo || 'Desfazer') + '</span>' : '');
    t.hidden = false;
    if (desfazer) t.querySelector('.u').onclick = function () { desfazer(); t.hidden = true; };
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.hidden = true; }, desfazer ? 6000 : 3200);
  }
  function saveState(txt){ var e = $('#save-state'); if (e) e.textContent = txt; }
  function zoomLabel(v){ var e = $('#st-zoom'); if (e) e.textContent = Math.round(v) + '%'; }
  function coord(x, y){ var e = $('#st-coord'); if (e) e.textContent = M.fmtMs(x) + ' ; ' + M.fmtMs(y); }
  function hud(txt){
    var e = $('#hud'); if (!e) return;
    if (txt) { e.textContent = txt; e.classList.add('on'); } else e.classList.remove('on');
  }
  function msg(txt){ var e = $('#st-msg'); if (e) { e.textContent = txt || ''; if (txt) setTimeout(function () { e.textContent = ''; }, 4000); } }

  /* onboarding de 20 segundos, sobre a tela real */
  function coach(){
    if (localStorage.getItem('suaobra3d.coach')) return;
    var c = $('#coach');
    c.innerHTML =
      '<div class="tip" style="left:290px;top:130px"><b>1 · ARRASTAR</b>Pegue um ambiente e leve para onde quiser. Ele gruda nos vizinhos.</div>' +
      '<div class="tip" style="left:290px;top:250px"><b>2 · MEDIDA</b>Clique em cima de um número de cota e digite a medida nova.</div>' +
      '<div class="tip" style="right:320px;top:130px"><b>3 · TUDO</b>Ctrl+K faz qualquer coisa sem procurar no menu.</div>' +
      '<button class="btn solid close">Entendi</button>';
    c.hidden = false;
    c.querySelector('.close').onclick = function () {
      c.hidden = true; localStorage.setItem('suaobra3d.coach', '1');
    };
  }

  function esc(s){ return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  return {
    boot:boot, irPara:irPara, inspector:inspector, refreshTop:refreshTop, setTool:setTool,
    editarCota:editarCota, renomearInline:renomearInline, addRoomDefault:addRoomDefault,
    radial:radial, addMovel:addMovel, acaoMovel:acaoMovel, toggleCatalogo:toggleCatalogo, htmlPasseio:htmlPasseio,
    selTap:selTap, fecharInsp:function(){ setInsp(false); }, get t3(){ return t3; },
    toast:toast, saveState:saveState, zoomLabel:zoomLabel, coord:coord, hud:hud, msg:msg, menuContexto:menuContexto, fecharPop:fecharPop, copiarDeFoto:copiarDeFoto, pedirChave:pedirChave, popFachada:popFachada,
    closeOverlays:closeOverlays, fecharApres:fecharApres, abrirApres:abrirApres, exportar:exportar,
    get shift(){ return shift; }, get alt(){ return alt; }, get espaco(){ return espaco; }
  };
})();
document.addEventListener('DOMContentLoaded', function () { UI.boot(); });
