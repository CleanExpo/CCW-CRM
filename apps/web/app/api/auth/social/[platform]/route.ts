import { getAuthUrl } from '@/src/lib/social';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/auth/social/[platform] - Get OAuth URL
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params;
  
  const validPlatforms = ['facebook', 'instagram', 'linkedin', 'reddit'];
  
  if (!validPlatforms.includes(platform.toLowerCase())) {
    return NextResponse.json(
      { error: `Invalid platform: ${platform}` },
      { status: 400 }
    );
  }

  // Generate state for CSRF protection
  const state = Buffer.from(JSON.stringify({
    platform,
    timestamp: Date.now(),
    nonce: Math.random().toString(36).substring(2),
  })).toString('base64');

  // Store state in cookie for verification
  const platformCapitalized = platform.charAt(0).toUpperCase() + platform.slice(1).toLowerCase();
  const authUrl = getAuthUrl(platformCapitalized as 'Facebook' | 'Instagram' | 'LinkedIn' | 'Reddit', state);

  const response = NextResponse.json({ authUrl, state });
  
  // Set state cookie for verification on callback
  response.cookies.set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 minutes
  });

  return response;
}
