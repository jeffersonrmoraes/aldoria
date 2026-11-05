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
- 3 espaços de personagem (`aldoria-save-slot-N`; o save antigo migra para o espaço 1).
- **Esc** abre o Menu (Continuar / Como jogar / Salvar e voltar ao menu principal).

## Armas por classe (uma mão e duas mãos)
Toda classe tem pelo menos uma arma de **uma mão** e uma de **duas mãos** (`WEAPONS` em `src/data/items.ts`):
- **Corpo a corpo** (Bárbaro, Clérigo, Guerreiro, Paladino, Ladino): espadas/maças/machadinhas (1 mão) e Montante, Machado Grande e **Bordão** (2 mãos, ladino compra Bordão na Adaga Silenciosa).
- **Monge**: manoplas/bastão/kama (1 mão) + **Bordão de Carvalho / Ferrado / do Mestre Ki** (2 mãos; o bordão é arma de monge no SRD).
- **Patrulheiro**: arcos e bestas (2 mãos) + **Besta de Pulso** (1 mão; besta presa ao antebraço, braçadeira que atira): Besta de Pulso, Rúnica, Élfica, Braçadeira do Caçador de Dragões. Vendida no Arco do Falcão.
- **Conjuradores** (Bardo, Bruxo, Druida, Feiticeiro, Mago): cajados (2 mãos) + **varinhas e livros** (1 mão): Varinha de Carvalho/Cristal/Rúnica/do Arquimago, Livro de Feitiços, Grimório de Guerra, Tomo Arcano, Livro do Arquimago. Vendidos pelo Sábio.
- `isTwoHanded()` reconhece arco, besta (exceto "Besta de Pulso"), cajado, bordão, Montante e Machado Grande.

## Sistemas da grande atualização (classes, árvores, conjuntos, encantos, baús, economia)
- **Classes novas** (`src/data/classes.ts`): Necromante (drain/summon), Cavaleiro Arcano, Dançarino das Lâminas, Ilusionista — todas existem no SRD/guias de D&D (escolas e arquétipos).
- **Árvores** (`src/data/progression.ts`, tecla **K**): *Habilidades* (por habilidade: Potência → Eficiência → Maestria + ramo passivo de Treino) e *Atributos* (3 caminhos × 4 nós). Pontos: habilidades = nível (+1 nos níveis 5 e 10); atributos = nível−1 (+1 nos níveis 5 e 10). Redistribuir custa nível×60 de ouro.
- **Bônus unificado** (`Bonus` em `rules.ts`): itens, conjuntos, árvores e encantos somam via `derive()`.
- **Conjuntos** (`src/data/sets.ts`): bônus com 2/3/4 peças (ex.: Aprendiz/Arquimago, Lich, Mosteiro, Couro, Placas…), casados pelo nome-base do item.
- **Encantos** (`src/data/enchants.ts`): Vampirismo, Sede de Mana (mana ao matar), Fúria, Precisão, Rapidez, Fortuna, Sabedoria + efeitos (chama, gelo, raio, veneno), níveis I–III; mesa de encantamento no Sábio.
- **Baús** (tecla **B**, `src/data/gacha.ts`): monstros têm 1% de chance, chefes 100%. Baú de Madeira (1 item, pity 10→Épico) e de Ouro (3 itens, pity 5→Lendário). Coletados ao tocar; abertos no menu B.
- **Economia** (`src/data/economy.ts`): lojista especialista paga 1,6+0,12×raridade do valor (loja errada 0,8); saturação −5% por venda (recupera em 40 s); Carisma melhora vendas e descontos; bolsa cheia converte o excedente em ouro.
- **VFX por classe** (`src/scenes/vfx.ts`): flecha, virote, orbe, fogo, raio, nota, espinho, radiante, crânio, prisma; golpes (corte, machado, estocada, soco, dança, sagrado, arcano).
- **Mundo**: 400×300 tiles, vila com raio 36 e anel externo de lojas de classe: Ordem do Sol Nascente (Clérigo), Círculo do Carvalho (Druida), Salão da Canção (Bardo), Cripta Sombria (Necromante), Salão do Machado Vermelho (Bárbaro). Terreno em *chunks* de 40 tiles e árvores instanciadas por chunk (frustum culling). Save v3 reposiciona o jogador na vila.
