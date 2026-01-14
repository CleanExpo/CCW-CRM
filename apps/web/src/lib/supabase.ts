// Supabase Client Configuration for CCW Digital Operations Hub
// Uses REST API for data access (bypasses IPv6 connectivity issues)

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Database types matching Prisma schema
export type EquipmentModel = 'Truckmount' | 'Portable' | 'AirMovers' | 'Dehumidifier';
export type Branch = 'Boondall' | 'SevenHills' | 'Bayswater';
export type ServiceStatus = 'InQueue' | 'Diagnosing' | 'WaitingParts' | 'Testing' | 'Ready';

export interface Equipment {
    id: string;
    serial_number: string;
    model: EquipmentModel;
    brand: string;
    current_branch: Branch;
    status: ServiceStatus;
    created_at: string;
    updated_at: string;
}

export interface ServiceLog {
    id: string;
    equipment_id: string;
    technician_notes: string | null;
    parts_replaced: Record<string, unknown> | null;
    timestamp: string;
}

// Social Media Types
export type SocialPlatform = 'Facebook' | 'Instagram' | 'LinkedIn' | 'Reddit';
export type PostStatus = 'Draft' | 'PendingApproval' | 'Approved' | 'Scheduled' | 'Publishing' | 'Published' | 'Failed';

export interface SocialConnection {
    id: string;
    platform: SocialPlatform;
    account_name: string;
    account_id: string;
    access_token: string;
    refresh_token: string | null;
    token_expiry: string | null;
    page_id: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface SocialPost {
    id: string;
    connection_id: string;
    calendar_entry_id: string | null;
    content: string;
    media_urls: Record<string, unknown> | null;
    hashtags: string[];
    target_community: string | null;
    status: PostStatus;
    scheduled_for: string | null;
    published_at: string | null;
    platform_post_id: string | null;
    likes: number | null;
    comments: number | null;
    shares: number | null;
    impressions: number | null;
    error_message: string | null;
    created_at: string;
    updated_at: string;
}

export interface TargetCommunity {
    id: string;
    platform: SocialPlatform;
    community_id: string;
    name: string;
    description: string | null;
    is_active: boolean;
    post_rules: Record<string, unknown> | null;
    last_posted: string | null;
    created_at: string;
}

export interface ContentCalendar {
    id: string;
    title: string;
    description: string | null;
    cadence: string;
    scheduled_date: string;
    content_type: string;
    status: string;
    platforms: string[];
    content: string | null;
    media_asset_ids: string[];
    tags: string[];
    created_at: string;
    updated_at: string;
}

// Database interface for type-safe queries
export interface Database {
    public: {
        Tables: {
            equipment: {
                Row: Equipment;
                Insert: Omit<Equipment, 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Omit<Equipment, 'id' | 'created_at'>>;
            };
            service_logs: {
                Row: ServiceLog;
                Insert: Omit<ServiceLog, 'id' | 'timestamp'>;
                Update: Partial<Omit<ServiceLog, 'id'>>;
            };
            social_connections: {
                Row: SocialConnection;
                Insert: Omit<SocialConnection, 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Omit<SocialConnection, 'id' | 'created_at'>>;
            };
            social_posts: {
                Row: SocialPost;
                Insert: Omit<SocialPost, 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Omit<SocialPost, 'id' | 'created_at'>>;
            };
            target_communities: {
                Row: TargetCommunity;
                Insert: Omit<TargetCommunity, 'id' | 'created_at'>;
                Update: Partial<Omit<TargetCommunity, 'id' | 'created_at'>>;
            };
            content_calendar: {
                Row: ContentCalendar;
                Insert: Omit<ContentCalendar, 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Omit<ContentCalendar, 'id' | 'created_at'>>;
            };
        };
    };
}

// Singleton client instance
let supabaseClient: SupabaseClient<Database> | null = null;

/**
 * Get the Supabase client instance (singleton pattern)
 * Uses environment variables for configuration
 */
export function getSupabaseClient(): SupabaseClient<Database> {
    if (supabaseClient) return supabaseClient;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error(
            'Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
        );
    }

    supabaseClient = createClient<Database>(supabaseUrl, supabaseKey, {
        auth: {
            persistSession: false,
        },
    });

    return supabaseClient;
}

/**
 * Get Supabase client with service role (for server-side operations)
 * WARNING: Only use on server-side, never expose to client
 */
export function getSupabaseAdmin(): SupabaseClient<Database> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error(
            'Missing Supabase admin environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
        );
    }

    return createClient<Database>(supabaseUrl, serviceRoleKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });
}

// Export for convenience
export { createClient };
