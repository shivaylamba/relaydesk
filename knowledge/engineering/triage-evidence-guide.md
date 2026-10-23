# Internal evidence guide for pre-escalation triage
Synthetic Cedar workspace. This document is a procedure, not evidence of a particular customer defect.

Use concrete existing investigation notes to assess whether code investigation may be warranted. The checkout retry note describes a hypothesis about payment attempt identifiers, the login note describes a synthetic stale redirect-cookie reproduction, and the webhook note describes a synthetic retry-queue observation. These findings do not establish the cause of a new report or prove any proposed remediation has shipped.

Before recommending a coding task, identify the affected flow, expected versus actual behavior, impact, approximate time and non-sensitive reproduction details. Distinguish “cannot reproduce yet” from “no bug.” An absent guarantee or request for a feature is not automatically a bug. Do not pass internal markers, credentials or customer secrets into an escalation packet. Cite actual documents read and keep quoted evidence separate from your interpretation.
