import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';

const pains = [
  'Tracking orders in Excel spreadsheets',
  'Chasing up suppliers by phone',
  'Re-entering the same data 3 times',
  'No idea what stock you actually have',
];

export const ProblemScene: React.FC = () => {
  const frame = useCurrentFrame();

  const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const rightOpacity = interpolate(frame, [60, 80], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: '#0f172a',
        display: 'flex',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Left panel */}
      <div
        style={{
          width: '55%',
          padding: '80px 60px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          borderRight: '1px solid #1e293b',
        }}
      >
        <div
          style={{
            opacity: titleOpacity,
            fontSize: 52,
            fontWeight: 800,
            color: '#f59e0b',
            marginBottom: 48,
          }}
        >
          Sound familiar?
        </div>
        {pains.map((pain, i) => {
          const opacity = interpolate(frame, [20 + i * 22, 38 + i * 22], [0, 1], {
            extrapolateRight: 'clamp',
            extrapolateLeft: 'clamp',
          });
          const x = interpolate(frame, [20 + i * 22, 38 + i * 22], [-40, 0], {
            extrapolateRight: 'clamp',
            extrapolateLeft: 'clamp',
          });
          return (
            <div
              key={i}
              style={{
                opacity,
                transform: `translateX(${x}px)`,
                display: 'flex',
                alignItems: 'center',
                gap: 20,
                marginBottom: 28,
                padding: '16px 24px',
                background: 'rgba(239,68,68,0.08)',
                borderLeft: '3px solid #ef4444',
                borderRadius: '0 8px 8px 0',
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: '#ef4444',
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 26, color: '#e2e8f0' }}>{pain}</span>
            </div>
          );
        })}
      </div>

      {/* Right panel */}
      <div
        style={{
          width: '45%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: rightOpacity,
          padding: 60,
        }}
      >
        <div style={{ fontSize: 120, marginBottom: 24 }}>→</div>
        <div
          style={{
            fontSize: 42,
            fontWeight: 700,
            color: '#ffffff',
            textAlign: 'center',
            lineHeight: 1.3,
          }}
        >
          There's a<br />
          <span style={{ color: '#3b82f6' }}>better way.</span>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 4,
          background: 'linear-gradient(90deg, #ef4444, #f59e0b)',
        }}
      />
    </AbsoluteFill>
  );
};
