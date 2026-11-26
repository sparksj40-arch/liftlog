# V2.1 release gates — November 26, 2026

Production main must not be changed without explicit approval. Test only with isolated synthetic resources, never the live Sheet. No personal backups, credentials, photos or calendar IDs in the public repository. OMEN remains independent.

## Completed verification
- [x] 666e65e: JS syntax; 38 regression, 12 browser smoke, 6 upgrade/recovery checks on laptop.
- [x] 37e14b0: isolated live Sheets authorization, correct headers, exact append/readback and clean database merge.
- [x] 37e14b0: real private Drive backup and restore; owner/permission checks and exact bytes.
- [x] 37e14b0: real Calendar authorization, creation, idempotence and completion cancellation.
- [x] 37e14b0: pinned OCR assets installed; actual recognition of synthetic printed English image.
- [x] Test OAuth origin and Google Calendar API configured. Do not remove the existing production OAuth origin.

## Remaining before release decision
- [ ] Include generated OCR assets and licenses in static production package. Verify manifest hashes and GitHub size limits. Do not include a local virtualenv, logs, backups, private IDs or tokens. No hosting change needed when assets are checked in to the existing Pages source.
- [ ] Verify actual ChatGPT connector proposal path with a synthetic record in the separate test sheet, then verify app review. Do not use live user data.
- [ ] One consolidated phone acceptance session: real phone and laptop sync using separate test sheet, reminder delivery while app is closed (early + scheduled, then cancellation), Android text/URL sharing, optional photo restore. Do not infer phone delivery from Calendar API success.
- [ ] Decide whether to release PWA with session-only Google authorization and Samsung keyboard handwriting fallback or defer for separate secure backend/native integration. Do not assume approval for OMEN or any additional server.
- [ ] Obtain explicit authorization before scanning Gmail; validate discovery and proposal deduplication, then scheduled automation permissions. Automatic scan not currently active.
- [ ] Back up real app database privately, confirm current main and development branch heads, retain rollback commit, review outstanding scope and obtain explicit deployment approval.
- [ ] After authorized deployment: verify GitHub Pages and in-place upgrade, confirm original history and sync, enable V21 workflow only after schema verified. Update project operating instructions. Remove temporary test OAuth origin if no longer needed; preserve production origin.

## Limits
Real API tests passed with synthetic records; not equivalent to a live two-device UI session or actual phone notifications. Google session tokens expire; Calendar mirror covers next 60 days and needs successful sync. OCR is printed English and requires packaged assets, not a handwriting engine. Native S Pen gestures, persistent Google refresh authorization, continuous automatic photo sync, Gmail automation and Samsung Health reconciliation are not complete. No production writes, no automatic Gmail access from the PWA, no advanced encryption or Picture Vault.

## Cleanup
Stop temporary localhost server with Ctrl+C. Delete the test-only calendar to avoid synthetic notifications. Retain or manually delete test-only Sheet and photo backup after verification. Never delete production resources.
