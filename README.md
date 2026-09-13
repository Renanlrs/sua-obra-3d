# SUA OBRA 3D — do projeto à realidade

**No ar: https://renanlrs.github.io/sua-obra-3d/**

App de planta de casas que roda direto no navegador — pelo link acima ou com **duplo clique em `index.html`**. Sem instalação, sem `npm`, sem servidor, sem conta.
Guia completo de uso, atalhos e arquitetura em [`LEIA-ME.md`](LEIA-ME.md). Verificação automática em [`test.html`](test.html) (93 checagens).

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

**✨ Ver os 4 estilos** — fotografa a *sua* planta nos quatro estilos, lado a lado, com o custo de cada um. Clicou, aplicou.

![Comparação dos 4 estilos](docs/fachada-4-estilos.jpg)

### 5. Orçamento, simulador, apresentação e exportação
Custo por m² por tipo de ambiente + custo da fachada; simulador de meta; apresentação cinematográfica com passeio 3D dirigido pelo scroll; exporta SVG, PNG, PDF, `.json` e **passeio 3D em HTML** (um arquivo, abre no celular).

## Conferir sem clicar
```
index.html?demo=casa-terrea&l=10&p=25&v=planta&cat=1&catk=quarto&selmov=20
index.html?demo=casa-terrea&l=10&p=25&v=tresd&teto=0
index.html?demo=casa-terrea&l=10&p=25&v=tresd&etapa=2
index.html?demo=casa-terrea&l=10&p=25&v=fachada&estilo=classico&num=128&noite
index.html?demo=casa-terrea&l=10&p=25&v=fachada&estilos4
```

> ESTUDO CONCEITUAL PRELIMINAR — não substitui projeto executivo, licenciamento ou ART/RRT.
