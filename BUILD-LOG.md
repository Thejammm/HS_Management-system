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

---

## Step 2: Client fact sheet in the Company set-up pages

**What was built**

- Company setup gains an "Accreditation fact sheet" card (no new tab): short name
  (used in trackers, e.g. "RSSC to do"), registered office, head office (or "same
  as the registered office"), directors, the person responsible for health and
  safety and their position, headcount band (1 to 4, or 5 or more), number on
  PAYE, uses subcontractors, works on higher-risk buildings, duty holder roles,
  SSIP scheme and certificate start and expiry.
- Insurance renewal dates: the Employers' liability card is now "Insurance", with
  public liability and professional indemnity renewal dates beside the existing
  employers' liability fields.
- Held once:
  - the registered office is the existing address field, moved from the Contact
    card (no data moved);
  - the duty holder roles are the Accreditation tab's roles (`S.accred.roles`);
  - the number of employees stays in Scale of the business.
- `accred-core.js` holds the fact registry (`FACTS`), what each fact feeds
  (`factImpact`) and the conflict rules (`factConflicts`). The section view reads
  its answers from the fact sheet: "From the client fact sheet: …", and for a
  client fact "RSSC to confirm. Suggested answer: …".
- Warning panel (on the fact sheet and above the Constructionline sections): a
  fact that disagrees with an answer or a date:
  - headcount band against employees, PAYE and the HS-16 answer;
  - subcontractors against HS-20;
  - higher-risk buildings against BS-08;
  - the H&S lead against the HS-01 answer;
  - the question set against the roles;
  - the SSIP expiry against the Third Party section dates;
  - insurance renewals against the Insurances section date.
- Changed facts: when a fact that was already filled in changes, Compass lists it
  with the portal sections and REFs it feeds and the documents in the register
  that carry it, until AHS Ltd clicks "Updated everywhere"
  (`S.company.factLog`).

**How to test**

- `npm test` runs `test/fact-sheet.test.mjs` (fields, impact, every conflict
  rule, fact values in the section view).
- `node test/ui/fact-sheet.test.mjs`: change the headcount band and the address
  and see the sections, REFs and documents listed; roles shared with the
  Accreditation tab; the warning above the sections.
- By hand: Company setup, Accreditation fact sheet. Change the headcount band or
  the registered office: the "Changed facts" panel lists what to update.

**Assumptions**

- Documents affected by a fact are found by name in the document register (e.g. a
  headcount change lists the H&S policy, the organisation statement and the
  training matrix). A document named differently will not be listed.
- A fact filled in for the first time is not a change: only an edit of a value
  already there is listed, so setting up a new client does not flood the panel.
- The company address block the portal repeats inside the H&S sections (REF 387
  to 393) is treated as the registered and head office address.
- Pastel red and amber are kept for expiry status only, so the warning panels are
  neutral grey with a charcoal or cyan edge.

---

## Step 3: Evidence register with REF tagging

**What was built**

- Documents tab: an "Evidence register" card under the document register. Every
  record shows:
  - its date and source;
  - the CAS questions it answers, with the SSIP question number;
  - the Constructionline REFs, which follow through the mapping;
  - a flag: older than 11 months (replace it), no date, or not tagged.
- Filters for each flag.
- Lists of:
  - questions with no evidence;
  - questions whose newest evidence is older than 11 months;
  - for Constructionline clients, evidence out of step with the section expiry
    (it will be over 12 months old when its section renews).
- The document form gains "Source" (which app or which person) and "Answers these
  questions" (the 77 CAS questions by area), saved on the document as
  `documents[].source` and `documents[].qids`. The document already had its date
  (`dated`).
- Records the other tabs make are tagged by what they are, from the moment they
  exist (`AccredCore.EV_KINDS`):
  - Site Inspection app records carry the questions the inspector tagged;
  - process assurance visits count as HS-15 (SSIP Q6 monitoring) and HS-11
    (Q3.3 adviser advice), and design reviews as DS-02;
  - Compass workplace inspections count as HS-15;
  - toolbox talks count as HS-17 (SSIP Q7.4 consultation);
  - CPD counts as HS-12 and QA-05;
  - saved monthly figures count as HS-15 and HS-18.
- AHS Ltd can change any record's questions ("Tag"). Those changes are kept in
  `S.evidenceTags` (added to the client export and import keys), so a record that
  is re-synced from another app keeps them.
- The Accreditation journey uses the register. With nothing picked for a
  question, the newest record tagged to it stands in, as a site inspection already
  did ("From the evidence register"). A pick always wins.

**How to test**

- `npm test` runs `test/evidence-register.test.mjs`, which covers:
  - a site inspection dated October 2025 needs replacing against SSIP Q6;
  - the 11-month boundary;
  - the automatic tags;
  - overrides;
  - out of step with the section expiry;
  - the journey fallback.
- `node test/ui/evidence-register.test.mjs`: the card, tagging a document,
  tagging a toolbox talk, and the filters.
- By hand: Documents tab, Evidence register. Add a process assurance visit dated
  more than 11 months ago: it shows "Older than 11 months: replace it" against
  HS-15 (SSIP Q6).

**Assumptions**

- "Tagged automatically when they are created" is done by tagging every record by
  what it is (a toolbox talk is consultation evidence), rather than writing tags
  into each record at creation. Records made before this branch are tagged the
  same way, and synced records cannot lose their tags.
- "Site inspections" covers the Site Inspection app records, the process
  assurance visits and the Compass workplace inspections. "Monthly" is a month
  whose assurance figures have been saved.
- Quick minutes in Triage are kept off the register, because they are held off
  the client's record until reviewed.
- 11 months gives a month's warning before Constructionline's 12-month limit.
