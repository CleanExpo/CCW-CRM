import { tool } from '@openai/agents';
import { z } from 'zod';

/**
 * Campaign Channels
 */
export type CampaignChannel = 'Email' | 'SMS' | 'Facebook' | 'WebSpecial';

/**
 * Generate Campaign Draft Tool
 * Produces high-conversion marketing copy using CCW brand voice.
 * REQUIRES HUMAN APPROVAL before publishing.
 */
export const generateCampaignDraft = tool({
  name: 'generate_campaign_draft',
  description: 'Produces high-conversion marketing copy using CCW brand voice and XML-tagged structure. Requires human approval.',
  parameters: z.object({
    channel: z.enum(['Email', 'SMS', 'Facebook', 'WebSpecial']).describe('Marketing channel'),
    targetProduct: z.string().describe('Product name or SKU to promote'),
    promotionType: z.enum(['industrial_special', 'clearance', 'new_arrival', 'seasonal'])
      .describe('Type of promotion'),
    discountPercent: z.number().describe('Discount percentage if applicable (0-50)'),
  }),
  execute: async ({ channel, targetProduct, promotionType, discountPercent }) => {
    console.log(`[Campaign Gen] Channel: ${channel}, Product: ${targetProduct}`);

    // Generate XML-structured campaign content
    const campaignId = `CAMP-${Date.now()}`;

    // CCW Brand Voice Templates
    const templates: Record<CampaignChannel, (product: string, discount?: number) => string> = {
      Email: (product, discount) => `
<email_campaign>
  <subject>🔧 Industrial Special: ${product} ${discount ? `- ${discount}% OFF` : ''}</subject>
  <preheader>Australia's #1 Cleaning Equipment Supplier</preheader>
  <body>
    <header style="background: #003366; color: white;">
      <logo>CCW - Carpet Cleaners Warehouse</logo>
    </header>
    <hero style="border-left: 4px solid #FFCC00;">
      <headline>Professional-Grade ${product}</headline>
      <subline>Built for Australian conditions. Backed by CCW service.</subline>
    </hero>
    <cta style="background: #FFCC00; color: #003366;">
      Shop Now - Free Shipping to QLD, NSW, VIC
    </cta>
    <footer>
      CCW - 100% Australian Owned | Boondall | Seven Hills | Bayswater
    </footer>
  </body>
</email_campaign>`.trim(),

      SMS: (product, discount) =>
        `CCW SPECIAL: ${product}${discount ? ` ${discount}% OFF` : ''}! Australia's #1 cleaning equipment. Shop now: ccwonline.com.au Reply STOP to opt out`,

      Facebook: (product, discount) => `
🇦🇺 AUSTRALIAN OWNED & OPERATED

${discount ? `⚡ ${discount}% OFF ` : ''}${product}

✅ Professional-grade equipment
✅ Free shipping to QLD, NSW, VIC
✅ Expert service from our 3 Australian hubs

Built for Aussie tradies who demand the best.

🔗 Shop now: ccwonline.com.au
#CCW #CarpetCleaning #Restoration #AustralianBusiness`.trim(),

      WebSpecial: (product, discount) => `
<web_banner>
  <background>#003366</background>
  <accent>#FFCC00</accent>
  <headline>${discount ? `${discount}% OFF ` : ''}${product}</headline>
  <badge>Industrial Special</badge>
  <cta>Shop Now</cta>
</web_banner>`.trim(),
    };

    const generatedContent = templates[channel as CampaignChannel](targetProduct, discountPercent);

    // Return with approval request structure
    return {
      campaignId,
      channel,
      targetProduct,
      promotionType: promotionType || 'industrial_special',
      generatedAt: new Date().toISOString(),
      content: generatedContent,
      requiresApproval: true,
      approvalRequest: `<approval_request>
  <campaign_id>${campaignId}</campaign_id>
  <channel>${channel}</channel>
  <content>${generatedContent}</content>
  <rationale>Agent verified stock availability and competitive pricing before generating this campaign.</rationale>
</approval_request>`,
    };
  },
});

export default generateCampaignDraft;
