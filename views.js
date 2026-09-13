/* =========================================================================
   VIEWS — tudo aqui é derivado do mesmo `M.proj`. Nenhuma view guarda dado.
   ========================================================================= */
var VIEWS = (function () {

  /* ---------------- miniatura da planta (cards, apresentação) ------------- */
  function miniPlanta(op){
    op = op || {};
    var p = M.proj, t = p.terreno, mg = 60;
    var s = '<svg viewBox="' + (-mg) + ' ' + (-mg) + ' ' + (t.largura + mg * 2) + ' ' + (t.profundidade + mg * 2) +
            '" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">';
    if (!op.wire) s += '<rect x="0" y="0" width="' + t.largura + '" height="' + t.profundidade + '" fill="#fff" stroke="#B6C0C9" stroke-width="4"/>';
    else s += '<rect x="0" y="0" width="' + t.largura + '" height="' + t.profundidade + '" fill="none" stroke="rgba(127,214,232,.5)" stroke-width="5"/>';
    p.ambientes.forEach(function (a) {
      var ti = M.TIPOS[a.tipo] || M.TIPOS.social;
      if (op.wire) {
        s += '<rect x="' + a.x + '" y="' + a.y + '" width="' + a.w + '" height="' + a.h + '" fill="none" stroke="rgba(127,214,232,.55)" stroke-width="4"/>';
      } else {
        s += '<rect x="' + a.x + '" y="' + a.y + '" width="' + a.w + '" height="' + a.h + '" fill="' + ti.cor + '" fill-opacity="' + (a.tipo === 'agua' ? .5 : .16) + '"/>';
        s += '<rect x="' + (a.x + 7) + '" y="' + (a.y + 7) + '" width="' + Math.max(1, a.w - 14) + '" height="' + Math.max(1, a.h - 14) +
             '" fill="none" stroke="#1B2229" stroke-width="14" stroke-opacity=".9"/>';
        if (op.labels && a.w > 220 && a.h > 170) {
          var fs = Math.min(a.w, a.h) * .12;
          s += '<text x="' + (a.x + a.w / 2) + '" y="' + (a.y + a.h / 2) + '" text-anchor="middle" font-size="' + fs +
               '" font-family="Inter,sans-serif" fill="#28313A">' + esc(a.nome) + '</text>';
          s += '<text x="' + (a.x + a.w / 2) + '" y="' + (a.y + a.h / 2 + fs * 1.25) + '" text-anchor="middle" font-size="' + (fs * .82) +
               '" font-family="ui-monospace,monospace" fill="#22B8D6">' + M.fmtM2(M.areaOf(a)) + '</text>';
        }
      }
    });
    return s + '</svg>';
  }
  function miniAmbiente(a){
    var pad = Math.max(a.w, a.h) * .2, ti = M.TIPOS[a.tipo] || M.TIPOS.social;
    return '<svg viewBox="' + (a.x - pad) + ' ' + (a.y - pad) + ' ' + (a.w + pad * 2) + ' ' + (a.h + pad * 2) +
      '" xmlns="http://www.w3.org/2000/svg"><rect x="' + (a.x - pad) + '" y="' + (a.y - pad) + '" width="' + (a.w + pad * 2) +
      '" height="' + (a.h + pad * 2) + '" fill="#07314f"/><rect x="' + a.x + '" y="' + a.y + '" width="' + a.w + '" height="' + a.h +
      '" fill="' + ti.cor + '" fill-opacity=".3" stroke="' + ti.cor + '" stroke-width="' + (Math.max(a.w, a.h) * .022) + '"/></svg>';
  }

  /* ---------------- 3D isométrico (sem engine — projeção pura) ------------ */
  function iso(){
    var p = M.proj, t = p.terreno, H = p.peDireito;
    var COS = Math.cos(Math.PI / 6), SIN = Math.sin(Math.PI / 6);
    function pr(x, y, z){ return {x:(x - y) * COS, y:(x + y) * SIN - z}; }

    var pts = [], s = '';
    function push(o){ pts.push(o); }
    /* chão do terreno */
    var c = [pr(0,0,0), pr(t.largura,0,0), pr(t.largura,t.profundidade,0), pr(0,t.profundidade,0)];
    s += '<polygon points="' + c.map(function (q) { return q.x + ',' + q.y; }).join(' ') + '" fill="#E8EDF1" stroke="#B6C0C9" stroke-width="4"/>';

    /* ordenar do fundo para a frente */
    var ambs = p.ambientes.slice().sort(function (a, b) { return (a.x + a.y) - (b.x + b.y); });
    ambs.forEach(function (a) {
      var ti = M.TIPOS[a.tipo] || M.TIPOS.social;
      var alt = a.tipo === 'agua' ? -35 : (a.tipo === 'externo' ? 4 : H);
      var x1 = a.x, y1 = a.y, x2 = a.x + a.w, y2 = a.y + a.h;
      var b = [pr(x1,y1,0), pr(x2,y1,0), pr(x2,y2,0), pr(x1,y2,0)];
      var tp = [pr(x1,y1,alt), pr(x2,y1,alt), pr(x2,y2,alt), pr(x1,y2,alt)];
      /* piso */
      s += '<polygon points="' + b.map(function (q) { return q.x + ',' + q.y; }).join(' ') + '" fill="' + ti.cor + '" fill-opacity="' + (a.tipo === 'agua' ? .75 : .22) + '" stroke="#98A4B0" stroke-width="2"/>';
      if (alt > 0) {
        /* duas faces visíveis: frontal (y2) e lateral direita (x2) */
        s += '<polygon points="' + [b[3], b[2], tp[2], tp[3]].map(function (q) { return q.x + ',' + q.y; }).join(' ') + '" fill="' + ti.cor + '" fill-opacity=".55" stroke="#4A5762" stroke-width="2"/>';
        s += '<polygon points="' + [b[1], b[2], tp[2], tp[1]].map(function (q) { return q.x + ',' + q.y; }).join(' ') + '" fill="' + ti.cor + '" fill-opacity=".38" stroke="#4A5762" stroke-width="2"/>';
        s += '<polygon points="' + tp.map(function (q) { return q.x + ',' + q.y; }).join(' ') + '" fill="#F4F6F8" fill-opacity=".9" stroke="#4A5762" stroke-width="2"/>';
        if (a.w > 240 && a.h > 200) {
          var cx = (tp[0].x + tp[2].x) / 2, cy = (tp[0].y + tp[2].y) / 2;
          s += '<text x="' + cx + '" y="' + cy + '" text-anchor="middle" font-size="34" font-family="Inter,sans-serif" fill="#3B4854">' + esc(a.nome) + '</text>';
        }
      }
      push(b); push(tp);
    });

    var todos = [].concat.apply([], pts).concat(c);
    var xs = todos.map(function (q) { return q.x; }), ys = todos.map(function (q) { return q.y; });
    var mnx = Math.min.apply(null, xs) - 120, mxx = Math.max.apply(null, xs) + 120;
    var mny = Math.min.apply(null, ys) - 120, mxy = Math.max.apply(null, ys) + 120;
    return '<svg viewBox="' + mnx + ' ' + mny + ' ' + (mxx - mnx) + ' ' + (mxy - mny) +
      '" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">' + s + '</svg>';
  }

  /* ---------------- fachada frontal ---------------- */
  function fachada(){
    var p = M.proj, t = p.terreno, H = p.peDireito, s = '', F = M.fachadaCfg();
    var telhado = F.cobertura === 'platibanda' ? 60 : (F.cobertura === 'telhado2' ? 150 : 110);
    var frente = p.ambientes.filter(function (a) { return a.tipo !== 'externo' && a.tipo !== 'agua'; })
      .sort(function (a, b) { return a.y - b.y; });
    var yMin = frente.length ? frente[0].y : t.recuoFrontal;
    var naFrente = frente.filter(function (a) { return a.y <= yMin + 60; });
    var esq = F.esquadria === 'branco' ? '#F4F4F1' : (F.esquadria === 'madeira' ? '#7A5230' : '#1B2229');
    var telha = F.telha === 'ceramica' ? '#B5533A' : (F.telha === 'metalica' ? '#3F4448' : '#6F6E6B');
    var rev = {ripado:'#A87B4F', pedra:'#9C968A', tijolo:'#A0523F', cimento:'#9C9A94'}[F.revestimento];

    s += '<defs><pattern id="ripas" width="9" height="9" patternUnits="userSpaceOnUse"><rect width="9" height="9" fill="#3B3128"/><rect x="1.5" width="6" height="9" fill="#A87B4F"/></pattern>' +
         '<pattern id="pedra" width="60" height="26" patternUnits="userSpaceOnUse"><rect width="60" height="26" fill="#8E8A80"/><rect x="2" y="2" width="30" height="22" rx="3" fill="#B3ADA1"/><rect x="34" y="2" width="24" height="22" rx="3" fill="#A29C90"/></pattern>' +
         '<pattern id="tijolo" width="40" height="20" patternUnits="userSpaceOnUse"><rect width="40" height="20" fill="#CFC3B4"/><rect x="1" y="1" width="18" height="8" fill="#A0523F"/><rect x="21" y="1" width="18" height="8" fill="#9A4E3B"/><rect x="-9" y="11" width="18" height="8" fill="#9A4E3B"/><rect x="11" y="11" width="18" height="8" fill="#A0523F"/><rect x="31" y="11" width="18" height="8" fill="#9A4E3B"/></pattern></defs>';
    s += '<line x1="-100" y1="0" x2="' + (t.largura + 100) + '" y2="0" stroke="#8A9199" stroke-width="6"/>';
    if (naFrente.length) {
      var x1 = Math.min.apply(null, naFrente.map(function (a) { return a.x; }));
      var x2 = Math.max.apply(null, naFrente.map(function (a) { return a.x + a.w; }));
      var cx = (x1 + x2) / 2;
      /* cobertura */
      if (F.cobertura === 'platibanda') {
        s += '<rect x="' + x1 + '" y="' + (-H - telhado) + '" width="' + (x2 - x1) + '" height="' + telhado + '" fill="' + F.corParede + '" stroke="#1B2229" stroke-width="7"/>';
      } else if (F.cobertura === 'telhado2') {
        s += '<polygon points="' + (x1 - 50) + ',' + (-H) + ' ' + cx + ',' + (-H - telhado) + ' ' + (x2 + 50) + ',' + (-H) + '" fill="' + telha + '" stroke="#1B2229" stroke-width="7"/>';
        for (var i = 1; i < 6; i++) { var yy = -H - telhado * i / 6, dx = (x2 - x1 + 100) / 2 * (1 - i / 6); s += '<line x1="' + (cx - dx) + '" y1="' + yy + '" x2="' + (cx + dx) + '" y2="' + yy + '" stroke="#1B2229" stroke-opacity=".35" stroke-width="2"/>'; }
      } else {
        var rec = Math.min((x2 - x1) * .3, 260);
        s += '<polygon points="' + (x1 - 50) + ',' + (-H) + ' ' + (x1 + rec) + ',' + (-H - telhado) + ' ' + (x2 - rec) + ',' + (-H - telhado) + ' ' + (x2 + 50) + ',' + (-H) + '" fill="' + telha + '" stroke="#1B2229" stroke-width="7"/>';
        for (var j = 1; j < 5; j++) { var y2 = -H - telhado * j / 5, dx2 = 50 - (50 + rec) * j / 5; s += '<line x1="' + (x1 - dx2) + '" y1="' + y2 + '" x2="' + (x2 + dx2) + '" y2="' + y2 + '" stroke="#1B2229" stroke-opacity=".35" stroke-width="2"/>'; }
      }
      /* parede */
      s += '<rect x="' + x1 + '" y="' + (-H) + '" width="' + (x2 - x1) + '" height="' + H + '" fill="' + F.corParede + '" stroke="#1B2229" stroke-width="7"/>';
      naFrente.forEach(function (a) {
        var ax = a.x + a.w / 2, ehGar = a.tipo === 'garagem', ehPorta = a.tipo === 'circulacao' || ehGar;
        /* revestimento nos trechos que não são garagem */
        if (rev && !ehGar) {
          var fill = F.revestimento === 'ripado' ? 'url(#ripas)' : (F.revestimento === 'pedra' ? 'url(#pedra)' : (F.revestimento === 'tijolo' ? 'url(#tijolo)' : rev));
          s += '<rect x="' + (a.x + 4) + '" y="' + (-H - (F.cobertura === 'platibanda' ? telhado - 4 : 0) + 4) + '" width="' + (a.w - 8) + '" height="' + (H + (F.cobertura === 'platibanda' ? telhado - 4 : 0) - 8) + '" fill="' + fill + '"/>';
        }
        if (ehGar) {
          var gw = Math.min(a.w - 40, 320);
          s += '<rect x="' + (ax - gw / 2) + '" y="' + (-220) + '" width="' + gw + '" height="220" fill="#7D838A" stroke="#1B2229" stroke-width="5"/>';
          for (var g = 1; g < 5; g++) s += '<line x1="' + (ax - gw / 2) + '" y1="' + (-220 * g / 5) + '" x2="' + (ax + gw / 2) + '" y2="' + (-220 * g / 5) + '" stroke="#1B2229" stroke-opacity=".5" stroke-width="3"/>';
        } else if (F.vitrine && a.tipo === 'social') {   /* vitrine: vidro do piso ao teto, com a porta no meio */
          s += '<rect x="' + (a.x + 6) + '" y="' + (-H + 8) + '" width="' + (a.w - 12) + '" height="' + (H - 16) + '" fill="#BFE6F2" fill-opacity=".6" stroke="' + esq + '" stroke-width="6"/>';
          for (var vb = 1; vb < Math.max(2, Math.round(a.w / 160)); vb++) s += '<line x1="' + (a.x + a.w * vb / Math.max(2, Math.round(a.w / 160))) + '" y1="' + (-H + 8) + '" x2="' + (a.x + a.w * vb / Math.max(2, Math.round(a.w / 160))) + '" y2="-8" stroke="' + esq + '" stroke-width="4"/>';
        } else if (ehPorta) {
          s += '<rect x="' + (ax - 45) + '" y="' + (-210) + '" width="90" height="210" fill="' + (F.esquadria === 'preto' ? '#2B2F33' : '#7A5230') + '" stroke="' + esq + '" stroke-width="6"/>';
          s += '<rect x="' + (ax - 45 - 35) + '" y="' + (-H - (F.cobertura === 'platibanda' ? telhado + 15 : 10)) + '" width="35" height="' + (H + (F.cobertura === 'platibanda' ? telhado + 15 : 10)) + '" fill="' + F.corDestaque + '"/>';   /* volume de destaque */
          if (F.marquise) s += '<rect x="' + (ax - 45 - 50) + '" y="' + (-235) + '" width="' + (90 + 100) + '" height="12" fill="' + F.corDestaque + '"/>';
          if (F.pergolado) { s += '<rect x="' + (ax - 120) + '" y="-262" width="240" height="12" fill="#7A5230"/>'; for (var pg = 0; pg <= 8; pg++) s += '<rect x="' + (ax - 120 + pg * 30 - 3) + '" y="-274" width="6" height="12" fill="#7A5230"/>'; s += '<rect x="' + (ax - 120) + '" y="-262" width="10" height="262" fill="#7A5230"/><rect x="' + (ax + 110) + '" y="-262" width="10" height="262" fill="#7A5230"/>'; }
          if (F.numero) s += '<rect x="' + (ax - 45 - 30) + '" y="-172" width="25" height="25" fill="' + (F.esquadria === 'preto' ? '#1B1F24' : '#F4F4F1') + '"/><text x="' + (ax - 45 - 17.5) + '" y="-153" text-anchor="middle" font-family="Inter,sans-serif" font-weight="700" font-size="16" fill="' + (F.esquadria === 'preto' ? '#F4F4F1' : '#1B1F24') + '">' + esc(F.numero) + '</text>';
        } else {                                                  /* janela */
          var jw = Math.min(a.w * .5, 180);
          s += '<rect x="' + (ax - jw / 2) + '" y="' + (-H + 70) + '" width="' + jw + '" height="110" fill="#7FD6E8" fill-opacity=".55" stroke="' + esq + '" stroke-width="6"/>';
          s += '<line x1="' + ax + '" y1="' + (-H + 70) + '" x2="' + ax + '" y2="' + (-H + 180) + '" stroke="' + esq + '" stroke-width="4"/>';
        }
      });
      /* letreiro: centralizado na frente construída (na platibanda ou acima da porta) */
      if (F.letreiro) {
        var lw = Math.min(x2 - x1 - 60, Math.max(260, F.letreiro.length * 34)), ly = F.cobertura === 'platibanda' ? -H - telhado + 6 : -H + 10, lh = 54;
        var fundoL = F.letreiroEstilo === 'placa' ? F.letreiroCor : (F.letreiroEstilo === 'caixa' ? '#F4F4F1' : (F.letreiroEstilo === 'backlight' ? '#FFFFFF' : '#14171B'));
        var tintaL = F.letreiroEstilo === 'placa' ? '#FFFFFF' : (F.letreiroEstilo === 'backlight' ? '#1B1F24' : F.letreiroCor);
        s += '<rect x="' + (cx - lw / 2) + '" y="' + ly + '" width="' + lw + '" height="' + lh + '" rx="4" fill="' + fundoL + '" stroke="#1B2229" stroke-width="4"/>';
        s += '<text x="' + cx + '" y="' + (ly + lh * .7) + '" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-weight="800" font-size="' + Math.min(36, lw / (F.letreiro.length * .66)) + '" fill="' + tintaL + '">' + esc(F.letreiro) + '</text>';
      }
      /* muro e portão na frente */
      var muroH = F.muro === 'alto' ? 180 : (F.muro === 'vidro' ? 160 : 100), gx = cx, gwid = 300;
      var gar = naFrente.filter(function (a) { return a.tipo === 'garagem'; })[0];
      if (gar) { gx = gar.x + gar.w / 2; gwid = Math.min(320, gar.w); } else { var ent = naFrente.filter(function (a) { return a.tipo === 'circulacao'; })[0]; if (ent) { gx = ent.x + ent.w / 2; gwid = 120; } }
      var mf = F.muro === 'vidro' ? '#BFE6F2' : '#DDD8CC', mo = F.muro === 'vidro' ? .55 : 1;
      s += '<rect x="0" y="' + (-muroH) + '" width="' + Math.max(0, gx - gwid / 2) + '" height="' + muroH + '" fill="' + mf + '" fill-opacity="' + mo + '" stroke="#1B2229" stroke-width="5"/>';
      s += '<rect x="' + (gx + gwid / 2) + '" y="' + (-muroH) + '" width="' + Math.max(0, t.largura - gx - gwid / 2) + '" height="' + muroH + '" fill="' + mf + '" fill-opacity="' + mo + '" stroke="#1B2229" stroke-width="5"/>';
      var pH = Math.min(muroH + 20, 190);
      if (F.portao === 'chapa') s += '<rect x="' + (gx - gwid / 2) + '" y="' + (-pH) + '" width="' + gwid + '" height="' + pH + '" fill="#7D838A" stroke="#1B2229" stroke-width="5"/>';
      else if (F.portao === 'ripado') { s += '<rect x="' + (gx - gwid / 2) + '" y="' + (-pH) + '" width="' + gwid + '" height="' + pH + '" fill="url(#ripas)" stroke="#1B2229" stroke-width="5"/>'; }
      else { for (var b = 0; b <= gwid; b += 13) s += '<line x1="' + (gx - gwid / 2 + b) + '" y1="' + (-pH) + '" x2="' + (gx - gwid / 2 + b) + '" y2="0" stroke="#5B6570" stroke-width="3"/>'; s += '<line x1="' + (gx - gwid / 2) + '" y1="' + (-pH + 4) + '" x2="' + (gx + gwid / 2) + '" y2="' + (-pH + 4) + '" stroke="#1B2229" stroke-width="5"/>'; }
      if (F.letreiro && F.totem) { s += '<rect x="' + (gx + gwid / 2 + 30) + '" y="-260" width="50" height="260" fill="' + F.corDestaque + '"/><rect x="' + (gx + gwid / 2 + 33) + '" y="-252" width="44" height="70" fill="' + (F.letreiroEstilo === 'placa' ? F.letreiroCor : '#14171B') + '"/>'; }
      /* jardim */
      if (F.jardim) { for (var fx = 20; fx < t.largura - 20; fx += 34) { if (Math.abs(fx - gx) < gwid / 2 + 20) continue; s += '<circle cx="' + fx + '" cy="' + (-muroH - 14) + '" r="18" fill="#4E9A5D"/>'; } }
      s += '<text x="' + cx + '" y="60" text-anchor="middle" font-family="ui-monospace,monospace" font-size="34" fill="#6B7885">' + M.fmtM(x2 - x1) + ' de testada · ' + (window.TRES ? TRES.FACHADA_PRESETS[F.estilo].rot : F.estilo) + '</text>';
    }
    return '<svg viewBox="' + (-140) + ' ' + (-H - telhado - 120) + ' ' + (t.largura + 280) + ' ' + (H + telhado + 240) +
      '" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">' + s + '</svg>';
  }

  /* ---------------- corte longitudinal ---------------- */
  function corte(){
    var p = M.proj, t = p.terreno, H = p.peDireito, s = '';
    var cx = t.largura / 2;
    var cortados = p.ambientes.filter(function (a) { return a.x <= cx && a.x + a.w >= cx; })
      .sort(function (a, b) { return a.y - b.y; });

    s += '<line x1="-100" y1="0" x2="' + (t.profundidade + 100) + '" y2="0" stroke="#8A9199" stroke-width="6"/>';
    if (!cortados.length)
      s += '<text x="' + (t.profundidade / 2) + '" y="-100" text-anchor="middle" font-family="Inter,sans-serif" font-size="46" fill="#8A9199">Nenhum ambiente na linha de corte</text>';
    cortados.forEach(function (a) {
      var alt = a.tipo === 'agua' ? -140 : (a.tipo === 'externo' ? 0 : H);
      if (a.tipo === 'agua') {
        s += '<rect x="' + a.y + '" y="0" width="' + a.h + '" height="140" fill="#7FD6E8" fill-opacity=".6" stroke="#1B2229" stroke-width="6"/>';
        s += '<text x="' + (a.y + a.h / 2) + '" y="95" text-anchor="middle" font-family="ui-monospace,monospace" font-size="30" fill="#0B3B49">' + esc(a.nome) + '</text>';
      } else if (alt > 0) {
        s += '<rect x="' + a.y + '" y="' + (-alt) + '" width="' + a.h + '" height="' + alt + '" fill="#F4F6F8" stroke="#1B2229" stroke-width="7"/>';
        if (a.h > 200) {
          s += '<text x="' + (a.y + a.h / 2) + '" y="' + (-alt / 2) + '" text-anchor="middle" font-family="Inter,sans-serif" font-size="34" fill="#3B4854">' + esc(a.nome) + '</text>';
          s += '<text x="' + (a.y + a.h / 2) + '" y="' + (-alt / 2 + 44) + '" text-anchor="middle" font-family="ui-monospace,monospace" font-size="28" fill="#6B7885">' + M.fmtM(a.h) + '</text>';
        }
      }
    });
    if (cortados.length) {
      var y0 = Math.min.apply(null, cortados.map(function (a) { return a.y; }));
      var y1 = Math.max.apply(null, cortados.map(function (a) { return a.y + a.h; }));
      s += '<line x1="' + y0 + '" y1="' + (-H - 60) + '" x2="' + y1 + '" y2="' + (-H - 60) + '" stroke="#6B7885" stroke-width="4"/>';
      s += '<text x="' + ((y0 + y1) / 2) + '" y="' + (-H - 78) + '" text-anchor="middle" font-family="ui-monospace,monospace" font-size="32" fill="#6B7885">' + M.fmtM(y1 - y0) + '</text>';
      s += '<text x="' + ((y0 + y1) / 2) + '" y="70" text-anchor="middle" font-family="ui-monospace,monospace" font-size="30" fill="#6B7885">PÉ-DIREITO ' + M.fmtM(H) + '</text>';
    }
    return '<svg viewBox="' + (-140) + ' ' + (-H - 200) + ' ' + (t.profundidade + 280) + ' ' + (H + 400) +
      '" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">' + s + '</svg>';
  }

  function esc(s){ return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  /* ---------------- apresentação (o entregável ao cliente) --------------- */
  function apresentacao(){
    var p = M.proj, t = p.terreno;
    var cobertos = p.ambientes.filter(function (a) { return a.tipo !== 'externo' && a.tipo !== 'agua'; });
    var quartos = p.ambientes.filter(function (a) { return a.tipo === 'intimo'; }).length;
    var h = '';

    h += '<div class="ap-bar"><b>' + esc(p.nome).toUpperCase() + '</b>' +
      '<button class="btn ghost sm" onclick="UI.fecharApres()">← Voltar ao editor</button>' +
      '<button class="btn ghost sm" onclick="UI.exportar(\'html\')">Baixar passeio 3D (.html)</button>' +
      '<button class="btn ghost sm" onclick="window.print()">Salvar PDF</button></div>';

    h += '<div class="ap-hero"><div class="med">' + miniPlanta({wire:true}) + '</div><div class="veil"></div><div class="in">' +
      '<span class="ap-kick">TERRENO ' + M.fmtMs(t.largura) + ' × ' + M.fmtMs(t.profundidade) + ' M · ' + M.fmtM2(M.areaTerreno()) + '</span>' +
      '<h1>' + esc(p.nome) + '</h1>' +
      '<p class="lead" style="margin-top:18px">' + M.fmtM2(M.areaConstruida()) + ' de área construída' +
      (quartos ? ', ' + quartos + (quartos > 1 ? ' quartos' : ' quarto') : '') +
      ', ' + cobertos.length + ' ambientes. Investimento estimado de ' + M.fmtBRL(M.custoTotal()) + '.</p>' +
      '</div></div>';

    h += '<div class="ap-passeio-hd"><span class="ap-eye">PASSEIO 3D</span><h2>Entre. Role a página e ande pela casa.</h2>' +
      '<p class="lead">Cada ambiente da planta, mobiliado e na escala real. O texto muda conforme você passa.</p></div>' +
      '<div id="ap-3d"></div>';

    h += '<section><span class="ap-eye">O PROGRAMA</span><h2>' + p.ambientes.length + ' ambientes, um por um.</h2>' +
      '<p class="lead">Cada área é calculada a partir das medidas do desenho — não digitada.</p><div class="ap-grid">';
    p.ambientes.forEach(function (a) {
      h += '<div class="ap-card"><div class="th">' + miniAmbiente(a) + '</div><div class="bd"><b>' + esc(a.nome) + '</b>' +
        '<div class="m">' + M.fmtM2(M.areaOf(a)) + '</div>' +
        '<div class="s">' + M.fmtM(a.w) + ' × ' + M.fmtM(a.h) + ' · ' + (M.TIPOS[a.tipo] || {}).rot + '</div></div></div>';
    });
    h += '</div></section>';

    h += '<section><span class="ap-eye">IMAGENS</span><h2>Planta, 3D, fachada e corte.</h2><div class="ap-gal">' +
      '<figure>' + miniPlanta({labels:true}) + '<figcaption>PLANTA</figcaption></figure>' +
      '<figure>' + iso() + '<figcaption>VOLUMETRIA</figcaption></figure>' +
      '<figure>' + fachada() + '<figcaption>FACHADA</figcaption></figure>' +
      '</div></section>';

    h += '<section><span class="ap-eye">NÚMEROS</span><h2>O que o projeto pesa.</h2><div class="ap-stats">' +
      st('Terreno', M.fmtM2(M.areaTerreno())) +
      st('Área construída', M.fmtM2(M.areaConstruida())) +
      st('Taxa de ocupação', M.fmtPct(M.ocupacao())) +
      (M.espelhoAgua() ? st('Espelho d’água', M.fmtM2(M.espelhoAgua())) : '') +
      st('Custo por m²', M.fmtBRL(M.custoPorM2())) +
      st('Investimento', M.fmtBRL(M.custoTotal())) +
      '</div>';
    if (p.meta > 0) {
      var dif = M.custoTotal() - p.meta;
      h += '<div style="margin-top:22px;padding:18px 20px;border-left:3px solid ' + (dif > 0 ? '#E5533D' : '#2FA36B') +
        ';background:rgba(' + (dif > 0 ? '229,83,61' : '47,163,107') + ',.09);border-radius:0 8px 8px 0">' +
        '<b class="mono" style="color:' + (dif > 0 ? '#FF9583' : '#7FE0B4') + '">META ' + M.fmtBRL(p.meta) + ' = ' +
        M.fmtPct(p.meta / Math.max(1, M.custoTotal()) * 100) + ' DO ESTIMADO</b>' +
        '<p style="font-size:13px;line-height:1.65;color:#C6D3DC;margin-top:8px">' +
        (dif > 0 ? 'Faltam <b>' + M.fmtBRL(dif) + '</b>. O projeto não foi encolhido para caber no número.'
                 : 'Sobram <b>' + M.fmtBRL(-dif) + '</b> sobre a estimativa.') + '</p></div>';
    }
    h += '</section>';

    h += '<footer><div class="disc2"><b>ESTUDO CONCEITUAL PRELIMINAR</b><p>Este material é uma representação conceitual para estudo de implantação, dimensionamento e viabilidade financeira. Não substitui projeto arquitetônico executivo, projeto estrutural, hidráulico, elétrico, de prevenção contra incêndio, licenciamento, ART/RRT ou aprovação dos órgãos competentes.</p></div>' +
      '<p style="max-width:1180px;margin:20px auto 0;font-size:11.5px;color:#5F7382">SUA OBRA 3D · gerado a partir do projeto — áreas e custos calculados</p></footer>';
    return h;
  }
  function st(k, v){ return '<div class="s"><b>' + v + '</b><span>' + k.toUpperCase() + '</span></div>'; }

  return {miniPlanta:miniPlanta, miniAmbiente:miniAmbiente, iso:iso, fachada:fachada, corte:corte, apresentacao:apresentacao};
})();
