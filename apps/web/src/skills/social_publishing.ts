/**
 * Social Publishing Skill
 * Enables agents to publish content to connected social media platforms
 */

import {
    createMultiPlatformPost,
    PostContent,
    SocialCredentials,
    SocialPlatform,
} from '@/src/lib/social';
import { getSupabaseAdmin, SocialConnection } from '@/src/lib/supabase';
import { tool } from '@openai/agents';
import { z } from 'zod';

/**
 * Publish to Social Media Tool
 * Creates and publishes a post to selected social platforms
 */
export const publishToSocialTool = tool({
  name: 'publish_to_social',
  description: 'Publish content to connected social media platforms (Facebook Page, LinkedIn, Instagram, Reddit). Requires HITL approval before actual publishing.',
  parameters: z.object({
    content: z.string().describe('The post content/text'),
    platforms: z.array(z.enum(['Facebook', 'Instagram', 'LinkedIn', 'Reddit'])).describe('Target platforms'),
    hashtags: z.array(z.string()).optional().describe('Hashtags to include'),
    mediaUrl: z.string().optional().describe('URL to attached media (image/video)'),
    requiresApproval: z.boolean().default(true).describe('Whether to require HITL approval'),
    subreddit: z.string().optional().describe('Target subreddit for Reddit posts'),
  }),
  execute: async ({ content, platforms, hashtags, mediaUrl, requiresApproval, subreddit }) => {
    const supabase = getSupabaseAdmin();

    // Get active connections for requested platforms
    const { data: connections, error: connError } = await supabase
      .from('social_connections')
      .select('*')
      .in('platform', platforms)
      .eq('is_active', true);

    if (connError || !connections || connections.length === 0) {
      return {
        success: false,
        error: 'No active social media connections found for requested platforms',
        suggestion: 'Please connect accounts via the Social Media Hub dashboard',
      };
    }

    const postContent: PostContent = {
      text: content,
      hashtags: hashtags || [],
      mediaUrls: mediaUrl ? [mediaUrl] : [],
    };

    // If requires approval, create draft posts for HITL review
    if (requiresApproval) {
      const posts = connections.map((conn: SocialConnection) => ({
        connection_id: conn.id,
        content,
        hashtags: hashtags || [],
        media_urls: mediaUrl ? [mediaUrl] : null,
        status: 'PendingApproval' as const,
        target_community: conn.platform === 'Reddit' ? subreddit : null,
      }));

      const { data: createdPosts, error: createError } = await supabase
        .from('social_posts')
        .insert(posts)
        .select();

      if (createError) {
        return {
          success: false,
          error: `Failed to create draft posts: ${createError.message}`,
        };
      }

      return {
        success: true,
        requiresApproval: true,
        message: `Created ${createdPosts?.length || 0} posts pending approval`,
        postIds: createdPosts?.map((p: { id: string }) => p.id) || [],
        platforms: platforms,
        hitlRequired: true,
        hitlMessage: 'Posts have been queued for Human-in-the-Loop approval in the Social Media Hub',
      };
    }

    // Direct publish (no approval required)
    const platformCredentials = connections.map((conn: SocialConnection) => ({
      platform: conn.platform as SocialPlatform,
      credentials: {
        accessToken: conn.access_token,
        refreshToken: conn.refresh_token || undefined,
        accountId: conn.account_id,
        pageId: conn.page_id || undefined,
      } as SocialCredentials,
    }));

    const results = await createMultiPlatformPost(platformCredentials, postContent);

    // Store results in database
    for (const result of results) {
      const conn = connections.find((c: SocialConnection) => c.platform === result.platform);
      if (conn) {
        await supabase.from('social_posts').insert({
          connection_id: conn.id,
          content,
          hashtags: hashtags || [],
          media_urls: mediaUrl ? [mediaUrl] : null,
          status: result.result.success ? 'Published' : 'Failed',
          platform_post_id: result.result.platformPostId,
          published_at: result.result.success ? new Date().toISOString() : null,
          error_message: result.result.error,
        });
      }
    }

    const successCount = results.filter(r => r.result.success).length;
    const failedCount = results.filter(r => !r.result.success).length;

    return {
      success: successCount > 0,
      message: `Published to ${successCount} platforms${failedCount > 0 ? `, ${failedCount} failed` : ''}`,
      results: results.map(r => ({
        platform: r.platform,
        success: r.result.success,
        url: r.result.url,
        error: r.result.error,
      })),
    };
  },
});

