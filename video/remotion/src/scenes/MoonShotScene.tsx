/**
 * Scene 5 — Moon Shot (UNI-1666)
 * The Moon Shooter's audacious idea. High impact, memorable.
 */

import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

interface MoonShotSceneProps {
  moonShot: string;
}

export const MoonShotScene: React.FC<MoonShotSceneProps> = ({ moonShot }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(frame, [0, fps * 0.5], [0, 1], { extrapolateRight: 'clamp' });
  const scale = interpolate(frame, [0, fps * 0.5], [0.95, 1], { extrapolateRight: 'clamp' });

  // Stars twinkling in background
  const stars = Array.from({ length: 30 }, (_, i) => ({
    x: (i * 97 + 13) % 100,
    y: (i * 61 + 7) % 100,
    size: (i % 3) + 1,
    delay: (i * 0.1) % 2,
  }));

  return (
    <AbsoluteFill
      style={{
        background: 'radial-gradient(ellipse at center, #0c1445 0%, #000510 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter, sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* Stars */}
      {stars.map((star, i) => {
        const twinkle = interpolate(
          (frame + i * 7) % (fps * 2),
          [0, fps, fps * 2],
          [0.3, 1, 0.3]
        );
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: star.size,
              height: star.size,
              borderRadius: '50%',
              background: '#fff',
              opacity: twinkle * 0.6,
            }}
          />
        );
      })}

      <div style={{ opacity, transform: `scale(${scale})`, textAlign: 'center', zIndex: 1 }}>
        <div
          style={{
            fontSize: 14,
            color: '#818cf8',
            letterSpacing: 6,
            textTransform: 'uppercase',
            marginBottom: 24,
          }}
        >
          The Moon Shooter · Speaks Last
        </div>

        <div
          style={{
            width: 64,
            height: 64,
            marginBottom: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          {/* Upward arrow / launch indicator */}
          <div
            style={{
              width: 0,
              height: 0,
              borderLeft: '20px solid transparent',
              borderRight: '20px solid transparent',
              borderBottom: '32px solid #818cf8',
              position: 'absolute',
              top: 0,
            }}
          />
          <div
            style={{
              width: 12,
              height: 28,
              background: '#818cf8',
              borderRadius: '0 0 4px 4px',
              position: 'absolute',
              bottom: 4,
            }}
          />
        </div>

        <h2
          style={{
            fontSize: 44,
            color: '#fff',
            fontWeight: 800,
            maxWidth: 900,
            lineHeight: 1.2,
            textAlign: 'center',
          }}
        >
          {moonShot}
        </h2>

        <div
          style={{
            marginTop: 40,
            padding: '16px 32px',
            borderRadius: 8,
            border: '1px solid #4f46e5',
            background: '#1e1b4b40',
            fontSize: 18,
            color: '#a5b4fc',
          }}
        >
          Achievable in 90 days · First step starts now
        </div>
      </div>
    </AbsoluteFill>
  );
};
