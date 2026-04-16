/**
 * CCW Video Production Pipeline — ElevenLabs TTS Narration Generator (UNI-1672)
 *
 * Generates CEO narration MP3 from script text using the ElevenLabs v1 API.
 * Called by the video pipeline orchestrator after script generation.
 *
 * Env vars:
 *   ELEVENLABS_API_KEY   — ElevenLabs API key
 *   ELEVENLABS_VOICE_ID  — Voice ID (default: 21m00Tcm4TlvDq8ikWAM = Rachel)
 */

import fs from 'fs/promises';
import path from 'path';

const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel
const CHUNK_SIZE_LIMIT = 2500;

/**
 * Split a long script into sentence-boundary chunks under CHUNK_SIZE_LIMIT chars.
 *
 * @param {string} script
 * @returns {string[]}
 */
function splitIntoChunks(script) {
  if (script.length <= CHUNK_SIZE_LIMIT) return [script];

  const sentences = script.split('. ');
  const chunks = [];
  let current = '';

  for (const sentence of sentences) {
    const candidate = current ? current + '. ' + sentence : sentence;
    if (candidate.length > CHUNK_SIZE_LIMIT && current) {
      chunks.push(current);
      current = sentence;
    } else {
      current = candidate;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

/**
 * Call the ElevenLabs TTS API for a single text chunk.
 *
 * @param {string} text
 * @param {string} voiceId
 * @param {string} apiKey
 * @returns {Promise<ArrayBuffer>}
 */
async function callElevenLabsAPI(text, voiceId, apiKey) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_monolingual_v1',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.5,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`[ElevenLabs] API error ${response.status}: ${errorText}`);
  }

  return response.arrayBuffer();
}

/**
 * Generate CEO narration MP3 from script text.
 *
 * For scripts longer than 2500 chars, splits on sentence boundaries and
 * concatenates the resulting audio buffers into a single MP3.
 *
 * @param {string} script - Narration script text
 * @param {string} sessionId - Session ID used to build the output path
 * @returns {Promise<string|null>} Absolute path to generated MP3, or null on failure
 */
export async function generateCEONarration(script, sessionId) {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    console.log('[ElevenLabs] ELEVENLABS_API_KEY not set — skipping narration');
    return null;
  }

  const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
  const outputPath = path.join('data', 'sessions', sessionId, 'narration.mp3');

  console.log(`[ElevenLabs] Generating narration for session ${sessionId}`);
  console.log(`[ElevenLabs] Voice ID: ${voiceId} | Script length: ${script.length} chars`);

  try {
    const chunks = splitIntoChunks(script);
    console.log(`[ElevenLabs] Processing ${chunks.length} chunk(s)`);

    const buffers = [];
    for (let i = 0; i < chunks.length; i++) {
      console.log(
        `[ElevenLabs] Rendering chunk ${i + 1}/${chunks.length} (${chunks[i].length} chars)`
      );
      const audioBuffer = await callElevenLabsAPI(chunks[i], voiceId, apiKey);
      buffers.push(Buffer.from(audioBuffer));
    }

    const combined = Buffer.concat(buffers);

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, combined);

    const fileSizeKb = Math.round(combined.byteLength / 1024);
    console.log(`[ElevenLabs] Narration written to ${outputPath} (${fileSizeKb} KB)`);

    return outputPath;
  } catch (err) {
    console.log(`[ElevenLabs] Generation failed: ${err.message}`);
    return null;
  }
}
