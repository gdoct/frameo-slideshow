// Photos from the PHOTOS_DIR folder (see .env), mounted in the container at /photos
// and listed by nginx (autoindex JSON). Subfolders are included. Shuffled per visit.
import { photoShow, shuffle } from './photos.js';

const ROOT = '/photos/';
const IMAGE = /\.(jpe?g|png|webp|gif|avif)$/i;

async function walk(dir, depth = 0) {
  const res = await fetch(dir, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Fotomap niet bereikbaar (${res.status})`);
  const out = [];
  for (const e of await res.json()) {
    if (e.name.startsWith('.')) continue;
    const path = dir + encodeURIComponent(e.name);
    if (e.type === 'directory' && depth < 5) out.push(...await walk(path + '/', depth + 1));
    else if (e.type === 'file' && IMAGE.test(e.name)) out.push(path);
  }
  return out;
}

export default photoShow({
  name: 'nas',
  label: 'NAS foto’s',
  load: async () => {
    const files = shuffle(await walk(ROOT));
    if (!files.length) throw new Error('Geen foto’s gevonden in de slideshow-map');
    return i => files[((i % files.length) + files.length) % files.length];
  },
});
