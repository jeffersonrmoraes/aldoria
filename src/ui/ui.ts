import { CLASSES, CLASS_BY_ID, ARMOR_NAMES } from '../data/classes';
import { RACES, RACE_BY_ID } from '../data/races';
import { ABILITIES, ABILITY_NAMES, ABILITY_SHORT, MAX_LEVEL } from '../data/rules';
import { BAG_SIZE, PlayerState, addItem, derive, deleteSave, equipBlock, gainXp, listSaves, loadSave, newPlayer, player, save, setPlayer, setSlot } from '../game/state';
import { Item, RARITY_COLORS, RARITY_NAMES, SHOP_INFO, ShopId, SLOT_LABEL, SLOT_ORDER, Slot, allowedOff, describeItem, genItem, genShopStock, shopPrice } from '../data/items';
import { QUESTS, ZONES, ZoneDef, zoneAt } from '../chapters/chapter1';
import { BUILDINGS } from '../chapters/town';
import { MapKind, drawMap, resetMapCache } from './mapview';
import { exploredVersion, isExplored, mapSource } from '../game/mapdata';
import { CURRENT_CHAPTER } from '../chapters';
import { DUNGEONS, EPILOGUE, FRAGMENTS, FRAGMENT_BY_ID, MAIN_QUESTS, SAGE_INTRO } from '../chapters/story1';
import { frameIcon, itemFrameName } from '../art/art';
import { portrait } from '../art/portrait';
import { bus } from '../game/bus';
import { attrTree, attrPointsLeft, attrPointsTotal, buyNode, nodeState, respecCost, skillPointsLeft, skillPointsTotal, skillTree, Tree } from '../data/progression';
import { ENCHANTS, ROMAN, enchantCost, enchLine } from '../data/enchants';
import { SET_BY_ID, activeSets, setTipHtml } from '../data/sets';
import { buyPrice, buysItem, dumpValue, fmtGold, potionPrice, registerSale, sellOffer } from '../data/economy';
import { bonusLines } from '../data/rules';

const root = document.getElementById('ui')!;

function h(html: string, cls = ''): HTMLElement {
  const d = document.createElement('div');
  if (cls) d.className = cls;
  d.innerHTML = html;
  return d;
}
const qa = <T extends HTMLElement = HTMLElement>(s: string, el: ParentNode = root) => Array.from(el.querySelectorAll(s)) as T[];
const q = <T extends HTMLElement = HTMLElement>(s: string, el: ParentNode = root) => el.querySelector(s) as T;
const itemImg = (i: Item, px = '100%') => (i.slot === 'head' || i.slot === 'body' || i.slot === 'legs' || i.slot === 'accessory' || i.offKind === 'focus' || /^manopla/i.test(i.name))
  ? `<span style="font-size:${parseInt(px) > 80 ? 30 : 26}px;line-height:1;pointer-events:none;display:block">${i.icon}</span>`
  : `<img src="${frameIcon(itemFrameName(i), 4)}" style="width:${px};image-rendering:pixelated;pointer-events:none">`;
const SLOT_NAMES = SLOT_LABEL;

// ======================== MENU / CRIAÇÃO ========================
export function showMenu(start: () => void) {
  hudBuilt = false; closeWin();
  root.innerHTML = '';
  const saves = listSaves();
  const cards = saves.map((p, n) => p
    ? `<div class="slotc" data-n="${n}" style="border:1px solid #6b5a9a;border-radius:8px;padding:8px;background:#1d1830;width:150px;text-align:center">
        <canvas width="256" height="256" data-pc="${n}" style="width:96px;height:96px;image-rendering:auto"></canvas>
        <div style="font-weight:700;color:#ffe9a8;margin-top:4px">${escapeHtml(p.name)}</div>
        <div style="font-size:11px;color:#a79cc4">${RACE_BY_ID[p.raceId]?.name ?? ''} ${CLASS_BY_ID[p.classId]?.name ?? ''} · Nv ${p.level}</div>
        <div class="row" style="justify-content:center;margin-top:6px"><button class="primary" data-play="${n}">Jogar</button><button data-del="${n}" title="Excluir personagem">🗑️</button></div>
      </div>`
    : `<div class="slotc" style="border:1px dashed #4a4170;border-radius:8px;padding:8px;background:#15122200;width:150px;min-height:172px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px">
        <div style="font-size:30px;color:#6b5a9a">＋</div><div style="font-size:11px;color:#a79cc4">Slot ${n + 1} vazio</div>
        <button data-new="${n}">Novo personagem</button></div>`).join('');
  const m = h(`
    <div class="title" style="max-width:760px">
      <h1>REINOS DE ALDORIA</h1>
      <h2>Capítulo ${CURRENT_CHAPTER.id} — ${CURRENT_CHAPTER.title}</h2>
      <h3 style="color:#ffe9a8;margin:14px 0 8px">Escolha seu herói</h3>
      <div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center">${cards}</div>
      <p style="color:#a79cc4;font-size:12px;margin-top:24px">Baseado no SRD 5.1 de D&amp;D (CC-BY-4.0) · Modelos 3D: KayKit (CC0) · Ícones: Kenney.nl (CC0)</p>
    </div>`, 'screen');
  root.appendChild(m);
  saves.forEach((p, n) => { if (p) q<HTMLCanvasElement>(`[data-pc="${n}"]`, m).getContext('2d')!.drawImage(portrait(p.raceId, p.classId, p.tone, 'bust'), 0, 0); });
  qa<HTMLElement>('[data-play]', m).forEach((b) => (b.onclick = () => { const n = Number(b.dataset.play); const p = loadSave(n); if (p) { setSlot(n); setPlayer(p); start(); } }));
  qa<HTMLElement>('[data-new]', m).forEach((b) => (b.onclick = () => showCreate(start, Number(b.dataset.new))));
  qa<HTMLElement>('[data-del]', m).forEach((b) => (b.onclick = () => {
    const n = Number(b.dataset.del), p = saves[n];
    if (!confirm(`Excluir ${p?.name ?? 'o personagem'} para sempre?`)) return;
    deleteSave(n); showMenu(start);
  }));
}

function showCreate(start: () => void, slot: number) {
  const st = { name: '', race: 'human', cls: 'fighter', tone: RACE_BY_ID['human'].tones[0] };
  const screen = h('', 'screen');
  root.innerHTML = '';
  root.appendChild(screen);

  const render = () => {
    const race = RACE_BY_ID[st.race], cls = CLASS_BY_ID[st.cls];
    if (!race.tones.includes(st.tone)) st.tone = race.tones[0];
    const tmp = newPlayer('x', st.race, st.cls, st.tone);
    const d = derive(tmp);
    screen.innerHTML = `<div class="create panel hit">
      <div>
        <h3>Nome</h3><input type="text" id="nm" maxlength="14" placeholder="Nome do herói" value="">
        <h3>Raça</h3><div class="cards">${RACES.map((r) => `<div class="card ${r.id === st.race ? 'sel' : ''}" data-r="${r.id}">${r.name}<small>${Object.entries(r.bonus).length > 3 ? '+1 todos' : Object.entries(r.bonus).map(([k, v]) => '+' + v + ' ' + ABILITY_SHORT[k as keyof typeof ABILITY_SHORT]).join(' ')}</small></div>`).join('')}</div>
        <h3>Classe</h3><div class="cards">${CLASSES.map((c) => `<div class="card ${c.id === st.cls ? 'sel' : ''}" data-c="${c.id}">${c.name}<small>${c.role}</small></div>`).join('')}</div>
        <h3>${race.id === 'dragonborn' ? 'Cor das escamas' : 'Tom da pele'}</h3><div class="swatches">${race.tones.map((c) => `<div class="sw ${c === st.tone ? 'sel' : ''}" data-h="${c}" style="background:${c}"></div>`).join('')}</div>
      </div>
      <div class="preview">
        <canvas id="pv" width="256" height="256"></canvas>
        <div class="desc"><b style="color:#ffe9a8">${race.name}</b> — ${race.desc}<br><i>${race.trait}:</i> ${race.traitDesc}</div>
        <div class="desc"><b style="color:#ffe9a8">${cls.name}</b> — ${cls.desc}<br>Dado de vida d${cls.hit} · Atributo principal: ${ABILITY_NAMES[cls.primary]} · Armadura: ${ARMOR_NAMES[cls.armor]}</div>
        <div class="stats">${ABILITIES.map((a) => `<div>${ABILITY_SHORT[a]} <b>${d.ab[a]}</b> (${d.md[a] >= 0 ? '+' : ''}${d.md[a]})</div>`).join('')}</div>
        <div class="desc">PV ${d.maxHp} · CA ${d.ac} · Energia ${d.maxEn}</div>
        <div class="desc">${cls.skills.map((s) => `${s.icon} <b>${s.name}</b> (nv ${s.unlock})`).join('<br>')}${race.racial ? `<br>${race.racial.icon} <b>${race.racial.name}</b> (racial)` : ''}</div>
        <div class="row" style="justify-content:center"><button id="back">Voltar</button><button id="go" class="primary">Começar Aventura</button></div>
      </div></div>`;
    const nm = q<HTMLInputElement>('#nm', screen);
    nm.value = st.name;
    nm.oninput = () => { st.name = nm.value; };
    const pv = q<HTMLCanvasElement>('#pv', screen);
    pv.getContext('2d')!.drawImage(portrait(st.race, st.cls, st.tone, 'full'), 0, 0);
    screen.querySelectorAll<HTMLElement>('[data-r]').forEach((e) => (e.onclick = () => { st.race = e.dataset.r!; render(); }));
    screen.querySelectorAll<HTMLElement>('[data-c]').forEach((e) => (e.onclick = () => { st.cls = e.dataset.c!; render(); }));
    screen.querySelectorAll<HTMLElement>('[data-h]').forEach((e) => (e.onclick = () => { st.tone = e.dataset.h!; render(); }));
    q('#back', screen).onclick = () => showMenu(start);
    q('#go', screen).onclick = () => {
      const name = st.name.trim() || 'Aventureiro';
      setSlot(slot);
      setPlayer(newPlayer(name, st.race, st.cls, st.tone));
      save();
      start();
    };
  };
  render();
}

