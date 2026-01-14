/**
 * Media Production Agent - Autonomous Visual Creator
 * Generates high-fidelity visual assets for CCW using Vertex AI
 */

import { Agent, tool } from '@openai/agents';
import { z } from 'zod';
import {
    getVertexAIAdapter,
    AssetType,
    GeneratedAsset,
    CCW_BRAND
} from '@/src/lib/visuals/vertex_adapter';

// Asset generation queue for batch processing
interface AssetGenerationJob {
    id: string;
    request: {
        assetType: AssetType;
        dimension: string;
        promptXml: string;
        productContext?: string;
    };
    status: 'Queued' | 'Processing' | 'Completed' | 'Failed';
    result?: GeneratedAsset;
    error?: string;
    createdAt: string;
    completedAt?: string;
}

// In-memory job queue (replace with Redis/DB in production)
const assetJobQueue: Map<string, AssetGenerationJob> = new Map();

/**
 * Generate Product Render Tool
 * Creates photorealistic product images using Imagen 3
 */
const generateProductRenderTool = tool({
    name: 'generate_product_render',
    description: 'Generate a high-fidelity product render using Google Imagen 3. Creates photorealistic images of CCW equipment in professional settings.',
    parameters: z.object({
        productName: z.string().describe('Name of the product (e.g., "Razorback Portable Extractor")'),
        productType: z.enum(['Truckmount', 'Portable', 'AirMovers', 'Dehumidifier']).describe('Type of equipment'),
        setting: z.enum(['Warehouse', 'Workshop', 'OnSite', 'Studio', 'Showroom']).describe('Background setting for the render'),
        angle: z.enum(['Front', 'ThreeQuarter', 'Side', 'Overhead', 'Detail']).describe('Camera angle'),
        dimension: z.string().default('1920x1080').describe('Image dimensions (e.g., "1920x1080")'),
        additionalContext: z.string().optional().describe('Additional context for the image generation'),
    }),
    execute: async ({ productName, productType, setting, angle, dimension, additionalContext }) => {
        const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const settingDescriptions: Record<string, string> = {
            Warehouse: 'Professional warehouse with industrial shelving and concrete floors',
            Workshop: 'Clean workshop environment with tool stations and work benches',
            OnSite: 'Active restoration job site showing equipment in use',
            Studio: 'Clean white studio background with professional lighting',
            Showroom: 'Modern showroom with polished floors and professional display',
        };

        const angleDescriptions: Record<string, string> = {
            Front: 'front-facing hero shot',
            ThreeQuarter: 'dynamic three-quarter angle view',
            Side: 'side profile view showing full dimensions',
            Overhead: 'top-down view showing control panel layout',
            Detail: 'close-up detail shot of key features',
        };

        const promptXml = `
      <subject>${productName} - ${productType} cleaning equipment, ${angleDescriptions[angle]}</subject>
      <setting>${settingDescriptions[setting]}</setting>
      <style>Industrial commercial photography, high contrast, professional lighting</style>
      <brand>CCW Equipment - Navy (${CCW_BRAND.primaryColor}) and Gold (${CCW_BRAND.secondaryColor}) accents</brand>
      ${additionalContext ? `<context>${additionalContext}</context>` : ''}
    `;

        const job: AssetGenerationJob = {
            id: jobId,
            request: {
                assetType: 'Image',
                dimension,
                promptXml,
                productContext: productName,
            },
            status: 'Queued',
            createdAt: new Date().toISOString(),
        };

        assetJobQueue.set(jobId, job);

        // Process asynchronously
        processAssetJob(jobId).catch(console.error);

        return {
            success: true,
            jobId,
            message: `Product render job queued for ${productName}`,
            estimatedTime: '30-60 seconds',
            settings: {
                productType,
                setting,
                angle,
                dimension,
            },
        };
    },
});

/**
 * Create Transition Animation Tool
 * Generates short video animations using Veo
 */
