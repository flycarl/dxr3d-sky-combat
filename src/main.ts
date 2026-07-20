import './styles.css';
import { createAircraftModelCatalog } from './entities/AircraftModelFactory';
import { Game } from './game/Game';

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');

if (!canvas) {
  throw new Error('Missing #game-canvas element.');
}

const game = new Game(canvas);
window.__AIRCRAFT_MODEL_CATALOG__ = createAircraftModelCatalog();
game.start();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    game.dispose();
  });
}