// ======================== HUD ========================
let hudBuilt = false;
let selItem: Item | null = null;

export function initHud() {
  root.innerHTML = '';
  hudBuilt = true;
  root.appendChild(h(`
    <div id="hud-tl" class="panel">
      <canvas id="portrait" width="256" height="256"></canvas>
      <div>
        <div style="font-size:12px;margin-bottom:3px"><b id="pname"></b> <span id="plvl" style="color:#ffe9a8"></span></div>
        <div class="bar"><i id="hp" style="background:var(--hp)"></i><span id="hpt"></span></div>
        <div class="bar" style="margin-top:3px"><i id="en" style="background:var(--en)"></i><span id="ent"></span></div>
        <div class="bar" style="margin-top:3px;height:8px"><i id="xp" style="background:var(--xp)"></i></div>
      </div>
    </div>
    <div id="hud-tr">
      <div id="zone" class="panel">—</div>
      <div class="panel" style="padding:4px 10px;font-size:13px">🪙 <b id="gold" style="color:var(--gold)"></b></div>
      <div class="btns hit"><button id="bi">Inventário (I)</button><button id="bc">Personagem (C)</button><button id="bk">Habilidades (K)</button><button id="bm">Mapa (M)</button><button id="bp">Menu (Esc)</button><button id="bj">Diário (L)</button><button id="bh">Ajuda (F1)</button></div>
    </div>
    <div id="bossbar" class="panel hidden"><div id="bname"></div><div class="bar" style="height:14px"><i id="bhp" style="background:#c0392b"></i></div><div id="bcast" style="display:none"><div id="bcn"></div><div class="bar" style="height:8px"><i id="bci" style="background:#ffb03a"></i></div></div></div>
    <div id="target" class="panel hidden"><div id="tname"></div><div class="bar"><i id="thp" style="background:var(--hp)"></i></div></div>
    <div id="quests" class="panel hidden"></div>
    <div id="log"></div>
    <div id="prompt" class="panel hidden"></div>
    <div id="pcast" class="hidden" style="position:absolute;left:50%;bottom:92px;transform:translateX(-50%);width:170px;height:7px;background:#000a;border-radius:4px;overflow:hidden"><i id="pci" style="display:block;height:100%;background:#ffd23f"></i></div>
    <div id="skills" class="panel hit"></div>
    <div id="toast" style="opacity:0"></div>
    <div id="win"></div>
  `));
  q<HTMLCanvasElement>('#portrait').getContext('2d')!.drawImage(portrait(player.raceId, player.classId, player.tone, 'bust'), 0, 0);
  q('#pname').textContent = player.name;

  const sk = q('#skills');
  sk.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    const s = h(`<b>${i + 1}</b><span class="ic"></span><em></em><div class="cd"></div>`, 'slot');
    s.dataset.i = String(i);
    s.onclick = () => bus.emit('skill', i);
    sk.appendChild(s);
  }
  for (const [k, key, ic] of [['heal', 'H', 'i_pot_red'], ['energy', 'J', 'i_pot_blue']] as const) {
    const s = h(`<b>${key}</b><img src="${frameIcon(ic, 4)}" style="width:40px;image-rendering:pixelated"><em></em><div class="cd"></div>`, 'slot');
    s.dataset.p = k;
    s.onclick = () => bus.emit('potion', k);
    sk.appendChild(s);
  }
  q('#bi').onclick = () => toggleWin('inv');
  q('#bc').onclick = () => toggleWin('char');
  q('#bh').onclick = () => toggleWin('help');
  q('#bj').onclick = () => toggleWin('journal');
  q('#bm').onclick = () => toggleWin('map');
  q('#bk').onclick = () => toggleWin('skills');
  q('#bp').onclick = () => toggleWin('pause');
  resetMapCache();

  bus.removeAllListeners('hud'); bus.removeAllListeners('log'); bus.removeAllListeners('zone');
  bus.removeAllListeners('levelup'); bus.removeAllListeners('death'); bus.removeAllListeners('respawn');
  bus.removeAllListeners('npc'); bus.removeAllListeners('nope');
  bus.on('hud', onHud);
  bus.on('log', onLog);
  bus.on('zone', onZone);
  bus.on('levelup', (lvl: number) => {
    toast(`NÍVEL ${lvl}!`, 2200);
    const c = CLASS_BY_ID[player.classId];
    const unlocked = c.skills.find((s) => s.unlock === lvl);
    onLog(`Você alcançou o nível ${lvl}! PV e energia restaurados.${unlocked ? ' Nova habilidade: ' + unlocked.name + '.' : ''} Pontos novos nas árvores (K).`, '#ffd23f');
    if (lvl === MAX_LEVEL) onLog(`Nível máximo do Capítulo ${CURRENT_CHAPTER.id} atingido! Novos capítulos virão.`, '#ffd23f');
    save();
  });
  bus.on('death', () => {
    const d = h('Você caiu...<div style="font-size:16px;margin-top:10px">Renascendo na vila</div>');
    d.id = 'death';
    root.appendChild(d);
  });
  bus.on('respawn', (lost: number) => {
    document.getElementById('death')?.remove();
    onLog(`Você renasceu em Pouso do Viajante${lost ? ` (perdeu ${lost} de ouro)` : ''}.`, '#ff8a8a');
  });
  bus.on('npc', openNpc);
  bus.removeAllListeners('banner'); bus.removeAllListeners('story');
  bus.on('banner', (name: string) => toast(name, 2800, 26));
  bus.on('story', (e: { kind: string; id: string }) => {
    const f = FRAGMENT_BY_ID[e.id];
    const n = player.story.fragments.length;
    save();
    showStory(f.name, [f.lore], `Fragmento do Selo ${n}/${FRAGMENTS.length}`);
  });
  bus.on('nope', (i: number) => {
    const el = q(`.slot[data-i="${i}"]`);
    if (!el) return;
    el.classList.add('nope');
    setTimeout(() => el.classList.remove('nope'), 250);
  });

  window.onkeydown = (e: KeyboardEvent) => {
    if (!hudBuilt || (e.target as HTMLElement)?.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (k === 'i') toggleWin('inv');
    else if (k === 'c') toggleWin('char');
    else if (k === 'l') toggleWin('journal');
    else if (k === 'm') toggleWin('map');
    else if (k === 'k') toggleWin('skills');
    else if (k === 'f1') { e.preventDefault(); toggleWin('help'); }
    else if (k === 'escape') { if (curWin) closeWin(); else toggleWin('pause'); }
  };
}

