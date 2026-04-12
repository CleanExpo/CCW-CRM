/**
 * Scene 4 — Board Member Highlight (UNI-1666)
 * Displays a board member's key insight. Reusable for multiple members.
 */

import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

interface BoardMemberSceneProps {
  memberName: string;
  memberTitle: string;
  insight: string;
  accentColor?: string;
}

export const BoardMemberScene: React.FC<BoardMemberSceneProps> = ({
  memberName,
  memberTitle,
  insight,
  accentColor = '#3b82f6',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerOpacity = interpolate(frame, [0, fps * 0.3], [0, 1], { extrapolateRight: 'clamp' });
  const contentOpacity = interpolate(frame, [fps * 0.3, fps * 0.7], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const contentSlide = interpolate(frame, [fps * 0.3, fps * 0.7], [20, 0], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: '#0f172a',
        display: 'flex',
        flexDirection: 'column',
        padding: '80px 120px',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* Member header */}
      <div
        style={{
          opacity: headerOpacity,
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          marginBottom: 48,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 12,
            background: accentColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            fontWeight: 800,
            color: '#fff',
          }}
        >
          {memberName.split(' ').pop()?.[0] || '?'}
        </div>
        <div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#f1f5f9' }}>{memberName}</div>
          <div style={{ fontSize: 16, color: '#64748b' }}>{memberTitle}</div>
        </div>
      </div>

      {/* Insight quote */}
      <div
        style={{
          opacity: contentOpacity,
          transform: `translateY(${contentSlide}px)`,
          flex: 1,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            borderLeft: `4px solid ${accentColor}`,
            paddingLeft: 32,
          }}
        >
          <p
            style={{
              fontSize: 30,
              color: '#e2e8f0',
              lineHeight: 1.6,
              margin: 0,
              fontStyle: 'italic',
            }}
          >
            "{insight}"
          </p>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 4,
          background: `linear-gradient(90deg, ${accentColor}, transparent)`,
        }}
      />
    </AbsoluteFill>
  );
};
