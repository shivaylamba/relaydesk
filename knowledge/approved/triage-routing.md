# Pre-escalation routing policy
Status: approved procedure for the fictional Cedar demonstration. This is not Lix production knowledge.

Triage determines what to do next; it does not establish root cause or authorize a fix.

- Use support guidance when an approved article directly addresses the reported symptoms. Verify that the article applies to the current product/version.
- Ask for more information when expected/actual behavior, affected version, impact or reproduction steps are missing. Request only non-sensitive references; never ask for credentials, card data or access tokens.
- Route a documented configuration, account-state or operational action for an authorized operator to review. Do not execute operational changes during triage.
- Recommend code investigation when knowledge specific to the issue supports a suspected software defect or reproduction. A private hypothesis is not a confirmed bug or a shipped fix.
- If evidence is insufficient or conflicting, say the code-change requirement is unknown. Lack of an approved article alone is not evidence that code must change.

Record the sources, distinguish observations from hypotheses, and let a nominated human select the route. Engineering hypotheses stay internal. Customer-facing resolutions require a separate approval. Preparing an escalation brief does not mean it has been sent to a coding agent.
