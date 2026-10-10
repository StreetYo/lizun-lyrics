import { language, media, ready, settings } from '/__sdk/index.js';
import { cached, remember } from './cache.js';
import { songKey, songOf } from './clean.js';
import { lineAt, parseLrc } from './lrc.js';
import { findLyrics, LookupError } from './lrclib.js';
import { textsFor } from './texts.js';
import * as view from './view.js';

/** Players often send the title and the artist in separate updates; wait for both. */
const LOOKUP_DELAY_MS = 400;
/** After a network error, the next media update asks again once this much time has passed. */
const RETRY_AFTER_MS = 30_000;

let text = textsFor('en');
let options;
let seekAllowed = false;

/** Latest update from the player. */
let nowPlaying = null;
/** Where the track was at `at` (performance.now()); advanced locally while playing. */
let clock = null;

/** The song being shown and what was found for it. */
let current = { key: null, song: null, status: 'idle', lines: [], text: '' };
/** Bumped on every new lookup, so a slow answer for an earlier song is dropped. */
let lookupToken = 0;
let lookupTimer;
let lastAttemptAt = 0;
let tickTimer;

function positionMs() {
  if (!clock) return null;
  let position = clock.positionMs + (clock.playing ? performance.now() - clock.at : 0);
  if (clock.durationMs) position = Math.min(position, clock.durationMs);
  return position + options.offset;
}

/** Highlights the line being sung and wakes up again when the next one starts. */
function tick() {
  clearTimeout(tickTimer);
  if (current.status !== 'synced') return;
  const position = positionMs();
  const index = position === null ? -1 : lineAt(current.lines, position);
  view.setActive(index);
  if (position === null || !clock.playing) return;
  const next = current.lines[index + 1];
  if (!next) return;
  tickTimer = setTimeout(tick, Math.min(Math.max(next.timeMs - position, 30), 1000) + 5);
}

function clickable() {
  return seekAllowed && options.clickToSeek && nowPlaying?.canSeek === true;
}

function seekTo(index) {
  const line = current.lines[index];
  if (!line || !clickable()) return;
  // A little past the line's start, so a player that reports whole seconds lands on it too.
  const target = Math.max(0, Math.round(line.timeMs - options.offset + 20));
  media.seek(target).catch((error) => console.warn('could not seek', error));
  clock = { ...(clock ?? { playing: nowPlaying?.playing ?? false, durationMs: nowPlaying?.durationMs }), positionMs: target, at: performance.now() };
  tick();
}

function render() {
  const { song, status } = current;
  view.setTextSize(options.textSize);
  view.setAlign(options.align);
  view.showTrack(status === 'idle' ? null : song, status === 'plain' ? text.plain : '');

  if (status === 'idle') {
    view.showMessage({ icon: 'note', title: text.nothingPlaying, hint: text.nothingPlayingHint });
  } else if (status === 'loading') {
    view.showMessage({ icon: 'search', title: text.loading, busy: true });
  } else if (status === 'none') {
    view.showMessage({ icon: 'note', title: text.notFound, hint: text.notFoundHint });
  } else if (status === 'instrumental') {
    view.showMessage({ icon: 'wave', title: text.instrumental, hint: text.instrumentalHint });
  } else if (status === 'error') {
    view.showMessage({
      icon: 'cloud-off',
      title: text.offline,
      hint: text.offlineHint,
      action: { label: text.retry, run: () => lookUp(true) },
    });
  } else if (status === 'plain') {
    view.showPlain(current.text);
  } else {
    const position = positionMs();
    view.showSynced(current.lines, position === null ? -1 : lineAt(current.lines, position), seekTo);
    view.setClickable(clickable(), text.seekTo);
    tick();
  }
}

function show(result) {
  if (result.kind === 'synced') {
    const lines = parseLrc(result.lrc);
    if (lines.some((line) => line.text)) {
      current = { ...current, status: 'synced', lines };
    } else {
      current = { ...current, status: result.text?.trim() ? 'plain' : 'none', text: result.text ?? '' };
    }
  } else {
    current = { ...current, status: result.kind, text: result.text ?? '', lines: [] };
  }
  render();
}

/** Finds the lyrics of the current song: in the cache, else on LRCLIB. */
async function lookUp(skipCache = false) {
  const { key, song } = current;
  if (!key) return;
  const token = ++lookupToken;
  const stillWanted = () => token === lookupToken;
  lastAttemptAt = Date.now();

  const hit = skipCache ? null : await cached(key);
  if (!stillWanted()) return;
  if (hit) {
    show(hit);
    return;
  }

  if (current.status !== 'loading') {
    current = { ...current, status: 'loading' };
    render();
  }
  try {
    const result = await findLyrics(song, nowPlaying?.durationMs ?? null, stillWanted);
    if (!result || !stillWanted()) return;
    remember(key, result);
    show(result);
  } catch (error) {
    if (!stillWanted()) return;
    if (!(error instanceof LookupError)) console.warn('lyrics lookup failed', error);
    current = { ...current, status: 'error' };
    render();
  }
}

function onMedia(next) {
  nowPlaying = next;
  clock =
    next && next.positionMs !== null && next.positionMs !== undefined
      ? { positionMs: next.positionMs, at: performance.now(), playing: next.playing, durationMs: next.durationMs }
      : null;

  const song = songOf(next);
  const key = song ? songKey(song) : null;
  if (key !== current.key) {
    clearTimeout(lookupTimer);
    lookupToken++;
    current = { key, song, status: key ? 'loading' : 'idle', lines: [], text: '' };
    render();
    if (key) lookupTimer = setTimeout(() => lookUp(), LOOKUP_DELAY_MS);
    return;
  }

  if (current.status === 'error' && Date.now() - lastAttemptAt > RETRY_AFTER_MS) lookUp(true);
  if (current.status === 'synced') {
    view.setClickable(clickable(), text.seekTo);
    tick();
  }
}

const context = await ready();
text = textsFor(context.language);
options = context.settings;
// `media.seek` arrives with a newer Lizun; older ones leave the lines unclickable.
seekAllowed = typeof media.seek === 'function' && context.permissions.includes('media:control');

language.subscribe((next) => {
  text = textsFor(next);
  render();
});
settings.subscribe((next) => {
  options = next;
  render();
});

render();
media.subscribe(onMedia);
// Subscribing reports changes only; the track that is already playing comes from here.
media
  .getNowPlaying()
  .then((first) => nowPlaying === null && onMedia(first))
  .catch((error) => console.warn('could not read the current track', error));
