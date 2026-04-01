import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';

// Vercel env vars are pre-configured — only 3 user-action connections needed
const services = [
  { icon: '🛒', name: 'Shopify' },
  { icon: '💼', name: 'Xero' },
  { icon: '🗄️', name: 'Supabase' },
];

export const ConnectionsIntroScene: React.FC = () => {
  const frame = useCurrentFrame();

  const h1Opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const h1Scale = interpolate(frame, [0, 20], [0.8, 1], { extrapolateRight: 'clamp' });
  const h2Opacity = interpolate(frame, [20, 40], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
  const bodyOpacity = interpolate(frame, [40, 65], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
  const footerOpacity = interpolate(frame, [450, 540], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });

  return (
    <AbsoluteFill style={{ background: '#0f172a', fontFamily: 'system-ui, -apple-system, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 80 }}>
      <div style={{ opacity: h1Opacity, transform: `scale(${h1Scale})`, fontSize: 100, fontWeight: 900, color: '#ffffff', textAlign: 'center', lineHeight: 1 }}>
        3 Connections.
      </div>
      <div style={{ opacity: h2Opacity, fontSize: 72, fontWeight: 700, color: '#f59e0b', marginTop: 12, marginBottom: 32, textAlign: 'center' }}>
        20 minutes.
      </div>
      <div style={{ opacity: bodyOpacity, fontSize: 28, color: '#94a3b8', textAlign: 'center', maxWidth: 800, lineHeight: 1.5, marginBottom: 60 }}>
        Vercel is pre-configured. Just connect your Shopify, Xero, and Supabase.
      </div>

      <div style={{ display: 'flex', gap: 40, justifyContent: 'center' }}>
        {services.map((s, i) => {
          const sOpacity = interpolate(frame, [90 + i * 40, 110 + i * 40], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
          return (
            <div key={i} style={{ opacity: sOpacity, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '24px 32px' }}>
              <span style={{ fontSize: 48 }}>{s.icon}</span>
              <span style={{ fontSize: 22, color: '#e2e8f0', fontWeight: 600 }}>{s.name}</span>
            </div>
          );
        })}
      </div>

      <div style={{ opacity: footerOpacity, marginTop: 48, fontSize: 22, color: '#475569', textAlign: 'center' }}>
        Follow along. Pause and repeat each step.
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, #96bf48, #10b981, #3ecf8e)' }} />
    </AbsoluteFill>
  );
};
