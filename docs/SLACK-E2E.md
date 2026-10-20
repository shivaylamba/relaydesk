# Live Slack demonstration — 20 October 2026

RelayDesk is installed and connected through Socket Mode in **Studio1HQ**. This is an executed local synthetic workflow, separate from the OpenCrewBot endurance campaign. Keep the local app running for Slack actions to work; closing the laptop interrupts this local service.

## What changed following Adil's feedback

- Per-docset nominated reviewers for `/approved`; a contributor cannot approve its own submission. Approve edited text, request changes, and reject are available in the local HTTP API/UI and Slack review modal.
- Approval binds to the proposal's exact remote revision and destination baseline. Edits or superseded submissions require a new review. The audit links author, proposal, source hash, reviewer, reviewed text hash and canonical document hash.
- Support credentials now exclude the contribution inbox entirely. Pending proposals cannot become support guidance merely by appearing in a search.
- Internal docsets support cosigning after publication. Endorsements apply to an exact content hash with attributed authorship; old endorsements remain visible but cease to endorse a changed revision. `/approved` cannot bypass nominated approval through cosigning.
- Agents can discover actual credential-resolved collections and paths. Tool guidance explains the virtual shell's limitations and recovery from empty searches.

These review and endorsement functions are **RelayDesk application features layered over OpenLore v0.7.5**, not a claim that OpenLore already ships the proposed native approval APIs. OpenLore enforces the scoped knowledge access and stores the documents. RelayDesk supplies review state, Slack orchestration and the audit log.

## Installed scope

| Channel | Purpose | Visibility |
|---|---|---|
| `relaydesk-demo-support` | Synthetic issue and customer-safe replies | Public demo channel |
| `relaydesk-demo-engineering` | Investigation handoffs and engineering results | Private |
| `relaydesk-demo-review` | Proposal review and decisions | Private |

Bot scopes: `app_mentions:read`, `chat:write`, `channels:read`, `groups:read`. The app token has `connections:write`. No message-history scope was requested. The app validates workspace, bound channel membership, private engineering/review destinations and absence of Slack Connect sharing. Credentials live only in ignored server-side `.env` (0600); a fresh checkout requires its own installation.

## Executed workflow: RD-1005

1. Posted a synthetic login-loop report in the support channel, mentioning RelayDesk.
2. Support searched its permitted knowledge and posted cautious triage in the original thread.
3. Clicked **Escalate to engineering**. A fresh engineering session searched private login investigation excerpts, saved a private investigation and published revision 1 for review. It did not separately `cat` the entire original engineering fixture; the search output supplied its private excerpts.
4. In Slack, requested changes because the proposal asserted wider awareness, active investigation and promised updates without evidence.
5. A fresh engineering session received the review feedback, created revision 2 and superseded revision 1. It still implied engineering review, so the reviewer edited the text before approval.
6. Approved that exact edited text in Slack. RelayDesk promoted it to `/approved/RD-1005.md` and recorded the reviewer plus source/content hashes.
7. A fresh support session with **zero prior conversation messages** read the canonical document, with the trace output hash matching the approved document hash. It posted a source-citing reply in the original support thread.
8. Restarted RelayDesk: Socket Mode reconnected; the four completed jobs and ten sent outbox records remained unchanged. Clicking revision 1's old button returned an ephemeral superseded notice and applied no approval.

The original Slack thread and delivery records are retained locally. Workspace-specific message links are excluded from this source repository.

## Observed results

| Agent run | Duration | Model requests | MCP operations | Failed MCP operations |
|---|---:|---:|---:|---:|
| Initial support | 5.345 s | 5 | 7 | 1 |
| Engineering revision 1 | 7.051 s | 6 | 10 | 1 |
| Engineering revision 2 | 7.524 s | 6 | 10 | 1 |
| Fresh support after approval | 3.037 s | 3 | 5 | 0 |

All **four actual Nebius Qwen/Qwen3-235B-A22B-Instruct-2507 agent runs completed**, comprising 20 model requests and 32 MCP operations. The three failed MCP operations are retained: one support keyword search had no matches; two engineering submissions checked for a not-yet-existing canonical ticket resolution. The latter were expected absence checks before first publication. No private fixture marker appeared in the support export. All **four Slack jobs completed and ten outbox messages were sent**; a separate ephemeral refusal is not counted as an outbox message. Provider token/cost telemetry is unavailable.

The 16 executed policy/workflow checks cover actual scoped denial for backend and draft reads, nomination and self-approval, changed proposals, superseded revisions, requested changes, canonical conflicts, exact readback, and revision-bound cosigning. These are direct integration checks, not model runs. The live evidence exporter independently checked 14 invariants; it is an assessment of this recorded workflow, not a separate test cohort.

## Evidence and reproduction

Raw model/tool traces, support exports, reconnect records and screenshots are retained under ignored local `docs/evidence/` storage. They are excluded from the source repository because they can contain workspace identifiers, private-role material and Slack sidebar labels. The results above summarize the original run; a fresh clone does not include its historical ticket database or raw evidence.

With the local service and dependencies running:

```sh
node scripts/verify-review.mjs
node scripts/export-slack-evidence.mjs RD-1005 docs/evidence/slack-e2e
```

The first command creates a labeled synthetic verification ticket and isolated documents; it does not reset the existing demo. The export requires the existing ticket and reads its approved document; it does not send Slack messages. For a new real workflow, mention the installed bot with a synthetic issue and follow the Slack buttons described above.

## Limits

The implementing assistant operated the reviewer account under the user's authorization. This was **not independent human-user sign-off**. Review successfully removed unsupported claims; the final support response still paraphrased the source and inferred a possible browser-state issue. Retrieval does not establish hallucination-free generation.

This remains a single trusted-operator local MVP. The role inspection switch is not multiuser authentication. No two-human live authorization attack, comprehensive security audit, native Claude/Codex session, Docker execution, or RelayDesk endurance observation was performed in this demonstration. Remote OpenLore and local SQLite are not one distributed transaction; failed promotions record reconciliation intent, and uncertain sends are not blindly replayed. The existing checkout demo and OpenCrewBot results remain intact.

Videos, raw evidence exports and screenshots are excluded from Git. Preserve that exclusion when creating a shareable source package.
