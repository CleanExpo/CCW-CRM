import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';

const modules = [
  { name: 'Products & Catalogue', color: '#3b82f6' },
  { name: 'Customers & CRM', color: '#8b5cf6' },
  { name: 'Orders & Fulfilment', color: '#06b6d4' },
  { name: 'Quotes & Proposals', color: '#10b981' },
  { name: 'Point of Sale', color: '#f59e0b' },
  { name: 'Invoicing & Billing', color: '#ef4444' },
  { name: 'Warehouse Ops', color: '#3b82f6' },
  { name: 'Suppliers', color: '#8b5cf6' },
  { name: 'Purchase Orders', color: '#06b6d4' },
  { name: 'Contacts', color: '#10b981' },
  { name: 'Reports & Analytics', color: '#f59e0b' },
  { name: 'Workflow Automation', color: '#ef4444' },
  { name: 'AI Assistant', color: '#3b82f6' },
  { name: 'Shopify + Xero', color: '#96bf48' },
];

const screenshots = [
  'images/dashboard.png',
  'images/orders.png',
  'images/products.png',
  'images/customers.png',
  'images/quotes.png',
];

export const ModuleShowcaseScene: React.FC = () => {
  const frame = useCurrentFrame();

  const headerOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const footerOpacity = interpolate(frame, [1200, 1300], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  // Cycle through screenshots every 270 frames
  const screenshotIndex = Math.floor(frame / 270) % screenshots.length;
  const screenshotFade = interpolate(frame % 270, [0, 20], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: '#0f172a',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        padding: '48px 64px',
      }}
    >
      <div
        style={{
          opacity: headerOpacity,
          fontSize: 40,
          fontWeight: 700,
          color: '#ffffff',
          marginBottom: 36,
          textAlign: 'center',
        }}
      >
        Everything you need. <span style={{ color: '#3b82f6' }}>One system.</span>
      </div>

      <div style={{ display: 'flex', gap: 40, flex: 1, minHeight: 0 }}>
        {/* Left: rotating screenshot */}
        <div
          style={{
            flex: '0 0 56%',
            position: 'relative',
            borderRadius: 12,
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
          }}
        >
          <div style={{ position: 'absolute', inset: 0, background: '#1e293b' }} />
          <Img
            src={staticFile(screenshots[screenshotIndex])}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'top',
              opacity: screenshotFade,
            }}
          />
          {/* Browser chrome bar */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 32,
              background: 'rgba(15,23,42,0.85)',
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 12,
              gap: 6,
            }}
          >
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981' }} />
            <div style={{ marginLeft: 8, fontSize: 11, color: '#475569', fontFamily: 'monospace' }}>
              ccw-crm-web.vercel.app
            </div>
          </div>
        </div>

        {/* Right: module list */}
        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px 16px',
            alignContent: 'start',
          }}
        >
          {modules.map((mod, i) => {
            const delay = 20 + i * 80;
            const opacity = interpolate(frame, [delay, delay + 20], [0, 1], {
              extrapolateRight: 'clamp',
              extrapolateLeft: 'clamp',
            });
            const x = interpolate(frame, [delay, delay + 20], [20, 0], {
              extrapolateRight: 'clamp',
              extrapolateLeft: 'clamp',
            });
            return (
              <div
                key={i}
                style={{
                  opacity,
                  transform: `translateX(${x}px)`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 12px',
                  borderRadius: 8,
                  background: `${mod.color}10`,
                  border: `1px solid ${mod.color}30`,
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: mod.color,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 15, color: '#e2e8f0', fontWeight: 500 }}>{mod.name}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div
        style={{
          opacity: footerOpacity,
          textAlign: 'center',
          marginTop: 20,
          fontSize: 26,
          color: '#60a5fa',
          fontWeight: 600,
        }}
      >
        14 modules. Zero compromise.
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 4,
          background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #06b6d4, #10b981)',
        }}
      />
    </AbsoluteFill>
  );
};
