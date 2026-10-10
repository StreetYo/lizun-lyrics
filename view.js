/** Draws the widget: the track line, the lyrics (synced or plain) and the empty states. */

const header = document.getElementById('header');
const songLabel = document.getElementById('song');
const artistLabel = document.getElementById('artist');
const badge = document.getElementById('badge');
const body = document.getElementById('body');

/** How long the lyrics stay where the user scrolled them before following the song again. */
const USER_SCROLL_HOLD_MS = 4000;

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

/** The synced list on screen, if any. */
let list = null;
/** @type {HTMLElement[]} */
let lineElements = [];
let activeIndex = -1;
let align = 'center';
let userScrollUntil = 0;
let resumeTimer;

function h(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

export function setTextSize(px) {
  document.documentElement.style.setProperty('--text-size', `${px}px`);
  follow(false);
}

export function setAlign(next) {
  align = next === 'top' ? 'top' : 'center';
  list?.classList.toggle('top', align === 'top');
  follow(false);
}

/** The track above the lyrics; nothing when `song` is null. */
export function showTrack(song, badgeText = '') {
  header.hidden = !song;
  songLabel.textContent = song?.title ?? '';
  artistLabel.textContent = song?.artist ?? '';
  header.title = song ? [song.title, song.artist].filter(Boolean).join(' · ') : '';
  badge.textContent = badgeText;
  badge.hidden = !badgeText;
}

function clearBody() {
  list = null;
  lineElements = [];
  activeIndex = -1;
  clearTimeout(resumeTimer);
  body.replaceChildren();
}

/** A calm message instead of lyrics: `{ icon, title, hint?, action?: { label, run }, busy? }`. */
export function showMessage({ icon, title, hint, action, busy = false }) {
  clearBody();
  const box = h('div', busy ? 'message busy' : 'message');
  const glyph = h('span', 'glyph');
  glyph.style.setProperty('--icon', `url(./icons/${icon}.svg)`);
  box.append(glyph, h('p', 'message-title', title));
  if (hint) box.append(h('p', 'message-hint', hint));
  if (action) {
    const button = h('button', 'lz-button retry', action.label);
    button.addEventListener('click', action.run);
    box.append(button);
  }
  body.append(box);
}

/** Lyrics without timings: a text to scroll through. */
export function showPlain(text) {
  clearBody();
  const scroller = h('div', 'plain');
  scroller.textContent = text.trim();
  body.append(scroller);
}

/**
 * Timed lines. `onPick(index)` is called when a line is clicked while `setClickable(true)`.
 * The list starts at `startIndex` without animating.
 */
export function showSynced(lines, startIndex, onPick) {
  clearBody();
  list = h('ol', align === 'top' ? 'lines top' : 'lines');
  lineElements = lines.map((line, index) => {
    const item = h('li', line.text ? 'line' : 'line pause', line.text || '♪');
    item.dataset.index = String(index);
    return item;
  });
  list.append(...lineElements);
  list.addEventListener('click', (event) => {
    const item = event.target.closest?.('.line');
    if (item && list?.classList.contains('clickable')) onPick(Number(item.dataset.index));
  });
  // A wheel turn means the user is reading ahead or back: hold the list there for a while.
  list.addEventListener('wheel', () => {
    userScrollUntil = performance.now() + USER_SCROLL_HOLD_MS;
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => follow(true), USER_SCROLL_HOLD_MS + 50);
  }, { passive: true });
  body.append(list);
  activeIndex = Number.NaN; // so that the first setActive marks every line
  setActive(startIndex, false);
}

export function setClickable(clickable, title) {
  if (!list) return;
  list.classList.toggle('clickable', clickable);
  for (const item of lineElements) item.title = clickable ? title : '';
}

/** Highlights line `index` (-1: before the first line) and scrolls to it. */
export function setActive(index, smooth = true) {
  if (!list || index === activeIndex) return;
  activeIndex = index;
  lineElements.forEach((item, i) => {
    item.classList.toggle('past', i < index);
    item.classList.toggle('current', i === index);
  });
  follow(smooth);
}

/** Scrolls the current line into its place, unless the user has just scrolled the list. */
function follow(smooth) {
  if (!list || performance.now() < userScrollUntil) return;
  const current = lineElements[activeIndex];
  let top = 0;
  if (current) {
    if (align === 'top') {
      const previous = lineElements[activeIndex - 1];
      top = previous ? previous.offsetTop : current.offsetTop;
    } else {
      top = current.offsetTop + current.offsetHeight / 2 - list.clientHeight / 2;
    }
  }
  list.scrollTo({ top: Math.max(0, top), behavior: smooth && !reducedMotion.matches ? 'smooth' : 'instant' });
}

/** Text size or width changed: the lines moved, so put the current one back in place. */
new ResizeObserver(() => follow(false)).observe(body);
// A hidden page does not animate, so a smooth scroll started while the island was closed may not
// have happened.
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && follow(false));
