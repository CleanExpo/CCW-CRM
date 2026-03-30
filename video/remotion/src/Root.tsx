/**
 * CCW Boardroom — Remotion Root (UNI-1666)
 * Registers all video compositions for Remotion Studio preview and rendering.
 */

import React from 'react';
import { Composition } from 'remotion';
import { BoardroomVideo } from './BoardroomVideo';
import { ProductDemoVideo } from './compositions/ProductDemoVideo';
import { ClientBenefitsVideo } from './compositions/ClientBenefitsVideo';
import { FeatureSpotlightVideo } from './compositions/FeatureSpotlightVideo';
import { BehindTheScenesVideo } from './compositions/BehindTheScenesVideo';
import type {
  BoardroomVideoProps,
  ProductDemoVideoProps,
  ClientBenefitsVideoProps,
  FeatureSpotlightVideoProps,
  BehindTheScenesVideoProps,
} from './types';

// Remotion's Composition generic requires Props extends Record<string, unknown>.
// Cast helpers to satisfy TypeScript without losing type safety on defaultProps.
type AnyComp = React.ComponentType<Record<string, unknown>>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VIDEO_FPS = 30;
const VIDEO_WIDTH = 1920;
const VIDEO_HEIGHT = 1080;
const PORTRAIT_WIDTH = 1080;
const PORTRAIT_HEIGHT = 1920;

// ---------------------------------------------------------------------------
// Default props — BoardroomVideo (existing)
// ---------------------------------------------------------------------------

const BOARDROOM_DEFAULT_PROPS: BoardroomVideoProps = {
  sessionId: 'CCW-BOARD-20260329120000',
  videoBrief: {
    title: 'CCW Boardroom: AI Strategy Session — March 2026',
    description: 'The autonomous CCW boardroom deliberates on AI automation for trades businesses.',
    tags: ['CCW', 'AI', 'trades', 'Australia', 'automation'],
    duration_iso: 'PT8M',
    script:
      'Welcome to the CCW Boardroom. Today we explore the latest in AI automation for trades businesses across Australia and New Zealand.',
    youtube: {
      chapters: [
        { timestamp: '0:00', title: 'Intro' },
        { timestamp: '0:35', title: 'Intelligence Brief' },
        { timestamp: '1:05', title: 'Build Status' },
        { timestamp: '2:00', title: 'Board Highlights' },
        { timestamp: '5:00', title: 'Moon Shot' },
        { timestamp: '6:20', title: "What's Next" },
      ],
    },
  },
};

// ---------------------------------------------------------------------------
// Default props — ProductDemoVideo
// ---------------------------------------------------------------------------

const PRODUCT_DEMO_DEFAULT_PROPS: ProductDemoVideoProps = {
  featureName: 'Barcode Scanner',
  tagline: 'Inventory in seconds, not hours',
  problemStatement:
    'Manual stock counts take hours and introduce costly errors.',
  screenshots: [],
  screenshotCaptions: [],
  results: '87% reduction in stock count time. Zero data entry errors.',
  ctaText: 'See CCW ERP in action — ccwonline.com.au',
};

// ---------------------------------------------------------------------------
// Default props — ClientBenefitsVideo
// ---------------------------------------------------------------------------

const CLIENT_BENEFITS_DEFAULT_PROPS: ClientBenefitsVideoProps = {
  industry: 'trades',
  painPoint:
    'Chasing quotes, invoices, and purchase orders across spreadsheets costs you 12+ hours every week.',
  solutionName: 'CCW ERP — Built for Trades',
  metrics: [
    { label: 'Quote Time', value: 85, unit: '%', direction: 'down' },
    { label: 'Admin Hours Saved', value: 12, unit: 'hrs/wk', direction: 'down' },
    { label: 'Revenue Visibility', value: 100, unit: '%', direction: 'up' },
  ],
  ctaText: 'Built for trades. Proven in the field.',
};

// ---------------------------------------------------------------------------
// Default props — FeatureSpotlightVideo
// ---------------------------------------------------------------------------

const FEATURE_SPOTLIGHT_DEFAULT_PROPS: FeatureSpotlightVideoProps = {
  featureName: 'AI Quote Generator',
  hookStatement: 'Generate a professional quote in 30 seconds.',
  keyBenefit: 'No more hours lost to manual quoting',
  ctaText: 'Try it free — ccwonline.com.au',
};

// ---------------------------------------------------------------------------
// Default props — BehindTheScenesVideo
// ---------------------------------------------------------------------------

