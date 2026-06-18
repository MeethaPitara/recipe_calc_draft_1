# Codex Global Instructions

Scope: applies to all repositories in the workspace unless a deeper `AGENTS.md` overrides a rule.

## Core Principles
- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- Prefer existing project conventions and abstractions.
- Preserve backward compatibility unless explicitly asked for a breaking change.

## Working Style
- For big plans, design decisions, or ambiguous requests: ask clarifying questions until you're sure what to implement. (For minor items / bug fixes, see *Autonomous Bug Fixing* — just fix.)
- Make the smallest safe change that solves the request.
- Keep explanations concise and implementation-focused.
- When creating plan markdown files (under `docs/plans/`), do not include code snippets or implementation code.
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution."
- Skip this for simple, obvious fixes — don't over-engineer.
- Challenge your own work before presenting it.

### Plan Mode
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions).
- If something goes sideways, STOP and re-plan immediately — don't keep pushing.
- Use plan mode for verification steps, not just building.
- Write detailed specs upfront to reduce ambiguity.

### Phased Implementation
- Break non-trivial work into discrete phases in the plan file; implement and ship one phase at a time.
- Document each phase in the plan file as you go:
  - **Implementation notes** — what was actually done, deviations from the original plan, and why.
  - **Learnings** — surprises, gotchas, design corrections worth remembering for later phases.
  - **Post-review changes** — when the user asks for changes after reviewing a phase, record those changes in the plan under the same phase before applying them, so the plan stays the source of truth.
- Tests are part of every phase, not a final-step afterthought. Write tests as you build the phase and run them automatically (without being asked), following the project's testing rules — see *Verification & Code Quality* and any repo-specific test-authoring section.
- Pause after each phase for user review. Do not start the next phase until the current one is reviewed.
- Choose how to carry context between phases:
  - **New chat** when the next phase is uncorrelated (different module, unrelated concern) — keeps the context window clean.
  - **Same chat** when phases share context that would be expensive to re-establish.
  - **Compact the conversation** when phases are correlated but a significant share of the context window is already used.

### Subagent Strategy
- Use subagents liberally to keep main context window clean.
- Offload research, exploration, and parallel analysis to subagents.
- For complex problems, throw more compute at it via subagents.
- One task per subagent for focused execution.

### Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding.
- Point at logs, errors, failing tests — then resolve them.
- Zero context switching required from the user.
- Go fix failing CI tests without being told how.

## Task Management
1. **Plan First**: Write the plan to `docs/plans/<task-slug>.md` in the applicable repo, using a task-specific filename (e.g., `docs/plans/add-oauth-login.md`) — not a generic `todo.md`. Checkable items.
2. **Verify Plan**: Check it before starting implementation.
3. **Track Progress**: Mark items complete as you go.
4. **Explain Changes**: High-level summary at each step.
5. **Document Results**: Append a review section to the same `docs/plans/<task-slug>.md` file when the task is done.

## Activity Log
- After **every** writing or modification session, append an entry to `C:\CODEBASE\FlyNapse_AI\copilot-mro\docs\agent_6_plan_&_context\timeline.md`.
- Each entry must follow this format:
[YYYY-MM-DD HH:MM] — <one-line summary of what was done>

Files touched: path/to/file1.py, path/to/file2.md
Changes: <what was done in ≤2-3 words per file>
Purpose: <why — linked task or feature slug>

- Keep it log-style: factual, no prose, no duplication of plan files.
- If the exact timestamp is unavailable, use the session date and note `(approx)`.
- Never skip this step — it is mandatory, not optional, even for single-file edits.

## Self-Improvement Loop
- After ANY correction from the user: update `docs/plans/lessons.md` with the pattern.
- Write rules for yourself that prevent the same mistake.
- Ruthlessly iterate on these lessons until mistake rate drops.
- Review lessons at session start for relevant project.

## Verification & Code Quality
- Never mark a task complete without proving it works.
- Diff behavior between main and your changes when relevant.
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness.
- Add or update tests when behavior changes.
- Run targeted validation for touched code (`test`, `lint`, `typecheck`, or build checks as appropriate).
- If validation cannot run, state what was skipped and why.

## Core Languages
- Primary backend language: Python.
- Primary frontend language: TypeScript (frontend-focused).

## Tooling Preferences
- Use `rg` / `rg --files` for search.
- Python:
  - Prefer `python3`.
  - Use Poetry when `pyproject.toml` indicates a Poetry-managed project.
  - When the workspace has a shared Poetry environment that covers sibling repos (e.g., a top-level `api/` project), prefer running tests from that shared env rather than from each repo's own — keeps dependency versions aligned across repos.
  - Prefix pytest with `DEBUG=false` when the project uses Pydantic settings and the shell may inject a non-boolean `DEBUG` value (e.g., `DEBUG=release`), which causes silent boolean-parsing failures. Example, run from the shared env's directory: `DEBUG=false poetry run pytest <path/to/test_file.py>`.
- Frontend TypeScript:
  - Use the project's existing package manager (`npm`, `pnpm`, or `yarn`) based on lockfile.
  - Run repo-native checks (`typecheck`, `lint`, `test`, build) for touched areas.

## Python Test Authoring Pattern (copilot-mro)

When adding tests under `copilot-mro/tests/` that target planner / agent modules, follow the **dynamic-loader pattern** used by `tests/test_plan_executor.py` and `tests/test_planner_tool_registry.py`. Do not import the package directly — full package import triggers DB / Redis / Weaviate initialization that adds ~30s of overhead per test run and pulls in network dependencies.

