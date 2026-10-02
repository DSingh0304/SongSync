// server/src/youtubeProxy.ts
// Proxies YouTube Data API v3 search requests with 24h in-memory caching.
// Protects the 100 searches/day free quota from being burned directly from clients.

import { Router } from 'express';

const router = Router();

interface CacheEntry {
  results: YouTubeSearchItem[];
  cachedAt: number;
}

interface YouTubeSearchItem {
  videoId: string;
  title: string;
  channelName: string;
  thumbnailUrl: string;
  // Note: duration is not available from search.list — use videos.list for that
}

const searchCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 24 * 60 * 60_000; // 24 hours

function getCachedResult(query: string): YouTubeSearchItem[] | null {
  const entry = searchCache.get(query);
  if (entry && Date.now() - entry.cachedAt < CACHE_TTL_MS) {
    return entry.results;
  }
  return null;
}

/**
 * GET /api/youtube/search?q=<query>
 * Searches YouTube for videos. Results are cached 24h per query.
 * Cost: 100 API units per cache miss.
 */
router.get('/search', async (req, res) => {
  const query = (req.query.q as string)?.trim().toLowerCase();

  if (!query || query.length < 3) {
    return res.status(400).json({ error: 'Query must be at least 3 characters' });
  }

  // Return cached result
  const cached = getCachedResult(query);
  if (cached) {
    return res.json({ results: cached, cached: true });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'YouTube API not configured' });
  }

  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/search');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('type', 'video');
    url.searchParams.set('videoCategoryId', '10'); // Music category
    url.searchParams.set('maxResults', '10');
    url.searchParams.set('q', query);
    url.searchParams.set('key', apiKey);

    const response = await fetch(url.toString());
    if (!response.ok) {
      const err = await response.json();
      console.error('[YouTube Search] API error:', err);
      return res.status(502).json({ error: 'YouTube API error', detail: err });
    }

    const data = await response.json();
    const results: YouTubeSearchItem[] = (data.items ?? []).map((item: any) => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      channelName: item.snippet.channelTitle,
      thumbnailUrl:
        item.snippet.thumbnails?.high?.url ??
        item.snippet.thumbnails?.default?.url ??
        '',
    }));

    searchCache.set(query, { results, cachedAt: Date.now() });
    console.log(`[YouTube] Search "${query}" → ${results.length} results (API call)`);

    return res.json({ results, cached: false });
  } catch (err) {
    console.error('[YouTube Search] Fetch error:', err);
    return res.status(500).json({ error: 'Failed to fetch search results' });
  }
});

/**
 * GET /api/youtube/video/:id
 * Fetch details for a specific video ID. Costs only 1 API unit.
 * Used for URL paste flow.
 */
router.get('/video/:id', async (req, res) => {
  const videoId = req.params.id?.trim();

  if (!videoId || videoId.length !== 11) {
    return res.status(400).json({ error: 'Invalid YouTube video ID' });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'YouTube API not configured' });
  }

  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/videos');
    url.searchParams.set('part', 'snippet,contentDetails');
    url.searchParams.set('id', videoId);
    url.searchParams.set('key', apiKey);

    const response = await fetch(url.toString());
    if (!response.ok) {
      return res.status(502).json({ error: 'YouTube API error' });
    }

    const data = await response.json();
    const item = data.items?.[0];

    if (!item) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Parse ISO 8601 duration (PT3M45S → 225 seconds)
    const durationSec = parseISO8601Duration(item.contentDetails?.duration ?? 'PT0S');

    return res.json({
      videoId,
      title: item.snippet.title,
      channelName: item.snippet.channelTitle,
      thumbnailUrl:
        item.snippet.thumbnails?.high?.url ??
        item.snippet.thumbnails?.default?.url ??
        '',
      durationSec,
    });
  } catch (err) {
    console.error('[YouTube Video] Fetch error:', err);
    return res.status(500).json({ error: 'Failed to fetch video details' });
  }
});

function parseISO8601Duration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] ?? '0', 10);
  const minutes = parseInt(match[2] ?? '0', 10);
  const seconds = parseInt(match[3] ?? '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}

export default router;
