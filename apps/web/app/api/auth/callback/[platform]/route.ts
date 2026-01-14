import { exchangeCodeForTokens, SocialPlatform } from '@/src/lib/social';
import { getSupabaseAdmin } from '@/src/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/auth/callback/[platform] - OAuth callback handler
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params;
  const searchParams = request.nextUrl.searchParams;
  
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // Handle OAuth errors
  if (error) {
    const errorUrl = new URL('/dashboard/social', request.url);
    errorUrl.searchParams.set('error', errorDescription || error);
    return NextResponse.redirect(errorUrl);
  }

  if (!code || !state) {
    const errorUrl = new URL('/dashboard/social', request.url);
    errorUrl.searchParams.set('error', 'Missing authorization code or state');
    return NextResponse.redirect(errorUrl);
  }

  // Verify state matches cookie
  const storedState = request.cookies.get('oauth_state')?.value;
  if (!storedState || storedState !== state) {
    const errorUrl = new URL('/dashboard/social', request.url);
    errorUrl.searchParams.set('error', 'Invalid state parameter - possible CSRF attack');
    return NextResponse.redirect(errorUrl);
  }

  try {
    // Parse state to get original platform
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    
    // Verify state hasn't expired (10 minutes)
    if (Date.now() - stateData.timestamp > 10 * 60 * 1000) {
      const errorUrl = new URL('/dashboard/social', request.url);
      errorUrl.searchParams.set('error', 'Authorization timed out');
      return NextResponse.redirect(errorUrl);
    }

    // Exchange code for tokens
    const platformCapitalized = platform.charAt(0).toUpperCase() + platform.slice(1).toLowerCase() as SocialPlatform;
    const tokens = await exchangeCodeForTokens(platformCapitalized, code);

    // Get user/account info for storage
    const accountInfo = await getAccountInfo(platformCapitalized, tokens.accessToken);

    // Store connection in database
    const supabase = getSupabaseAdmin();
    
    const { error: dbError } = await supabase
      .from('social_connections')
      .upsert({
        platform: platformCapitalized,
        account_id: accountInfo.id,
        account_name: accountInfo.name,
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken || null,
        token_expiry: tokens.expiresIn 
          ? new Date(Date.now() + tokens.expiresIn * 1000).toISOString()
          : null,
        page_id: accountInfo.pageId || null,
        is_active: true,
      }, {
        onConflict: 'platform,account_id',
      });

    if (dbError) {
      console.error('Failed to save connection:', dbError);
      throw new Error('Failed to save connection');
    }

    // Redirect to success page
    const successUrl = new URL('/dashboard/social', request.url);
    successUrl.searchParams.set('success', 'true');
    successUrl.searchParams.set('platform', platformCapitalized);
    
    const response = NextResponse.redirect(successUrl);
    response.cookies.delete('oauth_state');
    
    return response;

  } catch (err) {
    console.error('OAuth callback error:', err);
    const errorUrl = new URL('/dashboard/social', request.url);
    errorUrl.searchParams.set('error', err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.redirect(errorUrl);
  }
}

// Get account info for each platform
async function getAccountInfo(
  platform: SocialPlatform,
  accessToken: string
): Promise<{ id: string; name: string; pageId?: string }> {
  switch (platform) {
    case 'Facebook': {
      const response = await fetch(
        `https://graph.facebook.com/v20.0/me?fields=id,name&access_token=${accessToken}`
      );
      const data = await response.json();
      return { id: data.id, name: data.name };
    }
    
    case 'Instagram': {
      // Instagram requires getting the business account via Facebook page
      const response = await fetch(
        `https://graph.facebook.com/v20.0/me/accounts?fields=instagram_business_account,name&access_token=${accessToken}`
      );
      const data = await response.json();
      const page = data.data?.[0];
      if (page?.instagram_business_account) {
        return {
          id: page.instagram_business_account.id,
          name: page.name,
          pageId: page.id,
        };
      }
      throw new Error('No Instagram Business account linked to Facebook Page');
    }
    
    case 'LinkedIn': {
      const response = await fetch('https://api.linkedin.com/v2/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'LinkedIn-Version': '202401',
        },
      });
      const data = await response.json();
      return {
        id: data.id,
        name: `${data.localizedFirstName} ${data.localizedLastName}`,
      };
    }
    
    case 'Reddit': {
      const response = await fetch('https://oauth.reddit.com/api/v1/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'CCW-Digital-Hub/1.0.0',
        },
      });
      const data = await response.json();
      return { id: data.id, name: data.name };
    }
    
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}
