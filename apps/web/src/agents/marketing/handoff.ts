import { Agent, handoff } from '@openai/agents';

/**
 * CCW Copywriter Agent
 * Writes industrial-focused marketing copy for CCW products.
 */
const copywriter = new Agent({
    name: 'CCW_Copywriter',
    instructions: `<context>
You are the CCW Copywriter with an industrial expert voice.
CCW is 100% Australian-owned, supplying professional cleaning equipment.
Brand colors: Navy (#003366), Gold (#FFCC00).
</context>

<task>
Write compelling ads, product descriptions, and marketing copy for:
- Razorback portable cleaning machines
- Truckmount carpet cleaning systems
- Cleaning accessories and chemicals

Maintain an Industrial-Reliable-Australian tone.
</task>`,
    model: 'gpt-4o',
});

/**
 * Visual Brand Agent
 * Handles graphics and visual brand assets.
 */
const visualBrand = new Agent({
    name: 'CCW_Visual_Brand',
    instructions: `<context>
You are the CCW Visual Brand specialist.
Brand guidelines: Navy (#003366) primary, Gold (#FFCC00) accent.
</context>

<task>
Create briefs for graphics, social media visuals, and branding assets.
Ensure all visuals align with CCW's industrial-reliable identity.
</task>`,
    model: 'gpt-4o',
});

/**
 * Marketing Strategist Agent (with Handoffs)
 * Routes marketing requests to specialist agents.
 */
export const strategist = new Agent({
    name: 'Marketing_Strategist',
    instructions: `<context>
You are the CCW Marketing Strategist coordinating campaigns.
CCW is 100% Australian-owned with hubs in QLD, NSW, and VIC.
</context>

<task>
Route marketing requests to the appropriate specialist:
- Copywriting tasks → transfer_to_creative_team (Copywriter)
- Visual/graphic tasks → transfer_to_visual_team (Visual Brand)

Always check inventory before promoting products.
</task>`,
    model: 'gpt-4o',
    handoffs: [
        handoff(copywriter, { toolNameOverride: 'transfer_to_creative_team' }),
        handoff(visualBrand, { toolNameOverride: 'transfer_to_visual_team' }),
    ],
});

export { copywriter, visualBrand };
export default strategist;
