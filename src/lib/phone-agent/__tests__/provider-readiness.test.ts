import { describe, expect, it } from 'vitest';
import {
  buildCanonicalTwilioWebhookUrl,
  getCcwPhoneAgentWebhookUrls,
  missingCcwPhoneAgentLiveKeys,
  signPhoneAgentWebhookPayload,
  verifyPhoneAgentWebhookSignature,
  verifyTwilioRequestSignature,
} from '../provider-readiness';
import { createHmac } from 'crypto';

describe('phone-agent provider readiness', () => {
  it('names every live key Toby still needs to provide', () => {
    const missing = missingCcwPhoneAgentLiveKeys({ NODE_ENV: 'test' });

    expect(missing).toContain('ELEVENLABS_API_KEY');
    expect(missing).toContain('TWILIO_AUTH_TOKEN');
    expect(missing).toContain('PHONE_AGENT_OWNER_USER_ID');
    expect(missing).toContain('PHONE_AGENT_PUBLIC_BASE_URL');
  });

  it('builds provider webhook URLs from the public base URL', () => {
    const urls = getCcwPhoneAgentWebhookUrls({
      NODE_ENV: 'test',
      PHONE_AGENT_PUBLIC_BASE_URL: 'https://crm.ccw.example/',
    });

    expect(urls.twilio_voice_url).toBe('https://crm.ccw.example/api/phone-agent/webhooks/twilio/voice');
    expect(urls.elevenlabs_callback_url).toBe(
      'https://crm.ccw.example/api/phone-agent/webhooks/elevenlabs/conversation'
    );
  });

  it('verifies Twilio signatures against sorted form parameters', () => {
    const authToken = 'test-token';
    const url = 'https://crm.ccw.example/api/phone-agent/webhooks/twilio/voice';
    const params = new URLSearchParams({ CallSid: 'CA123', From: '+61200000000' });
    const data = `${url}CallSidCA123From+61200000000`;
    const signature = createHmac('sha1', authToken).update(data).digest('base64');

    expect(verifyTwilioRequestSignature({ authToken, url, params, signature })).toBe(true);
    expect(verifyTwilioRequestSignature({ authToken, url, params, signature: 'bad' })).toBe(false);
  });

  it('verifies signed ElevenLabs callback payloads', () => {
    const payload = JSON.stringify({ transcript: 'hello' });
    const signature = signPhoneAgentWebhookPayload(payload, 'secret');

    expect(verifyPhoneAgentWebhookSignature({ payload, secret: 'secret', signature })).toBe(true);
    expect(verifyPhoneAgentWebhookSignature({ payload, secret: 'secret', signature: `sha256=${signature}` })).toBe(true);
    expect(verifyPhoneAgentWebhookSignature({ payload, secret: 'secret', signature: 'bad' })).toBe(false);
  });

  it('uses the configured public base URL for signature canonicalization', () => {
    const url = buildCanonicalTwilioWebhookUrl(
      'http://localhost:3000/api/phone-agent/webhooks/twilio/voice?x=1',
      { NODE_ENV: 'test', PHONE_AGENT_PUBLIC_BASE_URL: 'https://crm.ccw.example' }
    );

    expect(url).toBe('https://crm.ccw.example/api/phone-agent/webhooks/twilio/voice?x=1');
  });
});
