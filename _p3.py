f='tres.js'; s=open(f,encoding='utf-8').read()
def rep(a,b,cnt=1):
    global s
    assert s.count(a)==cnt, (a[:70], s.count(a))
    s=s.replace(a,b)

# 1. etiqueta de fachada nas primitivas
rep("""  /* ============================ CONSTRUÇÃO ============================ */
  function caixa(g, w, h, d, mat, x, y, z, sombra){
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y + h / 2, z);
    m.castShadow = sombra !== false; m.receiveShadow = true;
    g.add(m); return m;
  }""","""  /* ============================ CONSTRUÇÃO ============================ */
  /* FK = elemento de fachada em construção ('janela', 'porta', 'muro'…): cada primitiva criada enquanto
     FK está ligado recebe userData.fk — é o que permite CLICAR no item no 3D e trocar só ele. */
  var FK = null;
  function fk(tag){ FK = tag || null; }
  function caixa(g, w, h, d, mat, x, y, z, sombra){
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y + h / 2, z);
    m.castShadow = sombra !== false; m.receiveShadow = true;
    if (FK) m.userData.fk = FK;
    g.add(m); return m;
  }""")
rep("""    var m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true;
    g.add(m); return m;
  }
  function cil(g, r, h, mat, x, y, z, seg){
    var m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg || 10), mat);
    m.position.set(x, y + h / 2, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
  }""","""    var m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true;
    if (FK) m.userData.fk = FK;
    g.add(m); return m;
  }
  function cil(g, r, h, mat, x, y, z, seg){
    var m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg || 10), mat);
    m.position.set(x, y + h / 2, z); m.castShadow = true; m.receiveShadow = true; if (FK) m.userData.fk = FK; g.add(m); return m;
  }""")

# 2. muro / portão / piso / jardim
rep("""    /* muros laterais e de fundo */
    caixa(G.terreno, .15, 1.8, TP, matMuroBase, .075, 0, TP / 2);""","""    /* muros laterais e de fundo */
    fk('muro');
    caixa(G.terreno, .15, 1.8, TP, matMuroBase, .075, 0, TP / 2);""")
rep("""    /* pilaretes do portão */
    caixa(G.terreno, .25, muroH + .3, .25, matDest, x1 - .125, 0, .075); caixa(G.terreno, .25, muroH + .3, .25, matDest, x2 + .125, 0, .075);
    var pH = Math.min(muroH + .2, 1.9);""","""    /* pilaretes do portão */
    caixa(G.terreno, .25, muroH + .3, .25, matDest, x1 - .125, 0, .075); caixa(G.terreno, .25, muroH + .3, .25, matDest, x2 + .125, 0, .075);
    fk('portao');
    var pH = Math.min(muroH + .2, 1.9);""")
rep("""    /* caminho do portão até a casa */
    var frenteCasa = an.ambs.length ? Math.min.apply(null, an.ambs.map(function (a) { return a.y; })) * CM : TP;
    if (frenteCasa > .3 && matPisoFrente) plano(G.terreno, gw - .2, frenteCasa - .2, matPisoFrente, gx, .005, .1 + (frenteCasa - .2) / 2);""","""    /* caminho do portão até a casa */
    fk('pisoFrente');
    var frenteCasa = an.ambs.length ? Math.min.apply(null, an.ambs.map(function (a) { return a.y; })) * CM : TP;
    if (frenteCasa > .3) plano(G.terreno, gw - .2, frenteCasa - .2, matPisoFrente || Mt.calcada, gx, .005, .1 + (frenteCasa - .2) / 2);
    fk('jardim');""")
rep("""    /* poste na calçada (acende à noite) */
    caixa(G.terreno, .12, 4.2, .12, Mt.poste,""","""    /* poste na calçada (acende à noite) */
    fk(null);
    caixa(G.terreno, .12, 4.2, .12, Mt.poste,""")

