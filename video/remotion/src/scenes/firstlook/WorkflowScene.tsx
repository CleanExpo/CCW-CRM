import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';

const steps = [
  { num: '01', label: 'Quote', color: '#3b82f6', screenshot: 'images/quotes.png' },
  { num: '02', label: 'Order', color: '#8b5cf6', screenshot: 'images/orders.png' },
  { num: '03', label: 'Warehouse', color: '#06b6d4', screenshot: 'images/inventory-overview.png' },
  { num: '04', label: 'Ship', color: '#10b981', screenshot: 'images/orders.png' },
  { num: '05', label: 'Invoice', color: '#f59e0b', screenshot: 'images/invoices.png' },
];

export const WorkflowScene: React.FC = () => {
  const frame = useCurrentFrame();

  const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const footerOpacity = interpolate(frame, [700, 800], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });

  // Which step is "active" — cycles through based on frame
  const activeStep = Math.floor(frame / 180) % steps.length;
  const previewOpacity = interpolate(frame, [60, 90], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });

  return (
    <AbsoluteFill style={{ background: '#0f172a', fontFamily: 'system-ui, -apple-system, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 80 }}>
      <div style={{ opacity: titleOpacity, fontSize: 48, fontWeight: 700, color: '#ffffff', marginBottom: 48, textAlign: 'center' }}>
        One flow. <span style={{ color: '#3b82f6' }}>Start to finish.</span>
      </div>

      {/* Step flow */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, width: '100%', justifyContent: 'center', marginBottom: 40 }}>
        {steps.map((step, i) => {
          const stepDelay = 30 + i * 90;
          const stepOpacity = interpolate(frame, [stepDelay, stepDelay + 20], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
          const arrowDelay = stepDelay + 30;
          const arrowWidth = i < steps.length - 1 ? interpolate(frame, [arrowDelay, arrowDelay + 30], [0, 100], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }) : 0;
          const isActive = i === activeStep && frame > 60;

          return (
            <React.Fragment key={i}>
              <div style={{ opacity: stepOpacity, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <div style={{
                  width: 100, height: 100, borderRadius: '50%',
                  background: isActive ? `${step.color}44` : `${step.color}22`,
                  border: `${isActive ? 4 : 3}px solid ${step.color}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 28, fontWeight: 800, color: step.color,
                  transform: isActive ? 'scale(1.1)' : 'scale(1)',
                  transition: 'all 0.3s',
                  boxShadow: isActive ? `0 0 20px ${step.color}66` : 'none',
                  letterSpacing: -0.5,
                }}>
                  {step.num}
                </div>
                <span style={{ fontSize: 22, color: isActive ? '#ffffff' : step.color, fontWeight: 600 }}>{step.label}</span>
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

      {/* Live screenshot preview of active step */}
      <div style={{ opacity: previewOpacity, width: '100%', maxWidth: 800, borderRadius: 12, overflow: 'hidden', border: `2px solid ${steps[activeStep].color}60`, boxShadow: `0 8px 32px ${steps[activeStep].color}30` }}>
        <div style={{ background: steps[activeStep].color, padding: '8px 20px', fontSize: 16, fontWeight: 600, color: '#000' }}>
          {steps[activeStep].label} — CCW Online
        </div>
        <Img
          src={staticFile(steps[activeStep].screenshot)}
          style={{ width: '100%', display: 'block', objectFit: 'cover', objectPosition: 'top', height: 180 }}
        />
      </div>

      <div style={{ opacity: footerOpacity, marginTop: 32, fontSize: 28, color: '#94a3b8', textAlign: 'center' }}>
        Every step tracked. Every team in sync.
      </div>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #06b6d4, #10b981, #f59e0b)' }} />
    </AbsoluteFill>
  );
};
