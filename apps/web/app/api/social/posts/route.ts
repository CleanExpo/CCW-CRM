import { createMultiPlatformPost, PostContent, SocialCredentials, SocialPlatform } from '@/src/lib/social';
import { getSupabaseClient } from '@/src/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/social/posts - Get all scheduled/published posts
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get('status');
  const platform = searchParams.get('platform');

  const supabase = getSupabaseClient();
  
  let query = supabase
    .from('social_posts')
    .select(`
      *,
      connection:social_connections(platform, account_name)
    `)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  if (platform) {
    query = query.eq('connection.platform', platform);
  }

  const { data, error } = await query.limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    posts: data || [],
    total: data?.length || 0,
  });
}

// POST /api/social/posts - Create and optionally publish a post
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      content,
      platforms,
      hashtags,
      mediaUrls,
      scheduledFor,
      publishNow,
    } = body;

    if (!content || !platforms || platforms.length === 0) {
      return NextResponse.json(
        { error: 'content and platforms are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // Get connections for requested platforms
    const { data: connections, error: connError } = await supabase
      .from('social_connections')
      .select('*')
      .in('platform', platforms)
      .eq('is_active', true);

    if (connError || !connections || connections.length === 0) {
      return NextResponse.json(
        { error: 'No active connections found for requested platforms' },
        { status: 400 }
      );
    }

    const postContent: PostContent = {
      text: content,
      hashtags: hashtags || [],
      mediaUrls: mediaUrls || [],
    };

    // Create post records
    const posts = connections.map(conn => ({
      connection_id: conn.id,
      content,
      hashtags: hashtags || [],
      media_urls: mediaUrls || [],
      status: publishNow ? 'Publishing' : scheduledFor ? 'Scheduled' : 'Draft',
      scheduled_for: scheduledFor || null,
    }));

    const { data: createdPosts, error: createError } = await supabase
      .from('social_posts')
      .insert(posts)
      .select();

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    // If publishNow, actually publish
    if (publishNow) {
      const platformCredentials = connections.map(conn => ({
        platform: conn.platform as SocialPlatform,
        credentials: {
          accessToken: conn.access_token,
          refreshToken: conn.refresh_token,
          accountId: conn.account_id,
          pageId: conn.page_id,
        } as SocialCredentials,
      }));

      const results = await createMultiPlatformPost(platformCredentials, postContent);

      // Update posts with results
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const post = createdPosts?.[i];
        
        if (post) {
          await supabase
            .from('social_posts')
            .update({
              status: result.result.success ? 'Published' : 'Failed',
              platform_post_id: result.result.platformPostId,
              published_at: result.result.success ? new Date().toISOString() : null,
              error_message: result.result.error,
            })
            .eq('id', post.id);
        }
      }

      return NextResponse.json({
        success: true,
        posts: createdPosts,
        publishResults: results,
      }, { status: 201 });
    }

    return NextResponse.json({
      success: true,
      posts: createdPosts,
    }, { status: 201 });

  } catch (error) {
    console.error('Failed to create post:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PATCH /api/social/posts - Update a post (approve, reject, reschedule)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, action, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Post ID required' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // Handle approval workflow
    if (action === 'approve') {
      const { error } = await supabase
        .from('social_posts')
        .update({ status: 'Approved' })
        .eq('id', id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'Post approved' });
    }

    if (action === 'reject') {
      const { error } = await supabase
        .from('social_posts')
        .update({ 
          status: 'Draft',
          error_message: updates.reason || 'Rejected by reviewer',
        })
        .eq('id', id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'Post rejected' });
    }

    // General update
    const { error } = await supabase
      .from('social_posts')
      .update(updates)
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Failed to update post:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
