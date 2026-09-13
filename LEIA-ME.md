# SUA OBRA 3D — do projeto à realidade

App de planta de casas que roda direto no navegador. Sem instalação, sem `npm`, sem servidor, sem conta.

## Como abrir

Duplo clique em **`index.html`**. Só isso.

Se preferir servir:

```
python -m http.server 8877 --directory C:\Users\mathe\sua-obra-3d
```
e abrir `http://127.0.0.1:8877` (use `127.0.0.1`, não `localhost`).

## O que ele faz

1. **Escolhe o tipo e o terreno** → o app monta a primeira planta sozinho, por algoritmo determinístico (não é IA, não alucina, nunca põe ambiente fora do terreno nem sobreposto).
2. **Arrastar, redimensionar, renomear** — manipulação direta na planta, com ímã nos vizinhos, guia de alinhamento e medida ao vivo.
3. **Clicar na cota e digitar a medida nova** — a parede anda e tudo recalcula.
4. **Mobiliar** (tecla `M`) — catálogo de 44 móveis em 9 categorias, cada um com a **figurinha vista de cima** na planta (cama, sofá, fogão, vaso, carro…) e o **modelo 3D** correspondente. Clique para adicionar ou arraste do catálogo para a planta. O móvel selecionado ganha **cotas verdes até as paredes**, alça de giro e um **menu radial** (girar, espelhar, duplicar, elevar, excluir). O projeto novo já nasce mobiliado (**Mobiliar automaticamente** refaz quando quiser). No 3D o mesmo móvel pode ser clicado e **arrastado pelo piso**.
5. **3D de verdade** gerado da mesma planta (three.js local, sem internet): paredes com espessura, portas, janelas, laje, muro, rua, árvores e móveis por tipo de ambiente. Três jeitos de navegar — **Girar** (fora), **Andar** (primeira pessoa, W A S D) e **Passeio** (cômodo a cômodo, com legenda e frase, igual a um tour de imobiliária). Botão **Teto** vira casa de boneca; slider **Obra** mostra as etapas (terreno → fundação → **estrutura** (sapatas, pilares, baldrames, vigas e arranques de ferro) → alvenaria → cobertura → acabamento). A pill **2D / 3D** no topo alterna entre a planta e o 3D. Duplo clique num piso entra no ambiente. Fachada e corte continuam em SVG.
6. **Fachada** (tecla `F`) — a frente da casa tem um designer próprio: 4 **estilos** de partida (Moderno, Clássico, Contemporâneo, Rústico), cobertura (platibanda, 2 ou 4 águas) e telha, cor da parede e de destaque, **revestimento da frente** (ripado, pedra, tijolinho, cimento — recortado em volta das portas e janelas), esquadrias, portão, muro (baixo, alto ou vidro), jardim, marquise, iluminação e **número da casa**. Tudo aparece no 3D visto da calçada, na **Elevação** técnica e no orçamento (**quanto essa fachada custa**, item por item). Botão **☾ Noite** acende as janelas, os spots da fachada, a luz da entrada e o poste da rua. **✨ Ver os 4 estilos** fotografa a sua casa nos quatro estilos, lado a lado, com o custo de cada um — é só clicar no preferido.
7. **Orçamento** por m² e por tipo de ambiente, com padrão econômico / padrão / superior.
8. **Simulador** de meta contra o custo estimado.
9. **Apresentação** cinematográfica para mandar ao cliente — com o **passeio 3D dirigido pelo scroll**: o cliente rola e a câmera entra na casa e passa por cada ambiente.
10. **Exportar** SVG, PNG, PDF, o `.json` do projeto e o **passeio 3D em HTML** (um arquivo, abre no celular com internet — o three.js vem da CDN).

## Atalhos

| | | | |
|---|---|---|---|
| `V` selecionar | `R` novo ambiente | `M` mobiliar | `Espaço` mover a tela |
| `G` grade | `2` planta | `⇧R` gira o móvel 90° | `Esc` solta o móvel |
| `F` fachada | | | |
| `C` cotas | `P` planta | `A` ambientes | `3` 3D |
| `O` orçamento | `S` simulador | `Ctrl+K` buscar / executar | `?` lista completa |
| `Ctrl+Z` desfazer | `Ctrl+Shift+Z` refazer | `Ctrl+D` duplicar | `Delete` excluir |
| `Ctrl+0` enquadrar | `Alt` (segurar) desliga o ímã | `Shift` trava no eixo | `[` recolhe a barra |

Duplo clique num ambiente renomeia. Clique num número de cota edita a medida.

## Regras que o app respeita

- **Nada de dado duplicado.** Existe um único objeto `project`, em centímetros inteiros. Toda área, percentual e custo é calculado por função pura em `model.js` na hora de mostrar. Se você mudar uma medida, tudo muda junto — não existe sincronização manual.
- **Número derivado não é editável**, e o tooltip diz de onde ele saiu.
- **Salva sozinho** no navegador (debounce de 800 ms) e o topo mostra o estado.
- **Desfazer com nome** — o tooltip do botão diz qual passo vai ser desfeito.
- **Formato brasileiro** em tudo: vírgula decimal, 2 casas, sufixo de unidade.
- **Aviso de estudo conceitual** fixo no rodapé e na apresentação.

## Arquivos

| Arquivo | O que é |
|---|---|
| `index.html` | estrutura da página |
| `style.css` | tokens e casca (escura e neutra; canvas claro) |
| `icons.js` | ícones em traço 1.5 |
| `model.js` | **fonte da verdade** — estado, derivadas, validação, histórico, persistência (inclui `proj.moveis`) |
| `moveis.js` | **catálogo de móveis** — medidas, figurinha SVG de cima, receita 3D e o "mobiliar automaticamente". Escrito como função (`MOVEIS_LIB`) para o export embutir |
| `plan.js` | desenho e manipulação direta da planta em SVG |
| `tres.js` | **3D real** — análise pura da planta (paredes, portas, janelas, ordem do passeio), cena three.js, câmeras Girar/Andar/Passeio, etapas da obra, fachada (presets, telhado, revestimentos, noite), seção de passeio por scroll. Escrito como uma função (`TRES_ENGINE`) para o export embutir com `toString()` |
| `three.min.js` | three.js r158 (UMD, local — funciona por duplo clique) |
| `views.js` | miniaturas SVG, fachada, corte, apresentação |
| `ui.js` | navegação, inspector, atalhos, command palette |
| `test.html` | 93 verificações do modelo, das vistas e da análise 3D — abra para conferir |

## Conferir que está tudo certo

Abra **`test.html`**. Ele checa gerador, derivadas, formatação, histórico, validação e as quatro vistas. O título da aba mostra o placar.

## Parâmetros de URL para conferir sem clicar

`?demo=casa-terrea&l=10&p=25&v=tresd` abre direto no 3D. Acrescente `&t3=tour&i=4` (parada 4 do passeio), `&t3=walk`, `&teto=0`, `&etapa=2` (estrutura), `&luz=sol,hemi,amb`. `&cat=1&catk=quarto` abre o catálogo numa categoria; `&selmov=20` seleciona o 21º móvel e enquadra o ambiente dele. `&v=fachada&estilo=classico&num=128&noite` abre a fachada clássica à noite; `&estilos4` abre a comparação dos 4 estilos. `&apres&scroll=1200` abre a apresentação já rolada; `&htmlpasseio&scroll=4000` abre o HTML exportado no lugar do app.

## Para levar ao Lovable depois

O `model.js` é o contrato. Portar para React + Zustand é trocar a casca, mantendo `areaOf`, `custoDe`, `problemas` e o histórico como estão — eles não dependem do DOM.