# 3. paredes externas, revestimento, platibanda
rep("""      /* revestimento na frente da casa (peças da testada que não são garagem) */
      if (matRev && pc.ext && pc.o === 'h' && pc.c === frenteCm) {""","""      /* revestimento na frente da casa (peças da testada que não são garagem) */
      fk('revestimento');
      if (matRev && pc.ext && pc.o === 'h' && pc.c === frenteCm) {""")
rep("""      pc.caixas.forEach(function (c) {
        if (ehVitrine) return;
        var len = (c.q - c.p) * CM, alt = (c.z1 - c.z0) * CM, mid = (c.p + c.q) / 2 * CM, y0 = c.z0 * CM;""","""      fk(pc.ext ? 'parede' : null);
      pc.caixas.forEach(function (c) {
        if (ehVitrine) return;
        var len = (c.q - c.p) * CM, alt = (c.z1 - c.z0) * CM, mid = (c.p + c.q) / 2 * CM, y0 = c.z0 * CM;""")
rep("""      /* platibanda nas peças externas (só quando a cobertura é platibanda) */
      if (pc.ext && F.cobertura === 'platibanda'""","""      /* platibanda nas peças externas (só quando a cobertura é platibanda) */
      fk('cobertura');
      if (pc.ext && F.cobertura === 'platibanda'""")
rep("""      /* esquadrias, vidros e portas */
      pc.ab.forEach(function (ab) {
        if (ehVitrine && ab.tipo === 'janela') return;   /* a vitrine já é o vidro */""","""      /* esquadrias, vidros e portas */
      pc.ab.forEach(function (ab) {
        if (ehVitrine && ab.tipo === 'janela') return;   /* a vitrine já é o vidro */
        fk(!pc.ext ? null : ab.tipo === 'janela' ? 'janela' : ab.tipo === 'portao' ? 'garagem' : ab.tipo === 'entrada' ? 'porta' : null);""")
rep("""          if (horiz && pc.c === frenteCm) {   /* fachada: volume de destaque, marquise, número e luz da entrada */
            var ladoX = cx - len / 2 - .35;
            caixa(G.acabamento, .35, altTotal + (F.cobertura === 'platibanda' ? .75 : .1), .3, matDest, ladoX, 0, cz - .08);
            if (F.marquise) caixa(G.acabamento, len + 1.2, .12, 1.1, matDest, cx + .1, 2.25, cz - .55);""","""          if (horiz && pc.c === frenteCm) {   /* fachada: volume de destaque, marquise, número e luz da entrada */
            var ladoX = cx - len / 2 - .35;
            fk('destaque'); caixa(G.acabamento, .35, altTotal + (F.cobertura === 'platibanda' ? .75 : .1), .3, matDest, ladoX, 0, cz - .08);
            fk('marquise'); if (F.marquise) caixa(G.acabamento, len + 1.2, .12, 1.1, matDest, cx + .1, 2.25, cz - .55);""")
rep("""        } else {   /* porta interna: aberta a 75° para dentro do ambiente B */""","""        } else {   /* porta interna: aberta a 75° para dentro do ambiente B */
          fk(null);""")
rep("""      if (ehVitrine) {
        var lenV = (pc.q2 - pc.p2) * CM, midV = (pc.p2 + pc.q2) / 2 * CM, zV = pc.c * CM;""","""      if (ehVitrine) {
        fk('vitrine');
        var lenV = (pc.q2 - pc.p2) * CM, midV = (pc.p2 + pc.q2) / 2 * CM, zV = pc.c * CM;""")
rep("""      });
    });
    /* ---------- escada (derivada de M.escada)""","""      });
      fk(null);
    });
    /* ---------- escada (derivada de M.escada)""")
rep("""    /* ---------- telhado (2 ou 4 águas) sobre a caixa da casa ---------- */
    if (F.cobertura !== 'platibanda' && anTopo.ambs.length) {""","""    /* ---------- telhado (2 ou 4 águas) sobre a caixa da casa ---------- */
    fk('cobertura');
    if (F.cobertura !== 'platibanda' && anTopo.ambs.length) {""")