/**
 * Get Connected Platforms Tool
 * Lists all connected social media accounts
 */
export const getConnectedPlatformsTool = tool({
  name: 'get_connected_platforms',
  description: 'Get list of connected social media platforms and their status',
  parameters: z.object({}),
  execute: async () => {
    const supabase = getSupabaseAdmin();

    const { data: connections, error } = await supabase
      .from('social_connections')
      .select('id, platform, account_name, is_active, token_expiry');

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    const platforms = (connections || []).map((conn: {
      id: string;
      platform: string;
      account_name: string;
      is_active: boolean;
      token_expiry: string | null;
    }) => ({
      platform: conn.platform,
      accountName: conn.account_name,
      isActive: conn.is_active,
      tokenExpired: conn.token_expiry ? new Date(conn.token_expiry) < new Date() : false,
    }));

    return {
      success: true,
      connections: platforms,
      summary: {
        total: platforms.length,
        active: platforms.filter((p: { isActive: boolean }) => p.isActive).length,
        expired: platforms.filter((p: { tokenExpired: boolean }) => p.tokenExpired).length,
      },
    };
  },
});

/**
 * Schedule Social Post Tool
 * Schedules a post for future publishing
 */
export const scheduleSocialPostTool = tool({
  name: 'schedule_social_post',
  description: 'Schedule a social media post for future publishing',
  parameters: z.object({
    content: z.string().describe('The post content/text'),
    platforms: z.array(z.enum(['Facebook', 'Instagram', 'LinkedIn', 'Reddit'])).describe('Target platforms'),
    scheduledFor: z.string().describe('ISO datetime for when to publish'),
    hashtags: z.array(z.string()).optional().describe('Hashtags to include'),
    mediaUrl: z.string().optional().describe('URL to attached media'),
  }),
  execute: async ({ content, platforms, scheduledFor, hashtags, mediaUrl }) => {
    const supabase = getSupabaseAdmin();

    const { data: connections, error: connError } = await supabase
      .from('social_connections')
      .select('*')
      .in('platform', platforms)
      .eq('is_active', true);

    if (connError || !connections || connections.length === 0) {
      return {
        success: false,
        error: 'No active connections found',
      };
    }

    const posts = connections.map((conn: SocialConnection) => ({
      connection_id: conn.id,
      content,
      hashtags: hashtags || [],
      media_urls: mediaUrl ? [mediaUrl] : null,
      status: 'Scheduled' as const,
      scheduled_for: scheduledFor,
    }));

    const { data: createdPosts, error: createError } = await supabase
      .from('social_posts')
      .insert(posts)
      .select();

    if (createError) {
      return {
        success: false,
        error: createError.message,
      };
    }

    return {
      success: true,
      message: `Scheduled ${createdPosts?.length || 0} posts for ${new Date(scheduledFor).toLocaleString()}`,
      postIds: createdPosts?.map((p: { id: string }) => p.id) || [],
      scheduledFor,
    };
  },
});

/**
 * Get Target Subreddits Tool
 * Lists configured target subreddits for industry engagement
 */
export const getTargetSubredditsTool = tool({
  name: 'get_target_subreddits',
  description: 'Get list of target subreddits for industry engagement',
  parameters: z.object({
    activeOnly: z.boolean().default(true).describe('Only return active communities'),
  }),
  execute: async ({ activeOnly }) => {
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('target_communities')
      .select('*')
      .eq('platform', 'Reddit');

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      subreddits: data?.map((sub: {
        community_id: string;
        name: string;
        description: string | null;
        last_posted: string | null;
      }) => ({
        name: sub.community_id,
        displayName: sub.name,
        description: sub.description,
        lastPosted: sub.last_posted,
      })) || [],
    };
  },
});

// Export all tools
export const socialPublishingTools = [
  publishToSocialTool,
  getConnectedPlatformsTool,
  scheduleSocialPostTool,
  getTargetSubredditsTool,
];
