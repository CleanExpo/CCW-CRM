export type PosLocation = {
  id: string;
  code: string;
  name: string;
  location_type: 'physical' | 'virtual';
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string;
  timezone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PosStaff = {
  id: string;
  staff_code: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  primary_location_code: string;
  can_sell_at_locations: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PosTerminal = {
  id: string;
  terminal_id: string;
  location_code: string;
  terminal_type: 'physical' | 'virtual' | 'counter';
  is_active: boolean;
  merchant_id: string | null;
  last_ping_at: string | null;
};

type PosStore = {
  locations: PosLocation[];
  staff: PosStaff[];
  terminals: PosTerminal[];
};

/** Per-org store map. Key = userId (ownerUserId / workspace owner). */
const STORE_KEY = '__ccwPosStoreByUser__';

function nowIso() {
  return new Date().toISOString();
}

function seedStore(): PosStore {
  const now = nowIso();
  return {
    locations: [
      {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
        code: 'brisbane',
        name: 'Brisbane',
        location_type: 'physical',
        address: null,
        city: 'Brisbane',
        state: 'QLD',
        postal_code: null,
        country: 'Australia',
        timezone: 'Australia/Brisbane',
        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
        code: 'sydney',
        name: 'Sydney',
        location_type: 'physical',
        address: null,
        city: 'Sydney',
        state: 'NSW',
        postal_code: null,
        country: 'Australia',
        timezone: 'Australia/Sydney',
        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
        code: 'melbourne',
        name: 'Melbourne',
        location_type: 'physical',
        address: null,
        city: 'Melbourne',
        state: 'VIC',
        postal_code: null,
        country: 'Australia',
        timezone: 'Australia/Melbourne',
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    ],
    staff: [
      {
        id: 'cccccccc-cccc-cccc-cccc-ccccccccccc1',
        staff_code: 'QLD-ALEX',
        full_name: 'Alex Morgan',
        email: 'alex@example.com',
        phone: null,
        primary_location_code: 'brisbane',
        can_sell_at_locations: ['brisbane'],
        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: 'cccccccc-cccc-cccc-cccc-ccccccccccc2',
        staff_code: 'NSW-SAM',
        full_name: 'Sam Taylor',
        email: 'sam@example.com',
        phone: null,
        primary_location_code: 'sydney',
        can_sell_at_locations: ['sydney'],
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    ],
    terminals: [
      {
        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
        terminal_id: 'TERM-BNE-01',
        location_code: 'brisbane',
        terminal_type: 'counter',
        is_active: true,
        merchant_id: null,
        last_ping_at: null,
      },
      {
        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
        terminal_id: 'TERM-SYD-01',
        location_code: 'sydney',
        terminal_type: 'counter',
        is_active: true,
        merchant_id: null,
        last_ping_at: null,
      },
    ],
  };
}

type StoreMap = Map<string, PosStore>;

function getStoreMap(): StoreMap {
  const g = globalThis as typeof globalThis & { [STORE_KEY]?: StoreMap };
  if (!g[STORE_KEY]) {
    g[STORE_KEY] = new Map<string, PosStore>();
  }
  return g[STORE_KEY] as StoreMap;
}

/**
 * Returns the POS store scoped to the authenticated user/org.
 *
 * Each userId gets its own isolated data set — no cross-tenant reads possible.
 * All POS route handlers MUST supply the userId resolved from the JWT, never
 * a value from the request body or query string.
 */
export function getPosStore(userId: string): PosStore {
  const map = getStoreMap();
  if (!map.has(userId)) {
    map.set(userId, seedStore());
  }
  return map.get(userId) as PosStore;
}

/** Reset a specific user's store (test helper — not exported to production routes). */
export function _resetPosStoreForUser(userId: string): void {
  getStoreMap().delete(userId);
}

/** Clear all stores (test helper). */
export function _resetAllPosStores(): void {
  getStoreMap().clear();
}
