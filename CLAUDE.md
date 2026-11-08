# Reinos de Aldoria — regras do projeto

## REGRA DE OURO: tudo é baseado no mundo de D&D
Toda criação (classes, raças, itens, monstros, magias/habilidades, NPCs, locais, missões, textos, nomes, regras de combate, equipamentos) deve ter como base o universo de **Dungeons & Dragons 5e** (SRD 5.1, CC-BY-4.0): terminologia, mecânicas e fantasia.
- Use nomes, criaturas e itens do SRD (ex.: Adaga, Espada Longa, Cota de Malha, Escudo, Símbolo Sagrado, Orbe, Kobold, Goblin, Beholder, Pelor, Bahamut) em vez de inventar conceitos alheios ao mundo.
- Respeite as regras do SRD: d20 para ataque, CA, proficiência com armaduras/escudos por classe, armas de duas mãos, ataque extra com arma leve na mão esquerda, focos de conjuração, raridades (Comum, Incomum, Raro, Épico≈Muito Raro, Lendário), desvantagem, etc. Quando um detalhe for adaptado para o jogo em tempo real, mantenha a lógica D&D e registre a adaptação.
- Textos do jogo em português do Brasil, com tom de fantasia medieval.
- Antes de adicionar algo novo, pergunte: "isso existiria num livro de D&D?". Se não, adapte ou troque.
- Arte e dados originais ou CC0/CC-BY (ver CREDITS.md); não copiar conteúdo protegido fora do SRD.

## Equipamentos (espaços)
Elmo · Corpo · Pernas · Mão Direita · Mão Esquerda · Acessório (`Slot` em `src/data/items.ts`).
- Corpo define a CA base (armadura); Elmo e Pernas dão pequenos bônus (regra da casa); proficiência por tipo de armadura (tecido/leve/média/pesada).
- Mão Direita: arma principal (estilo da classe). Armas de duas mãos (Montante, Machado Grande, arcos, bestas, cajados) ocupam também a Mão Esquerda.
- Mão Esquerda: **escudo** (+2 CA; só classes com proficiência: Bárbaro, Clérigo, Druida, Guerreiro, Paladino, Patrulheiro), **arma leve** (ataque extra sem modificador de atributo; classes corpo a corpo, exceto Monge) ou **foco** (Símbolo Sagrado, Orbe, Grimório, Totem; conjuradores, Clérigo e Paladino).
- Acessório: anéis, amuletos, botas mágicas.

## Lojas especializadas (independentes da classe do comprador)
Cada loja vende o que o seu ofício vende (`SHOP_INFO` / `genShopStock` em `src/data/items.ts`); o jogador só vê o aviso "Sua classe não pode usar" quando o item não serve.
- **Ferreiro (Forja)**: espadas, machados, maças, martelos, armaduras leves/médias/pesadas, elmos, grevas, escudos, acessórios comuns.
- **Sábio (Torre)**: cajados, varinhas, orbes, grimórios, tomos, vestes/chapéus/calças de tecido, acessórios mágicos.
- **Arqueira (Arco do Falcão)**: arcos, bestas, armaduras leves/médias, aljavas, flechas, braçais.
- **Monge (Mosteiro do Punho Sereno)**: manoplas, bastão, kama, vestes de monge, acessórios de ki.
- **Ladino (Adaga Silenciosa)**: adagas, rapieiras, couro leve, ferramentas de ladrão.
- **Empório**: poções e amuletos/anéis.
Novas lojas: adicionar `BuildingKind` em `town.ts`, emblema em `buildings.ts`, interior em `interiors.ts`, NPC em `NPC_SPEC` e cor em `mapview.ts`.

