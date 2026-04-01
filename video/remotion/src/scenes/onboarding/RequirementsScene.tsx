/**
 * Onboarding Scene 2 — What You Need Before We Start
 * Credentials + accounts checklist. Duration: ~60 seconds (1800 frames @ 30fps)
 */

import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

interface Requirement {
  service: string;
  what: string;
  where: string;
  color: string;
  icon: React.ReactNode;
}

/** Branded letter-circle icon */
const LetterIcon: React.FC<{ letter: string; bg: string; fg?: string }> = ({
  letter,
  bg,
  fg = '#0f172a',
}) => (
  <div
    style={{
      width: 32,
      height: 32,
      borderRadius: '50%',
      background: bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 16,
      fontWeight: 800,
      color: fg,
      flexShrink: 0,
    }}
  >
    {letter}
  </div>
);

/** Colored diamond shape */
const DiamondIcon: React.FC<{ color: string }> = ({ color }) => (
  <div
    style={{
      width: 32,
      height: 32,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}
  >
    <div
      style={{
        width: 20,
        height: 20,
        background: color,
        transform: 'rotate(45deg)',
        borderRadius: 4,
      }}
    />
  </div>
);

/** Upward-pointing triangle (CSS border trick) */
const TriangleIcon: React.FC<{ color: string }> = ({ color }) => (
  <div
    style={{
      width: 32,
      height: 32,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}
  >
    <div
      style={{
        width: 0,
        height: 0,
        borderLeft: '10px solid transparent',
        borderRight: '10px solid transparent',
        borderBottom: `18px solid ${color}`,
      }}
    />
  </div>
);

/** Colored dot with inner ring */
const RingDotIcon: React.FC<{ color: string }> = ({ color }) => (
  <div
    style={{
      width: 32,
      height: 32,
      borderRadius: '50%',
      border: `3px solid ${color}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}
  >
    <div
      style={{
        width: 12,
        height: 12,
        borderRadius: '50%',
        background: color,
      }}
    />
  </div>
);

const REQUIREMENTS: Requirement[] = [
  {
    service: 'Cin7',
    what: 'API Key + Company ID',
    where: 'Cin7 Core -> Settings -> API',
    color: '#f59e0b',
    icon: <LetterIcon letter="C" bg="#f59e0b" />,
  },
  {
    service: 'Xero',
    what: 'OAuth App — Client ID + Secret',
    where: 'developer.xero.com -> My Apps -> New App',
    color: '#10b981',
    icon: <LetterIcon letter="X" bg="#10b981" />,
  },
  {
    service: 'Supabase',
    what: 'Project URL + Anon Key + Service Role Key',
    where: 'supabase.com -> Project Settings -> API',
    color: '#3ecf8e',
    icon: <DiamondIcon color="#3ecf8e" />,
  },
  {
    service: 'Vercel',
    what: 'Account (free tier OK) + GitHub repo access',
    where: 'vercel.com -> New Project -> Import repo',
    color: '#e2e8f0',
    icon: <TriangleIcon color="#e2e8f0" />,
  },
  {
    service: 'Railway',
    what: 'Account for backend hosting (or run locally)',
    where: 'railway.app -> New Project -> Deploy from repo',
    color: '#a855f7',
    icon: <RingDotIcon color="#a855f7" />,
  },
  {
    service: 'GitHub',
    what: 'Repo access to CleanExpo/CCW-CRM',
    where: 'Contact Phill — github.com/CleanExpo',
    color: '#60a5fa',
    icon: <LetterIcon letter="GH" bg="#60a5fa" fg="#0f172a" />,
  },
];

export const RequirementsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerOpacity = interpolate(frame, [0, fps * 0.5], [0, 1], { extrapolateRight: 'clamp' });
  const headerSlide = interpolate(frame, [0, fps * 0.5], [30, 0], { extrapolateRight: 'clamp' });

  const cardOpacity = (index: number) =>
    interpolate(frame, [fps * (0.6 + index * 0.3), fps * (1.0 + index * 0.3)], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });

  const cardSlide = (index: number) =>
    interpolate(frame, [fps * (0.6 + index * 0.3), fps * (1.0 + index * 0.3)], [40, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });

  return (
    <AbsoluteFill
      style={{
        background: '#0f172a',
        display: 'flex',
        flexDirection: 'column',
        padding: '60px 80px',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* Header */}
      <div
        style={{
          opacity: headerOpacity,
          transform: `translateY(${headerSlide}px)`,
          marginBottom: 48,
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
          Before You Start
        </div>
        <h2 style={{ fontSize: 48, color: '#ffffff', fontWeight: 800, margin: 0 }}>
          What You'll Need
        </h2>
        <div style={{ fontSize: 20, color: '#64748b', marginTop: 8 }}>
          Gather these credentials before setup — takes about 20 minutes
        </div>
      </div>

      {/* Requirements grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 24,
          flex: 1,
        }}
      >
        {REQUIREMENTS.map((req, i) => (
          <div
            key={req.service}
            style={{
              opacity: cardOpacity(i),
              transform: `translateY(${cardSlide(i)}px)`,
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${req.color}33`,
              borderRadius: 12,
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {req.icon}
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: req.color,
                }}
              >
                {req.service}
              </div>
            </div>
            <div style={{ fontSize: 15, color: '#e2e8f0', fontWeight: 600, lineHeight: 1.4 }}>
              {req.what}
            </div>
            <div
              style={{
                fontSize: 13,
                color: '#475569',
                fontFamily: 'monospace',
                background: 'rgba(0,0,0,0.3)',
                padding: '6px 10px',
                borderRadius: 6,
              }}
            >
              {req.where}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom bar */}
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
