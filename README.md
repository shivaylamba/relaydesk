# RelayDesk

**Resolve the issue. Keep what your team learns.**

A standalone support-to-engineering workspace with real Nebius agents, identity-scoped OpenLore memory, a human review queue, and a Slack interface.

## The workflow

1. A support agent searches approved knowledge and the support playbook.
2. A separate engineering agent reads private investigations and records findings.
3. Engineering publishes a customer-safe proposed resolution.
4. A nominated reviewer approves, requests changes, or rejects an exact proposal revision. Approval promotes only the reviewed text into approved knowledge.
5. A fresh support model conversation retrieves the approved resolution. Previous engineering transcripts are never injected into that conversation.

The shipped fixtures describe a fictional Cedar product: duplicate checkout entries, a login loop, and delayed webhooks. No production customer system is accessed.

## Run locally

Requirements: Node **22.13+**, pnpm **10.23+**, Python **3.11+**, `ssh-keygen`, and a Nebius Token Factory key for real agent calls.

```sh
pnpm install
cp .env.example .env
# Set NEBIUS_API_KEY in .env. Keep it server-side.
pnpm launch
```

Open **http://localhost:3410**. `launch` obtains checksum-verified OpenLore **v0.7.5**, creates independent principals, starts its own knowledge service, builds the web app and starts RelayDesk. Re-running setup preserves learned documents and the SQLite ticket store. If the app is already running, open it rather than launching a second instance.

Manual process control:

```sh
pnpm setup
pnpm lore
pnpm build
pnpm start
# In another terminal, for frontend development:
pnpm web
# Stop only RelayDesk’s owned knowledge service after stopping the app:
pnpm lore:stop
```

The app uses port **3410**, frontend dev uses **3411**, OpenLore HTTP/MCP uses **48180**, and OpenLore SSH uses **42322**. These are independent of the OpenCrewBot showcase and its endurance runner. The OpenLore binary listens on its own HTTP/SSH ports; keep those ports on a trusted host or isolated network. Only the app port is mapped by the supplied Docker configuration.

Without a provider key you can browse tickets, knowledge and setup, but agent actions report that a real key is required. There are no canned model responses or mock-success mode.

## Real demonstration

```sh
pnpm demo
```

This interactive script creates a synthetic ticket, runs actual support and engineering turns, pauses for operator review in the browser, then starts a fresh support turn. It never automatically approves a proposed resolution. Export the support evidence from the ticket header. The exported support evidence excludes engineering transcripts; inspect engineering operations separately in the operator workspace.

See [five-minute walkthrough](docs/DEMO.md) and [executed evidence](docs/EXECUTED.md).

## Slack

The connector uses Slack Bolt and Socket Mode and is **disabled by default in a fresh checkout**. A live Studio1HQ installation has now completed the synthetic workflow; see [executed Slack evidence](docs/SLACK-E2E.md). New installations require their own Slack app and channel bindings. Credentials are never included in the repository.

1. Create a Slack app from [slack-manifest.json](slack-manifest.json). Enable Socket Mode.
2. Install it to your workspace. Put its bot token in `SLACK_BOT_TOKEN` in `.env`.
3. Generate an app-level token with `connections:write`; put it in `SLACK_APP_TOKEN`.
4. Create three distinct destinations: a support channel, a **private engineering channel**, and a **private review channel**. Invite the bot to each.
5. Set the workspace ID, three channel IDs, and the comma-separated Slack user IDs authorized to review proposals in `.env`.
6. Set `SLACK_ENABLED=true`. Once the destination bindings are checked, explicitly set `SLACK_DELIVERY_ENABLED=true`. Restart RelayDesk.
7. In the configured support channel, mention `@RelayDesk` with a synthetic issue. Mention it in the same thread for a follow-up. Replies stay in that thread. Direct messages and unmentioned messages are outside this MVP’s subscriptions.
8. Use **Escalate to engineering**. Investigation output stays in the private engineering channel. Customer-safe proposals appear in the private review channel.
9. A nominated reviewer selects **Review resolution** and can approve edited text, request changes, or reject. A changes request starts a fresh engineering revision with the reviewer feedback. Approval starts a fresh support run; its actual tool trace must show the exact approved document revision before a reply is sent to the original support thread.

