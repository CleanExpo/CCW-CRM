import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';

const personas = [
  { label: 'Equipment Suppliers', color: '#ffffff' },
  { label: 'Trade Businesses', color: '#f59e0b' },
  { label: 'Australian SMEs', color: '#3b82f6' },
];

const stats = [
  { value: '14', label: 'modules' },
  { value: 'Real-time', label: 'sync' },
  { value: 'AI', label: 'powered' },
];

export const WhoItsForScene: React.FC = () => {
  const frame = useCurrentFrame();

  const builtForOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const statsOpacity = interpolate(frame, [60, 90], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
  const footerOpacity = interpolate(frame, [450, 550], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });

  return (
    <AbsoluteFill style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)', fontFamily: 'system-ui, -apple-system, sans-serif', display: 'flex', padding: 80 }}>
      {/* Left */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ opacity: builtForOpacity, fontSize: 36, color: '#94a3b8', fontWeight: 500, marginBottom: 24 }}>Built for</div>
        {personas.map((p, i) => {
          const opacity = interpolate(frame, [20 + i * 90, 40 + i * 90], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
          return (
            <div key={i} style={{ opacity, display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20 }}>
              <div style={{ width: 6, height: 52, background: p.color, borderRadius: 3, flexShrink: 0 }} />
              <span style={{ fontSize: 46, fontWeight: 800, color: p.color }}>{p.label}</span>
            </div>
          );
        })}
      </div>

      {/* Right */}
      <div style={{ width: 380, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 32, opacity: statsOpacity }}>
        {stats.map((s, i) => (
          <div key={i} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: '28px 36px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ fontSize: 52, fontWeight: 800, color: '#3b82f6' }}>{s.value}</div>
            <div style={{ fontSize: 22, color: '#94a3b8', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ opacity: footerOpacity, position: 'absolute', bottom: 32, left: 0, right: 0, textAlign: 'center', fontSize: 20, color: '#475569' }}>
        carpetcleanerswarehouse.com.au
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, #f59e0b, #10b981, #3b82f6)' }} />
    </AbsoluteFill>
  );
};
