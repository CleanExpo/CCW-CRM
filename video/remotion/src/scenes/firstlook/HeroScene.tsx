import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

export const HeroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const titleScale = interpolate(frame, [0, 25], [0.85, 1], { extrapolateRight: 'clamp' });
  const subtitleOpacity = interpolate(frame, [20, 45], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
  const lineWidth = interpolate(frame, [15, 70], [0, 100], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });

  const words = ['Products', '·', 'Orders', '·', 'Warehouse', '·', 'Invoicing', '·', 'CRM', '·', 'AI'];

  return (
    <AbsoluteFill style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Version badge */}
      <div style={{ position: 'absolute', top: 40, right: 60, background: 'rgba(59,130,246,0.2)', border: '1px solid #3b82f6', borderRadius: 6, padding: '4px 12px', color: '#60a5fa', fontSize: 18, fontWeight: 600 }}>v1.0</div>

      {/* Main title */}
      <div style={{ opacity: titleOpacity, transform: `scale(${titleScale})`, textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 96, fontWeight: 800, color: '#ffffff', letterSpacing: -2, lineHeight: 1 }}>CCW ERP · CRM</div>
      </div>

      {/* Animated accent line */}
      <div style={{ width: `${lineWidth}%`, maxWidth: 700, height: 4, background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)', borderRadius: 2, marginBottom: 32 }} />

      {/* Subtitle */}
      <div style={{ opacity: subtitleOpacity, fontSize: 32, color: '#94a3b8', textAlign: 'center', maxWidth: 900, lineHeight: 1.4 }}>
        The complete operating system for Australian equipment suppliers
      </div>

      {/* Module tags */}
      <div style={{ display: 'flex', gap: 16, marginTop: 56, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 1200 }}>
        {words.map((word, i) => {
          const wordOpacity = interpolate(frame, [50 + i * 10, 65 + i * 10], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
          return (
            <span key={i} style={{ opacity: wordOpacity, fontSize: 22, color: word === '·' ? '#475569' : '#60a5fa', fontWeight: word === '·' ? 400 : 600 }}>
              {word}
            </span>
          );
        })}
      </div>

      {/* Bottom accent bar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #06b6d4)' }} />
    </AbsoluteFill>
  );
};
