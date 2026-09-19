# SUA OBRA 3D — do projeto à realidade

**No ar: https://renanlrs.github.io/sua-obra-3d/**

App de planta de casas que roda direto no navegador — pelo link acima ou com **duplo clique em `index.html`**. Sem instalação, sem `npm`, sem servidor, sem conta.
Guia completo de uso, atalhos e arquitetura em [`LEIA-ME.md`](LEIA-ME.md). Verificação automática em [`test.html`](test.html) (99 checagens).

## O que o app faz — e de onde veio cada parte

### 1. Planta 2D com móveis "figurinha" (referência: Planner 5D)
Cada móvel é uma figurinha vista de cima — cama com travesseiros, sofá, fogão, vaso, carro… Catálogo com 44 itens em 9 categorias (tecla `M`), arrasta do catálogo para a planta, o item selecionado ganha **cotas verdes até as paredes**, alça de giro e **menu radial** (girar, espelhar, duplicar, elevar, excluir).

![Planta com móveis, catálogo e menu radial](docs/planta-moveis.jpg)

### 2. Modo 3D — casa de boneca, andar e passeio (referência: Planner 5D)
Pill **2D / 3D** no topo. Os mesmos móveis da planta aparecem no 3D e podem ser **clicados e arrastados pelo piso**. Modos Girar / Andar (WASD) / Passeio cômodo a cômodo, botão Teto e slider Obra.

![3D casa de boneca com móvel selecionado](docs/3d-casa-boneca.jpg)

### 3. Etapa Estrutura (referência: esqueleto de concreto)
No slider **OBRA**: terreno → fundação → **estrutura** (sapatas, pilares em cada canto e encontro de parede, baldrames, vigas, arranques de ferro) → alvenaria → cobertura → acabamento.

![Etapa estrutura: sapatas, pilares e vigas](docs/3d-estrutura.jpg)

### 4. Fachada — designer próprio da frente da casa
Tecla `F`. Quatro estilos de partida (Moderno, Clássico, Contemporâneo, Rústico), cobertura (platibanda, 2 ou 4 águas), telha, cores, **revestimento da frente** (ripado, pedra, tijolinho, cimento — recortado nas portas e janelas), esquadrias, portão, muro, jardim, marquise, número da casa. Tudo com **quanto custa**, item por item.

![Fachada moderna com ripado](docs/fachada-moderno.jpg)

**☾ Noite** — janelas acesas, spots na fachada, luz da entrada e poste da rua.

![Fachada clássica à noite](docs/fachada-noite.jpg)

**Fachada comercial e criar por prompt** — letreiro com o nome do estabelecimento (placa, letra caixa, LED, neon, backlight; aceso à noite; totem), vitrine, pergolado. Ou descreva em uma frase e o app monta.

![Loja criada por prompt: neon, vitrine, pergolado](docs/fachada-loja-prompt.jpg)

**✨ Ver os 4 estilos** — fotografa a *sua* planta nos quatro estilos, lado a lado, com o custo de cada um. Clicou, aplicou.

![Comparação dos 4 estilos](docs/fachada-4-estilos.jpg)

### 5. Orçamento, simulador, apresentação e exportação
Custo por m² por tipo de ambiente + custo da fachada; simulador de meta; apresentação cinematográfica com passeio 3D dirigido pelo scroll; exporta SVG, PNG, PDF, `.json` e **passeio 3D em HTML** (um arquivo, abre no celular).

### 6. Fusão com o ACQUA BELO — piscina, orçamento por etapa, cenários, camadas, cotas, relatório, renders, versões
As funções do app da escola de natação passaram a viver no mesmo editor, lendo a mesma planta:
- **Escola de natação** é um programa pronto (15 × 20 m): rua → corredor → controle de acesso → vestiários → salão com a **piscina 12,50 × 6,00 m e 4 raias** dentro; administração e deck do animador no 2º pavimento.
- **Aba Piscina**: comprimento, largura, profundidade mín./máx., raias e largura da raia; praias medidas até as paredes do salão (mín. 1,50 m laterais · 0,50 m cabeceiras), volume, área molhada, alertas, aquecimento e filtragem. No 3D a piscina tem a profundidade real, cordas de raia, blocos de partida e o piso do salão recortado.
- **Orçamento por etapa da obra** (a mesma sequência do slider OBRA): composição em fundação/estrutura/alvenaria/cobertura/instalações/acabamentos, grupos Piscina e Fachada, reserva técnica e faixa −12 %/+18 %.
- **Simulador de cenários**: cada linha mostra o Δ R$ (acabamento econômico, piscina 11/12,5/15 m, sem 2º andar, sem o menor ambiente…) e aplica com um clique, com desfazer.
- **Camadas** (visível/bloqueada), **Cotas** (todas as medidas, editáveis; cotas livres), **Relatório técnico** com alertas inteligentes, **Renders** (botão **+ Render** no 3D e na fachada, ou envio de imagem; entram na apresentação), **Versões do estudo** e exportação em CSV/TXT.

