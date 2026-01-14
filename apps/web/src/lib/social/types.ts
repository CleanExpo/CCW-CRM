/**
 * Social Media Adapter - Base Interface and Types
 * Unified interface for all social media platform integrations
 */

export type SocialPlatform = 'Facebook' | 'Instagram' | 'LinkedIn' | 'Reddit';

export interface SocialCredentials {
  accessToken: string;
  refreshToken?: string;
  tokenExpiry?: Date;
  accountId: string;
  pageId?: string; // For Facebook/Instagram
}

export interface PostContent {
  text: string;
  mediaUrls?: string[];
  hashtags?: string[];
  link?: string;
  scheduledTime?: Date;
}

export interface PostResult {
  success: boolean;
  platformPostId?: string;
  error?: string;
  url?: string;
}

export interface EngagementMetrics {
  likes: number;
  comments: number;
  shares: number;
  impressions?: number;
}

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType?: string;
}

/**
 * Base interface for all social media adapters
 */
export interface SocialMediaAdapter {
  platform: SocialPlatform;
  
  /**
   * Get the OAuth authorization URL
   */
  getAuthUrl(state: string): string;
  
  /**
   * Exchange authorization code for access tokens
   */
  exchangeCodeForTokens(code: string): Promise<OAuthTokens>;
  
  /**
   * Refresh an expired access token
   */
  refreshAccessToken(refreshToken: string): Promise<OAuthTokens>;
  
  /**
   * Post content to the platform
   */
  createPost(credentials: SocialCredentials, content: PostContent): Promise<PostResult>;
  
  /**
   * Get engagement metrics for a post
   */
  getPostMetrics(credentials: SocialCredentials, postId: string): Promise<EngagementMetrics>;
  
  /**
   * Verify if credentials are still valid
   */
  validateCredentials(credentials: SocialCredentials): Promise<boolean>;
}

/**
 * Rate limiter for API calls
 */
export class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  async waitForSlot(): Promise<void> {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.windowMs - (now - oldestRequest);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.requests.push(Date.now());
  }
}

/**
 * Encrypt/decrypt tokens for storage
 */
export function encryptToken(token: string): string {
  // In production, use proper encryption (e.g., AES-256-GCM with a secret key)
  // For now, base64 encode (NOT SECURE - replace in production)
  return Buffer.from(token).toString('base64');
}

export function decryptToken(encrypted: string): string {
  // Corresponding decryption
  return Buffer.from(encrypted, 'base64').toString('utf-8');
}

export { };
