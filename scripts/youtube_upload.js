/**
 * CCW Boardroom — YouTube Auto-Upload Pipeline (UNI-1670)
 *
 * After Remotion renders the MP4, uploads to CCW YouTube channel with
 * correct metadata, chapters, and tags from the Video Brief JSON.
 *
 * Required env vars (set in Vercel):
 *   YOUTUBE_OAUTH_CREDENTIALS — JSON string of OAuth2 credentials
 *   YOUTUBE_CHANNEL_ID — CCW YouTube channel ID
 *   YOUTUBE_API_KEY — Google API key for VideoObject schema push
 */

import { createReadStream } from 'fs';

/**
 * Upload rendered MP4 to CCW YouTube channel.
 *
 * @param {string} videoPath - Absolute path to rendered MP4 file
 * @param {Object} videoBrief - VIDEO_BRIEF JSON from Video Director
 * @param {string} sessionId - Session ID for logging
 * @returns {Promise<string>} YouTube video ID
 */
export async function uploadToYouTube(videoPath, videoBrief, sessionId) {
  const credsRaw = process.env.YOUTUBE_OAUTH_CREDENTIALS;
  if (!credsRaw) {
    throw new Error(
      '[YouTube] Missing YOUTUBE_OAUTH_CREDENTIALS. ' +
        'CEO must complete YouTube OAuth signup and set env var in Vercel.'
    );
  }

  console.log(`[YouTube] Uploading video for session ${sessionId}...`);

  // Lazy-load googleapis to avoid import issues in demo mode
  const { google } = await import('googleapis');

  const credentials = JSON.parse(credsRaw);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/youtube.upload'],
  });

  const youtube = google.youtube({ version: 'v3', auth });
  const description = buildVideoDescription(videoBrief);

  const response = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title: videoBrief.title,
        description,
        tags: videoBrief.tags || [],
        categoryId: '28', // Science & Technology
        defaultLanguage: 'en-AU',
      },
      status: { privacyStatus: 'public' },
    },
    media: {
      mimeType: 'video/mp4',
      body: createReadStream(videoPath),
    },
  });

  const videoId = response.data.id;
  console.log(`[YouTube] Uploaded successfully: https://youtu.be/${videoId} ✅`);

  // Push VideoObject schema to CCW website if endpoint configured
  if (process.env.CCW_CONSOLE_URL && process.env.CCW_CONSOLE_API_KEY) {
    await pushVideoObjectSchema(videoId, videoBrief);
  } else {
    console.warn('[YouTube] CCW_CONSOLE_URL not set — skipping VideoObject schema push');
  }

  return videoId;
}

/**
 * Build YouTube video description from Video Brief.
 * Includes chapters, CCW about section, and hashtags.
 *
 * @param {Object} brief - Video Brief JSON
 * @returns {string} Formatted description
 */
function buildVideoDescription(brief) {
  const chapters =
    brief.youtube?.chapters?.map((c) => `${c.timestamp} — ${c.title}`).join('\n') || '';

  const tags = (brief.tags || [])
    .map((t) => '#' + t.replace(/\s/g, ''))
    .join(' ');

  return `${brief.description || ''}

${chapters ? `Timestamps:\n${chapters}\n` : ''}
⚙️ ABOUT CCW:
CCW (Carpet Cleaners Warehouse) is the AI-powered development engine for trades businesses across Australia and New Zealand.
Learn more: https://www.carpetcleanerswarehouse.com.au

🔗 THE UNITE-GROUP NEXUS:
• RestoreAssist — SaaS for Restoration Operators
• NRPG — Vetted Contractor Network
• CARSI — Online Training for Trades

${tags}`;
}

/**
 * Push VideoObject JSON-LD schema to CCW website.
 *
 * @param {string} videoId - YouTube video ID
 * @param {Object} brief - Video Brief JSON
 */
async function pushVideoObjectSchema(videoId, brief) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: brief.title,
    description: brief.description,
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    uploadDate: new Date().toISOString(),
    duration: brief.duration_iso || 'PT8M',
    contentUrl: `https://www.youtube.com/watch?v=${videoId}`,
    embedUrl: `https://www.youtube.com/embed/${videoId}`,
    publisher: {
      '@type': 'Organization',
      name: 'CCW — Carpet Cleaners Warehouse',
      url: 'https://www.carpetcleanerswarehouse.com.au',
    },
  };

  const res = await fetch(`${process.env.CCW_CONSOLE_URL}/api/schema/video`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.CCW_CONSOLE_API_KEY}`,
    },
    body: JSON.stringify({ videoId, schema }),
  });

  if (res.ok) {
    console.log('[YouTube] VideoObject schema pushed to CCW website ✅');
  } else {
    console.warn(`[YouTube] VideoObject schema push failed: ${res.status}`);
  }
}
