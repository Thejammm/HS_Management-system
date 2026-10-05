// ══════════════════════════════════════════════════════════════
//  Accreditation core - the one place an accreditation status is worked out.
//
//  Loaded three ways, so it is plain JavaScript with no import or export:
//    - by index.html as an ordinary script (the Accreditation tab);
//    - by the board report template as a module, for its side effect;
//    - by the tests, in Node.
//  Every caller reads the same answer from the same rules. Nothing here is
//  stored: statuses, counts and expiry dates are worked out from the facts
//  each time, never typed in.
//
//  MASTER is the master question list read from the Once For All portal
//  (Constructionline) for a Contractor (MVL) and a Designer (RSSC), loaded
//  word for word from accreditation-master-questions.json. Do not edit a
//  question here: change the JSON and regenerate the block.
// ══════════════════════════════════════════════════════════════
(function (root) {
  'use strict';

  // ── generated from accreditation-master-questions.json ──
  var MASTER = {"version":"0.1","captured":"2026-10-05","source":"Once For All portal, read-only capture from MVL (Contractor) and RSSC (Designer) accounts. Not yet included: CHAS, Working Conditions, Social Value, Community Engagement, Memberships, Information Management (ISO 19650), company/financial/insurance admin sections.","rules":{"fresh_default":"All documents dated within the last 12 months; training certificates and cards in date (OFA 30-day lock note)","cas":"cas=true means mandatory under the Common Assessment Standard; others can pass as Approved with Advisory"},"schemes":{"cl":"Constructionline (Once For All)","sets":{"cl_ssip_contractor":"OFA Health & Safety (SSIP), Contractor set","cl_ssip_designer":"OFA Health & Safety (SSIP), Designer set","cl_hs_designer":"Health and Safety (5.0), Designer set","cl_hs_thirdparty":"H&S Third Party / Exemption certificates","cl_ssip_dts":"SSIP Third Party Exemption","cl_mhw":"Mental Health and Wellbeing","cl_quality":"Quality (5.9)","cl_building_safety":"Building Safety (5.9)","cl_bsa_building_safety":"BSA - Building Safety (5.9)","cl_bsa_fire":"BSA - Fire Precautions","cl_bsa_hrb_decl":"BSA - Higher Risk Building Declaration","cl_bsa_hrb_infractions":"BSA - High Risk Building Infractions","cl_crg":"Corporate Responsibility and Governance (5.0)","cl_cps":"Corporate and Professional Standing (5.0)","cl_ecps":"Enhanced Corporate and Professional Standing (4.1)","cl_efi":"Enhanced Financial Information (5.0)","cl_infosec":"Information Security (4.0)","cl_env":"Environmental Management (5.0)","cl_env_sust":"Environment & Sustainability","cl_fir":"Fairness, Inclusion and Respect (5.0)","cl_shared":"Repeated across several requirements"}},"questions":[{"id":"HS-01","area":"H&S core","text":"Named director with overall responsibility for health and safety","kind":"info","cas":false,"roles":["contractor","designer"],"refs":{"cl_ssip_contractor":2827,"cl_ssip_designer":2906,"cl_hs_designer":3455,"cl_hs_thirdparty":1463}},{"id":"HS-02","area":"H&S core","text":"H&S policy with statement of intent physically signed by the most senior person","kind":"policy","cas":false,"roles":["contractor","designer"],"refs":{"cl_ssip_contractor":2828,"cl_ssip_designer":2907,"cl_hs_designer":3456},"fresh":"Signed and dated by a director within last 12 months"},{"id":"HS-03","area":"H&S core","text":"Organisation, roles and responsibilities section of the H&S policy","kind":"policy","cas":false,"roles":["contractor","designer"],"refs":{"cl_ssip_contractor":2829,"cl_ssip_designer":2908,"cl_hs_designer":3457},"fresh":"Dated within last 12 months"},{"id":"HS-04","area":"H&S core","text":"Full H&S arrangements, including how the company discharges its CDM 2015 duties for its role (Contractor or Designer)","kind":"policy","cas":false,"roles":["contractor","designer"],"refs":{"cl_ssip_contractor":2830,"cl_ssip_designer":2909,"cl_hs_designer":3458},"fresh":"Dated within last 12 months","notes":"Wording changes by role: 'as a Contractor' / 'as a designer'."},{"id":"HS-05","area":"H&S core","text":"Member of a fleet operations or management scheme?","kind":"declaration","cas":false,"roles":["contractor","designer"],"refs":{"cl_ssip_contractor":2831,"cl_ssip_designer":2910,"cl_hs_designer":3459}},{"id":"HS-06","area":"H&S core","text":"Drug and alcohol policy (prevention, testing regime, post-incident and reasonable-cause testing, return to duty, unannounced testing)","kind":"policy","cas":false,"roles":["contractor","designer"],"refs":{"cl_ssip_contractor":[2833,2834],"cl_ssip_designer":2912,"cl_hs_designer":[3461,3462]},"fresh":"Dated within last 12 months","notes":"Advisory now; assessor says likely to become mandatory."},{"id":"HS-07","area":"H&S core","text":"Occupational health arrangements including mental health and fatigue (EAP, mental health at work initiative, Thriving at Work standards)","kind":"policy","cas":false,"roles":["contractor","designer"],"refs":{"cl_ssip_contractor":[2835,2836],"cl_ssip_designer":[2914,2915],"cl_hs_designer":[3463,3464],"cl_mhw":[2320,2685,2687,2688,2689]},"fresh":"Dated within last 12 months","notes":"Advisory in SSIP set."},{"id":"HS-08","area":"H&S core","text":"Behavioural management or behavioural safety programme","kind":"policy","cas":false,"roles":["contractor","designer"],"refs":{"cl_ssip_contractor":2837,"cl_ssip_designer":[2916,2917],"cl_hs_designer":[3465,3466]},"fresh":"Dated within last 12 months","notes":"Advisory."},{"id":"HS-09","area":"H&S core","text":"Name and contact details of competent H&S adviser","kind":"info","cas":false,"roles":["contractor","designer"],"refs":{"cl_ssip_contractor":2839,"cl_ssip_designer":2918,"cl_hs_designer":3467}},{"id":"HS-10","area":"H&S core","text":"Adviser's competence (qualifications, experience) and services retained","kind":"certificate","cas":false,"roles":["contractor","designer"],"refs":{"cl_ssip_contractor":2840,"cl_ssip_designer":2919,"cl_hs_designer":3468},"notes":"AHS: CMIOSH certificate, CV, adviser notice."},{"id":"HS-11","area":"H&S core","text":"Example of advice given by the adviser and how it was implemented","kind":"record","cas":false,"roles":["contractor","designer"],"refs":{"cl_ssip_contractor":2841,"cl_ssip_designer":2920,"cl_hs_designer":3469},"fresh":"Dated within last 12 months","site":"Completed AHS site inspection report with actions closed out","notes":"MVL used AHS site reports; RSSC used office risk assessment."},{"id":"HS-12","area":"H&S core","text":"Training matrix with expiry dates (designers: active CPD) or individual training records","kind":"record","cas":false,"roles":["contractor","designer"],"refs":{"cl_ssip_contractor":2842,"cl_ssip_designer":2921,"cl_hs_designer":3470},"fresh":"Dated within last 12 months","notes":"Assessor: every course held (e.g. manual handling, asbestos awareness) must appear on the matrix."},{"id":"HS-13","area":"H&S core","text":"Contractor: employees' and site managers' qualifications and skills cards matching the matrix. Designer: designers' CVs, training certificates and professional memberships (RIBA, ICE, APS, CIAT, ARB etc.)","kind":"certificate","cas":false,"roles":["contractor","designer"],"refs":{"cl_ssip_contractor":2843,"cl_ssip_designer":2922,"cl_hs_designer":3471},"fresh":"Cards and certificates in date","notes":"Question differs by role."},{"id":"HS-14","area":"H&S core","text":"Number or percentage of people holding a CSCS card","kind":"info","cas":false,"roles":["contractor"],"refs":{"cl_ssip_contractor":2844}},{"id":"HS-15","area":"H&S core","text":"How you check, review and improve H&S performance","kind":"record","cas":false,"roles":["contractor","designer"],"refs":{"cl_ssip_contractor":2845,"cl_ssip_designer":2923,"cl_hs_designer":3472},"fresh":"Dated within last 12 months","site":"Site inspection reports and trend of actions closed","notes":"MVL used an AHS site inspection report; RSSC used a CDM designer GPP audit."},{"id":"HS-16","area":"H&S core","text":"Number of employees (sets which consultation question applies)","kind":"info","cas":false,"roles":["contractor","designer"],"refs":{"cl_ssip_contractor":[2814,2846],"cl_ssip_designer":[2814,2924],"cl_hs_designer":[3374,3473]}},{"id":"HS-17","area":"H&S core","text":"Practical evidence of two-way consultation with the workforce on H&S (5+ employees); description of consultation (1-4 employees)","kind":"record","cas":false,"roles":["contractor","designer"],"refs":{"cl_ssip_contractor":2849,"cl_ssip_designer":2927,"cl_hs_designer":3475},"fresh":"Dated within last 12 months","site":"Site inspection worker-engagement notes, toolbox talk records, pre-start meetings"},{"id":"HS-18","area":"H&S core","text":"Accident, incident and near miss statistics for the last 3 years","kind":"record","cas":false,"roles":["contractor","designer"],"refs":{"cl_ssip_contractor":2850,"cl_ssip_designer":2928,"cl_hs_designer":3477}},{"id":"HS-19","area":"H&S core","text":"Accidents or incidents recorded in last 3 years? HSE enforcement in last 5 years?","kind":"declaration","cas":false,"roles":["contractor","designer"],"refs":{"cl_ssip_contractor":[2851,2853],"cl_ssip_designer":[2929,2931],"cl_hs_designer":[3478,3480]}},{"id":"HS-20","area":"H&S core","text":"Uses subcontractors?","kind":"declaration","cas":false,"roles":["contractor","designer"],"refs":{"cl_ssip_contractor":2855,"cl_ssip_designer":2933,"cl_hs_designer":3482,"cl_shared":9947},"notes":"REF 9947 repeats across Quality, Building Safety, FIR, Enhanced Financial."},{"id":"CN-01","area":"CDM contractor","text":"Two site-specific risk assessments and method statements from two separate projects","kind":"record","cas":false,"roles":["contractor"],"refs":{"cl_ssip_contractor":2858},"fresh":"Dated within last 12 months","site":"RAMS on site and briefed (seen at inspection)"},{"id":"CN-02","area":"CDM contractor","text":"Two completed COSHH assessments for chemicals used","kind":"record","cas":false,"roles":["contractor"],"refs":{"cl_ssip_contractor":2859},"fresh":"Dated within last 12 months","site":"COSHH assessments available on site"},{"id":"CN-03","area":"CDM contractor","text":"Ever sole contractor and so acting as Principal Contractor needing a construction phase plan?","kind":"declaration","cas":false,"roles":["contractor"],"refs":{"cl_ssip_contractor":2860}},{"id":"CN-04","area":"CDM contractor","text":"Two-way communication with another party about the work (meeting notes, client emails)","kind":"record","cas":false,"roles":["contractor"],"refs":{"cl_ssip_contractor":2862},"fresh":"Dated within last 12 months","site":"Site progress or coordination meeting notes"},{"id":"CN-05","area":"CDM contractor","text":"Welfare confirmed by another party (email or pre-start minutes)","kind":"record","cas":false,"roles":["contractor"],"refs":{"cl_ssip_contractor":2863},"fresh":"Dated within last 12 months","site":"Welfare provision checked at inspection"},{"id":"DS-01","area":"CDM designer","text":"Evidence the client has been made aware of their CDM 2015 duties","kind":"record","cas":false,"roles":["designer"],"refs":{"cl_ssip_designer":2936,"cl_hs_designer":3485},"fresh":"Dated within last 12 months"},{"id":"DS-02","area":"CDM designer","text":"Project-specific design risk assessment showing risks eliminated, reduced or controlled (general principles of prevention)","kind":"record","cas":false,"roles":["designer"],"refs":{"cl_ssip_designer":2937,"cl_hs_designer":3486},"fresh":"Dated within last 12 months"},{"id":"DS-03","area":"CDM designer","text":"How significant residual design risks are communicated to the Principal Designer","kind":"record","cas":false,"roles":["designer"],"refs":{"cl_ssip_designer":2938,"cl_hs_designer":3487},"fresh":"Dated within last 12 months"},{"id":"DS-04","area":"CDM designer","text":"Designs workplaces under the Workplace Regulations 1992? If so, how compliance is ensured","kind":"record","cas":false,"roles":["designer"],"refs":{"cl_ssip_designer":2939,"cl_hs_designer":[3488,3489]}},{"id":"DS-05","area":"CDM designer","text":"Cooperation and coordination with other designers, the PD, contractors and the PC (design review minutes, emails)","kind":"record","cas":false,"roles":["designer"],"refs":{"cl_ssip_designer":2941,"cl_hs_designer":3490},"fresh":"Dated within last 12 months"},{"id":"SS-01","area":"SSIP certificates","text":"Valid SSIP certificate or ISO 45001, its scope (Contractor/Designer/PC/PD), awarding body, activities, start and expiry dates","kind":"certificate","cas":false,"roles":["contractor","designer"],"refs":{"cl_hs_thirdparty":[13131,13127,373,13132,375,2319],"cl_ssip_dts":[13129,10323,13130,10318,10319,10320,10321]},"fresh":"Certificate in date; checked against the SSIP portal","notes":"Common failure: certificate uploaded but 'select the certificate uploaded' left blank (MVL)."},{"id":"QA-01","area":"Quality","text":"ISO 9001 certificate, or a quality management policy","kind":"certificate","cas":true,"roles":["contractor","designer"],"refs":{"cl_quality":[14564,247,13125,249,250,9817,9826]},"fresh":"Dated within last 12 months"},{"id":"QA-02","area":"Quality","text":"Arrangements making quality management effective, quality training, periodic review and supplier quality","kind":"policy","cas":false,"roles":["contractor","designer"],"refs":{"cl_quality":[2278,2279,2280,2281,2282,2283,2284,2285]},"fresh":"Dated within last 12 months"},{"id":"QA-03","area":"Quality","text":"Products and systems specified/used conform to designated standards or certification and are used for intended purpose; specifications refer to classification as part of a sub-system","kind":"policy","cas":true,"roles":["contractor","designer"],"refs":{"cl_quality":[9818,9827,9819,9828]},"fresh":"Dated within last 12 months"},{"id":"QA-04","area":"Quality","text":"Installation of products and systems checked and approved by a competent person","kind":"policy","cas":true,"roles":["contractor","designer"],"refs":{"cl_quality":[9820,9829]},"fresh":"Dated within last 12 months","site":"Installation checks and sign-off seen at inspection"},{"id":"QA-05","area":"Quality","text":"Keeping up to date with changes to legislation, standards and products","kind":"policy","cas":true,"roles":["contractor","designer"],"refs":{"cl_quality":[9953,10005]},"fresh":"Dated within last 12 months"},{"id":"QA-06","area":"Quality","text":"Managing and recording competence (skills, knowledge, experience, behaviours) of workforce and key subcontractors","kind":"record","cas":true,"roles":["contractor","designer"],"refs":{"cl_quality":[9950,9958]},"fresh":"Dated within last 12 months"},{"id":"QA-07","area":"Quality","text":"Supervision, instruction and information for workforce and key subcontractors so work meets relevant requirements","kind":"policy","cas":true,"roles":["contractor","designer"],"refs":{"cl_quality":[9951,9959]},"fresh":"Dated within last 12 months","site":"Supervision on site checked at inspection"},{"id":"QA-08","area":"Quality","text":"Risk management policy","kind":"policy","cas":false,"roles":["contractor","designer"],"refs":{"cl_quality":2288},"notes":"Advisory for micro companies."},{"id":"QA-09","area":"Quality","text":"BS 99001 held?","kind":"certificate","cas":false,"roles":["contractor","designer"],"refs":{"cl_quality":13091,"cl_building_safety":13091,"cl_bsa_building_safety":13091}},{"id":"QA-10","area":"Quality","text":"Person ultimately responsible for quality","kind":"info","cas":false,"roles":["contractor","designer"],"refs":{"cl_quality":[261,262,263,264,265,266]}},{"id":"BS-01","area":"Building Safety Act","text":"Carries out regulated building or design work in England or Wales (or explanation why not)","kind":"declaration","cas":true,"roles":["contractor","designer"],"refs":{"cl_building_safety":[9956,10432],"cl_bsa_building_safety":[9956,10432]},"notes":"RSSC rejected for answering No; answering No leaves BSA goals Not Verified and blocks Fire Precautions and HRB Declaration."},{"id":"BS-02","area":"Building Safety Act","text":"Arrangements so the client is aware of its BSA duties, including explaining technical information to non-technical people","kind":"record","cas":true,"roles":["contractor","designer"],"refs":{"cl_building_safety":[9952,9960],"cl_bsa_building_safety":[9952,9960]},"fresh":"Dated within last 12 months"},{"id":"BS-03","area":"Building Safety Act","text":"Cooperating and communicating with other duty holders so work is compliant","kind":"record","cas":true,"roles":["contractor","designer"],"refs":{"cl_building_safety":[9954,9963],"cl_bsa_building_safety":[9954,9963]},"fresh":"Dated within last 12 months","site":"Coordination with other trades and duty holders seen at inspection"},{"id":"BS-04","area":"Building Safety Act","text":"Notifying stakeholders, manufacturers and accountable persons of defects in products or systems affecting building safety","kind":"policy","cas":true,"roles":["contractor","designer"],"refs":{"cl_building_safety":[13092,13093],"cl_bsa_building_safety":[13092,13093],"cl_bsa_fire":10440},"fresh":"Dated within last 12 months","site":"Defects or non-conformances found and reported at inspection"},{"id":"BS-05","area":"Building Safety Act","text":"Duty holder roles held under the BSA (Contractor, Designer, PC, PD)","kind":"declaration","cas":false,"roles":["contractor","designer"],"refs":{"cl_building_safety":10006,"cl_bsa_building_safety":10006,"cl_bsa_fire":10448}},{"id":"BS-06","area":"Building Safety Act","text":"Planning, managing and monitoring building work so it complies (as PC or Contractor)","kind":"policy","cas":false,"roles":["contractor"],"refs":{"cl_building_safety":10009,"cl_bsa_building_safety":10009},"fresh":"Dated within last 12 months","site":"Site inspection reports showing monitoring"},{"id":"BS-07","area":"Building Safety Act","text":"Giving other duty holders information about building work carried out as Contractor","kind":"record","cas":true,"roles":["contractor"],"refs":{"cl_building_safety":[10007,10008],"cl_bsa_building_safety":[10007,10008]},"fresh":"Dated within last 12 months"},{"id":"BS-08","area":"Building Safety Act","text":"Works on higher-risk buildings?","kind":"declaration","cas":true,"roles":["contractor","designer"],"refs":{"cl_building_safety":9955,"cl_bsa_building_safety":9955,"cl_bsa_hrb_decl":10452}},{"id":"BS-09","area":"Building Safety Act","text":"Five-year declarations: compliance or stop notices, convictions (HSWA, BSA, Building Act, Fire Safety Order), inquiry findings","kind":"declaration","cas":true,"roles":["contractor","designer"],"refs":{"cl_bsa_hrb_infractions":[7387,7389,7391,7393]}},{"id":"BS-10","area":"Building Safety Act","text":"Communicating technical information to non-technical audiences in accessible formats","kind":"policy","cas":true,"roles":["contractor","designer"],"refs":{"cl_bsa_fire":[7382,7383]},"fresh":"Dated within last 12 months"},{"id":"BS-11","area":"Building Safety Act","text":"Documented arrangements to assess and manage fire risk on projects and sites","kind":"policy","cas":true,"roles":["contractor","designer"],"refs":{"cl_bsa_fire":[7367,7368]},"fresh":"Dated within last 12 months","site":"Fire precautions, hot works, solvents and fire spread checked at inspection"},{"id":"BS-12","area":"Building Safety Act","text":"Examples of preventative fire safety training received by employees and subcontractors","kind":"certificate","cas":false,"roles":["contractor","designer"],"refs":{"cl_bsa_fire":7369},"fresh":"In date"},{"id":"BS-13","area":"Building Safety Act","text":"Scope questions: affects structure or fixings, fire strategies or systems, alteration of existing buildings","kind":"declaration","cas":false,"roles":["contractor","designer"],"refs":{"cl_bsa_fire":[7372,10441,10444]}},{"id":"GV-01","area":"Governance","text":"Anti-bribery and corruption policy, how it is communicated, and evidence","kind":"policy","cas":true,"roles":["contractor","designer"],"refs":{"cl_crg":[7352,119,7353,121,122]},"fresh":"Signed and dated by a director within last 12 months"},{"id":"GV-02","area":"Governance","text":"Whistleblowing policy, how it is communicated, and evidence","kind":"policy","cas":true,"roles":["contractor","designer"],"refs":{"cl_crg":[7348,1626,10429,10430,10431]},"fresh":"Signed and dated by a director within last 12 months"},{"id":"GV-03","area":"Governance","text":"Fraud prevention procedures (Economic Crime and Corporate Transparency Act)","kind":"policy","cas":false,"roles":["contractor","designer"],"refs":{"cl_crg":[13110,13111]},"fresh":"Dated within last 12 months"},{"id":"GV-04","area":"Governance","text":"Arrangements to prevent facilitation of tax evasion (Criminal Finances Act)","kind":"policy","cas":true,"roles":["contractor","designer"],"refs":{"cl_crg":[9807,2391]},"fresh":"Dated within last 12 months"},{"id":"GV-05","area":"Governance","text":"Right to work checks","kind":"policy","cas":false,"roles":["contractor","designer"],"refs":{"cl_crg":2392},"fresh":"Dated within last 12 months"},{"id":"GV-06","area":"Governance","text":"ESG policy","kind":"policy","cas":false,"roles":["contractor","designer"],"refs":{"cl_crg":[2394,2395]},"fresh":"Dated within last 12 months"},{"id":"GV-07","area":"Governance","text":"Modern slavery statement, how it is communicated, supply chain arrangements","kind":"policy","cas":false,"roles":["contractor","designer"],"refs":{"cl_crg":[13112,6847,13113,13114,13115,2398,2399]},"fresh":"Dated within last 12 months"},{"id":"GV-08","area":"Governance","text":"Pays at least NMW/NLW; pays real Living Wage?","kind":"declaration","cas":true,"roles":["contractor","designer"],"refs":{"cl_crg":[2400,9831]}},{"id":"GV-09","area":"Governance","text":"Anti-bullying and harassment policy and arrangements","kind":"policy","cas":false,"roles":["contractor","designer"],"refs":{"cl_crg":[9832,9833,9834]},"fresh":"Dated within last 12 months","notes":"MVL uploaded the anti-bribery policy here by mistake; assessor flagged it."},{"id":"GV-10","area":"Governance","text":"Prevention of sexual harassment (Worker Protection Act)","kind":"policy","cas":true,"roles":["contractor","designer"],"refs":{"cl_crg":[13116,13117]},"fresh":"Dated within last 12 months"},{"id":"GV-11","area":"Governance","text":"Sanctions, gender pay gap and corporate governance statement declarations","kind":"declaration","cas":true,"roles":["contractor","designer"],"refs":{"cl_crg":[3626,2403,3613]}},{"id":"GV-12","area":"Governance","text":"Declarations: debarment list, Procurement Act Schedule 6 and 7 exclusions, blacklisting, tax avoidance, trade body suspension, public officials, competition law","kind":"declaration","cas":true,"roles":["contractor","designer"],"refs":{"cl_cps":[10400,13096,13103],"cl_ecps":[1602,1605,1608,1611,9808,1621,1627,1629]}},{"id":"GV-13","area":"Governance","text":"Fair Payment Code","kind":"declaration","cas":false,"roles":["contractor","designer"],"refs":{"cl_efi":13094},"notes":"Advisory fail if No."},{"id":"IS-01","area":"Information security","text":"Cyber Essentials Plus or ISO 27001; cyber security policy","kind":"policy","cas":false,"roles":["contractor","designer"],"refs":{"cl_infosec":[7342,7341,3611]},"fresh":"Signed and dated by a director within last 12 months","notes":"Advisory fail when policy not signed and dated by a director in last 12 months."},{"id":"IS-02","area":"Information security","text":"Data protection policy and privacy notice, processing records, DPIA, rights requests, responsible person","kind":"policy","cas":true,"roles":["contractor","designer"],"refs":{"cl_infosec":[3610,2256,173,174,175,176]},"fresh":"Dated within last 12 months"},{"id":"IS-03","area":"Information security","text":"Suppliers' and subcontractors' cyber and data protection arrangements","kind":"record","cas":false,"roles":["contractor","designer"],"refs":{"cl_infosec":[7343,3612,9810]},"fresh":"Dated within last 12 months"},{"id":"EN-01","area":"Environment","text":"ISO 14001/EMAS, or an environmental management policy","kind":"policy","cas":true,"roles":["contractor","designer"],"refs":{"cl_env":[13122,9815,9816]},"fresh":"Dated within last 12 months"},{"id":"EN-02","area":"Environment","text":"Environmental arrangements: effectiveness, workforce training, check and review, subcontractors","kind":"policy","cas":false,"roles":["contractor","designer"],"refs":{"cl_env":[2264,2265,2266,2267,2268,2269,2270,2271]},"fresh":"Dated within last 12 months","site":"Waste, spill and environmental controls checked at inspection"},{"id":"EN-03","area":"Environment","text":"Competent environmental advice with two examples of advice and action in last 12 months","kind":"record","cas":false,"roles":["contractor","designer"],"refs":{"cl_env":[2272,10000,10001,10002]},"fresh":"Dated within last 12 months"},{"id":"EN-04","area":"Environment","text":"Waste carrier licence","kind":"certificate","cas":false,"roles":["contractor","designer"],"refs":{"cl_env":[10003,241,10004,243,244]},"fresh":"In date"},{"id":"EN-05","area":"Environment","text":"SECR, carbon reduction plan, sustainability standards, net zero, emissions monitoring","kind":"policy","cas":false,"roles":["contractor","designer"],"refs":{"cl_env":[2273,3617,2275],"cl_env_sust":[2699,2701,2702,2703,2706,2707,2708,2709,2711,2712,2713,2714,2453,2454,2715,2717]},"notes":"Carbon reduction plan is an advisory fail if N/A."},{"id":"FR-01","area":"Fairness and inclusion","text":"Fairness, Inclusion and Respect policy, how it is communicated, evidence, embedding, inclusive recruitment","kind":"policy","cas":true,"roles":["contractor","designer"],"refs":{"cl_fir":[13118,2261,13119,13120,9811,9812,9813,9814]},"fresh":"Dated within last 12 months"},{"id":"FR-02","area":"Fairness and inclusion","text":"Three-year declarations: discrimination findings, EHRC action, immigration and NMW breaches","kind":"declaration","cas":false,"roles":["contractor","designer"],"refs":{"cl_fir":[191,194,197,200,203]}}]};
  // ── end generated ──

  // The areas, in the order the journey walks them.
  var AREAS = ['H&S core', 'CDM contractor', 'CDM designer', 'SSIP certificates', 'Quality',
    'Building Safety Act', 'Governance', 'Information security', 'Environment', 'Fairness and inclusion'];

  // A principal contractor is a contractor and a principal designer is a
  // designer, so each answers that role's questions. The master list holds no
  // question for the principal roles alone.
  var ROLES = [
    { id: 'contractor', label: 'Contractor', asks: 'contractor' },
    { id: 'designer',   label: 'Designer',   asks: 'designer' },
    { id: 'pc',         label: 'Principal Contractor', asks: 'contractor' },
    { id: 'pd',         label: 'Principal Designer',   asks: 'designer' }
  ];

  // Schemes. A scheme is a set of mappings from its own question references
  // onto the common question ids, so adding one never touches the questions.
  var SCHEMES = [
    { id: 'cl', label: 'Constructionline Gold (Once For All)', sets: MASTER.schemes.sets, setOrder: Object.keys(MASTER.schemes.sets) },
    { id: 'chas', label: 'CHAS', sets: {}, setOrder: [], pending: 'CHAS questions have not been captured into the master list yet, so none can show here.' }
  ];

  var STATUS = {
    evidenced: { label: 'Evidenced' },
    due:       { label: 'Due to expire' },
    gap:       { label: 'Gap' },
    rejected:  { label: 'Rejected' },
    na:        { label: 'Not applicable' },
    elsewhere: { label: 'Answered elsewhere' }
  };
  var STATUS_ORDER = ['rejected', 'gap', 'due', 'evidenced', 'elsewhere', 'na'];
  var DUE_DAYS = 60;

  // ── dates ──
  function iso(d) { return d.toISOString().slice(0, 10); }
  function parse(s) { if (!s || !/^\d{4}-\d{2}-\d{2}/.test(String(s))) return null; var d = new Date(String(s).slice(0, 10) + 'T12:00:00Z'); return isNaN(d.getTime()) ? null : d; }
  function addMonths(s, n) {
    var d = parse(s); if (!d) return '';
    var day = d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n);
    var last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 12)).getUTCDate();
    d.setUTCDate(Math.min(day, last)); return iso(d);
  }
  function daysFrom(today, s) { var a = parse(today), b = parse(s); if (!a || !b) return null; return Math.round((b - a) / 86400000); }
  function todayIso() { return iso(new Date()); }

  // ── the freshness rule a question carries, read from its own words ──
  function freshRule(q) {
    var f = String((q && q.fresh) || '');
    if (!f) return null;
    if (/director/i.test(f)) return { dated: 12, director: true, text: f };
    if (/within last 12 months/i.test(f)) return { dated: 12, text: f };
    if (/in date/i.test(f)) return { indate: true, text: f };
    return { text: f };
  }

  // ── which questions a client sees ──
  function cfgOf(state) {
    var a = (state && state.accred && typeof state.accred === 'object') ? state.accred : {};
    var schemes = (a.schemes && typeof a.schemes === 'object') ? a.schemes : {};
    var roles = Array.isArray(a.roles) ? a.roles.filter(function (r) { return ROLES.some(function (x) { return x.id === r; }); }) : [];
    return { schemes: schemes, roles: roles, answers: (a.answers && typeof a.answers === 'object') ? a.answers : {} };
  }
  function askedRoles(cfg) {
    var out = [];
    cfg.roles.forEach(function (r) { var x = ROLES.find(function (y) { return y.id === r; }); if (x && out.indexOf(x.asks) < 0) out.push(x.asks); });
    return out;
  }
  function schemeOf(id) { return SCHEMES.find(function (s) { return s.id === id; }) || null; }
  // The sets of a scheme the client answers: every set, unless some were
  // switched off on purpose (a requirement the client does not hold).
  // A set named for one role ("... Contractor set", "... Designer set") is
  // asked of that role only; every other set is asked of both.
  function setRole(sc, k) { var l = String((sc && sc.sets[k]) || ''); return /contractor set/i.test(l) ? 'contractor' : /designer set/i.test(l) ? 'designer' : null; }
  function setsFor(cfg, schemeId) {
    var sc = schemeOf(schemeId); if (!sc) return [];
    var roles = askedRoles(cfg);
    return sc.setOrder.filter(function (k) { var r = setRole(sc, k); return !r || roles.indexOf(r) >= 0; });
  }
  function setsOn(cfg, schemeId) {
    var c = cfg.schemes[schemeId];
    if (!c || !c.on) return [];
    var off = (c.setsOff && typeof c.setsOff === 'object') ? c.setsOff : {};
    return setsFor(cfg, schemeId).filter(function (k) { return !off[k]; });
  }
  function refsOf(q, setKey) { var r = q.refs && q.refs[setKey]; if (r == null) return []; return Array.isArray(r) ? r.slice() : [r]; }
  function inScope(q, cfg) {
    var roles = askedRoles(cfg);
    if (!roles.length || !q.roles.some(function (r) { return roles.indexOf(r) >= 0; })) return false;
    return SCHEMES.some(function (sc) { return setsOn(cfg, sc.id).some(function (k) { return refsOf(q, k).length; }); });
  }
  function questions(state) {
    var cfg = cfgOf(state);
    return MASTER.questions.filter(function (q) { return inScope(q, cfg); })
      .sort(function (a, b) { return AREAS.indexOf(a.area) - AREAS.indexOf(b.area); });   // stable: master order within an area
  }
  function byId(id) { return MASTER.questions.find(function (q) { return q.id === id; }) || null; }
  // Everywhere a common question is asked: one answer covers all of these.
  function usedIn(q, state) {
    var out = [], cfg = state ? cfgOf(state) : null;
    SCHEMES.forEach(function (sc) { (cfg ? setsOn(cfg, sc.id) : sc.setOrder).forEach(function (k) { var r = refsOf(q, k); if (r.length) out.push({ scheme: sc.id, set: k, label: sc.sets[k], refs: r }); }); });
    return out;
  }

  // ── evidence: what one picked record says about itself ──
  // ref = { src:'doc'|'mem'|'policy'|'site', id }
  function facts(state, ref) {
    if (!ref || !ref.src) return null;
    if (ref.src === 'doc') {
      var d = (state.documents || []).find(function (x) { return x && x.id === ref.id; }); if (!d) return { missing: true, name: 'A document that is no longer in the register' };
      return { src: 'doc', id: d.id, name: d.name || 'Untitled document', dated: d.dated || '', signedBy: d.signedBy || '', director: !!d.signedDirector, expires: d.expires || '', file: d.link || '', version: d.version || '' };
    }
    if (ref.src === 'mem') {
      var m = (state.memberships || []).find(function (x) { return x && x.id === ref.id; }); if (!m) return { missing: true, name: 'A certificate that is no longer in the register' };
      return { src: 'mem', id: m.id, name: (m.name || 'Certificate') + (m.body ? ' (' + m.body + ')' : ''), dated: '', signedBy: '', director: false, expires: m.expiry || '', file: m.ref ? ('Ref ' + m.ref) : '' };
    }
    if (ref.src === 'policy') {
      var p = state.policyDoc || {};
      return { src: 'policy', id: 'policy', name: 'Health and safety policy statement of intent', dated: p.signedDate || '',
        signedBy: (p.signedBy || '') + (p.signedRole ? ' (' + p.signedRole + ')' : ''), director: /director/i.test(p.signedRole || ''), expires: '', file: '' };
    }
    if (ref.src === 'site') {
      var it = siteItems(state).find(function (x) { return x.key === ref.id; }); if (!it) return { missing: true, name: 'A site inspection record that is no longer synced' };
      return siteFacts(it);
    }
    return null;
  }
  // Site inspection evidence pulled through a linked app, flattened to one
  // line per question it evidences.
  function siteItems(state) {
    var out = [], ev = state.siteEvidence;
    if (!ev || typeof ev !== 'object') return out;
    Object.keys(ev).forEach(function (linkId) {
      ((ev[linkId] && ev[linkId].records) || []).forEach(function (rec) {
        (rec.items || []).forEach(function (it, i) {
          (it.qids || []).forEach(function (qid) {
            out.push({ key: linkId + '|' + rec.inspectionId + '|' + i + '|' + qid, qid: qid, rec: rec, item: it });
          });
        });
      });
    });
    return out;
  }
  function siteFacts(x) {
    var r = x.rec || {}, it = x.item || {};
    return { src: 'site', id: x.key, fromSite: true,
      name: 'Site inspection, ' + (r.project || 'project') + (r.visit ? ', visit ' + r.visit : '') + (it.check ? ': ' + it.check : ''),
      dated: r.date || String(r.sentAt || '').slice(0, 10), signedBy: '', by: r.inspector || '', director: false, expires: '',
      file: r.reportName || '', note: it.note || '', photo: it.photo || '', inspectionId: r.inspectionId || '' };
  }
  function siteFor(state, qid) {
    return siteItems(state).filter(function (x) { return x.qid === qid; })
      .sort(function (a, b) { return String((b.rec && b.rec.date) || '').localeCompare(String((a.rec && a.rec.date) || '')); });
  }
  // The evidence a question stands on. One the client picked always wins. With
  // nothing picked, the newest site inspection record that evidences the
  // question stands in: the check was tagged to the question on purpose, and
  // it never overwrites a choice.
  function evidenceOf(state, q, ans) {
    if (ans && ans.ev && ans.ev.src) return { ref: ans.ev, facts: facts(state, ans.ev), picked: true };
    var s = siteFor(state, q.id);
    if (s.length) return { ref: { src: 'site', id: s[0].key }, facts: siteFacts(s[0]), picked: false };
    return null;
  }

  // ── the status of one question, from the facts ──
  function statusOf(state, q, today) {
    today = today || todayIso();
    var cfg = cfgOf(state), a = cfg.answers[q.id] || {};
    function out(k, why, extra) { var o = { k: k, label: STATUS[k].label, why: why || '' }; if (extra) Object.keys(extra).forEach(function (x) { o[x] = extra[x]; }); return o; }
    if (a.na && String(a.na).trim()) return out('na', String(a.na).trim());
    if (a.elsewhere && String(a.elsewhere).trim()) return out('elsewhere', String(a.elsewhere).trim());
    var hist = Array.isArray(a.hist) ? a.hist : [];
    var last = hist.length ? hist[hist.length - 1] : null;
    if (last && last.t === 'rejected') return out('rejected', 'Rejected ' + (last.at || '') + (last.note ? ': ' + last.note : ''), { since: last.at || '' });
    if (q.kind === 'info') return (a.text && String(a.text).trim()) ? out('evidenced', 'Answered') : out('gap', 'No answer recorded');
    if (q.kind === 'declaration') return (a.decl === 'yes' || a.decl === 'no') ? out('evidenced', 'Declared ' + (a.decl === 'yes' ? 'Yes' : 'No')) : out('gap', 'Not declared yet');
    var e = evidenceOf(state, q, a);
    if (!e || !e.facts) return out('gap', 'No evidence picked');
    var f = e.facts;
    if (f.missing) return out('gap', f.name, { ev: e });
    var rule = freshRule(q) || {};
    var expires = '';
    if (rule.dated) {
      if (!f.dated) return out('gap', 'The date of ' + (f.name || 'the evidence') + ' is not recorded', { ev: e });
      expires = addMonths(f.dated, rule.dated);
      if (rule.director && !f.director) return out('gap', 'Not signed by a director', { ev: e, expires: expires, days: daysFrom(today, expires) });
    }
    if (rule.indate && !f.expires) return out('gap', 'The expiry date of ' + (f.name || 'the evidence') + ' is not recorded', { ev: e });
    if (f.expires && (!expires || f.expires < expires)) expires = f.expires;
    var days = expires ? daysFrom(today, expires) : null;
    if (days != null && days < 0) return out('gap', rule.dated && expires !== f.expires ? 'Older than 12 months' : 'Expired', { ev: e, expires: expires, days: days });
    if (days != null && days <= DUE_DAYS) return out('due', 'Due to expire in ' + days + ' day' + (days === 1 ? '' : 's'), { ev: e, expires: expires, days: days });
    return out('evidenced', e.picked ? 'Evidence in date' : 'From a site inspection', { ev: e, expires: expires, days: days });
  }

  // ── where things stand ──
  function renewals(state, today) {
    today = today || todayIso();
    var cfg = cfgOf(state), out = [];
    SCHEMES.forEach(function (sc) {
      var c = cfg.schemes[sc.id]; if (!c || !c.on) return;
      var m = c.membershipId ? (state.memberships || []).find(function (x) { return x && x.id === c.membershipId; }) : null;
      var exp = m ? (m.expiry || '') : '';
      out.push({ scheme: sc.id, label: sc.label, membership: m ? (m.name || '') : '', expires: exp, days: exp ? daysFrom(today, exp) : null });
    });
    return out;
  }
  function summary(state, today) {
    today = today || todayIso();
    var qs = questions(state), counts = {}, lists = {}, mandatoryGap = [];
    Object.keys(STATUS).forEach(function (k) { counts[k] = 0; lists[k] = []; });
    qs.forEach(function (q) {
      var s = statusOf(state, q, today);
      counts[s.k]++; lists[s.k].push(q.id);
      if (q.cas && (s.k === 'gap' || s.k === 'rejected')) mandatoryGap.push(q.id);
    });
    // Ready = evidence in place today (due to expire still counts until it
    // does). Not applicable and answered elsewhere are out of the reckoning.
    var ready = counts.evidenced + counts.due, assessable = qs.length - counts.na - counts.elsewhere;
    return { total: qs.length, counts: counts, lists: lists, mandatoryGap: mandatoryGap, renewals: renewals(state, today), started: started(state),
      ready: ready, assessable: assessable, pct: assessable > 0 ? Math.round(ready / assessable * 100) : null };
  }
  function started(state) { var c = cfgOf(state); return Object.keys(c.schemes).some(function (k) { return c.schemes[k] && c.schemes[k].on; }); }

  // Questions a site inspection can evidence that need it now: the focus
  // areas sent to the inspector for the next visit.
  function focusFor(state, today) {
    today = today || todayIso();
    return questions(state).filter(function (q) { return !!q.site; }).map(function (q) {
      var s = statusOf(state, q, today);
      return { id: q.id, area: q.area, text: q.text, site: q.site, status: s.k, label: s.label, why: s.why };
    }).filter(function (x) { return x.status === 'gap' || x.status === 'due' || x.status === 'rejected'; });
  }

  // ── the submission pack, in the scheme's own order ──
  function answerText(state, q, s) {
    var a = cfgOf(state).answers[q.id] || {};
    if (s.k === 'na') return 'Not applicable: ' + s.why;
    if (s.k === 'elsewhere') return 'Answered elsewhere: ' + s.why;
    if (q.kind === 'info') return String(a.text || '').trim() || 'No answer recorded';
    if (q.kind === 'declaration') return a.decl === 'yes' ? 'Yes' + (a.note ? ' - ' + a.note : '') : a.decl === 'no' ? 'No' + (a.note ? ' - ' + a.note : '') : 'Not declared yet';
    return s.label + (s.why && s.k !== 'evidenced' ? ' - ' + s.why : '');
  }
  function packRows(state, schemeId, today) {
    today = today || todayIso();
    var cfg = cfgOf(state), sc = schemeOf(schemeId); if (!sc) return [];
    var roles = askedRoles(cfg);
    return setsOn(cfg, schemeId).map(function (k) {
      var rows = [];
      MASTER.questions.forEach(function (q) {
        var r = refsOf(q, k); if (!r.length) return;
        if (!q.roles.some(function (x) { return roles.indexOf(x) >= 0; })) return;
        var s = statusOf(state, q, today), f = s.ev && s.ev.facts;
        rows.push({ id: q.id, refs: r, first: Math.min.apply(null, r), text: q.text, cas: !!q.cas, status: s.k, statusLabel: s.label,
          answer: answerText(state, q, s),
          evidence: f && !f.missing ? f.name + (f.version ? ' ' + f.version : '') : '',
          file: f && !f.missing ? (f.file || '') : '',
          dated: f && !f.missing ? (f.dated || '') : '', signedBy: f && !f.missing ? (f.signedBy || '') : '', by: f && !f.missing ? (f.by || '') : '', expires: s.expires || '' });
      });
      rows.sort(function (a, b) { return a.first - b.first; });
      return { set: k, label: sc.sets[k], rows: rows };
    }).filter(function (g) { return g.rows.length; });
  }

  var api = { MASTER: MASTER, AREAS: AREAS, ROLES: ROLES, SCHEMES: SCHEMES, STATUS: STATUS, STATUS_ORDER: STATUS_ORDER, DUE_DAYS: DUE_DAYS,
    addMonths: addMonths, daysFrom: daysFrom, todayIso: todayIso, freshRule: freshRule, cfgOf: cfgOf, setsOn: setsOn, setsFor: setsFor, setRole: setRole, schemeOf: schemeOf,
    refsOf: refsOf, inScope: inScope, questions: questions, byId: byId, usedIn: usedIn, facts: facts, siteItems: siteItems, siteFor: siteFor,
    evidenceOf: evidenceOf, statusOf: statusOf, renewals: renewals, summary: summary, started: started, focusFor: focusFor,
    answerText: answerText, packRows: packRows };
  root.AccredCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
