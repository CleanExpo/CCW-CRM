/**
 * Social Media Manager
 * Unified interface for managing all social media integrations
 */

import { facebookAdapter } from './facebook';
import { instagramAdapter } from './instagram';
import { linkedinAdapter } from './linkedin';
import { redditAdapter } from './reddit';
import {
    OAuthTokens,
    PostContent,
    PostResult,
    SocialCredentials,
    SocialMediaAdapter,
    SocialPlatform,
} from './types';

// Platform adapter registry
const adapters: Record<SocialPlatform, SocialMediaAdapter> = {
  Facebook: facebookAdapter,
  Instagram: instagramAdapter,
  LinkedIn: linkedinAdapter,
  Reddit: redditAdapter,
};

/**
 * Get adapter for a specific platform
 */
export function getAdapter(platform: SocialPlatform): SocialMediaAdapter {
  const adapter = adapters[platform];
  if (!adapter) {
    throw new Error(`No adapter found for platform: ${platform}`);
  }
  return adapter;
}

/**
 * Get OAuth authorization URL for a platform
 */
export function getAuthUrl(platform: SocialPlatform, state: string): string {
  return getAdapter(platform).getAuthUrl(state);
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  platform: SocialPlatform,
  code: string
): Promise<OAuthTokens> {
  return getAdapter(platform).exchangeCodeForTokens(code);
}

/**
 * Create a post on a platform
 */
export async function createPost(
  platform: SocialPlatform,
  credentials: SocialCredentials,
  content: PostContent
): Promise<PostResult> {
  return getAdapter(platform).createPost(credentials, content);
}

/**
 * Create posts across multiple platforms
 */
export async function createMultiPlatformPost(
  platforms: { platform: SocialPlatform; credentials: SocialCredentials }[],
  content: PostContent
): Promise<{ platform: SocialPlatform; result: PostResult }[]> {
  const results = await Promise.all(
    platforms.map(async ({ platform, credentials }) => {
      const result = await createPost(platform, credentials, content);
      return { platform, result };
    })
  );

  return results;
}

/**
 * Validate credentials for a platform
 */
export async function validateCredentials(
  platform: SocialPlatform,
  credentials: SocialCredentials
): Promise<boolean> {
  return getAdapter(platform).validateCredentials(credentials);
}

/**
 * Refresh access token for a platform
 */
export async function refreshToken(
  platform: SocialPlatform,
  refreshToken: string
): Promise<OAuthTokens> {
  return getAdapter(platform).refreshAccessToken(refreshToken);
}

// Re-export types and adapters
export { facebookAdapter } from './facebook';
export { instagramAdapter } from './instagram';
export { linkedinAdapter } from './linkedin';
export { redditAdapter } from './reddit';
export * from './types';

