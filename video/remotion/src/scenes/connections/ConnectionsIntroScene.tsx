import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';

// Clients only connect their own services — CCW manages all infrastructure
const services = [
  { color: '#96bf48', name: 'Shopify', label: 'Your store' },
  { color: '#10b981', name: 'Xero', label: 'Your accounting' },
];

export const ConnectionsIntroScene: React.FC = () => {
  const frame = useCurrentFrame();

  const h1Opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const h1Scale = interpolate(frame, [0, 20], [0.8, 1], { extrapolateRight: 'clamp' });
  const h2Opacity = interpolate(frame, [20, 40], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });
  const bodyOpacity = interpolate(frame, [40, 65], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });
  const footerOpacity = interpolate(frame, [450, 540], [0, 1], {
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
        alignItems: 'center',
        justifyContent: 'center',
        padding: 80,
      }}
    >
      <div
        style={{
          opacity: h1Opacity,
          transform: `scale(${h1Scale})`,
          fontSize: 100,
          fontWeight: 900,
          color: '#ffffff',
          textAlign: 'center',
          lineHeight: 1,
        }}
      >
        2 Connections.
      </div>
      <div
        style={{
          opacity: h2Opacity,
          fontSize: 72,
          fontWeight: 700,
          color: '#f59e0b',
          marginTop: 12,
          marginBottom: 32,
          textAlign: 'center',
        }}
      >
        10 minutes.
      </div>
      <div
        style={{
          opacity: bodyOpacity,
          fontSize: 28,
          color: '#94a3b8',
          textAlign: 'center',
          maxWidth: 800,
          lineHeight: 1.5,
          marginBottom: 60,
        }}
      >
        CCW manages all the infrastructure. You just connect your Shopify store and Xero account.
      </div>

      <div style={{ display: 'flex', gap: 40, justifyContent: 'center' }}>
        {services.map((s, i) => {
          const sOpacity = interpolate(frame, [90 + i * 40, 110 + i * 40], [0, 1], {
            extrapolateRight: 'clamp',
            extrapolateLeft: 'clamp',
          });
          return (
            <div
              key={i}
              style={{
                opacity: sOpacity,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
                background: `${s.color}10`,
                border: `2px solid ${s.color}60`,
                borderRadius: 16,
                padding: '28px 48px',
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: s.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                  fontWeight: 900,
                  color: '#000',
                  letterSpacing: -1,
                }}
              >
                {s.name[0]}
              </div>
              <span style={{ fontSize: 24, color: '#ffffff', fontWeight: 700 }}>{s.name}</span>
              <span style={{ fontSize: 14, color: s.color, fontWeight: 500, letterSpacing: 1 }}>
                {s.label.toUpperCase()}
              </span>
            </div>
          );
        })}
      </div>

      <div
        style={{
          opacity: footerOpacity,
          marginTop: 48,
          fontSize: 22,
          color: '#475569',
          textAlign: 'center',
        }}
      >
        Follow along. Pause and repeat each step.
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 4,
          background: 'linear-gradient(90deg, #96bf48, #10b981)',
        }}
      />
    </AbsoluteFill>
  );
};
