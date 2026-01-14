import { tool } from '@openai/agents';
import { z } from 'zod';

/**
 * Check Inventory Tool
 * Checks real-time stock levels across AU warehouses.
 */
export const checkInventory = tool({
    name: 'check_inventory',
    description: 'Checks real-time stock levels across AU warehouses (QLD, NSW, VIC).',
    parameters: z.object({
        sku: z.string().describe('The product SKU to check'),
        location: z.enum(['QLD', 'NSW', 'VIC']).describe('Warehouse location'),
    }),
    execute: async ({ sku, location }) => {
        // TODO: Connect to actual inventory system
        console.log(`[Inventory Check] SKU: ${sku}, Location: ${location}`);

        // Mock response for development
        const mockStock: Record<string, number> = {
            'TM-001': 5,
            'RB-100': 12,
            'ACC-050': 24,
        };

        const stockLevel = mockStock[sku] ?? Math.floor(Math.random() * 10);

        return {
            sku,
            location,
            stockLevel,
            status: stockLevel > 0 ? 'in_stock' : 'out_of_stock',
            lastUpdated: new Date().toISOString(),
        };
    },
});

export default checkInventory;
