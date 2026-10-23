# Triage-first walkthrough

Use synthetic data. Provider response time varies; these steps are not a latency promise. The current workflow adds internal routing before engineering work. The previous [executed Slack demonstration](SLACK-E2E.md) describes the historical pre-triage flow.

1. Create a ticket or open a synthetic existing one. Read the full customer report in **Triage**. Add non-sensitive expected/actual behavior, impact and reproduction details when available.
2. Select **Assess this issue**. The agent reads approved and engineering knowledge with read-only tools. Inspect the actual operations; failed searches are visible. No coding work or customer message starts here.
3. Read the recommendation, exact knowledge excerpts, source type, missing information and unconfirmed hypothesis. An engineering observation does not prove the cause of this report.
4. Record a human route and reason: collect more information, handle in support, route to operations, or prepare engineering investigation. If more information is needed, add context and run a new assessment. Do not force a code route merely to complete a demo.
5. For a reviewed engineering route, confirm the destination may receive internal evidence, then **Prepare Devin brief**. Inspect it, copy it or download Markdown. The app does not send it to Devin. Alternatively, open Engineering and explicitly start RelayDesk's existing investigation agent.
6. If an investigation proposes a customer response, use the separate Review queue. Edit and approve the exact text. A fresh support session can retrieve that approved resolution without receiving private triage or engineering transcripts.

## Slack entry point

Mention the installed bot in its dedicated support channel. A support response offers **Request internal triage**. The action queues a read-only assessment and posts its summary only to the configured private engineering destination. Review the full evidence in the local web UI and record the route there. This new Slack path has not yet been exercised against a live workspace; the earlier Slack E2E report is historical.

New ticket context or changed knowledge invalidates an older assessment for routing/handoff. A newer failed assessment attempt also prevents an old report from being used as if it were current. No scheduled endurance campaign is started by this walkthrough.
