/**
 * Onboarding Scene 1 — Welcome / What is CCW ERP
 * Duration: ~30 seconds (900 frames @ 30fps)
 */

import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

export const OnboardingIntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.6], [0, 1], { extrapolateRight: 'clamp' });
  const slideY = interpolate(frame, [0, fps * 0.6], [50, 0], { extrapolateRight: 'clamp' });

  const taglineOpacity = interpolate(frame, [fps * 0.8, fps * 1.4], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const taglineSlide = interpolate(frame, [fps * 0.8, fps * 1.4], [30, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const bulletOpacity = (index: number) =>
    interpolate(frame, [fps * (1.6 + index * 0.4), fps * (2.0 + index * 0.4)], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });

  const modules = [
    'Products, Inventory & Warehouse',
    'Customers, Orders & Quotes',
    'Invoicing & POS',
    'Suppliers & Purchase Orders',
    'Workflows, Reports & AI Assistant',
    'Cin7 + Xero Integration',
  ];

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
        display: 'flex',
        flexDirection: 'row',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* Left panel */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          opacity: fadeIn,
          transform: `translateY(${slideY}px)`,
        }}
      >
        <div
          style={{
            fontSize: 18,
            color: '#60a5fa',
            letterSpacing: 6,
            fontWeight: 700,
            textTransform: 'uppercase',
            marginBottom: 20,
          }}
        >
          CCW — Carpet Cleaners Warehouse
        </div>
        <h1
          style={{
            fontSize: 62,
            color: '#ffffff',
            fontWeight: 900,
            lineHeight: 1.1,
            marginBottom: 24,
          }}
        >
          Welcome to
          <br />
          <span style={{ color: '#38bdf8' }}>CCW ERP</span>
        </h1>
        <div
          style={{
            opacity: taglineOpacity,
            transform: `translateY(${taglineSlide}px)`,
            fontSize: 24,
            color: '#94a3b8',
            lineHeight: 1.6,
            maxWidth: 520,
          }}
        >
          Your complete business operating system for equipment suppliers — built for trades,
          designed for growth.
        </div>
      </div>

      {/* Right panel — module list */}
      <div
        style={{
          width: 520,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px 60px',
          background: 'rgba(255,255,255,0.04)',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div
          style={{
            fontSize: 14,
            color: '#475569',
            letterSpacing: 4,
            fontWeight: 700,
            textTransform: 'uppercase',
            marginBottom: 32,
          }}
        >
          What's Included
        </div>
        {modules.map((mod, i) => (
          <div
            key={mod}
            style={{
              opacity: bulletOpacity(i),
              display: 'flex',
              alignItems: 'center',
              marginBottom: 20,
              gap: 16,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#38bdf8',
                flexShrink: 0,
              }}
            />
            <div style={{ fontSize: 20, color: '#e2e8f0', fontWeight: 500 }}>{mod}</div>
          </div>
        ))}
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
