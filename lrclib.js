/** Lyrics from LRCLIB (https://lrclib.net): free, no key. */
import { network } from '/__sdk/index.js';
import { normalize } from './clean.js';

const API = 'https://lrclib.net/api';
const HEADERS = {
  'User-Agent': 'Lizun Lyrics widget (https://github.com/StreetYo/lizun-lyrics)',
  Accept: 'application/json',
};
/** How far a search result's length may be from the track's to count as the same recording. */
const DURATION_SLACK_S = 3;
/** The longest track LRCLIB takes a question about. */
const MAX_DURATION_S = 3600;

/** LRCLIB did not answer usefully: the network, a 5xx, a rate limit. Not cached. */
export class LookupError extends Error {}

async function getJson(path, params) {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== '' && value != null));
  let response;
  try {
    response = await network.request(`${API}/${path}?${query}`, { headers: HEADERS });
  } catch (error) {
    throw new LookupError(error?.message ?? String(error));
  }
  // 400 is LRCLIB refusing the question (such as a length it does not take), not an outage.
  if (response.status === 404 || response.status === 400) return null;
  if (!response.ok) throw new LookupError(`LRCLIB answered ${response.status}`);
  try {
    return response.json();
  } catch {
    throw new LookupError('LRCLIB sent something that is not JSON');
  }
}

/** What a record holds, best first: 0 synced, 1 plain, 2 instrumental, 3 nothing. */
function richness(record) {
  if (record.syncedLyrics?.trim()) return 0;
  if (record.plainLyrics?.trim()) return 1;
  if (record.instrumental) return 2;
  return 3;
}

function titleDistance(record, song) {
  const wanted = normalize(song.title);
  const found = normalize(record.trackName ?? record.name ?? '');
  if (found === wanted) return 0;
  return found.includes(wanted) || wanted.includes(found) ? 1 : 2;
}

/** The search result that is this recording, or null. */
function bestMatch(records, song, durationS) {
  const candidates = (Array.isArray(records) ? records : [])
    .filter((record) => richness(record) < 3 && titleDistance(record, song) < 2)
    .filter((record) => !durationS || Math.abs(record.duration - durationS) <= DURATION_SLACK_S)
    .map((record) => ({
      record,
      score: [titleDistance(record, song), richness(record), durationS ? Math.abs(record.duration - durationS) : 0],
    }));
  candidates.sort((a, b) => a.score[0] - b.score[0] || a.score[1] - b.score[1] || a.score[2] - b.score[2]);
  return candidates[0]?.record ?? null;
}

function resultOf(record) {
  if (!record) return { kind: 'none' };
  if (record.syncedLyrics?.trim()) return { kind: 'synced', lrc: record.syncedLyrics, text: record.plainLyrics ?? '' };
  if (record.plainLyrics?.trim()) return { kind: 'plain', text: record.plainLyrics };
  if (record.instrumental) return { kind: 'instrumental' };
  return { kind: 'none' };
}

/**
 * Looks the song up: the exact record first, then a search that takes the closest length.
 * Resolves to `{ kind: 'synced' | 'plain' | 'instrumental' | 'none', lrc?, text? }`, or to null
 * when `stillWanted()` turned false between requests; rejects with a `LookupError` when LRCLIB
 * could not be asked.
 */
export async function findLyrics(song, durationMs, stillWanted = () => true) {
  const durationS = durationMs ? Math.round(durationMs / 1000) : 0;
  // LRCLIB keeps songs up to an hour long; anything longer is a stream, a podcast or a mix.
  if (durationS > MAX_DURATION_S) return { kind: 'none' };
  let fallback = null;

  if (song.artist && durationS) {
    const exact = await getJson('get', {
      track_name: song.title,
      artist_name: song.artist,
      album_name: song.album,
      duration: durationS,
    });
    const result = resultOf(exact);
    if (result.kind === 'synced' || result.kind === 'instrumental') return result;
    if (result.kind === 'plain') fallback = result; // a search may still find a synced copy
  }

  const searches = [];
  if (song.artist) searches.push({ track_name: song.title, artist_name: song.artist });
  if (song.primaryArtist && song.primaryArtist !== song.artist) {
    searches.push({ track_name: song.title, artist_name: song.primaryArtist });
  }
  searches.push(song.artist ? { q: `${song.primaryArtist} ${song.title}` } : { track_name: song.title });

  for (const params of searches) {
    if (!stillWanted()) return null;
    const match = bestMatch(await getJson('search', params), song, durationS);
    if (!match) continue;
    const result = resultOf(match);
    if (result.kind === 'synced' || !fallback) return result;
    return fallback;
  }
  return fallback ?? { kind: 'none' };
}
