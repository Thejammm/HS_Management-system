# UI suites

These drive the real app (`public/index.html`) in a real browser, the way the
consultant drives it: seed the client state, click, read the screen back.

    npm run test:ui

They live in the repo on purpose. An earlier set lived only in a scratch
folder and was lost when the temp directory was cleared, taking the whole
regression net with it.

- `harness.mjs` - opens the app, seeds `S`, shared fixtures and the reporter.
  Chrome is found by `lib/chromium.js`, the same resolver the report checks
  use, so this runs on any machine.
- `register.test.mjs` - the risk register and the five-tab risk modal: bands,
  macro groups, the H&S/Operational chips, search, the control table, the
  score gate, what reaches the execution plan, and delete/restore.
- `cockpit.test.mjs` - the board widgets: the risk ladder (counts, ranges,
  what each level demands, click-through), the risk picture, the journey and
  this month's five, plus the empty-client case.

`npm test` stays Node-only (reports, snapshots, consistency checks) so it runs
without a browser. Run both before shipping.
