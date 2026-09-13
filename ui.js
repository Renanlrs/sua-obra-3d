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
    M.onChange(function () { refreshTop(); if (t3) t3.atualizar(); });

    $('#btn-criar').onclick = criarDaHome;
    $('#btn-home').onclick = voltarHome;
    $('#btn-undo').onclick = function () { fazerUndo(); };
    $('#btn-redo').onclick = function () { fazerRedo(); };
    $('#btn-cmdk').onclick = abrirCmdk;
    $('#btn-ajuda').onclick = abrirAjuda;
    $('#btn-apresentar').onclick = abrirApres;
    $('#btn-collapse').onclick = function () { document.getElementById('app').classList.toggle('side-off'); PLAN.render(); };
    $('#btn-fit').onclick = function () { PLAN.enquadrar(); PLAN.render(); };
    $('#btn-grid').onclick = function () { this.classList.toggle('on', PLAN.toggleGrid()); };
    $('#btn-cotas').onclick = function () { this.classList.toggle('on', PLAN.toggleCotas()); };
    $('#btn-mob').onclick = function () { toggleCatalogo(); };
    document.querySelectorAll('#pill23 button').forEach(function (b) { b.onclick = function () { irPara(b.getAttribute('data-v')); }; });
    document.addEventListener('pointerdown', function (e) {
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

    /* ?demo=casa-terrea&l=10&p=25&v=planta — abre direto, para conferência e print */
    var q = new URLSearchParams(location.search);
    if (q.has('demo')) {
      var k = q.get('demo') || 'casa-terrea';
      M.novo(M.PROGRAMAS[k] ? k : 'casa-terrea', M.parseM(q.get('l') || '10') , M.parseM(q.get('p') || '25'));
      localStorage.setItem('suaobra3d.coach', '1');
      entrarApp();
      if (q.get('v')) irPara(q.get('v'));
      if (t3) {   /* &t3=tour&i=3&teto=0&etapa=2 — para conferência e print */
        if (q.get('teto') === '0') t3.setTeto(false);
        if (q.get('luz')) { var L = q.get('luz').split(',').map(Number); t3.luz(L[0], L[1], L[2]); }
        if (q.has('etapa')) t3.setEtapa(+q.get('etapa'));
        if (q.get('t3') === 'tour') { t3.setModo('tour'); t3.irParada(+(q.get('i') || 0), true); }
        else if (q.get('t3')) t3.setModo(q.get('t3'));
      }
      /* &cat=1 abre o catálogo · &selmov=N seleciona o N-ésimo móvel e enquadra o ambiente dele · &catk=quarto abre uma categoria */
      if (q.has('cat')) { toggleCatalogo(true); if (q.get('catk')) { catCat = q.get('catk'); catalogo(); } }
      if (q.has('selmov')) {
        var mvq = M.proj.moveis[+q.get('selmov') || 0];
        if (mvq) { var ambq = M.ambienteDe(mvq); if (ambq && viewAtual === 'planta') PLAN.enquadrarAmb(ambq); selecionarMovel(mvq.id); }
      }
      if (q.get('estilo')) { M.proj.fachada = {estilo:q.get('estilo'), numero:q.get('num') || ''}; if (t3) t3.atualizar(); if (viewAtual === 'fachada') { fachPanel(); t3.verFachada(true); } }
      if (q.get('fprompt') && viewAtual === 'fachada') { fachadaPorPrompt(q.get('fprompt')); var pq = document.querySelector('#fach-prompt'); if (pq) pq.value = q.get('fprompt'); }
      if (q.has('noite') && t3) t3.setNoite(true);
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
  }
  function voltarHome(){
    fecharApres();
    $('#app').hidden = true; $('#home').hidden = false;
    montarHome();
  }

  /* ================= NAVEGAÇÃO ================= */
  function irPara(v){
    viewAtual = v;
    if (t3) { t3.desmontar(); t3 = null; }
    document.querySelectorAll('.side a').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-view') === v); });
    $('#tools').hidden = v !== 'planta';
    $('#empty').hidden = true;
    $('#pill23').hidden = v !== 'planta' && v !== 'tresd';
    $('#app').setAttribute('data-view', v);
    document.querySelectorAll('#pill23 button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-v') === v); });
    if (v !== 'planta' && v !== 'tresd') { $('#catalogo').hidden = true; $('#btn-mob').classList.remove('on'); }
    $('#radial').hidden = true;

    if (v === 'planta') {
      stage.hidden = false;
      var old = canvasWrap.querySelector('.view-pad'); if (old) old.remove();
      PLAN.montar(stage); PLAN.enquadrar(); PLAN.render();
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

  function conteudoView(v){
    var p = M.proj;
    if (v === 'ambientes') {
      var h = '<h2>Ambientes</h2><p class="vsub">' + p.ambientes.length + ' ambientes · ' + M.fmtM2(M.areaTotalAmbientes()) + ' no total. Clique para selecionar na planta.</p>';
      h += '<table class="tbl"><tr><th>AMBIENTE</th><th>TIPO</th><th class="n">LARGURA</th><th class="n">PROFUND.</th><th class="n">ÁREA</th><th class="n">CUSTO</th><th></th></tr>';
      p.ambientes.forEach(function (a) {
        var ti = M.TIPOS[a.tipo] || M.TIPOS.social;
        h += '<tr data-id="' + a.id + '"><td><span class="sw" style="background:' + ti.cor + '"></span>' + esc(a.nome) + '</td>' +
          '<td>' + ti.rot + '</td><td class="n">' + M.fmtM(a.w) + '</td><td class="n">' + M.fmtM(a.h) + '</td>' +
          '<td class="n">' + M.fmtM2(M.areaOf(a)) + '</td><td class="n">' + M.fmtBRL(M.custoDe(a)) + '</td>' +
          '<td class="n"><button data-del="' + a.id + '" title="Excluir">✕</button></td></tr>';
      });
      h += '<tr class="tot"><td colspan="4">TOTAL</td><td class="n">' + M.fmtM2(M.areaTotalAmbientes()) + '</td><td class="n">' + M.fmtBRL(M.custoTotal()) + '</td><td></td></tr></table>';
      h += '<h2 style="margin-top:32px;font-size:15px">Adicionar da biblioteca</h2><div class="lib">';
      M.LIB.forEach(function (l, i) {
        var ti = M.TIPOS[l.tipo];
        h += '<button data-lib="' + i + '"><span class="sw" style="background:' + ti.cor + '"></span>' + l.nome + '</button>';
      });
      return h + '</div>';
    }
    if (v === 'pavimentos') {
      return '<h2>Pavimentos</h2><p class="vsub">Esta versão trabalha com um pavimento. O terreno e o pé-direito estão no inspector, à direita.</p>' +
        '<div class="cards">' +
        card(M.fmtM2(M.areaTerreno()), 'TERRENO') + card(M.fmtM2(M.areaConstruida()), 'ÁREA CONSTRUÍDA') +
        card(M.fmtPct(M.ocupacao()), 'TAXA DE OCUPAÇÃO') + card(M.fmtM(p.peDireito), 'PÉ-DIREITO') + '</div>';
    }
    if (v === 'tresd') {
      if (!window.TRES) return '<h2>3D</h2><p class="vsub">O motor 3D não carregou (three.min.js ausente).</p><div style="height:60%">' + VIEWS.iso() + '</div>';
      return '<div class="t3-bar">' +
        '<div class="seg" id="t3-modos"><button data-modo="orbit" class="on" title="Arraste para girar · roda para aproximar · botão direito move">Girar</button>' +
        '<button data-modo="walk" title="W A S D anda · arraste para olhar">Andar</button>' +
        '<button data-modo="tour" title="Cômodo a cômodo · setas ou roda do mouse">Passeio</button></div>' +
        '<span class="sep"></span>' +
        '<button class="tg on" id="t3-teto" title="Mostrar ou esconder a laje">Teto</button>' +
        '<span class="sep"></span>' +
        '<label class="etapa" title="Etapas da obra (4D)">OBRA <input type="range" id="t3-etapa" min="0" max="5" step="1" value="5"><b id="t3-etapa-v">Acabamento</b></label>' +
        '<span class="grow"></span>' +
        '<button class="tg" id="t3-mob" title="Catálogo de móveis (M)">Mobiliar</button>' +
        '<select id="t3-amb" title="Ir para um ambiente"><option value="">Ir para…</option></select>' +
        '<button class="btn ghost sm" id="t3-foto" title="Salvar a imagem atual em PNG">Foto</button>' +
        '</div>' +
        '<div class="t3-stage" id="t3-stage">' +
        '<div class="t3-nav" id="t3-nav" hidden><button id="t3-ant" title="Anterior (←)">‹</button><button id="t3-auto" title="Passeio automático">▶</button><button id="t3-prox" title="Próximo (→)">›</button></div>' +
        '<div class="t3-dica" id="t3-dica">Arraste para girar · roda para aproximar · duplo clique num ambiente para entrar</div>' +
        '</div>';
    }
    if (v === 'fachada') {
      if (!window.TRES) return '<h2>Fachada frontal</h2><p class="vsub">Montada dos ambientes que fazem frente para a rua.</p><div style="height:calc(100% - 90px);min-height:360px">' + VIEWS.fachada() + '</div>';
      return '<div class="t3-bar">' +
        '<b class="fach-titulo">Fachada</b>' +
        '<span class="sep"></span>' +
        '<div class="seg" id="fach-hora"><button data-hora="dia" class="on" title="Ver de dia">☀ Dia</button><button data-hora="noite" title="Ver à noite, com as luzes acesas">☾ Noite</button></div>' +
        '<button class="tg" id="fach-elev" title="Elevação frontal em desenho técnico">Elevação</button>' +
        '<span class="grow"></span>' +
        '<button class="btn solid sm" id="fach-4" title="Fotografa a sua casa nos 4 estilos, lado a lado">✨ Ver os 4 estilos</button>' +
        '<button class="btn ghost sm" id="fach-foto" title="Salvar a imagem atual em PNG">Foto</button>' +
        '</div>' +
        '<div class="fach-body"><div class="t3-stage" id="fach-stage"><div class="fach-elev" id="fach-elev-pad" hidden></div><div class="t3-dica">Arraste para girar · roda para aproximar</div></div>' +
        '<aside class="fach-panel" id="fach-panel"></aside></div>';
    }
    if (v === 'corte')   return '<h2>Corte longitudinal</h2><p class="vsub">Seção no meio do terreno, no sentido da profundidade.</p><div style="height:calc(100% - 90px);min-height:360px">' + VIEWS.corte() + '</div>';

    if (v === 'orcamento') {
      var h2 = '<h2>Orçamento estimado</h2><p class="vsub">Custo por m² por tipo de ambiente, no padrão <b>' + M.PADROES[p.padrao].rot + '</b>. Estimativa de estudo, não substitui orçamento de construtor.</p>';
      h2 += '<div class="cards">' + card(M.fmtBRL(M.custoGeral()), 'INVESTIMENTO ESTIMADO') +
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
      h2 += '<tr class="tot"><td>TOTAL GERAL</td><td class="n"></td><td></td><td class="n">' + M.fmtBRL(M.custoGeral()) + '</td></tr></table>';
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
      var meta = p.meta || Math.round(M.custoTotal() * 0.8);
      var h3 = '<h2>Simulador</h2><p class="vsub">Mexa e veja o efeito no custo. Nada aqui altera a planta sozinho.</p>';
      h3 += '<div class="cards">' + card(M.fmtBRL(M.custoTotal()), 'ESTIMADO') + card(M.fmtBRL(meta), 'SUA META') +
        card(M.fmtBRL(Math.abs(M.custoTotal() - meta)), M.custoTotal() > meta ? 'FALTAM' : 'SOBRAM') + '</div>';
      h3 += '<div class="sim-row"><b>Padrão de acabamento</b><div>' +
        Object.keys(M.PADROES).map(function (k) {
          return '<button class="chip' + (p.padrao === k ? ' on' : '') + '" data-padrao="' + k + '" style="margin-right:6px">' + M.PADROES[k].rot + '</button>';
        }).join('') + '</div><div class="v">' + M.fmtBRL(M.custoPorM2()) + '/m²</div></div>';
      h3 += '<div class="sim-row"><b>Meta de investimento</b><input class="range" id="sim-meta" type="range" min="0" max="' +
        Math.max(100000, Math.round(M.custoTotal() / 100 * 1.5)) + '" step="5000" value="' + Math.round(meta / 100) + '"><div class="v" id="sim-meta-v">' + M.fmtBRL(meta) + '</div></div>';
      h3 += '<div class="sim-row"><b>Pé-direito</b><input class="range" id="sim-pd" type="range" min="240" max="400" step="5" value="' + p.peDireito + '"><div class="v" id="sim-pd-v">' + M.fmtM(p.peDireito) + '</div></div>';
      if (M.custoTotal() > meta) {
        var excedente = M.custoTotal() - meta;
        var m2cortar = M.custoPorM2() ? excedente / M.custoPorM2() : 0;
        h3 += '<div class="alertbox"><b>PARA CABER NA META</b><p>Seria preciso cortar cerca de <b>' + M.num(m2cortar) +
          ' m²</b> de área construída, ou descer um padrão de acabamento. O app não encolhe o projeto sozinho — a decisão é sua.</p></div>';
      }
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
        '</div><p class="vsub" style="margin-top:26px">O arquivo .json guarda o projeto inteiro e pode ser reaberto aqui depois.</p>';
    }
    return '';
  }
  function card(v, k){ return '<div class="c"><b>' + v + '</b><span>' + k + '</span></div>'; }

  function ligarView(v, pad){
    if (v === 'tresd' && window.TRES) { ligar3D(pad); return; }
    if (v === 'fachada' && window.TRES) { ligarFachada(pad); return; }
    if (v === 'ambientes') {
      pad.querySelectorAll('tr[data-id]').forEach(function (tr) {
        tr.onclick = function (e) {
          if (e.target.getAttribute('data-del')) return;
          PLAN.selecionar(tr.getAttribute('data-id')); irPara('planta');
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
    }
    if (v === 'exportar') {
      pad.querySelectorAll('[data-exp]').forEach(function (b) {
        b.onclick = function () { exportar(b.getAttribute('data-exp')); };
      });
    }
  }

  /* ================= INSPECTOR ================= */
  function inspector(){
    var a = PLAN.atual(), p = M.proj, h = '', mv = PLAN.movAtual();
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
        kv('Investimento', M.fmtBRL(M.custoGeral()), 'ambientes ' + M.fmtBRL(M.custoTotal()) + ' + fachada ' + M.fmtBRL(M.custoFachada())) +
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
      insp.querySelectorAll('[data-tipo]').forEach(function (b) {
        b.onclick = function () { a.tipo = b.getAttribute('data-tipo'); M.commit('Mudar tipo'); PLAN.render(); inspector(); };
      });
      insp.querySelectorAll('[data-act]').forEach(function (b) {
        b.onclick = function () {
          var k = b.getAttribute('data-act');
          if (k === 'dup') duplicar(a.id);
          if (k === 'rot') { var w = a.w; a.w = a.h; a.h = w; M.commit('Girar ambiente'); PLAN.render(); inspector(); }
          if (k === 'del') excluir(a.id);
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
      b.onclick = function () { var o = ondeNasce(); addMovel(b.getAttribute('data-k'), o.x, o.y); };
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
    /* empurra para baixo até não sobrepor ninguém */
    var tent = 0;
    while (tent++ < 200 && M.proj.ambientes.some(function (o) {
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
    {n:'3D / volumetria',     g:'3',      f:function(){ irPara('tresd'); }},
    {n:'Passeio 3D pela casa', g:'',       f:function(){ irPara('tresd'); if (t3) t3.setModo('tour'); }},
    {n:'Exportar passeio 3D (.html)', g:'', f:function(){ exportar('html'); }},
    {n:'Mobiliar (catálogo de móveis)', g:'M', f:function(){ if (viewAtual !== 'planta' && viewAtual !== 'tresd') irPara('planta'); toggleCatalogo(true); }},
    {n:'Mobiliar automaticamente', g:'', f:function(){ M.mobiliarAuto(); M.commit('Mobiliar automaticamente'); if (viewAtual === 'planta') PLAN.render(); inspector(); toast(M.proj.moveis.length + ' móveis colocados.'); }},
    {n:'Ver em 2D (planta)',   g:'2',      f:function(){ irPara('planta'); }},
    {n:'Fachada',             g:'F',      f:function(){ irPara('fachada'); }},
    {n:'Fachada à noite',     g:'',       f:function(){ irPara('fachada'); if (t3) t3.setNoite(true); }},
    {n:'Criar fachada por prompt', g:'',  f:function(){ irPara('fachada'); setTimeout(function(){ var p = document.querySelector('#fach-prompt'); if (p) p.focus(); }, 60); }},
    {n:'Ver a casa nos 4 estilos de fachada', g:'', f:function(){ irPara('fachada'); setTimeout(compararEstilos, 60); }},
    {n:'Corte',               g:'',       f:function(){ irPara('corte'); }},
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
      ['Ctrl+Z','Desfazer'], ['Ctrl+Shift+Z','Refazer'], ['Ctrl+D','Duplicar'], ['Delete','Excluir'],
      ['Ctrl+0','Enquadrar'], ['Ctrl+K','Buscar / executar'], ['Alt (segurar)','Desligar o ímã'],
      ['Shift (segurar)','Travar no eixo'], ['Duplo clique','Renomear ambiente'], ['Clique na cota','Editar a medida']
    ];
    $('#keys').innerHTML = pares.map(function (p) { return '<div><span>' + p[1] + '</span><kbd>' + p[0] + '</kbd></div>'; }).join('');
    $('#ajuda').hidden = false;
  }
  function closeOverlays(){ $('#cmdk').hidden = true; $('#ajuda').hidden = true; $('#estilos').hidden = true; }

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
        if (!$('#apres').hidden) { fecharApres(); return; }
        if (!$('#ajuda').hidden) { closeOverlays(); return; }
        if (PLAN.sel) { PLAN.selecionar(null); return; }
        if (!$('#app').hidden) voltarHome();
        return;
      }
      if (emCampo) return;
      if (!M.proj || $('#app').hidden) return;

      shift = e.shiftKey; alt = e.altKey;
      if (e.key === ' ') { espaco = true; e.preventDefault(); }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? fazerRedo() : fazerUndo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); if (PLAN.movAtual()) acaoMovel('dup', PLAN.sel); else if (PLAN.sel) duplicar(PLAN.sel); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === '0') { e.preventDefault(); irPara('planta'); PLAN.enquadrar(); PLAN.render(); return; }
      if (e.ctrlKey || e.metaKey) return;

      var k = e.key.toLowerCase();
      if (k === 'delete' || k === 'backspace') { if (PLAN.movAtual()) { e.preventDefault(); acaoMovel('del', PLAN.sel); } else if (PLAN.sel) { e.preventDefault(); excluir(PLAN.sel); } return; }
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
      if (k === 'f') irPara('fachada');
      if (k === 'o') irPara('orcamento');
      if (k === 's') irPara('simulador');
      /* setas movem o selecionado */
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
      modo: modos,
      paradas: function (ps) {
        sel.innerHTML = '<option value="">Ir para…</option>' + ps.map(function (p, i) { return '<option value="' + i + '">' + esc(p.titulo) + '</option>'; }).join('');
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
    sel.onchange = function () { if (this.value !== '') t3.irParada(+this.value); };
    pad.querySelector('#t3-ant').onclick = function () { t3.anterior(); };
    pad.querySelector('#t3-prox').onclick = function () { t3.proxima(); };
    pad.querySelector('#t3-auto').onclick = function () { t3.setAuto(!t3.auto); this.textContent = t3.auto ? '❚❚' : '▶'; };
    pad.querySelector('#t3-foto').onclick = function () {
      var a = document.createElement('a'); a.href = t3.foto(); a.download = slug() + '-3d.png'; a.click(); toast('Imagem salva.');
    };
  }

  /* ================= FACHADA (designer) ================= */
  var CORES_PAREDE = ['#F2EFE8', '#F6F1E4', '#D9D9D4', '#EFE3CF', '#C9D3D9', '#B9C4B0', '#F0D9C2', '#8E9BA6'];
  var CORES_DEST = ['#2B2F33', '#8B5E3C', '#1F2326', '#B7B0A3', '#2F5D8A', '#6B7885', '#C4553B', '#1E7E96'];
  var ROT = {cobertura:{platibanda:'Platibanda', telhado2:'2 águas', telhado4:'4 águas'}, telha:{ceramica:'Cerâmica', concreto:'Concreto', metalica:'Metálica'},
    revestimento:{nenhum:'Nenhum', ripado:'Ripado', pedra:'Pedra', tijolo:'Tijolinho', cimento:'Cimento'}, esquadria:{preto:'Preto', branco:'Branco', madeira:'Madeira'},
    portao:{grade:'Grade', ripado:'Ripado', chapa:'Chapa'}, muro:{baixo:'Baixo', alto:'Alto', vidro:'Vidro'}};
  function ligarFachada(pad){
    pad.classList.add('pad-3d');
    var st = pad.querySelector('#fach-stage');
    t3 = TRES.montar(st, {modo:'orbit', editar:false, on:{
      noite: function (n) { pad.querySelectorAll('#fach-hora button').forEach(function (b) { b.classList.toggle('on', (b.getAttribute('data-hora') === 'noite') === n); }); }
    }});
    if (!t3) return;
    t3.verFachada(true);
    pad.querySelectorAll('#fach-hora button').forEach(function (b) { b.onclick = function () { t3.setNoite(b.getAttribute('data-hora') === 'noite'); }; });
    pad.querySelector('#fach-elev').onclick = function () {
      var e = pad.querySelector('#fach-elev-pad'); e.hidden = !e.hidden; this.classList.toggle('on', !e.hidden);
      if (!e.hidden) e.innerHTML = VIEWS.fachada();
    };
    pad.querySelector('#fach-foto').onclick = function () { var a = document.createElement('a'); a.href = t3.foto(); a.download = slug() + '-fachada.png'; a.click(); toast('Imagem da fachada salva.'); };
    pad.querySelector('#fach-4').onclick = compararEstilos;
    fachPanel(pad);
  }
  function fachPanel(pad){
    pad = pad || canvasWrap.querySelector('.view-pad'); if (!pad) return;
    var el = pad.querySelector('#fach-panel'); if (!el) return;
    var F = TRES.fachadaDe(M.proj), h = '';
    function chips(k, mapa){ return '<div class="chips">' + Object.keys(mapa).map(function (v) { return '<button class="chip' + (F[k] === v ? ' on' : '') + '" data-fk="' + k + '" data-fv="' + v + '">' + mapa[v] + '</button>'; }).join('') + '</div>'; }
    function cores(k, lista){ return '<div class="swatches">' + lista.map(function (c) { return '<button class="sw-btn' + (F[k].toUpperCase() === c ? ' on' : '') + '" data-fk="' + k + '" data-fv="' + c + '" style="background:' + c + '" title="' + c + '"></button>'; }).join('') + '</div>'; }
    function tg(k, rot){ return '<button class="chip' + (F[k] ? ' on' : '') + '" data-fk="' + k + '" data-fv="' + (F[k] ? '0' : '1') + '">' + rot + '</button>'; }
    /* criar por prompt: descreve em português, o app entende as escolhas */
    h += '<section class="fach-prompt"><h6>CRIAR POR PROMPT</h6><div class="inp"><textarea id="fach-prompt" rows="2" placeholder="ex.: loja moderna com vitrine, ripado, letreiro &quot;Acqua Belo&quot; em LED azul, totem, número 128"></textarea></div>' +
      '<div class="fach-prompt-acts"><button class="btn solid sm" id="fach-prompt-ok">✨ Criar fachada</button><span id="fach-prompt-msg"></span></div></section>';
    h += '<section><h6>ESTILO</h6><div class="estilos">';
    Object.keys(TRES.FACHADA_PRESETS).forEach(function (k) {
      var pr = TRES.FACHADA_PRESETS[k], telha = pr.cobertura === 'platibanda' ? pr.corParede : (pr.telha === 'ceramica' ? '#B5533A' : '#6F6E6B');
      h += '<button class="estilo' + (F.estilo === k ? ' on' : '') + '" data-fk="estilo" data-fv="' + k + '"><span class="dots"><i style="background:' + pr.corParede + '"></i><i style="background:' + pr.corDestaque + '"></i><i style="background:' + telha + '"></i></span><b>' + pr.rot + '</b><small>' + pr.desc + '</small></button>';
    });
    h += '</div></section>';
    h += '<section><h6>COBERTURA</h6>' + chips('cobertura', ROT.cobertura) + (F.cobertura !== 'platibanda' ? '<h6 style="margin-top:10px">TELHA</h6>' + chips('telha', ROT.telha) : '') + '</section>';
    h += '<section><h6>COR DA PAREDE</h6>' + cores('corParede', CORES_PAREDE) + '<h6 style="margin-top:10px">COR DE DESTAQUE</h6>' + cores('corDestaque', CORES_DEST) + '</section>';
    h += '<section><h6>REVESTIMENTO DA FRENTE</h6>' + chips('revestimento', ROT.revestimento) + '</section>';
    h += '<section><h6>ESQUADRIAS</h6>' + chips('esquadria', ROT.esquadria) + '</section>';
    h += '<section><h6>PORTÃO</h6>' + chips('portao', ROT.portao) + '<h6 style="margin-top:10px">MURO</h6>' + chips('muro', ROT.muro) + '</section>';
    h += '<section><h6>EXTRAS</h6><div class="chips">' + tg('jardim', 'Jardim') + tg('marquise', 'Marquise') + tg('pergolado', 'Pergolado') + tg('iluminacao', 'Iluminação') + tg('vitrine', 'Vitrine') + '</div>' +
      '<div class="f" style="margin-top:10px"><label>NÚMERO DA CASA</label><div class="inp"><input id="fach-num" value="' + esc(F.numero) + '" placeholder="ex.: 128" maxlength="5"></div></div></section>';
    /* letreiro comercial */
    h += '<section><h6>LETREIRO · NOME DO ESTABELECIMENTO</h6>' +
      '<div class="f"><div class="inp"><input id="fach-let" value="' + esc(F.letreiro) + '" placeholder="ex.: ACQUA BELO" maxlength="40"></div></div>' +
      (F.letreiro ? '<h6 style="margin-top:10px">TIPO</h6>' + chips('letreiroEstilo', {placa:'Placa', caixa:'Letra caixa', led:'LED', neon:'Neon', backlight:'Backlight'}) +
      '<h6 style="margin-top:10px">COR</h6>' + cores('letreiroCor', ['#22B8D6', '#2F5D8A', '#C4553B', '#E0B44C', '#4E9A5D', '#D96AA0', '#F4F4F1', '#1F2326']) +
      '<div class="chips" style="margin-top:10px">' + tg('letreiroLuz', 'Acende à noite') + tg('totem', 'Totem no portão') +
      '<button class="chip' + (F.letreiroPos === 'marquise' ? ' on' : '') + '" data-fk="letreiroPos" data-fv="' + (F.letreiroPos === 'marquise' ? 'parede' : 'marquise') + '">Sobre a marquise</button></div>' : '<div class="ins-empty">Digite o nome para a placa aparecer na frente.</div>') + '</section>';
    var itens = M.custoFachadaItens();
    h += '<section><h6>QUANTO ESSA FACHADA CUSTA</h6>' + (itens.length ? itens.map(function (it) { return kv(it.rot, M.fmtBRL(it.valor), ''); }).join('') : '<div class="ins-empty">Nada além da alvenaria.</div>') +
      '<div class="kv tot"><span>Fachada</span><b>' + M.fmtBRL(M.custoFachada()) + '</b></div>' +
      '<div class="kv derived" title="ambientes ' + M.fmtBRL(M.custoTotal()) + ' + fachada ' + M.fmtBRL(M.custoFachada()) + '"><span>Investimento total</span><b>' + M.fmtBRL(M.custoGeral()) + '</b></div></section>';
    el.innerHTML = h;
    el.querySelectorAll('[data-fk]').forEach(function (b) {
      b.onclick = function () {
        var k = b.getAttribute('data-fk'), v = b.getAttribute('data-fv');
        if (['jardim', 'marquise', 'iluminacao', 'pergolado', 'vitrine', 'letreiroLuz', 'totem'].indexOf(k) >= 0) v = v === '1';
        setFachada(k, v);
      };
    });
    var num = el.querySelector('#fach-num');
    num.onchange = function () { setFachada('numero', this.value.trim()); };
    num.onkeydown = function (e) { e.stopPropagation(); if (e.key === 'Enter') this.blur(); };
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
    ov.innerHTML = '<div class="estilos-box"><div class="estilos-hd"><h3>Sua casa nos 4 estilos</h3><p>Mesma planta, mesma rua' + (noiteAntes ? ', à noite' : '') + '. Clique no que mais combina com você.</p><button class="icon-btn" id="estilos-x">✕</button></div><div class="estilos-grid">' +
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
    var shim = 'var M={proj:' + JSON.stringify(p) + ',TIPOS:' + JSON.stringify(M.TIPOS) + ',' +
      'movelDe:function(id){return (M.proj.moveis||[]).filter(function(m){return m.id===id})[0]||null},' +
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
  function toast(msg, desfazer, erro){
    var t = $('#toast');
    t.className = 'toast' + (erro ? ' err' : '');
    t.innerHTML = esc(msg) + (desfazer ? ' <span class="u">Desfazer</span>' : '');
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
    toast:toast, saveState:saveState, zoomLabel:zoomLabel, coord:coord, hud:hud, msg:msg,
    closeOverlays:closeOverlays, fecharApres:fecharApres, abrirApres:abrirApres, exportar:exportar,
    get shift(){ return shift; }, get alt(){ return alt; }, get espaco(){ return espaco; }
  };
})();
document.addEventListener('DOMContentLoaded', function () { UI.boot(); });