The connector checks `auth.test`, verifies the workspace ID and bot channel membership, requires private engineering/review channels, and rejects Slack Connect destinations. Roles come from fixed server-side bindings, never from message text. The app never forwards engineering threads into support prompts. Slack reviewers are checked against the configured allowlist and review modal sessions are bound to the user/workspace/source hash.

Events are deduplicated and queued durably in SQLite. Agent jobs interrupted by a restart require inspection instead of automatic write replay. Outgoing messages record `held`, `queued`, `sending`, `sent`, `failed` or `uncertain`. An interrupted or uncertain delivery is not silently reported as sent. Inspect the delivery trail before manually repeating an action; exactly-once external delivery is not claimed. If delivery is disabled, messages stay held.

Slack Socket Mode is suitable for the self-hosted workspace. Public Slack Marketplace distribution would require a supported distribution/delivery arrangement; this repository does not implement multi-workspace OAuth installation. [Slack Socket Mode](https://docs.slack.dev/apis/events-api/using-socket-mode/), [Bolt actions](https://docs.slack.dev/tools/bolt-js/concepts/actions/).

## Knowledge and permissions

| Collection | Support / Claude | Engineering / Codex | Reviewer |
|---|---|---|---|
| `/approved` | Read | Read | Read/write |
| `/support` | Read/write | None | Read/write |
| `/engineering` | None | Read/write | Read/write |
| `/contributions` | None | Publish | Read/write |

`publish` permits reading the collection and creating/updating documents in its inbox; it does not permit deletion. Engineering contributors can read that collection, so private investigations must stay in `/engineering`. Support and Claude-support are denied inbox access by OpenLore itself, not just by agent instructions. Proposals remain editable remote documents; review snapshots bind the source hash. Each submission has a unique source path and increasing ticket revision. Approval refuses a changed source, a superseded revision, or a destination changed since submission; canonical writes also use OpenLore’s conflict checking. The human operator reviews all proposed text before promotion; the synthetic marker detector is an extra fixture safeguard, not general data-loss prevention. [OpenLore writing model](https://openlore.sh/docs/writing/).

Agents receive only constrained discovery/search/read/save/propose tools. Discovery returns credential-resolved collections and paths, with virtual-shell limitations and scoped-not-found guidance. All knowledge operations use real MCP calls with that agent’s token. The reviewer token is used only by explicit review endpoints; it is absent from model tools, model prompts, browser bundles and Slack messages. Structured command exit codes determine success even when MCP/HTTP transport succeeds. Missing MCP sessions are reconnected; reads may retry once, writes require reconciliation.

## External coding agents

After setup, these launchers use separate identities without editing global MCP configuration:

```sh
python3 scripts/client.py codex "Discover your permitted collections. Read the checkout investigation and record a proposed implementation approach in engineering knowledge. Keep private notes out of contributions."
python3 scripts/client.py claude "Discover your permitted collections. Find the latest approved checkout resolution and explain the customer-safe next steps. Cite the source."
```

Native coding clients use their own configured model accounts. OpenCrewBot is not a dependency of RelayDesk. Generated client credentials/configurations stay in ignored `.runtime` storage. The native client launchers are provided as setup tooling; consult `docs/EXECUTED.md` for what was actually run.

## Persistence, recovery and scope

SQLite stores tickets, agent runs, review snapshots, event receipts, Slack jobs and delivery records. OpenLore stores shared/team documents and write attribution. Ticket state is orchestration state; it is not a second knowledge store injected into every agent. Each agent turn uses a fresh provider conversation containing the current customer report and identity-scoped retrieval tools.

Runtime data, tokens, keys and local logs live in `.runtime/` (ignored, directory mode 0700). Provider/Slack secrets stay in `.env` (set mode 0600). OpenLore tokens have a seven-day local TTL. Refresh with `pnpm setup`; restart the app to use refreshed settings. On failure, inspect the actual tool trace; do not label an empty/failed search as proof of missing knowledge.

This release is a **single trusted operator, single Slack workspace MVP**. The operator can inspect both agent views. The UI role switch is an inspection control; it is not multiuser authentication. API access on a non-loopback host requires a strong `RELAYDESK_OPERATOR_KEY`; API browser origins and local hostnames are checked. Internet hosting additionally needs HTTPS, network policy and appropriate application authentication. Tenant provisioning, organization roles, managed OAuth, general DLP and production availability guarantees are follow-up work.

Provider token/cost telemetry is not collected. Durations and tool traces are actual observations. The prior OpenCrewBot two-hour endurance evaluation applies to that integration; it is not an endurance certification of RelayDesk.

## Container option

The container configuration has been prepared; see the executed-evidence document for execution status.

```sh
# Configure .env including a strong RELAYDESK_OPERATOR_KEY first.
docker compose up --build
```

It maps only `127.0.0.1:3410`; OpenLore ports stay inside the container, and a named volume persists runtime state. Enter the operator key when prompted in the web UI. Do not expose this single-operator build as an anonymous public multiuser service.

## Source and license

MIT. OpenLore is an independently distributed Apache-2.0 service. See [architecture](docs/ARCHITECTURE.md) and [upstream notes](docs/UPSTREAM.md).

## Review policy and APIs

RelayDesk implements the review workflow at the application layer; **these are RelayDesk HTTP APIs, not a native OpenLore review API**. OpenLore v0.7.5 remains the scoped document store and conflict-checked MCP transport.

- `/approved`: nominated review. By default, `local-operator` and `slack:<ID>` entries from `SLACK_REVIEWER_IDS` are nominated. Contributors cannot self-approve even if nominated. Agents never receive reviewer tools or credentials.
- `/engineering` and `/support`: optional human cosigning after publication. Endorsements bind the exact content hash, record the attributed author, and do not make draft customer guidance canonical. Changed content does not inherit an old endorsement. Reviewer-service writes without a distinguishable human author cannot be cosigned.
- Override reviewer nominations per docset with server-side `RELAYDESK_REVIEW_POLICIES` JSON, e.g. `{"/approved":{"mode":"nominated","reviewers":["slack:YOUR_MEMBER_ID"]}}`. `/approved` stays gated in this application. Changing nomination configuration requires restarting RelayDesk.

| HTTP endpoint | Purpose |
|---|---|
| `GET /api/review-policies` | Read effective docset policies |
| `GET /api/reviews` | Inspect pending/history, revisions and audit events |
| `POST /api/reviews/:id/approve` | Submit `{content, sourceHash}`; approve exact edited text |
| `POST /api/reviews/:id/request-changes` | Submit `{feedback, sourceHash}`; require another revision |
| `POST /api/reviews/:id/reject` | Submit `{feedback, sourceHash}`; reject this revision |
| `POST /api/knowledge/cosign` | Submit `{path, sourceHash}`; endorse current internal content |

HTTP actors are derived from the trusted local operator context, never accepted from request JSON. Slack actors come from the authenticated Slack event and server nomination policy. This remains a single-operator app, not multiuser web authentication. Audit records include source revision/hash, author, decision actor, exact approved text hash and destination hash. Remote OpenLore commits and local SQLite records are not one distributed transaction; ambiguous promotion failures record reconciliation events and must be inspected.

For reproducible synthetic policy/workflow checks against the real local OpenLore service:

```sh
node scripts/verify-review.mjs
```

This creates a labeled synthetic verification ticket and scoped fixture documents. It verifies permissions, self-review, stale source/destination checks, changes/rejection and cosign revision binding. It does not substitute scripted output for model runs. The Slack demonstration uses actual Qwen model calls.
