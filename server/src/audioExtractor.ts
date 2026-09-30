import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export interface StreamInfo {
  streamUrl: string;
  expiresAt: number;   
  durationSec: number;
  title: string;
  channelName: string;
  thumbnailUrl: string;
}

const streamCache = new Map<string, StreamInfo>();
const EXPIRY_SAFETY_MARGIN_MS = 10 * 60_000; 

// Using the yt-dlp binary we downloaded
const YTDLP_PATH = path.resolve(process.cwd(), 'yt-dlp');

export async function getAudioStreamUrl(videoId: string): Promise<StreamInfo> {
  const cached = streamCache.get(videoId);
  if (cached && cached.expiresAt - Date.now() > EXPIRY_SAFETY_MARGIN_MS) {
    return cached;
  }

  console.log(`[Audio] Extracting stream for ${videoId} using yt-dlp...`);

  try {
    const { stdout } = await execAsync(`"${YTDLP_PATH}" -f "bestaudio" --dump-json --no-warnings "https://www.youtube.com/watch?v=${videoId}"`, { timeout: 15000 });
    const info = JSON.parse(stdout);

    if (!info.url) {
      throw new Error(`No audio url found for video ${videoId}`);
    }

    let expiresAt: number;
    try {
      const url = new URL(info.url);
      const expireParam = url.searchParams.get('expire');
      expiresAt = expireParam
        ? parseInt(expireParam, 10) * 1000
        : Date.now() + 4 * 60 * 60_000;
    } catch {
      expiresAt = Date.now() + 4 * 60 * 60_000;
    }

    const result: StreamInfo = {
      streamUrl: info.url,
      expiresAt,
      durationSec: info.duration ?? 0,
      title: info.title ?? 'Unknown Title',
      channelName: info.uploader ?? 'Unknown Channel',
      thumbnailUrl: info.thumbnail ?? '',
    };

    streamCache.set(videoId, result);
    console.log(`[Audio] Extracted "${result.title}" (expires in ${Math.round((expiresAt - Date.now()) / 60_000)} min)`);
    return result;
  } catch (err) {
    console.error(`[Audio] yt-dlp failed for ${videoId}:`, err);
    throw err;
  }
}

export async function prefetchStream(videoId: string): Promise<void> {
  try {
    await getAudioStreamUrl(videoId);
  } catch (err) {
    console.warn(`[Audio] Prefetch failed for ${videoId}:`, err);
  }
}

export function clearStreamCache(): void {
  streamCache.clear();
}