let lastQuestHtml = '';
function onHud(s: {
  hp: number; maxHp: number; en: number; maxEn: number; xp: number; xpCur: number; xpNext: number;
  skills: ({ icon: string; name: string; desc: string; cost: number; unlock: number; cd: number; left: number } | null)[];
  pot: number; pcast: number | null; boss: { name: string; hp: number; max: number; phase: number; cast: { name: string; p: number } | null } | null; target: { name: string; level: number; hp: number; max: number; boss: boolean } | null; npc: string | null;
}) {
  if (!hudBuilt) return;
  q('#plvl').textContent = 'Nv ' + player.level;
  q('#hp').style.width = Math.max(0, (s.hp / s.maxHp) * 100) + '%';
  q('#hpt').textContent = `${Math.max(0, Math.ceil(s.hp))}/${s.maxHp}`;
  q('#en').style.width = (s.en / s.maxEn) * 100 + '%';
  q('#ent').textContent = `${Math.floor(s.en)}/${s.maxEn}`;
  const span = Math.max(1, s.xpNext - s.xpCur);
  q('#xp').style.width = (player.level >= MAX_LEVEL ? 100 : Math.min(100, ((s.xp - s.xpCur) / span) * 100)) + '%';
  q('#gold').textContent = fmtGold(player.gold);
  const pts = skillPointsLeft(player) + attrPointsLeft(player);
  const bk = q('#bk');
  if (bk.dataset.n !== String(pts)) { bk.dataset.n = String(pts); bk.innerHTML = `Habilidades (K)${pts ? `<span class="badge">${pts}</span>` : ''}`; }

  const pc = q('#pcast');
  if (s.pcast != null) { pc.classList.remove('hidden'); q('#pci', pc).style.width = s.pcast * 100 + '%'; } else pc.classList.add('hidden');
  const bb = q('#bossbar');
  if (s.boss) {
    bb.classList.remove('hidden');
    q('#bname', bb).innerHTML = `👑 ${s.boss.name} <span style="color:#ffb27a">Fase ${s.boss.phase}</span>`;
    q('#bhp', bb).style.width = (s.boss.hp / s.boss.max) * 100 + '%';
    const bc = q('#bcast', bb);
    bc.style.display = s.boss.cast ? 'block' : 'none';
    if (s.boss.cast) { q('#bcn', bb).textContent = s.boss.cast.name; q('#bci', bb).style.width = s.boss.cast.p * 100 + '%'; }
  } else bb.classList.add('hidden');

  const t = q('#target');
  if (s.target) {
    t.classList.remove('hidden');
    q('#tname', t).innerHTML = `${s.target.boss ? '👑 ' : ''}${s.target.name} <span style="color:#ffe9a8">Nv ${s.target.level}</span>`;
    q('#thp', t).style.width = (s.target.hp / s.target.max) * 100 + '%';
  } else t.classList.add('hidden');

  const pr = q('#prompt');
  if (s.npc) { pr.classList.remove('hidden'); pr.textContent = s.npc; } else pr.classList.add('hidden');

  document.querySelectorAll<HTMLElement>('#skills .slot[data-i]').forEach((el, i) => {
    const k = s.skills[i];
    const ic = q('.ic', el), em = q('em', el), cd = q('.cd', el);
    if (!k) { el.style.opacity = '0.15'; ic.textContent = ''; em.textContent = ''; el.title = ''; return; }
    el.style.opacity = '';
    ic.textContent = k.icon;
    em.textContent = player.level < k.unlock ? 'Nv' + k.unlock : String(k.cost);
    el.classList.toggle('lock', player.level < k.unlock);
    cd.style.height = k.cd * 100 + '%';
    el.title = `${k.name} — ${k.desc} (Energia ${k.cost})`;
  });
  document.querySelectorAll<HTMLElement>('#skills .slot[data-p]').forEach((el) => {
    const kind = el.dataset.p as 'heal' | 'energy';
    q('em', el).textContent = String(player.potions[kind]);
    q('.cd', el).style.height = s.pot * 100 + '%';
    el.title = kind === 'heal' ? 'Poção de Cura' : 'Poção de Energia';
    el.style.opacity = player.potions[kind] ? '' : '0.4';
  });

  const act = [...MAIN_QUESTS, ...QUESTS].filter((x) => player.quests[x.id] && player.quests[x.id].state !== 'done');
  const html = act.map((x) => {
    const st = player.quests[x.id];
    const main = 'main' in x;
    return `<div style="margin-top:4px"><b style="color:${main ? '#ffd23f' : '#fff'}">${main ? '★ ' : ''}${x.title}</b><br>${st.state === 'ready' ? `<span style="color:#7ee787">Pronta! Volte ao ${main ? 'Sábio Orin' : 'Capitão Brann'}</span>` : `Progresso: ${st.progress}/${x.count}`}</div>`;
  }).join('');
  if (html !== lastQuestHtml) {
    lastQuestHtml = html;
    const qe = q('#quests');
    qe.innerHTML = '<h4>Missões</h4>' + html;
    qe.classList.toggle('hidden', !html);
  }
}

function onLog(text: string, color = '#eee8ff') {
  const log = q('#log');
  if (!log) return;
  const d = document.createElement('div');
  d.style.color = color;
  d.textContent = text;
  log.appendChild(d);
  while (log.children.length > 7) log.removeChild(log.firstChild!);
}

let toastT = 0;
function toast(text: string, ms = 1800, size = 30) {
  const t = q('#toast');
  t.textContent = text;
  t.style.fontSize = size + 'px';
  t.style.opacity = '1';
  clearTimeout(toastT);
  toastT = window.setTimeout(() => (t.style.opacity = '0'), ms);
}

function onZone(z: ZoneDef) {
  q('#zone').innerHTML = `<b>${z.name}</b><br><span style="font-size:11px;color:#a79cc4">${z.levels}</span>`;
  toast(z.name, 2200, 22);
}

// ======================== JANELAS ========================
type WinKind = 'inv' | 'char' | 'help' | 'npc' | 'journal' | 'map' | 'pause' | 'skills' | 'enchant';
let mapTimer: number | undefined;
let mapTab: MapKind = 'global';
let curWin: WinKind | null = null;

function closeWin() { curWin = null; if (mapTimer) { clearInterval(mapTimer); mapTimer = undefined; } selItem = null; const w = q('#win'); if (w) w.innerHTML = ''; }
export function toggleWinExt(k: WinKind) { toggleWin(k); }
function toggleWin(k: WinKind) {
  if (curWin === k) { closeWin(); return; }
  curWin = k; selItem = null;
  if (k === 'inv') renderInv();
  else if (k === 'char') renderChar();
  else if (k === 'help') renderHelp();
  else if (k === 'journal') renderJournal();
  else if (k === 'map') renderMap();
  else if (k === 'pause') renderPause();
  else if (k === 'skills') renderSkills('skills');
}

function renderPause() {
  const w = setWin(`<h3>Menu${closeBtn}</h3>
    <div style="font-size:13px;color:#cfc8e8;margin-bottom:10px">O jogo é salvo automaticamente. Você pode trocar de personagem ou voltar ao menu principal a qualquer momento.</div>
    <div class="row" style="flex-direction:column;gap:8px">
      <button id="p-go" class="primary">▶ Continuar</button>
      <button id="p-help">❓ Como jogar</button>
      <button id="p-menu">🏠 Salvar e voltar ao menu principal</button>
    </div>`);
  bindClose(w);
  q('#p-go', w).onclick = closeWin;
  q('#p-help', w).onclick = () => { curWin = 'help'; renderHelp(); };
  q('#p-menu', w).onclick = () => { save(); closeWin(); bus.emit('menu'); };
}
function setWin(html: string): HTMLElement {
  const w = q('#win');
  w.innerHTML = `<div class="win panel hit">${html}</div>`;
  return w;
}
const closeBtn = '<button class="x" style="padding:2px 8px">✕</button>';
const bindClose = (w: HTMLElement) => { q('.x', w).onclick = closeWin; };

function itemTip(i: Item): string {
  const why = equipBlock(player, i);
  return `<b style="color:${RARITY_COLORS[i.rarity]}">${i.name}</b><br>
    <span style="color:#a79cc4">${RARITY_NAMES[i.rarity]} · ${SLOT_NAMES[i.slot]} · Nível ${i.minLevel}</span><br>
    ${describeItem(i)}<br>Valor: 🪙 ${fmtGold(i.value)}${bestShopHint(i)}
    ${why ? `<br><span style="color:#ff8a8a">${why}</span>` : ''}${compare(i)}${setBlock(i)}`;
}

function bestShopHint(i: Item): string {
  const names: Record<string, string> = { smith: 'Ferreiro', sage: 'Sábio', archer: 'Arqueira', monk: 'Monge', rogue: 'Ladino', cleric: 'Clérigo', druid: 'Druida', bard: 'Bardo', necro: 'Necromante', barbarian: 'Bárbaro', general: 'Empório' };
  const hit = (Object.keys(names) as ShopId[]).filter((k) => buysItem(k, i));
  return hit.length ? `<br><span style="color:#ffd23f">⭐ Paga mais: ${hit.map((k) => names[k]).join(', ')}</span>` : '';
}
function setBlock(i: Item): string {
  if (!i.set || !SET_BY_ID[i.set]) return '';
  const owned = new Set<string>(Object.entries(player.equipped).filter(([, it]) => it?.set === i.set).map(([k]) => k));
  owned.add(i.slot);
  return setTipHtml(SET_BY_ID[i.set], owned);
}

