import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';

const badges = [
  { name: 'Shopify', color: '#96bf48' },
  { name: 'Xero', color: '#10b981' },
];

const automations = [
  { text: 'Shopify orders sync automatically to CCW ERP', color: '#96bf48' },
  { text: 'Xero invoices sync every night at 8pm', color: '#10b981' },
  { text: 'Dashboard updates in real-time', color: '#3b82f6' },
  { text: 'AI Assistant ready to answer questions about your business', color: '#8b5cf6' },
];

export const AllConnectedScene: React.FC = () => {
  const frame = useCurrentFrame();

  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const titleScale = interpolate(frame, [0, 20], [0.8, 1], { extrapolateRight: 'clamp' });
  const sectionOpacity = interpolate(frame, [120, 150], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });
  const ctaOpacity = interpolate(frame, [360, 420], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(135deg, #0f172a, #052e16)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 80px',
      }}
    >
      <div
        style={{
          opacity: titleOpacity,
          transform: `scale(${titleScale})`,
          textAlign: 'center',
          marginBottom: 40,
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: 'rgba(16,185,129,0.2)',
            border: '3px solid #10b981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            fontSize: 36,
            fontWeight: 800,
            color: '#10b981',
          }}
        >
          ✓
        </div>
        <div style={{ fontSize: 72, fontWeight: 900, color: '#ffffff', lineHeight: 1.1 }}>
          You're Connected!
        </div>
      </div>

      {/* Service badges */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 48 }}>
        {badges.map((b, i) => {
          const opacity = interpolate(frame, [30 + i * 20, 50 + i * 20], [0, 1], {
            extrapolateRight: 'clamp',
            extrapolateLeft: 'clamp',
          });
          return (
            <div
              key={i}
              style={{
                opacity,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10,
                background: `${b.color}15`,
                border: `2px solid ${b.color}`,
                borderRadius: 16,
                padding: '20px 32px',
              }}
            >
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: b.color }} />
              <div style={{ fontSize: 22, fontWeight: 700, color: b.color }}>{b.name}</div>
              <div style={{ fontSize: 14, color: '#10b981', fontWeight: 600, letterSpacing: 1 }}>
                CONNECTED
              </div>
            </div>
          );
        })}
      </div>

      {/* Automations */}
      <div style={{ opacity: sectionOpacity, width: '100%', maxWidth: 900, marginBottom: 40 }}>
        <div
          style={{
            fontSize: 22,
            color: '#94a3b8',
            marginBottom: 20,
            textAlign: 'center',
            fontWeight: 600,
          }}
        >
          What happens now:
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {automations.map((a, i) => {
            const aOpacity = interpolate(frame, [150 + i * 60, 175 + i * 60], [0, 1], {
              extrapolateRight: 'clamp',
              extrapolateLeft: 'clamp',
            });
            return (
              <div
                key={i}
                style={{
                  opacity: aOpacity,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  fontSize: 22,
                  color: '#e2e8f0',
                  padding: '14px 24px',
                  background: `${a.color}08`,
                  borderLeft: `3px solid ${a.color}`,
                  borderRadius: '0 8px 8px 0',
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: a.color,
                    flexShrink: 0,
                  }}
                />
                {a.text}
              </div>
            );
          })}
        </div>
      </div>

      <div
        style={{
          opacity: ctaOpacity,
          fontSize: 30,
          fontWeight: 700,
          color: '#3b82f6',
          marginBottom: 12,
        }}
      >
        Open your CCW Dashboard →
      </div>
      <div style={{ opacity: ctaOpacity, fontSize: 20, color: '#475569' }}>
        Need help? support@unite-group.in
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 6,
          background: 'linear-gradient(90deg, #96bf48, #10b981, #96bf48)',
        }}
      />
    </AbsoluteFill>
  );
};
