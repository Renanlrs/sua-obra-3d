/* =========================================================================
   MOVEIS — catálogo de mobiliário (dimensões, figurinha de cima em SVG,
   receita 3D) e o "mobiliar automaticamente".

   Escrito como UMA função (MOVEIS_LIB) de propósito: o export do passeio
   embute o catálogo no HTML com `toString()`, igual ao motor 3D.

   Quadro local de cada móvel: centro em (0,0), largura em x, profundidade
   em y; a FRENTE é +y (embaixo na planta) e o ENCOSTO é -y (vai na parede).
   Rotação em graus, sentido horário na planta. Tudo em centímetros.
   ========================================================================= */
function MOVEIS_LIB(){

  var T = '#2B3238';   /* tinta do contorno */

  /* ---------- primitivas SVG ---------- */
  function rr(x, y, w, h, r, f, s, sw){
    return '<rect x="' + n(x) + '" y="' + n(y) + '" width="' + n(w) + '" height="' + n(h) + '" rx="' + n(r || 0) +
      '" fill="' + f + '" stroke="' + (s === undefined ? T : s) + '" stroke-width="' + (sw === undefined ? 1.6 : sw) + '" stroke-linejoin="round"/>';
  }
  function ci(cx, cy, r, f, s, sw){
    return '<circle cx="' + n(cx) + '" cy="' + n(cy) + '" r="' + n(r) + '" fill="' + f + '" stroke="' + (s === undefined ? T : s) + '" stroke-width="' + (sw === undefined ? 1.6 : sw) + '"/>';
  }
  function el(cx, cy, rx, ry, f, s, sw){
    return '<ellipse cx="' + n(cx) + '" cy="' + n(cy) + '" rx="' + n(rx) + '" ry="' + n(ry) + '" fill="' + f + '" stroke="' + (s === undefined ? T : s) + '" stroke-width="' + (sw === undefined ? 1.6 : sw) + '"/>';
  }
  function ln(x1, y1, x2, y2, s, sw){
    return '<line x1="' + n(x1) + '" y1="' + n(y1) + '" x2="' + n(x2) + '" y2="' + n(y2) + '" stroke="' + (s || T) + '" stroke-width="' + (sw || 1.2) + '" stroke-linecap="round"/>';
  }
  function pa(d, f, s, sw){
    return '<path d="' + d + '" fill="' + (f || 'none') + '" stroke="' + (s === undefined ? T : s) + '" stroke-width="' + (sw === undefined ? 1.6 : sw) + '" stroke-linejoin="round" stroke-linecap="round"/>';
  }
  function n(v){ return Math.round(v * 10) / 10; }

  /* ---------- figurinhas (vistas de cima) ---------- */
  var SYM = {
    cama: function (w, d) {
      var s = rr(-w / 2, -d / 2, w, d, 5, '#E4DCCF');                       /* estrado */
      s += rr(-w / 2 + 4, -d / 2 + 4, w - 8, d - 8, 4, '#F7F4EE', T, 1.2);  /* colchão */
      var np = w >= 120 ? 2 : 1, pw = (w - 16 - (np - 1) * 6) / np;
      for (var i = 0; i < np; i++) s += rr(-w / 2 + 8 + i * (pw + 6), -d / 2 + 9, pw, 28, 9, '#FFFFFF', T, 1.2);
      var y0 = -d / 2 + 48;
      s += rr(-w / 2 + 4, y0, w - 8, d / 2 + d / 2 - 52, 4, '#7F90AC', T, 1.2);      /* coberta */
      s += pa('M' + n(-w / 2 + 4) + ' ' + n(y0 + 14) + ' Q ' + n(0) + ' ' + n(y0 + 4) + ' ' + n(w / 2 - 4) + ' ' + n(y0 + 14), 'none', '#5E6F8C', 1.4);   /* dobra */
      s += rr(-w / 2 + 4, y0, w - 8, 14, 3, '#96A6BF', 'none', 0);
      s += rr(-w / 2 - 2, -d / 2 - 5, w + 4, 6, 2, '#8B5E3C');                       /* cabeceira */
      return s;
    },
    berco: function (w, d) {
      var s = rr(-w / 2, -d / 2, w, d, 6, '#F0E6D8');
      s += rr(-w / 2 + 6, -d / 2 + 6, w - 12, d - 12, 4, '#FFFFFF', T, 1.2);
      for (var x = -w / 2 + 12; x < w / 2 - 6; x += 9) s += ln(x, -d / 2 + 1, x, -d / 2 + 6, T, .8);
      for (var x2 = -w / 2 + 12; x2 < w / 2 - 6; x2 += 9) s += ln(x2, d / 2 - 6, x2, d / 2 - 1, T, .8);
      s += rr(-w / 2 + 12, -d / 2 + 12, w - 24, 20, 6, '#F3F5F7', T, 1);
      return s;
    },
    sofa: function (w, d) {
      var s = rr(-w / 2, -d / 2, w, d, 8, '#6E7F9A');                                       /* corpo */
      var nc = Math.max(1, Math.round((w - 32) / 68)), cw = (w - 32) / nc;
      for (var i = 0; i < nc; i++) s += rr(-w / 2 + 16 + i * cw + 2, -d / 2 + 18, cw - 4, d - 22, 6, '#8FA0BA', T, 1.2);   /* almofadas de assento */
      s += rr(-w / 2 + 16, -d / 2 + 3, w - 32, 13, 4, '#7C8DA7', T, 1.1);                    /* encosto */
      s += rr(-w / 2 + 3, -d / 2 + 3, 11, d - 6, 5, '#7C8DA7', T, 1.1);                        /* braços */
      s += rr(w / 2 - 14, -d / 2 + 3, 11, d - 6, 5, '#7C8DA7', T, 1.1);
      if (w >= 150) s += '<g transform="translate(' + n(-w / 2 + 34) + ' ' + n(-d / 2 + 34) + ') rotate(18)">' + rr(-11, -11, 22, 22, 4, '#DCCFB6', T, 1.1) + '</g>';   /* almofada solta */
      return s;
    },
    poltrona: function (w, d) {
      var s = rr(-w / 2, -d / 2, w, d, 10, '#9C8D7A');
      s += rr(-w / 2 + 14, -d / 2 + 16, w - 28, d - 20, 7, '#B8A88F', T, 1.2);
      s += rr(-w / 2 + 3, -d / 2 + 3, 10, d - 6, 5, '#A89984', T, 1.1); s += rr(w / 2 - 13, -d / 2 + 3, 10, d - 6, 5, '#A89984', T, 1.1);
      s += rr(-w / 2 + 14, -d / 2 + 3, w - 28, 12, 4, '#A89984', T, 1.1);
      return s;
    },
    mesaRedonda: function (w, d) {
      var r = Math.min(w, d) / 2;
      var s = ci(0, 0, r, '#C9A97C'); s += ci(0, 0, r - 6, 'none', '#A98657', 1);
      s += ci(0, 0, r * .22, '#EFE7D6', T, 1.1);
      return s;
    },
    rack: function (w, d) {
      var s = rr(-w / 2, -d / 2, w, d, 3, '#A27B52');
      s += ln(-w / 2 + 6, 0, w / 2 - 6, 0, '#7A5230', 1); s += ln(0, -d / 2 + 4, 0, d / 2 - 4, '#7A5230', 1);
      s += rr(-w * .34, -d / 2 + 4, w * .68, 6, 1.5, '#1B1F24');   /* TV em cima */
      return s;
    },
    estante: function (w, d) {
      var s = rr(-w / 2, -d / 2, w, d, 2, '#B08A5E');
      var cores = ['#C4553B', '#3D6E9E', '#E0B44C', '#4E9A5D', '#8B5E9E'], x = -w / 2 + 6, i = 0;
      while (x < w / 2 - 8) { var lw = 5 + (i % 3) * 2; s += rr(x, -d / 2 + 4, lw, d - 8, 1, cores[i % cores.length], T, .8); x += lw + 2; i++; }
      return s;
    },
    tapete: function (w, d) {
      var s = rr(-w / 2, -d / 2, w, d, 4, '#DDD3C4', '#B7AA98', 1.2);
      s += rr(-w / 2 + 10, -d / 2 + 10, w - 20, d - 20, 3, 'none', '#B7AA98', 1);
      s += rr(-w / 2 + 20, -d / 2 + 20, w - 40, d - 40, 2, '#E8E0D3', 'none', 0);
      return s;
    },
    tapeteRedondo: function (w, d) {
      var r = Math.min(w, d) / 2;
      return ci(0, 0, r, '#DDD3C4', '#B7AA98', 1.2) + ci(0, 0, r - 10, 'none', '#B7AA98', 1) + ci(0, 0, r - 20, '#E8E0D3', 'none', 0);
    },
    planta: function (w, d) {
      var r = Math.min(w, d) / 2, s = ci(0, 0, r * .55, '#A4753F');
      var cores = ['#3B7D48', '#4E9A5D', '#5FAE6A', '#3B7D48', '#4E9A5D', '#6BBA75'];
      for (var i = 0; i < 6; i++) {
        var a = i * 60 + 15;
        s += '<g transform="rotate(' + a + ')">' + el(r * .5, 0, r * .5, r * .22, cores[i], '#2E6039', 1) + ln(r * .12, 0, r * .9, 0, '#2E6039', .8) + '</g>';
      }
      return s;
    },
    arvore: function (w, d) {
      var r = Math.min(w, d) / 2, s = ci(r * .08, r * .08, r, '#000', 'none', 0).replace('fill="#000"', 'fill="rgba(0,0,0,.12)"');
      s += ci(0, 0, r, '#4E9A5D', '#2E6039', 1.6);
      s += ci(-r * .3, -r * .25, r * .45, '#6BBA75', 'none', 0); s += ci(r * .3, r * .2, r * .35, '#3B7D48', 'none', 0);
      s += ci(0, 0, r * .1, '#6F4E37', '#4B3323', 1);
      return s;
    },
    luminaria: function (w, d) {
      var r = Math.min(w, d) / 2;
      return ci(0, 0, r, '#EFE7D6') + ci(0, 0, r * .55, 'none', '#B7AA98', 1) + ci(0, 0, 3, '#25282C', 'none', 0);
    },
    mesa: function (w, d) {
      var s = rr(-w / 2, -d / 2, w, d, 6, '#C9A97C');
      s += rr(-w / 2 + 6, -d / 2 + 6, w - 12, d - 12, 4, 'none', '#A98657', 1);
      for (var i = 1; i < 4; i++) s += ln(-w / 2 + 10, -d / 2 + d * i / 4, w / 2 - 10, -d / 2 + d * i / 4, '#B99568', .8);
      return s;
    },
    cadeira: function (w, d) {
      var s = rr(-w / 2 + 2, -d / 2 + 8, w - 4, d - 10, 6, '#D7C6A9');
      s += rr(-w / 2, -d / 2, w, 9, 3, '#A27B52');
      s += rr(-w / 2 + 8, -d / 2 + 14, w - 16, d - 22, 4, 'none', '#B7A283', 1);
      return s;
    },
    cadeiraEscr: function (w, d) {
      var s = ci(0, d * .1, w * .48, '#B9BEC4', T, 1.1);
      for (var i = 0; i < 5; i++) s += '<g transform="rotate(' + (i * 72 + 90) + ')">' + ln(0, 0, w * .46, 0, '#7D838A', 2.2) + '</g>';
      s += rr(-w / 2 + 6, -d / 2 + 10, w - 12, d - 16, 9, '#3A3F45');
      s += rr(-w / 2 + 4, -d / 2, w - 8, 12, 5, '#2C3136');
      return s;
    },
    buffet: function (w, d) {
      var s = rr(-w / 2, -d / 2, w, d, 3, '#A27B52');
      s += ln(-w / 3, -d / 2 + 4, -w / 3, d / 2 - 4, '#7A5230', 1); s += ln(w / 3, -d / 2 + 4, w / 3, d / 2 - 4, '#7A5230', 1);
      s += ci(-w * .15, d * .1, 9, '#EFE7D6', T, 1); s += rr(w * .12, -d * .25, w * .28, d * .5, 2, '#C4553B', T, 1);
      return s;
    },
    aparador: function (w, d) {
      var s = rr(-w / 2, -d / 2, w, d, 3, '#A27B52');
      s += ci(-w * .25, 0, 8, '#EFE7D6', T, 1); s += rr(w * .05, -d * .3, w * .3, d * .6, 2, '#D7C6A9', T, 1);
      return s;
    },
    bancada: function (w, d) {
      var s = rr(-w / 2, -d / 2, w, d, 2, '#DCDCD6');
      s += ln(-w / 2 + 3, d / 2 - 5, w / 2 - 3, d / 2 - 5, '#B9B9B3', 1);
      return s;
    },
    pia: function (w, d) {
      var s = rr(-w / 2, -d / 2, w, d, 2, '#DCDCD6');
      s += rr(-w * .38, -d * .28, w * .76, d * .56, 6, '#C5CBD0', T, 1.2);
      s += ci(0, d * .02, 3.5, '#8A9399', T, .8);
      s += ci(0, -d / 2 + 8, 4, '#A6ACB2', T, 1); s += ln(0, -d / 2 + 8, 0, -d * .18, '#A6ACB2', 3);
      return s;
    },
    fogao: function (w, d) {
      var s = rr(-w / 2, -d / 2, w, d, 2, '#EDEDEB');
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (p) {
        var cx = p[0] * w * .24, cy = p[1] * d * .22;
        s += ci(cx, cy, Math.min(w, d) * .16, '#3A3F45', T, 1); s += ci(cx, cy, Math.min(w, d) * .07, '#6B7178', 'none', 0);
      });
      s += rr(-w / 2 + 4, d / 2 - 7, w - 8, 4, 1, '#B9BEC4', 'none', 0);
      return s;
    },
    geladeira: function (w, d) {
      var s = rr(-w / 2, -d / 2, w, d, 4, '#E4E7EA');
      s += ln(-w / 2 + 4, d / 2 - 6, w / 2 - 4, d / 2 - 6, '#AEB5BC', 1.2);
      s += ln(-w * .3, d / 2 - 12, -w * .3, d / 2 - 2, '#7D838A', 2.4);
      s += rr(-w / 2 + 6, -d / 2 + 6, w - 12, d - 20, 2, 'none', '#C7CCD1', 1);
      return s;
    },
    criado: function (w, d) {
      return rr(-w / 2, -d / 2, w, d, 3, '#C9A97C') + ci(0, 0, Math.min(w, d) * .3, '#EFE7D6', T, 1.1) + ci(0, 0, 2.5, '#25282C', 'none', 0);
    },
    guardaRoupa: function (w, d) {
      var s = rr(-w / 2, -d / 2, w, d, 2, '#B08A5E'), np = Math.max(2, Math.round(w / 50));
      for (var i = 1; i < np; i++) s += ln(-w / 2 + w * i / np, -d / 2 + 3, -w / 2 + w * i / np, d / 2 - 3, '#7A5230', 1);
      for (var j = 0; j < np; j++) s += ln(-w / 2 + w * (j + .5) / np - 4, d / 2 - 6, -w / 2 + w * (j + .5) / np + 4, d / 2 - 6, '#3A3F45', 1.6);
      return s;
    },
    comoda: function (w, d) {
      var s = rr(-w / 2, -d / 2, w, d, 3, '#B08A5E');
      s += ln(-w * .2, d / 2 - 6, w * .2, d / 2 - 6, '#3A3F45', 1.6);
      s += ci(-w * .3, 0, 8, '#EFE7D6', T, 1); s += rr(w * .1, -d * .3, w * .3, d * .6, 2, '#4E9A5D', T, 1);
      return s;
    },
    vaso: function (w, d) {
      var s = rr(-w / 2, -d / 2, w, 15, 3, '#FFFFFF');
      s += el(0, -d / 2 + 15 + (d - 17) / 2, w / 2 - 2, (d - 17) / 2, '#FFFFFF');
      s += el(0, -d / 2 + 15 + (d - 17) / 2, w / 2 - 9, (d - 17) / 2 - 7, '#E6EEF3', '#B9C4CC', 1);
      return s;
    },
    lavatorio: function (w, d) {
      var s = rr(-w / 2, -d / 2, w, d, 4, '#E9ECEF');
      s += el(0, d * .06, w * .36, d * .3, '#FFFFFF'); s += ci(0, d * .06, 3, '#8A9399', T, .8);
      s += ci(0, -d / 2 + 8, 4, '#A6ACB2', T, 1);
      return s;
    },
    box: function (w, d) {
      var s = rr(-w / 2, -d / 2, w, d, 2, '#D7EBF2', T, 1.6);
      s += ln(-w / 2 + 6, d / 2 - 6, w / 2 - 6, -d / 2 + 6, '#9CC6D6', 1); s += ln(-w / 2 + 6, -d / 2 + 6, w / 2 - 6, d / 2 - 6, '#9CC6D6', 1);
      s += ci(0, 0, 4, '#8A9399', T, .8); s += ci(-w / 2 + 12, -d / 2 + 12, 5, '#A6ACB2', T, 1);
      return s;
    },
    banheira: function (w, d) {
      var s = rr(-w / 2, -d / 2, w, d, 14, '#FFFFFF');
      s += rr(-w / 2 + 8, -d / 2 + 8, w - 16, d - 16, 12, '#E4F1F6', '#B9C4CC', 1);
      s += ci(w / 2 - 18, 0, 3.5, '#8A9399', T, .8); s += ci(w / 2 - 6, 0, 3, '#A6ACB2', T, 1);
      return s;
    },
    escrivaninha: function (w, d) {
      var s = rr(-w / 2, -d / 2, w, d, 4, '#D7C6A9');
      s += rr(-w * .18, -d / 2 + 8, w * .36, 5, 1.5, '#1B1F24'); s += ln(0, -d / 2 + 13, 0, -d / 2 + 20, '#3A3F45', 2);
      s += rr(-w * .16, d * .05, w * .32, d * .2, 2, '#F3F5F7', T, 1); s += rr(w * .24, d * .02, w * .1, d * .2, 3, '#F3F5F7', T, 1);
      return s;
    },
    lavadora: function (w, d) {
      var s = rr(-w / 2, -d / 2, w, d, 4, '#F2F3F4');
      s += ci(0, d * .08, Math.min(w, d) * .34, '#C7D2DA', T, 1.2); s += ci(0, d * .08, Math.min(w, d) * .24, '#E6EEF3', '#9FB0BB', 1);
      s += rr(-w / 2 + 6, -d / 2 + 5, w - 12, 8, 2, '#D5DADF', T, .9); s += ci(w * .3, -d / 2 + 9, 2.5, '#3A3F45', 'none', 0);
      return s;
    },
    tanque: function (w, d) {
      var s = rr(-w / 2, -d / 2, w, d, 3, '#E9ECEF');
      s += rr(-w / 2 + 7, -d / 2 + 10, w - 14, d - 17, 5, '#FFFFFF'); s += ci(0, d * .12, 3, '#8A9399', T, .8);
      for (var i = 0; i < 5; i++) s += ln(-w * .3, -d * .28 + i * 6, w * .3, -d * .28 + i * 6, '#C7CCD1', .9);
      s += ci(0, -d / 2 + 6, 3.5, '#A6ACB2', T, 1);
      return s;
    },
    armario: function (w, d) {
      var s = rr(-w / 2, -d / 2, w, d, 2, '#B08A5E');
      s += ln(0, -d / 2 + 3, 0, d / 2 - 3, '#7A5230', 1); s += ln(-6, d / 2 - 6, -2, d / 2 - 6, '#3A3F45', 1.6); s += ln(2, d / 2 - 6, 6, d / 2 - 6, '#3A3F45', 1.6);
      return s;
    },
    carro: function (w, d) {
      var s = '';
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (p) { s += rr(p[0] * (w / 2 - 12) - 8, p[1] * (d / 2 - 62) - 16, 16, 32, 4, '#1E1F22', 'none', 0); });
      s += pa('M' + n(-w / 2 + 16) + ' ' + n(-d / 2) + ' H' + n(w / 2 - 16) + ' Q' + n(w / 2) + ' ' + n(-d / 2) + ' ' + n(w / 2) + ' ' + n(-d / 2 + 16) +
        ' V' + n(d / 2 - 14) + ' Q' + n(w / 2) + ' ' + n(d / 2) + ' ' + n(w / 2 - 14) + ' ' + n(d / 2) + ' H' + n(-w / 2 + 14) + ' Q' + n(-w / 2) + ' ' + n(d / 2) + ' ' + n(-w / 2) + ' ' + n(d / 2 - 14) +
        ' V' + n(-d / 2 + 16) + ' Q' + n(-w / 2) + ' ' + n(-d / 2) + ' ' + n(-w / 2 + 16) + ' ' + n(-d / 2) + 'Z', '#4A6FA5');
      s += rr(-w / 2 + 12, -d * .28, w - 24, d * .5, 14, '#3B5A87', T, 1);                    /* teto */
      s += pa('M' + n(-w / 2 + 16) + ' ' + n(-d * .28) + ' L' + n(-w / 2 + 24) + ' ' + n(-d * .42) + ' H' + n(w / 2 - 24) + ' L' + n(w / 2 - 16) + ' ' + n(-d * .28) + 'Z', '#BFD7E8', T, 1);   /* para-brisa */
      s += pa('M' + n(-w / 2 + 16) + ' ' + n(d * .22) + ' L' + n(-w / 2 + 24) + ' ' + n(d * .34) + ' H' + n(w / 2 - 24) + ' L' + n(w / 2 - 16) + ' ' + n(d * .22) + 'Z', '#BFD7E8', T, 1);
      s += rr(-w * .3, -d / 2 + 3, w * .12, 6, 2, '#F6F0C8', T, .8); s += rr(w * .18, -d / 2 + 3, w * .12, 6, 2, '#F6F0C8', T, .8);
      return s;
    },
    churrasqueira: function (w, d) {
      var s = rr(-w / 2, -d / 2, w, d, 2, '#B9B1A5');
      s += rr(-w * .3, -d * .3, w * .6, d * .6, 2, '#3A3F45');
      for (var i = 1; i < 6; i++) s += ln(-w * .3 + w * .6 * i / 6, -d * .28, -w * .3 + w * .6 * i / 6, d * .28, '#8A9399', 1);
      s += rr(w * .34, -d * .35, w * .12, d * .7, 1, '#D8B98C', T, 1);
      return s;
    },
    espreguicadeira: function (w, d) {
      var s = rr(-w / 2, -d / 2, w, d, 7, '#EFE7D6');
      for (var i = 1; i < 7; i++) s += ln(-w / 2 + 6, -d / 2 + d * i / 7, w / 2 - 6, -d / 2 + d * i / 7, '#C9BFA9', 1);
      s += rr(-w / 2 + 5, -d / 2 + 5, w - 10, d * .22, 5, '#D9CDB5', T, 1);
      return s;
    },
    caixa: function (w, d) { return rr(-w / 2, -d / 2, w, d, 3, '#D9D9D4'); },

    /* ---------- figurinhas novas (23/09) ---------- */
    eletro: function (w, d) {   /* eletrodoméstico genérico: corpo + visor + botões */
      var s = rr(-w / 2, -d / 2, w, d, 3, '#E4E7EA');
      s += rr(-w / 2 + 5, -d / 2 + 5, w - 10, d * .45, 2, '#39414A', T, 1);
      for (var i = 0; i < 3; i++) s += ci(-w / 2 + 10 + i * 9, d / 2 - 8, 2.6, '#8A9399', T, .9);
      return s;
    },
    cooktop: function (w, d) {   /* vidro preto com 4 bocas */
      var s = rr(-w / 2, -d / 2, w, d, 3, '#22262B');
      var pts = [[-.26, -.22], [.26, -.22], [-.26, .22], [.26, .22]];
      pts.forEach(function (p) { s += ci(p[0] * w, p[1] * d, Math.min(w, d) * .14, '#3A4149', '#697079', 1.2); });
      return s;
    },
    coifa: function (w, d) {   /* trapézio visto de cima, com a boca de sucção */
      var s = pa('M' + n(-w / 2) + ' ' + n(-d / 2) + ' H' + n(w / 2) + ' L' + n(w * .35) + ' ' + n(d / 2) + ' H' + n(-w * .35) + ' Z', '#C9CED3');
      s += rr(-w * .28, -d * .18, w * .56, d * .42, 3, '#8A9399', T, 1.2);
      return s;
    },
    adega: function (w, d) {   /* porta de vidro e garrafas deitadas */
      var s = rr(-w / 2, -d / 2, w, d, 3, '#2E3338');
      s += rr(-w / 2 + 4, -d / 2 + 4, w - 8, d - 8, 2, '#5E6F7A', T, 1);
      for (var y = -d / 2 + 10; y < d / 2 - 6; y += 8) s += ln(-w / 2 + 7, y, w / 2 - 7, y, '#B9C4CB', 1.1);
      return s;
    },
    bancoJardim: function (w, d) {
      var s = rr(-w / 2, -d / 2, w, d, 3, '#8B5E3C');
      for (var i = 1; i < 4; i++) s += ln(-w / 2 + 3, -d / 2 + d * i / 4, w / 2 - 3, -d / 2 + d * i / 4, '#6B4423', 1.3);
      return s;
    },
    guardaSol: function (w, d) {   /* círculo com gomos */
      var r = Math.min(w, d) / 2, s = ci(0, 0, r, '#E9E2D2');
      for (var a = 0; a < 8; a++) s += ln(0, 0, r * Math.cos(a * Math.PI / 4), r * Math.sin(a * Math.PI / 4), '#C2B89F', 1.2);
      s += ci(0, 0, r * .12, '#8B5E3C', T, 1.2);
      return s;
    },
    jacuzzi: function (w, d) {
      var s = rr(-w / 2, -d / 2, w, d, 10, '#CDE7EF');
      s += rr(-w / 2 + 7, -d / 2 + 7, w - 14, d - 14, 8, '#9FD3E4', T, 1.2);
      for (var a2 = 0; a2 < 8; a2++) s += ci(Math.cos(a2 * Math.PI / 4) * (w / 2 - 12), Math.sin(a2 * Math.PI / 4) * (d / 2 - 12), 2.4, '#FFFFFF', '#7FB6C9', 1);
      return s;
    },
    escorregador: function (w, d) {
      var s = rr(-w / 2, -d / 2, w * .5, d, 4, '#E4B23C');
      s += pa('M' + n(0) + ' ' + n(-d / 2 + 6) + ' Q ' + n(w / 2) + ' ' + n(0) + ' ' + n(w / 2 - 4) + ' ' + n(d / 2 - 6), 'none', '#4E9A5D', 5);
      for (var i2 = 1; i2 < 4; i2++) s += ln(-w / 2 + 4, -d / 2 + d * i2 / 4, -w / 2 + w * .5 - 4, -d / 2 + d * i2 / 4, '#B5883C', 1.2);
      return s;
    },
    esteira: function (w, d) {
      var s = rr(-w / 2, -d / 2, w, d, 4, '#3A4149');
      s += rr(-w / 2 + 5, -d / 2 + d * .3, w - 10, d * .62, 3, '#22262B', T, 1);
      s += rr(-w / 2 + 6, -d / 2 + 2, w - 12, d * .22, 3, '#8A9399', T, 1);
      return s;
    },
    aparelho: function (w, d) {   /* equipamento de academia genérico */
      var s = rr(-w / 2, -d / 2, w, d, 4, '#4A525A');
      s += rr(-w * .3, -d * .12, w * .6, d * .24, 3, '#22262B', T, 1);
      s += ci(-w / 2 + 8, d / 2 - 8, 4, '#C4553B', T, 1); s += ci(w / 2 - 8, d / 2 - 8, 4, '#C4553B', T, 1);
      return s;
    },
    tatame: function (w, d) {
      var s = rr(-w / 2, -d / 2, w, d, 2, '#4E7A6B');
      for (var x = -w / 2; x < w / 2 - 1; x += w / 3) for (var y2 = -d / 2; y2 < d / 2 - 1; y2 += d / 3) s += rr(x + 1, y2 + 1, w / 3 - 2, d / 3 - 2, 1, '#5C8C7B', '#3E6156', 1);
      return s;
    },
    arara: function (w, d) {   /* arara de roupas: barra + cabides */
      var s = ln(-w / 2 + 3, 0, w / 2 - 3, 0, '#8A9399', 3);
      for (var x2 = -w / 2 + 8; x2 < w / 2 - 6; x2 += 7) s += pa('M' + n(x2) + ' ' + n(-d * .2) + ' l' + n(-4) + ' ' + n(d * .4) + ' M' + n(x2) + ' ' + n(-d * .2) + ' l4 ' + n(d * .4), 'none', '#B9C4CB', 1.1);
      s += ci(-w / 2 + 3, 0, 3, '#8A9399', T, 1); s += ci(w / 2 - 3, 0, 3, '#8A9399', T, 1);
      return s;
    },
    gondola: function (w, d) {   /* prateleira de loja, dupla face */
      var s = rr(-w / 2, -d / 2, w, d, 2, '#D6DADF');
      s += ln(-w / 2, 0, w / 2, 0, T, 1.4);
      for (var i3 = 1; i3 < 5; i3++) s += ln(-w / 2 + w * i3 / 5, -d / 2, -w / 2 + w * i3 / 5, d / 2, '#9AA3AB', 1);
      return s;
    },
    balcaoL: function (w, d) {   /* balcão de atendimento em L */
      var s = pa('M' + n(-w / 2) + ' ' + n(-d / 2) + ' H' + n(w / 2) + ' V' + n(-d / 2 + d * .45) + ' H' + n(-w / 2 + w * .45) + ' V' + n(d / 2) + ' H' + n(-w / 2) + ' Z', '#B58B5C');
      s += pa('M' + n(-w / 2 + 4) + ' ' + n(-d / 2 + 4) + ' H' + n(w / 2 - 4) + ' V' + n(-d / 2 + d * .45 - 4) + ' H' + n(-w / 2 + w * .45 - 4) + ' V' + n(d / 2 - 4) + ' H' + n(-w / 2 + 4) + ' Z', '#D6B48C', T, 1);
      return s;
    },
    manequim: function (w, d) {
      var r2 = Math.min(w, d) / 2;
      var s = el(0, -r2 * .2, r2 * .75, r2 * .5, '#E4E0D8');
      s += ci(0, r2 * .45, r2 * .35, '#D6D2C8', T, 1.2);
      s += ci(0, 0, r2 * .12, '#8A9399', T, 1);
      return s;
    },
    penteadeira: function (w, d) {
      var s = rr(-w / 2, -d / 2, w, d, 2, '#E9E2D2');
      s += rr(-w * .3, -d / 2 + 2, w * .6, 5, 2, '#BFD4DD', T, 1);   /* espelho encostado na parede */
      s += ln(-w / 2 + 4, d / 2 - 6, w / 2 - 4, d / 2 - 6, '#C2B89F', 1.2);
      return s;
    },
    pufe: function (w, d) { return ci(0, 0, Math.min(w, d) / 2, '#C98C6B') + ci(0, 0, Math.min(w, d) / 2 - 5, '#E0A882', T, 1); },
    lareira: function (w, d) {
      var s = rr(-w / 2, -d / 2, w, d, 2, '#B9B1A5');
      s += rr(-w * .32, -d * .1, w * .64, d * .5, 2, '#3A2F28', T, 1);
      s += pa('M' + n(-w * .18) + ' ' + n(d * .3) + ' q ' + n(w * .18) + ' ' + n(-d * .3) + ' ' + n(w * .36) + ' 0', 'none', '#E4884F', 2);
      return s;
    },
    ducha: function (w, d) {
      var r = Math.min(w, d) / 2, s = ci(0, 0, r, '#D6DADF');
      s += ci(0, 0, r * .55, '#9AA3AB', T, 1.2);
      for (var a = 0; a < 8; a++) s += ci(Math.cos(a * Math.PI / 4) * r * .3, Math.sin(a * Math.PI / 4) * r * .3, 1.4, '#FFFFFF', '#6B7885', .8);
      return s;
    },
    escadaPiscina: function (w, d) {
      var s = rr(-w / 2, -d / 2, w, d, 3, 'none', '#8A9399', 1.2);
      s += ln(-w / 2 + 6, -d / 2, -w / 2 + 6, d / 2, '#A6ACB2', 3) + ln(w / 2 - 6, -d / 2, w / 2 - 6, d / 2, '#A6ACB2', 3);
      for (var i = 1; i < 4; i++) s += ln(-w / 2 + 6, -d / 2 + d * i / 4, w / 2 - 6, -d / 2 + d * i / 4, '#C9CED3', 2.4);
      return s;
    },
    moto: function (w, d) {
      var s = el(0, 0, w * .28, d * .34, '#5C6B78');
      s += rr(-w * .14, -d / 2 + 4, w * .28, d * .18, 4, '#25282C', T, 1.2);
      s += rr(-w * .16, d / 2 - d * .22, w * .32, d * .18, 4, '#25282C', T, 1.2);
      s += ln(-w / 2 + 4, -d / 2 + d * .3, w / 2 - 4, -d / 2 + d * .3, '#8A9399', 2.4);
      return s;
    },
    bicicleta: function (w, d) {
      var s = ci(0, -d / 2 + d * .16, d * .14, 'none', '#3A4149', 2);
      s += ci(0, d / 2 - d * .16, d * .14, 'none', '#3A4149', 2);
      s += ln(0, -d / 2 + d * .16, 0, d / 2 - d * .16, '#2F5D8A', 2.4);
      s += ln(-w / 2 + 3, -d / 2 + d * .16, w / 2 - 3, -d / 2 + d * .16, '#3A4149', 2);
      return s;
    },
    espelho: function (w, d) {
      var s = rr(-w / 2, -d / 2, w, Math.max(d, 4), 1, '#BFD4DD', T, 1.4);
      s += ln(-w / 2 + 6, 0, w / 2 - 6, 0, '#FFFFFF', 1.4);
      return s;
    },
    quadro: function (w, d) {
      var s = rr(-w / 2, -d / 2, w, Math.max(d, 4), 1, '#8B5E3C', T, 1.4);
      s += ln(-w / 2 + 4, 0, w / 2 - 4, 0, '#E9E2D2', 1.6);
      return s;
    },
    cortina: function (w, d) {
      var s = '';
      for (var x = -w / 2; x < w / 2 - 4; x += 8) s += pa('M' + n(x) + ' ' + n(-d / 2) + ' q 4 ' + n(d / 2) + ' 0 ' + n(d), 'none', '#C2B89F', 2);
      s += ln(-w / 2, -d / 2, w / 2, -d / 2, '#8A9399', 2);
      return s;
    },
    cercaViva: function (w, d) {
      var s = rr(-w / 2, -d / 2, w, d, 4, '#6AA24C');
      for (var x2 = -w / 2 + 6; x2 < w / 2 - 3; x2 += 12) s += ci(x2, 0, 5, '#4F8A3E', 'none', 0);
      return s;
    },
    lixeira: function (w, d) {
      var r2 = Math.min(w, d) / 2;
      return ci(0, 0, r2, '#5C6B78') + ci(0, 0, r2 - 4, '#8A9399', T, 1.2) + ln(-r2 * .4, 0, r2 * .4, 0, '#3A4149', 1.6);
    },
    varal: function (w, d) {
      var s = rr(-w / 2, -d / 2, w, d, 2, 'none', '#8A9399', 1.4);
      for (var y3 = -d / 2 + 6; y3 < d / 2 - 2; y3 += 8) s += ln(-w / 2 + 3, y3, w / 2 - 3, y3, '#B9C4CB', 1.3);
      return s;
    },

    /* ---------- veículos, eletrônicos, palco e instalações (23/09) ---------- */
    veiculo: function (w, d) {   /* silhueta vista de cima: capô, cabine, rodas */
      var s = rr(-w / 2, -d / 2, w, d, Math.min(w, d) * .18, '#8FA3B5');
      s += rr(-w * .42, -d * .12, w * .84, d * .46, 6, '#2C3A44', T, 1.2);   /* vidros */
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (p) { s += rr(p[0] * (w / 2 - 3) - 3, p[1] * (d * .3) - 7, 6, 14, 2, '#1E1F22', 'none', 0); });
      return s;
    },
    caminhao: function (w, d) {
      var s = rr(-w / 2, -d / 2, w, d * .28, 3, '#5C6B78');                  /* cabine */
      s += rr(-w / 2, -d / 2 + d * .3, w, d * .7, 3, '#E4E7EA', T, 1.4);     /* baú */
      for (var i = 1; i < 5; i++) s += ln(-w / 2, -d / 2 + d * .3 + d * .7 * i / 5, w / 2, -d / 2 + d * .3 + d * .7 * i / 5, '#B9C4CB', 1.1);
      return s;
    },
    camera: function (w, d) {   /* corpo + cone de visão */
      var s = pa('M0 0 L' + n(-w * .7) + ' ' + n(d * 1.1) + ' A ' + n(w) + ' ' + n(d) + ' 0 0 0 ' + n(w * .7) + ' ' + n(d * 1.1) + ' Z', '#22B8D6', 'none', 0);
      s = '<g opacity=".25">' + s + '</g>';
      s += rr(-w / 2, -d / 2, w, d, 2, '#3A4149');
      s += ci(0, d * .18, Math.min(w, d) * .2, '#0B0E11', '#8A9399', 1);
      return s;
    },
    tv: function (w, d) {
      var s = rr(-w / 2, -Math.max(d, 4) / 2, w, Math.max(d, 4), 1, '#22262B');
      s += ln(-w / 2 + 4, 0, w / 2 - 4, 0, '#5E6F7A', 1.6);
      return s;
    },
    somCaixa: function (w, d) {
      var s = rr(-w / 2, -d / 2, w, d, 3, '#3A4149');
      s += ci(0, -d * .15, Math.min(w, d) * .3, '#22262B', '#8A9399', 1.2);
      s += ci(0, d * .28, Math.min(w, d) * .14, '#22262B', '#8A9399', 1);
      return s;
    },
    mesaSom: function (w, d) {
      var s = rr(-w / 2, -d / 2, w, d, 3, '#2E3338');
      for (var x = -w / 2 + 8; x < w / 2 - 4; x += 10) s += ln(x, -d * .2, x, d * .3, '#8A9399', 2.2);
      s += rr(-w / 2 + 5, -d / 2 + 4, w - 10, d * .18, 2, '#22B8D6', 'none', 0);
      return s;
    },
    palco: function (w, d) {
      var s = rr(-w / 2, -d / 2, w, d, 2, '#4A3A2C');
      for (var x2 = -w / 2 + 20; x2 < w / 2 - 10; x2 += 20) s += ln(x2, -d / 2 + 3, x2, d / 2 - 3, '#6B5343', 1.1);
      s += rr(-w / 2 + 3, -d / 2 + 3, w - 6, d - 6, 1, 'none', '#E4B23C', 1.6);
      return s;
    },
    trelica: function (w, d) {
      var s = rr(-w / 2, -d / 2, w, d, 1, 'none', '#8A9399', 2);
      for (var x3 = -w / 2; x3 < w / 2 - 4; x3 += 14) s += pa('M' + n(x3) + ' ' + n(-d / 2) + ' L' + n(x3 + 14) + ' ' + n(d / 2) + ' M' + n(x3 + 14) + ' ' + n(-d / 2) + ' L' + n(x3) + ' ' + n(d / 2), 'none', '#A6ACB2', 1.1);
      return s;
    },
    arSplit: function (w, d) {
      var s = rr(-w / 2, -d / 2, w, d, Math.min(w, d) * .3, '#F2F4F6');
      for (var x4 = -w / 2 + 6; x4 < w / 2 - 4; x4 += 7) s += ln(x4, -d * .1, x4, d * .3, '#C9CED3', 1.1);
      return s;
    },
    arCassete: function (w, d) {
      var s = rr(-w / 2, -d / 2, w, d, 3, '#F2F4F6');
      s += rr(-w * .3, -d * .3, w * .6, d * .6, 2, '#D6DADF', T, 1);
      for (var a = 0; a < 4; a++) s += ln(a % 2 ? -w / 2 + 4 : w / 2 - 4, a < 2 ? -d / 2 + 4 : d / 2 - 4, a % 2 ? -w * .3 : w * .3, a < 2 ? -d * .3 : d * .3, '#9AA3AB', 1.2);
      return s;
    },
    exaustor: function (w, d) {
      var r = Math.min(w, d) / 2, s = ci(0, 0, r, '#D6DADF');
      for (var a2 = 0; a2 < 6; a2++) s += pa('M0 0 q ' + n(r * .8 * Math.cos(a2 * Math.PI / 3)) + ' ' + n(r * .3 * Math.sin(a2 * Math.PI / 3)) + ' ' + n(r * .9 * Math.cos(a2 * Math.PI / 3 + .5)) + ' ' + n(r * .9 * Math.sin(a2 * Math.PI / 3 + .5)), 'none', '#8A9399', 1.6);
      s += ci(0, 0, r * .18, '#5C6B78', T, 1);
      return s;
    },
    caixaAgua: function (w, d) {
      var r2 = Math.min(w, d) / 2, s = ci(0, 0, r2, '#BFD4DD');
      s += ci(0, 0, r2 * .72, '#D8E7EE', T, 1.2);
      s += ci(0, -r2 * .45, r2 * .18, '#8FA3B1', T, 1);
      return s;
    },
    placaSolar: function (w, d) {
      var s = rr(-w / 2, -d / 2, w, d, 2, '#2B3A4A');
      for (var x5 = -w / 2 + 6; x5 < w / 2 - 3; x5 += 12) s += ln(x5, -d / 2 + 3, x5, d / 2 - 3, '#5E7A94', 1.2);
      for (var y4 = -d / 2 + 8; y4 < d / 2 - 3; y4 += 12) s += ln(-w / 2 + 3, y4, w / 2 - 3, y4, '#5E7A94', 1.2);
      return s;
    },
    quadroEnergia: function (w, d) {
      var s = rr(-w / 2, -d / 2, w, d, 2, '#E4E7EA');
      s += rr(-w * .3, -d * .2, w * .6, d * .5, 1, '#3A4149', T, 1);
      for (var i2 = 0; i2 < 4; i2++) s += rr(-w * .26 + i2 * w * .15, -d * .12, w * .1, d * .2, 1, '#F2C14E', 'none', 0);
      return s;
    },
    vitrineLoja: function (w, d) {
      var s = rr(-w / 2, -d / 2, w, d, 2, '#CFE9F2');
      s += rr(-w / 2 + 3, -d / 2 + 3, w - 6, d - 6, 1, '#EAF6FA', T, 1);
      for (var x6 = -w / 2 + w / 4; x6 < w / 2 - 2; x6 += w / 4) s += ln(x6, -d / 2 + 3, x6, d / 2 - 3, '#8FA3B1', 1.4);
      return s;
    }
  };

  /* ---------- categorias ---------- */
  var CATS = [
    {k:'sala',       rot:'Sala de estar', capa:'sofa3'},
    {k:'jantar',     rot:'Jantar',        capa:'mesa6'},
    {k:'cozinha',    rot:'Cozinha',       capa:'fogao'},
    {k:'quarto',     rot:'Quarto',        capa:'camaCasal'},
    {k:'infantil',   rot:'Infantil',      capa:'camaInfantil'},
    {k:'banheiro',   rot:'Banheiro',      capa:'vaso'},
    {k:'escritorio', rot:'Escritório',    capa:'escrivaninha'},
    {k:'servico',    rot:'Serviço',       capa:'lavadora'},
    {k:'externo',    rot:'Externo',       capa:'carro'},
    {k:'lazer',      rot:'Lazer e piscina', capa:'jacuzzi'},
    {k:'academia',   rot:'Academia',      capa:'esteira'},
    {k:'comercial',  rot:'Comércio',      capa:'balcaoAtend'},
    {k:'veiculos',   rot:'Veículos',      capa:'carro'},
    {k:'eletronicos',rot:'TV, som e câmeras', capa:'tv65'},
    {k:'palco',      rot:'Palco e eventos', capa:'palco'},
    {k:'instalacoes',rot:'Instalações',   capa:'arSplit'},
    {k:'decoracao',  rot:'Decoração',     capa:'planta'}
  ];

  /* ---------- itens: k → {nome, cat, w, d, alt, sym, m3d} ---------- */
  var ITENS = {
    sofa2:        {nome:'Sofá 2 lugares',      cat:'sala',       w:160, d:90,  alt:85,  sym:'sofa',          m3d:'sofa'},
    sofa3:        {nome:'Sofá 3 lugares',      cat:'sala',       w:220, d:90,  alt:85,  sym:'sofa',          m3d:'sofa'},
    poltrona:     {nome:'Poltrona',            cat:'sala',       w:80,  d:85,  alt:85,  sym:'poltrona',      m3d:'poltrona'},
    mesaCentro:   {nome:'Mesa de centro',      cat:'sala',       w:90,  d:90,  alt:40,  sym:'mesaRedonda',   m3d:'mesaRedonda'},
    rack:         {nome:'Rack com TV',         cat:'sala',       w:180, d:45,  alt:55,  sym:'rack',          m3d:'rack'},
    estante:      {nome:'Estante',             cat:'sala',       w:90,  d:35,  alt:200, sym:'estante',       m3d:'estante'},
    tapete:       {nome:'Tapete',              cat:'sala',       w:200, d:150, alt:1,   sym:'tapete',        m3d:'tapete'},
    mesa4:        {nome:'Mesa 4 lugares',      cat:'jantar',     w:140, d:90,  alt:75,  sym:'mesa',          m3d:'mesa'},
    mesa6:        {nome:'Mesa 6 lugares',      cat:'jantar',     w:180, d:100, alt:75,  sym:'mesa',          m3d:'mesa'},
    mesaRedonda:  {nome:'Mesa redonda',        cat:'jantar',     w:110, d:110, alt:75,  sym:'mesaRedonda',   m3d:'mesaRedondaAlta'},
    cadeira:      {nome:'Cadeira',             cat:'jantar',     w:45,  d:45,  alt:90,  sym:'cadeira',       m3d:'cadeira'},
    buffet:       {nome:'Buffet',              cat:'jantar',     w:160, d:45,  alt:80,  sym:'buffet',        m3d:'buffet'},
    bancada:      {nome:'Bancada',             cat:'cozinha',    w:180, d:60,  alt:90,  sym:'bancada',       m3d:'bancada'},
    pia:          {nome:'Pia',                 cat:'cozinha',    w:100, d:60,  alt:90,  sym:'pia',           m3d:'pia'},
    fogao:        {nome:'Fogão',               cat:'cozinha',    w:60,  d:60,  alt:90,  sym:'fogao',         m3d:'fogao'},
    geladeira:    {nome:'Geladeira',           cat:'cozinha',    w:70,  d:70,  alt:185, sym:'geladeira',     m3d:'geladeira'},
    ilha:         {nome:'Ilha',                cat:'cozinha',    w:150, d:80,  alt:90,  sym:'bancada',       m3d:'bancada'},
    camaCasal:    {nome:'Cama de casal',       cat:'quarto',     w:140, d:190, alt:55,  sym:'cama',          m3d:'cama'},
    camaQueen:    {nome:'Cama queen',          cat:'quarto',     w:160, d:200, alt:55,  sym:'cama',          m3d:'cama'},
    camaSolteiro: {nome:'Cama de solteiro',    cat:'quarto',     w:90,  d:190, alt:55,  sym:'cama',          m3d:'cama'},
    berco:        {nome:'Berço',               cat:'quarto',     w:70,  d:130, alt:90,  sym:'berco',         m3d:'berco'},
    criado:       {nome:'Criado-mudo',         cat:'quarto',     w:45,  d:40,  alt:50,  sym:'criado',        m3d:'criado'},
    guardaRoupa:  {nome:'Guarda-roupa',        cat:'quarto',     w:180, d:60,  alt:220, sym:'guardaRoupa',   m3d:'armario'},
    comoda:       {nome:'Cômoda',              cat:'quarto',     w:100, d:45,  alt:85,  sym:'comoda',        m3d:'comoda'},
    vaso:         {nome:'Vaso sanitário',      cat:'banheiro',   w:38,  d:68,  alt:42,  sym:'vaso',          m3d:'vaso'},
    lavatorio:    {nome:'Lavatório',           cat:'banheiro',   w:50,  d:45,  alt:85,  sym:'lavatorio',     m3d:'lavatorio'},
    box:          {nome:'Box de vidro',        cat:'banheiro',   w:90,  d:90,  alt:200, sym:'box',           m3d:'box'},
    banheira:     {nome:'Banheira',            cat:'banheiro',   w:170, d:75,  alt:55,  sym:'banheira',      m3d:'banheira'},
    escrivaninha: {nome:'Escrivaninha',        cat:'escritorio', w:140, d:70,  alt:75,  sym:'escrivaninha',  m3d:'escrivaninha'},
    cadeiraEscr:  {nome:'Cadeira giratória',   cat:'escritorio', w:55,  d:55,  alt:95,  sym:'cadeiraEscr',   m3d:'cadeiraEscr'},
    estanteLivros:{nome:'Estante de livros',   cat:'escritorio', w:90,  d:35,  alt:200, sym:'estante',       m3d:'estante'},
    lavadora:     {nome:'Máquina de lavar',    cat:'servico',    w:60,  d:60,  alt:85,  sym:'lavadora',      m3d:'lavadora'},
    tanque:       {nome:'Tanque',              cat:'servico',    w:60,  d:55,  alt:90,  sym:'tanque',        m3d:'tanque'},
    armarioServ:  {nome:'Armário',             cat:'servico',    w:80,  d:40,  alt:180, sym:'armario',       m3d:'armario'},
    prateleira:   {nome:'Prateleira',          cat:'servico',    w:90,  d:40,  alt:180, sym:'estante',       m3d:'prateleira'},
    carro:        {nome:'Carro (sedã)',         cat:'veiculos',   w:172, d:420, alt:145, sym:'carro',         m3d:'carro'},
    churrasqueira:{nome:'Churrasqueira',       cat:'externo',    w:120, d:60,  alt:210, sym:'churrasqueira', m3d:'churrasqueira'},
    mesaExt:      {nome:'Mesa externa',        cat:'externo',    w:120, d:80,  alt:75,  sym:'mesa',          m3d:'mesa'},
    espreguicadeira:{nome:'Espreguiçadeira',   cat:'externo',    w:60,  d:160, alt:35,  sym:'espreguicadeira', m3d:'espreguicadeira'},
    arvore:       {nome:'Árvore',              cat:'externo',    w:200, d:200, alt:350, sym:'arvore',        m3d:'arvore'},
    planta:       {nome:'Planta',              cat:'decoracao',  w:50,  d:50,  alt:110, sym:'planta',        m3d:'planta'},
    luminaria:    {nome:'Luminária de chão',   cat:'decoracao',  w:35,  d:35,  alt:160, sym:'luminaria',     m3d:'luminaria'},
    aparador:     {nome:'Aparador',            cat:'decoracao',  w:100, d:35,  alt:80,  sym:'aparador',      m3d:'buffet'},
    tapeteRedondo:{nome:'Tapete redondo',      cat:'decoracao',  w:120, d:120, alt:1,   sym:'tapeteRedondo', m3d:'tapeteRedondo'},

    /* ---------- itens novos (23/09) ---------- */
    /* sala */
    sofaCanto:    {nome:'Sofá de canto',       cat:'sala',       w:260, d:160, alt:85,  sym:'sofa',          m3d:'sofaCanto'},
    chaise:       {nome:'Chaise',              cat:'sala',       w:80,  d:160, alt:85,  sym:'espreguicadeira', m3d:'chaise'},
    pufe:         {nome:'Puff',                cat:'sala',       w:50,  d:50,  alt:42,  sym:'pufe',          m3d:'pufe'},
    homeTheater:  {nome:'Painel de TV',        cat:'sala',       w:220, d:12,  alt:120, sym:'rack',          m3d:'painelTv'},
    lareira:      {nome:'Lareira',             cat:'sala',       w:110, d:40,  alt:120, sym:'lareira',       m3d:'lareira'},
    mesaLateral:  {nome:'Mesa lateral',        cat:'sala',       w:45,  d:45,  alt:55,  sym:'mesaRedonda',   m3d:'mesaRedonda'},
    /* jantar */
    mesa8:        {nome:'Mesa 8 lugares',      cat:'jantar',     w:240, d:100, alt:75,  sym:'mesa',          m3d:'mesa'},
    banqueta:     {nome:'Banqueta alta',       cat:'jantar',     w:40,  d:40,  alt:105, sym:'cadeira',       m3d:'banqueta'},
    cristaleira:  {nome:'Cristaleira',         cat:'jantar',     w:100, d:40,  alt:190, sym:'estante',       m3d:'cristaleira'},
    /* cozinha */
    cooktop:      {nome:'Cooktop',             cat:'cozinha',    w:75,  d:52,  alt:90,  sym:'cooktop',       m3d:'cooktop'},
    coifa:        {nome:'Coifa',               cat:'cozinha',    w:90,  d:50,  alt:60,  sym:'coifa',         m3d:'coifa'},
    fornoEmb:     {nome:'Forno embutido',      cat:'cozinha',    w:60,  d:55,  alt:60,  sym:'eletro',        m3d:'eletro'},
    microondas:   {nome:'Micro-ondas',         cat:'cozinha',    w:50,  d:40,  alt:30,  sym:'eletro',        m3d:'eletro'},
    lavaLoucas:   {nome:'Lava-louças',         cat:'cozinha',    w:60,  d:60,  alt:85,  sym:'eletro',        m3d:'eletro'},
    adega:        {nome:'Adega climatizada',   cat:'cozinha',    w:60,  d:60,  alt:120, sym:'adega',         m3d:'adega'},
    armarioAereo: {nome:'Armário aéreo',       cat:'cozinha',    w:180, d:35,  alt:70,  sym:'armario',       m3d:'aereo'},
    despensa:     {nome:'Torre de despensa',   cat:'cozinha',    w:80,  d:60,  alt:220, sym:'armario',       m3d:'armario'},
    /* quarto */
    camaKing:     {nome:'Cama king',           cat:'quarto',     w:195, d:205, alt:55,  sym:'cama',          m3d:'cama'},
    penteadeira:  {nome:'Penteadeira',         cat:'quarto',     w:110, d:45,  alt:75,  sym:'penteadeira',   m3d:'penteadeira'},
    closet:       {nome:'Closet (arara)',      cat:'quarto',     w:200, d:60,  alt:220, sym:'arara',         m3d:'closet'},
    poltronaAmam: {nome:'Poltrona de amamentação', cat:'quarto', w:75,  d:80,  alt:100, sym:'poltrona',      m3d:'poltrona'},
    espelhoCorpo: {nome:'Espelho de corpo',    cat:'quarto',     w:60,  d:8,   alt:180, sym:'espelho',       m3d:'espelho'},
    /* infantil */
    camaInfantil: {nome:'Cama infantil',       cat:'infantil',   w:80,  d:160, alt:50,  sym:'cama',          m3d:'cama'},
    beliche:      {nome:'Beliche',             cat:'infantil',   w:100, d:195, alt:170, sym:'cama',          m3d:'beliche'},
    trocador:     {nome:'Cômoda com trocador', cat:'infantil',   w:100, d:55,  alt:95,  sym:'comoda',        m3d:'comoda'},
    escorregador: {nome:'Escorregador',        cat:'infantil',   w:120, d:180, alt:130, sym:'escorregador',  m3d:'escorregador'},
    caixaBrinq:   {nome:'Caixa de brinquedos', cat:'infantil',   w:80,  d:45,  alt:45,  sym:'caixa',         m3d:'caixaBrinq'},
    /* banheiro */
    boxCanto:     {nome:'Box de canto',        cat:'banheiro',   w:90,  d:90,  alt:200, sym:'box',           m3d:'box'},
    gabinete:     {nome:'Gabinete com cuba',   cat:'banheiro',   w:80,  d:48,  alt:85,  sym:'lavatorio',     m3d:'gabinete'},
    bide:         {nome:'Bidê',                cat:'banheiro',   w:36,  d:55,  alt:40,  sym:'vaso',          m3d:'vaso'},
    espelheira:   {nome:'Espelheira',          cat:'banheiro',   w:80,  d:14,  alt:70,  sym:'espelho',       m3d:'espelho'},
    /* escritório */
    mesaL:        {nome:'Mesa em L',           cat:'escritorio', w:180, d:160, alt:75,  sym:'balcaoL',       m3d:'mesaL'},
    armarioAco:   {nome:'Armário de aço',      cat:'escritorio', w:90,  d:45,  alt:200, sym:'armario',       m3d:'armarioAco'},
    impressora:   {nome:'Impressora',          cat:'escritorio', w:50,  d:45,  alt:35,  sym:'eletro',        m3d:'eletro'},
    mesaReuniao:  {nome:'Mesa de reunião',     cat:'escritorio', w:240, d:120, alt:75,  sym:'mesa',          m3d:'mesa'},
    /* serviço */
    secadora:     {nome:'Secadora',            cat:'servico',    w:60,  d:60,  alt:85,  sym:'eletro',        m3d:'eletro'},
    varal:        {nome:'Varal',               cat:'servico',    w:120, d:60,  alt:120, sym:'varal',         m3d:'varal'},
    aquecedor:    {nome:'Aquecedor / boiler',  cat:'servico',    w:50,  d:50,  alt:150, sym:'eletro',        m3d:'boiler'},
    freezer:      {nome:'Freezer horizontal',  cat:'servico',    w:130, d:70,  alt:90,  sym:'eletro',        m3d:'freezer'},
    /* externo e lazer */
    moto:         {nome:'Moto',                cat:'veiculos',   w:80,  d:210, alt:120, sym:'moto',          m3d:'moto'},
    bicicleta:    {nome:'Bicicleta',           cat:'veiculos',   w:60,  d:180, alt:110, sym:'bicicleta',     m3d:'bicicleta'},
    bancoJardim:  {nome:'Banco de jardim',     cat:'externo',    w:150, d:55,  alt:85,  sym:'bancoJardim',   m3d:'bancoJardim'},
    arbusto:      {nome:'Arbusto',             cat:'externo',    w:80,  d:80,  alt:90,  sym:'planta',        m3d:'arbusto'},
    cerca:        {nome:'Cerca-viva',          cat:'externo',    w:200, d:50,  alt:120, sym:'cercaViva',     m3d:'cercaViva'},
    lixeira:      {nome:'Lixeira',             cat:'externo',    w:60,  d:60,  alt:110, sym:'lixeira',       m3d:'lixeira'},
    guardaSol:    {nome:'Guarda-sol',          cat:'lazer',      w:250, d:250, alt:240, sym:'guardaSol',     m3d:'guardaSol'},
    jacuzzi:      {nome:'Ofurô / jacuzzi',     cat:'lazer',      w:200, d:200, alt:90,  sym:'jacuzzi',       m3d:'jacuzzi'},
    ducha:        {nome:'Ducha externa',       cat:'lazer',      w:40,  d:40,  alt:220, sym:'ducha',         m3d:'ducha'},
    escadaPiscina:{nome:'Escada de piscina',   cat:'lazer',      w:60,  d:60,  alt:110, sym:'escadaPiscina', m3d:'escadaPiscina'},
    trampolim:    {nome:'Trampolim',           cat:'lazer',      w:60,  d:180, alt:80,  sym:'espreguicadeira', m3d:'trampolim'},
    redeDescanso: {nome:'Rede de descanso',    cat:'lazer',      w:220, d:100, alt:100, sym:'espreguicadeira', m3d:'rede'},
    bancadaGourmet:{nome:'Bancada gourmet',    cat:'lazer',      w:200, d:70,  alt:105, sym:'bancada',       m3d:'bancada'},
    /* academia */
    esteira:      {nome:'Esteira',             cat:'academia',   w:90,  d:180, alt:140, sym:'esteira',       m3d:'esteira'},
    bikeErgo:     {nome:'Bicicleta ergométrica', cat:'academia', w:60,  d:120, alt:130, sym:'aparelho',      m3d:'bikeErgo'},
    supino:       {nome:'Banco de supino',     cat:'academia',   w:130, d:140, alt:120, sym:'aparelho',      m3d:'supino'},
    halteres:     {nome:'Rack de halteres',    cat:'academia',   w:150, d:60,  alt:80,  sym:'aparelho',      m3d:'halteres'},
    tatame:       {nome:'Tatame',              cat:'academia',   w:200, d:200, alt:4,   sym:'tatame',        m3d:'tapete'},
    espelhoAcad:  {nome:'Espelho de parede',   cat:'academia',   w:200, d:8,   alt:180, sym:'espelho',       m3d:'espelho'},
    /* comercial */
    balcaoAtend:  {nome:'Balcão de atendimento', cat:'comercial', w:180, d:70, alt:105, sym:'balcaoL',       m3d:'balcaoAtend'},
    vitrineExp:   {nome:'Vitrine expositora',  cat:'comercial',  w:120, d:50,  alt:100, sym:'adega',         m3d:'vitrineExp'},
    gondola:      {nome:'Gôndola',             cat:'comercial',  w:180, d:60,  alt:180, sym:'gondola',       m3d:'gondola'},
    arara:        {nome:'Arara de roupas',     cat:'comercial',  w:150, d:60,  alt:170, sym:'arara',         m3d:'arara'},
    manequim:     {nome:'Manequim',            cat:'comercial',  w:45,  d:35,  alt:180, sym:'manequim',      m3d:'manequim'},
    caixaReg:     {nome:'Caixa registradora',  cat:'comercial',  w:120, d:60,  alt:105, sym:'balcaoL',       m3d:'caixaReg'},
    freezerExp:   {nome:'Freezer expositor',   cat:'comercial',  w:90,  d:70,  alt:190, sym:'adega',         m3d:'freezerExp'},
    mesaBistro:   {nome:'Mesa bistrô',         cat:'comercial',  w:70,  d:70,  alt:75,  sym:'mesaRedonda',   m3d:'mesaRedondaAlta'},
    /* decoração */
    quadro:       {nome:'Quadro',              cat:'decoracao',  w:90,  d:5,   alt:70,  sym:'quadro',        m3d:'quadro'},
    espelhoDec:   {nome:'Espelho decorativo',  cat:'decoracao',  w:70,  d:6,   alt:110, sym:'espelho',       m3d:'espelho'},
    vasoGrande:   {nome:'Vaso grande',         cat:'decoracao',  w:45,  d:45,  alt:90,  sym:'planta',        m3d:'vasoDec'},
    cortina:      {nome:'Cortina',             cat:'decoracao',  w:200, d:12,  alt:240, sym:'cortina',       m3d:'cortina'},
    pendente:     {nome:'Pendente',            cat:'decoracao',  w:30,  d:30,  alt:40,  sym:'luminaria',     m3d:'pendente'},

    /* ---------- veículos ---------- */
    carroHatch:   {nome:'Carro compacto',      cat:'veiculos',   w:170, d:395, alt:148, sym:'veiculo',       m3d:'veiculo'},
    suv:          {nome:'SUV',                 cat:'veiculos',   w:185, d:470, alt:175, sym:'veiculo',       m3d:'veiculo'},
    picape:       {nome:'Picape',              cat:'veiculos',   w:190, d:530, alt:185, sym:'veiculo',       m3d:'picape'},
    van:          {nome:'Van / utilitário',    cat:'veiculos',   w:200, d:540, alt:230, sym:'caminhao',      m3d:'van'},
    caminhao:     {nome:'Caminhão (baú)',      cat:'veiculos',   w:250, d:900, alt:380, sym:'caminhao',      m3d:'caminhao'},
    onibus:       {nome:'Ônibus / micro-ônibus', cat:'veiculos', w:250, d:900, alt:320, sym:'caminhao',      m3d:'onibus'},
    /* ---------- TV, som e câmeras ---------- */
    tv50:         {nome:'TV 50"',              cat:'eletronicos', w:112, d:8,  alt:65,  elev:110, sym:'tv',   m3d:'tv'},
    tv65:         {nome:'TV 65"',              cat:'eletronicos', w:145, d:8,  alt:83,  elev:105, sym:'tv',   m3d:'tv'},
    tv85:         {nome:'TV 85"',              cat:'eletronicos', w:190, d:9,  alt:108, elev:100, sym:'tv',   m3d:'tv'},
    monitor:      {nome:'Monitor',             cat:'eletronicos', w:60,  d:20, alt:45,  elev:75,  sym:'tv',   m3d:'monitor'},
    painelLed:    {nome:'Painel de LED',       cat:'eletronicos', w:300, d:15, alt:170, elev:100, sym:'tv',   m3d:'tv'},
    projetor:     {nome:'Projetor',            cat:'eletronicos', w:35,  d:30, alt:14,  elev:250, sym:'eletro', m3d:'projetor'},
    telaProjecao: {nome:'Tela de projeção',    cat:'eletronicos', w:250, d:10, alt:160, elev:90,  sym:'tv',   m3d:'telaProjecao'},
    caixaTorre:   {nome:'Caixa de som torre',  cat:'eletronicos', w:30,  d:32, alt:110, sym:'somCaixa',      m3d:'caixaSom'},
    caixaParede:  {nome:'Caixa de som de parede', cat:'eletronicos', w:26, d:20, alt:34, elev:200, sym:'somCaixa', m3d:'caixaSom'},
    caixaTeto:    {nome:'Caixa de som de teto', cat:'eletronicos', w:22, d:22, alt:12,  elev:265, sym:'exaustor', m3d:'caixaTeto'},
    subwoofer:    {nome:'Subwoofer',           cat:'eletronicos', w:45,  d:45, alt:45,  sym:'somCaixa',      m3d:'caixaSom'},
    soundbar:     {nome:'Soundbar',            cat:'eletronicos', w:110, d:12, alt:8,   elev:95,  sym:'tv',   m3d:'soundbar'},
    cameraBullet: {nome:'Câmera bullet (CFTV)', cat:'eletronicos', w:12, d:26, alt:12,  elev:270, sym:'camera', m3d:'cameraBullet'},
    cameraDome:   {nome:'Câmera dome',         cat:'eletronicos', w:14,  d:14, alt:11,  elev:275, sym:'camera', m3d:'cameraDome'},
    camera360:    {nome:'Câmera 360°',         cat:'eletronicos', w:16,  d:16, alt:10,  elev:280, sym:'camera', m3d:'cameraDome'},
    dvr:          {nome:'DVR / gravador',      cat:'eletronicos', w:36,  d:30, alt:6,   elev:150, sym:'eletro', m3d:'eletro'},
    /* ---------- palco e eventos ---------- */
    palco:        {nome:'Palco',               cat:'palco',      w:600, d:400, alt:60,  sym:'palco',         m3d:'palco'},
    praticavel:   {nome:'Praticável',          cat:'palco',      w:200, d:100, alt:40,  sym:'palco',         m3d:'palco'},
    trelica:      {nome:'Treliça de iluminação', cat:'palco',    w:600, d:40,  alt:40,  elev:420, sym:'trelica', m3d:'trelica'},
    refletor:     {nome:'Refletor',            cat:'palco',      w:28,  d:28,  alt:38,  elev:400, sym:'luminaria', m3d:'refletor'},
    lineArray:    {nome:'Caixa de som de palco', cat:'palco',    w:60,  d:55,  alt:180, sym:'somCaixa',      m3d:'lineArray'},
    mesaSom:      {nome:'Mesa de som',         cat:'palco',      w:120, d:65,  alt:95,  sym:'mesaSom',       m3d:'mesaSom'},
    microfone:    {nome:'Microfone com pedestal', cat:'palco',   w:30,  d:30,  alt:160, sym:'luminaria',     m3d:'microfone'},
    telao:        {nome:'Telão',               cat:'palco',      w:400, d:25,  alt:250, elev:80, sym:'tv',    m3d:'telao'},
    /* ---------- instalações ---------- */
    arSplit:      {nome:'Ar-condicionado split', cat:'instalacoes', w:100, d:22, alt:30, elev:215, sym:'arSplit', m3d:'arSplit'},
    arCassete:    {nome:'Ar cassete (teto)',   cat:'instalacoes', w:60,  d:60, alt:25,  elev:255, sym:'arCassete', m3d:'arCassete'},
    arPisoTeto:   {nome:'Ar piso-teto',        cat:'instalacoes', w:130, d:25, alt:55,  elev:200, sym:'arSplit', m3d:'arSplit'},
    arJanela:     {nome:'Ar de janela',        cat:'instalacoes', w:60,  d:55, alt:40,  elev:150, sym:'eletro', m3d:'arJanela'},
    condensadora: {nome:'Condensadora (externa)', cat:'instalacoes', w:90, d:35, alt:70, sym:'eletro',       m3d:'condensadora'},
    exaustorParede:{nome:'Exaustor de parede', cat:'instalacoes', w:40,  d:25, alt:40,  elev:220, sym:'exaustor', m3d:'exaustorParede'},
    exaustorEolico:{nome:'Exaustor eólico (telhado)', cat:'instalacoes', w:60, d:60, alt:70, elev:290, sym:'exaustor', m3d:'exaustorEolico'},
    exaustorBanho:{nome:'Exaustor de banheiro', cat:'instalacoes', w:20, d:20,  alt:10,  elev:250, sym:'exaustor', m3d:'exaustorTeto'},
    caixaAgua500: {nome:'Caixa d’água 500 L',  cat:'instalacoes', w:95,  d:95, alt:75,  sym:'caixaAgua',     m3d:'caixaAgua'},
    caixaAgua1000:{nome:'Caixa d’água 1.000 L', cat:'instalacoes', w:115, d:115, alt:95, sym:'caixaAgua',    m3d:'caixaAgua'},
    caixaAguaTorre:{nome:'Caixa d’água em torre', cat:'instalacoes', w:150, d:150, alt:420, sym:'caixaAgua', m3d:'caixaAguaTorre'},
    cisterna:     {nome:'Cisterna',            cat:'instalacoes', w:200, d:200, alt:150, sym:'caixaAgua',    m3d:'cisterna'},
    aquecedorSolar:{nome:'Aquecedor solar',    cat:'instalacoes', w:200, d:120, alt:15,  elev:290, sym:'placaSolar', m3d:'placaSolar'},
    placaFoto:    {nome:'Placa fotovoltaica',  cat:'instalacoes', w:170, d:105, alt:6,   elev:295, sym:'placaSolar', m3d:'placaSolar'},
    quadroEnergia:{nome:'Quadro de energia',   cat:'instalacoes', w:40,  d:14, alt:60,  elev:150, sym:'quadroEnergia', m3d:'quadroEnergia'},
    bomba:        {nome:'Bomba / pressurizador', cat:'instalacoes', w:40, d:28, alt:32,  sym:'eletro',       m3d:'eletro'},
    /* ---------- vitrines (comércio) ---------- */
    vitrineLoja:  {nome:'Vitrine de loja',     cat:'comercial',  w:250, d:60,  alt:220, sym:'vitrineLoja',   m3d:'vitrineLoja'},
    balcaoVitrine:{nome:'Balcão vitrine refrigerado', cat:'comercial', w:150, d:70, alt:110, sym:'vitrineLoja', m3d:'balcaoVitrine'},
    vitrineIlha:  {nome:'Vitrine ilha',        cat:'comercial',  w:120, d:120, alt:110, sym:'vitrineLoja',   m3d:'vitrineIlha'},
    expositorParede:{nome:'Expositor de parede', cat:'comercial', w:150, d:40, alt:200, sym:'gondola',       m3d:'expositorParede'},
    provador:     {nome:'Provador',            cat:'comercial',  w:110, d:110, alt:220, sym:'box',           m3d:'provador'}
  };
  Object.keys(ITENS).forEach(function (k) { ITENS[k].k = k; });

  function def(k){ return ITENS[k] || null; }
  function porCat(cat){ return Object.keys(ITENS).filter(function (k) { return ITENS[k].cat === cat; }).map(function (k) { return ITENS[k]; }); }
  function buscar(txt){
    var q = norm(txt);
    return Object.keys(ITENS).filter(function (k) { return norm(ITENS[k].nome).indexOf(q) >= 0; }).map(function (k) { return ITENS[k]; });
  }
  function norm(s){ return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  /* medidas efetivas de uma instância (o usuário pode redimensionar) */
  function dims(mv){
    var d = def(mv.k) || {w:60, d:60, alt:60};
    return {w: mv.w || d.w, d: mv.d || d.d, alt: mv.alt || d.alt};
  }
  /* figurinha de uma instância (já com as medidas dela), em coordenadas locais */
  function symDe(mv){
    var d = def(mv.k), m = dims(mv), fn = SYM[d ? d.sym : 'caixa'] || SYM.caixa;
    return fn(m.w, m.d);
  }
  /* figurinha centrada num SVG independente (miniaturas do catálogo) */
  function thumb(k, px){
    var d = def(k); if (!d) return '';
    var m = Math.max(d.w, d.d) * 1.15, s = px || 72;
    return '<svg viewBox="' + (-m / 2) + ' ' + (-m / 2) + ' ' + m + ' ' + m + '" width="' + s + '" height="' + s + '" xmlns="http://www.w3.org/2000/svg">' +
      '<g stroke-width="' + (m / 60) + '">' + SYM[d.sym](d.w, d.d) + '</g></svg>';
  }
  /* caixa envolvente alinhada aos eixos, no mundo (cm) */
  function aabb(mv){
    var m = dims(mv), a = (mv.rot || 0) * Math.PI / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
    var W = m.w * c + m.d * s, D = m.w * s + m.d * c;
    return {x: mv.x - W / 2, y: mv.y - D / 2, w: W, h: D};
  }

  /* ---------- mobiliar automaticamente ----------
     Cada ambiente ganha móveis do catálogo em coordenadas locais
     (u = largura, v = profundidade; porta em v = 0, fundo em v = D),
     convertidas para o mundo pelo lado da porta. Só devolve dados —
     quem grava em proj.moveis é o model.                              */
  function auto(proj, lados){
    var out = [];
    proj.ambientes.forEach(function (r) {
      var lado = (lados && lados[r.id]) || 'frente';
      var W = (lado === 'esq' || lado === 'dir') ? r.h : r.w, D = (lado === 'esq' || lado === 'dir') ? r.w : r.h;
      var n = norm(r.nome), lista = [];
      /* põe(k, u, v, rotLocal) — encosto -y do móvel: 180 = encosto no fundo; -90 = encosto na parede esquerda; 90 = direita; 0 = encosto na parede da porta */
      function poe(k, u, v, rot, extra, elev){ var o = {k:k, u:u, v:v, rot:rot || 0}; if (extra) for (var p in extra) o[p] = extra[p]; if (elev) o.elev = elev; lista.push(o); }
      function W_(k){ return ITENS[k].w; } function D_(k){ return ITENS[k].d; }

      if (n.indexOf('estar') >= 0 || (r.tipo === 'social' && n.indexOf('sala') >= 0 && n.indexOf('jantar') < 0)) {
        if (W >= 260 && D >= 260) {
          var sk = W >= 330 ? 'sofa3' : 'sofa2';
          poe(sk, W / 2, D - D_(sk) / 2 - 8, 180);
          poe('rack', W / 2, D_('rack') / 2 + 4, 0, {w: Math.min(180, W - 60)});
          if (D >= 330) poe('tapete', W / 2, D / 2 - 10, 0, {w: Math.min(200, W - 80), d: Math.min(150, D - 200)});
          if (D >= 330) poe('mesaCentro', W / 2, D / 2 - 10, 0);
          poe('planta', 32, D - 32, 0);
          if (W >= 380) poe('poltrona', W - 55, D / 2 + 20, 90);
        }
      } else if (n.indexOf('jantar') >= 0) {
        if (W >= 220 && D >= 220) {
          var mk = W >= 300 && D >= 260 ? 'mesa6' : 'mesa4', mw = W_(mk), md = D_(mk), nc = mk === 'mesa6' ? 3 : 2;
          poe(mk, W / 2, D / 2, 0);
          for (var i = 0; i < nc; i++) { var uu = W / 2 - mw / 2 + mw * (i + .5) / nc; poe('cadeira', uu, D / 2 - md / 2 - 28, 0); poe('cadeira', uu, D / 2 + md / 2 + 28, 180); }
          if (W >= 330) poe('buffet', W / 2, D - D_('buffet') / 2 - 4, 180, {w: Math.min(160, W - 100)});
        }
      } else if (n.indexOf('cozinha') >= 0) {
        if (W >= 180 && D >= 180) {
          var bw = W - 90, gel = W >= 260;
          if (!gel) bw = W - 10;
          poe('pia', bw * .3 + 5, D - 30, 180);
          poe('fogao', bw * .72 + 5, D - 30, 180);
          poe('bancada', bw / 2 + 5, D - 30, 180, {w: bw});
          if (gel) poe('geladeira', W - 40, D - 40, 180);
          poe('coifa', bw * .72 + 5, D - 28, 180, {w: Math.min(90, bw * .5)}, 160);
          if (W >= 300) poe('microondas', bw * .12 + 5, D - 26, 180, null, 140);
          if (W >= 340) poe('lavaLoucas', bw * .5 + 5, D - 30, 180);
          if (D >= 300 && W >= 240) poe('bancada', 30, (D - 60) / 2 - 15, -90, {w: Math.min(200, D - 100), d: 60});
        }
      } else if (r.tipo === 'intimo' || n.indexOf('quarto') >= 0 || n.indexOf('suite') >= 0) {
        if (W >= 160 && D >= 240) {
          var ck = W < 260 ? 'camaSolteiro' : (n.indexOf('suite') >= 0 ? 'camaQueen' : 'camaCasal'), cw = W_(ck), cd = D_(ck);
          var cu = W < 260 ? cw / 2 + 12 : W / 2 + (W > 340 ? 30 : 0);
          poe(ck, cu, D - cd / 2 - 10, 180);
          if (cu - cw / 2 > 55) poe('criado', cu - cw / 2 - 28, D - 24, 180);
          if (W - (cu + cw / 2) > 55) poe('criado', cu + cw / 2 + 28, D - 24, 180);
          var aw = Math.min(200, D - cd - 50);
          if (W >= 260 && aw >= 80) poe('guardaRoupa', 32, 20 + aw / 2, -90, {w: aw});
          if (W > 280) poe('planta', W - 30, 34, 0);
          if (W >= 320 && D >= 300) poe(n.indexOf('suite') >= 0 ? 'penteadeira' : 'comoda', W - 60, 24, 0);
          if (W >= 360) poe('espelhoCorpo', W - 20, D / 2, 90);
        }
      } else if (r.tipo === 'molhado' && (n.indexOf('banh') >= 0 || n.indexOf('lavabo') >= 0 || n.indexOf('wc') >= 0)) {
        if (W >= 110 && D >= 140) {
          var temBox = n.indexOf('lavabo') < 0 && W >= 170 && D >= 200;
          poe('vaso', W - 26, D - 40, 180);
          if (W >= 200) { poe('gabinete', 44, Math.min(D - 110, 60), -90); poe('espelheira', 14, Math.min(D - 110, 60), -90, null, 110); }
          else poe('lavatorio', 26, Math.min(D - 100, 60), -90);
          if (temBox) poe('box', 48, D - 48, 180, {w: Math.min(90, W - 80), d: Math.min(90, D - 100)});
        }
      } else if (r.tipo === 'servico') {
        if (W >= 120 && D >= 120 && n.indexOf('serv') >= 0) {
          poe('lavadora', 36, D - 34, 180); poe('tanque', 100, D - 32, 180);
          if (W >= 200) poe('armarioServ', W - 44, D - 24, 180);
          if (D >= 220) poe('varal', W / 2, 40, 0, {w: Math.min(120, W - 40)}, 100);
        } else if (W >= 100 && D >= 100) {
          poe('prateleira', W / 2, D - 22, 180, {w: Math.min(W - 30, 180)});
        }
      } else if (r.tipo === 'garagem') {
        if (W >= 220 && D >= 430) poe('carro', W / 2, D / 2 + 5, 0);
        if (W >= 330 && D >= 430) poe('bicicleta', W - 40, 120, 0);
      } else if (n.indexOf('varanda') >= 0 || n.indexOf('gourmet') >= 0 || n.indexOf('churras') >= 0) {
        if (W >= 200 && D >= 160) {
          poe('mesaExt', W / 2, D / 2, 0);
          poe('cadeira', W / 2 - 30, D / 2 - 68, 0); poe('cadeira', W / 2 + 30, D / 2 - 68, 0);
          poe('cadeira', W / 2 - 30, D / 2 + 68, 180); poe('cadeira', W / 2 + 30, D / 2 + 68, 180);
          if (W >= 300 && D >= 240) poe('churrasqueira', W - 70, D - 34, 180);
          poe('planta', 30, D - 30, 0);
        }
      } else if (n.indexOf('escrit') >= 0) {
        if (W >= 200 && D >= 200) {
          poe('escrivaninha', W / 2, D - 42, 180, {w: Math.min(160, W - 80)}); poe('cadeiraEscr', W / 2, D - 110, 180);
          poe('estanteLivros', W / 2, 20, 0, {w: Math.min(W - 60, 200)});
        }
      } else if (n.indexOf('loja') >= 0 || n.indexOf('recep') >= 0) {
        if (W >= 240 && D >= 240) {
          poe('buffet', W / 2, 130, 0, {w: Math.min(220, W - 100), d:60, alt:105});
          poe('prateleira', W / 2, D - 22, 180, {w: W - 60});
          poe('planta', 30, 40, 0); poe('planta', W - 30, 40, 0);
        }
      } else if (n.indexOf('vesti') >= 0) {
        if (W >= 200 && D >= 200) {
          poe('armarioServ', W / 2, D - 24, 180, {w: W - 40, d:45});
          poe('buffet', W / 2, D / 2, 0, {w: Math.min(180, W - 80), d:35, alt:45});
        }
      } else if (r.tipo === 'circulacao' && n.indexOf('hall') >= 0 && W >= 160) {
        poe('aparador', W / 2, D - 20, 180); poe('planta', W - 30, D - 30, 0);
      } else if (r.tipo === 'externo' && W >= 250 && D >= 250) {
        poe('arvore', W * .35, D * .6, 0, {w: Math.min(220, W * .6), d: Math.min(220, W * .6)});
      } else if (r.tipo === 'social' && W >= 260 && D >= 260) {
        poe('sofa2', W / 2, D - 53, 180); poe('mesaCentro', W / 2, D / 2 - 10, 0); poe('planta', 32, D - 32, 0);
      }

      lista.forEach(function (o) {
        var wp = mundo(r, lado, o.u, o.v), mv = {k:o.k, x:Math.round(wp.x), y:Math.round(wp.y), rot:(o.rot + frameRot(lado) + 360) % 360, amb:r.id};
        if (o.w) mv.w = o.w; if (o.d) mv.d = o.d; if (o.alt) mv.alt = o.alt;
        out.push(mv);
      });
    });
    return out;
  }
  /* quadro local (porta em v=0) → mundo; espelha TRES.quadro */
  function mundo(r, lado, u, v){
    if (lado === 'fundo') return {x: r.x + r.w - u, y: r.y + r.h - v};
    if (lado === 'esq')   return {x: r.x + v, y: r.y + r.h - u};
    if (lado === 'dir')   return {x: r.x + r.w - v, y: r.y + u};
    return {x: r.x + u, y: r.y + v};
  }
  function frameRot(lado){ return lado === 'fundo' ? 180 : (lado === 'esq' ? -90 : (lado === 'dir' ? 90 : 0)); }

  return {CATS:CATS, ITENS:ITENS, SYM:SYM, def:def, porCat:porCat, buscar:buscar, dims:dims, symDe:symDe, thumb:thumb, aabb:aabb, auto:auto, mundo:mundo, frameRot:frameRot, norm:norm};
}
var MOVEIS = MOVEIS_LIB();
