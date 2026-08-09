# AGENTS.md

The rules for agents working in this repository live in [`CLAUDE.md`](CLAUDE.md). Read that file.

It is not duplicated here on purpose. Two copies of the same rules drift, and the copy an agent
happens to read is then a coin toss.

The three that most often go wrong, so they are visible without a second hop:

1. **Human merge only.** No agent pushes, opens, readies or merges a pull request without a
   complete definition of done and an independent review bound to the exact final commit.
2. **Never handle a credential.** Do not invent, generate, retrieve or set one, and do not work
   around a missing one — record the blocker instead.
3. **Never work in the primary checkout.** It is shared and moves under you. Use a worktree
   outside the repository, on persistent storage, never `/tmp`.
