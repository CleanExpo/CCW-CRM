/**
 * Content Planner Agent - Chief Brand Strategist
 * Maintains a consistent content calendar for CCW across all cadences
 */

import { Agent, tool } from '@openai/agents';
import { z } from 'zod';

// Content cadence types
export type ContentCadence = 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly';

export interface ContentCalendarEntry {
    id: string;
    title: string;
    description: string;
    cadence: ContentCadence;
    scheduledDate: string;
    contentType: 'SocialMedia' | 'WebSpecial' | 'Newsletter' | 'CatalogueUpdate' | 'PerformanceReport';
    status: 'Draft' | 'Scheduled' | 'PendingApproval' | 'Approved' | 'Published';
    assets: string[]; // Asset IDs
    tags: string[];
}

export interface ContentCalendarConfig {
    weekly: {
        socialMediaPosts: number;
        webSpecials: number;
    };
    monthly: {
        newsletters: number;
    };
    quarterly: {
        catalogueUpdates: number;
    };
    yearly: {
        performanceReports: number;
    };
}

// Default CCW content calendar configuration
const DEFAULT_CALENDAR_CONFIG: ContentCalendarConfig = {
    weekly: {
        socialMediaPosts: 3,
        webSpecials: 1,
    },
    monthly: {
        newsletters: 1,
    },
    quarterly: {
        catalogueUpdates: 1,
    },
    yearly: {
        performanceReports: 3, // One per National Service Hub
    },
};

// CCW Brand Guidelines for content consistency
const BRAND_GUIDELINES = {
    voice: 'Professional, Reliable, Australian Expert',
    primaryColor: '#003366',
    secondaryColor: '#FFCC00',
    targetAudience: 'Carpet cleaning professionals, Restoration industry operators',
    keyMessages: [
        '100% Australian-owned',
        'National Service Hub network',
        'Industry-leading equipment',
        'Expert technical support',
    ],
    bannedPhrases: [
        'cheap',
        'discount bin',
        'budget option',
    ],
};

/**
 * Generate Content Calendar Tool
 * Creates a structured content plan for a given time period
 */
