/**
 * Vertex AI Adapter for Visual Asset Generation
 * Integrates Google Imagen 3 and Veo for CCW creative content
 */

import { VertexAI, HarmCategory, HarmBlockThreshold } from '@google-cloud/vertexai';

// CCW Brand Configuration
const CCW_BRAND = {
    primaryColor: '#003366', // Navy Blue
    secondaryColor: '#FFCC00', // Gold
    style: 'Industrial, High-Contrast, Professional',
    voiceTone: 'Reliable, Australian, Expert',
};

export type AssetType = 'Image' | 'Video' | 'SVG_Infographic';

export interface VisualAssetRequest {
    assetType: AssetType;
    dimension: string; // e.g., "1920x1080", "1080x1080"
    promptXml: string; // XML-tagged instructions
    productContext?: string;
    brandOverrides?: Partial<typeof CCW_BRAND>;
}

export interface GeneratedAsset {
    id: string;
    type: AssetType;
    url: string;
    thumbnail?: string;
    metadata: {
        prompt: string;
        generatedAt: string;
        dimension: string;
        model: string;
    };
}

/**
 * Parse XML-tagged prompt instructions into structured format
 */
function parsePromptXml(xml: string): Record<string, string> {
    const result: Record<string, string> = {};
    const tagRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;
    let match;
    while ((match = tagRegex.exec(xml)) !== null) {
        result[match[1]] = match[2].trim();
    }
    return result;
}

/**
 * Build an optimized prompt for Imagen 3 with CCW branding
 */
function buildImagenPrompt(request: VisualAssetRequest): string {
    const parsed = parsePromptXml(request.promptXml);
    const brand = { ...CCW_BRAND, ...request.brandOverrides };

    const promptParts = [
        `Industrial commercial photography style.`,
        `Color palette: Navy blue (${brand.primaryColor}) and Gold (${brand.secondaryColor}).`,
        `Lighting: Professional studio lighting with high contrast.`,
        parsed.subject || '',
        parsed.setting || 'Professional warehouse or workshop setting.',
        parsed.style || brand.style,
        `Australian business aesthetic, clean and modern.`,
        `8K resolution, photorealistic, commercial quality.`,
    ];

    return promptParts.filter(Boolean).join(' ');
}

/**
 * Build a prompt for Veo video generation
 */
function buildVeoPrompt(request: VisualAssetRequest): string {
    const parsed = parsePromptXml(request.promptXml);
    const brand = { ...CCW_BRAND, ...request.brandOverrides };

    return [
        `Cinematic transition animation.`,
        `Brand colors: Navy (${brand.primaryColor}) and Gold (${brand.secondaryColor}).`,
        parsed.action || 'Smooth reveal transition.',
        parsed.duration || '5 seconds.',
        `Professional motion graphics style.`,
        `Clean, modern, industrial aesthetic.`,
    ].join(' ');
}

/**
 * Vertex AI Client for image and video generation
 */
export class VertexAIAdapter {
    private vertexAI: VertexAI | null = null;
    private projectId: string;
    private location: string;

    constructor(projectId?: string, location: string = 'us-central1') {
        this.projectId = projectId || process.env.GOOGLE_CLOUD_PROJECT || '';
        this.location = location;
    }

    /**
     * Initialize the Vertex AI client
     */
    private getClient(): VertexAI {
        if (!this.vertexAI) {
            if (!this.projectId) {
                throw new Error('GOOGLE_CLOUD_PROJECT environment variable is required');
            }
            this.vertexAI = new VertexAI({
                project: this.projectId,
                location: this.location,
            });
        }
        return this.vertexAI;
    }