const createTransitionAnimationTool = tool({
    name: 'create_transition_animation',
    description: 'Create a short transition animation or motion graphic using Google Veo. Perfect for logo reveals, product showcases, and social media content.',
    parameters: z.object({
        animationType: z.enum(['LogoReveal', 'ProductShowcase', 'TextTransition', 'BrandIntro', 'EndScreen']).describe('Type of animation to create'),
        duration: z.number().min(2).max(15).default(5).describe('Duration in seconds'),
        style: z.enum(['Modern', 'Industrial', 'Elegant', 'Dynamic', 'Minimal']).describe('Visual style'),
        includeAudio: z.boolean().default(false).describe('Whether to include audio track'),
        dimension: z.string().default('1920x1080').describe('Video dimensions'),
    }),
    execute: async ({ animationType, duration, style, includeAudio, dimension }) => {
        const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const animationDescriptions: Record<string, string> = {
            LogoReveal: 'CCW logo emerging with dynamic particles and light trails',
            ProductShowcase: '360-degree product rotation with feature callouts',
            TextTransition: 'Smooth text animation with kinetic typography',
            BrandIntro: 'Brand colors flowing into CCW logo formation',
            EndScreen: 'Closing animation with contact information and CTA',
        };

        const styleDescriptions: Record<string, string> = {
            Modern: 'clean lines, smooth transitions, contemporary feel',
            Industrial: 'metallic textures, mechanical movements, workshop aesthetic',
            Elegant: 'subtle movements, luxury feel, refined transitions',
            Dynamic: 'energetic motion, bold movements, high impact',
            Minimal: 'simple, focused, essential elements only',
        };

        const promptXml = `
      <action>${animationDescriptions[animationType]}</action>
      <style>${styleDescriptions[style]}</style>
      <duration>${duration} seconds</duration>
      <brand>CCW Equipment branding - Navy (${CCW_BRAND.primaryColor}) and Gold (${CCW_BRAND.secondaryColor})</brand>
      <mood>Professional, trustworthy, Australian industry leader</mood>
    `;

        const job: AssetGenerationJob = {
            id: jobId,
            request: {
                assetType: 'Video',
                dimension,
                promptXml,
            },
            status: 'Queued',
            createdAt: new Date().toISOString(),
        };

        assetJobQueue.set(jobId, job);

        // Process asynchronously
        processAssetJob(jobId).catch(console.error);

        return {
            success: true,
            jobId,
            message: `Animation job queued: ${animationType}`,
            estimatedTime: '2-5 minutes',
            settings: {
                animationType,
                duration,
                style,
                includeAudio,
                dimension,
            },
        };
    },
});

/**
 * Build Infographic Tool
 * Creates SVG infographics using Gemini
 */
const buildInfographicTool = tool({
    name: 'build_infographic',
    description: 'Build an SVG infographic using Gemini 1.5 Pro. Creates data visualizations, tip sheets, and branded informational graphics.',
    parameters: z.object({
        title: z.string().describe('Title of the infographic'),
        contentType: z.enum(['Tips', 'Statistics', 'ProcessFlow', 'Comparison', 'Timeline', 'Checklist']).describe('Type of infographic content'),
        dataPoints: z.array(z.object({
            label: z.string(),
            value: z.string(),
            icon: z.string().optional(),
        })).describe('Data points to include in the infographic'),
        dimension: z.string().default('1080x1350').describe('Infographic dimensions (portrait recommended)'),
    }),
    execute: async ({ title, contentType, dataPoints, dimension }) => {
        const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const contentTemplates: Record<string, string> = {
            Tips: 'Numbered tips list with icons and brief descriptions',
            Statistics: 'Data visualization with charts and key metrics',
            ProcessFlow: 'Step-by-step process diagram with arrows',
            Comparison: 'Side-by-side comparison layout',
            Timeline: 'Chronological timeline with milestones',
            Checklist: 'Interactive-style checklist with checkboxes',
        };

        const formattedDataPoints = dataPoints.map((dp, i) =>
            `${i + 1}. ${dp.label}: ${dp.value}`
        ).join('\n');

        const promptXml = `
      <title>${title}</title>
      <type>${contentTemplates[contentType]}</type>
      <content>
        ${formattedDataPoints}
      </content>
      <style>Modern, professional, CCW branding</style>
      <colors>Primary: ${CCW_BRAND.primaryColor}, Secondary: ${CCW_BRAND.secondaryColor}</colors>
    `;

        const job: AssetGenerationJob = {
            id: jobId,
            request: {
                assetType: 'SVG_Infographic',
                dimension,
                promptXml,
            },
            status: 'Queued',
            createdAt: new Date().toISOString(),
        };

        assetJobQueue.set(jobId, job);

        // Process asynchronously
        processAssetJob(jobId).catch(console.error);

        return {
            success: true,
            jobId,
            message: `Infographic job queued: ${title}`,
            estimatedTime: '15-30 seconds',
            settings: {
                title,
                contentType,
                dataPointCount: dataPoints.length,
                dimension,
            },
        };
    },
});