const generateContentCalendarTool = tool({
    name: 'generate_content_calendar',
    description: 'Generate a content calendar for CCW based on cadence and date range. Creates entries for social media, web specials, newsletters, etc.',
    parameters: z.object({
        startDate: z.string().describe('Start date in ISO format (YYYY-MM-DD)'),
        endDate: z.string().describe('End date in ISO format (YYYY-MM-DD)'),
        cadence: z.enum(['Weekly', 'Monthly', 'Quarterly', 'Yearly', 'All']).describe('Which cadence to generate for'),
        focusProducts: z.array(z.string()).optional().describe('Optional product focus areas (e.g., Truckmounts, Portables)'),
    }),
    execute: async ({ startDate, endDate, cadence, focusProducts }) => {
        const entries: ContentCalendarEntry[] = [];
        const start = new Date(startDate);
        const end = new Date(endDate);

        // Generate weekly content
        if (cadence === 'All' || cadence === 'Weekly') {
            let weekStart = new Date(start);
            let weekNum = 1;

            while (weekStart <= end) {
                // Social media posts
                for (let i = 0; i < DEFAULT_CALENDAR_CONFIG.weekly.socialMediaPosts; i++) {
                    entries.push({
                        id: `cal-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                        title: `Week ${weekNum} Social Post ${i + 1}`,
                        description: focusProducts?.length
                            ? `Feature ${focusProducts[i % focusProducts.length]} equipment`
                            : 'Showcase CCW equipment or restoration tips',
                        cadence: 'Weekly',
                        scheduledDate: new Date(weekStart.getTime() + (i * 2 * 24 * 60 * 60 * 1000)).toISOString(),
                        contentType: 'SocialMedia',
                        status: 'Draft',
                        assets: [],
                        tags: ['social', 'engagement'],
                    });
                }

                // Web special
                entries.push({
                    id: `cal-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                    title: `Week ${weekNum} Web Special`,
                    description: focusProducts?.length
                        ? `Special offer on ${focusProducts[weekNum % focusProducts.length]}`
                        : 'Weekly equipment special offer',
                    cadence: 'Weekly',
                    scheduledDate: weekStart.toISOString(),
                    contentType: 'WebSpecial',
                    status: 'Draft',
                    assets: [],
                    tags: ['promotion', 'web'],
                });

                weekStart.setDate(weekStart.getDate() + 7);
                weekNum++;
            }
        }

        // Generate monthly newsletters
        if (cadence === 'All' || cadence === 'Monthly') {
            let monthStart = new Date(start.getFullYear(), start.getMonth(), 1);

            while (monthStart <= end) {
                entries.push({
                    id: `cal-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                    title: `${monthStart.toLocaleString('default', { month: 'long' })} Newsletter`,
                    description: 'Restoration industry newsletter with tips, product highlights, and industry news',
                    cadence: 'Monthly',
                    scheduledDate: monthStart.toISOString(),
                    contentType: 'Newsletter',
                    status: 'Draft',
                    assets: [],
                    tags: ['newsletter', 'industry'],
                });

                monthStart.setMonth(monthStart.getMonth() + 1);
            }
        }

        // Generate quarterly catalogue updates
        if (cadence === 'All' || cadence === 'Quarterly') {
            const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
            let quarterStart = new Date(start.getFullYear(), Math.floor(start.getMonth() / 3) * 3, 1);

            while (quarterStart <= end) {
                const quarterIndex = Math.floor(quarterStart.getMonth() / 3);
                entries.push({
                    id: `cal-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                    title: `${quarters[quarterIndex]} ${quarterStart.getFullYear()} Catalogue Update`,
                    description: 'Equipment catalogue refresh with new products, updated specifications, and pricing',
                    cadence: 'Quarterly',
                    scheduledDate: quarterStart.toISOString(),
                    contentType: 'CatalogueUpdate',
                    status: 'Draft',
                    assets: [],
                    tags: ['catalogue', 'products'],
                });

                quarterStart.setMonth(quarterStart.getMonth() + 3);
            }
        }

        // Generate yearly performance reports
        if (cadence === 'All' || cadence === 'Yearly') {
            if (start.getFullYear() <= end.getFullYear()) {
                const hubs = ['Boondall (QLD)', 'Seven Hills (NSW)', 'Bayswater (VIC)'];

                for (const hub of hubs) {
                    entries.push({
                        id: `cal-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                        title: `${hub} Annual Performance Report ${start.getFullYear()}`,
                        description: `Comprehensive performance analysis for ${hub} National Service Hub`,
                        cadence: 'Yearly',
                        scheduledDate: new Date(start.getFullYear(), 11, 31).toISOString(),
                        contentType: 'PerformanceReport',
                        status: 'Draft',
                        assets: [],
                        tags: ['report', 'performance', hub.split(' ')[0].toLowerCase()],
                    });
                }
            }
        }

        return {
            success: true,
            entriesGenerated: entries.length,
            calendar: entries,
            summary: `Generated ${entries.length} content calendar entries from ${startDate} to ${endDate}`,
        };
    },
});

/**
 * Check Brand Consistency Tool
 * Validates content against CCW brand guidelines
 */
const checkBrandConsistencyTool = tool({
    name: 'check_brand_consistency',
    description: 'Check if content adheres to CCW brand guidelines including voice, messaging, and visual standards',
    parameters: z.object({
        content: z.string().describe('The content text to check'),
        contentType: z.enum(['SocialMedia', 'Newsletter', 'WebCopy', 'ProductDescription']).describe('Type of content'),
        includeVisualCheck: z.boolean().optional().describe('Whether to include visual brand check'),
    }),
    execute: async ({ content, contentType, includeVisualCheck }) => {
        const issues: string[] = [];
        const suggestions: string[] = [];
        let score = 100;

        // Check for banned phrases
        for (const phrase of BRAND_GUIDELINES.bannedPhrases) {
            if (content.toLowerCase().includes(phrase.toLowerCase())) {
                issues.push(`Contains banned phrase: "${phrase}"`);
                score -= 15;
            }
        }

        // Check for key messages (at least one should be present for longer content)
        if (content.length > 200) {
            const hasKeyMessage = BRAND_GUIDELINES.keyMessages.some(msg =>
                content.toLowerCase().includes(msg.toLowerCase())
            );
            if (!hasKeyMessage) {
                suggestions.push('Consider incorporating a key CCW message');
                score -= 5;
            }
        }

        // Content type specific checks
        switch (contentType) {
            case 'SocialMedia':
                if (content.length > 280) {
                    suggestions.push('Social media content may be too long for some platforms');
                }
                if (!content.includes('#')) {
                    suggestions.push('Consider adding relevant hashtags');
                }
                break;

            case 'Newsletter':
                if (content.length < 500) {
                    suggestions.push('Newsletter content seems brief; consider adding more value');
                }
                break;

            case 'ProductDescription':
                if (!content.match(/\d/)) {
                    suggestions.push('Product descriptions should include specifications or numbers');
                }
                break;
        }

        // Check tone (simple heuristic)
        const informalWords = ['gonna', 'wanna', 'kinda', 'stuff', 'things'];
        for (const word of informalWords) {
            if (content.toLowerCase().includes(word)) {
                issues.push(`Informal language detected: "${word}" - use professional alternatives`);
                score -= 10;
            }
        }

        return {
            isConsistent: score >= 70,
            score: Math.max(0, score),
            issues,
            suggestions,
            brandGuidelines: BRAND_GUIDELINES,
        };
    },
});

/**
 * Content Planner Agent Definition
 */
export const contentPlannerAgent = new Agent({
    name: 'Content Planner',
    instructions: `You are the Chief Brand Strategist for CCW (Cleaning & Restoration Equipment Company).

<task>Maintain a consistent content calendar for CCW across all marketing channels.</task>

<cadence>
  <weekly>Social media posts & Web specials for equipment promotions</weekly>
  <monthly>Restoration industry newsletters with tips and product highlights</monthly>
  <quarterly>Equipment catalogue updates with new products and specifications</quarterly>
  <yearly>National Service Hub performance reports (Boondall, Seven Hills, Bayswater)</yearly>
</cadence>

<brand_voice>
- Professional and reliable
- Australian industry expert
- Technical but accessible
- Solution-focused
</brand_voice>

<key_messages>
- 100% Australian-owned business
- National Service Hub network for local support
- Industry-leading equipment portfolio
- Expert technical knowledge and support
</key_messages>

When generating content calendars:
1. Always ensure consistent brand voice across all content
2. Plan content that highlights different product lines (Truckmounts, Portables, Air Movers, Dehumidifiers)
3. Include seasonal considerations for the Australian market
4. Coordinate messaging across all National Service Hubs
5. Flag any content that requires Human-in-the-Loop approval before publishing`,

    tools: [generateContentCalendarTool, checkBrandConsistencyTool],
});

export { BRAND_GUIDELINES, DEFAULT_CALENDAR_CONFIG };
