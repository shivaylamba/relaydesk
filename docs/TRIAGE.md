# Knowledge-led triage before Devin

## Purpose and current scope

This implements the requested pre-escalation interface: determine what to do with a support report before starting a coding-agent investigation. The default workspace and knowledge remain fictional Cedar fixtures. No Lix account, production knowledge, Intercom inbox or Devin account has been connected.

The existing Slack/local UI intake, OpenLore service, resolution reviews and support retrieval remain in place. Triage is a separate internal step. It uses the engineering identity with a restricted read-only tool set over `/approved` and `/engineering`. The underlying identity still has its normal grants; this release does not introduce a new OpenLore principal.

## Recommendation and human route

The model submits a structured result with one recommendation:

| Recommendation | Meaning |
|---|---|
| Handle with support guidance | Applicable approved guidance was cited. |
| Collect more information | Specific questions are needed before deciding. |
| Review an operational action | A documented operational/configuration action needs an authorized operator. |
| Investigate a possible code change | Existing evidence supports an engineering investigation, not a confirmed fix. |
| Not enough evidence to decide | Evidence is absent, conflicting or unusable. Code-change need remains unknown. |

The screen also shows code-change assessment (`likely`, `not-indicated`, `unknown`), qualitative confidence (not a probability), exact excerpts, source type/hash, reasoning, missing questions, reported reproduction and suggested steps. The agent cannot reproduce an issue, execute code, publish findings, approve guidance or contact Devin.

A nominated reviewer records the actual route and reason. The default local operator is nominated under the existing `/approved` reviewer policy. Self-review by the agent is not possible. A human may override the recommendation; overriding an undecided result toward engineering requires an explicit explanation of at least 60 characters. Recording a route does not execute operations or send a response.

For an engineering route, prepare a local Markdown handoff after confirming the destination is authorized to receive internal material. It includes the report, approved/internal evidence distinction, hashes, reproduction gaps, hypothesis, next steps and human decision. Copy/download it for an authorized Devin workspace. **It is not submitted to Devin.** The UI explicitly shows both Devin and Intercom as not connected.

## Freshness and evidence checks

- Evidence must quote exact text from an allowed document successfully read in that run. Search snippets alone do not qualify as read-document evidence.
- Support guidance requires approved evidence. Code investigation requires evidence and a `likely` code-change assessment; internal hypotheses stay labeled as such.
- Without cited knowledge, only an insufficient-evidence/unknown/low result is accepted. These controls validate structure and exact source use; they do not prove the model's interpretation is correct.
- The report binds the ticket title, description and appended context. Adding context makes an earlier report stale.
- Routing and handoff preparation re-read cited documents and compare their hashes. A changed source blocks the action until a fresh assessment is made. A newer failed/running triage attempt prevents use of an older report as current.
- Assessments and decisions are retained as history. Reassessment creates a new record; an existing route is not silently edited.
- OpenLore and SQLite are separate stores. A hash check is not an atomic cross-service snapshot, and copied briefs remain dated snapshots. Review them before use.

Internal triage is never injected into support conversations or the support-only evidence export. It may contain private engineering information. The current web app remains a trusted single-operator workspace; selecting a tab is not multiuser authorization or general DLP.

## APIs

All endpoints use the existing server-side operator-key/origin controls. They are RelayDesk APIs, not native OpenLore review/triage APIs.

| Endpoint | Behavior |
|---|---|
| `GET /api/tickets/:id/triage` | Latest report, decision, internal run trace, staleness and history. |
| `POST /api/tickets/:id/triage` with `{}` | Starts a real read-only agent assessment. Requires a provider key and OpenLore connection. |
| `POST /api/triage/:id/decision` | Records `{assessmentHash, action, reason}` under the trusted operator's nominated reviewer identity. |
| `POST /api/tickets/:id/context` | Adds `{note}`; invalidates earlier ticket fingerprints. |
| `POST /api/tickets/:id/devin-brief` | Requires `{acknowledgeInternal: true}` and a current reviewed engineering route. Returns Markdown and `sent: false`. |

New initial engineering runs are gated by a current engineering route. An explicitly requested revision of the latest existing proposal can continue its review cycle. Support runs and retrieval of already-approved resolutions remain available.

## Existing installation migration

Rebuild the frontend and restart the owned RelayDesk application. SQLite's existing record store needs no schema migration. Old tickets, chats, proposals, approvals and traces are preserved; they are not retroactively given triage results.

The new source fixtures are `knowledge/approved/triage-routing.md` and `knowledge/engineering/triage-evidence-guide.md`. `pnpm setup` copies new fixture paths and refreshes local tokens while preserving learned documents. It deliberately does not overwrite existing playbooks/resolutions: review existing knowledge before updating it through the normal authorized write path. Start/restart only the owned RelayDesk OpenLore instance when configuration requires it.

New Slack replies offer **Request internal triage**. Older `Escalate to engineering` buttons also request triage; they no longer bypass the assessment. A summary is queued only for the configured private engineering channel. The human uses the local web UI to record routing. Reviewer-requested resolution revisions retain their existing separate behavior.

## Implementation status

This feature was implemented on October 23, 2026. JavaScript syntax checks, TypeScript compilation and the production frontend build are reported separately in the delivery notes. No new automated tests or real provider/Slack/Devin/Intercom round trip were executed for this feature. Earlier Slack E2E and OpenCrewBot endurance evidence do not validate the new triage path.

To use it with Lix, the remaining work is to provision appropriate actual knowledge/identities and connect authorized Intercom/Devin accounts. Those transports are not simulated here. No automatic coding, customer send, operational action or support-case closure is performed by a routing decision.
