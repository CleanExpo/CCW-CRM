/**
 * CCW Video Production Pipeline — YouTube Data API v3 Upload Helper (UNI-1672)
 *
 * Uploads rendered MP4 files to the CCW YouTube channel using OAuth2 credentials.
 * Called by the video pipeline orchestrator after Remotion rendering completes.
 *
 * Env vars:
 *   YOUTUBE_OAUTH_CREDENTIALS — JSON string with access_token, refresh_token,
 *                               client_id, client_secret
 *   YOUTUBE_CHANNEL_ID        — CCW YouTube channel ID
 */

import { createReadStream } from 'fs';

/**
 * Build the YouTube video description from a video brief object.
 *
 * @param {Object} videoBrief
 * @returns {string}
 */
function buildDescription(videoBrief) {
  const chapters = videoBrief.chapters || videoBrief.youtube?.chapters || [];
  const chapterLines = chapters.map((c) => `${c.timestamp} ${c.title}`).join('\n');
  const chapterBlock = chapterLines ? `\n\n📖 Chapters:\n${chapterLines}` : '';

  return `${videoBrief.description || ''}${chapterBlock}`;
}

/**
 * Upload a rendered MP4 to the CCW YouTube channel.
 *
 * @param {string} videoPath - Absolute path to the rendered MP4
 * @param {Object} videoBrief - Video brief JSON with title, description, tags, chapters
 * @param {string} sessionId - Session ID for logging
 * @returns {Promise<string|null>} YouTube video ID, or null if upload is skipped/fails
 */
export async function uploadToYouTube(videoPath, videoBrief, sessionId) {
  const credsRaw = process.env.YOUTUBE_OAUTH_CREDENTIALS;

  if (!credsRaw) {
    console.log('[YouTube] YOUTUBE_OAUTH_CREDENTIALS not set — skipping upload');
    return null;
  }

  console.log(`[YouTube] Starting upload for session ${sessionId}`);
  console.log(`[YouTube] Video path: ${videoPath}`);

  try {
    // Lazy-load googleapis to avoid hard dependency in environments without it
    const { google } = await import('googleapis');

    const credentials = JSON.parse(credsRaw);

    const oauth2Client = new google.auth.OAuth2(credentials.client_id, credentials.client_secret);

    oauth2Client.setCredentials({
      access_token: credentials.access_token,
      refresh_token: credentials.refresh_token,
    });

    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    const description = buildDescription(videoBrief);

    console.log(`[YouTube] Uploading: "${videoBrief.title}"`);

    const response = await youtube.videos.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title: videoBrief.title,
          description,
          tags: videoBrief.tags || [],
          categoryId: '28', // Science & Technology
        },
        status: {
          privacyStatus: 'public',
        },
      },
      media: {
        mimeType: 'video/mp4',
        body: createReadStream(videoPath),
      },
    });

    const videoId = response.data.id;
    console.log(`[YouTube] Upload complete: https://youtu.be/${videoId}`);

    return videoId;
  } catch (err) {
    console.log(`[YouTube] Upload failed: ${err.message}`);
    return null;
  }
}
