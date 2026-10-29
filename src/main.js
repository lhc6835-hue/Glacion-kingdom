// Entry point. URL options: ?play skips the title and opening, ?t=19 sets the hour, ?q=low|medium|high.
import { Game } from './game/Game.js';

const qs = new URLSearchParams(location.search);
const game = new Game(document.getElementById('game'), document.getElementById('ui'), {
  autoplay: qs.has('play'),
  hour: qs.has('t') ? parseFloat(qs.get('t')) : undefined,
});
if (qs.has('q')) { game.state.settings.effects = qs.get('q'); game.applySettings(); }
window.__axenfall = game;
game.start();
