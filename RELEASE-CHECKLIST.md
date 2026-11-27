# V2.1 release gates — November 27, 2026

Production main remains unchanged. Do not merge, change Pages source, or deploy without explicit owner approval and a private backup. No OMEN involvement.

## Verified
- [x] a45cc7e: owner laptop, JS syntax, 46/46 Node regression checks, 13/13 Chromium smoke checks, 6/6 actual service-worker upgrade/recovery checks. Synthetic history, active workouts, offline edits, backup recovery and repeated-import deduplication preserved.
- [x] 7f21134: live Sheets/Drive/Calendar and printed OCR checks repeated successfully on laptop using isolated test resources.
- [x] 7f21134: real Gmail read-only authorization and verified mailbox; one recent search page, 12 examined, one candidate, no saved subscription or email changes.
- [x] a45cc7e: synthetic Gmail and connector review UI, explicit matching, preserved user choices, rejection and reload deduplication.
- [x] Earlier e418592 CI verified OCR assets, actual OCR and static package. Latest release candidate must independently pass packaging CI.
- [x] Actual ChatGPT connector synthetic proposal append/readback in separate test spreadsheet; no production write.

## Remaining
- [ ] Verify latest GitHub Actions build and static artifact including Gmail module.
- [ ] Isolated laptop/Android acceptance: same test Sheet, sync synthetic records both directions; installed app sharing text/URL; calendar notifications with app closed, completion removes reminder. Never enter production Sheet ID in localhost test.
- [ ] Confirm release scope: session-only Google grants, printed OCR and Samsung keyboard transcription fallback. Gmail parser is conservative and not AI; pending candidates and scan checkpoint remain device-local; approved records sync. History is bounded per scan and may be incomplete.
- [ ] Private production JSON backup; confirm rollback baseline and explicit release approval.
- [ ] Owner-approved Pages source change to GitHub Actions if needed; merge approved development branch; manually dispatch verified production workflow with confirmation. Verify production upgrade and Google sync.
- [ ] Once app Gmail discovery verified in production, disable redundant scheduled ChatGPT subscription discovery task(s). Do not modify unrelated reminders.
- [ ] Delete synthetic test calendars manually and optionally remove test-only Sheets/Drive files. Remove temporary OAuth origin only when testing is over.

No production deployment yet. No continuous refresh tokens, advanced S Pen gestures, automated photo sync, advanced encryption, or automatic Samsung Health reconciliation. Phone reminder delivery is not implied by passing Calendar API tests.