function compare(i: Item): string {
  const cur = player.equipped[i.slot];
  if (!cur || cur.uid === i.uid) return '';
  const row = (diff: number, txt: string) => `<br><span style="color:${diff >= 0 ? '#7ee787' : '#ff8a8a'}">${diff >= 0 ? '▲' : '▼'} ${Math.abs(diff).toFixed(1)} ${txt}</span>`;
  if (i.slot === 'mainhand' && i.dice && cur.dice) {
    const f = (x: Item) => ((x.dice![0] * (x.dice![1] + 1)) / 2 + (x.plus ?? 0)) / (x.speed ?? 1);
    return row(f(i) - f(cur), 'dano por golpe equivalente');
  }
  if (i.slot === 'body') return row((i.ac ?? 0) - (cur.ac ?? 0), 'CA base');
  if (i.slot === 'head' || i.slot === 'legs' || i.offKind === 'shield') return row((i.ac ?? 0) - (cur.ac ?? 0), 'CA');
  return '';
}

function equip(it: Item) {
  if (equipBlock(player, it)) return;
  const idx = player.items.indexOf(it);
  if (idx < 0) return;
  const old = player.equipped[it.slot];
  // arma de duas mãos: a mão esquerda volta para a mochila
  const off = it.slot === 'mainhand' && it.twoHanded ? player.equipped.offhand : undefined;
  if (off && player.items.length - 1 + (old ? 1 : 0) >= BAG_SIZE) { onLog('Mochila cheia: não há onde guardar o item da mão esquerda.', '#ff8a8a'); return; }
  player.items.splice(idx, 1);
  if (old) player.items.push(old);
  if (off) { player.items.push(off); delete player.equipped.offhand; onLog(`${off.name} guardado: a arma ocupa as duas mãos.`, '#ffe9a8'); }
  player.equipped[it.slot] = it;
  selItem = null;
  bus.emit('recalc');
  save();
  renderInv();
}

function unequip(slot: Slot) {
  const it = player.equipped[slot];
  if (!it) return;
  if (player.items.length >= BAG_SIZE) { onLog('Mochila cheia.', '#ff8a8a'); return; }
  player.items.push(it);
  delete player.equipped[slot];
  bus.emit('recalc');
  save();
  renderInv();
}

function renderInv() {
  const d = derive(player);
  const eq = SLOT_ORDER.map((s) => {
    const it = player.equipped[s];
    return `<div class="it" data-eq="${s}" style="border-color:${it ? RARITY_COLORS[it.rarity] : '#444'}" title="${it ? it.name : SLOT_NAMES[s]}">${it ? itemImg(it, '70%') : '·'}<small>${s === 'offhand' && player.equipped.mainhand?.twoHanded ? '🔒 ' : ''}${SLOT_NAMES[s]}</small></div>`;
  }).join('');
  const cells = Array.from({ length: BAG_SIZE }, (_, n) => {
    const it = player.items[n];
    return it
      ? `<div class="it" data-n="${n}" style="border-color:${RARITY_COLORS[it.rarity]};${selItem === it ? 'background:#3b2f57' : ''}">${itemImg(it, '88%')}${it.plus ? `<small style="color:${RARITY_COLORS[it.rarity]}">+${it.plus}</small>` : ''}</div>`
      : '<div class="it" style="opacity:.35"></div>';
  }).join('');
  const w = setWin(`<h3>Inventário <span style="font-size:12px;color:#a79cc4">${player.items.length}/${BAG_SIZE} · CA ${d.ac} · PV ${d.maxHp}</span>${closeBtn}</h3>
    <div class="eq">${eq}</div><div class="grid">${cells}</div>
    <div class="tip" id="tip">${selItem ? itemTip(selItem) : 'Clique em um item para ver detalhes. Clique em um equipamento para removê-lo.'}</div>
    <div class="row" id="acts"></div>`);
  bindClose(w);
  w.querySelectorAll<HTMLElement>('[data-eq]').forEach((e) => (e.onclick = () => unequip(e.dataset.eq as Slot)));
  w.querySelectorAll<HTMLElement>('[data-n]').forEach((e) => (e.onclick = () => { selItem = player.items[Number(e.dataset.n)]; renderInv(); }));
  if (selItem) {
    const acts = q('#acts', w);
    const it = selItem;
    const b1 = document.createElement('button');
    b1.textContent = 'Equipar'; b1.className = 'primary'; b1.disabled = !!equipBlock(player, it);
    b1.onclick = () => equip(it);
    const b2 = document.createElement('button');
    b2.textContent = 'Descartar';
    b2.onclick = () => { player.items.splice(player.items.indexOf(it), 1); selItem = null; save(); renderInv(); };
    acts.append(b1, b2);
  }
}

function renderChar() {
  const d = derive(player);
  const race = RACE_BY_ID[player.raceId], cls = CLASS_BY_ID[player.classId];
  const next = player.level >= MAX_LEVEL ? 'máximo' : `${player.xp}/${CURRENT_XP_NEXT()}`;
  const w = setWin(`<h3>${escapeHtml(player.name)} — ${race.name} ${cls.name} Nv ${player.level}${closeBtn}</h3>
    <div class="stats">${ABILITIES.map((a) => `<div>${ABILITY_NAMES[a]}<br><b>${d.ab[a]}</b> (${d.md[a] >= 0 ? '+' : ''}${d.md[a]})</div>`).join('')}</div>
    <div class="tip">PV máx. <b>${d.maxHp}</b> · Energia <b>${d.maxEn}</b> · CA <b>${d.ac}</b><br>
    Bônus de proficiência +${d.prof} · Ataque +${d.atk} · Dano ${d.dice[0]}d${d.dice[1]}+${d.dmgBonus}${d.offDice ? ` · mão esquerda +${d.offDice[0]}d${d.offDice[1]}${d.offPlus ? '+' + d.offPlus : ''}` : ''}<br>
    Velocidade de ataque ${(1000 / d.interval).toFixed(2)}/s · Crítico ${d.crit}–20<br>
    XP ${next} · Abates ${player.kills}<br>
    ${Object.keys(d.bonus).length ? `<span style="color:#7ee787">Bônus: ${bonusLines(d.bonus).join(' · ')}</span><br>` : ''}
    <span style="color:#ffe9a8">${race.trait}:</span> ${race.traitDesc}</div>
    ${activeSets(player.equipped).map((a) => setTipHtml(a.def, new Set(Object.entries(player.equipped).filter(([, it]) => it?.set === a.def.id).map(([k]) => k)))).join('')}
    <div class="tip">${cls.skills.map((s) => `${s.icon} <b>${s.name}</b> — nv ${s.unlock}${player.level < s.unlock ? ' 🔒' : ''}<br><span style="color:#a79cc4">${s.desc}</span>`).join('<br>')}
    ${race.racial ? `<br>${race.racial.icon} <b>${race.racial.name}</b> (racial)<br><span style="color:#a79cc4">${race.racial.desc}</span>` : ''}</div>`);
  bindClose(w);
}
import { XP_TABLE } from '../data/rules';
const CURRENT_XP_NEXT = () => XP_TABLE[Math.min(player.level, MAX_LEVEL - 1)];

function renderHelp() {
  const w = setWin(`<h3>Como jogar${closeBtn}</h3>
    <div style="font-size:13px;line-height:1.7">
    <b>WASD / setas</b> — mover · <b>Clique no chão</b> — andar até o ponto<br>
    <b>Clique em um monstro</b> — selecionar e atacar automaticamente<br>
    <b>E</b> ou clique — falar com NPCs e usar portais de masmorra · <b>L</b> — Diário (história e fragmentos) · <b>M</b> — Mapa (global e da cidade; revela conforme você explora)<br>
    <b>Botão direito + arrastar</b> — girar a câmera · <b>Roda do mouse</b> — zoom<br>
    <b>1 2 3</b> — habilidades da classe (desbloqueiam nos níveis 1, 3 e 5)<br>
    <b>4</b> — habilidade racial (Draconato e Tiferino)<br>
    <b>H / J</b> — poção de cura / de energia<br>
    <b>E</b> — falar com NPCs perto de você · <b>I</b> inventário · <b>C</b> personagem<br><br>
    Combate usa as regras do D&amp;D: d20 + bônus contra a CA do monstro; 20 natural é crítico.
    Fale com o Capitão Brann na vila para pegar missões. Seu progresso é salvo automaticamente neste navegador.
    </div>`);
  bindClose(w);
}

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

