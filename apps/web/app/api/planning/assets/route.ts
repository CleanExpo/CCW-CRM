import { NextRequest, NextResponse } from 'next/server';

// Types for asset generation jobs
export interface AssetJob {
    id: string;
    type: 'Image' | 'Video' | 'SVG_Infographic';
    status: 'Queued' | 'Processing' | 'Completed' | 'Failed';
    title: string;
    prompt?: string;
    dimension: string;
    createdAt: string;
    completedAt?: string;
    resultUrl?: string;
    thumbnailUrl?: string;
    error?: string;
}

// In-memory job queue (replace with Redis/DB in production)
const assetJobs: Map<string, AssetJob> = new Map();

// Seed some initial demo jobs
const seedJobs: AssetJob[] = [
    {
        id: 'job-001',
        type: 'Image',
        status: 'Completed',
        title: 'Razorback Portable - Warehouse Shot',
        dimension: '1920x1080',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        completedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        resultUrl: '/assets/demo/razorback-warehouse.png',
    },
    {
        id: 'job-002',
        type: 'Video',
        status: 'Processing',
        title: 'CCW Logo Reveal Animation',
        dimension: '1920x1080',
        createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    },
    {
        id: 'job-003',
        type: 'SVG_Infographic',
        status: 'Queued',
        title: 'Top 5 Restoration Tips Infographic',
        dimension: '1080x1350',
        createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    },
];

seedJobs.forEach(job => assetJobs.set(job.id, job));

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const jobId = searchParams.get('id');
    const status = searchParams.get('status');
    const type = searchParams.get('type');

    // Return single job if ID provided
    if (jobId) {
        const job = assetJobs.get(jobId);
        if (!job) {
            return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }
        return NextResponse.json(job);
    }

    // Return filtered list
    let jobs = Array.from(assetJobs.values());

    if (status) {
        jobs = jobs.filter(j => j.status === status);
    }

    if (type) {
        jobs = jobs.filter(j => j.type === type);
    }

    // Sort by creation date (newest first)
    jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({
        jobs,
        total: jobs.length,
        byStatus: {
            Queued: jobs.filter(j => j.status === 'Queued').length,
            Processing: jobs.filter(j => j.status === 'Processing').length,
            Completed: jobs.filter(j => j.status === 'Completed').length,
            Failed: jobs.filter(j => j.status === 'Failed').length,
        },
    });
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { type, title, prompt, dimension } = body;

        if (!type || !title) {
            return NextResponse.json(
                { error: 'type and title are required' },
                { status: 400 }
            );
        }

        const job: AssetJob = {
            id: `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type,
            status: 'Queued',
            title,
            prompt,
            dimension: dimension || '1920x1080',
            createdAt: new Date().toISOString(),
        };

        assetJobs.set(job.id, job);

        // Simulate async processing (in production, this would trigger actual generation)
        simulateProcessing(job.id);

        return NextResponse.json(job, { status: 201 });
    } catch (error) {
        console.error('Failed to create asset job:', error);
        return NextResponse.json(
            { error: 'Failed to create asset job' },
            { status: 500 }
        );
    }
}

// Simulate async asset generation
function simulateProcessing(jobId: string) {
    setTimeout(() => {
        const job = assetJobs.get(jobId);
        if (job && job.status === 'Queued') {
            job.status = 'Processing';
            assetJobs.set(jobId, job);
        }
    }, 2000);

    setTimeout(() => {
        const job = assetJobs.get(jobId);
        if (job && job.status === 'Processing') {
            job.status = 'Completed';
            job.completedAt = new Date().toISOString();
            job.resultUrl = `/assets/generated/${jobId}.${job.type === 'Video' ? 'mp4' : job.type === 'SVG_Infographic' ? 'svg' : 'png'}`;
            assetJobs.set(jobId, job);
        }
    }, 10000);
}
