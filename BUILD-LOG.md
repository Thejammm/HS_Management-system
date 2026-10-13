# Compass accreditation engine: build log

Branch `accreditation-engine` of Thejammm/HS_Management-system. Built from
`Compass - Accreditation Engine Spec.md` and `Compass - Claude Code Build
Instructions.md` (13 October 2026). Not merged and not deployed: AHS Ltd approves
releases.

Backup taken before any change: `C:\Users\arche\dev\compass-backups\2026-10-13\`
(the released `index.html`, the `reports\` folder, and a git bundle of `main` at
c8118d5). `app\` in the same folder is a runnable copy of the original app, used to
prove CHAS and SMAS clients see exactly what they saw before.

## Summary (read this first)

All six steps are built, tested and committed on `accreditation-engine`, and the
branch is pushed to GitHub. **It is not merged and not deployed.** The live site
still runs `main` (c8118d5).

| Step | What it adds | Where |
|---|---|---|
| 1 | Every Constructionline REF mapped to a CAS question or a Constructionline extra; the section view (portal mirror), with valid until dates and pastel red, amber and green | Accreditation tab, under step 01, when Constructionline is ticked |
| 2 | Accreditation fact sheet: offices, directors, H&S lead, headcount band, PAYE, subcontractors, duty holder roles, higher-risk buildings, SSIP and insurance dates. Warnings where a fact disagrees with an answer or date; changed facts list what to update | Company setup |
| 3 | Evidence register: every record dated, tagged to CAS questions (REFs follow), with its source; 11-month flags; questions with no evidence | Documents tab |
| 4 | Client approve and sign, or send a query, logged per click with date, user and version; queries go to Triage | Sign-off tab, Triage |
| 5 | Essentials, Standard and Complete packages; the year's service calendar; prices left blank for AHS Ltd; a completed service files tagged evidence | Company setup (package), Monthly tab (calendar) |
| 6 | Submission pack ZIP: both trackers, folders 01 to 13 and 99 with records filed, and the protected client issue PDF; PDBR and DRM imports | Accreditation tab (pack), Documents tab (imports) |

**Tests:** `npm test` (127 Node tests and the three report checks) and
`npm run test:ui` (37 browser suites, 8 of them new) all pass.

**CHAS and SMAS are unchanged.** `test/ui/_cmp_chas.mjs` compares the
Accreditation tab of the original app
(`C:\Users\arche\dev\compass-backups\2026-10-13\app`) with this branch, for a
CHAS client, an SSIP-only client and a blank client. All three are identical,
character for character. Re-run it after any change:

    OLD_APP=C:/Users/arche/dev/compass-backups/2026-10-13/app/index.html NEW_APP=C:/Users/arche/dev/hs-management-system/public/index.html node test/ui/_cmp_chas.mjs

**Client data:** nothing existing is moved, renamed or migrated. Everything is
new and optional, and is created only when something is first recorded:

- `S.accred.cl`, `.package`, `.serviceLog`, `.issueRef`, `.issues`;
- the `S.company` fact fields and `.factLog`;
- `documents[].qids`, `.source`, `.approval`, `.approvalLog`;
- `S.evidenceTags`.

`evidenceTags` is added to the client export and import keys. The rest sit
inside keys already exported (`accred`, `company`, `documents`). A client who
never uses the engine has nothing added.

**Decisions for AHS Ltd** (none of them blocked the build):

1. Prices are blank for every client until entered: Monthly tab, "Services and
   prices" (price per unit, or a day rate).
2. Prices are held per client, as the client copy price list is. Say if a
   practice-wide price list is wanted instead.
3. The month each service falls in (`SERVICES[].months` in `accred-core.js`)
   is a first spread across the year. Adjust to taste.
4. The PDF footer names AHS Compliance Consulting Ltd, as the October 2026
   client issue PDF does. Everything else says AHS Ltd.

## Release steps (once approved)

1. Merge into `main` and push. This auto-deploys through Coolify to Hetzner.

       cd C:\Users\arche\dev\hs-management-system
       git checkout main
       git pull
       git merge --no-ff accreditation-engine
       git push origin main

2. Check the live site:
   - `git status -sb` shows no `[ahead N]`;
   - compass.archerhs.co.uk returns 200;
   - `curl -s https://compass.archerhs.co.uk/ | md5sum` matches the md5 of
     `public/index.html` (allow a minute or two for Coolify);
   - `/reports/cl-bank.js` and `/reports/cl-pack.js` load.

   Then open a test client, tick Constructionline and a role, and check the
   sections appear.
