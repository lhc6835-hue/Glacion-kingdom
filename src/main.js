// Entry point. URL options: ?play skips the title screen, ?t=19 sets the hour, ?q=low|medium|high,
// ?region=sunveil starts in another region (for testing).
import '@fontsource/cinzel-decorative/latin-900.css';
import '@fontsource/cinzel/latin-600.css';
import { Game } from './game/Game.js';

const qs = new URLSearchParams(location.search);
const game = new Game(document.getElementById('game'), document.getElementById('ui'), {
  autoplay: qs.has('play'),
  hour: qs.has('t') ? parseFloat(qs.get('t')) : undefined,
  region: qs.get('region') || undefined,
});
if (qs.has('q')) { game.state.settings.effects = qs.get('q'); game.applySettings(); }
window.__axenfall = game;
game.start();
