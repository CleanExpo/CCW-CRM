/**
 * Onboarding Scene 5 — You're Ready to Go Live
 * Final CTA + next steps. Duration: ~30 seconds (900 frames @ 30fps)
 */

import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

const NEXT_STEPS = [
  { icon: '🎬', text: 'Watch the module walkthrough videos for each section' },
  { icon: '👥', text: 'Create staff accounts via Settings → Users' },
  { icon: '🔄', text: 'Run your first Cin7 sync: Settings → Integrations → Cin7 → Sync Now' },
  { icon: '📊', text: 'Check the Dashboard — your live metrics will appear within minutes' },
  { icon: '🤖', text: 'Try the AI Assistant for instant inventory + order queries' },
];

export const GoLiveScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerOpacity = interpolate(frame, [0, fps * 0.5], [0, 1], { extrapolateRight: 'clamp' });
  const scale = interpolate(frame, [0, fps * 0.5], [0.9, 1], { extrapolateRight: 'clamp' });

  const checkScale = interpolate(frame, [fps * 0.3, fps * 0.8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const stepOpacity = (i: number) =>
    interpolate(frame, [fps * (0.8 + i * 0.3), fps * (1.1 + i * 0.3)], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });

  // Pulsing glow
  const glowOpacity = interpolate(
    frame % (fps * 2),
    [0, fps, fps * 2],
    [0.4, 0.8, 0.4],
    { extrapolateRight: 'clamp' }
  );

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #0d2137 100%)',
        display: 'flex',
        flexDirection: 'row',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* Left: Big green checkmark */}
      <div
        style={{
          width: 480,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          borderRight: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* Glow */}
        <div
          style={{
            position: 'absolute',
            width: 300,
            height: 300,
            borderRadius: '50%',
            background: `radial-gradient(circle, #10b98133 0%, transparent 70%)`,
            opacity: glowOpacity,
          }}
        />

        <div
          style={{
            transform: `scale(${checkScale})`,
            width: 160,
            height: 160,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 80,
            boxShadow: '0 0 60px #10b98166',
            zIndex: 1,
          }}
        >
          ✓
        </div>

        <div
          style={{
            marginTop: 32,
            fontSize: 28,
            fontWeight: 800,
            color: '#10b981',
            opacity: checkScale,
            textAlign: 'center',
          }}
        >
          You're Live!
        </div>
        <div
          style={{
            marginTop: 8,
            fontSize: 16,
            color: '#475569',
            textAlign: 'center',
            padding: '0 40px',
            opacity: checkScale,
          }}
        >
          CCW ERP is now your system of record
        </div>
      </div>

      {/* Right: Next steps */}
      <div
        style={{
          flex: 1,
          padding: '60px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            opacity: headerOpacity,
            transform: `scale(${scale})`,
            transformOrigin: 'left center',
            marginBottom: 36,
          }}
        >
          <div
            style={{
              fontSize: 14,
              color: '#60a5fa',
              letterSpacing: 5,
              fontWeight: 700,
              textTransform: 'uppercase',
              marginBottom: 12,
            }}
          >
            Next Steps
          </div>
          <h2 style={{ fontSize: 42, color: '#ffffff', fontWeight: 800, margin: 0 }}>
            Your First 24 Hours
          </h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {NEXT_STEPS.map((step, i) => (
            <div
              key={i}
              style={{
                opacity: stepOpacity(i),
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                background: 'rgba(255,255,255,0.04)',
                borderRadius: 10,
                padding: '14px 20px',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <span style={{ fontSize: 24, flexShrink: 0 }}>{step.icon}</span>
              <span style={{ fontSize: 17, color: '#cbd5e1', lineHeight: 1.4 }}>{step.text}</span>
            </div>
          ))}
        </div>

        {/* Support line */}
        <div
          style={{
            marginTop: 32,
            fontSize: 15,
            color: '#334155',
            opacity: stepOpacity(5),
          }}
        >
          Questions? Contact Phill — support@unite-group.in
        </div>
      </div>

      {/* Bottom accent */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 4,
          background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #06b6d4)',
        }}
      />
    </AbsoluteFill>
  );
};
