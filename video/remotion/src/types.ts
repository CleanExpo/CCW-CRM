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
