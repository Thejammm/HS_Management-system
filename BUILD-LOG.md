# Compass accreditation engine: build log

Branch `accreditation-engine` of Thejammm/HS_Management-system. Built from
`Compass - Accreditation Engine Spec.md` and `Compass - Claude Code Build
Instructions.md` (13 October 2026). Not merged and not deployed: AHS Ltd approves
releases.

Backup taken before any change: `C:\Users\arche\dev\compass-backups\2026-10-13\`
(the released `index.html`, the `reports\` folder, and a git bundle of `main` at
c8118d5). `app\` in the same folder is a runnable copy of the original app, used to
prove CHAS and SMAS clients see exactly what they saw before.

---

## Step 1: Constructionline mapping on the CAS core, and the section view

**What was built**

- `data/constructionline/` holds the two question banks as read from the portal
  (Designer 418 questions in 35 sections, Contractor 377 in 36).
- `scripts/build-constructionline.mjs` reads the banks and the master list and:
  - adds `refs.constructionline` to each of the 77 CAS questions: every portal REF
    the question answers, in portal order. The existing per-set REFs, wording and
    roles are untouched, so the existing journey is unchanged;
  - makes every other REF a Constructionline extra in `MASTER.extras`
    (`scheme: "constructionline"`, its section names, its verbatim text, its answer
    type, and a fact sheet field where one applies);
  - writes `public/reports/cl-bank.js` (the banks as reference data, loaded by
    `index.html` before `accred-core.js`);
  - writes `public/reports/constructionline-mapping.csv`, the table a person reads
    to check the mapping: one row per question per set, with the REF, the verbatim
    question, what it maps to and the CAS wording.
  - Result: 464 distinct REFs. 279 map to the 77 CAS questions; 185 are extras
    (12 of them Building Safety Act).
- `accred-core.js` gains the section view (`clBlocks`, `clView`, `clExpiry` and
  helpers). One line per portal question, in portal order, Building Safety Act
  sections last. A follow-up that only makes sense with the question before it
  (the upload, the details box, the dates) rides on that line.
- Accreditation tab: a "Constructionline sections" stage under step 01, shown only
  when the client holds Constructionline. Columns: No, Constructionline question,
  Expected evidence, Action, Status, H&S ref, Valid until, SSIP ref, SSIP valid
  until, Done. A valid until date per portal section, entered by AHS Ltd. Pastel
  red if expired or not yet valid, amber within 90 days, green otherwise. Green
  sections fold away and default to "Already in Constructionline". Counts as the
  tracker counts them: client to do, AHS Ltd to do, covered or already, ticked
  done.
- Stored per client in `S.accred.cl` (`set`, `valid`, `rows`), created only on the
  first entry. Nothing existing is changed or migrated.

**How to test**

- `npm test` runs `test/constructionline.test.mjs`: every REF accounted for once;
  every REF in the RSSC and MVL trackers lands in the same column (H&S or SSIP);
  the trackers' valid until dates give the same colours; BSA last; CHAS untouched.
  The tracker REFs and dates are in `test/fixtures/cl-trackers.json`, extracted
  from the October 2026 trackers.
- `node test/ui/cl-sections.test.mjs`: the screen, for a designer and a contractor
  test client and a CHAS client.
- `test/ui/_cmp_chas.mjs` (needs `OLD_APP` and `NEW_APP`) compares the
  Accreditation tab of the original app and this branch: identical for a CHAS
  client, an SSIP-only client and a blank client.
- By hand: open a client, Accreditation, tick Constructionline and a role. The
  sections appear under step 01. Enter the dates from the portal.

**Assumptions**

- REF 9999 (designer: duty holder roles under the Building Safety Act) asks exactly
  what BS-05 asks, so it maps to BS-05. Every other unmapped REF is an extra.
- The company admin sections (contacts, offices, finance, insurances, the company
  details block repeated inside the H&S sections) are not in the 77 CAS questions,
  so they are extras. Those that hold a fact sheet value carry a `fact` key.
- The designer Building Safety Act questions on the golden thread, design
  management, products, information to other duty holders and reporting breaches
  (9964 to 9995) are not among the 77, so they are extras with `bsa: true`.
- Where the designer SSIP set and the Health and Safety section ask the same CAS
  questions they share a line, the SSIP REF in its own column (as the RSSC
  tracker does). The contractor SSIP set stands alone (as the MVL tracker does).
  A section whose REFs all sit in another section joins it (contractor Health and
  Safety inside the Third Party section, as the MVL tracker shows).
- The tracker's question wording was a short paraphrase. Compass shows the
  portal's own words, as the instructions require; the CAS id and the SSIP
  question number sit under each question.
- The trackers group several declarations on one line in places. Compass keeps one
  line per portal question, so a few tracker lines are two or three lines here.
- The client's short name (for "RSSC to do") comes from `S.company.shortName`,
  added to the fact sheet in step 2; until then it falls back to the client name.

**Left open**

- The bank files are refreshed once a year: replace the two JSON files and run
  `node scripts/build-constructionline.mjs`.
