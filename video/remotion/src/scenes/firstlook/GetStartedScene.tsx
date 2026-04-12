import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';

const journey = [
  { day: 'Day 1', label: 'Connect your APIs', color: '#3b82f6' },
  { day: 'Day 2', label: 'Import your data', color: '#8b5cf6' },
  { day: 'Day 3', label: 'Set up your team', color: '#06b6d4' },
  { day: 'Day 4', label: 'Test & validate', color: '#10b981' },
  { day: 'Day 5', label: 'Go live', color: '#f59e0b' },
];

export const GetStartedScene: React.FC = () => {
  const frame = useCurrentFrame();

  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const ctaOpacity = interpolate(frame, [550, 650], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });
  const progressWidth = interpolate(frame, [30, 580], [0, 100], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #0c1a2e 100%)',
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
          opacity: titleOpacity,
          fontSize: 48,
          fontWeight: 700,
          color: '#ffffff',
          marginBottom: 60,
          textAlign: 'center',
        }}
      >
        Your <span style={{ color: '#3b82f6' }}>5-day journey</span> to live
      </div>

      {/* Progress bar */}
      <div
        style={{
          width: '80%',
          height: 6,
          background: '#1e293b',
          borderRadius: 3,
          marginBottom: 48,
          position: 'relative',
        }}
      >
        <div
          style={{
            width: `${progressWidth}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #3b82f6, #f59e0b)',
            borderRadius: 3,
          }}
        />
      </div>

      {/* Steps */}
      <div style={{ display: 'flex', gap: 24, width: '100%', justifyContent: 'center' }}>
        {journey.map((step, i) => {
          const delay = 30 + i * 90;
          const opacity = interpolate(frame, [delay, delay + 25], [0, 1], {
            extrapolateRight: 'clamp',
            extrapolateLeft: 'clamp',
          });
          const y = interpolate(frame, [delay, delay + 25], [30, 0], {
            extrapolateRight: 'clamp',
            extrapolateLeft: 'clamp',
          });
          return (
            <div
              key={i}
              style={{
                opacity,
                transform: `translateY(${y}px)`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
                background: `${step.color}15`,
                border: `2px solid ${step.color}`,
                borderRadius: 16,
                padding: '24px 20px',
                width: 200,
              }}
            >
              <div style={{ fontSize: 18, color: step.color, fontWeight: 700 }}>{step.day}</div>
              <div style={{ fontSize: 20, color: '#e2e8f0', textAlign: 'center', lineHeight: 1.4 }}>
                {step.label}
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          opacity: ctaOpacity,
          marginTop: 48,
          fontSize: 28,
          color: '#94a3b8',
          textAlign: 'center',
        }}
      >
        Ready to start?{' '}
        <span style={{ color: '#3b82f6', fontWeight: 600 }}>Let's connect your systems.</span>
      </div>

      <div
        style={{
          opacity: ctaOpacity,
          position: 'absolute',
          bottom: 32,
          right: 60,
          fontSize: 18,
          color: '#475569',
        }}
      >
        support@unite-group.in
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 4,
          background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #06b6d4, #10b981, #f59e0b)',
        }}
      />
    </AbsoluteFill>
  );
};