## Menu e personagens
- **Tela inicial temática** (`showMenu` em `ui.ts`, CSS `.tscreen` em `index.html`): céu noturno com lua, dragão voando, castelo, brasas, d20 girando, título serifado dourado e fichas de personagem em pergaminho (selo numerado). Só CSS/SVG, sem arquivos.
- **Criação de personagem** (`showCreate`, CSS `.create2`/`.ctab`/`.opt`): editor com abas (Raça, Classe, Olhos, Roupa, Cabeça, Rosto, Altura, Pele), boneco 3D grande com setas de girar, opções com miniaturas (cache `thumbCache`) e botão de aparência aleatória.
- **Aparência** (`Look` em `src/data/looks.ts`, guardada em `PlayerState.look`; ausente em saves antigos = visual original do modelo): cor dos olhos, altura (90–110%), roupa (tinge corpo/braços/pernas/capa), adereço de cabeça, rosto (barba, cicatriz, pintura…). Desenhada por `applyLook` em `src/art/look3d.ts`: o encaixe é **medido na malha real da cabeça** (classe `Surface` lança raios contra o crânio na pose do osso); cabelo/chapéus são cascas coladas ao crânio, olhos/rosto são colados na superfície com a normal local. A posição dos olhos desenhados de cada modelo está na tabela `EYES` (medida com `tools`-style render ortográfico). Funciona nos 4 modelos KayKit e em qualquer raça/altura. Bárbaro/Monge: barba do modelo vira cor de pele quando o rosto não é 'Barba'. Para novas opções: adicione em `looks.ts` e no `switch` de `look3d.ts`, e confira com a folha de miniaturas. Online: `look` vai no join/roster (PROTOCOL v6) e é validada por `sanitizeLook`.
- **Cabelo**: não é customizável (decisão do projeto: nada de estilos, gênero ou cor de cabelo); cada classe mantém o cabelo, a barba e as sobrancelhas do modelo KayKit. Barba/bigode do editor (aba Rosto) usam castanho-escuro fixo.
- **Olhos**: só a cor muda (os olhos do modelo são recoloridos por cor de vértice em `recolorBaked`, a única coisa que ele ainda faz); não há olhos desenhados por cima.
- 3 espaços de personagem (`aldoria-save-slot-N`; o save antigo migra para o espaço 1).
- **Esc** abre o Menu (Continuar / Como jogar / Salvar e voltar ao menu principal).

## Armas por classe (uma mão e duas mãos)
Toda classe tem pelo menos uma arma de **uma mão** e uma de **duas mãos** (`WEAPONS` em `src/data/items.ts`):
- **Corpo a corpo** (Bárbaro, Clérigo, Guerreiro, Paladino, Ladino): espadas/maças/machadinhas (1 mão) e Montante, Machado Grande e **Bordão** (2 mãos, ladino compra Bordão na Adaga Silenciosa).
- **Monge**: manoplas/bastão/kama (1 mão) + **Bordão de Carvalho / Ferrado / do Mestre Ki** (2 mãos; o bordão é arma de monge no SRD).
- **Patrulheiro**: arcos e bestas (2 mãos) + **Besta de Pulso** (1 mão; besta presa ao antebraço, braçadeira que atira): Besta de Pulso, Rúnica, Élfica, Braçadeira do Caçador de Dragões. Vendida no Arco do Falcão.
- **Conjuradores** (Bardo, Bruxo, Druida, Feiticeiro, Mago): cajados (2 mãos) + **varinhas e livros** (1 mão): Varinha de Carvalho/Cristal/Rúnica/do Arquimago, Livro de Feitiços, Grimório de Guerra, Tomo Arcano, Livro do Arquimago. Vendidos pelo Sábio.
- `isTwoHanded()` reconhece arco, besta (exceto "Besta de Pulso"), cajado, bordão, Montante e Machado Grande.

