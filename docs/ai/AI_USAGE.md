# AI usage log

How AI tools were used to build this project, and where human judgment overrode them.
Prompts are in `docs/ai/PROMPTS.md`; standing rules are in `/CLAUDE.md`.

## Tools
- <AI coding agent / model>: implementation, tests, refactors
- <Chat assistant>: requirement analysis, architecture discussion, prompt drafting

## Workflow
1. Clarify requirements and decisions in conversation before coding.
2. Encode rules once in `CLAUDE.md` (architecture, TDD, conventions).
3. Run one phase at a time; review every diff; run checks; commit in small steps.

## Log (one entry per phase)

### Phase N — <title>
- **Asked for:** …
- **AI did well:** …
- **AI got wrong / I changed:** …
- **Rejected suggestions and why:** …
- **Lesson / rule added to CLAUDE.md:** …
