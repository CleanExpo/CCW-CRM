import type { Insight } from '@/lib/api/ai-insights';

/** Aggregated dashboard payload shape (mirrors `/api/dashboard/aggregated`). */
export interface DashboardDemoAggregated {
  metrics: {
    total_revenue_this_month: string;
    active_orders: number;
    total_products: number;
    total_customers: number;
    low_stock_alerts: number;
    pending_quotes: number;
  };
  revenue_chart: { month: string; revenue: string }[];
  category_sales: { category: string; value: string; percentage: number }[];
  top_products: { name: string; revenue: string; quantity_sold: number }[];
  inventory_status: {
    warehouse: string;
    in_stock: number;
    low_stock: number;
    out_of_stock: number;
  }[];
  recent_activity: {
    type: string;
    title: string;
    description: string;
    timestamp: string;
    status: string | null;
  }[];
  rollup: 'demo';
}

export const DASHBOARD_DEMO_AGGREGATED: DashboardDemoAggregated = {
  rollup: 'demo',
  metrics: {
    total_revenue_this_month: '284750.5',
    active_orders: 42,
    total_products: 1864,
    total_customers: 328,
    low_stock_alerts: 7,
    pending_quotes: 19,
  },
  revenue_chart: [
    { month: 'Sep', revenue: '198000' },
    { month: 'Oct', revenue: '223400' },
    { month: 'Nov', revenue: '241200' },
    { month: 'Dec', revenue: '258900' },
    { month: 'Jan', revenue: '269300' },
    { month: 'Feb', revenue: '284750.5' },
  ],
  category_sales: [
    { category: 'Truckmounts', value: '98500', percentage: 35 },
    { category: 'Restoration', value: '67200', percentage: 24 },
    { category: 'Hard floor', value: '54800', percentage: 19 },
    { category: 'Accessories', value: '64250.5', percentage: 22 },
  ],
  top_products: [
    { name: 'ProExtract 500 Truckmount', revenue: '42800', quantity_sold: 14 },
    { name: 'AirPath HEPA Restoration Kit', revenue: '31200', quantity_sold: 62 },
    { name: 'Orbital Scrubber 17"', revenue: '28950', quantity_sold: 23 },
    { name: 'Chemical Dilution Station', revenue: '22100', quantity_sold: 31 },
    { name: 'Commercial Wet Vac 90L', revenue: '18750', quantity_sold: 28 },
  ],
  inventory_status: [
    { warehouse: 'Brisbane', in_stock: 842, low_stock: 3, out_of_stock: 0 },
    { warehouse: 'Sydney', in_stock: 691, low_stock: 2, out_of_stock: 1 },
    { warehouse: 'Melbourne', in_stock: 331, low_stock: 2, out_of_stock: 0 },
  ],
  recent_activity: [
    {
      type: 'order',
      title: 'Order SO-10482',
      description: 'Status: processing — $12,450.00 · Truckmount bundle',
      timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      status: 'processing',
    },
    {
      type: 'quote',
      title: 'Quote QT-8891',
      description: 'Sent to Northside Cleaning Supplies — awaiting response',
      timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      status: 'sent',
    },
    {
      type: 'order',
      title: 'Order SO-10479',
      description: 'Status: delivered — $3,210.00',
      timestamp: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
      status: 'delivered',
    },
    {
      type: 'customer',
      title: 'Customer updated',
      description: 'Metro Equipment Wholesalers — credit terms refreshed',
      timestamp: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
      status: null,
    },
    {
      type: 'order',
      title: 'Order SO-10471',
      description: 'Status: picking — $8,940.00',
      timestamp: new Date(Date.now() - 1000 * 60 * 520).toISOString(),
      status: 'picking',
    },
    {
      type: 'quote',
      title: 'Quote QT-8884',
      description: 'Converted to order SO-10468',
      timestamp: new Date(Date.now() - 1000 * 60 * 900).toISOString(),
      status: 'accepted',
    },
  ],
};

export type DemoUrgentItem = {
  type: 'warranty' | 'certification' | 'invoice' | 'stock';
  label: string;
  detail: string;
  daysLeft?: number;
  href: string;
};

export const DASHBOARD_DEMO_URGENT: DemoUrgentItem[] = [
  {
    type: 'stock',
    label: '3 SKUs below reorder in Sydney',
    detail: 'Review suggested transfers from Brisbane',
    daysLeft: 2,
    href: '/inventory',
  },
  {
    type: 'warranty',
    label: 'Warranty follow-up: TM-2400 batch',
    detail: 'Customer: Coastal Commercial Cleaning',
    daysLeft: 14,
    href: '/warehouse',
  },
];

export const DASHBOARD_DEMO_INSIGHTS: Insight[] = [
  {
    id: 'demo-1',
    title: 'Quote-to-order cycle tightened',
    finding: 'Average time from sent quote to accepted order improved versus last month.',
    impact: 'Faster conversion frees sales capacity for net-new accounts.',
    recommendation: 'Keep follow-up templates for quotes idle more than 48 hours.',
    priority: 'high',
    category: 'sales',
    generated_at: new Date().toISOString(),
  },
  {
    id: 'demo-2',
    title: 'Low-stock SKUs cluster in restoration',
    finding: 'A small set of SKUs drives most low-stock alerts.',
    impact: 'Stockouts risk delaying high-value restoration jobs.',
    recommendation: 'Raise reorder points for the top five SKUs in that category.',
    priority: 'high',
    category: 'inventory',
    generated_at: new Date().toISOString(),
  },
  {
    id: 'demo-3',
    title: 'Regional revenue balanced',
    finding: 'Brisbane and Sydney are within 8% of each other month-to-date.',
    impact: 'Healthy diversification reduces single-site fulfilment risk.',
    recommendation: 'Maintain transfer rules between branches as volume grows.',
    priority: 'high',
    category: 'operations',
    generated_at: new Date().toISOString(),
  },
];
