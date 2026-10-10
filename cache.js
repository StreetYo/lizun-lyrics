/**
 * Lyrics found earlier, so a replay does not ask LRCLIB again. Each song is its own storage key
 * (lyrics can be several KB), and an index keeps the keys by last use to drop the oldest.
 */
import { storage } from '/__sdk/index.js';

const INDEX_KEY = 'cache-index';
const MAX_ENTRIES = 200;
/** A song LRCLIB did not have is asked about again after a day; it may have been added. */
const NOT_FOUND_TTL_MS = 24 * 60 * 60 * 1000;

/** @type {{ id: string, usedAt: number }[] | null} */
let index = null;
/** Index writes one after another, so two songs saved at once do not lose one of them. */
let writing = Promise.resolve();

/** A short storage key for any song key: two 32-bit FNV-1a hashes. */
function storageId(key) {
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ key.length;
  for (let i = 0; i < key.length; i++) {
    const code = key.charCodeAt(i);
    a = Math.imul(a ^ code, 0x01000193);
    b = Math.imul(b ^ code, 0x5bd1e995);
  }
  return `lyrics:${(a >>> 0).toString(36)}${(b >>> 0).toString(36)}`;
}

async function loadIndex() {
  if (!index) {
    const stored = await storage.get(INDEX_KEY);
    index = Array.isArray(stored) ? stored.filter((item) => typeof item?.id === 'string') : [];
  }
  return index;
}

/** Marks `id` as just used and drops the oldest entries past the limit. */
function touch(id) {
  writing = writing
    .then(async () => {
      const items = (await loadIndex()).filter((item) => item.id !== id);
      items.push({ id, usedAt: Date.now() });
      items.sort((x, y) => x.usedAt - y.usedAt);
      const dropped = items.splice(0, Math.max(0, items.length - MAX_ENTRIES));
      index = items;
      await storage.set(INDEX_KEY, items);
      await Promise.all(dropped.map((item) => storage.remove(item.id)));
    })
    .catch((error) => console.warn('could not update the lyrics cache index', error));
  return writing;
}

/** The cached result for the song key, or null when there is none or it has expired. */
export async function cached(key) {
  const id = storageId(key);
  try {
    const entry = await storage.get(id);
    if (!entry || entry.key !== key) return null;
    if (entry.result.kind === 'none' && Date.now() - entry.savedAt > NOT_FOUND_TTL_MS) return null;
    touch(id);
    return entry.result;
  } catch (error) {
    console.warn('could not read the lyrics cache', error);
    return null;
  }
}

export async function remember(key, result) {
  const id = storageId(key);
  try {
    await storage.set(id, { key, savedAt: Date.now(), result });
    await touch(id);
  } catch (error) {
    console.warn('could not cache the lyrics', error);
  }
}
