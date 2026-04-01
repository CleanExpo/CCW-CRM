import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';

const modules = [
  { icon: '📦', name: 'Products & Catalogue' },
  { icon: '👥', name: 'Customers & CRM' },
  { icon: '📋', name: 'Orders & Fulfilment' },
  { icon: '💬', name: 'Quotes & Proposals' },
  { icon: '🏪', name: 'Point of Sale' },
  { icon: '🧾', name: 'Invoicing & Billing' },
  { icon: '🏭', name: 'Warehouse Ops' },
  { icon: '🚚', name: 'Suppliers' },
  { icon: '📥', name: 'Purchase Orders' },
  { icon: '📞', name: 'Contacts' },
  { icon: '📊', name: 'Reports & Analytics' },
  { icon: '⚙️', name: 'Workflow Automation' },
  { icon: '🤖', name: 'AI Assistant' },
  { icon: '🛒', name: 'Shopify + Xero Sync' },
];

export const ModuleShowcaseScene: React.FC = () => {
  const frame = useCurrentFrame();

  const headerOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const screenshotOpacity = interpolate(frame, [0, 30], [0, 0.18], { extrapolateRight: 'clamp' });
  const footerOpacity = interpolate(frame, [1200, 1300], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });

  return (
    <AbsoluteFill style={{ background: '#0f172a', fontFamily: 'system-ui, -apple-system, sans-serif', padding: '50px 80px', display: 'flex', flexDirection: 'column' }}>
      {/* Real dashboard screenshot as subtle background texture */}
      <div style={{ position: 'absolute', inset: 0, opacity: screenshotOpacity, overflow: 'hidden' }}>
        <Img
          src={staticFile('images/dashboard.png')}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', filter: 'saturate(0.4)' }}
        />
      </div>

      <div style={{ opacity: headerOpacity, fontSize: 44, fontWeight: 700, color: '#ffffff', marginBottom: 40, textAlign: 'center', position: 'relative' }}>
        Everything you need. <span style={{ color: '#3b82f6' }}>One system.</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 20, flex: 1, position: 'relative' }}>
        {modules.map((mod, i) => {
          const delay = 40 + i * 60;
          const opacity = interpolate(frame, [delay, delay + 20], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
          const scale = interpolate(frame, [delay, delay + 20], [0.7, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
          return (
            <div key={i} style={{ opacity, transform: `scale(${scale})`, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 36 }}>{mod.icon}</span>
              <span style={{ fontSize: 17, color: '#e2e8f0', textAlign: 'center', fontWeight: 500, lineHeight: 1.3 }}>{mod.name}</span>
            </div>
          );
        })}
        {/* Filler div for grid alignment */}
        <div />
      </div>

      <div style={{ opacity: footerOpacity, textAlign: 'center', marginTop: 24, fontSize: 28, color: '#60a5fa', fontWeight: 600, position: 'relative' }}>
        14 modules. Zero compromise.
      </div>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #06b6d4, #10b981)' }} />
    </AbsoluteFill>
  );
};
