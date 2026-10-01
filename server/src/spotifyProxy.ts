import { Router } from 'express';
const spotifyUrlInfo = require('spotify-url-info');

// Needs native fetch to work
const spotify = spotifyUrlInfo(fetch);

const router = Router();

router.post('/import', async (req, res) => {
  const { url } = req.body;
  if (!url || !url.includes('spotify.com')) {
    return res.status(400).json({ error: 'Invalid Spotify URL' });
  }

  try {
    const data = await spotify.getTracks(url);
    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ error: 'Could not extract tracks' });
    }

    // Limit to 20 tracks for free tier quota protection
    const tracks = data.slice(0, 20).map(t => ({
      name: t.name,
      artist: t.artists?.[0]?.name || 'Unknown Artist',
    }));

    return res.json({ tracks });
  } catch (err: any) {
    console.error('[Spotify] Import error:', err.message);
    return res.status(500).json({ error: 'Failed to parse Spotify link' });
  }
});

export default router;