const BEHIND_THE_SCENES_DEFAULT_PROPS: BehindTheScenesVideoProps = {
  sessionId: 'CCW-BOARD-20260331',
  sessionDate: 'Tuesday, 31 March 2026',
  openingQuestion: "How do we reduce CCW's admin overhead by 60% before Q3?",
  boardMemberHighlights: [
    {
      name: 'The Architect',
      title: 'Systems & Technical Strategy',
      insight:
        'The bottleneck is manual data re-entry between Cin7 and Xero — automating this sync saves 8 hours per week.',
      accentColor: '#3b82f6',
    },
    {
      name: 'The Revenue Guardian',
      title: 'Commercial & Growth',
      insight:
        "Every hour saved on admin is an hour that goes to customer relationships — that's where the real revenue is.",
      accentColor: '#22c55e',
    },
    {
      name: 'The Moon Shooter',
      title: 'Vision & Innovation',
      insight:
        'What if the system could predict reorder needs 3 weeks in advance using historical seasonal patterns?',
      accentColor: '#8b5cf6',
    },
  ],
  decision:
    'Deploy automated Cin7-Xero nightly sync with anomaly alerts by end of sprint.',
  moonShot:
    'Predictive reorder system that eliminates manual purchase orders within 90 days.',
  outcome:
    'Nightly sync deployed, tested, and running — zero manual intervention required.',
  impact:
    'Free up 8 hours per week across the CCW admin team for customer-facing work.',
};

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

export const Root: React.FC = () => {
  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* Existing: BoardroomVideo — 1920×1080, 150s                         */}
      {/* ------------------------------------------------------------------ */}
      <Composition
        id="BoardroomVideo"
        component={BoardroomVideo as unknown as AnyComp}
        durationInFrames={VIDEO_FPS * 150}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        defaultProps={BOARDROOM_DEFAULT_PROPS as unknown as Record<string, unknown>}
      />

      {/* ------------------------------------------------------------------ */}
      {/* ProductDemoVideo — landscape, 43s (0 screenshots)                  */}
      {/* fps*(5+10+8+0*10+12+8) = fps*43 = 1290 frames                      */}
      {/* ------------------------------------------------------------------ */}
      <Composition
        id="ProductDemoVideo"
        component={ProductDemoVideo as unknown as AnyComp}
        durationInFrames={1290}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        defaultProps={PRODUCT_DEMO_DEFAULT_PROPS as unknown as Record<string, unknown>}
      />

      {/* ProductDemoVideo — portrait variant */}
      <Composition
        id="ProductDemoVideo-portrait"
        component={ProductDemoVideo as unknown as AnyComp}
        durationInFrames={1290}
        fps={VIDEO_FPS}
        width={PORTRAIT_WIDTH}
        height={PORTRAIT_HEIGHT}
        defaultProps={{ ...PRODUCT_DEMO_DEFAULT_PROPS, format: 'portrait' } as unknown as Record<string, unknown>}
      />

      {/* ------------------------------------------------------------------ */}
      {/* ClientBenefitsVideo — 1920×1080, 120s = 3600 frames                */}
      {/* ------------------------------------------------------------------ */}
      <Composition
        id="ClientBenefitsVideo"
        component={ClientBenefitsVideo as unknown as AnyComp}
        durationInFrames={3600}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        defaultProps={CLIENT_BENEFITS_DEFAULT_PROPS as unknown as Record<string, unknown>}
      />

      {/* ------------------------------------------------------------------ */}
      {/* FeatureSpotlightVideo — landscape, 75s = 2250 frames               */}
      {/* ------------------------------------------------------------------ */}
      <Composition
        id="FeatureSpotlightVideo"
        component={FeatureSpotlightVideo as unknown as AnyComp}
        durationInFrames={2250}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        defaultProps={FEATURE_SPOTLIGHT_DEFAULT_PROPS as unknown as Record<string, unknown>}
      />

      {/* FeatureSpotlightVideo — portrait variant */}
      <Composition
        id="FeatureSpotlightVideo-portrait"
        component={FeatureSpotlightVideo as unknown as AnyComp}
        durationInFrames={2250}
        fps={VIDEO_FPS}
        width={PORTRAIT_WIDTH}
        height={PORTRAIT_HEIGHT}
        defaultProps={{ ...FEATURE_SPOTLIGHT_DEFAULT_PROPS, format: 'portrait' } as unknown as Record<string, unknown>}
      />

      {/* ------------------------------------------------------------------ */}
      {/* BehindTheScenesVideo — 1920×1080, 360s = 10800 frames default      */}
      {/* ------------------------------------------------------------------ */}
      <Composition
        id="BehindTheScenesVideo"
        component={BehindTheScenesVideo as unknown as AnyComp}
        durationInFrames={10800}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        defaultProps={BEHIND_THE_SCENES_DEFAULT_PROPS as unknown as Record<string, unknown>}
      />
    </>
  );
};
