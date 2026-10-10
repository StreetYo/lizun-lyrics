/**
 * Turns what a player reports into an artist and a song title LRCLIB knows. Apps such as Spotify
 * report clean fields; video sites report the channel as the artist and put "Artist - Song
 * (Official Video)" in the title.
 */

/** Words in brackets that are about the upload, not the song. */
const JUNK =
  /\b(official|video|audio|lyrics?|visuali[sz]er|m\/?v|hd|hq|4k|8k|remaster(ed)?|explicit|clean|radio edit|single version|album version|original mix|bonus track|prod\.?|color coded)\b|клип|видео|премьер|официальн|текст|аудио|лирик/i;

/** "(feat. X)", "(ft X)", "(with X)", "(при уч. X)": a guest, not part of the title. */
const GUEST_GROUP = /^\s*(feat\.?|ft\.?|featuring|with|при уч\.?|при участии)\s/i;

/** " feat. X" to the end of the text. */
const GUEST_TAIL = /\s+(feat\.?|ft\.|featuring)\s+.*$/i;

/** " - Remastered 2011", " - 2011 Remaster", " - Radio Edit", " - Mono"... */
const VERSION_TAIL =
  /\s+[-–—]\s+[^-–—]*\b(remaster(ed)?|version|(radio|single|album|extended|clean) edit|mono|stereo|(original|radio|extended|club) mix|deluxe)\b[^-–—]*$/i;

/** The dash between artist and title in "Artist - Song". */
const ARTIST_DASH = /\s+[-–—]\s+|\s*[-–—]{2}\s*/;

/** Players that report real artist and title fields even though they are web pages. */
const MUSIC_SITES = /^(music\.youtube\.com|open\.spotify\.com|music\.yandex\.[a-z]+|music\.apple\.com|.*\.bandcamp\.com|tidal\.com|listen\.tidal\.com|deezer\.com|www\.deezer\.com)$/i;

function isWebPage(sourceApp) {
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(sourceApp) && !/\.exe$/i.test(sourceApp);
}

function collapse(text) {
  return text.replace(/\s+/g, ' ').trim();
}

/** Removes brackets about the upload and guests in any position. */
function stripDecorations(text) {
  let result = text
    // Square and CJK brackets on video sites are always about the upload: [Official Video], 【MV】.
    .replace(/\s*[[【〔「『][^\]】〕」』]*[\]】〕」』]/g, ' ')
    .replace(/\s*\(([^()]*)\)/g, (group, inside) => (JUNK.test(inside) || GUEST_GROUP.test(inside) ? ' ' : group));
  // "Song | Official Video", "Song // Live at X": the song is the first part.
  const bar = result.search(/\s+(\||\/\/)\s+/);
  if (bar > 0) result = result.slice(0, bar);
  return collapse(result.replace(GUEST_TAIL, ''));
}

function stripQuotes(text) {
  return text.replace(/^["'«“„]+|["'»”“]+$/g, '').trim();
}

/** "Artist - Topic", "ArtistVEVO", "Artist Official" → "Artist". */
function cleanChannel(artist) {
  let result = collapse(artist)
    .replace(/\s+[-–—]\s+topic$/i, '')
    .replace(/vevo$/i, '')
    .replace(/\s*(official|официальный)$/i, '')
    .trim();
  // "TaylorSwift" from "TaylorSwiftVEVO".
  if (!result.includes(' ') && /[a-z][A-Z]/.test(result)) result = result.replace(/([a-z])([A-Z])/g, '$1 $2');
  return result;
}

function looksLikeChannel(artist) {
  return /\s[-–—]\s+topic$|vevo$|official$/i.test(artist.trim());
}

/**
 * The song to look up: `{ artist, title, album, primaryArtist }`, or null when there is no
 * title. `primaryArtist` is the first of several artists ("A & B", "A, B", "A x B").
 */
export function songOf(nowPlaying) {
  const rawTitle = collapse(nowPlaying?.title ?? '');
  if (!rawTitle) return null;
  const rawArtist = collapse(nowPlaying.artist ?? '');
  const fromWeb = isWebPage(nowPlaying.sourceApp ?? '') && !MUSIC_SITES.test(nowPlaying.sourceApp);

  let title = rawTitle.replace(VERSION_TAIL, '');
  let artist = cleanChannel(rawArtist);

  const dash = title.match(ARTIST_DASH);
  if (dash) {
    const left = stripDecorations(title.slice(0, dash.index));
    const right = title.slice(dash.index + dash[0].length);
    const sameArtist = artist && (normalize(left).includes(normalize(artist)) || normalize(artist).includes(normalize(left)));
    if (left && right && (!artist || fromWeb || looksLikeChannel(rawArtist) || sameArtist)) {
      artist = left;
      title = right;
    }
  }

  title = stripQuotes(stripDecorations(title));
  artist = stripDecorations(artist);
  if (!title) title = rawTitle;
  const primaryArtist = artist.split(/\s*(?:,|&|\+|;|\s+x\s+|\s+и\s+|\s+and\s+|\s+feat\.?\s+|\s+ft\.?\s+)\s*/i)[0] || artist;
  return { artist, title, album: collapse(nowPlaying.album ?? ''), primaryArtist };
}

/** Lowercase letters and digits only, so different spellings of a name compare equal. */
export function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/ё/g, 'е')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** The cache key of a song. */
export function songKey(song) {
  return `${normalize(song.artist)}|${normalize(song.title)}`;
}
