/* =========================================================================
   QR — gerador próprio (modo byte, correção M, versões 1..20), para o app
   funcionar sem internet: o QR do celular é desenhado aqui mesmo.
   Implementação enxuta do padrão ISO/IEC 18004.
   ========================================================================= */
var QR = (function () {
  /* --- Galois 256 (polinômio 0x11D) para Reed-Solomon --- */
  var EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  (function () { var x = 1; for (var i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11D; } for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255]; })();
  function mul(a, b){ return a && b ? EXP[LOG[a] + LOG[b]] : 0; }
  function polyGer(n){ var p = [1]; for (var i = 0; i < n; i++) { var q = [1, EXP[i]], r = new Array(p.length + 1).fill(0);
    for (var a = 0; a < p.length; a++) for (var b = 0; b < q.length; b++) r[a + b] ^= mul(p[a], q[b]);
    p = r; } return p; }
  function rs(dados, n){
    var ger = polyGer(n), res = new Array(n).fill(0);
    for (var i = 0; i < dados.length; i++) {
      var f = dados[i] ^ res[0];
      res.shift(); res.push(0);
      if (f) for (var j = 0; j < ger.length - 1; j++) res[j] ^= mul(ger[j + 1], f);
    }
    return res;
  }
  /* capacidade (bytes de dados), blocos e correção por versão — nível L (mais dados por QR) */
  var CAP = [null,
    {t:19,  b:[[1,19]]},   {t:34,  b:[[1,34]]},   {t:55,  b:[[1,55]]},   {t:80,  b:[[1,80]]},
    {t:108, b:[[1,108]]},  {t:136, b:[[2,68]]},   {t:156, b:[[2,78]]},   {t:194, b:[[2,97]]},
    {t:232, b:[[2,116]]},  {t:274, b:[[2,68],[2,69]]}, {t:324, b:[[4,81]]}, {t:370, b:[[2,92],[2,93]]},
    {t:428, b:[[4,107]]},  {t:461, b:[[3,115],[1,116]]}, {t:523, b:[[5,87],[1,88]]}, {t:589, b:[[5,98],[1,99]]},
    {t:647, b:[[1,107],[5,108]]}, {t:721, b:[[5,120],[1,121]]}, {t:795, b:[[3,113],[4,114]]}, {t:861, b:[[3,107],[5,108]]},
    {t:932, b:[[4,116],[4,117]]}, {t:1006, b:[[2,111],[7,112]]}, {t:1094, b:[[4,121],[5,122]]}, {t:1174, b:[[6,117],[4,118]]},
    {t:1276, b:[[8,106],[4,107]]}, {t:1370, b:[[10,114],[2,115]]}, {t:1468, b:[[8,122],[4,123]]}, {t:1531, b:[[3,117],[10,118]]},
    {t:1631, b:[[7,116],[7,117]]}, {t:1735, b:[[5,115],[10,116]]}, {t:1843, b:[[13,115],[3,116]]}, {t:1955, b:[[17,115]]},
    {t:2071, b:[[17,115],[1,116]]}, {t:2191, b:[[13,115],[6,116]]}, {t:2306, b:[[12,121],[7,122]]}, {t:2434, b:[[6,121],[14,122]]},
    {t:2566, b:[[17,122],[4,123]]}, {t:2702, b:[[4,122],[18,123]]}, {t:2812, b:[[20,117],[4,118]]}, {t:2956, b:[[19,118],[6,119]]}
  ];
  var ECC = [null, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28,
    28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30];
  var ALIN = [null, [], [6,18], [6,22], [6,26], [6,30], [6,34], [6,22,38], [6,24,42], [6,26,46], [6,28,50],
    [6,30,54], [6,32,58], [6,34,62], [6,26,46,66], [6,26,48,70], [6,26,50,74], [6,30,54,78], [6,30,56,82], [6,30,58,86], [6,34,62,90],
    [6,28,50,72,94], [6,26,50,74,98], [6,30,54,78,102], [6,28,54,80,106], [6,32,58,84,110], [6,30,58,86,114], [6,34,62,90,118],
    [6,26,50,74,98,122], [6,30,54,78,102,126], [6,26,52,78,104,130], [6,30,56,82,108,134], [6,34,60,86,112,138], [6,30,58,86,114,142],
    [6,34,62,90,118,146], [6,30,54,78,102,126,150], [6,24,50,76,102,128,154], [6,28,54,80,106,132,158], [6,32,58,84,110,136,162],
    [6,26,54,82,110,138,166], [6,30,58,86,114,142,170]];
  var FORM = {0:0x77C4, 1:0x72F3, 2:0x7DAA, 3:0x789D, 4:0x662F, 5:0x6318, 6:0x6C41, 7:0x6976};   /* nível L, máscaras 0..7 */

  function gerar(txt){
    var bytes = new TextEncoder().encode(txt), ver = 0;
    /* folga de 1 byte além do cabeçalho: 4 bits de modo + 8/16 de tamanho não fecham byte redondo */
    for (var v = 1; v <= 40; v++) if (bytes.length + (v >= 10 ? 4 : 3) <= CAP[v].t) { ver = v; break; }
    if (!ver) return null;   /* nem na versão 40 cabe */
    var info = CAP[ver], total = info.t, bits = [];
    function push(val, n){ for (var i = n - 1; i >= 0; i--) bits.push((val >> i) & 1); }
    push(4, 4);                                   /* modo byte */
    push(bytes.length, ver < 10 ? 8 : 16);
    for (var i2 = 0; i2 < bytes.length; i2++) push(bytes[i2], 8);
    push(0, Math.min(4, total * 8 - bits.length));
    while (bits.length % 8) bits.push(0);
    var dados = [];
    for (var k = 0; k < bits.length; k += 8) { var b = 0; for (var q = 0; q < 8; q++) b = (b << 1) | bits[k + q]; dados.push(b); }
    if (dados.length > total) dados.length = total;   /* nunca passa da capacidade */
    var pad = [0xEC, 0x11], pi = 0;
    while (dados.length < total) dados.push(pad[pi++ % 2]);
    /* blocos + correção */
    var blocos = [], ecs = [], pos = 0;
    info.b.forEach(function (par) { for (var n = 0; n < par[0]; n++) { var d = dados.slice(pos, pos + par[1]); pos += par[1]; blocos.push(d); ecs.push(rs(d, ECC[ver])); } });
    var maxD = Math.max.apply(null, blocos.map(function (b2) { return b2.length; })), fluxo = [];
    for (var c = 0; c < maxD; c++) blocos.forEach(function (b3) { if (c < b3.length) fluxo.push(b3[c]); });
    for (var c2 = 0; c2 < ECC[ver]; c2++) ecs.forEach(function (e) { fluxo.push(e[c2]); });
    /* matriz */
    var n2 = ver * 4 + 17, m = [], res = [];
    for (var y = 0; y < n2; y++) { m.push(new Array(n2).fill(0)); res.push(new Array(n2).fill(0)); }
    function marcar(x, y2, v2){ m[y2][x] = v2 ? 1 : 0; res[y2][x] = 1; }
    function finder(x, y3){ for (var dy = -1; dy <= 7; dy++) for (var dx = -1; dx <= 7; dx++) {
      var px = x + dx, py = y3 + dy; if (px < 0 || py < 0 || px >= n2 || py >= n2) continue;
      var v3 = (dx >= 0 && dx <= 6 && (dy === 0 || dy === 6)) || (dy >= 0 && dy <= 6 && (dx === 0 || dx === 6)) || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4);
      marcar(px, py, v3);
    } }
    finder(0, 0); finder(n2 - 7, 0); finder(0, n2 - 7);
    for (var t = 8; t < n2 - 8; t++) { marcar(t, 6, t % 2 === 0); marcar(6, t, t % 2 === 0); }
    ALIN[ver].forEach(function (ax) { ALIN[ver].forEach(function (ay) {
      if ((ax < 9 && ay < 9) || (ax > n2 - 10 && ay < 9) || (ax < 9 && ay > n2 - 10)) return;
      for (var dy2 = -2; dy2 <= 2; dy2++) for (var dx2 = -2; dx2 <= 2; dx2++)
        marcar(ax + dx2, ay + dy2, Math.max(Math.abs(dx2), Math.abs(dy2)) !== 1);
    }); });
    marcar(8, n2 - 8, 1);
    for (var f2 = 0; f2 < 9; f2++) { if (f2 !== 6) { res[8][f2] = 1; res[f2][8] = 1; } }
    for (var f3 = 0; f3 < 8; f3++) { res[8][n2 - 1 - f3] = 1; res[n2 - 1 - f3][8] = 1; }
    if (ver >= 7) for (var vb = 0; vb < 18; vb++) { var vx = Math.floor(vb / 3), vy = vb % 3; res[n2 - 11 + vy][vx] = 1; res[vx][n2 - 11 + vy] = 1; }
    /* dados em zigue-zague */
    var idx = 0, mascara = 0;
    var col = n2 - 1, cima = true;
    while (col > 0) {
      if (col === 6) col--;
      for (var r2 = 0; r2 < n2; r2++) {
        var yy = cima ? n2 - 1 - r2 : r2;
        for (var s = 0; s < 2; s++) {
          var xx = col - s;
          if (res[yy][xx]) continue;
          var bit = idx < fluxo.length * 8 ? (fluxo[idx >> 3] >> (7 - (idx & 7))) & 1 : 0;
          idx++;
          var mk = (yy + xx) % 2 === 0;   /* máscara 0 */
          m[yy][xx] = bit ^ (mk ? 1 : 0);
        }
      }
      cima = !cima; col -= 2;
    }
    /* formato (nível M, máscara 0) */
    var fmt = FORM[mascara];
    for (var fb = 0; fb < 15; fb++) {
      var b4 = (fmt >> fb) & 1;
      if (fb < 6) m[fb][8] = b4; else if (fb < 8) m[fb + 1][8] = b4; else if (fb === 8) m[8][7] = b4;
      else m[8][14 - fb] = b4;
      if (fb < 8) m[8][n2 - 1 - fb] = b4; else m[n2 - 15 + fb][8] = b4;
    }
    /* versão (7+) */
    if (ver >= 7) {
      var vrem = ver << 12, g = 0x1F25;
      for (var vi = 17; vi >= 12; vi--) if ((vrem >> vi) & 1) vrem ^= g << (vi - 12);
      var vbits = (ver << 12) | vrem;
      for (var vb2 = 0; vb2 < 18; vb2++) { var vbit = (vbits >> vb2) & 1, vx2 = Math.floor(vb2 / 3), vy2 = vb2 % 3;
        m[n2 - 11 + vy2][vx2] = vbit; m[vx2][n2 - 11 + vy2] = vbit; }
    }
    return {n:n2, m:m, ver:ver};
  }
  /* desenha num canvas 2D (fundo branco, margem de 4 módulos) */
  function desenhar(ctx, txt, lado, x0, y0){
    var q = gerar(txt); if (!q) return null;
    var margem = 4, tot = q.n + margem * 2, px = Math.floor(lado / tot) || 1, off = Math.floor((lado - px * tot) / 2);
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x0 || 0, y0 || 0, lado, lado);
    ctx.fillStyle = '#000000';
    for (var y = 0; y < q.n; y++) for (var x = 0; x < q.n; x++)
      if (q.m[y][x]) ctx.fillRect((x0 || 0) + off + (x + margem) * px, (y0 || 0) + off + (y + margem) * px, px, px);
    return q;
  }
  return {gerar:gerar, desenhar:desenhar};
})();
