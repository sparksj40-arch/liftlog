# Subscription discovery and review — proposed connector workflow (not activated)

This is a handoff for the connected ChatGPT Gmail and Sheets workflow. It does not grant Gmail access to the browser app. Do not scan or write production data until V2.1 schema and user consent are verified. Keep user-controlled subscription decisions explicit. No credential or refresh token in the app, repository, or sheet.

## Initial and incremental discovery
- Search the connected Gmail account for subscription confirmations, trial starts, recurring receipts, upcoming renewals, pricing changes, cancellations and billing terms. Use multiple focused queries, then expand threads and relevant messages. Do not treat a one-time purchase as recurring based on a keyword alone. Historical discovery may require batching/pagination. Incremental discovery can use a date overlap, with message-ID deduplication; advance the checkpoint only after successful complete processing. Do not claim a complete scan if tool results truncate or authentication fails.
- Extract only the relevant service, amount/currency, period, start date, renewal, trial/promo expiration, cancellation cutoff/instructions, source message reference. Unknown amounts null; unknown dates empty. Preserve conflicts in explanation. Never invent dates, cancellation URLs or intentions; cancellation confirmation is a candidate, not authority to remove reminders.
- Read `V21 Records` and `V21 Inbox` from the user's verified private database only after deployment approval. Replay records in row order by key and base revision. Deduplicate candidates by source references and compare company/service identifiers; distinguish separate subscriptions with the same company. If an existing record is identified, use its record ID and current event revision. If ambiguous, ask the user before treating it as a new or existing subscription. Do not directly edit the record journal.

## Proposal contract
`V21 Inbox` columns A:G: id, createdAt, kind, baseRevision, payloadJson, explanation, approval. Write a unique ID, ISO timestamp, `subscription`, current base revision (empty for a new candidate), JSON, concise evidence and uncertainty, `PENDING`. Use RAW cell values. Example synthetic payload:

```json
{"company":"Example service","description":"Example trial","amount":null,"currency":"USD","frequency":"unknown","status":"verification","intent":"later","start":"","renewal":"","trialEnd":"","promoEnd":"","deadline":"","cancelDate":"","instructions":"","sources":["synthetic-message-id"],"reminderDays":[14,7,3,2,1,0]}
```

Do not default unknown currency to USD when evidence contradicts or does not establish it; request verification before submitting a candidate requiring a currency. Existing subscription candidate also includes `id`. App prompts the user to verify the fields and choose retention intent; a cancellation confirmation still requires explicit user action. User-selected dates must be checked against cancellation cutoff. Avoid copying full email contents into records. Do not change Gmail, unsubscribe, or cancel subscriptions on the user's behalf without specific authorization.

## Scheduling and safeguards
Once the app has passed live-copy tests and the user authorizes the workflow, test a small discovery batch against the actual connector permissions and proposed rows. Then consider a scheduled incremental scan (automation must be created separately and explicitly verified). The automation needs actual Gmail and Sheets read/write capability at runtime; if unavailable, deliver candidates for user review rather than claiming automatic import. No scheduled scan has been created. The app does not assume Samsung Health or Gmail connector access. The manual JSON candidate import remains a fallback.
