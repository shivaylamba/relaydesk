# Five-minute walkthrough

Use synthetic data. The local installation is connected to Studio1HQ; a fresh checkout leaves Slack delivery disabled until configured. [Executed Slack evidence](SLACK-E2E.md).

1. **0:00 — Ticket:** open checkout issue RD-1001 (or create a new checkout ticket). Explain support/engineering/reviewer identities.
2. **0:30 — Triage:** run the support agent. Inspect actual search/read calls and sources. It should avoid inventing a fix when none is approved.
3. **1:30 — Investigation:** switch to Engineering. Run its agent, inspect the private source and saved investigation. A proposed response appears in Review queue.
4. **2:30 — Review:** inspect and edit the customer-safe wording. Keep hypotheses and unshipped changes clearly labeled. Confirm the review checkbox and approve. The proposal hash and actual destination are visible.
5. **3:30 — Fresh session:** switch back to Support and run it again. It receives no engineering transcript. Inspect the call reading `/approved/RD-1001.md` and its source citation.
6. **4:30 — Evidence:** export the support evidence. Show permitted collections in Knowledge. Open Connections and inspect the installed Slack connection.

An already approved checkout ticket demonstrates reuse immediately. Create another checkout report to demonstrate a new session finding the previous ticket’s resolution through a broad keyword search. Do not describe a generated response as a real customer message or a shipped production fix.

## Five-minute Slack version

1. **0:00:** mention RelayDesk in `#relaydesk-demo-support` with a clearly synthetic login or checkout question. Show the bot's source-citing triage in the same thread.
2. **0:45:** click **Escalate to engineering**. Show the separate private engineering channel and private sources in the local trace.
3. **1:45:** open **Review resolution** in the private review channel. Select **Request changes** and explain an unsupported claim. Submit; the new proposal is a fresh model session using the feedback.
4. **2:45:** open the latest revision. Edit customer-safe text, select **Approve edited resolution**, and submit. Show reviewer, revision and hashes in the local Review queue.
5. **3:45:** return to the original support thread. The fresh support session must read the exact approved revision before delivery. Show its canonical source and zero prior conversation messages.
6. **4:30:** click an old revision's Review button to show a clear refusal. Open the support-only evidence export and explain the distinction between synthetic operator review and real customer deployment.

For a repeatable replay without new inference, use RD-1005's recorded thread and audit. New mentions and review actions incur actual provider requests; elapsed model latency varies.
