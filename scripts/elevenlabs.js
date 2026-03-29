/**
 * CCW Boardroom — ElevenLabs CEO Voice Generation Module (UNI-1667)
 *
 * Generates Australian Male CEO narration MP3 from boardroom Video Brief script.
 * Called after Video Director produces VIDEO_BRIEF JSON.
 *
 * CEO must confirm ELEVENLABS_VOICE_ID before go-live.
 * Recommended: test Daniel (AU), William (AU), or similar from ElevenLabs voice library.
 */

import fs from 'fs/promises';
import path from 'path';

const DEFAULT_OUTPUT_DIR = process.env.VIDEO_OUTPUT_DIR || './data/sessions';

/**
 * Voice settings for CEO narration — professional, warm, authoritative.
 * Tuned for 8-minute YouTube scripts.
 */
const VOICE_SETTINGS = {
  stability: 0.75,          // Consistent delivery across long scripts
  similarity_boost: 0.85,   // Stays true to the selected voice
  style: 0.45,              // Professional but warm — not robotic
  use_speaker_boost: true,  // Enhances clarity
};

/**
 * Generate CEO narration MP3 from script text.
 *
 * @param {string} script - CEO narration script from Video Brief
 * @param {string} sessionId - Session ID for output file path
 * @param {string} [outputDir] - Override output directory
 * @returns {Promise<string>} Absolute path to generated MP3 file
 * @throws {Error} If API keys missing or generation fails
 */
export async function generateCEONarration(script, sessionId, outputDir = DEFAULT_OUTPUT_DIR) {
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!voiceId || !apiKey) {
    throw new Error(
      '[ElevenLabs] Missing env vars: ELEVENLABS_VOICE_ID and/or ELEVENLABS_API_KEY. ' +
        'CEO must confirm voice ID at elevenlabs.io/voice-library and set both vars in Vercel.'
    );
  }

  console.log(`[ElevenLabs] Generating CEO narration for session ${sessionId}...`);
  console.log(`[ElevenLabs] Voice ID: ${voiceId} | Script length: ${script.length} chars`);

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: script,
      model_id: 'eleven_turbo_v2_5', // Fast, high quality — ideal for 8-min scripts
      voice_settings: VOICE_SETTINGS,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`[ElevenLabs] Generation failed ${response.status}: ${errorText}`);
  }

  const audioBuffer = await response.arrayBuffer();
  const outputPath = path.join(outputDir, sessionId, 'ceo-narration.mp3');

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, Buffer.from(audioBuffer));

  const fileSizeKb = Math.round(audioBuffer.byteLength / 1024);
  console.log(`[ElevenLabs] Narration written to ${outputPath} (${fileSizeKb}KB) ✅`);

  return outputPath;
}

/**
 * Validate ElevenLabs credentials without generating audio.
 * Useful in pre-flight checks.
 *
 * @returns {Promise<boolean>} True if credentials are valid
 */
export async function validateElevenLabsCredentials() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return false;

  try {
    const res = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': apiKey },
    });
    return res.ok;
  } catch {
    return false;
  }
}
