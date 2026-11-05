# Reinos de Aldoria — MMORPG de navegador baseado em D&D

*MMO RPG by Jeff e Kauã*

**🎮 Jogar:** https://jeffersonrmoraes.github.io/aldoria/

> Este link é permanente: mantenha-o sempre no topo do README. Para atualizar o jogo, rode `npm run build` e copie `dist/index.html` para `docs/index.html` (o GitHub Pages serve a pasta `docs/`).

Mundo 2.5D low-poly em estilo "MMO clássico" (câmera inclinada, personagens 3D animados), combate em tempo real, regras do D&D 5e (SRD 5.1, licença CC-BY-4.0).
Stack: **Three.js + TypeScript + Vite**. Personagens e esqueletos: modelos 3D animados do [KayKit](https://www.kaylousberg.com) (**CC0**), reduzidos para ~130 KB cada; terreno, árvores, casas, rato, lobo e gosma são gerados por código. O jogo inteiro é um único HTML de ~2,2 MB (~850 KB gzip). Veja `CREDITS.md`.

Controles: WASD/setas ou clique para andar · clique no monstro para atacar · 1–4 habilidades · H/J poções · E falar com NPC · botão direito arrastando gira a câmera · roda do mouse dá zoom.

## Rodar

```bash
npm install
npm run dev          # desenvolvimento em http://localhost:5173
npm run build        # gera dist/index.html (arquivo único, abre com duplo clique)
```

## História (Capítulo 1: O Despertar)

Há séculos, cinco heróis da Ordem da Aurora selaram uma Sombra sob Aldoria. O Selo se partiu em 5 fragmentos, guardados em 5 masmorras por chefes marcados por uma mão cinzenta. O jogador reúne os fragmentos com o Sábio Orin (missões principais ★), descobrindo pistas sobre o vilão — o **Rei Cinzento** — que **não aparece neste capítulo**: o epílogo revela que o Selo prendia uma cela vazia e prepara o Capítulo 2. Textos em `src/chapters/story1.ts`.

Masmorras (portais brilhantes no mundo): Catacumbas do Moinho Velho (nv 2–3), Toca do Rei Goblin (4–5), Cripta dos Condenados (6–7), Fortaleza Quebra-Osso (8–9), Câmara do Selo Partido (10, exige 4 fragmentos). Salas geradas por semente (`src/chapters/dungeon.ts`), chefe com fragmento e loot garantido.

## Estado atual — Capítulo 1: O Despertar (protótipo single-player)

- 9 raças e 16 classes (12 do SRD + Necromante, Cavaleiro Arcano, Dançarino das Lâminas, Ilusionista), cada classe com 3 habilidades (níveis 1, 3, 5); Draconato e Tiferino têm habilidade racial
- Combate em tempo real com regras de d20 (ataque vs CA, críticos, dados de dano)
- Níveis 1–10, equipamentos procedurais (arma, armadura, acessório) em 4 raridades, poções
- Mundo de 150×112 tiles com 6 zonas (vila, campos, floresta, cripta, colinas orcs, covil do ogro), 17 monstros, 6 chefes, 5 masmorras
- 4 NPCs (capitão, mercadora, curandeira, sábio), 6 missões secundárias e 5 missões principais
- Save automático no navegador (localStorage)

## Estrutura

```
src/
  data/       regras, raças, classes, itens, monstros (dados puros)
  chapters/   um arquivo por capítulo: mapa, zonas, quests  ← novos capítulos entram aqui
  art/        models.ts (carrega GLB), actors.ts (personagens/monstros 3D, aparência por classe e raça), portrait.ts (retratos 3D), atlas/art (ícones 2D)
  assets/     models/*.glb (KayKit, CC0) e art.png (ícones)
tools/        build_art.py: regenera o atlas de ícones a partir dos packs do Kenney
  game/       estado do jogador, cálculo de atributos, barramento de eventos
  scenes/     World3D (câmera, combate, IA, efeitos) e terrain.ts (terreno, árvores, casas gerados do mapa de tiles)
  ui/         interface em DOM (menu, HUD, inventário, NPCs)
```

## Roadmap

1. **Capítulo 1 polido**: sons, partículas melhores, mais mobs/drops, armas visíveis conforme o item equipado, balanceamento por classe
2. **Multiplayer** (servidor Node + Colyseus): contas, personagens no servidor, mundo compartilhado, chat, grupos, loot por jogador
3. **Capítulo 2**: níveis 11–15, novo mapa, novas subclasses, masmorra em grupo
4. **Sistemas**: pontos de atributo manuais, subclasses, profissões, mercado entre jogadores, guildas

## Como adicionar um capítulo

1. Copie `src/chapters/chapter1.ts` para `chapter2.ts` e ajuste mapa, zonas e quests
2. Adicione novos monstros em `src/data/monsters.ts` e a aparência em `MOB_SPEC` (`src/art/actors.ts`)
3. Registre em `src/chapters/index.ts` e aumente `MAX_LEVEL` / `XP_TABLE` em `src/data/rules.ts`

## Chefes (mecânicas)
- Salões de chefe 24×18 tiles com pilares; chefe espera sozinho no centro. Gnarlmaw tem clareira ampliada.
- HP dos chefes ~3× maior (Dentes-de-Ferro 300 … Vessk 1600, Gnarlmaw 1100).
- Habilidades com **tempo de conjuração** e **área telegrafada** (vermelha, enchendo): círculo, meteoros, chuva (várias áreas no jogador), cone, linha, investida, anel (donut) e invocação. Só causa dano se você ainda estiver dentro quando dispara; o Dash dá esquiva.
- 3 fases (100%/66%/33% de HP) liberam habilidades novas e aceleram o ritmo. Barra do chefe + barra de cast no topo da tela.
- Dados em `src/game/bosses.ts`.
- Fix: efeitos de impacto ("bolinhas") não vazam mais (lista de fx recriada a cada frame).

## Balanceamento e loja (atualização)
- Casts de chefe ~45% mais rápidos (`CAST_SCALE` em World3D) e intervalos menores entre habilidades.
- Classes à distância (mago, bardo, druida, patrulheiro): atacar/conjurar prende o personagem por ~0,3–0,56 s (não dá para "andar atirando"); regra D&D de **desvantagem** ao atirar com inimigo adjacente ou além de 75% do alcance.
- Arena do chefe sela as saídas ao entrar (barreira rúnica roxa) e só abre quando o chefe cai (ou você morre). Chefes de masmorra não reaparecem.
- Armazém de Relíquias da mercadora: itens Raros/Épicos (e Lendários a partir do nível 8) com temática D&D (Mithral, Adamantina, Vorpal, "de Bahamut"...), preço = 10× o valor (16× lendário). Nova raridade **Lendário** (+4).

## Ranged — conjuração cancelável (substitui o travamento)
Ataques e habilidades de classes à distância têm um breve tempo de conjuração (barra amarela acima da barra de habilidades; ~0,2–0,34 s). Você precisa estar parado para iniciar; se andar antes de terminar, o ataque é **cancelado** (sem dano, sem gastar energia/recarga) e você se move livremente. Desvantagem (2d20, vale o pior) com inimigo colado ou além de 75% do alcance.

Habilidades de alvo (bolt/strike) à distância: o personagem para instantaneamente e fica imóvel durante a conjuração (não cancela). Habilidades centradas no personagem (nova/anel, cone), cura, buffs e dash são instantâneas e podem ser usadas andando.

## Vila ampliada (Pouso do Viajante)
- Vila ~45×31 tiles com praça maior, postes de luz e 6 edifícios com **interior próprio** (entre pela porta com E ou clique): Taverna do Dragão Dourado (canecas; Taverneiro Bram: descanso, hidromel, ensopado, rumores), Forja do Martelo Rubro (espadas cruzadas; Ferreira Durga: armas e armaduras raras/épicas/lendárias), Catedral da Aurora (igreja longa com cruz; Padre Anselmo — confessionário com Bênção de Pelor — e Irmã Elowen), Empório da Sildra (frasco de poção; poções, amuletos e anéis), Quartel da Guarda (escudo e bandeiras; Capitão Brann) e Torre do Sábio (torre com chapéu de mago; Sábio Orin).
- Cada edifício tem placa com o nome sobre a entrada, emblema do ofício e decoração interna. Dados em `src/chapters/town.ts`, exteriores em `src/scenes/buildings.ts`, interiores em `src/scenes/interiors.ts`.
- A entrada das Catacumbas do Moinho Velho foi movida para (90,78), fora da vila.

## Mapa ampliado e muralha (atualização)
- **Atual: mapa 400×300 tiles, vila com raio 36 e ~1.200 monstros** (histórico: 210×156, antes 150×112), mesmos 6 biomas, ~2× mais monstros; dimensões em `src/chapters/mapdims.ts`. Entradas das masmorras e covil do Gnarlmaw reposicionados proporcionalmente. Saves antigos com posição inválida voltam ao centro da vila.
- Vila maior (65×45) com muralha de pedra, torres nos cantos e 4 portões nas estradas (placa "Pouso do Viajante"). Nenhum monstro nasce dentro nem a 6 tiles da muralha, e nenhum entra na vila.
- Edifícios com bem mais espaço entre si; ruas norte e sul; postes de luz.
- Guardas: 2 em cada portão e 3 patrulhando (falam dicas ao clicar/E).

## Vila circular (v. atual)
- Vila redonda (raio 36 tiles (antes 28)) com muralha circular, torres e 4 portões (N/S/L/O) com guardas.
- Catedral da Aurora no centro; praça de pedra com fonte grande na frente (sul) da igreja.
- Anel de ruas + ruas radiais em calçamento de tijolinhos de pedra; edifícios (forja, torre, taverna, quartel, empório) espalhados com folga da muralha, portas voltadas ao centro (suporte a portas E/O).

### Ajustes na vila (casas, telhados, praça)
- Telhados de edifícios retangulares corrigidos (cumeeira ao longo do lado correto).
- Casas de moradores geradas proceduralmente em ângulos naturais, viradas para a rua mais próxima, com vielas de pedra ligando à rua (`villageHouses` em chapter1.ts).
- Praça com menos postes; bancos virados para a fonte e canteiros de flores (`bench`, `flowerBed` em buildings.ts).

## Mapa (tecla M)
- Janela com duas abas: **Mapa Global** (reino inteiro) e **Mapa da Cidade** (planta da vila murada), em estilo de pergaminho medieval (tinta, aquarela, moldura, bússola, escala, faixa de título).
- **Névoa de exploração**: o mapa começa em branco ("Terra Incógnita") e é revelado conforme o jogador anda (células de 4×4 tiles, raio ~12), salvo no personagem (`player.explored`). Cidade, biomas e masmorras só aparecem depois de explorados; a legenda abaixo lista o que já foi descoberto.
- Marcadores: ícones desenhados para a cidade, cada masmorra, nomes e níveis dos biomas, estrada, lago, dragão decorativo; pino vermelho "Você".
- Código: `src/game/mapdata.ts` (exploração), `src/ui/mapview.ts` (renderização), integração em `ui.ts` e `World3D.ts`.

## Regra do projeto
**Toda criação deve ter como base o mundo de D&D 5e (SRD).** Ver `CLAUDE.md`.

## Equipamentos
Seis espaços: **Elmo, Corpo, Pernas, Mão Direita, Mão Esquerda, Acessório**. Mão Esquerda aceita escudo (+2 CA), arma leve (ataque extra) ou foco de conjuração conforme a classe; armas de duas mãos bloqueiam a mão esquerda. Saves antigos migram automaticamente (arma→Mão Direita, armadura→Corpo, berloque→Acessório).

## Menu, espaços de personagem e lojas especializadas
- **Esc** → Menu → "Salvar e voltar ao menu principal". Tela inicial com **3 espaços de personagem** (jogar, criar, excluir).
- Lojas por ofício: Ferreiro, Sábio, Arqueira, Monge, Ladino e Empório (ver CLAUDE.md). Três novos prédios na cidade: Arco do Falcão (leste), Mosteiro do Punho Sereno (sul) e Adaga Silenciosa (sul-oeste).

## Armas por classe (uma mão e duas mãos)
Toda classe tem pelo menos uma arma de **uma mão** e uma de **duas mãos** (`WEAPONS` em `src/data/items.ts`):
- **Corpo a corpo** (Bárbaro, Clérigo, Guerreiro, Paladino, Ladino): espadas/maças/machadinhas (1 mão) e Montante, Machado Grande e **Bordão** (2 mãos, ladino compra Bordão na Adaga Silenciosa).
- **Monge**: manoplas/bastão/kama (1 mão) + **Bordão de Carvalho / Ferrado / do Mestre Ki** (2 mãos; o bordão é arma de monge no SRD).
- **Patrulheiro**: arcos e bestas (2 mãos) + **Besta de Pulso** (1 mão; besta presa ao antebraço, braçadeira que atira): Besta de Pulso, Rúnica, Élfica, Braçadeira do Caçador de Dragões. Vendida no Arco do Falcão.
- **Conjuradores** (Bardo, Bruxo, Druida, Feiticeiro, Mago): cajados (2 mãos) + **varinhas e livros** (1 mão): Varinha de Carvalho/Cristal/Rúnica/do Arquimago, Livro de Feitiços, Grimório de Guerra, Tomo Arcano, Livro do Arquimago. Vendidos pelo Sábio.
- `isTwoHanded()` reconhece arco, besta (exceto "Besta de Pulso"), cajado, bordão, Montante e Machado Grande.

## Grande atualização: classes, árvores, conjuntos, encantos e mundo maior
Veja a seção correspondente em `CLAUDE.md`. Resumo: 16 classes (novas: Necromante, Cavaleiro Arcano, Dançarino das Lâminas, Ilusionista); árvores de habilidades e atributos (K); conjuntos de armadura com bônus 2/3/4 peças; encantamento de armas; economia com lojas especialistas e saturação; projéteis/golpes distintos por classe; mapa 400×300, vila maior com 5 novas lojas de classe.

## Vilas dos biomas
A cidade principal fica nos Campos. Floresta (Passo da Clareira), Cripta (Vigília dos Sinos), Colinas dos Orcs (Forte Cinzaferro) e Covil do Ogro (Último Refúgio) têm vilas muradas com taverna, lojas e curandeiros próprios. Detalhes em `CLAUDE.md`.
