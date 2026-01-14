import { NextResponse } from 'next/server';
import { getSupabaseClient, Equipment } from '@/src/lib/supabase';

export async function GET() {
    try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
            .from('equipment')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Supabase error:', error);
            throw error;
        }

        // Transform snake_case to camelCase for frontend
        const equipment = (data || []).map((item: Equipment) => ({
            id: item.id,
            serialNumber: item.serial_number,
            model: item.model,
            brand: item.brand,
            currentBranch: item.current_branch,
            status: item.status,
            createdAt: item.created_at,
            updatedAt: item.updated_at,
        }));

        return NextResponse.json(equipment);
    } catch (error) {
        console.error('Failed to fetch equipment:', error);
        return NextResponse.json(
            { error: 'Failed to fetch equipment' },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const supabase = getSupabaseClient();
        const body = await request.json();

        const { data, error } = await supabase
            .from('equipment')
            .insert({
                serial_number: body.serialNumber,
                model: body.model,
                brand: body.brand,
                current_branch: body.currentBranch,
                status: body.status || 'InQueue',
            })
            .select()
            .single();

        if (error) {
            console.error('Supabase error:', error);
            throw error;
        }

        return NextResponse.json({
            id: data.id,
            serialNumber: data.serial_number,
            model: data.model,
            brand: data.brand,
            currentBranch: data.current_branch,
            status: data.status,
        }, { status: 201 });
    } catch (error) {
        console.error('Failed to create equipment:', error);
        return NextResponse.json(
            { error: 'Failed to create equipment' },
            { status: 500 }
        );
    }
}

export async function PATCH(request: Request) {
    try {
        const supabase = getSupabaseClient();
        const body = await request.json();
        const { id, ...updates } = body;

        if (!id) {
            return NextResponse.json(
                { error: 'Equipment ID is required' },
                { status: 400 }
            );
        }

        // Convert camelCase to snake_case for database
        const dbUpdates: Record<string, unknown> = {};
        if (updates.serialNumber) dbUpdates.serial_number = updates.serialNumber;
        if (updates.model) dbUpdates.model = updates.model;
        if (updates.brand) dbUpdates.brand = updates.brand;
        if (updates.currentBranch) dbUpdates.current_branch = updates.currentBranch;
        if (updates.status) dbUpdates.status = updates.status;

        const { data, error } = await supabase
            .from('equipment')
            .update(dbUpdates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Supabase error:', error);
            throw error;
        }

        return NextResponse.json({
            id: data.id,
            serialNumber: data.serial_number,
            model: data.model,
            brand: data.brand,
            currentBranch: data.current_branch,
            status: data.status,
        });
    } catch (error) {
        console.error('Failed to update equipment:', error);
        return NextResponse.json(
            { error: 'Failed to update equipment' },
            { status: 500 }
        );
    }
}
