/**
 * Instagram Adapter
 * Handles posting to Instagram Business accounts via Graph API
 * Requires connection to Facebook Page
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

// Rate limit: 200 calls per hour per user, 25 posts per 24 hours
const rateLimiter = new RateLimiter(200, 60 * 60 * 1000);

export class InstagramAdapter implements SocialMediaAdapter {
  platform = 'Instagram' as const;

  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor() {
    this.clientId = process.env.META_APP_ID || '';
    this.clientSecret = process.env.META_APP_SECRET || '';
    this.redirectUri = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/instagram`
      : 'http://localhost:3001/api/auth/callback/instagram';
  }

  getAuthUrl(state: string): string {
    // Instagram uses Facebook OAuth with additional scopes
    const scopes = [
      'instagram_basic',
      'instagram_content_publish',
      'pages_show_list',
      'pages_read_engagement',
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
      throw new Error(`Instagram OAuth error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
      tokenType: 'Bearer',
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    await rateLimiter.waitForSlot();

    const params = new URLSearchParams({
      grant_type: 'ig_refresh_token',
      access_token: refreshToken,
    });

    const response = await fetch(
      `https://graph.instagram.com/refresh_access_token?${params}`
    );

    if (!response.ok) {
      throw new Error('Failed to refresh Instagram token');
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
      tokenType: 'Bearer',
    };
  }

  async createPost(credentials: SocialCredentials, content: PostContent): Promise<PostResult> {
    await rateLimiter.waitForSlot();

    const igAccountId = credentials.accountId;

    try {
      // Step 1: Create media container
      const containerId = await this.createMediaContainer(
        credentials.accessToken,
        igAccountId,
        content
      );

      // Step 2: Wait for container to be ready (for videos)
      if (content.mediaUrls?.some(url => this.isVideo(url))) {
        await this.waitForContainerReady(credentials.accessToken, containerId);
      }

      // Step 3: Publish the container
      const postId = await this.publishContainer(
        credentials.accessToken,
        igAccountId,
        containerId
      );

      return {
        success: true,
        platformPostId: postId,
        url: `https://instagram.com/p/${postId}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async createMediaContainer(
    accessToken: string,
    igAccountId: string,
    content: PostContent
  ): Promise<string> {
    await rateLimiter.waitForSlot();

    const caption = this.formatCaption(content);
    
    let containerData: Record<string, string> = {
      access_token: accessToken,
      caption,
    };

    if (content.mediaUrls && content.mediaUrls.length > 0) {
      const mediaUrl = content.mediaUrls[0];
      
      if (this.isVideo(mediaUrl)) {
        containerData.media_type = 'REELS';
        containerData.video_url = mediaUrl;
      } else {
        containerData.image_url = mediaUrl;
      }
    }

    const response = await fetch(`${GRAPH_API_BASE}/${igAccountId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(containerData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create media container: ${error.error?.message}`);
    }

    const data = await response.json();
    return data.id;
  }

  private async waitForContainerReady(accessToken: string, containerId: string): Promise<void> {
    const maxAttempts = 30;
    const delayMs = 5000;

    for (let i = 0; i < maxAttempts; i++) {
      await rateLimiter.waitForSlot();

      const response = await fetch(
        `${GRAPH_API_BASE}/${containerId}?fields=status_code&access_token=${accessToken}`
      );

      const data = await response.json();

      if (data.status_code === 'FINISHED') {
        return;
      }

      if (data.status_code === 'ERROR') {
        throw new Error('Media container processing failed');
      }

      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    throw new Error('Media container processing timed out');
  }

  private async publishContainer(
    accessToken: string,
    igAccountId: string,
    containerId: string
  ): Promise<string> {
    await rateLimiter.waitForSlot();

    const response = await fetch(`${GRAPH_API_BASE}/${igAccountId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: containerId,
        access_token: accessToken,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to publish: ${error.error?.message}`);
    }

    const data = await response.json();
    return data.id;
  }

  private formatCaption(content: PostContent): string {
    let caption = content.text;

    if (content.hashtags && content.hashtags.length > 0) {
      caption += '\n\n' + content.hashtags.map(tag => 
        tag.startsWith('#') ? tag : `#${tag}`
      ).join(' ');
    }

    return caption;
  }

  private isVideo(url: string): boolean {
    const videoExtensions = ['.mp4', '.mov', '.avi', '.webm'];
    return videoExtensions.some(ext => url.toLowerCase().includes(ext));
  }

  async getPostMetrics(credentials: SocialCredentials, postId: string): Promise<EngagementMetrics> {
    await rateLimiter.waitForSlot();

    const response = await fetch(
      `${GRAPH_API_BASE}/${postId}?fields=like_count,comments_count&access_token=${credentials.accessToken}`
    );

    if (!response.ok) {
      throw new Error('Failed to get post metrics');
    }

    const data = await response.json();
    return {
      likes: data.like_count || 0,
      comments: data.comments_count || 0,
      shares: 0, // Instagram doesn't expose share count
    };
  }

  async validateCredentials(credentials: SocialCredentials): Promise<boolean> {
    try {
      await rateLimiter.waitForSlot();

      const response = await fetch(
        `${GRAPH_API_BASE}/${credentials.accountId}?access_token=${credentials.accessToken}`
      );

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get Instagram Business Account ID linked to a Facebook Page
   */
  async getInstagramAccountId(pageId: string, pageAccessToken: string): Promise<string | null> {
    await rateLimiter.waitForSlot();

    const response = await fetch(
      `${GRAPH_API_BASE}/${pageId}?fields=instagram_business_account&access_token=${pageAccessToken}`
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.instagram_business_account?.id || null;
  }
}

export const instagramAdapter = new InstagramAdapter();
