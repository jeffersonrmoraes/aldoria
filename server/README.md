# Servidor online — Reinos de Aldoria

Node + Colyseus (WebSocket).
- **Fase 1:** presença (ver outros jogadores), movimento e chat por mapa.
- **Fase 2:** os **monstros do mundo aberto** (`'world'`) vivem no servidor: IA, vida, morte e respawn são compartilhados por todos os jogadores. O servidor também **calcula o dano e o XP** (ataques, habilidades, encantos, mortes) com as mesmas regras do cliente (`src/game/combat.ts`, `src/data/*`, empacotadas no servidor com esbuild).
- **Fase 3a:** **contas** (cadastro/login com senha em scrypt + token assinado) e **saves na nuvem** (3 espaços por conta, sincronizados com o navegador). Uma sessão por conta. Para jogar online é preciso estar logado.
- **Fase 3b:** o servidor confere os itens equipados da ficha contra as regras do gerador (`itemProblem`); itens forjados são ignorados e o jogador recebe um aviso. Nível, ouro e inventário ainda são declarados pelo cliente.
- Continuam locais: **chefes** (Gnarlmaw e masmorras), vida/energia/inventário/saves do jogador e o sorteio de itens. As próximas fases: contas e personagem guardado no servidor.

### Honestidade sobre anti-trapaça
Sem contas, o servidor não "conhece" o personagem: o cliente declara a ficha (`sheet`: raça, classe, nível, equipamento, árvores). O servidor **valida formato e limites** (classe/nível/mãos podem usar o item, números dentro de faixas) e **recalcula tudo**: acerto (d20 × CA), dano, críticos, recargas, alcance, cadência, buffs, XP e ouro por morte. Ele não aceita "dano" do cliente, só a intenção (`atk`, `sk`, `mn`). Mas um cliente adulterado ainda pode declarar uma ficha forte demais (item inventado dentro dos limites, nível mais alto). Fechar isso exige contas e inventário no servidor (fase seguinte). Energia e poções também são locais.

## Contas e banco de dados
- Variáveis de ambiente: `DATABASE_URL` (Postgres; recomendado **Neon** gratuito — crie o projeto, copie a *connection string* e cole no Render em *Environment*) e `AUTH_SECRET` (qualquer texto longo e aleatório; sem ele os logins caem a cada reinício).
- **Sem `DATABASE_URL` o servidor guarda tudo num arquivo local, que o Render gratuito apaga quando o serviço dorme/reinicia** — serve só para testes. `/health` mostra `"store":"postgres"` ou `"arquivo"`.
- API HTTP (CORS aberto): `POST /api/register`, `POST /api/login` → `{token,user}`; `GET /api/chars`, `PUT|DELETE /api/chars/:slot` (header `Authorization: Bearer …`). Limites: 15 logins/min e 8 cadastros/h por IP; corpo ≤ 300 KB.
- Nesta etapa o inventário/XP ainda é o que o cliente salva (a nuvem guarda o que ele envia). A etapa seguinte move a criação de itens, o XP e o ouro para o servidor.

## Rodar localmente
```bash
cd server
npm install
npm run dev          # http://localhost:2567/health
npm run typecheck    # checa tipos (inclui o código compartilhado de ../src)
npm run build        # gera dist/index.js (esbuild; agrupa ../src junto)
```
O build precisa do repositório inteiro (o servidor importa `../src`). Se o Render reclamar de `../../src`, limpe o **Root Directory** do serviço e use `cd server && npm install --include=dev && npm run build` / `cd server && npm start`.

Testes de linha de comando (servidor em outra porta, ex.: `PORT=2599 node dist/index.js`):
```bash
node tools/netbot.mjs            # bot ataca, mata um monstro, recebe XP, vê o respawn
node tools/netfuzz.mjs           # todas as classes/habilidades + mensagens inválidas
```
No jogo (build ou `npm run dev` na raiz), abra com `?server=ws://localhost:2567` e marque **🌐 Jogar online** no menu inicial.

## Deploy no Render (gratuito)
1. Render → **New → Blueprint** → escolha o repositório `jeffersonrmoraes/aldoria` (usa o `render.yaml` da raiz).
2. Aguarde o build; copie a URL do serviço (ex.: `https://aldoria-server.onrender.com`).
3. A URL do jogo precisa apontar para `wss://…` dessa URL: ajuste `DEFAULT_SERVER` em `src/net/config.ts` (ou abra o jogo uma vez com `?server=wss://SUA-URL.onrender.com`, que fica salvo no navegador).
4. O plano gratuito dorme após ~15 min sem uso; o primeiro acesso demora até ~1 min (o jogo mostra "Conectando…").

## Protocolo (v3) — `src/protocol.ts`
- entrar na sala: `joinOrCreate('world', {v:3, tok, name, raceId, classId, tone, level})` (`tok` = token do login)
- cliente → servidor: `pos {x,y,f,mv,loc,dd}` (≈10/s), `chat {t}`, `sheet {raceId,classId,level,equipped,skills,attrs}` (quando muda), `atk {m}`, `sk {i,m?,a?}`, `mn {m}` (m = índice do ponto de spawn)
- servidor → cliente: `welcome`, `online {n}`, `roster [...]`, `join`, `leave`, `snap [[id,x,y,f,mv],…]`, `chat {…}`, `ready {n,h}` (assinatura do mundo), `mobs [idx,x,y,hp,flags,face,…]` (10/s, só os próximos), `hit {m,d,c,k,by}`, `matk {m}`, `hurt {m,d,c}` (só para o alvo), `kill {m,def,xp,gold,elite}` (só para quem participou)
- Monstros: ~965 pontos de spawn gerados de forma determinista (mesma `generateWorld()` no cliente e no servidor; `worldSig` confere). Elites por índice (`eliteAt`).
- Anti-abuso: limite de `pos` por jogador, limite de 40 mensagens de combate/s, cadência/alcance/recarga validados, anti-spam de chat (5 msgs/8 s), nomes/textos sanitizados, versão de protocolo checada ao entrar.
