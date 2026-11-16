// Random photos from picsum.photos. Seeded URLs so "previous" shows the same photo again.
import { photoShow, screenSize } from './photos.js';

export default photoShow({
  name: 'picsum',
  label: 'Picsum',
  load: async () => {
    const [w, h] = screenSize();
    const base = Math.floor(Math.random() * 1e6);
    return i => `https://picsum.photos/seed/${base + i}/${w}/${h}`;
  },
});
