import { World3D } from './scenes/World3D';
import { initHud, showMenu } from './ui/ui';
import { save } from './game/state';
import { loadArt } from './art/art';
import { loadModels } from './art/models';
import { DUNGEON_BY_ID } from './chapters/story1';
import { bus } from './game/bus';
import { BUILDINGS } from './chapters/town';
import { player } from './game/state';
import { reveal } from './game/mapdata';
import { genItem, allowedOff } from './data/items';

let game: World3D | null = null;

function startGame() {
  initHud();
  game?.destroy();
  game = new World3D(document.getElementById('game')!);
  (window as any).__game = game;
  (window as any).__dun = DUNGEON_BY_ID;
  (window as any).__bus = bus;
  (window as any).__bld = BUILDINGS;
  (window as any).__player = player;
  (window as any).__reveal = reveal;
  (window as any).__genItem = genItem;
  (window as any).__allowedOff = allowedOff;
}

window.addEventListener('beforeunload', () => save());
bus.on('menu', () => { game?.destroy(); game = null; showMenu(startGame); });
Promise.all([loadArt(), loadModels()]).then(() => showMenu(startGame));
