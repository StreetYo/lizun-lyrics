/** Reads LRC text ("[01:02.34] line") into `{ timeMs, text }[]`, sorted by time. */

const STAMP = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
/** Word timings of enhanced LRC: "<01:02.34>". */
const WORD_STAMP = /<\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?>/g;

function toMs(minutes, seconds, fraction = '') {
  const ms = fraction ? Number(fraction.padEnd(3, '0').slice(0, 3)) : 0;
  return Number(minutes) * 60000 + Number(seconds) * 1000 + ms;
}

export function parseLrc(source) {
  const lines = [];
  // "[offset:+500]" moves every line 500 ms earlier.
  const offset = Number(source.match(/^\s*\[offset:\s*([+-]?\d+)\s*\]/im)?.[1] ?? 0);
  for (const raw of source.split(/\r?\n/)) {
    const stamps = [...raw.matchAll(STAMP)];
    if (!stamps.length || stamps[0].index !== raw.search(/\S/)) continue;
    const last = stamps[stamps.length - 1];
    const text = raw
      .slice(last.index + last[0].length)
      .replace(WORD_STAMP, '')
      .replace(/\s+/g, ' ')
      .trim();
    for (const stamp of stamps) {
      lines.push({ timeMs: Math.max(0, toMs(stamp[1], stamp[2], stamp[3]) - offset), text });
    }
  }
  lines.sort((a, b) => a.timeMs - b.timeMs);
  // Runs of empty lines are one pause; a pause at the very start says nothing.
  return lines.filter((line, i) => line.text || (i > 0 && lines[i - 1].text));
}

/** Index of the line being sung at `positionMs`, or -1 before the first one. */
export function lineAt(lines, positionMs) {
  let low = 0;
  let high = lines.length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (lines[mid].timeMs <= positionMs) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found;
}
