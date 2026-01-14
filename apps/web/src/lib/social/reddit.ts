/**
 * Reddit Adapter
 * Handles posting to subreddits via Reddit API
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

const REDDIT_API_BASE = 'https://oauth.reddit.com';
const REDDIT_AUTH_BASE = 'https://www.reddit.com';

// Rate limit: 100 requests per minute for OAuth clients
const rateLimiter = new RateLimiter(100, 60 * 1000);

export class RedditAdapter implements SocialMediaAdapter {
  platform = 'Reddit' as const;

  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private userAgent: string;

  constructor() {
    this.clientId = process.env.REDDIT_CLIENT_ID || '';
    this.clientSecret = process.env.REDDIT_CLIENT_SECRET || '';
    this.redirectUri = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/reddit`
      : 'http://localhost:3001/api/auth/callback/reddit';
    this.userAgent = 'CCW-Digital-Hub/1.0.0';
  }

  getAuthUrl(state: string): string {
    const scopes = [
      'identity',
      'submit',
      'read',
      'mysubreddits',
      'flair',
    ].join(' ');

    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      state,
      redirect_uri: this.redirectUri,
      duration: 'permanent',
      scope: scopes,
    });

    return `${REDDIT_AUTH_BASE}/api/v1/authorize?${params}`;
  }

  async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
    await rateLimiter.waitForSlot();

    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const response = await fetch(`${REDDIT_AUTH_BASE}/api/v1/access_token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': this.userAgent,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Reddit OAuth error: ${error.error || 'Unknown error'}`);
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      tokenType: data.token_type,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    await rateLimiter.waitForSlot();

    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const response = await fetch(`${REDDIT_AUTH_BASE}/api/v1/access_token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': this.userAgent,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh Reddit token');
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresIn: data.expires_in,
      tokenType: data.token_type,
    };
  }

  async createPost(credentials: SocialCredentials, content: PostContent): Promise<PostResult> {
    await rateLimiter.waitForSlot();

    // Target community should be set in the content or credentials
    const subreddit = (content as PostContent & { subreddit?: string }).subreddit || 
                      credentials.pageId || // Using pageId as subreddit storage
                      'test';

    try {
      const postData: Record<string, string> = {
        sr: subreddit,
        title: this.extractTitle(content.text),
        kind: content.link ? 'link' : 'self',
        api_type: 'json',
      };

      if (content.link) {
        postData.url = content.link;
      } else {
        postData.text = content.text;
      }

      const response = await fetch(`${REDDIT_API_BASE}/api/submit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': this.userAgent,
        },
        body: new URLSearchParams(postData),
      });

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          error: error.message || JSON.stringify(error),
        };
      }

      const data = await response.json();
      
      if (data.json?.errors?.length > 0) {
        return {
          success: false,
          error: data.json.errors.map((e: string[]) => e.join(': ')).join(', '),
        };
      }

      const postUrl = data.json?.data?.url;
      const postId = data.json?.data?.id;

      return {
        success: true,
        platformPostId: postId,
        url: postUrl,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private extractTitle(text: string): string {
    // Extract first line or first 300 characters as title
    const firstLine = text.split('\n')[0];
    return firstLine.length > 300 ? firstLine.substring(0, 297) + '...' : firstLine;
  }

  async getPostMetrics(credentials: SocialCredentials, postId: string): Promise<EngagementMetrics> {
    await rateLimiter.waitForSlot();

    const response = await fetch(
      `${REDDIT_API_BASE}/api/info?id=t3_${postId}`,
      {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'User-Agent': this.userAgent,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to get Reddit post metrics');
    }

    const data = await response.json();
    const post = data.data?.children?.[0]?.data;

    if (!post) {
      throw new Error('Post not found');
    }

    return {
      likes: post.ups || 0,
      comments: post.num_comments || 0,
      shares: 0, // Reddit doesn't have shares
    };
  }

  async validateCredentials(credentials: SocialCredentials): Promise<boolean> {
    try {
      await rateLimiter.waitForSlot();

      const response = await fetch(`${REDDIT_API_BASE}/api/v1/me`, {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'User-Agent': this.userAgent,
        },
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get user's subscribed subreddits
   */
  async getUserSubreddits(accessToken: string): Promise<{ name: string; subscribers: number }[]> {
    await rateLimiter.waitForSlot();

    const response = await fetch(`${REDDIT_API_BASE}/subreddits/mine/subscriber?limit=100`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': this.userAgent,
      },
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return (data.data?.children || []).map((sub: { data: { display_name: string; subscribers: number } }) => ({
      name: sub.data.display_name,
      subscribers: sub.data.subscribers,
    }));
  }

  /**
   * Get subreddit rules (for validation before posting)
   */
  async getSubredditRules(accessToken: string, subreddit: string): Promise<string[]> {
    await rateLimiter.waitForSlot();

    const response = await fetch(`${REDDIT_API_BASE}/r/${subreddit}/about/rules`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': this.userAgent,
      },
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return (data.rules || []).map((rule: { short_name: string }) => rule.short_name);
  }

  /**
   * Check if user can post to a subreddit
   */
  async canPostToSubreddit(accessToken: string, subreddit: string): Promise<boolean> {
    await rateLimiter.waitForSlot();

    const response = await fetch(`${REDDIT_API_BASE}/r/${subreddit}/about`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': this.userAgent,
      },
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    // Check if submissions are restricted
    return !data.data?.restrict_posting && !data.data?.quarantine;
  }
}

export const redditAdapter = new RedditAdapter();
