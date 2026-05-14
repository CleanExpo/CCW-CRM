import type {
  ChannelInfo,
  ConnectResponse,
  OrderFeedResponse,
  ProductListing,
  SyncInventoryResponse,
  SyncProductsResponse,
  SyncStatusResponse,
  UnifiedProductsResponse,
  BulkUnlistResponse,
  BulkUnlistItem,
} from '@/lib/api/marketplace';

const CHANNEL_TYPES = ['shopify', 'ebay', 'facebook'] as const;

function setupFields(channelType: string) {
  if (channelType === 'shopify') {
    return [
      {
        key: 'shop_domain',
        label: 'Shop domain',
        type: 'text' as const,
        required: false,
        placeholder: 'your-store.myshopify.com',
      },
      {
        key: 'access_token',
        label: 'Admin API access token',
        type: 'password' as const,
        required: false,
        placeholder: 'shpat_…',
      },
    ];
  }
  if (channelType === 'ebay') {
    return [
      {
        key: 'client_id',
        label: 'eBay Client ID',
        type: 'text' as const,
        required: false,
        placeholder: 'App client ID',
      },
      {
        key: 'client_secret',
        label: 'eBay Client Secret',
        type: 'password' as const,
        required: false,
        placeholder: 'App secret',
      },
    ];
  }
  return [
    {
      key: 'page_access_token',
      label: 'Page access token',
      type: 'password' as const,
      required: false,
      placeholder: 'Long-lived token',
    },
  ];
}

const displayName: Record<string, string> = {
  shopify: 'Shopify',
  ebay: 'eBay',
  facebook: 'Facebook Marketplace',
};

const connected = new Map<string, Set<string>>();

function connSet(userId: string): Set<string> {
  let s = connected.get(userId);
  if (!s) {
    s = new Set();
    connected.set(userId, s);
  }
  return s;
}

export function isMarketplaceDemo(): boolean {
  return process.env.MARKETPLACE_MODE !== 'live';
}

export function listChannelInfos(userId: string): ChannelInfo[] {
  const demo = isMarketplaceDemo();
  const set = connSet(userId);
  return CHANNEL_TYPES.map((channel_type) => ({
    channel_type,
    display_name: displayName[channel_type] ?? channel_type,
    connected: set.has(channel_type),
    mode: demo ? 'demo' : 'live',
    status: set.has(channel_type) ? ('connected' as const) : ('disconnected' as const),
    last_product_sync: null,
    last_inventory_sync: null,
    last_order_sync: null,
    setup_fields: setupFields(channel_type),
  }));
}

export function connectChannel(
  userId: string,
  channelType: string
): ConnectResponse {
  if (!CHANNEL_TYPES.includes(channelType as (typeof CHANNEL_TYPES)[number])) {
    return {
      success: false,
      channel_type: channelType,
      message: 'Unknown channel type.',
      mode: isMarketplaceDemo() ? 'demo' : 'live',
    };
  }
  connSet(userId).add(channelType);
  return {
    success: true,
    channel_type: channelType,
    message: isMarketplaceDemo()
      ? 'Connected in demo mode — listings and orders stay mocked until marketplace adapters are live.'
      : 'Channel marked connected. Configure upstream marketplace credentials in your deployment environment.',
    mode: isMarketplaceDemo() ? 'demo' : 'live',
  };
}

export function disconnectChannel(userId: string, channelType: string): ConnectResponse {
  connSet(userId).delete(channelType);
  return {
    success: true,
    channel_type: channelType,
    message: 'Disconnected.',
    mode: isMarketplaceDemo() ? 'demo' : 'live',
  };
}

export function syncStatus(userId: string): SyncStatusResponse {
  const checked_at = new Date().toISOString();
  const channels: SyncStatusResponse['channels'] = {};
  for (const c of listChannelInfos(userId)) {
    channels[c.channel_type] = {
      connected: c.connected,
      channel_type: c.channel_type,
      display_name: c.display_name,
      message: c.connected
        ? isMarketplaceDemo()
          ? 'Demo channel — no outbound marketplace API calls.'
          : 'Channel registered; sync workers should pick up from here.'
        : 'Not connected',
      metadata: { demo: isMarketplaceDemo() },
      checked_at,
    };
  }
  const overall_healthy = isMarketplaceDemo() || Object.values(channels).every((c) => !c.connected);
  return { channels, overall_healthy, checked_at };
}

export function orderFeed(userId: string): OrderFeedResponse {
  void userId;
  return { orders: [], total: 0, channels: [...CHANNEL_TYPES] };
}

export function channelProducts(_userId: string, _channelType: string): ProductListing[] {
  return [];
}

export function syncProducts(userId: string): SyncProductsResponse {
  const set = connSet(userId);
  const results: SyncProductsResponse['results'] = {};
  const synced_at = new Date().toISOString();
  for (const t of CHANNEL_TYPES) {
    if (!set.has(t)) continue;
    results[t] = { pushed: 0, failed: 0, products: [] };
  }
  return { success: true, results, synced_at };
}

export function syncInventory(userId: string): SyncInventoryResponse {
  const set = connSet(userId);
  const results: SyncInventoryResponse['results'] = {};
  const synced_at = new Date().toISOString();
  for (const t of CHANNEL_TYPES) {
    if (!set.has(t)) continue;
    results[t] = { synced: 0, failed: 0, errors: [] };
  }
  return { success: true, results, synced_at };
}

export function unifiedProducts(_userId: string): UnifiedProductsResponse {
  return { products: [], total: 0, channels: [...CHANNEL_TYPES] };
}

export function bulkUnlist(_userId: string, items: BulkUnlistItem[]): BulkUnlistResponse {
  const results: BulkUnlistResponse['results'] = {};
  for (const it of items) {
    const key = `${it.channel_type}:${it.external_id}`;
    results[key] = {
      success: true,
      channel_type: it.channel_type,
      external_id: it.external_id,
    };
  }
  return { results, success_count: items.length, failed_count: 0 };
}