    /**
     * Generate an image using Imagen 3
     */
    async generateImage(request: VisualAssetRequest): Promise<GeneratedAsset> {
        const prompt = buildImagenPrompt(request);
        const [width, height] = request.dimension.split('x').map(Number);

        console.log('[Imagen 3] Generating image with prompt:', prompt.substring(0, 100) + '...');

        // Note: Imagen 3 API call - actual implementation depends on API availability
        // This is a placeholder structure for the real API
        try {
            const client = this.getClient();

            // Imagen 3 is accessed via the generative model interface
            const model = client.getGenerativeModel({
                model: 'imagegeneration@006', // Imagen 3
            });

            // For now, return a mock response since Imagen 3 requires specific setup
            // In production, this would make the actual API call
            const assetId = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            return {
                id: assetId,
                type: 'Image',
                url: `/api/assets/${assetId}`, // Would be actual GCS URL in production
                thumbnail: `/api/assets/${assetId}/thumb`,
                metadata: {
                    prompt,
                    generatedAt: new Date().toISOString(),
                    dimension: request.dimension,
                    model: 'imagen-3',
                },
            };
        } catch (error) {
            console.error('[Imagen 3] Error:', error);
            throw new Error(`Image generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Generate a video using Veo
     */
    async generateVideo(request: VisualAssetRequest): Promise<GeneratedAsset> {
        const prompt = buildVeoPrompt(request);

        console.log('[Veo] Generating video with prompt:', prompt.substring(0, 100) + '...');

        try {
            // Veo API call - placeholder for actual implementation
            const assetId = `vid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            return {
                id: assetId,
                type: 'Video',
                url: `/api/assets/${assetId}`,
                thumbnail: `/api/assets/${assetId}/poster`,
                metadata: {
                    prompt,
                    generatedAt: new Date().toISOString(),
                    dimension: request.dimension,
                    model: 'veo',
                },
            };
        } catch (error) {
            console.error('[Veo] Error:', error);
            throw new Error(`Video generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Generate an SVG infographic using Gemini
     */
    async generateInfographic(request: VisualAssetRequest): Promise<GeneratedAsset> {
        const parsed = parsePromptXml(request.promptXml);
        const brand = { ...CCW_BRAND, ...request.brandOverrides };

        console.log('[Gemini] Generating infographic...');

        try {
            const client = this.getClient();
            const model = client.getGenerativeModel({
                model: 'gemini-1.5-pro',
                safetySettings: [
                    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                ],
            });

            const prompt = `Generate an SVG infographic with the following specifications:
        Title: ${parsed.title || 'CCW Infographic'}
        Content: ${parsed.content || 'Professional restoration industry content'}
        Style: Modern, clean, industrial
        Primary Color: ${brand.primaryColor}
        Secondary Color: ${brand.secondaryColor}
        Dimensions: ${request.dimension}
        
        Return ONLY valid SVG code, no explanation.`;

            const result = await model.generateContent(prompt);
            const svgContent = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';

            const assetId = `svg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            return {
                id: assetId,
                type: 'SVG_Infographic',
                url: `/api/assets/${assetId}`,
                metadata: {
                    prompt: parsed.title || 'Infographic',
                    generatedAt: new Date().toISOString(),
                    dimension: request.dimension,
                    model: 'gemini-1.5-pro',
                },
            };
        } catch (error) {
            console.error('[Gemini] Error:', error);
            throw new Error(`Infographic generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Generate any type of visual asset
     */
    async generateAsset(request: VisualAssetRequest): Promise<GeneratedAsset> {
        switch (request.assetType) {
            case 'Image':
                return this.generateImage(request);
            case 'Video':
                return this.generateVideo(request);
            case 'SVG_Infographic':
                return this.generateInfographic(request);
            default:
                throw new Error(`Unsupported asset type: ${request.assetType}`);
        }
    }
}

// Singleton instance
let adapterInstance: VertexAIAdapter | null = null;

export function getVertexAIAdapter(): VertexAIAdapter {
    if (!adapterInstance) {
        adapterInstance = new VertexAIAdapter();
    }
    return adapterInstance;
}

export { CCW_BRAND };