Use `importlib.util.spec_from_file_location` to load only the planner submodules under test, plus a small `_ensure_package` helper that registers placeholder parent packages in `sys.modules` so relative imports inside the loaded modules resolve.

Reference patterns to copy from:
- `tests/test_plan_executor.py` (`_ensure_package`, `_load_module`, `_load_planner_modules`).
- `tests/test_deferred_outputs_mechanism.py` (extension that adds the `deferred_outputs` submodule to the loader).

Rules:
- Each new test file that touches planner modules should define its own `_load_planner_modules()` helper that loads only what the test actually exercises.
- When adding a new submodule under `copilot_mro/app/services/agents/planner/`, extend the loader in any test that depends on it (loader misses cause `ModuleNotFoundError` on relative imports inside `plan_executor.py` and friends).
- Tests should pass `DEBUG=false poetry run pytest ...` invoked from the shared `api` Poetry env (not from within `copilot-mro/`) and complete in <2s per file (sign that the dynamic loader is working). If a test takes >5s the package-init path is being triggered — fix the loader before merging.

Anti-patterns to avoid:
- `from copilot_mro.app.services.agents.planner.X import Y` at the top of a test file. Triggers full package init.
- Running pytest from the repo's own Poetry env (`cd copilot-mro && poetry run pytest ...`); use the shared `api` env so deps stay aligned.

## Prompt File Authoring (LLM Agent Prompts)

When creating or editing prompt files (`prompts/*.md`) for agents in `copilot-mro`, follow the standard structure below. Each section serves a distinct purpose — no duplication across sections.

### Required Sections (in order)

```
# {Title} – {Domain Context}
---
## 1. ROLE
## 2. INPUTS
## 3. OUTPUT FORMAT (STRICT)
## 4. SEMANTIC RULES (AUTHORITATIVE)
## 5. EXAMPLES
```

Additional numbered sections (e.g., `FILTER RULES`, `SCHEMA REGISTRY`) may be inserted between 4 and 5 when the domain requires them.

### Section Responsibilities

| Section | Contains | Does NOT contain |
|---------|----------|------------------|
| **1. ROLE** | One-line identity ("You are a **X** for…"), what the agent does, explicit "You do not" list | Input/output details, rules, examples |
| **2. INPUTS** | Bullet list of what the agent receives (query, context, memory). Follow-up resolution guidance | Output schema, decision logic |
| **3. OUTPUT FORMAT** | JSON schema in a fenced code block, field-level defaults and constraints under "Output Rules" | Decision logic for choosing field values, examples |
| **4. SEMANTIC RULES** | Decision tables mapping user intent → field values, normalization rules, domain-specific gates | JSON schema (belongs in §3), worked examples (belongs in §5) |
| **5. EXAMPLES** | Worked examples: user query → full JSON output. Cover happy path, edge cases, follow-ups | Rule explanations (belongs in §4) |

### Formatting Conventions
- **Numbered headings** (`## 1.`, `## 2.`, …) — keeps ordering unambiguous.
- **`---` separators** between top-level sections.
- **Bold** (`**term**`) for emphasis; backticks for field names and values.
- **Tables** for decision matrices (intent → field value mappings).
- **Fenced JSON** (```` ```json ````) for the output schema; examples use `### Example A — description` sub-headings.
- Examples should include a `reason` field that explains the mapping rationale.

### Anti-Patterns
- Mixing output schema with decision logic (split into §3 and §4).
- Flat bullet-list rules without section separation.
- Omitting the "You do not" boundary in the ROLE section.
- Duplicating rules as prose and again in examples — state the rule once in §4, demonstrate once in §5.
- **Inline cross-references within the same prompt** (e.g., `see §4.7`, `see §4.10`). The model reads the prompt end-to-end every call — pointers to sibling sections add no signal and break silently when sections are renumbered. State the rule where it lives once and trust the read order.
- **Defensive rules for cases that cannot occur in this prompt's scope** (e.g., handling input types or signals that are never wired into this agent). Dead weight that bloats the prompt and signals architectural uncertainty.

### Review Checklist
Before finalizing a prompt file, review it for:
- **Duplication** — the same rule stated in multiple places. State it once where it belongs (typically §4), demonstrate it once in §5.
- **Logical inconsistency** — rules that can't all be true at once, or that produce undefined behavior when applied together.
- **Contradictions across sections** — e.g., a default in §3 conflicting with a decision rule in §4, or an example in §5 that violates §4.
- **No cross-tool leakage** — each prompt describes only the behavior of its own tool/agent. Don't reference what an upstream, downstream, or sibling tool/agent does, defaults to, or decides — unless there's a real data or execution dependency between them. If the information genuinely matters across components, it belongs either in the other prompt or in shared code (e.g., the data contract / signal definitions the components share), not duplicated here. Stray cross-references couple prompts together, bias the model with irrelevant context, and drift silently when the other prompt changes.

## Safety Rules
- Never run destructive git commands (`git reset --hard`, `git checkout --`, force-push) unless explicitly asked.
- Do not modify secrets, credentials, or environment files unless explicitly requested.
- Avoid broad refactors unrelated to the task.

## Response Expectations
- Summarize what changed and why.
- List key commands run and notable results.
- Reference changed files with paths.