## Sistemas da grande atualização (classes, árvores, conjuntos, encantos, economia)
- **Classes novas** (`src/data/classes.ts`): Necromante (drain/summon), Cavaleiro Arcano, Dançarino das Lâminas, Ilusionista — todas existem no SRD/guias de D&D (escolas e arquétipos).
- **Árvores** (`src/data/progression.ts`, tecla **K**): *Habilidades* (por habilidade: Potência → Eficiência → Maestria + ramo passivo de Treino) e *Atributos* (3 caminhos × 4 nós). Pontos: habilidades = nível (+1 nos níveis 5 e 10); atributos = nível−1 (+1 nos níveis 5 e 10). Redistribuir custa nível×60 de ouro.
- **Bônus unificado** (`Bonus` em `rules.ts`): itens, conjuntos, árvores e encantos somam via `derive()`.
- **Conjuntos** (`src/data/sets.ts`): bônus com 2/3/4 peças (ex.: Aprendiz/Arquimago, Lich, Mosteiro, Couro, Placas…), casados pelo nome-base do item.
- **Encantos** (`src/data/enchants.ts`): Vampirismo, Sede de Mana (mana ao matar), Fúria, Precisão, Rapidez, Fortuna, Sabedoria + efeitos (chama, gelo, raio, veneno), níveis I–III; mesa de encantamento no Sábio.
- **Sem baús/loot box**: removidos por decisão do projeto. Chefes sempre largam um item (raridade alta); monstros comuns ~32% de chance de item.
- **Economia** (`src/data/economy.ts`): lojista especialista paga 1,6+0,12×raridade do valor (loja errada 0,8); saturação −5% por venda (recupera em 40 s); Carisma melhora vendas e descontos; bolsa cheia converte o excedente em ouro.
- **VFX por classe** (`src/scenes/vfx.ts`): flecha, virote, orbe, fogo, raio, nota, espinho, radiante, crânio, prisma; golpes (corte, machado, estocada, soco, dança, sagrado, arcano).
- **Mundo**: 400×300 tiles, vila com raio 36 e anel externo de lojas de classe: Ordem do Sol Nascente (Clérigo), Círculo do Carvalho (Druida), Salão da Canção (Bardo), Cripta Sombria (Necromante), Salão do Machado Vermelho (Bárbaro). Terreno em *chunks* de 40 tiles e árvores instanciadas por chunk (frustum culling). Save v3 reposiciona o jogador na vila.
- **Vilas dos biomas** (`VILLAGES` em `src/chapters/town.ts`): a cidade principal (Pouso do Viajante) fica nos **Campos** e é onde se começa. Cada outro bioma tem sua vila murada (raio 17, 4 portões, fonte, 4 edifícios), zona segura própria: **Passo da Clareira** (Floresta; taverna, arqueiro, druida, armazém), **Vigília dos Sinos** (Cripta; taverna, clérigo, necromante, posto de guarda), **Forte Cinzaferro** (Colinas dos Orcs; taverna, ferreiro, bárbaro, quartel), **Último Refúgio** (Covil do Ogro; taverna, sábio, capela com curandeira, empório). Zonas seguras usam `ZoneDef.safe` (não `=== 'town'`). Cada vila fica na estrada em cruz que corta o mapa.

## README e GitHub Pages
- O topo do `README.md` deve **sempre** conter o link do jogo: https://jeffersonrmoraes.github.io/aldoria/ (permanente; nunca remover ao reescrever o README).
- Publicação: `npm run build` e copiar `dist/index.html` para `docs/index.html`; Pages serve `docs/` da branch `main`.

## Polimento do Capítulo 1
- **Áudio** (`src/game/audio.ts`): tudo procedural em WebAudio (sem arquivos). `sfx.*` para golpes por classe, flechas, magias, dano, morte, moedas, loot, poções, UI; trilha gerativa por bioma/masmorra/chefe (`setMusicZone`). Volume/mudo no menu Esc (salvo em `aldoria-audio`). O navegador só libera som após um clique/tecla.
- **Equipamento visível** (`applyEquipment` em `src/art/actors.ts`): arma de uma/duas mãos e escudo seguem o item equipado (onde o modelo CC0 tiver a peça; senão mantém o padrão da classe).
- **Balanceamento** (`src/data/balance.ts`, `CLASS_POWER`): multiplicador de dano por classe calibrado por `tools/balance.ts` (`npx esbuild tools/balance.ts --bundle --platform=node --outfile=/tmp/balance.cjs && node /tmp/balance.cjs`). Rode de novo ao mexer em classes, itens ou monstros.
- **Monstros novos** (SRD): Chacal, Bandido (Campos); Worg, Hobgoblin (Floresta); Carniçal, Sombra (Cripta); Xamã Orc, Gnoll (Colinas); Troll (Covil do Ogro). **Elites** (6% dos spawns): vida ×2,4, XP ×3, item garantido de raridade alta, nome dourado (`eliteOf`).
- **Visual dos monstros** (`MOB_SPEC` em `src/art/actors.ts`): além do modelo KayKit (Cavaleiro, Bárbaro, Mago, Ladino, Esqueleto Servo/Mago/Ladino/Guerreiro), cada monstro tem `tint`/`skin`/`wide`/`opacity`/`eyeColor` e `parts` procedurais presos aos ossos (chifres, orelhas, presas, olhos brilhantes, crina, cauda, espinhos, coroa). Rato/lobo/chacal/worg/Rei dos Ratos são criaturas procedurais com variantes.

