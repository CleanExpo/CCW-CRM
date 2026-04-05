import { describe, it, expect } from 'vitest';
import type {
  MarketplaceConnection,
  MarketplaceProductListing,
  MarketplaceOrder,
  MarketplaceInventorySync,
  MarketplaceSyncLog,
} from '@/lib/types/marketplace';
import {
  ChannelType,
  ConnectionStatus,
  ListingStatus,
  SyncStatus,
  MarketplaceOrderStatus,
} from '@/lib/types/marketplace';

describe('Marketplace Types', () => {
  describe('Enums', () => {
    it('should have correct ChannelType values', () => {
      expect(ChannelType.SHOPIFY).toBe('shopify');
      expect(ChannelType.EBAY).toBe('ebay');
      expect(ChannelType.FACEBOOK).toBe('facebook');
    });

    it('should have correct ConnectionStatus values', () => {
      expect(ConnectionStatus.CONNECTED).toBe('connected');
      expect(ConnectionStatus.DISCONNECTED).toBe('disconnected');
      expect(ConnectionStatus.ERROR).toBe('error');
      expect(ConnectionStatus.PENDING).toBe('pending');
    });

    it('should have correct MarketplaceOrderStatus values', () => {
      expect(MarketplaceOrderStatus.PENDING).toBe('pending');
      expect(MarketplaceOrderStatus.CONFIRMED).toBe('confirmed');
      expect(MarketplaceOrderStatus.SHIPPED).toBe('shipped');
      expect(MarketplaceOrderStatus.DELIVERED).toBe('delivered');
    });
  });

  describe('MarketplaceConnection Type', () => {
    it('should match backend contract', () => {
      const mockConnection: MarketplaceConnection = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        channel_type: ChannelType.SHOPIFY,
        display_name: 'My Shopify Store',
        status: ConnectionStatus.CONNECTED,
        is_active: true,
        mode: 'live',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      expect(mockConnection.id).toBeDefined();
      expect(mockConnection.channel_type).toBe(ChannelType.SHOPIFY);
      expect(mockConnection.status).toBe(ConnectionStatus.CONNECTED);
    });
  });

  describe('MarketplaceOrder Type', () => {
    it('should match backend contract', () => {
      const mockOrder: MarketplaceOrder = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        channel_type: ChannelType.SHOPIFY,
        connection_id: '123e4567-e89b-12d3-a456-426614174000',
        external_order_id: 'shopify-12345',
        status: MarketplaceOrderStatus.CONFIRMED,
        currency: 'AUD',
        sync_status: 'pending',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      expect(mockOrder.id).toBeDefined();
      expect(mockOrder.channel_type).toBe(ChannelType.SHOPIFY);
      expect(mockOrder.status).toBe(MarketplaceOrderStatus.CONFIRMED);
    });
  });

  describe('MarketplaceInventorySync Type', () => {
    it('should match backend contract', () => {
      const mockSync: MarketplaceInventorySync = {
        id: '123e4567-e89b-12d3-a456-426614174002',
        product_id: '123e4567-e89b-12d3-a456-426614174003',
        channel_type: ChannelType.EBAY,
        connection_id: '123e4567-e89b-12d3-a456-426614174000',
        local_quantity: 100,
        remote_quantity: 95,
        quantity_delta: -5,
        sync_status: SyncStatus.SUCCESS,
        sync_direction: 'push',
        synced_at: '2024-01-01T00:00:00Z',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      expect(mockSync.id).toBeDefined();
      expect(mockSync.sync_status).toBe(SyncStatus.SUCCESS);
      expect(mockSync.quantity_delta).toBe(-5);
    });
  });
});
