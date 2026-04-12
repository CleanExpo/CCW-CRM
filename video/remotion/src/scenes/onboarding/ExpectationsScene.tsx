/**
 * Onboarding Scene 3 — What to Expect
 * Timeline + deliverables. Duration: ~30 seconds (900 frames @ 30fps)
 */

import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

const TIMELINE = [
  {
    step: '1',
    label: 'Day 1',
    title: 'Environment Setup',
    desc: 'Configure env vars, deploy backend to Railway, frontend to Vercel',
    color: '#3b82f6',
  },
  {
    step: '2',
    label: 'Day 1–2',
    title: 'Connect Integrations',
    desc: 'Cin7 API key, Xero OAuth app, Supabase project — all linked and tested',
    color: '#8b5cf6',
  },
  {
    step: '3',
    label: 'Day 2–3',
    title: 'Data Migration',
    desc: 'Import existing products, customers, orders from Cin7 into CCW',
    color: '#06b6d4',
  },
  {
    step: '4',
    label: 'Day 3–5',
    title: 'Team Onboarding',
    desc: 'Staff accounts created, roles assigned, training videos reviewed',
    color: '#10b981',
  },
  {
    step: '5',
    label: 'Day 5+',
    title: 'Go Live',
    desc: 'CCW ERP is your live system of record — real-time sync with Cin7 + Xero',
    color: '#f59e0b',
  },
];

export const ExpectationsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerOpacity = interpolate(frame, [0, fps * 0.5], [0, 1], { extrapolateRight: 'clamp' });

  const stepOpacity = (i: number) =>
    interpolate(frame, [fps * (0.5 + i * 0.35), fps * (0.9 + i * 0.35)], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });

  const lineProgress = interpolate(frame, [fps * 0.5, fps * 2.5], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #0c1a2e 100%)',
        display: 'flex',
        flexDirection: 'column',
        padding: '60px 100px',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* Header */}
      <div style={{ opacity: headerOpacity, marginBottom: 56 }}>
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
          Setup Timeline
        </div>
        <h2 style={{ fontSize: 48, color: '#ffffff', fontWeight: 800, margin: 0 }}>
          What to Expect
        </h2>
        <div style={{ fontSize: 20, color: '#64748b', marginTop: 8 }}>
          From zero to live in 5 days — here's how it works
        </div>
      </div>

      {/* Timeline */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, flex: 1 }}>
        {TIMELINE.map((item, i) => (
          <div
            key={item.step}
            style={{
              opacity: stepOpacity(i),
              display: 'flex',
              alignItems: 'flex-start',
              gap: 24,
              marginBottom: i < TIMELINE.length - 1 ? 24 : 0,
            }}
          >
            {/* Step circle + line */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: item.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  fontWeight: 800,
                  color: '#0f172a',
                  flexShrink: 0,
                }}
              >
                {item.step}
              </div>
              {i < TIMELINE.length - 1 && (
                <div
                  style={{
                    width: 2,
                    height: 24,
                    background: `linear-gradient(180deg, ${item.color}66, transparent)`,
                    marginTop: 4,
                  }}
                />
              )}
            </div>

            {/* Content */}
            <div style={{ paddingTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: item.color,
                    background: `${item.color}22`,
                    padding: '2px 10px',
                    borderRadius: 20,
                    letterSpacing: 1,
                  }}
                >
                  {item.label}
                </span>
                <span style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9' }}>
                  {item.title}
                </span>
              </div>
              <div style={{ fontSize: 16, color: '#64748b', lineHeight: 1.5 }}>{item.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          left: 100,
          right: 100,
          height: 6,
          background: 'rgba(255,255,255,0.08)',
          borderRadius: 3,
        }}
      >
        <div
          style={{
            width: `${lineProgress * 100}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #06b6d4)',
            borderRadius: 3,
          }}
        />
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