// ======================== NPCs ========================
function openNpc(id: string) {
  curWin = 'npc'; selItem = null;
  if (id === 'captain') npcCaptain();
  else if (id === 'merchant') shopWindow('general');
  else if (['smith', 'archer', 'monk', 'rogue', 'cleric', 'druid', 'bard', 'necro', 'barbarian'].includes(id)) shopWindow(id as ShopId);
  else if (id === 'innkeeper') npcInnkeeper();
  else if (id === 'priest') npcPriest();
  else if (id === 'guard') npcGuard();
  else if (id === 'sage') npcSage();
  else npcHealer();
}

function npcCaptain() {
  const rows = QUESTS.map((x) => {
    const st = player.quests[x.id];
    if (st?.state === 'done') return `<div class="qrow" style="opacity:.5"><b>${x.title}</b> ✔ concluída</div>`;
    const reward = `${x.xp} XP · 🪙 ${x.gold}${x.potion ? ' · poção' : ''}${x.item ? ' · item raro' : ''}`;
    let btn = '';
    if (!st) btn = player.level >= x.minLevel ? `<button data-a="${x.id}" class="primary">Aceitar</button>` : `<button disabled>Requer nível ${x.minLevel}</button>`;
    else if (st.state === 'ready') btn = `<button data-t="${x.id}" class="primary">Entregar</button>`;
    else btn = `<span style="color:#a79cc4">Em andamento: ${st.progress}/${x.count}</span>`;
    return `<div class="qrow"><b>${x.title}</b> <span style="color:#a79cc4">(nv ${x.minLevel}+)</span><br>${x.desc}<br><span style="color:#ffe9a8">Recompensa: ${reward}</span><div class="row">${btn}</div></div>`;
  }).join('');
  const w = setWin(`<h3>Capitão Brann${closeBtn}</h3><div style="font-size:13px;margin-bottom:6px">“Pouso do Viajante precisa de heróis. Há trabalho para quem tem coragem.”</div>${rows}`);
  bindClose(w);
  w.querySelectorAll<HTMLElement>('[data-a]').forEach((b) => (b.onclick = () => {
    player.quests[b.dataset.a!] = { progress: 0, state: 'active' };
    onLog('Missão aceita!', '#7ee787'); save(); npcCaptain();
  }));
  w.querySelectorAll<HTMLElement>('[data-t]').forEach((b) => (b.onclick = () => {
    const x = QUESTS.find((z) => z.id === b.dataset.t)!;
    player.quests[x.id].state = 'done';
    player.gold += x.gold;
    if (x.potion) player.potions[x.potion]++;
    if (x.item) {
      const c = CLASS_BY_ID[player.classId];
      const it = genItem({ slot: (['mainhand', 'body', 'head', 'legs', 'accessory'] as Slot[])[Math.floor(Math.random() * 5)], level: Math.min(10, x.minLevel + 1), style: c.style, rarity: 2, armorMax: c.armor, off: allowedOff(c), cid: c.id });
      if (addItem(it)) onLog(`Recompensa: ${it.name}`, RARITY_COLORS[it.rarity]);
    }
    gainXp(x.xp);
    onLog(`Missão entregue: ${x.title} (+${x.xp} XP, +${x.gold} ouro)`, '#7ee787');
    save(); npcCaptain();
  }));
}

const stocks: Record<string, { key: string; items: Item[] }> = {};
function shopWindow(kind: ShopId) {
  const reopen = () => shopWindow(kind);
  const info = SHOP_INFO[kind];
  const key = String(player.level);
  if (!stocks[kind] || stocks[kind].key !== key) stocks[kind] = { key, items: genShopStock(player.level, kind) };
  const shopStock = stocks[kind].items;
  const cha = derive(player).ab.cha;
  const pp = potionPrice(player.level, cha);
  const rare = shopStock.map((it, n) => {
    const price = buyPrice(it, cha), ok = player.gold >= price, why = equipBlock(player, it);
    return `<div class="qrow" style="display:flex;justify-content:space-between;align-items:center;gap:8px">
    <span style="display:flex;align-items:center;gap:6px">${itemImg(it, '28px')} <span><b style="color:${RARITY_COLORS[it.rarity]}">${it.name}</b> <span style="color:#a79cc4">${RARITY_NAMES[it.rarity]} · ${SLOT_NAMES[it.slot]} · nv ${it.minLevel}</span><br><small style="color:#cfc8e8">${describeItem(it).replace(/<br>/g, ' · ')}</small>${why ? `<br><small style="color:#ff8a8a">${why}</small>` : ''}</span></span>
    <button data-r="${n}" ${ok ? 'class="primary"' : 'style="opacity:.55"'}>Comprar 🪙 ${fmtGold(price)}</button></div>`;
  }).join('');
  const offers = player.items.map((it) => sellOffer(it, kind, cha));
  const order = player.items.map((_, n) => n).sort((a, b) => Number(offers[b].special) - Number(offers[a].special));
  const sell = order.map((n) => {
    const it = player.items[n], o = offers[n];
    return `<div class="qrow" style="display:flex;justify-content:space-between;align-items:center;gap:8px;${o.special ? 'border-left:3px solid #ffd23f' : ''}">
    <span style="display:flex;align-items:center;gap:6px">${itemImg(it, '28px')} <span><b style="color:${RARITY_COLORS[it.rarity]}">${it.name}</b> <span style="color:#a79cc4">nv ${it.minLevel}</span>${o.special ? '<br><small style="color:#ffd23f">⭐ mercadoria do ofício: paga mais</small>' : ''}${o.sat < 0.98 ? `<br><small style="color:#ff9f6a">mercado saturado (-${Math.round((1 - o.sat) * 100)}%)</small>` : ''}</span></span>
    <button data-s="${n}" ${o.special ? 'class="primary"' : ''}>Vender 🪙 ${fmtGold(o.price)}</button></div>`;
  }).join('') || '<div class="qrow">Sua mochila está vazia.</div>';
  const w = setWin(`<h3>${info.npc} — 🪙 ${fmtGold(player.gold)}${closeBtn}</h3>
    <div style="font-size:13px;margin-bottom:6px">${info.quote}</div>
    ${info.potions ? `<div class="row"><button data-b="heal">Poção de Cura 🪙 ${pp} (você tem ${player.potions.heal})</button><button data-b="energy">Poção de Energia 🪙 ${pp} (${player.potions.energy})</button></div>` : ''}
    <h3 style="margin-top:12px">${info.section} <span style="font-size:11px;color:#a79cc4">(raros, épicos e lendários — preços de dragão)</span></h3>${rare}
    <h3 style="margin-top:12px">Vender <span style="font-size:11px;color:#a79cc4">(⭐ o dono paga bem mais pelas mercadorias do próprio ofício; outros itens, só o preço de sucata)</span></h3>${sell}
    ${player.items.length ? '<div class="row"><button id="sell-common">Vender itens comuns</button><button id="sell-special">Vender tudo o que esta loja valoriza (⭐)</button></div>' : ''}`);
  bindClose(w);
  w.querySelectorAll<HTMLElement>('[data-b]').forEach((b) => (b.onclick = () => {
    if (player.gold < pp) { onLog('Ouro insuficiente.', '#ff8a8a'); return; }
    player.gold -= pp; player.potions[b.dataset.b as 'heal' | 'energy']++; save(); reopen();
  }));
  w.querySelectorAll<HTMLElement>('[data-r]').forEach((b) => (b.onclick = () => {
    const it = shopStock[Number(b.dataset.r)], price = buyPrice(it, cha);
    if (player.gold < price) { onLog('Ouro insuficiente para esta relíquia.', '#ff8a8a'); return; }
    if (!addItem(it)) { onLog('Mochila cheia.', '#ff8a8a'); return; }
    player.gold -= price; shopStock.splice(Number(b.dataset.r), 1);
    onLog(`Comprou ${it.name} por ${fmtGold(price)} de ouro.`, RARITY_COLORS[it.rarity]); save(); reopen();
  }));
  const sellIt = (it: Item) => { const o = sellOffer(it, kind, cha); player.gold += o.price; registerSale(kind, it); return o; };
  w.querySelectorAll<HTMLElement>('[data-s]').forEach((b) => (b.onclick = () => {
    const n = Number(b.dataset.s), it = player.items[n];
    player.items.splice(n, 1); const o = sellIt(it);
    onLog(`Vendeu ${it.name} por ${fmtGold(o.price)}${o.special ? ' (preço de especialista!)' : ''}.`, o.special ? '#ffd23f' : '#cfc8e8'); save(); reopen();
  }));
  const bulk = (pred: (it: Item) => boolean) => {
    const keep: Item[] = []; let tot = 0;
    for (const it of player.items) { if (pred(it)) tot += sellIt(it).price; else keep.push(it); }
    player.items = keep; if (tot) onLog(`Você vendeu vários itens por 🪙 ${fmtGold(tot)}.`, '#ffd23f'); save(); reopen();
  };
  const sc = w.querySelector<HTMLElement>('#sell-common');
  if (sc) sc.onclick = () => bulk((it) => it.rarity === 0);
  const ss = w.querySelector<HTMLElement>('#sell-special');
  if (ss) ss.onclick = () => bulk((it) => buysItem(kind, it) && it.rarity <= 2);
}