rep("""      var telhado = new THREE.Mesh(gt, matTelha); telhado.castShadow = true; telhado.receiveShadow = true; telhado.userData.pronto = matTelha; telhado.userData.cru = Mt.cruLaje; G.cobertura.add(telhado);""","""      var telhado = new THREE.Mesh(gt, matTelha); telhado.castShadow = true; telhado.receiveShadow = true; telhado.userData.pronto = matTelha; telhado.userData.cru = Mt.cruLaje; telhado.userData.fk = 'cobertura'; G.cobertura.add(telhado);""")
rep("""        var mo = new THREE.Mesh(go, new THREE.MeshStandardMaterial({color: F.corParede, roughness:.85, side:THREE.DoubleSide})); mo.castShadow = true; mo.userData.pronto = mo.material; mo.userData.cru = Mt.cruParede; G.cobertura.add(mo);""","""        var mo = new THREE.Mesh(go, new THREE.MeshStandardMaterial({color: F.corParede, roughness:.85, side:THREE.DoubleSide})); mo.castShadow = true; mo.userData.pronto = mo.material; mo.userData.cru = Mt.cruParede; mo.userData.fk = 'cobertura'; G.cobertura.add(mo);""")
rep("""    /* ---------- letreiro com o nome do estabelecimento + totem ---------- */
    if (F.letreiro && an.ambs.length) {""","""    /* ---------- letreiro com o nome do estabelecimento + totem ---------- */
    fk('letreiro');
    if (F.letreiro && an.ambs.length) {""")
rep("""    /* ---------- luzes da fachada (só acendem à noite) ---------- */
    luzes.push({tipo:'ponto', x:posteLuz.x""","""    fk(null);
    /* ---------- luzes da fachada (só acendem à noite) ---------- */
    luzes.push({tipo:'ponto', x:posteLuz.x""")

# 4. clique/hover em elemento de fachada → callback
rep("""    function clique(e){
      if (op.editar !== false && sel3) { selecionarMovel(null); }   /* clicou fora: solta a seleção */
      var hit = sob(e);""","""    function clique(e){
      if (op.editar !== false && sel3) { selecionarMovel(null); }   /* clicou fora: solta a seleção */
      if (cb.fachadaClique) { var fkh = sobFachada(e); if (fkh) { cb.fachadaClique(fkh, e.clientX, e.clientY); return; } }
      var hit = sob(e);""")
rep("""    function sob(e){
      if (!cena) return null;""","""    /* elemento de fachada sob o ponteiro (janela, porta, muro…) — lista de malhas etiquetadas, refeita a cada construção */
    var fkCache = null;
    function sobFachada(e){
      if (!cena) return null;
      var r = canvas.getBoundingClientRect();
      ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      if (!fkCache || fkCache.cena !== cena) { fkCache = []; fkCache.cena = cena; cena.raiz.traverse(function (o) { if (o.isMesh && o.userData.fk) fkCache.push(o); }); }
      var hits = raycaster.intersectObjects(fkCache, false);
      for (var i = 0; i < hits.length; i++) { var o = hits[i].object, vis = true, p = o; while (p) { if (p.visible === false) { vis = false; break; } p = p.parent; } if (vis) return o.userData.fk; }
      return null;
    }
    function sob(e){
      if (!cena) return null;""")
rep("""    on(canvas, 'pointermove', function (e) {
      var p = ptr[e.pointerId]; if (!p) return;""","""    var fkHover = null;
    on(canvas, 'pointermove', function (e) {
      var p = ptr[e.pointerId];
      if (!p) {   /* só passando o mouse: destaca o elemento de fachada clicável */
        if (cb.fachadaHover && e.pointerType !== 'touch') { var fh = sobFachada(e); if (fh !== fkHover) { fkHover = fh; canvas.style.cursor = fh ? 'pointer' : ''; cb.fachadaHover(fh, e.clientX, e.clientY); } }
        return;
      }""")
open(f,'w',encoding='utf-8').write(s)
print('ok')
