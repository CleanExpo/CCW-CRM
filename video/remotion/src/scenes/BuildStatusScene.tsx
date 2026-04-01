/**
 * Scene 3 — Build Status (UNI-1666)
 * The Architect's BUILD_STATUS: GREEN / AMBER / RED
 */

import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

interface BuildStatusSceneProps {
  status: 'GREEN' | 'AMBER' | 'RED';
  reason: string;
}

const STATUS_CONFIG = {
  GREEN: { color: '#22c55e', bg: '#052e16', letter: 'G', label: 'All Systems Operational' },
  AMBER: { color: '#f59e0b', bg: '#1c1400', letter: 'A', label: 'Attention Required' },
  RED: { color: '#ef4444', bg: '#1c0303', letter: 'R', label: 'Critical Issues' },
};

export const BuildStatusScene: React.FC<BuildStatusSceneProps> = ({ status, reason }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.AMBER;

  const scale = interpolate(frame, [0, fps * 0.4], [0.8, 1], {
    extrapolateRight: 'clamp',
  });
  const opacity = interpolate(frame, [0, fps * 0.3], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Pulse the status indicator
  const pulse = interpolate(
    frame % (fps * 1.5),
    [0, fps * 0.75, fps * 1.5],
    [1, 1.05, 1]
  );

  return (
    <AbsoluteFill
      style={{
        background: cfg.bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <div style={{ opacity, transform: `scale(${scale})`, textAlign: 'center' }}>
        <div
          style={{
            fontSize: 14,
            color: '#64748b',
            letterSpacing: 4,
            textTransform: 'uppercase',
            marginBottom: 32,
          }}
        >
          The Architect Reports
        </div>

        <div
          style={{
            transform: `scale(${pulse})`,
            width: 200,
            height: 200,
            borderRadius: '50%',
            border: `4px solid ${cfg.color}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 32px',
            boxShadow: `0 0 40px ${cfg.color}40`,
          }}
        >
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: cfg.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 40,
              fontWeight: 900,
              color: '#fff',
              letterSpacing: 0,
            }}
          >
            {cfg.letter}
          </div>
        </div>

        <div style={{ fontSize: 64, fontWeight: 800, color: cfg.color, marginBottom: 8 }}>
          {status}
        </div>
        <div style={{ fontSize: 24, color: '#94a3b8', marginBottom: 32 }}>{cfg.label}</div>
        <p
          style={{
            fontSize: 20,
            color: '#cbd5e1',
            maxWidth: 700,
            lineHeight: 1.6,
            textAlign: 'center',
          }}
        >
          {reason}
        </p>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 4,
          background: `linear-gradient(90deg, ${cfg.color}, ${cfg.color}80)`,
        }}
      />
    </AbsoluteFill>
  );
};
