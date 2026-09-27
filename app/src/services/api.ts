// app/src/services/api.ts
import { SERVER_URL } from '../utils/constants';
import { YouTubeSearchResult } from '../types';

export class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Search YouTube via the backend proxy.
 * Handles debouncing and caching on the server side.
 */
export async function searchYouTube(query: string): Promise<YouTubeSearchResult[]> {
  const url = `${SERVER_URL}/api/youtube/search?q=${encodeURIComponent(query)}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(errorData.error || 'Failed to search YouTube', response.status);
  }

  const data = await response.json();
  return data.results || [];
}

/**
 * Fetch video details by ID (used when pasting a YouTube URL).
 */
export async function getVideoDetails(videoId: string): Promise<YouTubeSearchResult> {
  const url = `${SERVER_URL}/api/youtube/video/${encodeURIComponent(videoId)}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(errorData.error || 'Failed to fetch video details', response.status);
  }

  return response.json();
}

