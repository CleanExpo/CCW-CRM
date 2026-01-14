-- Social Media Integration Schema
-- Run this in Supabase SQL Editor to create the necessary tables

-- Social Platform Enum
CREATE TYPE social_platform AS ENUM ('Facebook', 'Instagram', 'LinkedIn', 'Reddit');

-- Post Status Enum
CREATE TYPE post_status AS ENUM ('Draft', 'PendingApproval', 'Approved', 'Scheduled', 'Publishing', 'Published', 'Failed');

-- Social Connections Table (OAuth tokens)
CREATE TABLE social_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform social_platform NOT NULL,
  account_name TEXT NOT NULL,
  account_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expiry TIMESTAMPTZ,
  page_id TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(platform, account_id)
);

-- Social Posts Table
CREATE TABLE social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES social_connections(id) ON DELETE CASCADE,
  calendar_entry_id UUID,
  content TEXT NOT NULL,
  media_urls JSONB,
  hashtags TEXT[],
  target_community TEXT,
  status post_status DEFAULT 'Draft',
  scheduled_for TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  platform_post_id TEXT,
  likes INTEGER,
  comments INTEGER,
  shares INTEGER,
  impressions INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Target Communities Table (Subreddits, Groups)
CREATE TABLE target_communities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform social_platform NOT NULL,
  community_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  post_rules JSONB,
  last_posted TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(platform, community_id)
);

-- Content Calendar Table
CREATE TABLE content_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  cadence TEXT NOT NULL,
  scheduled_date TIMESTAMPTZ NOT NULL,
  content_type TEXT NOT NULL,
  status TEXT DEFAULT 'Draft',
  platforms TEXT[],
  content TEXT,
  media_asset_ids TEXT[],
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE social_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE target_communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_calendar ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for service role, adjust as needed for production)
CREATE POLICY "Allow all for service role" ON social_connections FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON social_posts FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON target_communities FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON content_calendar FOR ALL USING (true);

-- Indexes for better query performance
CREATE INDEX idx_social_posts_connection_id ON social_posts(connection_id);
CREATE INDEX idx_social_posts_status ON social_posts(status);
CREATE INDEX idx_social_posts_scheduled_for ON social_posts(scheduled_for);
CREATE INDEX idx_content_calendar_scheduled_date ON content_calendar(scheduled_date);

-- Seed target communities (restoration industry subreddits)
INSERT INTO target_communities (platform, community_id, name, description, is_active) VALUES
  ('Reddit', 'CarpetCleaning', 'Carpet Cleaning', 'Subreddit for carpet cleaning professionals', true),
  ('Reddit', 'Restoration', 'Restoration Services', 'Water damage and restoration industry', true),
  ('Reddit', 'IICRC', 'IICRC', 'IICRC certified professionals', true),
  ('Reddit', 'flooddamage', 'Flood Damage', 'Flood damage restoration discussions', true);
