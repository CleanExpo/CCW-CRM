/**
 * LinkedIn Adapter
 * Handles posting to LinkedIn Company Pages via Marketing API
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

const LINKEDIN_API_BASE = 'https://api.linkedin.com/rest';
const LINKEDIN_OAUTH_BASE = 'https://www.linkedin.com/oauth/v2';
const API_VERSION = '202401'; // YYYYMM format

// Rate limit: Standard API limits
const rateLimiter = new RateLimiter(100, 60 * 1000); // 100 per minute

export class LinkedInAdapter implements SocialMediaAdapter {
  platform = 'LinkedIn' as const;

  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor() {
    this.clientId = process.env.LINKEDIN_CLIENT_ID || '';
    this.clientSecret = process.env.LINKEDIN_CLIENT_SECRET || '';
    this.redirectUri = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/linkedin`
      : 'http://localhost:3001/api/auth/callback/linkedin';
  }

  getAuthUrl(state: string): string {
    const scopes = [
      'w_organization_social',
      'r_organization_social',
      'r_basicprofile',
    ].join(' ');

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      state,
      scope: scopes,
    });

    return `${LINKEDIN_OAUTH_BASE}/authorization?${params}`;
  }

  async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
    await rateLimiter.waitForSlot();

    const response = await fetch(`${LINKEDIN_OAUTH_BASE}/accessToken`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.redirectUri,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`LinkedIn OAuth error: ${error.error_description || 'Unknown error'}`);
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

    const response = await fetch(`${LINKEDIN_OAUTH_BASE}/accessToken`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh LinkedIn token');
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      tokenType: data.token_type,
    };
  }

  async createPost(credentials: SocialCredentials, content: PostContent): Promise<PostResult> {
    await rateLimiter.waitForSlot();

    const organizationUrn = credentials.accountId.startsWith('urn:li:organization:')
      ? credentials.accountId
      : `urn:li:organization:${credentials.accountId}`;

    try {
      const postBody = {
        author: organizationUrn,
        commentary: this.formatCommentary(content),
        visibility: 'PUBLIC',
        distribution: {
          feedDistribution: 'MAIN_FEED',
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        lifecycleState: 'PUBLISHED',
        isReshareDisabledByAuthor: false,
      };

      const response = await fetch(`${LINKEDIN_API_BASE}/posts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json',
          'LinkedIn-Version': API_VERSION,
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify(postBody),
      });

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          error: error.message || JSON.stringify(error),
        };
      }

      // LinkedIn returns the post URN in the x-restli-id header
      const postUrn = response.headers.get('x-restli-id') || '';
      const postId = postUrn.replace('urn:li:share:', '');

      return {
        success: true,
        platformPostId: postUrn,
        url: `https://linkedin.com/feed/update/${postUrn}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private formatCommentary(content: PostContent): string {
    let commentary = content.text;

    if (content.hashtags && content.hashtags.length > 0) {
      commentary += '\n\n' + content.hashtags.map(tag =>
        tag.startsWith('#') ? tag : `#${tag}`
      ).join(' ');
    }

    if (content.link) {
      commentary += `\n\n${content.link}`;
    }

    return commentary;
  }

  async getPostMetrics(credentials: SocialCredentials, postId: string): Promise<EngagementMetrics> {
    await rateLimiter.waitForSlot();

    // LinkedIn requires specific API calls for social actions
    const postUrn = postId.startsWith('urn:li:') ? postId : `urn:li:share:${postId}`;
    
    const response = await fetch(
      `${LINKEDIN_API_BASE}/socialActions/${encodeURIComponent(postUrn)}`,
      {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'LinkedIn-Version': API_VERSION,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to get LinkedIn post metrics');
    }

    const data = await response.json();
    return {
      likes: data.likesSummary?.totalLikes || 0,
      comments: data.commentsSummary?.totalFirstLevelComments || 0,
      shares: 0, // Requires separate API call
    };
  }

  async validateCredentials(credentials: SocialCredentials): Promise<boolean> {
    try {
      await rateLimiter.waitForSlot();

      const response = await fetch(`${LINKEDIN_API_BASE}/me`, {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'LinkedIn-Version': API_VERSION,
        },
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get organizations the user is an admin of
   */
  async getUserOrganizations(accessToken: string): Promise<{ id: string; name: string }[]> {
    await rateLimiter.waitForSlot();

    const response = await fetch(
      `${LINKEDIN_API_BASE}/organizationAcls?q=roleAssignee&role=ADMINISTRATOR`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'LinkedIn-Version': API_VERSION,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      }
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    
    // Fetch organization details
    const orgs: { id: string; name: string }[] = [];
    
    for (const acl of data.elements || []) {
      const orgUrn = acl.organization;
      const orgId = orgUrn.replace('urn:li:organization:', '');
      
      const orgResponse = await fetch(
        `${LINKEDIN_API_BASE}/organizations/${orgId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'LinkedIn-Version': API_VERSION,
          },
        }
      );

      if (orgResponse.ok) {
        const orgData = await orgResponse.json();
        orgs.push({
          id: orgId,
          name: orgData.localizedName || orgData.name,
        });
      }
    }

    return orgs;
  }
}

export const linkedinAdapter = new LinkedInAdapter();
