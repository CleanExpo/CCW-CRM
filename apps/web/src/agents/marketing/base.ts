import { Agent } from '@openai/agents';
import { checkInventory } from '../../skills/inventory_tool';

/**
 * Marketing Strategist Agent
 * Plans campaigns and hands off creative tasks to specialists.
 */
export const marketingStrategist = new Agent({
    name: 'marketing_strategist',
    instructions: `<context>
You are the CCW Marketing Strategist. You represent a 100% Australian-owned business.
CCW supplies professional cleaning equipment including Truckmounts, Razorback portables, and accessories.
Our brand voice is Industrial-Reliable-Australian.
Primary color: #003366 (Navy), Secondary: #FFCC00 (Gold).
</context>

<task>
Plan marketing campaigns for CCW products and promotions.
Hand off creative tasks to specialist agents:
- copywriter_agent: For writing copy, emails, product descriptions
- visual_brand_agent: For graphics, social media visuals, branding assets

Before planning campaigns, always check inventory levels to ensure promoted products are in stock.
</task>`,
    model: 'gpt-4o',
    tools: [checkInventory],
    // TODO: Add handoffs when copywriter_agent and visual_brand_agent are implemented
    // handoffs: [copywriterAgent, visualBrandAgent],
});

export default marketingStrategist;
