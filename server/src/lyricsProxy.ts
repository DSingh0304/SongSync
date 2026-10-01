
import { Router } from 'express';
const router = Router();

router.get('/search', async (req, res) => {
  const { track_name } = req.query;
  if (!track_name) return res.status(400).json({ error: 'Missing track_name' });

  try {
    const url = new URL('https://lrclib.net/api/search');
    url.searchParams.set('q', track_name as string);

    const response = await fetch(url.toString());
    if (!response.ok) throw new Error(`LRCLIB returned ${response.status}`);

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      return res.json({ syncedLyrics: null, plainLyrics: null });
    }
    
    // Pick the best match (usually the first)
    const bestMatch = data[0];
    return res.json({ 
      syncedLyrics: bestMatch.syncedLyrics,
      plainLyrics: bestMatch.plainLyrics
    });
  } catch (err: any) {
    console.error('[Lyrics] Fetch error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch lyrics' });
  }
});
export default router;
