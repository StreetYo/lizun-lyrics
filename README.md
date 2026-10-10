# Lyrics for Lizun

Lyrics of the song that is playing, in the [Lizun](https://github.com/StreetYo/Lizun) island:
open the island and read along. When the lyrics are synced, the line being sung is highlighted
and the list scrolls with the song. Lyrics come from [LRCLIB](https://lrclib.net), a free,
open lyrics database.

## Install

In Lizun, open Settings > Widgets > Add a widget, paste this link and press Install:

```
https://github.com/StreetYo/lizun-lyrics
```

To install a fixed version, use the link of a release instead, for example
`https://github.com/StreetYo/lizun-lyrics/releases/tag/v1.0.0`.

Clicking a line to jump to it needs a Lizun build with `media.seek`; with an older one the
lyrics work the same, the lines are just not clickable.

## Using it

- Play something in any player Lizun shows in the island (Spotify, a browser tab, and so on).
  The widget looks up the lyrics by the artist, title and length of the track.
- **Synced lyrics**: the current line is bright, the lines already sung are dimmed, the next
  ones wait below. Turn the mouse wheel to read ahead or back; after a few seconds the list
  follows the song again.
- **Click a line** to jump there in the song, when the player lets Lizun move the playback
  position. Players that do not, and the setting turned off, leave the lines unclickable.
- **Lyrics without timings** are shown as a text to scroll through, marked "Not synced".
- Instrumental tracks, songs LRCLIB does not have and a missing connection each get a short
  message under the track's name. When LRCLIB cannot be reached, press Try again, or the
  widget asks again on the next player update after half a minute.

Titles from video sites are cleaned up before searching: "(Official Video)", "[Lyrics]",
"- Remastered 2011", "feat. X" and the like are dropped, "Artist - Song" titles are split, and
channel names such as "Artist - Topic" or "ArtistVEVO" become the artist.

Found lyrics are kept on this computer for the last 200 songs, so a replay does not ask LRCLIB
again. A song LRCLIB does not have is asked about again after a day.

## Settings

Settings > Widgets > Lyrics:

| Setting | What it does |
|---|---|
| Text size | Size of the lyrics, 12–22 px |
| Timing offset | Moves synced lines if they come too early or too late, −3000 to 3000 ms; more than 0 shows them earlier |
| Current line | Keeps the line being sung in the middle, or near the top with the previous line above it |
| Click a line to jump to it | Turns seeking by clicking a line on or off |

## Permissions

| Permission | Why |
|---|---|
| `media:read` | Knows which track is playing and where it is, to find its lyrics and follow along. |
| `media:control` | Jumps to a line when you click it. Nothing else is controlled. |
| `storage` | Keeps lyrics already found. They stay on this computer, in Lizun's own storage. |
| Network `https://lrclib.net` | Looks up lyrics. Only the artist, title, album and length of the track are sent. |

## Development

The widget is plain HTML, CSS and JavaScript with no build step:

| File | What it is |
|---|---|
| `manifest.json` | Id, size, permissions, network, settings and their Russian translation |
| `index.html`, `style.css` | Page shown in the island, built on the island theme (`--lz-*` variables) |
| `main.js` | Follows the player, keeps the playback clock, picks what to show |
| `view.js` | Draws the track, the lines, the scrolling and the messages |
| `clean.js` | Turns player titles into an artist and a title to search for |
| `lrclib.js` | Asks LRCLIB: the exact record first, then a search matched by length (±3 s) |
| `lrc.js` | Reads LRC timings |
| `cache.js` | Lyrics already found, in widget storage, oldest dropped past 200 |
| `texts.js` | The widget's texts in English and Russian |
| `icons/` | Icons of the messages |

To try changes, choose this folder in Settings > Widgets > Add a widget, or copy it to
`%APPDATA%\app.lizun.desktop\widgets\lizun.lyrics\` and press Reload. How widgets work:
[Writing a Lizun widget](https://github.com/StreetYo/Lizun/blob/master/docs/widgets.md).

To release a version, raise `version` in `manifest.json`, then tag and publish a GitHub release
(`v1.0.1`).
