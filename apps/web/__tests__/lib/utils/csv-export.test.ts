import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { convertToCSV, exportProductsToCSV, exportCustomersToCSV } from '@/lib/utils/csv-export';

// Mock browser APIs not available in jsdom
const mockClick = vi.fn();
const mockAppendChild = vi.fn();
const mockRemoveChild = vi.fn();
const mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url');
const mockRevokeObjectURL = vi.fn();

beforeEach(() => {
  vi.spyOn(document, 'createElement').mockReturnValue({
    setAttribute: vi.fn(),
    style: {},
    click: mockClick,
    download: 'test',
  } as unknown as HTMLElement);
  vi.spyOn(document.body, 'appendChild').mockImplementation(mockAppendChild);
  vi.spyOn(document.body, 'removeChild').mockImplementation(mockRemoveChild);
  global.URL.createObjectURL = mockCreateObjectURL;
  global.URL.revokeObjectURL = mockRevokeObjectURL;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('convertToCSV', () => {
  it('returns empty string for empty data', () => {
    expect(convertToCSV([], ['name', 'email'])).toBe('');
  });

  it('creates header row from headers array', () => {
    const result = convertToCSV([{ name: 'Alice', email: 'alice@test.com' }], ['name', 'email']);
    const lines = result.split('\n');
    expect(lines[0]).toBe('name,email');
  });

  it('creates data rows from objects', () => {
    const result = convertToCSV([{ name: 'Alice', email: 'alice@test.com' }], ['name', 'email']);
    const lines = result.split('\n');
    expect(lines[1]).toBe('Alice,alice@test.com');
  });

  it('handles null and undefined values as empty string', () => {
    const data = [{ name: 'Alice', email: null, phone: undefined }] as unknown as Record<
      string,
      unknown
    >[];
    const result = convertToCSV(data, ['name', 'email', 'phone']);
    const lines = result.split('\n');
    expect(lines[1]).toBe('Alice,,');
  });

  it('wraps values containing commas in quotes', () => {
    const data = [{ name: 'Smith, John', email: 'john@test.com' }];
    const result = convertToCSV(data, ['name', 'email']);
    expect(result).toContain('"Smith, John"');
  });

  it('escapes double quotes by doubling them', () => {
    const data = [{ name: 'He said "hello"', email: 'test@test.com' }];
    const result = convertToCSV(data, ['name', 'email']);
    expect(result).toContain('"He said ""hello"""');
  });

  it('handles multiple data rows', () => {
    const data = [
      { name: 'Alice', email: 'a@test.com' },
      { name: 'Bob', email: 'b@test.com' },
    ];
    const result = convertToCSV(data, ['name', 'email']);
    const lines = result.split('\n');
    expect(lines).toHaveLength(3); // header + 2 data rows
    expect(lines[2]).toBe('Bob,b@test.com');
  });

  it('includes only specified headers', () => {
    const data = [{ name: 'Alice', email: 'a@test.com', secret: 'hidden' }];
    const result = convertToCSV(data, ['name', 'email']);
    expect(result).not.toContain('secret');
    expect(result).not.toContain('hidden');
  });
});

describe('exportProductsToCSV', () => {
  it('triggers a file download', () => {
    exportProductsToCSV([
      {
        sku: 'SKU-001',
        name: 'Test Product',
        category: 'hand_tools',
        price: '99.99',
        cost: '50.00',
        stock: 10,
        is_active: true,
      },
    ]);
    expect(mockClick).toHaveBeenCalled();
  });

  it('handles empty product array', () => {
    // Should not throw
    expect(() => exportProductsToCSV([])).not.toThrow();
  });
});

describe('exportCustomersToCSV', () => {
  it('triggers a file download', () => {
    exportCustomersToCSV([
      {
        customer_number: 'C-001',
        company_name: 'Acme',
        contact_name: 'John',
        email: 'john@acme.com',
        phone: '0400000000',
        city: 'Brisbane',
        is_active: true,
      },
    ]);
    expect(mockClick).toHaveBeenCalled();
  });
});
