# Foundation-First Architecture

> **Most projects fail not because of bad code, but because foundational elements are an afterthought.**

## Quick Start

```bash
# 1. Read the psychology foundation
cat .journeys/psychology/persuasion-protocols.yaml

# 2. Define your primary persona
cp .journeys/_templates/persona-enhanced.template.yaml .journeys/personas/my-user.yaml

# 3. Map your core journey
cp .journeys/_templates/journey.template.yaml .journeys/journeys/core-journey.yaml

# 4. Validate everything connects
npm run journey:validate
```

## The 7-Layer Foundation

| Layer | Purpose | Key Question |
|-------|---------|--------------|
| 1. Psychology | WHY users behave | What motivates action? |
| 2. Personas | WHO you're building for | Who is this person? |
| 3. Journeys | WHAT paths they take | How do they get there? |
| 4. Emotions | HOW they should feel | What's their emotional state? |
| 5. Scenarios | WHEN it's done | What proves success? |
| 6. Quality | HOW GOOD it must be | Does it meet standards? |
| 7. Business | What SUCCESS looks like | Are we hitting metrics? |

Plus: **Structural Layer** - The 8 states developers forget

## File Structure

```
.journeys/
├── MASTER-INDEX.yaml       # How everything connects
├── README.md               # This file
├── psychology/             # Layer 1: Cialdini, Fogg, cognitive
├── personas/               # Layer 2: User profiles
├── journeys/               # Layer 3: Journey maps
├── emotions/               # Layer 4: Emotional architecture
├── scenarios/              # Layer 5: BDD acceptance criteria
├── heuristics/             # Layer 6: Nielsen, quality gates
├── metrics/                # Layer 7: AARRR framework
├── funnel/                 # Layer 7: Sales integration
├── structural/             # Missing states checklist
├── _templates/             # Copy-and-customize templates
└── validation/             # Pre-commit validation
```

## The Shift

| Old Way | Foundation-First |
|---------|------------------|
| Code → Hope → Audit → Fix | Define → Design → Code → Validate |
| "Build a form" | "Enable user to commit" |
| "Add validation" | "Prevent frustration" |
| "Track clicks" | "Measure journey conversion" |

## Success Criteria

- [ ] Developers ask "which journey?" before coding
- [ ] Designers reference psychology in screens
- [ ] Code reviews check emotional states
- [ ] Bug reports include journey context
- [ ] No component ships without 8 states
