# Servidor online — Reinos de Aldoria

Node + Colyseus (WebSocket). **Fase 1:** presença (ver outros jogadores), movimento e chat por mapa.
O combate, o loot e os saves ainda são locais em cada cliente (as próximas fases movem isso para o servidor).

## Rodar localmente
```bash
cd server
npm install
npm run dev          # http://localhost:2567/health
```
No jogo (build ou `npm run dev` na raiz), abra com `?server=ws://localhost:2567` e marque **🌐 Jogar online** no menu inicial.

## Deploy no Render (gratuito)
1. Render → **New → Blueprint** → escolha o repositório `jeffersonrmoraes/aldoria` (usa o `render.yaml` da raiz).
2. Aguarde o build; copie a URL do serviço (ex.: `https://aldoria-server.onrender.com`).
3. A URL do jogo precisa apontar para `wss://…` dessa URL: ajuste `DEFAULT_SERVER` em `src/net/config.ts` (ou abra o jogo uma vez com `?server=wss://SUA-URL.onrender.com`, que fica salvo no navegador).
4. O plano gratuito dorme após ~15 min sem uso; o primeiro acesso demora até ~1 min (o jogo mostra "Conectando…").

## Protocolo (v1) — `src/protocol.ts`
- cliente → servidor: `pos {x,y,f,mv,loc}` (≈10/s), `chat {t}`
- servidor → cliente: `welcome`, `online {n}`, `roster [...]`, `join`, `leave`, `snap [[id,x,y,f,mv],…]` (10/s, só jogadores do mesmo mapa), `chat {id,name,t,ch}`
- Anti-abuso: limite de `pos` por jogador, anti-spam de chat (5 msgs/8 s), nomes/textos sanitizados, versão de protocolo checada ao entrar.