### 8. Copiar de uma FOTO (em vez de descrever)
- **Planta**: botão 📷 na barra da planta (ou na tela inicial, na aba Ambientes, no botão direito) → mande a foto/print de uma planta baixa e o app desenha os ambientes no seu terreno (nome, tipo, medidas; os recuos cedem para a planta caber; móveis automáticos). Substitui o andar atual, com desfazer.
- **Fachada**: 📷 *Copiar de uma foto* ao lado de "Criar fachada" → a foto de uma casa ou loja vira as escolhas (telhado, cores, revestimento, esquadrias, janelas, porta, portão, muro, jardim, letreiro).
- Usa o **Gemini** com uma chave sua (grátis em aistudio.google.com/apikey), guardada só no navegador. Arquivo `visao.js`: a IA devolve JSON; o app normaliza (frações → cm, snap 5 cm, mínimo 0,90 m, divisas encostadas, só valores válidos) — nada é desenhado pela IA.

### 7. Prático: clique no item para trocar · botão direito para agir
- Na **Fachada** (e no 3D), passe o mouse: janela, porta, telhado, parede, revestimento, muro, portão, piso da frente, letreiro… viram clicáveis. **Clique** → aparece só o que dá para trocar naquele item; cada escolha aplica na hora e o popover fica aberto para comparar. "Todas as opções" leva ao painel completo.
- **Portas e janelas na planta 2D**: desenhadas da mesma análise do 3D (folha + arco de abertura, janelas nas paredes externas, portão tracejado, ponto azul = entrada principal); clique ou botão direito nelas abre o mesmo popover de trocar/excluir/medidas.
- **Cada janela/porta/parede é sua**: clique numa janela → excluir, quantas nesta parede (1–4), largura/altura/peitoril, tipo e vidro só dela; clique numa parede → + janela, + porta, ★ entrada principal aqui; clique na porta → excluir (se secundária) ou voltar ao automático. Fica em `proj.aberturas` (chave ambiente|lado|índice) e `proj.entradaEm`; o painel lista tudo o que foi decidido, com ↺.
- **Arte / logo anexada**: 📎 no letreiro (popover ou painel) — PNG com transparência fica melhor; a arte substitui o texto no letreiro, outdoor, bandeira, placa do muro, totem e adesivo da vitrine (`proj.logo`, fora do undo).
- **Tamanho de qualquer porta**: clique na porta (entrada, adicionada, interna entre cômodos ou portão da garagem) → largura/altura só dela; porta interna também pode ser excluída.
- **Placas publicitárias**: letreiro na parede / sobre a marquise / **no topo (outdoor)**, **bandeira lateral**, **placa no muro**, totem, **adesivo na vitrine** e **faixa/banner** com texto e cor próprios — tudo no popover do letreiro, no painel e no prompt ("letreiro no topo, bandeira, faixa \"PROMOÇÃO\"").
- **8 estilos**: moderno, clássico, contemporâneo, rústico + industrial, minimalista, mediterrâneo, tropical ("Ver os 8 estilos" fotografa todos).
- Na **Planta**, **arraste no vazio** para laçar: tudo que ficar dentro (ambientes + os móveis deles, móveis avulsos) vira um grupo — arraste qualquer item e todos vão juntos; ⇧ clique adiciona/retira; Ctrl+A seleciona o andar; Del/Ctrl+D/setas agem no grupo; dá para mandar o grupo para outro andar. Mover um ambiente sozinho também leva os móveis dele.
- Na **Planta**, **botão direito** em um ambiente (renomear, tipo, mobiliar só ele, duplicar, girar, andar, excluir), em um móvel (girar, espelhar, duplicar, elevar, **trocar por outro**, excluir) ou no vazio (adicionar ambiente aqui, mobiliar, enquadrar, desfazer).

## Conferir sem clicar
```
index.html?demo=escola-natacao&l=15&p=20&v=planta
index.html?demo=escola-natacao&l=15&p=20&v=piscina
index.html?demo=escola-natacao&l=15&p=20&v=tresd&t3=tour&i=6
index.html?demo=casa-terrea&l=10&p=25&v=planta&ctx=amb
index.html?demo=loja&l=12&p=25&v=fachada&fpop=janela
index.html?demo=zero&l=15&p=20&v=planta&chave=AIza…&foto=minha-planta.png   (foto servida na mesma origem)
index.html?demo=casa-terrea&l=10&p=25&v=planta&cat=1&catk=quarto&selmov=20
index.html?demo=casa-terrea&l=10&p=25&v=tresd&teto=0
index.html?demo=casa-terrea&l=10&p=25&v=tresd&etapa=2
index.html?demo=casa-terrea&l=10&p=25&v=fachada&estilo=classico&num=128&noite
index.html?demo=casa-terrea&l=10&p=25&v=fachada&estilos4
```

> ESTUDO CONCEITUAL PRELIMINAR — não substitui projeto executivo, licenciamento ou ART/RRT.
