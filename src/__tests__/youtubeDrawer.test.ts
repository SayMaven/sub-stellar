import { describe, it, expect } from 'vitest';
import { parseCleanYouTubeTitleAndArtist } from '../components/youtube/YouTubeDrawer';

describe('YouTube Title & Artist Cleaner (parseCleanYouTubeTitleAndArtist)', () => {
  it('extracts artist and title from Japanese bracket format Artist「Title」', () => {
    const res = parseCleanYouTubeTitleAndArtist(
      '【Official Music Video】YOASOBI「アイドル」/ Idol (4K)',
      'Ayase / YOASOBI - Topic'
    );
    expect(res.title).toBe('アイドル');
    expect(res.artist).toBe('YOASOBI');
  });

  it('extracts artist and title from standard "Artist - Title [Official MV]" format', () => {
    const res = parseCleanYouTubeTitleAndArtist(
      'Kenshi Yonezu - KICK BACK [Official Video] (Full Ver.)',
      'Kenshi Yonezu Official YouTube Channel'
    );
    expect(res.title).toBe('KICK BACK');
    expect(res.artist).toBe('Kenshi Yonezu');
  });

  it('strips "- Topic" and "Official YouTube Channel" from channel names when title has no separator', () => {
    const res = parseCleanYouTubeTitleAndArtist(
      'Stellar Night Flight (Official Lyric Video)',
      'Luna - Topic'
    );
    expect(res.title).toBe('Stellar Night Flight');
    expect(res.artist).toBe('Luna');
  });
});