// ======================== ÁRVORES ========================
let skTab: 'skills' | 'attrs' = 'skills';
function renderSkills(tab: 'skills' | 'attrs') {
  skTab = tab;
  const tree: Tree = tab === 'skills' ? skillTree(player.classId) : attrTree(player.classId);
  const left = tab === 'skills' ? skillPointsLeft(player) : attrPointsLeft(player);
  const total = tab === 'skills' ? skillPointsTotal(player.level) : attrPointsTotal(player.level);
  const cols = tree.branches.map((br, bi) => {
    const nodes = tree.nodes.filter((n) => n.branch === bi).sort((a, b) => a.tier - b.tier);
    return `<div class="tcol"><h4>${br.icon} ${br.name}</h4>${nodes.map((n, k) => {
      const st = nodeState(player, tab, n);
      return `${k ? '<div class="arrow">▼</div>' : ''}<div class="node ${st}" data-n="${n.id}" title="${n.desc}"><b>${n.icon} ${n.name}</b>${n.desc}<br><span style="color:#ffd23f">✦ ${n.cost}${st === 'owned' ? ' ✔' : ''}</span></div>`;
    }).join('')}</div>`;
  }).join('');
  const w = setWin(`<h3>${tree.title}${closeBtn}</h3>
    <div class="tabs"><button data-tab="skills" class="${tab === 'skills' ? 'on' : ''}">⚔️ Habilidades</button><button data-tab="attrs" class="${tab === 'attrs' ? 'on' : ''}">📊 Atributos</button></div>
    <div style="font-size:13px">Pontos disponíveis: <b style="color:#ffd23f">${left}</b> / ${total} <span style="color:#a79cc4">(ganhos por nível, com bônus nos níveis 5 e 10)</span></div>
    <div class="tree">${cols}</div>
    <div class="row"><button id="respec">🔄 Redistribuir pontos (🪙 ${fmtGold(respecCost(player.level))})</button></div>`);
  bindClose(w);
  w.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => (b.onclick = () => renderSkills(b.dataset.tab as 'skills' | 'attrs')));
  w.querySelectorAll<HTMLElement>('.node.open').forEach((e) => (e.onclick = () => {
    if (buyNode(player, tab, e.dataset.n!)) { bus.emit('recalc'); save(); renderSkills(tab); }
  }));
  q('#respec', w).onclick = () => {
    const c = respecCost(player.level);
    if (!player.skills && !player.attrs) return;
    if (player.gold < c) { onLog('Ouro insuficiente para redistribuir.', '#ff8a8a'); return; }
    player.gold -= c; player.skills = {}; player.attrs = {}; bus.emit('recalc'); save(); onLog('Pontos redistribuídos.', '#ffd23f'); renderSkills(tab);
  };
}

// ======================== ENCANTAMENTO ========================
let encSel: Item | null = null;
function renderEnchant() {
  const weapons: Item[] = [...(player.equipped.mainhand ? [player.equipped.mainhand] : []), ...player.items.filter((i) => i.slot === 'mainhand')];
  if (encSel && !weapons.includes(encSel)) encSel = null;
  const list = weapons.map((it) => `<div class="qrow" data-w="${weapons.indexOf(it)}" style="cursor:pointer;${encSel === it ? 'border:1px solid #ffd23f' : ''}"><b style="color:${RARITY_COLORS[it.rarity]}">${it.icon} ${it.name}</b> ${player.equipped.mainhand === it ? '<small>(equipada)</small>' : ''}<br><small>${it.ench ? '✨ ' + enchLine(it.ench) : 'sem encantamento'}</small></div>`).join('') || '<div class="qrow">Você não tem armas.</div>';
  const baseVal = encSel ? (encSel.ench ? encSel.value / (1 + 0.3 * encSel.ench.lvl) : encSel.value) : 0;
  const opts = encSel ? ENCHANTS.map((e) => {
    const ok = player.level >= e.minLevel;
    const btns = [1, 2, 3].map((l) => { const c = enchantCost(baseVal, l); return `<button data-e="${e.id}:${l}" ${ok && player.gold >= c ? '' : 'disabled'} title="${c} de ouro">${ROMAN[l]} 🪙${fmtGold(c)}</button>`; }).join('');
    const eff = e.bonus ? bonusLines(e.bonus(1)).join(', ') + ' → ' + bonusLines(e.bonus(3)).join(', ') : `${Math.round(e.proc!.chance[0] * 100)}%–${Math.round(e.proc!.chance[2] * 100)}% de chance`;
    return `<div class="qrow" style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span><b style="color:${e.color}">${e.icon} ${e.name}</b>${ok ? '' : ` <small style="color:#ff8a8a">(requer nível ${e.minLevel})</small>`}<br><small>${e.desc} <span style="color:#a79cc4">${eff}</span></small></span><span class="row">${btns}</span></div>`;
  }).join('') : '<div class="qrow" style="color:#a79cc4">Escolha uma arma acima.</div>';
  const w = setWin(`<h3>Mesa de Encantamento — 🪙 ${fmtGold(player.gold)}${closeBtn}</h3>
    <div style="font-size:12px;color:#cfc8e8;margin-bottom:6px">O Sábio Orin imbui sua arma com magia. Um novo encantamento substitui o anterior. Armas raras também podem ser achadas já encantadas.</div>
    ${list}<h3 style="margin-top:10px">Encantamentos</h3>${opts}`);
  bindClose(w);
  w.querySelectorAll<HTMLElement>('[data-w]').forEach((e) => (e.onclick = () => { encSel = weapons[Number(e.dataset.w)]; renderEnchant(); }));
  w.querySelectorAll<HTMLElement>('[data-e]').forEach((b) => (b.onclick = () => {
    if (!encSel) return;
    const [id, l] = b.dataset.e!.split(':'), lvl = Number(l), c = enchantCost(baseVal, lvl);
    if (player.gold < c) return;
    player.gold -= c;
    encSel.ench = { id, lvl };
    encSel.value = Math.round(baseVal * (1 + 0.3 * lvl));
    onLog(`${encSel.name} foi encantada!`, '#c084fc'); bus.emit('recalc'); save(); renderEnchant();
  }));
}