3. Save the released app back to
   `C:\Users\arche\OneDrive - Archer Health and Safey\AHS\App builder\Completed_Working\H&S_Compass\`:
   - `public/index.html` → `H&S_Compass\index.html`;
   - `public/reports\` → `H&S_Compass\reports\`. The app needs the new
     `cl-bank.js` and `cl-pack.js` there.

   Confirm with an md5 that the master matches the deployed file.
4. Leave nothing else in that folder. `fonts\` and `icons\` belong to the app.
   It also holds files that are not part of the release. This build deleted
   nothing, so moving them out is yours to do:
   - `Discovery_Question_Triage*.xlsx`;
   - `_repo_snapshot.tgz`;
   - `password.txt`;
   - `compass testing\`;
   - `super seeded\`.

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
  every REF in the EDL and ECL trackers lands in the same column (H&S or SSIP);
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
  questions they share a line, the SSIP REF in its own column (as the EDL
  tracker does). The contractor SSIP set stands alone (as the ECL tracker does).
  A section whose REFs all sit in another section joins it (contractor Health and
  Safety inside the Third Party section, as the ECL tracker shows).
- The tracker's question wording was a short paraphrase. Compass shows the
  portal's own words, as the instructions require; the CAS id and the SSIP
  question number sit under each question.
- The trackers group several declarations on one line in places. Compass keeps one
  line per portal question, so a few tracker lines are two or three lines here.
- The client's short name (for "EDL to do") comes from `S.company.shortName`,
  added to the fact sheet in step 2; until then it falls back to the client name.

**Left open**

- The bank files are refreshed once a year: replace the two JSON files and run
  `node scripts/build-constructionline.mjs`.

---

## Step 2: Client fact sheet in the Company set-up pages

**What was built**

- Company setup gains an "Accreditation fact sheet" card (no new tab): short name
  (used in trackers, e.g. "EDL to do"), registered office, head office (or "same
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
  client fact "EDL to confirm. Suggested answer: …".
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

---

## Step 4: Client approve or query, with a log

**What was built**

- Sign-off tab: a "Documents for <client> to approve" card above the employee
  sign-off register. AHS Ltd sends any document from the Document register for
  approval. The client either:
  - clicks **Approve and sign** (a confirm names the document, the version and
    the person), or
  - writes and sends a **query**.
- Every click is logged on the document itself (`documents[].approvalLog`): date
  and time, user name and id, role (shown as the company for a client login,
  "AHS Ltd" for the consultant), the action, the version, the title and date of
  the document, and the query or answer text. Sending, withdrawing and answering
  are logged too.
- An approval counts for the version approved only. A new version shows "New
  version to approve", and the old approval stays on the log.
- A query appears in Triage under a new "Client queries" card (consultant only).
  AHS Ltd logs the answer there, and the query leaves Triage. The answer is on
  the document's log with the query.
- The log shows on the document in three places:
  - the approval card ("Log");
  - the document form ("Client approval log");
  - a status line under the document's name in the Document register.
- Employees never see the approval card. It is for the client company.
- Rules in `accred-core.js`: `approvalOf`, `openQueries`, `docVersionKey`.

**How to test**

- `npm test` runs `test/client-approval.test.mjs`: statuses, version rule, open
  and answered queries.
- `node test/ui/client-approval.test.mjs`: AHS Ltd sends two documents; a client
  login approves one and queries the other; the query is in Triage; AHS Ltd
  answers; the log is on the document; a new version needs approving again; no
  card in the employee view.
- By hand: Sign-off tab, "Send a document from the register for approval". Sign
  in as the client (or use View: Client) to approve or query. Open Triage to see
  and answer the query.

**Assumptions**

- "The user" is the signed-in person; the log stores their name and id. The card
  names the company ("Approved and signed by Robert Smith for EDL"), so
  client-facing wording leads with the company.
- The document version is the version field, else the document date. A document
  with neither is "unversioned".
- Approve and sign is a logged, confirmed click by the signed-in user, not a drawn
  signature. A drawn signature can be added later without changing the log.

---

## Step 5: Packages and service calendar

**What was built**

- The 23 services and the three packages (Essentials, Standard, Complete) from the
  costing workbook, in `accred-core.js` (`SERVICES`, `PACKAGES`). The services
  keep the workbook's code, name, plain-English description, who it is for, how
  often, hours, unit, times a year and "Constructionline questions it answers".
  Each also names the CAS questions its output answers (for example, C1 site
  inspection is HS-15 and HS-11; C2 toolbox talk is HS-17).
- Company setup: an "AHS Ltd service package" card (consultant), with the package
  and the month the calendar starts. Stored in `S.accred.package`.
- Monthly tab: a "Service calendar" card. It shows the year from the start month,
  built from the package for the client's role, grouped by month, with counts of
  overdue, due this month, done and planned services. Contractor-only and
  designer-only services follow the role, and AHS Ltd can switch any service off
  for one client. The Monthly tab now also shows for a client on a package; for
  everyone else it is hidden or shown exactly as before.
- Prices: editable price per unit and day rate fields, with no prices filled in.
  As in the workbook, a typed price wins; otherwise the hours are priced at the
  day rate (7.5 hours a day). The yearly value and monthly equivalent of the
  package follow as prices are typed. Prices are stored per client in
  `S.accred.package.prices` and `dayRate`.
- "Mark done" on a service records the date, who and what was produced (and a
  link) in `S.accred.serviceLog`. The record is filed straight into the evidence
  register against the service's CAS questions (kind "AHS Ltd service"), so it
  also counts on the Accreditation tab.
- S3 (submission and assessor feedback) falls a month before each Constructionline
  section's valid until date when those are entered, otherwise in the first
  month.

**How to test**

- `npm test` runs `test/service-calendar.test.mjs`, which covers:
  - the packages match the workbook ticks;
  - no default prices; price and day-rate rules;
  - Standard schedules twelve C1 and twelve C2 for a contractor;
  - role filter and switch-off;
  - statuses;
  - a completed service is a tagged evidence record;
  - S3 by section expiry.
- `node test/ui/service-calendar.test.mjs`: choose Standard in Company setup, the
  Monthly tab appears with twelve inspections and twelve toolbox talks, enter a
  price, mark an inspection done and find it in the evidence register tagged
  SSIP Q6.

**Assumptions**

- The month each service falls in (`months`) is set out so the year is spread
  evenly. Monthly services run every month. Quarterly ones come at the end of
  each quarter (meetings and figures), or early in it (training, bulletins,
  CPD). "Per project" services come every three or six months, to match the
  workbook's times a year. Yearly ones are spread across the year, with the
  annual review last. Change a service's `months` to move it.
- Prices are held per client, as the client copy tracker's price list is per
  client. A practice-wide price list could be added later.
- B8 Compass access is a monthly charge, not a task, so it is priced but not
  scheduled.
- The service calendar is the consultant's to work: the client sees the calendar
  and the package but cannot enter prices or mark services done.

---

## Step 6: Submission pack export, and links to other apps

**What was built**

- Accreditation tab, Constructionline sections: **Download the submission
  pack**. It builds one ZIP, `<short> CL Submission <year>.zip`, laid out like
  the EDL and ECL submissions:
  - `00 <short> CL Submission Tracker.xlsx`, the AHS tracker;
  - `00 <short> CL Submission Tracker - Client Copy.xlsx`, with "AHS Ltd
    will…" wording and the price list;
  - `01 Company Information` to `12 Social Value and Wellbeing`,
    `13 Site Evidence` for a contractor, and
    `99 Do Not Upload - Old Versions`;
  - `Client Issue/`, the client copy as a protected PDF and as Excel;
  - `00 Pack contents.txt`, with the reference and any record not filed because
    it is not tagged.
- The trackers (`public/reports/cl-pack.js`, built with ExcelJS) follow the
  EDL and ECL layout:
  - Arial throughout;
  - the title, and the four counts as live COUNTIFS formulas;
  - the ten columns at the same widths, with cyan H&S and purple SSIP headers;
  - cyan merged section rows and the status fills;
  - expiry colours by Excel conditional formatting, worked out on the day the
    file is opened;
  - the header frozen at row 8, landscape, fit to width.
- What goes in each tracker:
  - sections in date for more than 90 days collapse into "Already verified in
    Constructionline (no action now)", one line each, as in the trackers;
  - the Building Safety Act sections come last;
  - the Annual Service Plan comes from the package, and the question bank is a
    sheet of its own;
  - the client copy adds the Price List: day rate, days per service, cost
    formulas, subtotal, VAT and total.
- Folders: records are filed by the question they answer, following the
  example folders:
  - site inspections and RAMS go to 13 for a contractor, 03 for a designer;
  - drug and alcohol and mental health policies go to 12;
  - records over 12 months old go to 99.

  Compass holds links, not files. Each folder holds a Windows shortcut (`.url`)
  to where each file lives, and `00 In this folder.txt` listing every record
  with its date, source, questions, REFs and location.
- Client issue PDF: the client copy drawn as image pages, so the text cannot be
  lifted. On every page:
  - a diagonal watermark naming AHS Compliance Consulting Ltd, the client and
    the reference;
  - the footer "© <year> AHS Compliance Consulting Ltd. All rights reserved.
    Prepared for <client> only. No part may be copied, altered, shared or used
    with AI tools without written permission. Ref: <ref>".

  The PDF opens without a password and allows printing only: no copying,
  changing or annotating. Its text layer matches the October 2026 EDL client
  issue PDF word for word.
- Reference: `AHS-<SHORT>-<YYMM>-<4 hex>`. It is made the first time a pack is
  built for a client and then kept (`S.accred.issueRef`). Each download is
  logged (`S.accred.issues`).
- Imports (Documents tab, Evidence register). Importing the same file again
  updates the document rather than adding a second one.
  - **Client duties letters (PDBR)** reads the Word letters PDBR AllProject Flow
    makes (`<project ref>_<template>.docx`). Each is dated from the letter's own
    text (else the file date) and filed against Q10.1 (DS-01) and BS-02.
  - **Design risk assessments (DRM)** reads the workbooks DRM exports
    (`DRA_<project no>_<location>_Rev<n>_<date>.xlsx`). Each is filed with its
    project, revision and date against Q10.2 and Q10.3 (DS-02, DS-03).

**How to test**

- `npm test` runs `test/submission-pack.test.mjs`. It covers the folders
  against both examples, the filing rules, the "will" wording, the reference
  and the shortcuts. It also checks the tracker layout against the EDL layout,
  and the Price List.
- `node test/ui/submission-pack.test.mjs` builds a designer pack and a
  contractor pack in the app and opens them. It checks:
  - the folders match the EDL and ECL submissions;
  - both workbooks open in ExcelJS;
  - the PDF is encrypted and print only, with an image on every page;
  - the reference is kept between packs;
  - a PDBR letter and a DRM assessment import, dated and tagged.

  ExcelJS is injected from `node_modules`, so the test needs no network.
- By hand: Accreditation tab, Constructionline sections, "Download the
  submission pack". Open both trackers in Excel and the PDF in a reader: the
  PDF prints, but will not let you copy or edit.

**Assumptions**

- Compass stores links to documents, not the documents. The pack files a
  shortcut to each record in its folder, with an index, and AHS Ltd drops the
  files in before uploading.
- The copyright footer names the legal entity, AHS Compliance Consulting Ltd, as
  the October 2026 client issue PDF does.
- ExcelJS is loaded from cdnjs (the same CDN as jsPDF) when a pack is first
  built. Building a pack needs an internet connection, as the existing PDF
  reports do.

**Left open: what the other apps would need for a richer import**

- **PDBR AllProject Flow** has no data export. Letters exist only as Word files,
  and templates only in that browser's local storage. A JSON or CSV export of
  issued letters would let Compass import them without reading file names. It
  would need, per letter: the project ref and name, client, template, issue
  date, and who signed it and when.
- **DRM** exports Excel, but only the file name carries the project, revision
  and date. A JSON export would let Compass also file the residual risk
  communication to the Principal Designer (Q10.3) as its own dated record. It
  would need: project, revision, issue date, lead designer, the count of
  residual risks, and the date they were sent to the Principal Designer.
