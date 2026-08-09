# Eagle Task Dispatch Template

This template is mandatory for every Eagle task dispatch, continuation, install, acceptance, or tracking action.

## Identity Gate

- Request time:
- Source instruction:
- Current thread projectId:
- Registered Eagle projectId:
- ProjectId check result:
- CWD:
- CWD check result:
- Target source/doc/data/artifact paths:
- Registered external paths, if any:
- Target path check result:
- Bundle/plugin/host identity:
- Identity not applicable reason, if not applicable:
- Bundle/plugin/host check result:
- Final gate result:

If any field is mismatched, unavailable, or impossible to confirm, stop. Refuse the action and route it to the correct project manager or task line. Do not change directory to bypass the gate. Do not use recent chat context, delegation text, or short commands such as "continue" or "install now" as a substitute for project identity.

## Task Scope

- Functional line:
- Owner task:
- Goal:
- Non-goals:
- Files allowed:
- Files forbidden:
- External systems in scope:
- External systems forbidden:

## Facts

- Required documents read:
- Bug/R-ID ledger entries:
- Current installed version/API:
- Candidate version/API:
- Known rollback point:
- Dirty worktree notes:

## Execution Contract

- Failure test required before fix:
- Minimum implementation boundary:
- Regression tests:
- Source gate:
- Real Eagle gate:
- Library/NAS/iCloud gate:
- Rollback plan:
- Stop conditions:

## Model Record

- Task tier:
- Tier evidence:
- Model:
- Reasoning level:
- Selection reason:
- Context budget:
- Output budget:
- Upgrade conditions:
- Downgrade/split points:
- Mechanical work delegated or downgraded:
- Post-task model usage audit:

Tier rules:

- T0: read-only inventory, simple docs, repeated checks, fixed-format cleanup. Use the lowest-cost available model with minimal/low reasoning.
- T1: clear single-file or single-module small change, no real Eagle/Library/NAS/iCloud action. Use a cost-efficient code model with low/medium reasoning.
- T2: multiple files inside one module, limited state reasoning, failure tests and local regression required. Use a stronger code model with medium reasoning unless evidence requires escalation.
- T3: cross-module complex state, repeated failures, real Eagle/Library/NAS/iCloud, install, migration, release, or rollback. Only this tier may use gpt-5.6-sol/high or the current equivalent highest-reliability option.

If the task cannot be proven T3, do not choose T3. After architecture and risk decisions are complete, split or downgrade mechanical implementation, builds, static checks, repeated tests, and documentation cleanup.

## Handoff

- Expected deliverables:
- Evidence files:
- TASKS/DECISIONS update requirement:
- Final acceptance owner:
