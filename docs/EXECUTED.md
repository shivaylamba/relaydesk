# Executed locally — 19 October 2026

This is an executed synthetic product demonstration. It is separate from the earlier OpenCrewBot two-hour evaluation.

## What actually ran

- TypeScript compilation and Vite production build completed. Fonts are bundled locally. The build output is retained locally.
- RelayDesk started on `http://localhost:3410` with its own SQLite store and OpenLore **v0.7.5** instance on port **48180**. Five separate principals were created; the existing OpenCrewBot knowledge service and overnight assessment remained unchanged.
- Three real **Nebius Token Factory Qwen/Qwen3-235B-A22B-Instruct-2507** runs completed for checkout ticket RD-1001:

| Run | Result | Duration | MCP operations |
|---|---|---:|---:|
| Initial support triage | Read approved handling guidelines and support playbook | 33.149 s | 5 |
| Private engineering investigation | Read private checkout notes, saved investigation and published a proposed response | 72.758 s | 6 |
| Fresh support after approval | Retrieved `/approved/RD-1001.md` and cited it | 46.123 s | 3 |

Across the 14 MCP operations, 13 succeeded and one initial `grep` returned no matches (exit 1). The agent broadened its search and completed the triage; the failed attempt remains in the trace.

The last run’s recorded initial messages contain one system message and the current ticket request, with **zero prior conversation messages**. Its retrieved source was the approved resolution. No engineering transcript was supplied to it. The synthetic private fixture marker does not appear in the exported support records.

## What the review caught

The generated proposal asserted a confirmed duplicate charge and promised that the team was manually verifying the transaction and would follow up shortly. Those claims were unsupported. During the browser demonstration, the implementing assistant acted as the local operator: it inspected the original proposal, replaced those assertions with cautious wording, checked the review confirmation, and promoted the edited text. This was a synthetic operator demonstration, not a real customer resolution or independent human-user sign-off.

The original proposal, its hash and the edited approved content are retained. This demonstrates why shared memory still needs editorial review. The fresh support reply retrieved the reviewed document and preserved uncertainty about settled charges, fixes and timelines. It paraphrased the document; factual grounding is not a guarantee of verbatim reproduction or hallucination-free generation.

## Evidence

- Actual runs, operations, proposal and review snapshot: local `docs/evidence/local-flow.json`.
- Support-only export: local `docs/evidence/support-evidence.json`.
- Browser screenshot: local `docs/evidence/relaydesk.jpg`.

Raw evidence, screenshots, runtime artifacts and credentials remain in ignored local storage and are not included in the source repository. These local records contain the synthetic fixture workflow; provider token/cost telemetry was not collected. This document summarizes the observed results; a fresh clone does not contain the original traces or installed workspace state.

## Prepared but not exercised live

- **Slack at the original 19 October snapshot:** implemented but not yet installed. This changed on 20 October; see the executed update below. OAuth installation across multiple workspaces remains outside this release.
- **Native coding clients:** Codex/Claude scoped launchers are included; these launchers were not executed for this RelayDesk demonstration.
- **Docker:** Dockerfile and Compose configuration are included; no image build or container run has been performed.
- **Coverage:** No comprehensive automated test suite or RelayDesk endurance campaign was run. The earlier OpenCrewBot endurance result must not be attributed to this application.

The application is a single trusted-operator MVP; its inspection-role switch is not multiuser authentication.

## Executed update — 20 October 2026

RelayDesk was installed in Studio1HQ with dedicated support/private engineering/private review channels. A real Slack mention, escalation, request for changes, second proposal revision, edited approval and fresh support reply completed for synthetic ticket RD-1005. Four actual Qwen agent runs completed, with 20 model requests, 32 MCP operations and ten sent outbox messages. Three failed MCP operations remain in the trace: an empty support search and two expected canonical-document absence checks. Restart/reconnect preserved all four jobs and ten deliveries without a new outbox record. A superseded Review button visibly refused approval.

Sixteen direct OpenLore policy/workflow checks passed for nominated review, revision conflicts, scoped denial, exact approved readback and cosigning. Review and agent discovery were improved based on Adil's feedback. Pending contributions are no longer readable by support identities. Results, caveats and reproduction: [Live Slack demonstration](SLACK-E2E.md). Raw traces and screenshots are retained locally.

The original RD-1001 demo remains intact. This update does not turn the original local flow into an endurance run or an independent human-user approval.