const RUMORS = [
  '“Dizem que os chefes das masmorras avisam seus golpes: fique de olho nas áreas vermelhas no chão e saia delas antes que encham.”',
  '“Um Dash na hora certa atravessa até o sopro de um dragão... ou de um rato muito furioso.”',
  '“O Moinho Velho nunca foi só um moinho. Os ratos lá embaixo obedecem a alguém.”',
  '“Um forasteiro encapuzado pagou rodadas a noite inteira e perguntou pelo Selo de Aldoria. Não disse o nome. Deixou a gorjeta em ouro cinzento.”',
  '“Magos e arqueiros precisam de calma para mirar: parem, mirem, atirem. Quem corre atirando, erra feio.”',
  '“Cinco heróis selaram a Sombra. Todos sabiam o nome dela. Nenhum o dizia em voz alta.”',
  '“Orcs de Quebra-Osso não bebem hidromel. É por isso que são tão mal-humorados.”',
];
let rumorN = 0;
function npcInnkeeper() {
  const w = setWin(`<h3>Taverneiro Bram — 🪙 ${player.gold}${closeBtn}</h3>
    <div style="font-size:13px;margin-bottom:8px">“Bem-vindo ao Dragão Dourado! Sente-se, aventureiro. A casa tem cama quente, ensopado e boas histórias.”</div>
    <div class="qrow"><b>🛏️ Quarto simples</b> — restaura PV e energia<div class="row"><button data-t="rest" class="primary">Descansar 🪙 25</button></div></div>
    <div class="qrow"><b>🍺 Hidromel do Aventureiro</b> — +2 de dano por 5 minutos<div class="row"><button data-t="mead">Beber 🪙 60</button></div></div>
    <div class="qrow"><b>🍲 Ensopado do Viajante</b> — +1 CA e regeneração por 5 minutos<div class="row"><button data-t="stew">Comer 🪙 60</button></div></div>
    <div class="qrow"><b>🗣️ Ouvir rumores</b><div class="row"><button data-t="rumor">Pagar uma rodada 🪙 5</button></div><div id="rumor" style="margin-top:6px;color:#cfc8e8;font-size:13px"></div></div>`);
  bindClose(w);
  const pay = (n: number) => { if (player.gold < n) { onLog('Ouro insuficiente.', '#ff8a8a'); return false; } player.gold -= n; return true; };
  w.querySelectorAll<HTMLElement>('[data-t]').forEach((b) => (b.onclick = () => {
    const d = derive(player), t = b.dataset.t;
    if (t === 'rest') { if (!pay(25)) return; player.hp = d.maxHp; player.en = d.maxEn; onLog('Você dorme como uma pedra e acorda renovado.', '#7ee787'); }
    else if (t === 'mead') { if (!pay(60)) return; bus.emit('blessing', 'Hidromel', { dmg: 2 }, 300000); onLog('Hidromel do Aventureiro: +2 de dano por 5 min.', '#f2c84a'); }
    else if (t === 'stew') { if (!pay(60)) return; bus.emit('blessing', 'Ensopado', { ac: 1, regen: 2 }, 300000); onLog('Ensopado do Viajante: +1 CA e regeneração por 5 min.', '#f2c84a'); }
    else if (t === 'rumor') { if (!pay(5)) return; q('#rumor', w).innerHTML = RUMORS[rumorN++ % RUMORS.length]; save(); return; }
    save(); npcInnkeeper();
  }));
}

const GUARD_LINES = [
  '“Em nome da Ordem da Aurora, ninguém passa pelos portões à noite sem motivo.”',
  '“Monstros não cruzam a muralha. Fora dela, a história é outra: leve poções.”',
  '“Vi um encapuzado rondando o Moinho Velho. Se for a masmorra, estude os golpes do chefe — as áreas vermelhas no chão não perdoam.”',
  '“A Taverna serve hidromel que dá força, e o Padre abençoa quem confessa. Aproveite antes de partir.”',
  '“Dizem que o Sábio Orin sabe mais do Selo de Aldoria do que conta. Fale com ele na Torre.”',
  '“Cuidado com os orcs a leste e os ogros ao sul. Não é lugar para novatos.”',
];
let guardN = 0;
function npcGuard() {
  const w = setWin(`<h3>Guarda de Aldoria${closeBtn}</h3><div style="font-size:13px">${GUARD_LINES[guardN++ % GUARD_LINES.length]}</div>`);
  bindClose(w);
}

let blessAt = -1e9;
const SINS: [string, string][] = [
  ['Roubei uma poção de um kobold adormecido.', '“Os kobolds também precisam de cura, filho. Devolva uma moeda ao primeiro que encontrar e nos perdoamos.”'],
  ['Matei mais goblins do que a missão pedia.', '“A Aurora conta cada vida. Mas a vila dorme melhor com menos goblins. Reze três vezes e siga em paz.”'],
  ['Duvidei da luz de Pelor numa cripta escura.', '“A dúvida é a vela que ilumina a fé. Acenda-a de novo.”'],
  ['Guardei um segredo sobre o Selo de Aldoria.', '“Segredos pesam… mas alguns precisam ser carregados com cuidado. Algo cinzento ronda a vila. Fique atento, filho.”'],
];
function npcPriest() {
  const ready = Date.now() - blessAt > 600000;
  const w = setWin(`<h3>Padre Anselmo${closeBtn}</h3>
    <div style="font-size:13px;margin-bottom:8px">“Que a Aurora ilumine seus passos. Deseja confessar-se, filho? A confissão alivia a alma… e protege o corpo.”</div>
    <div id="conf">${SINS.map((x, i) => `<div class="row"><button data-c="${i}">${x[0]}</button></div>`).join('')}</div>
    <div class="qrow" style="margin-top:8px"><b>🕯️ Doação ao templo</b> — Bênção de Pelor (+1 CA, +2 de dano, regeneração por 10 min)<div class="row"><button data-d="1" ${ready ? 'class="primary"' : 'disabled'}>Doar 🪙 100${ready ? '' : ' (aguarde)'}</button></div></div>`);
  bindClose(w);
  w.querySelectorAll<HTMLElement>('[data-c]').forEach((b) => (b.onclick = () => {
    const sin = SINS[Number(b.dataset.c)];
    q('#conf', w).innerHTML = `<div class="qrow"><i>Você sussurra pelo confessionário: “${sin[0]}”</i><br><br>${sin[1]}<br><br><span style="color:#ffe9a8">“Vá em paz. Que Pelor o abençoe.”</span></div>`;
    if (ready) { blessAt = Date.now(); bus.emit('blessing', 'Bênção de Pelor', { ac: 1, dmg: 1, regen: 1 }, 600000); onLog('Bênção de Pelor (confissão): +1 CA, +1 dano e regeneração por 10 min.', '#ffe9a8'); }
    else onLog('O padre ouve com paciência, mas a bênção já foi concedida há pouco.', '#a79cc4');
  }));
  w.querySelectorAll<HTMLElement>('[data-d]').forEach((b) => (b.onclick = () => {
    if (player.gold < 100) { onLog('Ouro insuficiente.', '#ff8a8a'); return; }
    player.gold -= 100; blessAt = Date.now();
    bus.emit('blessing', 'Bênção de Pelor', { ac: 1, dmg: 2, regen: 2 }, 600000);
    onLog('O padre abençoa você: +1 CA, +2 de dano e regeneração por 10 min.', '#ffe9a8'); save(); npcPriest();
  }));
}

function npcHealer() {
  const d = derive(player);
  const w = setWin(`<h3>Irmã Elowen${closeBtn}</h3>
    <div style="font-size:13px;margin-bottom:8px">“Que a luz proteja seus passos, viajante.”</div>
    <div class="row"><button id="heal" class="primary">Restaurar PV e energia (grátis)</button></div>`);
  bindClose(w);
  q('#heal', w).onclick = () => { player.hp = d.maxHp; player.en = d.maxEn; onLog('Você se sente renovado.', '#7ee787'); closeWin(); };
}

export type { PlayerState };


// ======================== HISTÓRIA ========================
function showStory(title: string, paras: string[], kicker = '') {
  document.getElementById('story')?.remove();
  const d = h(`<div class="story-box panel">${kicker ? `<div class="kick">${kicker}</div>` : ''}<h2>${title}</h2>${paras.map((p) => `<p>${p}</p>`).join('')}<div class="row" style="justify-content:center"><button class="primary" id="story-ok">Continuar</button></div></div>`, 'story-wrap hit');
  d.id = 'story';
  root.appendChild(d);
  q('#story-ok', d).onclick = () => d.remove();
}

const CLUES = [
  'Rumores falam de uma Sombra selada sob Aldoria há séculos.',
  'A Marca Cinzenta aparece em criaturas corrompidas: uma mão aberta, de dedos longos demais.',
  'Um mensageiro encapuzado recruta servos em nome de "um rei".',
  'Ele conhece cada um dos Cinco Heróis da Ordem da Aurora pelo nome.',
  'Cultistas de manto cinza procuram a Câmara do Selo Partido.',
  'O Selo guardava uma cela... talvez vazia.',
];

