/**
 * Scene 6 — Call to Action (UNI-1666)
 * Subscribe prompt, links, next session teaser.
 */

import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

interface CTASceneProps {
  nextSessionDate?: string;
}

export const CTAScene: React.FC<CTASceneProps> = ({ nextSessionDate }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter, sans-serif',
        padding: '80px 120px',
      }}
    >
      <div style={{ opacity, textAlign: 'center' }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
            fontSize: 22,
            fontWeight: 800,
            color: '#fff',
            boxShadow: '0 0 24px #f59e0b40',
          }}
        >
          !
        </div>

        <h2 style={{ fontSize: 48, color: '#fff', fontWeight: 800, marginBottom: 16 }}>
          Subscribe for the next session
        </h2>
        <p style={{ fontSize: 22, color: '#94a3b8', marginBottom: 48 }}>
          CCW Boardroom runs 4× daily — every major AI update, market shift, and product decision,
          live.
        </p>

        {nextSessionDate && (
          <div
            style={{
              background: '#1e293b',
              borderRadius: 12,
              padding: '20px 40px',
              marginBottom: 48,
              fontSize: 20,
              color: '#e2e8f0',
            }}
          >
            Next session: <strong style={{ color: '#60a5fa' }}>{nextSessionDate}</strong>
          </div>
        )}

        <div style={{ display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap' }}>
          {[
            { text: 'carpetcleanerswarehouse.com.au', letter: 'W', color: '#3b82f6' },
            { text: 'RestoreAssist', letter: 'R', color: '#8b5cf6' },
            { text: 'NRPG Network', letter: 'N', color: '#06b6d4' },
            { text: 'CARSI Training', letter: 'C', color: '#10b981' },
          ].map((link) => (
            <div
              key={link.text}
              style={{
                padding: '12px 24px',
                borderRadius: 8,
                border: `1px solid ${link.color}40`,
                background: `${link.color}10`,
                fontSize: 16,
                color: link.color,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: link.color,
                  color: '#fff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {link.letter}
              </span>
              {link.text}
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 4,
          background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #06b6d4, #10b981)',
        }}
      />
    </AbsoluteFill>
  );
};
