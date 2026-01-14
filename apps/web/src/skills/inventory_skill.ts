import { tool } from '@openai/agents';
import { z } from 'zod';

/**
 * CCW Warehouse Locations
 */
export const WAREHOUSE_LOCATIONS = {
    Boondall: { state: 'QLD', city: 'Brisbane' },
    'Seven Hills': { state: 'NSW', city: 'Sydney' },
    Bayswater: { state: 'VIC', city: 'Melbourne' },
} as const;

export type WarehouseLocation = keyof typeof WAREHOUSE_LOCATIONS;

/**
 * Check Warehouse Stock Tool
 * Queries real-time stock levels across CCW warehouses.
 */
export const checkWarehouseStock = tool({
    name: 'check_warehouse_stock',
    description: 'Checks real-time stock levels at CCW warehouses (Boondall QLD, Seven Hills NSW, Bayswater VIC).',
    parameters: z.object({
        sku: z.string().describe('The product SKU to check'),
        location: z.enum(['Boondall', 'Seven Hills', 'Bayswater']).describe('CCW warehouse location'),
    }),
    execute: async ({ sku, location }) => {
        // Build XML query wrapper for ERP system
        const queryParams = `<query_params><sku>${sku}</sku><loc>${location}</loc></query_params>`;

        console.log(`[Inventory Query] ${queryParams}`);

        // TODO: Connect to actual inventory/ERP system
        // Mock response for development
        const mockStock: Record<string, Record<string, number>> = {
            'TM-PRO-500': { Boondall: 3, 'Seven Hills': 5, Bayswater: 2 },
            'RB-COMPACT-200': { Boondall: 8, 'Seven Hills': 12, Bayswater: 6 },
            'ACC-WAND-01': { Boondall: 24, 'Seven Hills': 18, Bayswater: 15 },
        };

        const stockLevel = mockStock[sku]?.[location] ?? Math.floor(Math.random() * 10);
        const warehouseInfo = WAREHOUSE_LOCATIONS[location as WarehouseLocation];

        return {
            sku,
            location,
            warehouse: {
                name: location,
                state: warehouseInfo.state,
                city: warehouseInfo.city,
            },
            stockLevel,
            status: stockLevel > 0 ? 'in_stock' : 'out_of_stock',
            lowStock: stockLevel > 0 && stockLevel < 5,
            queryXml: queryParams,
            lastUpdated: new Date().toISOString(),
        };
    },
});

export default checkWarehouseStock;
