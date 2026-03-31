import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';

const checks = [
  { label: 'Cin7: Settings → Integrations → Cin7 → Click "Test Connection"', color: '#f59e0b' },
  { label: 'Xero: Settings → Integrations → Xero → Click "Connect Xero"', color: '#10b981' },
  { label: 'Supabase: Dashboard loads without errors ✓', color: '#3ecf8e' },
  { label: 'Backend: Visit [railway-url]/api/health → returns 200 OK', color: '#a855f7' },
  { label: 'First Sync: Dashboard → Cin7 Sync → Click "Sync Now"', color: '#3b82f6' },
];

export const VerificationScene: React.FC = () => {
  const frame = useCurrentFrame();

  const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const allGreenOpacity = interpolate(frame, [1100, 1150], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });

  return (
    <AbsoluteFill style={{ background: '#0f172a', fontFamily: 'system-ui, -apple-system, sans-serif', display: 'flex', flexDirection: 'column', padding: 80 }}>
      {/* Header */}
      <div style={{ opacity: titleOpacity, display: 'flex', alignItems: 'center', gap: 16, marginBottom: 60, paddingBottom: 24, borderBottom: '3px solid #3b82f6' }}>
        <span style={{ fontSize: 48 }}>🧪</span>
        <div>
          <div style={{ fontSize: 18, color: '#3b82f6', fontWeight: 600, letterSpacing: 2 }}>05 / 05</div>
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
              <div style={{ transform: `scale(${checkScale})`, fontSize: 36, minWidth: 44, textAlign: 'center' }}>✅</div>
              <div style={{ fontSize: 24, color: '#e2e8f0', lineHeight: 1.4 }}>{check.label}</div>
            </div>
          );
        })}
      </div>

      <div style={{ opacity: allGreenOpacity, textAlign: 'center', marginTop: 40, fontSize: 32, fontWeight: 700, color: '#10b981' }}>
        All 5 green? You're ready. 🚀
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, #f59e0b, #10b981, #3ecf8e, #a855f7, #3b82f6)' }} />
    </AbsoluteFill>
  );
};
