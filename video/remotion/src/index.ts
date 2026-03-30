/**
 * CCW Boardroom — Remotion Entry Point (UNI-1666)
 *
 * Registers the BoardroomVideo composition.
 * Run: npx remotion studio (to preview)
 *      npx remotion render src/index.ts BoardroomVideo out/boardroom.mp4
 */

import { registerRoot } from 'remotion';
import { Root } from './Root';

registerRoot(Root);
