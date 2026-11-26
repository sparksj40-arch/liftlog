# V2.1 consolidated verification and deployment plan

**Do not deploy this development checkpoint to main or use the production Sheet for testing.** The source is local; creating the GitHub development branch via connector returned 403. The production app and data have not been changed. Test in an isolated browser profile or origin and with a separate test database. Never upload personal export JSON, photos, credentials, token, or private data to the GitHub repository. The public PWA repository contains only source and synthetic test fixtures.

## Before acceptance
- Establish a writable GitHub development branch from the live main baseline (or have the owner create the branch and grant the connector appropriate repository write permission). Compare current main to verified baseline before merging; preserve main and tag/record a rollback commit. Do not force-push or overwrite a newer live commit. A code rollback does not roll back synced data; keep backups independently.
- Use a development-only origin with the correct OAuth authorized origin, or a separate browser profile and isolated test database. Ensure production service worker/IndexedDB and the test app cannot accidentally interact. Do not point a test build at the live Sheet or calendar. Use synthetic records or a privately held sanitized copy of existing V2 data. A separate GitHub Pages site or localhost can be used once actual browser access is available. Check every cached asset and module service worker, upgrade from an installed V2.0 app in isolation, and preserve manifest identity for the final in-place upgrade.
- Run `node --test tests/*.test.js`, `node --check` for each JS file, and the browser smoke test. Existing headless browser navigation failed in the execution environment, so browser testing remains a release gate. Expand the smoke test to include Planner and subscriptions, cloud sync failure/reauth, backup restoration, offline and upgrade scenarios. Validate the current actual source before claiming end-to-end success.
- Verify Google Sheets API, Drive API, and Google Calendar API setup, OAuth consent/test-user status and authorized origins. Sheets/Drive use the existing short-lived drive.file grant; optional Calendar uses independent calendar.app.created consent. No persistent refresh token is implemented. A secure backend/native OAuth design is required for reliable long-lived authorization; do not put OAuth client secrets in public JS. User authorization and actual API access must be verified. Do not silently broaden OAuth permissions.

## One consolidated device acceptance session
| Area | Test | Pass condition |
|---|---|---|
| Migration | Import sanitized V2 backup or upgrade isolated V2 install | Workout history/schedule/drafts and original IDs preserved; no duplicate workout; 24h correction rule intact |
| Exercise picker | Add scheduled/extra/custom exercise, search muscles, check sets, AI weight autofill | Only applicable unchecked sets populated; test suggestions excluded; no historical changes |
| Measurements | Record multi-reading folds/grip, skip/undo back photo, add optional item, note, complete and reopen | Correct rotation, skipped not zero, notes preserved, media and history displayed |
| Nutrition | Manual meal with exact Samsung difference, confirmed AI test proposal, edit and append | No duplicate, 7-day edit lock, notes retained; Samsung Health is separate |
| Planner | Mixed note, pasted transcript, task check, project, archive, multiple dates and selected-task reminder | Correct formatting, links and task completion behavior; no loss during navigation |
| Subscriptions | Add synthetic trial with cancellation cutoff earlier than renewal, candidate review, cancellation | Reminders precede cutoff, persistent until resolved, no duplicate, cancellation stops future reminders |
| Sync | Two test devices/profiles using same test Sheet, offline changes, conflicts, reconnect | Original headers unchanged; V21 Records/Inbox correct; no silent overwrites; cross-device metadata verified |
| Photo backup | Explicit upload to test Drive, restore missing media on second profile | No public link, private permissions checked, exact contents verified, restored images linked to synced metadata |
| Calendar | Create dedicated test calendar, enable notifications, close app, test both alarms, complete/cancel and resync | Actual phone receives both alarms while closed; future events updated/removed after confirmed sync; unrelated calendars unchanged |
| Sharing | Share text and URL from Android to installed app | Destination picker, no duplicate, no external sharing |
| Backup/offline | Export, import to isolated profile, offline launch, reconnect | All records preserved; no Google tokens in export; errors clearly visible |

## External integrations still not complete
- Gmail: use GMAIL-WORKFLOW.md after schema rollout and explicit authorization. Verify connector access and test a small candidate batch; scheduled scan not yet created. No automatic Gmail access from the PWA.
- Samsung Health: connector availability and individual meal reconciliation need verification. Manual confirmation remains required where data unavailable. Never treat unverified entries as confirmed.
- Closed-app reminders: Google Calendar mirror is a candidate, not a verified solution. Rolling 60 days requires regular successful sync; token expiration/offline changes may leave stale reminders. Verify phone notification permissions and Samsung Calendar display; consider secure backend/native notification solution if necessary.
- Photo recognition and S Pen: paste/format transcription exists, but automatic OCR and advanced gestures do not. Private manual photo backup is not continuous cross-device media sync.
- Future encryption, Picture Vault and emergency protection remain deliberately deferred. Do not use unencrypted Planner for sensitive records.

After acceptance, update project operating instructions with the verified V21 schemas and actual capabilities. Review outstanding scope with owner before deciding release vs. further development. Merge/deploy only after the release gates pass; verify production Pages build, actual app update and private database compatibility. Keep rollback and backups. Do not present a failed integration as complete.