## Modo online (MMO — fases 1, 2, 3a, 3b e grupos)
- **Servidor** (`server/`, Node + Colyseus 0.16, `WorldRoom`): presença, posição (10 Hz, só jogadores do mesmo mapa `loc.id`), chat por mapa e, na **fase 2**, os **monstros do mundo aberto** (`WorldSim` em `server/src/sim.ts`): IA, vida, morte, respawn, dano e XP autoritativos. Deploy no Render via `render.yaml` (ver `server/README.md`). Build com esbuild (`server/dist/index.js` já agrupa `../src`).
- **Regras compartilhadas** (`src/game/combat.ts`, puro, sem DOM/Three): `skillAt`, `calcDamage`, `basicHit`, `killXp`, `eliteAt`, `worldSig`. O cliente e o servidor usam as mesmas fórmulas; ao mudar combate/XP/derive, mude nesses módulos (e rode `tools/balance.ts`).
- **Quem decide o quê (online, mundo aberto `'world'`)**: o servidor decide acerto, dano, crítico, recargas, procs de encanto, DoTs, vida/morte dos monstros, ataques dos monstros (`hurt`) e XP/ouro (`kill`). O cliente envia só intenções (`atk`, `sk`, `mn`) e a ficha declarada (`sheet`, validada por `server/src/sheet.ts`). Continuam **locais**: chefes e masmorras, vida/energia/poções/inventário/saves do jogador, sorteio de itens, bênção do templo. Sem contas ainda → ficha declarada pode ser forjada dentro dos limites (documentado no README do servidor).
- **Cliente** (`src/net/`): `config.ts`, `online.ts` (`NetClient`; nunca derruba o jogo: se o servidor falha, segue offline com monstros locais), `remotes.ts`, `protocol.ts` (**espelho** de `server/src/protocol.ts`: mantenha os dois idênticos e incremente `PROTOCOL` ao mudar; atual **v6**). Em `World3D.ts`: `srvOn()/isSrv(m)` decidem se um monstro é do servidor; `damage()`/`miss()` ignoram esses monstros; `onMobs/onSrvHit/onSrvHurt/onSrvKill` aplicam o que o servidor manda; `grantKill()` aplica recompensas (local ou do servidor). Monstros de masmorra/chefe têm `idx` indefinido.
- Mundo determinista: `generateWorld()` usa semente fixa; o índice do ponto de spawn é o id do monstro na rede. **Não** use `Math.random()` na geração do mundo nem mude a ordem dos spawns sem atualizar os dois lados (`worldSig` detecta diferença e o cliente cai para monstros locais).
- **Contas (fase 3a)**: `server/src/auth.ts` (scrypt, token HMAC, rotas `/api/*`) e `server/src/store.ts` (Postgres via `DATABASE_URL`, senão arquivo local temporário). Cliente: `src/net/account.ts` (login, `syncAll` mescla saves local × nuvem pelo campo `sv`, ganchos `hooks.save/del` em `state.ts` enviam o save a cada ≤6 s). O menu inicial mostra o formulário quando "Jogar online" está marcado; sem login o jogo online não conecta. `tok` no join.
- **Validação de itens (fase 3b)**: `itemProblem(item)` em `src/data/items.ts` (puro) confere se o item é plausível para o gerador (`genItem`): base conhecida, dados/velocidade/nível mínimo idênticos, CA e bônus ≤ máximo da raridade, `plus ≤ raridade`, encanto só em arma. `server/src/sheet.ts` descarta itens inválidos e o servidor manda `warn` ao cliente (log vermelho). **Ao criar itens/tabelas novos em `items.ts`, rode `tools/itemcheck.ts`** (aceita 100% dos gerados; se recusar algum legítimo, ajuste `itemProblem`). PROTOCOL **v6** (`warn`, chat `grupo`, `look`). Teste de forja: `tools/netforge.mjs`. Ainda declarados pelo cliente: nível, inventário, ouro, poções, HP/energia (próximo: ledger de XP/ouro no servidor).
- **Grupos** (`WorldRoom.command`, via chat): `/grupo convidar Nome`, `/grupo aceitar` (60 s), `/grupo sair`, `/grupo` (lista), `/g mensagem` (chat de grupo, ch `grupo`). Até 5 membros; membros num raio de 900 px da morte do monstro dividem XP/ouro integral (`PARTY_RANGE` em `sim.ts`). **Anti-trapaça de nível**: `trustedLevel` no `WorldRoom` limita a subida do nível declarado a 1 por 40 s conectado (por conta+nome+classe; reinício do servidor zera). Teste: `tools/netparty.mjs`.
- Chat: **Enter** abre a caixa (só online); mensagens aparecem no log e em balão sobre o personagem.
- Toda mudança de mensagens exige rebuild do servidor *e* do cliente (`PROTOCOL` diferente = servidor recusa a entrada).
- Testes: `tools/netbot.mjs` (bot mata monstro e vê respawn) e `tools/netfuzz.mjs` (todas as classes + lixo) contra um servidor local.
