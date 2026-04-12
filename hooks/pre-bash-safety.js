// hooks/pre-bash-safety.js — blocks dangerous shell commands
'use strict';
const BLOCKED = [
  /rm\s+-rf/,
  /DROP\s+TABLE/i,
  /curl[^|]*\|\s*bash/,
  />\s*\/dev\/sd/,
  /mkfs\b/,
  /dd\s+if=/,
];
const input = process.env.TOOL_INPUT || '';
const hit = BLOCKED.find((p) => p.test(input));
if (hit) {
  console.error(`[PRE-BASH] BLOCKED dangerous pattern: ${hit}`);
  process.exit(2);
}
process.exit(0);
