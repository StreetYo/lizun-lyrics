/** The widget's own texts by language; the manifest translates its name and settings. */
export const TEXTS = {
  en: {
    nothingPlaying: 'Nothing is playing',
    nothingPlayingHint: 'Play a song to see its lyrics here.',
    loading: 'Looking for lyrics…',
    notFound: 'No lyrics found',
    notFoundHint: 'LRCLIB has no lyrics for this track yet.',
    instrumental: 'Instrumental',
    instrumentalHint: 'This track has no words.',
    offline: 'Lyrics are not reachable',
    offlineHint: 'LRCLIB does not answer. Check the connection.',
    retry: 'Try again',
    seekTo: 'Jump to this line',
    plain: 'Not synced',
  },
  ru: {
    nothingPlaying: 'Ничего не играет',
    nothingPlayingHint: 'Включите песню, и здесь появится её текст.',
    loading: 'Ищу текст…',
    notFound: 'Текст не найден',
    notFoundHint: 'В LRCLIB пока нет текста этого трека.',
    instrumental: 'Инструментал',
    instrumentalHint: 'В этом треке нет слов.',
    offline: 'Тексты недоступны',
    offlineHint: 'LRCLIB не отвечает. Проверьте подключение.',
    retry: 'Повторить',
    seekTo: 'Перейти к этой строке',
    plain: 'Без синхронизации',
  },
};

export function textsFor(language) {
  return TEXTS[language] ?? TEXTS[String(language).split('-')[0]] ?? TEXTS.en;
}