function renderJournal() {
  const fr = player.story.fragments;
  const clues = CLUES.slice(0, fr.length + 1).map((c) => `<li>${c}</li>`).join('');
  const frags = FRAGMENTS.map((f) => fr.includes(f.id)
    ? `<div class="qrow"><b style="color:#ffd23f">◆ ${f.name}</b><br><span style="color:#cfc8e8">${f.lore}</span></div>`
    : `<div class="qrow" style="opacity:.45"><b>◇ ???</b> — fragmento ainda não encontrado</div>`).join('');
  const dgs = DUNGEONS.map((d) => {
    const boss = d.boss;
    const mq = MAIN_QUESTS.find((m) => m.mob === boss)!;
    const done = player.quests[mq.id]?.state === 'done' || fr.includes(FRAGMENTS[DUNGEONS.indexOf(d)].id);
    const locked = d.needs && fr.length < d.needs;
    return `<div class="qrow"><b>${d.name}</b> <span style="color:#a79cc4">(${d.levels})</span> — ${done ? '<span style="color:#7ee787">fragmento recuperado</span>' : locked ? '<span style="color:#ff8a8a">selada (exige ' + d.needs + ' fragmentos)</span>' : 'disponível'}</div>`;
  }).join('');
  const w = setWin(`<h3>Diário do Aventureiro${closeBtn}</h3>
    <div style="font-size:13px;color:#cfc8e8;margin-bottom:6px">Capítulo ${CURRENT_CHAPTER.id} — ${CURRENT_CHAPTER.title}. Reúna os ${FRAGMENTS.length} fragmentos do Selo de Aldoria percorrendo as masmorras. Fale com o Sábio Orin na vila.</div>
    <h3 style="margin-top:10px">O Inimigo</h3>
    <div class="qrow"><b>O Rei Cinzento?</b> <span style="color:#a79cc4">Identidade desconhecida</span><ul style="margin:6px 0 0 18px;padding:0;font-size:12px;line-height:1.5">${clues}</ul></div>
    <h3 style="margin-top:10px">Fragmentos do Selo (${fr.length}/${FRAGMENTS.length})</h3>${frags}
    <h3 style="margin-top:10px">Masmorras</h3>${dgs}`);
  bindClose(w);
}

function renderMap() {
  const tabs = (['global', 'city'] as MapKind[]).map((k) => `<button class="mt" data-k="${k}" style="padding:3px 12px;${mapTab === k ? 'border-color:var(--gold);color:var(--gold)' : ''}">${k === 'global' ? '🗺️ Mapa Global' : '🏰 Mapa da Cidade'}</button>`).join(' ');
  const w = setWin(`<h3>Mapa${closeBtn}</h3>
    <div style="display:flex;gap:6px;margin-bottom:8px">${tabs}</div>
    <canvas id="mapc" style="max-width:100%;max-height:74vh;width:auto;height:auto;border-radius:6px;display:block;margin:0 auto"></canvas>
    <div id="maplg" style="font-size:12px;line-height:1.6;margin-top:8px;color:#cfc8e8"></div>`);
  (w.firstElementChild as HTMLElement).style.width = 'min(960px,96vw)';
  bindClose(w);
  const cv = q<HTMLCanvasElement>('#mapc');
  let lastKey = '';
  const paint = (force = false) => {
    const pos = mapSource?.pos();
    const key = `${mapTab}|${exploredVersion}|${Math.round((pos?.x ?? 0) / 8)}|${Math.round((pos?.y ?? 0) / 8)}`;
    if (!force && key === lastKey) return;
    lastKey = key;
    drawMap(mapTab, cv);
    q('#maplg').innerHTML = mapLegend(mapTab);
  };
  qa<HTMLElement>('.mt', w).forEach((b) => (b.onclick = () => { mapTab = b.dataset.k as MapKind; renderMap(); }));
  paint(true);
  mapTimer = window.setInterval(() => paint(), 500);
}

function mapLegend(kind: MapKind): string {
  const ok = (t: string) => `<span style="color:#7ee787">✔</span> ${t}`, no = (t: string) => `<span style="color:#8a82a6">✖ ${t}</span>`;
  if (kind === 'city') {
    const rows = BUILDINGS.map((b) => (isExplored(b.x0 + b.w / 2, b.y0 + b.h / 2) ? ok(`<b>${b.name}</b>`) : no('Edifício não descoberto')));
    return `<div><b style="color:var(--gold)">Locais da vila</b> — ${rows.join(' · ')}</div><div style="margin-top:4px;color:#a79cc4">Passeie pelas ruas para revelar a planta da cidade. A fonte e os bancos ficam na praça, em frente à Catedral.</div>`;
  }
  const zrows = Object.values(ZONES).map((z) => {
    let seen = false;
    for (let ty = 2; ty < 156 && !seen; ty += 4) for (let tx = 2; tx < 210; tx += 4) if (zoneAt(tx, ty) === z.id && isExplored(tx, ty)) { seen = true; break; }
    return seen ? ok(`<b>${z.name}</b> <i>(${z.levels})</i>`) : no('Região desconhecida');
  });
  const drows = DUNGEONS.map((d) => (isExplored(d.entrance.tx, d.entrance.ty) ? ok(`<b>${d.name}</b> <i>(${d.levels})</i>`) : no('Masmorra não descoberta')));
  return `<div><b style="color:var(--gold)">Biomas</b> — ${zrows.join(' · ')}</div><div style="margin-top:4px"><b style="color:var(--gold)">Masmorras</b> — ${drows.join(' · ')}</div>`;
}

function rewardQuest(x: { xp: number; gold: number; potion?: 'heal' | 'energy'; item?: boolean; minLevel: number; title: string }) {
  player.gold += x.gold;
  if (x.potion) player.potions[x.potion]++;
  if (x.item) {
    const c = CLASS_BY_ID[player.classId];
    const it = genItem({ slot: (['mainhand', 'body', 'head', 'legs', 'accessory'] as Slot[])[Math.floor(Math.random() * 5)], level: Math.min(10, x.minLevel + 1), style: c.style, rarity: 2, armorMax: c.armor, cid: c.id, off: allowedOff(c) });
    if (addItem(it)) onLog(`Recompensa: ${it.name}`, RARITY_COLORS[it.rarity]);
  }
  gainXp(x.xp);
  onLog(`Missão entregue: ${x.title} (+${x.xp} XP, +${x.gold} ouro)`, '#7ee787');
}

function npcSage() {
  const fr = player.story.fragments.length;
  const first = !player.story.seen.sage;
  player.story.seen.sage = true;
  const rows = MAIN_QUESTS.map((x) => {
    const st = player.quests[x.id];
    if (st?.state === 'done') return `<div class="qrow" style="opacity:.5"><b>★ ${x.title}</b> ✔ concluída</div>`;
    if (x.requires && player.quests[x.requires]?.state !== 'done') return `<div class="qrow" style="opacity:.4"><b>★ ???</b> Conclua a missão anterior.</div>`;
    const reward = `${x.xp} XP · 🪙 ${x.gold}${x.potion ? ' · poção' : ''}${x.item ? ' · item raro' : ''}`;
    let btn = '';
    if (!st) btn = player.level >= x.minLevel ? `<button data-a="${x.id}" class="primary">Aceitar</button>` : `<button disabled>Requer nível ${x.minLevel}</button>`;
    else if (st.state === 'ready') btn = `<button data-t="${x.id}" class="primary">Entregar</button>`;
    else btn = `<span style="color:#a79cc4">Em andamento</span>`;
    return `<div class="qrow" style="border-left:3px solid #ffd23f"><b style="color:#ffd23f">★ ${x.title}</b> <span style="color:#a79cc4">(nv ${x.minLevel}+)</span><br>${x.desc}<br><span style="color:#ffe9a8">Recompensa: ${reward}</span><div class="row">${btn}</div></div>`;
  }).join('');
  const line = first ? SAGE_INTRO : fr >= 5 ? 'O Selo está refeito, mas não confio no silêncio que ficou.' : `Fragmentos recuperados: ${fr}/${FRAGMENTS.length}. O tempo é curto, aventureiro.`;
  const w = setWin(`<h3>Sábio Orin${closeBtn}</h3><div style="font-size:13px;margin-bottom:6px">“${line}”</div>
    <div class="row" style="margin-bottom:6px"><button id="sage-shop" class="primary">📚 Ver mercadorias do Sábio</button><button id="sage-ench">✨ Mesa de Encantamento</button></div>${rows}`);
  bindClose(w);
  q('#sage-shop', w).onclick = () => shopWindow('sage');
  q('#sage-ench', w).onclick = () => { curWin = 'enchant'; renderEnchant(); };
  w.querySelectorAll<HTMLElement>('[data-a]').forEach((b) => (b.onclick = () => {
    const x = MAIN_QUESTS.find((z) => z.id === b.dataset.a)!;
    player.quests[x.id] = { progress: 0, state: 'active' };
    onLog('Missão principal aceita!', '#ffd23f'); save(); npcSage();
    showStory(x.title, [x.story], 'Missão principal');
  }));
  w.querySelectorAll<HTMLElement>('[data-t]').forEach((b) => (b.onclick = () => {
    const x = MAIN_QUESTS.find((z) => z.id === b.dataset.t)!;
    player.quests[x.id].state = 'done';
    rewardQuest(x);
    save(); npcSage();
    if (x.id === 'm5') { player.story.ended = true; save(); showStory(EPILOGUE.title, EPILOGUE.paras, 'Capítulo concluído'); }
    else showStory(x.title, [x.outro], 'Missão concluída');
  }));
}
