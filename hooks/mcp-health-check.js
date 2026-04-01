// hooks/mcp-health-check.js — logs MCP tool calls
'use strict';
const tool = process.env.TOOL_NAME || 'unknown';
console.log(`[MCP-HEALTH] Tool: ${tool} at ${new Date().toISOString()}`);
process.exit(0);
