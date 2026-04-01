import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';

const checks = [
  { label: 'Shopify: Settings → Integrations → Shopify → Import Orders → Confirm orders appear', color: '#96bf48' },
  { label: 'Xero: Settings → Integrations → Xero → Connect Xero → Authorise → Confirm connected', color: '#10b981' },
  { label: 'Dashboard loads without errors — your data is flowing correctly ✓', color: '#3b82f6' },
];

export const VerificationScene: React.FC = () => {
  const frame = useCurrentFrame();

  const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const allGreenOpacity = interpolate(frame, [520, 560], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });

  return (
    <AbsoluteFill style={{ background: '#0f172a', fontFamily: 'system-ui, -apple-system, sans-serif', display: 'flex', flexDirection: 'column', padding: 80 }}>
      {/* Header */}
      <div style={{ opacity: titleOpacity, display: 'flex', alignItems: 'center', gap: 16, marginBottom: 60, paddingBottom: 24, borderBottom: '3px solid #3b82f6' }}>
        <div style={{ width: 52, height: 52, borderRadius: 12, background: 'rgba(59,130,246,0.2)', border: '2px solid #3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 800, color: '#3b82f6' }}>?</div>
        <div>
          <div style={{ fontSize: 18, color: '#3b82f6', fontWeight: 600, letterSpacing: 2 }}>Final Check</div>
          <div style={{ fontSize: 40, fontWeight: 800, color: '#ffffff' }}>Test Your Connections</div>
        </div>
      </div>

      {/* Checklist */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, flex: 1, justifyContent: 'center' }}>
        {checks.map((check, i) => {
          const delay = 60 + i * 200;
          const opacity = interpolate(frame, [delay, delay + 20], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
          const checkScale = interpolate(frame, [delay, delay + 15], [0.5, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
          return (
            <div key={i} style={{ opacity, display: 'flex', gap: 24, alignItems: 'center', padding: '20px 28px', background: `${check.color}10`, border: `1px solid ${check.color}40`, borderRadius: 12 }}>
              <div style={{ transform: `scale(${checkScale})`, width: 36, height: 36, borderRadius: '50%', background: `${check.color}22`, border: `2px solid ${check.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18, fontWeight: 800, color: check.color }}>✓</div>
              <div style={{ fontSize: 24, color: '#e2e8f0', lineHeight: 1.4 }}>{check.label}</div>
            </div>
          );
        })}
      </div>

      <div style={{ opacity: allGreenOpacity, textAlign: 'center', marginTop: 40, fontSize: 32, fontWeight: 700, color: '#10b981' }}>
        All green? You're live. 🚀
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, #96bf48, #10b981, #3b82f6)' }} />
    </AbsoluteFill>
  );
};
