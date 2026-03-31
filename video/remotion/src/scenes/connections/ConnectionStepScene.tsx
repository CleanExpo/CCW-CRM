import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';

export interface ConnectionStep {
  stepNumber: string;   // e.g. "01 / 05"
  serviceName: string;  // e.g. "Cin7 Core"
  accentColor: string;  // e.g. "#f59e0b"
  serviceIcon: string;  // emoji
  steps: string[];      // instruction steps
  envVars: string[];    // env var lines
  warning?: string;     // optional warning text
}

export const ConnectionStepScene: React.FC<ConnectionStep> = ({
  stepNumber, serviceName, accentColor, serviceIcon, steps, envVars, warning
}) => {
  const frame = useCurrentFrame();

  const headerOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const envOpacity = interpolate(frame, [steps.length * 90, steps.length * 90 + 30], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
  const warnOpacity = interpolate(frame, [steps.length * 90 + 60, steps.length * 90 + 90], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });

  return (
    <AbsoluteFill style={{ background: '#0f172a', fontFamily: 'system-ui, -apple-system, sans-serif', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ opacity: headerOpacity, display: 'flex', alignItems: 'center', gap: 16, padding: '32px 60px', background: `${accentColor}15`, borderBottom: `3px solid ${accentColor}` }}>
        <span style={{ fontSize: 48 }}>{serviceIcon}</span>
        <div>
          <div style={{ fontSize: 18, color: accentColor, fontWeight: 600, letterSpacing: 2 }}>{stepNumber}</div>
          <div style={{ fontSize: 40, fontWeight: 800, color: '#ffffff' }}>{serviceName}</div>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, gap: 0 }}>
        {/* Left panel: steps */}
        <div style={{ width: '45%', padding: '40px 50px', borderRight: `1px solid ${accentColor}30`, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16 }}>
          {steps.map((step, i) => {
            const opacity = interpolate(frame, [30 + i * 90, 50 + i * 90], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
            const x = interpolate(frame, [30 + i * 90, 50 + i * 90], [-20, 0], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
            return (
              <div key={i} style={{ opacity, transform: `translateX(${x}px)`, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ minWidth: 32, height: 32, borderRadius: '50%', background: accentColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#000', flexShrink: 0, marginTop: 2 }}>{i + 1}</div>
                <div style={{ fontSize: 22, color: '#e2e8f0', lineHeight: 1.4 }}>{step}</div>
              </div>
            );
          })}
        </div>

        {/* Right panel: env vars */}
        <div style={{ flex: 1, padding: '40px 50px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 20 }}>
          <div style={{ opacity: envOpacity, background: '#0d1117', borderRadius: 12, padding: '28px 32px', border: `1px solid ${accentColor}40` }}>
            <div style={{ fontSize: 16, color: accentColor, fontWeight: 600, marginBottom: 16, letterSpacing: 1 }}>ENVIRONMENT VARIABLES</div>
            {envVars.map((line, i) => (
              <div key={i} style={{ fontFamily: 'monospace', fontSize: 20, color: '#e2e8f0', lineHeight: 2, borderBottom: i < envVars.length - 1 ? '1px solid #1e293b' : 'none', paddingBottom: i < envVars.length - 1 ? 8 : 0 }}>
                <span style={{ color: '#60a5fa' }}>{line.split('=')[0]}</span>
                <span style={{ color: '#475569' }}>=</span>
                <span style={{ color: '#f59e0b' }}>{line.split('=').slice(1).join('=')}</span>
              </div>
            ))}
          </div>
          {warning && (
            <div style={{ opacity: warnOpacity, background: 'rgba(239,68,68,0.1)', borderLeft: '4px solid #ef4444', borderRadius: '0 8px 8px 0', padding: '16px 24px', fontSize: 20, color: '#fca5a5' }}>
              {warning}
            </div>
          )}
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${accentColor}, ${accentColor}44)` }} />
    </AbsoluteFill>
  );
};
