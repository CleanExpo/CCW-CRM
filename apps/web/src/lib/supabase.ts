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
