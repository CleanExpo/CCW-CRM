/**
 * CCW Boardroom Video — Shared Types (UNI-1666)
 */

export interface VideoChapter {
  timestamp: string;
  title: string;
}

export interface VideoScene {
  id: string;
  type: 'intro' | 'intelligence' | 'board_member' | 'chart' | 'moon_shot' | 'cta' | 'outro';
  title?: string;
  content?: string;
  speaker?: string;
  durationFrames?: number;
}

export interface VideoBrief {
  title: string;
  description: string;
  tags: string[];
  duration_iso: string;
  script: string;
  youtube: {
    chapters: VideoChapter[];
  };
  scenes?: VideoScene[];
}

export interface BoardroomVideoProps {
  sessionId: string;
  videoBrief: VideoBrief;
  narrationPath?: string;
}

export interface ProductDemoVideoProps {
  featureName: string;
  tagline: string;
  problemStatement: string;
  screenshots: string[];
  screenshotCaptions: string[];
  results: string;
  ctaText: string;
  narrationPath?: string;
  format?: 'landscape' | 'portrait';
}

export interface ClientBenefitsVideoProps {
  industry: 'trades' | 'restoration' | 'training';
  painPoint: string;
  solutionName: string;
  metrics: Array<{
    label: string;
    value: number;
    unit: string;
    direction: 'up' | 'down';
  }>;
  testimonialQuote?: string;
  testimonialSource?: string;
  ctaText: string;
  narrationPath?: string;
}

export interface FeatureSpotlightVideoProps {
  featureName: string;
  hookStatement: string;
  screenshot?: string;
  screenshotCaption?: string;
  keyBenefit: string;
  ctaText: string;
  format?: 'landscape' | 'portrait';
  narrationPath?: string;
}

export interface BehindTheScenesVideoProps {
  sessionId: string;
  sessionDate: string;
  openingQuestion: string;
  boardMemberHighlights: Array<{
    name: string;
    title: string;
    insight: string;
    accentColor: string;
  }>;
  conflictMoment?: string;
  decision: string;
  moonShot: string;
  outcome: string;
  impact: string;
  narrationPath?: string;
}
