// Loads the ascii-animals engine (MIT, see ascii-animals/LICENSE.txt) and hands it to newtab.js.
import { AnimalEngine, ANIMALS } from './ascii-animals/index.js';

window.AsciiAnimals = { AnimalEngine, ANIMALS };
window.dispatchEvent(new Event('ascii-animals-ready'));
