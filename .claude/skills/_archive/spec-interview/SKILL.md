# Spec Interview Skill

**Name:** spec-interview
**Triggers:** `/spec-interview`, when requirements unclear
**Version:** 1.0.0

---

## Purpose

Interviews user to gather complete requirements before planning.

---

## Interview Questions

When requirements are unclear, ask:

### 1. Feature Clarity

**Question:** "What is this feature supposed to do?"
**Why:** Need clear objective

### 2. User Impact

**Question:** "Who will use this and why?"
**Why:** Understand user needs

### 3. Success Criteria

**Question:** "How will we know this is working correctly?"
**Why:** Define testable outcomes

### 4. Constraints

**Question:** "Are there any technical or business constraints?"
**Why:** Avoid blocked work

### 5. Edge Cases

**Question:** "What should happen if [edge case]?"
**Why:** Handle errors gracefully

### 6. Integration Points

**Question:** "Does this integrate with existing features?"
**Why:** Prevent breaking changes

---

## Interview Flow

```
👋 I need to clarify a few things before planning:

1. **What should this feature do?**
   [Wait for answer]

2. **Who will use it?**
   [Wait for answer]

3. **How will we test it's working?**
   [Wait for answer]

4. **Any constraints or dependencies?**
   [Wait for answer]

---

Based on your answers, here's what I understand:
[Summarize]

Is this correct? Ready to plan?
```

---

## Usage

Automatically triggered when:

- User request is vague
- Requirements seem incomplete
- Multiple interpretations possible

Manually triggered:

```
/spec-interview
```

---

## Output

After interview, create a mini-spec:

```
## Feature Specification

**What:** [Feature name]
**Who:** [User type]
**Why:** [Problem being solved]
**Success:** [How we know it works]

**Constraints:**
- [Constraint 1]
- [Constraint 2]

**Edge Cases to Handle:**
- [Edge case 1]
- [Edge case 2]

Ready to create implementation plan.
```
