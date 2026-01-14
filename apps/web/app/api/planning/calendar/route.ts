import { NextRequest, NextResponse } from 'next/server';

// Types for content calendar
export interface ContentCalendarEntry {
    id: string;
    title: string;
    description: string;
    cadence: 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly';
    scheduledDate: string;
    contentType: 'SocialMedia' | 'WebSpecial' | 'Newsletter' | 'CatalogueUpdate' | 'PerformanceReport';
    status: 'Draft' | 'Scheduled' | 'PendingApproval' | 'Approved' | 'Published';
    assets: string[];
    tags: string[];
}

// In-memory store (replace with Supabase in production)
const calendarEntries: Map<string, ContentCalendarEntry> = new Map();

// Seed some initial data
const seedEntries: ContentCalendarEntry[] = [
    {
        id: 'cal-001',
        title: 'Razorback Portable Special',
        description: 'Weekly special promotion for Razorback Portable Extractors',
        cadence: 'Weekly',
        scheduledDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        contentType: 'WebSpecial',
        status: 'PendingApproval',
        assets: ['img-001'],
        tags: ['promotion', 'razorback', 'portable'],
    },
    {
        id: 'cal-002',
        title: 'Restoration Tips Social Post',
        description: 'Share top 5 water damage restoration tips',
        cadence: 'Weekly',
        scheduledDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
        contentType: 'SocialMedia',
        status: 'Scheduled',
        assets: [],
        tags: ['tips', 'education', 'social'],
    },
    {
        id: 'cal-003',
        title: 'January Industry Newsletter',
        description: 'Monthly newsletter with product updates and industry news',
        cadence: 'Monthly',
        scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        contentType: 'Newsletter',
        status: 'Draft',
        assets: ['svg-001'],
        tags: ['newsletter', 'monthly'],
    },
];

// Initialize seed data
seedEntries.forEach(entry => calendarEntries.set(entry.id, entry));

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const cadence = searchParams.get('cadence');
    const status = searchParams.get('status');

    let entries = Array.from(calendarEntries.values());

    // Filter by cadence if specified
    if (cadence && cadence !== 'all') {
        entries = entries.filter(e => e.cadence.toLowerCase() === cadence.toLowerCase());
    }

    // Filter by status if specified
    if (status && status !== 'all') {
        entries = entries.filter(e => e.status.toLowerCase() === status.toLowerCase());
    }

    // Sort by scheduled date
    entries.sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());

    return NextResponse.json({
        entries,
        total: entries.length,
    });
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const entry: ContentCalendarEntry = {
            id: `cal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title: body.title,
            description: body.description || '',
            cadence: body.cadence || 'Weekly',
            scheduledDate: body.scheduledDate || new Date().toISOString(),
            contentType: body.contentType || 'SocialMedia',
            status: 'Draft',
            assets: body.assets || [],
            tags: body.tags || [],
        };

        calendarEntries.set(entry.id, entry);

        return NextResponse.json(entry, { status: 201 });
    } catch (error) {
        console.error('Failed to create calendar entry:', error);
        return NextResponse.json(
            { error: 'Failed to create calendar entry' },
            { status: 500 }
        );
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, ...updates } = body;

        if (!id) {
            return NextResponse.json(
                { error: 'Entry ID is required' },
                { status: 400 }
            );
        }

        const entry = calendarEntries.get(id);
        if (!entry) {
            return NextResponse.json(
                { error: 'Entry not found' },
                { status: 404 }
            );
        }

        // Apply updates
        Object.assign(entry, updates);
        calendarEntries.set(id, entry);

        return NextResponse.json(entry);
    } catch (error) {
        console.error('Failed to update calendar entry:', error);
        return NextResponse.json(
            { error: 'Failed to update calendar entry' },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json(
            { error: 'Entry ID is required' },
            { status: 400 }
        );
    }

    const deleted = calendarEntries.delete(id);

    if (!deleted) {
        return NextResponse.json(
            { error: 'Entry not found' },
            { status: 404 }
        );
    }

    return NextResponse.json({ success: true, id });
}
