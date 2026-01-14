/**
 * Facebook/Meta Adapter
 * Handles posting to Facebook Pages via Graph API
 * Note: Groups API was deprecated April 2024
 */

import {
    EngagementMetrics,
    OAuthTokens,
    PostContent,
    PostResult,
    RateLimiter,
    SocialCredentials,
    SocialMediaAdapter,
} from './types';

const GRAPH_API_VERSION = 'v20.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// Rate limit: 200 calls per hour per user
const rateLimiter = new RateLimiter(200, 60 * 60 * 1000);

export class FacebookAdapter implements SocialMediaAdapter {
  platform = 'Facebook' as const;
  
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor() {
    this.clientId = process.env.META_APP_ID || '';
    this.clientSecret = process.env.META_APP_SECRET || '';
    this.redirectUri = process.env.NEXT_PUBLIC_APP_URL 
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/facebook`
      : 'http://localhost:3001/api/auth/callback/facebook';
  }

  getAuthUrl(state: string): string {
    const scopes = [
      'pages_manage_posts',
      'pages_read_engagement',
      'pages_show_list',
      'public_profile',
    ].join(',');

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      state,
      scope: scopes,
      response_type: 'code',
    });

    return `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth?${params}`;
  }

  async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
    await rateLimiter.waitForSlot();

    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri,
      code,
    });

    const response = await fetch(
      `${GRAPH_API_BASE}/oauth/access_token?${params}`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Facebook OAuth error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();

    // Exchange for long-lived token
    const longLivedToken = await this.getLongLivedToken(data.access_token);

    return {
      accessToken: longLivedToken.access_token,
      expiresIn: longLivedToken.expires_in,
      tokenType: 'Bearer',
    };
  }

  private async getLongLivedToken(shortLivedToken: string): Promise<{ access_token: string; expires_in: number }> {
    await rateLimiter.waitForSlot();

    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      fb_exchange_token: shortLivedToken,
    });

    const response = await fetch(
      `${GRAPH_API_BASE}/oauth/access_token?${params}`
    );

    if (!response.ok) {
      throw new Error('Failed to exchange for long-lived token');
    }

    return response.json();
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    // Facebook long-lived tokens don't use refresh tokens
    // They need to be re-exchanged before expiry
    return this.getLongLivedToken(refreshToken).then(data => ({
      accessToken: data.access_token,
      expiresIn: data.expires_in,
      tokenType: 'Bearer',
    }));
  }

  async createPost(credentials: SocialCredentials, content: PostContent): Promise<PostResult> {
    await rateLimiter.waitForSlot();

    const pageId = credentials.pageId;
    if (!pageId) {
      return { success: false, error: 'Page ID required for Facebook posting' };
    }

    try {
      // Get page access token
      const pageToken = await this.getPageAccessToken(credentials.accessToken, pageId);

      const postData: Record<string, string> = {
        message: content.text,
        access_token: pageToken,
      };

      if (content.link) {
        postData.link = content.link;
      }

      if (content.scheduledTime) {
        postData.published = 'false';
        postData.scheduled_publish_time = Math.floor(content.scheduledTime.getTime() / 1000).toString();
      }

      const response = await fetch(`${GRAPH_API_BASE}/${pageId}/feed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postData),
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.error?.message || 'Post failed' };
      }

      const result = await response.json();
      return {
        success: true,
        platformPostId: result.id,
        url: `https://facebook.com/${result.id}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async getPageAccessToken(userToken: string, pageId: string): Promise<string> {
    await rateLimiter.waitForSlot();

    const response = await fetch(
      `${GRAPH_API_BASE}/${pageId}?fields=access_token&access_token=${userToken}`
    );

    if (!response.ok) {
      throw new Error('Failed to get page access token');
    }

    const data = await response.json();
    return data.access_token;
  }

  async getPostMetrics(credentials: SocialCredentials, postId: string): Promise<EngagementMetrics> {
    await rateLimiter.waitForSlot();

    const response = await fetch(
      `${GRAPH_API_BASE}/${postId}?fields=likes.summary(true),comments.summary(true),shares&access_token=${credentials.accessToken}`
    );

    if (!response.ok) {
      throw new Error('Failed to get post metrics');
    }

    const data = await response.json();
    return {
      likes: data.likes?.summary?.total_count || 0,
      comments: data.comments?.summary?.total_count || 0,
      shares: data.shares?.count || 0,
    };
  }

  async validateCredentials(credentials: SocialCredentials): Promise<boolean> {
    try {
      await rateLimiter.waitForSlot();

      const response = await fetch(
        `${GRAPH_API_BASE}/me?access_token=${credentials.accessToken}`
      );

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get list of pages the user manages
   */
  async getUserPages(userToken: string): Promise<{ id: string; name: string; accessToken: string }[]> {
    await rateLimiter.waitForSlot();

    const response = await fetch(
      `${GRAPH_API_BASE}/me/accounts?access_token=${userToken}`
    );

    if (!response.ok) {
      throw new Error('Failed to get user pages');
    }

    const data = await response.json();
    return data.data.map((page: { id: string; name: string; access_token: string }) => ({
      id: page.id,
      name: page.name,
      accessToken: page.access_token,
    }));
  }
}

export const facebookAdapter = new FacebookAdapter();