/**
 * Process an asset generation job
 */
async function processAssetJob(jobId: string): Promise<void> {
    const job = assetJobQueue.get(jobId);
    if (!job) return;

    job.status = 'Processing';
    assetJobQueue.set(jobId, job);

    try {
        const adapter = getVertexAIAdapter();
        const result = await adapter.generateAsset(job.request);

        job.status = 'Completed';
        job.result = result;
        job.completedAt = new Date().toISOString();
    } catch (error) {
        job.status = 'Failed';
        job.error = error instanceof Error ? error.message : 'Unknown error';
        job.completedAt = new Date().toISOString();
    }

    assetJobQueue.set(jobId, job);
}

/**
 * Get Asset Job Status Tool (internal utility)
 */
const getAssetJobStatusTool = tool({
    name: 'get_asset_job_status',
    description: 'Check the status of an asset generation job',
    parameters: z.object({
        jobId: z.string().describe('The job ID to check'),
    }),
    execute: async ({ jobId }) => {
        const job = assetJobQueue.get(jobId);

        if (!job) {
            return {
                success: false,
                error: 'Job not found',
            };
        }

        return {
            success: true,
            job: {
                id: job.id,
                status: job.status,
                createdAt: job.createdAt,
                completedAt: job.completedAt,
                result: job.result,
                error: job.error,
            },
        };
    },
});

/**
 * Media Production Agent Definition
 */
export const mediaProductionAgent = new Agent({
    name: 'Media Production Agent',
    instructions: `You are the Autonomous Visual Creator for CCW (Cleaning & Restoration Equipment Company).

<task>Generate high-fidelity visual assets that align with CCW's brand identity.</task>

<style>
- Industrial aesthetic with professional quality
- High-contrast imagery with excellent lighting
- Primary colors: Navy (#003366) and Gold (#FFCC00)
- Australian business representation
</style>

<tools>
- Imagen 3 API for photorealistic product renders
- Veo Video API for motion graphics and animations
- Gemini for SVG infographic generation
</tools>

<capabilities>
1. Product Renders: Create stunning equipment photography for marketing materials
2. Transition Animations: Build logo reveals and product showcase videos
3. Infographics: Design data visualizations and tip sheets for newsletters
</capabilities>

<workflow>
1. Receive asset request from Content Planner or direct request
2. Determine best tool for the job (Imagen, Veo, or Gemini)
3. Apply CCW brand guidelines automatically
4. Generate asset and return job ID for tracking
5. Notify when asset is ready for Human-in-the-Loop review
</workflow>

Always ensure:
- Brand consistency across all generated assets
- Professional quality suitable for commercial use
- Appropriate dimensions for intended platform (social, web, print)`,

    tools: [
        generateProductRenderTool,
        createTransitionAnimationTool,
        buildInfographicTool,
        getAssetJobStatusTool,
    ],
});

// Export job queue accessor for API routes
export function getAssetJobs(): AssetGenerationJob[] {
    return Array.from(assetJobQueue.values());
}

export function getAssetJob(jobId: string): AssetGenerationJob | undefined {
    return assetJobQueue.get(jobId);
}
