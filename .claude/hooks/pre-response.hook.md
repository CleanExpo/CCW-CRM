---
name: pre-response
type: hook
trigger: Before every Claude response
priority: 1
blocking: false
version: 1.0.0
---

# Pre-Response Hook

Fires before every Claude response to ensure Australian context and proper routing.

## Actions

1. **Load Australian Context**
   - Apply en-AU spelling defaults
   - Set currency to AUD
   - Set date format to DD/MM/YYYY
   - Load australian-context.skill.md

2. **Identify Task Type**
   - Visual/UI → Flag for design system
   - Content → Flag for truth verification
   - Code → Flag for verification tier
   - Research → Flag for source validation
   - SEO → Flag for Australian market context

3. **Route to Orchestrator**
   - Pass task type and context to orchestrator agent
   - Orchestrator determines specialist agent

4. **Pre-load Relevant Skills**
   - Based on task type, pre-load common skills
   - Reduces token usage in subsequent steps

## Never Skip

This hook fires on **EVERY response**. No exceptions.

## Integration

Called automatically by Claude Code before generating any response.
