import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';

const steps = [
  { icon: '💬', label: 'Quote', color: '#3b82f6' },
  { icon: '📋', label: 'Order', color: '#8b5cf6' },
  { icon: '🏭', label: 'Warehouse', color: '#06b6d4' },
  { icon: '🚚', label: 'Ship', color: '#10b981' },
  { icon: '🧾', label: 'Invoice', color: '#f59e0b' },
];

export const WorkflowScene: React.FC = () => {
  const frame = useCurrentFrame();

  const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const footerOpacity = interpolate(frame, [700, 800], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });

  return (
    <AbsoluteFill style={{ background: '#0f172a', fontFamily: 'system-ui, -apple-system, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 80 }}>
      <div style={{ opacity: titleOpacity, fontSize: 48, fontWeight: 700, color: '#ffffff', marginBottom: 80, textAlign: 'center' }}>
        One flow. <span style={{ color: '#3b82f6' }}>Start to finish.</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 0, width: '100%', justifyContent: 'center' }}>
        {steps.map((step, i) => {
          const stepDelay = 30 + i * 90;
          const stepOpacity = interpolate(frame, [stepDelay, stepDelay + 20], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
          const arrowDelay = stepDelay + 30;
          const arrowWidth = i < steps.length - 1 ? interpolate(frame, [arrowDelay, arrowDelay + 30], [0, 100], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }) : 0;

          return (
            <React.Fragment key={i}>
              <div style={{ opacity: stepOpacity, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 100, height: 100, borderRadius: '50%', background: `${step.color}22`, border: `3px solid ${step.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>
                  {step.icon}
                </div>
                <span style={{ fontSize: 22, color: step.color, fontWeight: 600 }}>{step.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div style={{ overflow: 'hidden', width: 120, height: 4, margin: '0 8px', marginBottom: 32 }}>
                  <div style={{ width: `${arrowWidth}%`, height: '100%', background: `linear-gradient(90deg, ${step.color}, ${steps[i + 1].color})`, borderRadius: 2 }} />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      <div style={{ opacity: footerOpacity, marginTop: 64, fontSize: 28, color: '#94a3b8', textAlign: 'center' }}>
        Every step tracked. Every team in sync.
      </div>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #06b6d4, #10b981, #f59e0b)' }} />
    </AbsoluteFill>
  );
};
