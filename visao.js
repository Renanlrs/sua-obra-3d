/* =========================================================================
   VISÃO — copiar de uma FOTO em vez de descrever por texto.
   Duas leituras: 'planta' (foto/print de uma planta baixa → ambientes) e
   'fachada' (foto de uma casa/loja → escolhas da aba Fachada).
   O modelo de visão (Gemini, chave do usuário guardada no navegador) devolve
   JSON; aqui só normalizamos — nada é desenhado pela IA, o app continua dono
   da geometria (snap, mínimos, dentro do terreno).
   ========================================================================= */
var VISAO = (function () {
  var KEY = 'suaobra3d.gemini';
  var MODELOS = ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.7-flash', 'gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest', 'gemini-flash-latest'];   /* free tier: cada modelo tem balde de cota próprio; os alias -latest esgotam cedo (o CRM usa) */
  var TIPOS = ['social', 'intimo', 'molhado', 'servico', 'circulacao', 'garagem', 'agua', 'externo'];

  function chave(){ try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } }
  function setChave(k){ try { if (k) localStorage.setItem(KEY, k.trim()); else localStorage.removeItem(KEY); } catch (e) {} }

  /* reduz a imagem (≤ max px no maior lado) e devolve base64 JPEG */
  function reduzir(file, max){
    return new Promise(function (ok, erro) {
      var rd = new FileReader();
      rd.onerror = function () { erro(new Error('Não consegui ler o arquivo.')); };
      rd.onload = function () {
        var img = new Image();
        img.onerror = function () { erro(new Error('Arquivo não é uma imagem.')); };
        img.onload = function () {
          var k = Math.min(1, (max || 1280) / Math.max(img.width, img.height)), cv = document.createElement('canvas');
          cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
          var cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(img, 0, 0, cv.width, cv.height);
          var url = cv.toDataURL('image/jpeg', .88);
          ok({b64:url.split(',')[1], mime:'image/jpeg', dataUrl:url, w:cv.width, h:cv.height});
        };
        img.src = rd.result;
      };
      rd.readAsDataURL(file);
    });
  }

  var PROMPT = {
    planta: 'Você lê PLANTAS BAIXAS (desenho de arquitetura visto de cima). Analise a imagem e devolva APENAS JSON, sem comentários, no schema:\n' +
      '{"largura_m":number,"profundidade_m":number,"frente":"cima|baixo|esquerda|direita","ambientes":[{"nome":string,"tipo":"social|intimo|molhado|servico|circulacao|garagem|agua|externo","x":number,"y":number,"w":number,"h":number}]}\n' +
      'Regras: x,y,w,h são FRAÇÕES (0 a 1) da caixa que envolve a área construída desenhada (x,y = canto superior esquerdo do ambiente; w,h = tamanho). ' +
      'largura_m/profundidade_m = tamanho total dessa caixa em metros — use as cotas escritas no desenho se existirem; senão estime pelo tamanho típico dos cômodos (uma cama de casal tem 1,40 × 1,90 m; um vaso sanitário 0,40 m). ' +
      'Um ambiente por cômodo rotulado; junte "sala/cozinha integrada" num só. tipo: sala/estar/jantar/escritório/varanda/loja/recepção/salão = social; quarto/suíte/closet = intimo; cozinha/banheiro/lavabo/vestiário = molhado; serviço/despensa/depósito = servico; corredor/hall/escada = circulacao; garagem = garagem; piscina = agua; jardim/quintal descoberto = externo. ' +
      '"frente" = lado da imagem onde fica a rua/entrada principal. Não invente cômodos que não estão desenhados. Use nomes em português.',
    fachada: 'Você lê FOTOS DE FACHADAS (frente de casa ou loja). Descreva o que está VISÍVEL na imagem devolvendo APENAS JSON com as chaves abaixo — só inclua uma chave se der para ver; valores exatamente destas listas:\n' +
      '{"estilo":"moderno|classico|contemporaneo|rustico","cobertura":"platibanda|telhado2|telhado4","telha":"ceramica|concreto|metalica","corParede":"#RRGGBB","corDestaque":"#RRGGBB","revestimento":"nenhum|ripado|pedra|tijolo|cimento","esquadria":"preto|branco|madeira","esquadriaCor":"#RRGGBB","janela":"correr|fixa|guilhotina|basculante|veneziana|quadriculada","vidro":"incolor|fume|verde|espelhado","moldura":bool,"gradeJanela":bool,"brise":bool,' +
      '"porta":"madeira|pivotante|vidro|dupla|ripada|aco|enrolar|subir|correr|vidroDupla|gradeLoja|articulada","portaCor":"#RRGGBB","garagem":"basculante|enrolar|ripado|vidro","portao":"grade|ripado|chapa","portaoCor":"#RRGGBB","muro":"baixo|alto|vidro","muroCor":"#RRGGBB","jardim":bool,"marquise":bool,"pergolado":bool,"iluminacao":bool,"arandelas":bool,"vasos":bool,"vitrine":bool,"pisoFrente":"concreto|pedra|deck|intertravado|grama",' +
      '"letreiro":string,"letreiroEstilo":"placa|caixa|led|neon|backlight","letreiroCor":"#RRGGBB","numero":string,"descricao":string}\n' +
      'cobertura: telhado aparente com 2 caimentos = telhado2, 4 caimentos = telhado4, sem telhado aparente/laje/platibanda = platibanda. corParede = cor predominante das paredes; corDestaque = cor do volume/detalhe secundário. Se tiver placa/letreiro com nome, ponha o texto em "letreiro". "descricao" = 1 frase em português resumindo a fachada.'
  };

  function limparJson(txt){
    txt = String(txt || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    var i = txt.indexOf('{'), j = txt.lastIndexOf('}');
    if (i >= 0 && j > i) txt = txt.slice(i, j + 1);
    return JSON.parse(txt);
  }

  /* chama o Gemini direto do navegador (a chave é do usuário, fica no localStorage); tenta os modelos em ordem */
  function gemini(prompt, img, k){
    k = k || chave();
    if (!k) return Promise.reject(new Error('SEM_CHAVE'));
    var i = 0, ultimo = null;
    function tenta(){
      if (i >= MODELOS.length) return Promise.reject(ultimo || new Error('Nenhum modelo respondeu.'));
      var modelo = MODELOS[i++];
      return fetch('https://generativelanguage.googleapis.com/v1beta/models/' + modelo + ':generateContent?key=' + encodeURIComponent(k), {
        method:'POST', headers:{'content-type':'application/json'},
        body:JSON.stringify({contents:[{parts:[{text:prompt}, {inline_data:{mime_type:img.mime, data:img.b64}}]}], generationConfig:{temperature:.2, response_mime_type:'application/json'}})
      }).then(function (r) {
        if (r.status === 429 || r.status === 404 || r.status === 503) { ultimo = new Error(r.status === 429 ? 'Cota do modelo ' + modelo + ' esgotada.' : 'Modelo ' + modelo + ' indisponível.'); return tenta(); }
        if (r.status === 400 || r.status === 403) { return r.json().then(function (j) { throw new Error('CHAVE_INVALIDA:' + ((j.error || {}).message || r.status)); }); }
        if (!r.ok) { ultimo = new Error('Erro ' + r.status); return tenta(); }
        return r.json().then(function (j) {
          var txt = (((j.candidates || [])[0] || {}).content || {}).parts; txt = txt ? txt.map(function (p) { return p.text || ''; }).join('') : '';
          try { var o = limparJson(txt); o._modelo = modelo; return o; } catch (e) { ultimo = new Error('Resposta ilegível de ' + modelo); return tenta(); }
        });
      }, function () { ultimo = new Error('Sem conexão com o Gemini.'); return tenta(); });
    }
    return tenta();
  }

  /* ---------- planta: frações → centímetros dentro do terreno; snap 5, mínimo 90, sem vazar ---------- */
  function normalizarPlanta(j, terreno){
    var t = terreno, lu = t.largura - (t.recuoLateral || 0) * 2, pu = t.profundidade - (t.recuoFrontal || 0) - (t.recuoFundo || 0);
    var Lm = +j.largura_m || 0, Pm = +j.profundidade_m || 0, ambs = Array.isArray(j.ambientes) ? j.ambientes : [];
    if (!ambs.length) throw new Error('Não achei cômodos na imagem.');
    /* gira se a frente está de lado (o app tem a rua em cima) */
    var frente = String(j.frente || 'cima').toLowerCase(), pre = ambs.map(function (a) { return {nome:String(a.nome || 'Ambiente').slice(0, 40), tipo:TIPOS.indexOf(a.tipo) >= 0 ? a.tipo : 'social', x:+a.x || 0, y:+a.y || 0, w:+a.w || .1, h:+a.h || .1}; });
    if (frente === 'baixo') pre.forEach(function (a) { a.y = 1 - a.y - a.h; });
    else if (frente === 'esquerda' || frente === 'direita') { pre.forEach(function (a) { var x = a.x, y = a.y, w = a.w, h = a.h; if (frente === 'esquerda') { a.x = y; a.y = x; } else { a.x = y; a.y = 1 - x - w; } a.w = h; a.h = w; }); var tmp = Lm; Lm = Pm; Pm = tmp; }
    /* caixa real das frações (o modelo às vezes não usa 0..1 inteiro) */
    var x0 = Math.min.apply(null, pre.map(function (a) { return a.x; })), y0 = Math.min.apply(null, pre.map(function (a) { return a.y; }));
    var x1 = Math.max.apply(null, pre.map(function (a) { return a.x + a.w; })), y1 = Math.max.apply(null, pre.map(function (a) { return a.y + a.h; }));
    var fw = Math.max(.05, x1 - x0), fh = Math.max(.05, y1 - y0);
    /* escala em cm: pelas medidas ditas, limitada ao que cabe no terreno */
    var Lcm = Lm > 0 ? Lm * 100 : lu, Pcm = Pm > 0 ? Pm * 100 : pu;
    var esc = Math.min(Lcm / fw, Pcm / fh, lu / fw, pu / fh);
    var out = pre.map(function (a) {
      var w = Math.max(90, Math.round(a.w * esc / 5) * 5), h = Math.max(90, Math.round(a.h * esc / 5) * 5);
      var x = (t.recuoLateral || 0) + Math.round((a.x - x0) * esc / 5) * 5, y = (t.recuoFrontal || 0) + Math.round((a.y - y0) * esc / 5) * 5;
      x = Math.max(0, Math.min(t.largura - w, x)); y = Math.max(0, Math.min(t.profundidade - h, y));
      return {nome:a.nome, tipo:a.tipo, x:x, y:y, w:w, h:h};
    });
    /* sobreposições pequenas (o traço da parede): a divisa vai para o meio, os dois encostam — sem sobrepor e sem fresta */
    for (var i = 0; i < out.length; i++) for (var k = i + 1; k < out.length; k++) {
      var A = out[i], B = out[k];
      var ox = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x), oy = Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y);
      if (ox <= 0 || oy <= 0) continue;
      if (ox <= oy && ox <= 60) { var E = A.x <= B.x ? A : B, D = E === A ? B : A, mx = Math.round((E.x + E.w + D.x) / 2 / 5) * 5; if (mx - E.x >= 90 && D.x + D.w - mx >= 90) { E.w = mx - E.x; D.w = D.x + D.w - mx; D.x = mx; } }
      else if (oy < ox && oy <= 60) { var C = A.y <= B.y ? A : B, F2 = C === A ? B : A, my = Math.round((C.y + C.h + F2.y) / 2 / 5) * 5; if (my - C.y >= 90 && F2.y + F2.h - my >= 90) { C.h = my - C.y; F2.h = F2.y + F2.h - my; F2.y = my; } }
    }
    return {ambientes:out, escala:esc, largura_m:Lm, profundidade_m:Pm, frente:frente};
  }

  /* ---------- fachada: só chaves conhecidas, só valores válidos ---------- */
  var FV = {estilo:['moderno', 'classico', 'contemporaneo', 'rustico'], cobertura:['platibanda', 'telhado2', 'telhado4'], telha:['ceramica', 'concreto', 'metalica'], revestimento:['nenhum', 'ripado', 'pedra', 'tijolo', 'cimento'],
    esquadria:['preto', 'branco', 'madeira'], janela:['correr', 'fixa', 'guilhotina', 'basculante', 'veneziana', 'quadriculada'], vidro:['incolor', 'fume', 'verde', 'espelhado'],
    porta:['madeira', 'pivotante', 'vidro', 'dupla', 'ripada', 'aco', 'enrolar', 'subir', 'correr', 'vidroDupla', 'gradeLoja', 'articulada'], garagem:['basculante', 'enrolar', 'ripado', 'vidro'],
    portao:['grade', 'ripado', 'chapa'], muro:['baixo', 'alto', 'vidro'], pisoFrente:['concreto', 'pedra', 'deck', 'intertravado', 'grama'], letreiroEstilo:['placa', 'caixa', 'led', 'neon', 'backlight']};
  var FCOR = ['corParede', 'corDestaque', 'esquadriaCor', 'portaCor', 'portaoCor', 'muroCor', 'letreiroCor'];
  var FBOOL = ['moldura', 'gradeJanela', 'brise', 'jardim', 'marquise', 'pergolado', 'iluminacao', 'arandelas', 'vasos', 'vitrine'];
  function normalizarFachada(j){
    var f = {}, lidos = [];
    Object.keys(FV).forEach(function (k) { if (j[k] != null && FV[k].indexOf(String(j[k])) >= 0) { f[k] = String(j[k]); lidos.push(k + ': ' + f[k]); } });
    FCOR.forEach(function (k) { var v = String(j[k] || '').trim().toUpperCase(); if (/^#[0-9A-F]{6}$/.test(v)) { f[k] = v; lidos.push(k + ' ' + v); } });
    FBOOL.forEach(function (k) { if (typeof j[k] === 'boolean') { f[k] = j[k]; if (j[k]) lidos.push(k); } });
    if (j.letreiro && String(j.letreiro).trim()) { f.letreiro = String(j.letreiro).trim().slice(0, 40); lidos.push('letreiro “' + f.letreiro + '”'); if (!f.letreiroEstilo) f.letreiroEstilo = 'led'; }
    if (j.numero && /^\d{1,5}$/.test(String(j.numero).trim())) f.numero = String(j.numero).trim();
    if (!f.estilo) f.estilo = f.cobertura === 'telhado4' ? 'classico' : (f.revestimento === 'pedra' ? 'rustico' : 'moderno');
    return {fachada:f, lidos:lidos, descricao:String(j.descricao || '')};
  }

  function analisar(file, modo, k){
    return reduzir(file, 1280).then(function (img) { return gemini(PROMPT[modo], img, k).then(function (j) { return {bruto:j, img:img}; }); });
  }

  return {KEY:KEY, MODELOS:MODELOS, chave:chave, setChave:setChave, reduzir:reduzir, gemini:gemini, analisar:analisar, PROMPT:PROMPT,
    normalizarPlanta:normalizarPlanta, normalizarFachada:normalizarFachada, limparJson:limparJson};
})();
