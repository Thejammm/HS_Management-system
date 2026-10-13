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
  var MASTER = {"version":"0.1","captured":"2026-10-05","source":"Once For All portal, read-only capture from MVL (Contractor) and RSSC (Designer) accounts. Not yet included: CHAS, Working Conditions, Social Value, Community Engagement, Memberships, Information Management (ISO 19650), company/financial/insurance admin sections.","rules":{"fresh_default":"All documents dated within the last 12 months; training certificates and cards in date (OFA 30-day lock note)","cas":"cas=true means mandatory under the Common Assessment Standard; others can pass as Approved with Advisory"},"schemes":{"cl":"Constructionline (Once For All)","sets":{"cl_ssip_contractor":"OFA Health & Safety (SSIP), Contractor set","cl_ssip_designer":"OFA Health & Safety (SSIP), Designer set","cl_hs_designer":"Health and Safety (5.0), Designer set","cl_hs_thirdparty":"H&S Third Party / Exemption certificates","cl_ssip_dts":"SSIP Third Party Exemption","cl_mhw":"Mental Health and Wellbeing","cl_quality":"Quality (5.9)","cl_building_safety":"Building Safety (5.9)","cl_bsa_building_safety":"BSA - Building Safety (5.9)","cl_bsa_fire":"BSA - Fire Precautions","cl_bsa_hrb_decl":"BSA - Higher Risk Building Declaration","cl_bsa_hrb_infractions":"BSA - High Risk Building Infractions","cl_crg":"Corporate Responsibility and Governance (5.0)","cl_cps":"Corporate and Professional Standing (5.0)","cl_ecps":"Enhanced Corporate and Professional Standing (4.1)","cl_efi":"Enhanced Financial Information (5.0)","cl_infosec":"Information Security (4.0)","cl_env":"Environmental Management (5.0)","cl_env_sust":"Environment & Sustainability","cl_fir":"Fairness, Inclusion and Respect (5.0)","cl_shared":"Repeated across several requirements"}},"questions":[{"id":"HS-01","area":"H&S core","text":"Named director with overall responsibility for health and safety","kind":"info","cas":false,"roles":["contractor","designer"],"refs":{"cl_ssip_contractor":2827,"cl_ssip_designer":2906,"cl_hs_designer":3455,"cl_hs_thirdparty":1463,"constructionline":["3455","2906","1463","2827"]}},{"id":"HS-02","area":"H&S core","text":"H&S policy with statement of intent physically signed by the most senior person","kind":"policy","cas":false,"roles":["contractor","designer"],"refs":{"cl_ssip_contractor":2828,"cl_ssip_designer":2907,"cl_hs_designer":3456,"constructionline":["3456","2907","2828"]},"fresh":"Signed and dated by a director within last 12 months"},{"id":"HS-03","area":"H&S core","text":"Organisation, roles and responsibilities section of the H&S policy","kind":"policy","cas":false,"roles":["contractor","designer"],"refs":{"cl_ssip_contractor":2829,"cl_ssip_designer":2908,"cl_hs_designer":3457,"constructionline":["3457","2908","2829"]},"fresh":"Dated within last 12 months"},{"id":"HS-04","area":"H&S core","text":"Full H&S arrangements, including how the company discharges its CDM 2015 duties for its role (Contractor or Designer)","kind":"policy","cas":false,"roles":["contractor","designer"],"refs":{"cl_ssip_contractor":2830,"cl_ssip_designer":2909,"cl_hs_designer":3458,"constructionline":["3458","2909","2830"]},"fresh":"Dated within last 12 months","notes":"Wording changes by role: 'as a Contractor' / 'as a designer'."},{"id":"HS-05","area":"H&S core","text":"Member of a fleet operations or management scheme?","kind":"declaration","cas":false,"roles":["contractor","designer"],"refs":{"cl_ssip_contractor":2831,"cl_ssip_designer":2910,"cl_hs_designer":3459,"constructionline":["3459","2910","2831"]}},{"id":"HS-06","area":"H&S core","text":"Drug and alcohol policy (prevention, testing regime, post-incident and reasonable-cause testing, return to duty, unannounced testing)","kind":"policy","cas":false,"roles":["contractor","designer"],"refs":{"cl_ssip_contractor":[2833,2834],"cl_ssip_designer":2912,"cl_hs_designer":[3461,3462],"constructionline":["3461","3462","2912","2833","2834"]},"fresh":"Dated within last 12 months","notes":"Advisory now; assessor says likely to become mandatory."},{"id":"HS-07","area":"H&S core","text":"Occupational health arrangements including mental health and fatigue (EAP, mental health at work initiative, Thriving at Work standards)","kind":"policy","cas":false,"roles":["contractor","designer"],"refs":{"cl_ssip_contractor":[2835,2836],"cl_ssip_designer":[2914,2915],"cl_hs_designer":[3463,3464],"cl_mhw":[2320,2685,2687,2688,2689],"constructionline":["3463","3464","2914","2915","2320","2685","2687","2688","2835","2836","2689"]},"fresh":"Dated within last 12 months","notes":"Advisory in SSIP set."},{"id":"HS-08","area":"H&S core","text":"Behavioural management or behavioural safety programme","kind":"policy","cas":false,"roles":["contractor","designer"],"refs":{"cl_ssip_contractor":2837,"cl_ssip_designer":[2916,2917],"cl_hs_designer":[3465,3466],"constructionline":["3465","3466","2916","2917","2837"]},"fresh":"Dated within last 12 months","notes":"Advisory."},{"id":"HS-09","area":"H&S core","text":"Name and contact details of competent H&S adviser","kind":"info","cas":false,"roles":["contractor","designer"],"refs":{"cl_ssip_contractor":2839,"cl_ssip_designer":2918,"cl_hs_designer":3467,"constructionline":["3467","2918","2839"]}},{"id":"HS-10","area":"H&S core","text":"Adviser's competence (qualifications, experience) and services retained","kind":"certificate","cas":false,"roles":["contractor","designer"],"refs":{"cl_ssip_contractor":2840,"cl_ssip_designer":2919,"cl_hs_designer":3468,"constructionline":["3468","2919","2840"]},"notes":"AHS: CMIOSH certificate, CV, adviser notice."},{"id":"HS-11","area":"H&S core","text":"Example of advice given by the adviser and how it was implemented","kind":"record","cas":false,"roles":["contractor","designer"],"refs":{"cl_ssip_contractor":2841,"cl_ssip_designer":2920,"cl_hs_designer":3469,"constructionline":["3469","2920","2841"]},"fresh":"Dated within last 12 months","site":"Completed AHS site inspection report with actions closed out","notes":"MVL used AHS site reports; RSSC used office risk assessment."},{"id":"HS-12","area":"H&S core","text":"Training matrix with expiry dates (designers: active CPD) or individual training records","kind":"record","cas":false,"roles":["contractor","designer"],"refs":{"cl_ssip_contractor":2842,"cl_ssip_designer":2921,"cl_hs_designer":3470,"constructionline":["3470","2921","2842"]},"fresh":"Dated within last 12 months","notes":"Assessor: every course held (e.g. manual handling, asbestos awareness) must appear on the matrix."},{"id":"HS-13","area":"H&S core","text":"Contractor: employees' and site managers' qualifications and skills cards matching the matrix. Designer: designers' CVs, training certificates and professional memberships (RIBA, ICE, APS, CIAT, ARB etc.)","kind":"certificate","cas":false,"roles":["contractor","designer"],"refs":{"cl_ssip_contractor":2843,"cl_ssip_designer":2922,"cl_hs_designer":3471,"constructionline":["3471","2922","2843"]},"fresh":"Cards and certificates in date","notes":"Question differs by role."},{"id":"HS-14","area":"H&S core","text":"Number or percentage of people holding a CSCS card","kind":"info","cas":false,"roles":["contractor"],"refs":{"cl_ssip_contractor":2844,"constructionline":["2844"]}},{"id":"HS-15","area":"H&S core","text":"How you check, review and improve H&S performance","kind":"record","cas":false,"roles":["contractor","designer"],"refs":{"cl_ssip_contractor":2845,"cl_ssip_designer":2923,"cl_hs_designer":3472,"constructionline":["3472","2923","2845"]},"fresh":"Dated within last 12 months","site":"Site inspection reports and trend of actions closed","notes":"MVL used an AHS site inspection report; RSSC used a CDM designer GPP audit."},{"id":"HS-16","area":"H&S core","text":"Number of employees (sets which consultation question applies)","kind":"info","cas":false,"roles":["contractor","designer"],"refs":{"cl_ssip_contractor":[2814,2846],"cl_ssip_designer":[2814,2924],"cl_hs_designer":[3374,3473],"constructionline":["3374","3473","2814","2924","2846"]}},{"id":"HS-17","area":"H&S core","text":"Practical evidence of two-way consultation with the workforce on H&S (5+ employees); description of consultation (1-4 employees)","kind":"record","cas":false,"roles":["contractor","designer"],"refs":{"cl_ssip_contractor":2849,"cl_ssip_designer":2927,"cl_hs_designer":3475,"constructionline":["3475","2927","2849"]},"fresh":"Dated within last 12 months","site":"Site inspection worker-engagement notes, toolbox talk records, pre-start meetings"},{"id":"HS-18","area":"H&S core","text":"Accident, incident and near miss statistics for the last 3 years","kind":"record","cas":false,"roles":["contractor","designer"],"refs":{"cl_ssip_contractor":2850,"cl_ssip_designer":2928,"cl_hs_designer":3477,"constructionline":["3477","2928","2850"]}},{"id":"HS-19","area":"H&S core","text":"Accidents or incidents recorded in last 3 years? HSE enforcement in last 5 years?","kind":"declaration","cas":false,"roles":["contractor","designer"],"refs":{"cl_ssip_contractor":[2851,2853],"cl_ssip_designer":[2929,2931],"cl_hs_designer":[3478,3480],"constructionline":["3478","3480","2929","2931","2851","2853"]}},{"id":"HS-20","area":"H&S core","text":"Uses subcontractors?","kind":"declaration","cas":false,"roles":["contractor","designer"],"refs":{"cl_ssip_contractor":2855,"cl_ssip_designer":2933,"cl_hs_designer":3482,"cl_shared":9947,"constructionline":["3482","2933","9947","2855"]},"notes":"REF 9947 repeats across Quality, Building Safety, FIR, Enhanced Financial."},{"id":"CN-01","area":"CDM contractor","text":"Two site-specific risk assessments and method statements from two separate projects","kind":"record","cas":false,"roles":["contractor"],"refs":{"cl_ssip_contractor":2858,"constructionline":["2858"]},"fresh":"Dated within last 12 months","site":"RAMS on site and briefed (seen at inspection)"},{"id":"CN-02","area":"CDM contractor","text":"Two completed COSHH assessments for chemicals used","kind":"record","cas":false,"roles":["contractor"],"refs":{"cl_ssip_contractor":2859,"constructionline":["2859"]},"fresh":"Dated within last 12 months","site":"COSHH assessments available on site"},{"id":"CN-03","area":"CDM contractor","text":"Ever sole contractor and so acting as Principal Contractor needing a construction phase plan?","kind":"declaration","cas":false,"roles":["contractor"],"refs":{"cl_ssip_contractor":2860,"constructionline":["2860"]}},{"id":"CN-04","area":"CDM contractor","text":"Two-way communication with another party about the work (meeting notes, client emails)","kind":"record","cas":false,"roles":["contractor"],"refs":{"cl_ssip_contractor":2862,"constructionline":["2862"]},"fresh":"Dated within last 12 months","site":"Site progress or coordination meeting notes"},{"id":"CN-05","area":"CDM contractor","text":"Welfare confirmed by another party (email or pre-start minutes)","kind":"record","cas":false,"roles":["contractor"],"refs":{"cl_ssip_contractor":2863,"constructionline":["2863"]},"fresh":"Dated within last 12 months","site":"Welfare provision checked at inspection"},{"id":"DS-01","area":"CDM designer","text":"Evidence the client has been made aware of their CDM 2015 duties","kind":"record","cas":false,"roles":["designer"],"refs":{"cl_ssip_designer":2936,"cl_hs_designer":3485,"constructionline":["3485","2936"]},"fresh":"Dated within last 12 months"},{"id":"DS-02","area":"CDM designer","text":"Project-specific design risk assessment showing risks eliminated, reduced or controlled (general principles of prevention)","kind":"record","cas":false,"roles":["designer"],"refs":{"cl_ssip_designer":2937,"cl_hs_designer":3486,"constructionline":["3486","2937"]},"fresh":"Dated within last 12 months"},{"id":"DS-03","area":"CDM designer","text":"How significant residual design risks are communicated to the Principal Designer","kind":"record","cas":false,"roles":["designer"],"refs":{"cl_ssip_designer":2938,"cl_hs_designer":3487,"constructionline":["3487","2938"]},"fresh":"Dated within last 12 months"},{"id":"DS-04","area":"CDM designer","text":"Designs workplaces under the Workplace Regulations 1992? If so, how compliance is ensured","kind":"record","cas":false,"roles":["designer"],"refs":{"cl_ssip_designer":2939,"cl_hs_designer":[3488,3489],"constructionline":["3488","3489","2939"]}},{"id":"DS-05","area":"CDM designer","text":"Cooperation and coordination with other designers, the PD, contractors and the PC (design review minutes, emails)","kind":"record","cas":false,"roles":["designer"],"refs":{"cl_ssip_designer":2941,"cl_hs_designer":3490,"constructionline":["3490","2941"]},"fresh":"Dated within last 12 months"},{"id":"SS-01","area":"SSIP certificates","text":"Valid SSIP certificate or ISO 45001, its scope (Contractor/Designer/PC/PD), awarding body, activities, start and expiry dates","kind":"certificate","cas":false,"roles":["contractor","designer"],"refs":{"cl_hs_thirdparty":[13131,13127,373,13132,375,2319],"cl_ssip_dts":[13129,10323,13130,10318,10319,10320,10321],"constructionline":["13131","13129","10323","13130","10318","10319","10320","10321","13127","373","13132","375","2319"]},"fresh":"Certificate in date; checked against the SSIP portal","notes":"Common failure: certificate uploaded but 'select the certificate uploaded' left blank (MVL)."},{"id":"QA-01","area":"Quality","text":"ISO 9001 certificate, or a quality management policy","kind":"certificate","cas":true,"roles":["contractor","designer"],"refs":{"cl_quality":[14564,247,13125,249,250,9817,9826],"constructionline":["14564","9817","9826","247","13125","249","250"]},"fresh":"Dated within last 12 months"},{"id":"QA-02","area":"Quality","text":"Arrangements making quality management effective, quality training, periodic review and supplier quality","kind":"policy","cas":false,"roles":["contractor","designer"],"refs":{"cl_quality":[2278,2279,2280,2281,2282,2283,2284,2285],"constructionline":["2280","2281","2282","2283","2284","2285","2278","2279"]},"fresh":"Dated within last 12 months"},{"id":"QA-03","area":"Quality","text":"Products and systems specified/used conform to designated standards or certification and are used for intended purpose; specifications refer to classification as part of a sub-system","kind":"policy","cas":true,"roles":["contractor","designer"],"refs":{"cl_quality":[9818,9827,9819,9828],"constructionline":["9818","9827","9819","9828"]},"fresh":"Dated within last 12 months"},{"id":"QA-04","area":"Quality","text":"Installation of products and systems checked and approved by a competent person","kind":"policy","cas":true,"roles":["contractor","designer"],"refs":{"cl_quality":[9820,9829],"constructionline":["9820","9829"]},"fresh":"Dated within last 12 months","site":"Installation checks and sign-off seen at inspection"},{"id":"QA-05","area":"Quality","text":"Keeping up to date with changes to legislation, standards and products","kind":"policy","cas":true,"roles":["contractor","designer"],"refs":{"cl_quality":[9953,10005],"constructionline":["9953","10005"]},"fresh":"Dated within last 12 months"},{"id":"QA-06","area":"Quality","text":"Managing and recording competence (skills, knowledge, experience, behaviours) of workforce and key subcontractors","kind":"record","cas":true,"roles":["contractor","designer"],"refs":{"cl_quality":[9950,9958],"constructionline":["9950","9958"]},"fresh":"Dated within last 12 months"},{"id":"QA-07","area":"Quality","text":"Supervision, instruction and information for workforce and key subcontractors so work meets relevant requirements","kind":"policy","cas":true,"roles":["contractor","designer"],"refs":{"cl_quality":[9951,9959],"constructionline":["9951","9959"]},"fresh":"Dated within last 12 months","site":"Supervision on site checked at inspection"},{"id":"QA-08","area":"Quality","text":"Risk management policy","kind":"policy","cas":false,"roles":["contractor","designer"],"refs":{"cl_quality":2288,"constructionline":["2288"]},"notes":"Advisory for micro companies."},{"id":"QA-09","area":"Quality","text":"BS 99001 held?","kind":"certificate","cas":false,"roles":["contractor","designer"],"refs":{"cl_quality":13091,"cl_building_safety":13091,"cl_bsa_building_safety":13091,"constructionline":["13091"]}},{"id":"QA-10","area":"Quality","text":"Person ultimately responsible for quality","kind":"info","cas":false,"roles":["contractor","designer"],"refs":{"cl_quality":[261,262,263,264,265,266],"constructionline":["261","262","263","264","265","266"]}},{"id":"BS-01","area":"Building Safety Act","text":"Carries out regulated building or design work in England or Wales (or explanation why not)","kind":"declaration","cas":true,"roles":["contractor","designer"],"refs":{"cl_building_safety":[9956,10432],"cl_bsa_building_safety":[9956,10432],"constructionline":["9956"]},"notes":"RSSC rejected for answering No; answering No leaves BSA goals Not Verified and blocks Fire Precautions and HRB Declaration."},{"id":"BS-02","area":"Building Safety Act","text":"Arrangements so the client is aware of its BSA duties, including explaining technical information to non-technical people","kind":"record","cas":true,"roles":["contractor","designer"],"refs":{"cl_building_safety":[9952,9960],"cl_bsa_building_safety":[9952,9960],"constructionline":["9952","9960"]},"fresh":"Dated within last 12 months"},{"id":"BS-03","area":"Building Safety Act","text":"Cooperating and communicating with other duty holders so work is compliant","kind":"record","cas":true,"roles":["contractor","designer"],"refs":{"cl_building_safety":[9954,9963],"cl_bsa_building_safety":[9954,9963],"constructionline":["9954","9963"]},"fresh":"Dated within last 12 months","site":"Coordination with other trades and duty holders seen at inspection"},{"id":"BS-04","area":"Building Safety Act","text":"Notifying stakeholders, manufacturers and accountable persons of defects in products or systems affecting building safety","kind":"policy","cas":true,"roles":["contractor","designer"],"refs":{"cl_building_safety":[13092,13093],"cl_bsa_building_safety":[13092,13093],"cl_bsa_fire":10440,"constructionline":["10440","13092","13093"]},"fresh":"Dated within last 12 months","site":"Defects or non-conformances found and reported at inspection"},{"id":"BS-05","area":"Building Safety Act","text":"Duty holder roles held under the BSA (Contractor, Designer, PC, PD)","kind":"declaration","cas":false,"roles":["contractor","designer"],"refs":{"cl_building_safety":10006,"cl_bsa_building_safety":10006,"cl_bsa_fire":10448,"constructionline":["10448","9999","10006"]}},{"id":"BS-06","area":"Building Safety Act","text":"Planning, managing and monitoring building work so it complies (as PC or Contractor)","kind":"policy","cas":false,"roles":["contractor"],"refs":{"cl_building_safety":10009,"cl_bsa_building_safety":10009,"constructionline":["10009"]},"fresh":"Dated within last 12 months","site":"Site inspection reports showing monitoring"},{"id":"BS-07","area":"Building Safety Act","text":"Giving other duty holders information about building work carried out as Contractor","kind":"record","cas":true,"roles":["contractor"],"refs":{"cl_building_safety":[10007,10008],"cl_bsa_building_safety":[10007,10008],"constructionline":["10007","10008"]},"fresh":"Dated within last 12 months"},{"id":"BS-08","area":"Building Safety Act","text":"Works on higher-risk buildings?","kind":"declaration","cas":true,"roles":["contractor","designer"],"refs":{"cl_building_safety":9955,"cl_bsa_building_safety":9955,"cl_bsa_hrb_decl":10452,"constructionline":["10452","9955"]}},{"id":"BS-09","area":"Building Safety Act","text":"Five-year declarations: compliance or stop notices, convictions (HSWA, BSA, Building Act, Fire Safety Order), inquiry findings","kind":"declaration","cas":true,"roles":["contractor","designer"],"refs":{"cl_bsa_hrb_infractions":[7387,7389,7391,7393],"constructionline":["7387","7389","7391","7393"]}},{"id":"BS-10","area":"Building Safety Act","text":"Communicating technical information to non-technical audiences in accessible formats","kind":"policy","cas":true,"roles":["contractor","designer"],"refs":{"cl_bsa_fire":[7382,7383],"constructionline":["7382","7383"]},"fresh":"Dated within last 12 months"},{"id":"BS-11","area":"Building Safety Act","text":"Documented arrangements to assess and manage fire risk on projects and sites","kind":"policy","cas":true,"roles":["contractor","designer"],"refs":{"cl_bsa_fire":[7367,7368],"constructionline":["7367","7368"]},"fresh":"Dated within last 12 months","site":"Fire precautions, hot works, solvents and fire spread checked at inspection"},{"id":"BS-12","area":"Building Safety Act","text":"Examples of preventative fire safety training received by employees and subcontractors","kind":"certificate","cas":false,"roles":["contractor","designer"],"refs":{"cl_bsa_fire":7369,"constructionline":["7369"]},"fresh":"In date"},{"id":"BS-13","area":"Building Safety Act","text":"Scope questions: affects structure or fixings, fire strategies or systems, alteration of existing buildings","kind":"declaration","cas":false,"roles":["contractor","designer"],"refs":{"cl_bsa_fire":[7372,10441,10444],"constructionline":["7372","10441","10444"]}},{"id":"GV-01","area":"Governance","text":"Anti-bribery and corruption policy, how it is communicated, and evidence","kind":"policy","cas":true,"roles":["contractor","designer"],"refs":{"cl_crg":[7352,119,7353,121,122],"constructionline":["7352","119","7353","121","122"]},"fresh":"Signed and dated by a director within last 12 months"},{"id":"GV-02","area":"Governance","text":"Whistleblowing policy, how it is communicated, and evidence","kind":"policy","cas":true,"roles":["contractor","designer"],"refs":{"cl_crg":[7348,1626,10429,10430,10431],"constructionline":["7348","1626","10429","10430","10431"]},"fresh":"Signed and dated by a director within last 12 months"},{"id":"GV-03","area":"Governance","text":"Fraud prevention procedures (Economic Crime and Corporate Transparency Act)","kind":"policy","cas":false,"roles":["contractor","designer"],"refs":{"cl_crg":[13110,13111],"constructionline":["13110","13111"]},"fresh":"Dated within last 12 months"},{"id":"GV-04","area":"Governance","text":"Arrangements to prevent facilitation of tax evasion (Criminal Finances Act)","kind":"policy","cas":true,"roles":["contractor","designer"],"refs":{"cl_crg":[9807,2391],"constructionline":["9807","2391"]},"fresh":"Dated within last 12 months"},{"id":"GV-05","area":"Governance","text":"Right to work checks","kind":"policy","cas":false,"roles":["contractor","designer"],"refs":{"cl_crg":2392,"constructionline":["2392"]},"fresh":"Dated within last 12 months"},{"id":"GV-06","area":"Governance","text":"ESG policy","kind":"policy","cas":false,"roles":["contractor","designer"],"refs":{"cl_crg":[2394,2395],"constructionline":["2394","2395"]},"fresh":"Dated within last 12 months"},{"id":"GV-07","area":"Governance","text":"Modern slavery statement, how it is communicated, supply chain arrangements","kind":"policy","cas":false,"roles":["contractor","designer"],"refs":{"cl_crg":[13112,6847,13113,13114,13115,2398,2399],"constructionline":["13112","2398","6847","13113","13114","13115","2399"]},"fresh":"Dated within last 12 months"},{"id":"GV-08","area":"Governance","text":"Pays at least NMW/NLW; pays real Living Wage?","kind":"declaration","cas":true,"roles":["contractor","designer"],"refs":{"cl_crg":[2400,9831],"constructionline":["2400","9831"]}},{"id":"GV-09","area":"Governance","text":"Anti-bullying and harassment policy and arrangements","kind":"policy","cas":false,"roles":["contractor","designer"],"refs":{"cl_crg":[9832,9833,9834],"constructionline":["9832","9833","9834"]},"fresh":"Dated within last 12 months","notes":"MVL uploaded the anti-bribery policy here by mistake; assessor flagged it."},{"id":"GV-10","area":"Governance","text":"Prevention of sexual harassment (Worker Protection Act)","kind":"policy","cas":true,"roles":["contractor","designer"],"refs":{"cl_crg":[13116,13117],"constructionline":["13116","13117"]},"fresh":"Dated within last 12 months"},{"id":"GV-11","area":"Governance","text":"Sanctions, gender pay gap and corporate governance statement declarations","kind":"declaration","cas":true,"roles":["contractor","designer"],"refs":{"cl_crg":[3626,2403,3613],"constructionline":["2403","3613","3626"]}},{"id":"GV-12","area":"Governance","text":"Declarations: debarment list, Procurement Act Schedule 6 and 7 exclusions, blacklisting, tax avoidance, trade body suspension, public officials, competition law","kind":"declaration","cas":true,"roles":["contractor","designer"],"refs":{"cl_cps":[10400,13096,13103],"cl_ecps":[1602,1605,1608,1611,9808,1621,1627,1629],"constructionline":["1602","1605","1608","1611","9808","1621","1627","1629","10400","13096","13103"]}},{"id":"GV-13","area":"Governance","text":"Fair Payment Code","kind":"declaration","cas":false,"roles":["contractor","designer"],"refs":{"cl_efi":13094,"constructionline":["13094"]},"notes":"Advisory fail if No."},{"id":"IS-01","area":"Information security","text":"Cyber Essentials Plus or ISO 27001; cyber security policy","kind":"policy","cas":false,"roles":["contractor","designer"],"refs":{"cl_infosec":[7342,7341,3611],"constructionline":["7342","7341","3611"]},"fresh":"Signed and dated by a director within last 12 months","notes":"Advisory fail when policy not signed and dated by a director in last 12 months."},{"id":"IS-02","area":"Information security","text":"Data protection policy and privacy notice, processing records, DPIA, rights requests, responsible person","kind":"policy","cas":true,"roles":["contractor","designer"],"refs":{"cl_infosec":[3610,2256,173,174,175,176],"constructionline":["3610","2256","173","174","175","176"]},"fresh":"Dated within last 12 months"},{"id":"IS-03","area":"Information security","text":"Suppliers' and subcontractors' cyber and data protection arrangements","kind":"record","cas":false,"roles":["contractor","designer"],"refs":{"cl_infosec":[7343,3612,9810],"constructionline":["7343","9810","3612"]},"fresh":"Dated within last 12 months"},{"id":"EN-01","area":"Environment","text":"ISO 14001/EMAS, or an environmental management policy","kind":"policy","cas":true,"roles":["contractor","designer"],"refs":{"cl_env":[13122,9815,9816],"constructionline":["13122","9815","9816"]},"fresh":"Dated within last 12 months"},{"id":"EN-02","area":"Environment","text":"Environmental arrangements: effectiveness, workforce training, check and review, subcontractors","kind":"policy","cas":false,"roles":["contractor","designer"],"refs":{"cl_env":[2264,2265,2266,2267,2268,2269,2270,2271],"constructionline":["2266","2268","2270","2264","2267","2269","2271","2265"]},"fresh":"Dated within last 12 months","site":"Waste, spill and environmental controls checked at inspection"},{"id":"EN-03","area":"Environment","text":"Competent environmental advice with two examples of advice and action in last 12 months","kind":"record","cas":false,"roles":["contractor","designer"],"refs":{"cl_env":[2272,10000,10001,10002],"constructionline":["2272","10000","10001","10002"]},"fresh":"Dated within last 12 months"},{"id":"EN-04","area":"Environment","text":"Waste carrier licence","kind":"certificate","cas":false,"roles":["contractor","designer"],"refs":{"cl_env":[10003,241,10004,243,244],"constructionline":["10003","241","10004","243","244"]},"fresh":"In date"},{"id":"EN-05","area":"Environment","text":"SECR, carbon reduction plan, sustainability standards, net zero, emissions monitoring","kind":"policy","cas":false,"roles":["contractor","designer"],"refs":{"cl_env":[2273,3617,2275],"cl_env_sust":[2699,2701,2702,2703,2706,2707,2708,2709,2711,2712,2713,2714,2453,2454,2715,2717],"constructionline":["2699","2701","2702","2703","2706","2709","2711","2712","2713","2453","2454","2715","2717","2273","3617","2275","2707","2708","2714"]},"notes":"Carbon reduction plan is an advisory fail if N/A."},{"id":"FR-01","area":"Fairness and inclusion","text":"Fairness, Inclusion and Respect policy, how it is communicated, evidence, embedding, inclusive recruitment","kind":"policy","cas":true,"roles":["contractor","designer"],"refs":{"cl_fir":[13118,2261,13119,13120,9811,9812,9813,9814],"constructionline":["13118","2261","13119","13120","9811","9813","9814","9812"]},"fresh":"Dated within last 12 months"},{"id":"FR-02","area":"Fairness and inclusion","text":"Three-year declarations: discrimination findings, EHRC action, immigration and NMW breaches","kind":"declaration","cas":false,"roles":["contractor","designer"],"refs":{"cl_fir":[191,194,197,200,203],"constructionline":["191","194","197","200","203"]}}],"extras":[{"id":"CL-3373","scheme":"constructionline","ref":"3373","type":"Drop Down","text":"Please select the Health and Safety question set applicable to your company.","sections":["Health and Safety"],"sets":["designer"],"fact":"qset"},{"id":"CL-384","scheme":"constructionline","ref":"384","type":"Number","text":"Company Address Details\nRegistration Number","sections":["Health and Safety","Once For All Health & Safety - (SSIP)"],"sets":["designer","contractor"],"fact":"companyNo"},{"id":"CL-339","scheme":"constructionline","ref":"339","type":"Text","text":"Please provide your Trade Name.","sections":["Health and Safety","Once For All Health & Safety - (SSIP)","Company and Financial Information"],"sets":["designer","contractor"],"fact":"tradeName"},{"id":"CL-2308","scheme":"constructionline","ref":"2308","type":"Text","text":"Please provide your Legal Entity Name.","sections":["Health and Safety","Once For All Health & Safety - (SSIP)","Company and Financial Information"],"sets":["designer","contractor"],"fact":"legalName"},{"id":"CL-387","scheme":"constructionline","ref":"387","type":"Text","text":"Address Line 1","sections":["Health and Safety","Once For All Health & Safety - (SSIP)"],"sets":["designer","contractor"],"fact":"hsAddress"},{"id":"CL-388","scheme":"constructionline","ref":"388","type":"Text","text":"Address Line 2","sections":["Health and Safety","Once For All Health & Safety - (SSIP)"],"sets":["designer","contractor"],"fact":"hsAddress"},{"id":"CL-389","scheme":"constructionline","ref":"389","type":"Text","text":"Address Line 3","sections":["Health and Safety","Once For All Health & Safety - (SSIP)"],"sets":["designer","contractor"],"fact":"hsAddress"},{"id":"CL-390","scheme":"constructionline","ref":"390","type":"Text","text":"Address Line 4","sections":["Health and Safety","Once For All Health & Safety - (SSIP)"],"sets":["designer","contractor"],"fact":"hsAddress"},{"id":"CL-391","scheme":"constructionline","ref":"391","type":"Text","text":"Town","sections":["Health and Safety","Once For All Health & Safety - (SSIP)"],"sets":["designer","contractor"],"fact":"hsAddress"},{"id":"CL-392","scheme":"constructionline","ref":"392","type":"Text","text":"County","sections":["Health and Safety","Once For All Health & Safety - (SSIP)"],"sets":["designer","contractor"],"fact":"hsAddress"},{"id":"CL-393","scheme":"constructionline","ref":"393","type":"Text","text":"Postcode","sections":["Health and Safety","Once For All Health & Safety - (SSIP)"],"sets":["designer","contractor"],"fact":"hsAddress"},{"id":"CL-394","scheme":"constructionline","ref":"394","type":"Text","text":"Website","sections":["Health and Safety","Once For All Health & Safety - (SSIP)"],"sets":["designer","contractor"]},{"id":"CL-395","scheme":"constructionline","ref":"395","type":"Drop Down","text":"Contact Details\nTitle","sections":["Health and Safety","Once For All Health & Safety - (SSIP)"],"sets":["designer","contractor"]},{"id":"CL-396","scheme":"constructionline","ref":"396","type":"Text","text":"Forename","sections":["Health and Safety","Once For All Health & Safety - (SSIP)"],"sets":["designer","contractor"]},{"id":"CL-397","scheme":"constructionline","ref":"397","type":"Text","text":"Surname","sections":["Health and Safety","Once For All Health & Safety - (SSIP)"],"sets":["designer","contractor"]},{"id":"CL-398","scheme":"constructionline","ref":"398","type":"Text","text":"Telephone number","sections":["Health and Safety","Once For All Health & Safety - (SSIP)"],"sets":["designer","contractor"]},{"id":"CL-399","scheme":"constructionline","ref":"399","type":"Email","text":"Email","sections":["Health and Safety","Once For All Health & Safety - (SSIP)"],"sets":["designer","contractor"]},{"id":"CL-400","scheme":"constructionline","ref":"400","type":"Multiline Text","text":"Please enter a general description of the work that your company undertakes","sections":["Health and Safety","Once For All Health & Safety - (SSIP)"],"sets":["designer","contractor"]},{"id":"CL-2813","scheme":"constructionline","ref":"2813","type":"Drop Down","text":"Please select the Health and Safety question set applicable to your company.","sections":["Once For All Health & Safety - (SSIP)"],"sets":["designer","contractor"],"fact":"qset"},{"id":"CL-2668","scheme":"constructionline","ref":"2668","type":"Radio Buttons","text":"Is your company more than 50% owned by people or a person who is an ex-member of the armed forces?","sections":["Business Ownership"],"sets":["designer","contractor"]},{"id":"CL-2669","scheme":"constructionline","ref":"2669","type":"Radio Buttons","text":"Is your company more than 50% owned by women or a woman?","sections":["Business Ownership"],"sets":["designer","contractor"]},{"id":"CL-2670","scheme":"constructionline","ref":"2670","type":"Radio Buttons","text":"Is your company more than 50% owned by people or a person from an ethnic minority background?","sections":["Business Ownership"],"sets":["designer","contractor"]},{"id":"CL-2671","scheme":"constructionline","ref":"2671","type":"Radio Buttons","text":"Is your company more than 50% owned by people or a person who identifies as LGBT?","sections":["Business Ownership"],"sets":["designer","contractor"]},{"id":"CL-2672","scheme":"constructionline","ref":"2672","type":"Radio Buttons","text":"Is your company more than 50% owned by people or a person with a disability or long term health condition?","sections":["Business Ownership"],"sets":["designer","contractor"]},{"id":"CL-2646","scheme":"constructionline","ref":"2646","type":"Bool","text":"Is your company a start up, mutual, voluntary, community or charity?","sections":["Social Value"],"sets":["designer","contractor"]},{"id":"CL-2647","scheme":"constructionline","ref":"2647","type":"Bool","text":"Does your company report on Social Value?","sections":["Social Value"],"sets":["designer","contractor"]},{"id":"CL-2648","scheme":"constructionline","ref":"2648","type":"Multiline Text","text":"Please provide details.","sections":["Social Value"],"sets":["designer"]},{"id":"CL-2649","scheme":"constructionline","ref":"2649","type":"Bool","text":"Does your company have an EDI policy? (Equality, Diversity and Inclusion.)","sections":["Social Value"],"sets":["designer","contractor"]},{"id":"CL-2650","scheme":"constructionline","ref":"2650","type":"Upload","text":"Please provide a copy of your policy.","sections":["Social Value"],"sets":["designer","contractor"]},{"id":"CL-2651","scheme":"constructionline","ref":"2651","type":"Multiline Text","text":"Please explain the impact your EDI policy has had on your company.","sections":["Social Value"],"sets":["designer","contractor"]},{"id":"CL-2652","scheme":"constructionline","ref":"2652","type":"Multiline Text","text":"Please explain how your EDI policy has impacted recruitment within your company.","sections":["Social Value"],"sets":["designer","contractor"]},{"id":"CL-2653","scheme":"constructionline","ref":"2653","type":"Multiline Text","text":"Please explain how your EDI policy has influenced the diversity of your workforce. If applicable, please include an example.","sections":["Social Value"],"sets":["designer","contractor"]},{"id":"CL-2654","scheme":"constructionline","ref":"2654","type":"Multiselect","text":"Which of the following groups do you consider when recruiting for roles within the company:","sections":["Social Value"],"sets":["designer","contractor"]},{"id":"CL-2655","scheme":"constructionline","ref":"2655","type":"Bool","text":"Does your company engage in work experience placements?","sections":["Social Value"],"sets":["designer","contractor"]},{"id":"CL-2657","scheme":"constructionline","ref":"2657","type":"Bool","text":"Do you ensure that your supply chain meets the requirement of the positive equality duties in relation to the Equality Act 2010?","sections":["Social Value"],"sets":["designer","contractor"]},{"id":"CL-2816","scheme":"constructionline","ref":"2816","type":"Multiline Text","text":"Please provide examples of how you achieve supply chain resilience when delivering contracts (e.g. working with a diverse range of businesses or managing cyber security risks)","sections":["Social Value"],"sets":["designer","contractor"]},{"id":"CL-2659","scheme":"constructionline","ref":"2659","type":"Multiselect","text":"Please indicate which of the following company types you work with:","sections":["Social Value"],"sets":["designer","contractor"]},{"id":"CL-2660","scheme":"constructionline","ref":"2660","type":"Bool","text":"Does your company engage in an apprenticeship programme?","sections":["Social Value"],"sets":["designer","contractor"]},{"id":"CL-2667","scheme":"constructionline","ref":"2667","type":"Bool","text":"Is your organisation a member of the 5% club?","sections":["Social Value"],"sets":["designer","contractor"]},{"id":"CL-2644","scheme":"constructionline","ref":"2644","type":"Bool","text":"Does your company pay national living wage or above, to all of your employees?","sections":["Working Conditions"],"sets":["designer","contractor"]},{"id":"CL-2673","scheme":"constructionline","ref":"2673","type":"Bool","text":"Does your organisation pay local national living wage?","sections":["Working Conditions"],"sets":["designer","contractor"]},{"id":"CL-2675","scheme":"constructionline","ref":"2675","type":"Bool","text":"Do you adhere to the Working Time Regulations 1998?","sections":["Working Conditions"],"sets":["designer","contractor"]},{"id":"CL-2676","scheme":"constructionline","ref":"2676","type":"Bool","text":"Are any of your employees on zero hour contracts?","sections":["Working Conditions"],"sets":["designer","contractor"]},{"id":"CL-2678","scheme":"constructionline","ref":"2678","type":"Bool","text":"Do you subscribe to and apply the terms of the CIJC Working Rule Agreement?","sections":["Working Conditions"],"sets":["designer","contractor"]},{"id":"CL-2679","scheme":"constructionline","ref":"2679","type":"Bool","text":"Can you provide your company's mean gender pay gap?","sections":["Working Conditions"],"sets":["designer","contractor"]},{"id":"CL-2681","scheme":"constructionline","ref":"2681","type":"Bool","text":"Can you provide details of your median gender pay gap?","sections":["Working Conditions"],"sets":["designer","contractor"]},{"id":"CL-2683","scheme":"constructionline","ref":"2683","type":"Bool","text":"Has your company committed to the five foundational principles of good work?","sections":["Working Conditions"],"sets":["designer","contractor"]},{"id":"CL-2684","scheme":"constructionline","ref":"2684","type":"Number","text":"Please state the number of employees on PAYE.","sections":["Working Conditions"],"sets":["designer","contractor"],"fact":"paye"},{"id":"CL-2138","scheme":"constructionline","ref":"2138","type":"Bool","text":"Does your company hold Cyber Essentials Certification?","sections":["Memberships & Accreditations"],"sets":["designer","contractor"]},{"id":"CL-2718","scheme":"constructionline","ref":"2718","type":"Bool","text":"Has your company adopted the National Cyber Security Centres 10 steps?","sections":["Memberships & Accreditations"],"sets":["designer","contractor"]},{"id":"CL-2719","scheme":"constructionline","ref":"2719","type":"Bool","text":"Is your company a TrustMark registered business?","sections":["Memberships & Accreditations"],"sets":["designer","contractor"]},{"id":"CL-2720","scheme":"constructionline","ref":"2720","type":"Bool","text":"Is your company a member of the Considerate Constructors Scheme?","sections":["Memberships & Accreditations"],"sets":["designer","contractor"]},{"id":"CL-2721","scheme":"constructionline","ref":"2721","type":"Bool","text":"Is your company a member of the Supply Chain Sustainability School?","sections":["Memberships & Accreditations"],"sets":["designer","contractor"]},{"id":"CL-9964","scheme":"constructionline","ref":"9964","type":"Bool","text":"Does your company have arrangements in place to collect, store, organise, update and share information with other duty holders to help create a Golden Thread of Information for a Higher-Risk Building?","sections":["Building Safety Act - Building Safety","Building Safety"],"sets":["designer"],"bsa":true},{"id":"CL-9969","scheme":"constructionline","ref":"9969","type":"Multiline Text","text":"Please provide an explanation detailing the arrangements you have in place to collect, store, organise, update and share information with other duty holders to help create a Golden Thread of Information for a Higher-Risk Building.","sections":["Building Safety Act - Building Safety","Building Safety"],"sets":["designer"],"bsa":true},{"id":"CL-9965","scheme":"constructionline","ref":"9965","type":"Bool","text":"Does your company have arrangements in place to provide the Client and other duty holders with the appropriate information to update the change control log when changes are made during the design, construction or occupation stages of a Higher-Risk Building?","sections":["Building Safety Act - Building Safety","Building Safety"],"sets":["designer"],"bsa":true},{"id":"CL-9970","scheme":"constructionline","ref":"9970","type":"Multiline Text","text":"Please provide an explanation detailing the arrangements you have in place to provide the Client and other duty holders with the appropriate information to update the change control log when changes are made during the design, construction or occupation stages of a Higher-Risk Building.","sections":["Building Safety Act - Building Safety","Building Safety"],"sets":["designer"],"bsa":true},{"id":"CL-9985","scheme":"constructionline","ref":"9985","type":"Upload","text":"Please provide the arrangements you have in place to plan, manage and monitor the design work you undertake to ensure the work complies with relevant requirements (e.g. Building Safety Act, Building Regulations, other legislation and industry standards), in your duty holder role as a Principal Designer and/or Designer.","sections":["Building Safety Act - Building Safety","Building Safety"],"sets":["designer"],"bsa":true},{"id":"CL-9989","scheme":"constructionline","ref":"9989","type":"Bool","text":"Does your company have arrangements in place to plan, manage and monitor design work during the design phase and to coordinate matters relating to design work during a project to ensure any building work is compliant with relevant requirements, in your role as Designer and/or Principal Designer?","sections":["Building Safety Act - Building Safety","Building Safety"],"sets":["designer"],"bsa":true},{"id":"CL-9990","scheme":"constructionline","ref":"9990","type":"Upload","text":"Please provide the arrangements you have in place to plan, manage and monitor design work during the design phase and to coordinate matters relating to design work during a project to ensure any building work is compliant with relevant requirements in your role as Designer and/or Principal Designer (e.g. Building Safety Act, Building Regulations, other legislation and industry standards).","sections":["Building Safety Act - Building Safety","Building Safety"],"sets":["designer"],"bsa":true},{"id":"CL-9991","scheme":"constructionline","ref":"9991","type":"Bool","text":"Does your company have arrangements in place to ensure that products specified and used as part of the design phase are suitably assessed and classified for durability, location and product performance as part of a holistic system and comply with relevant requirements, in your role as Designer and/or Principal Designer?","sections":["Building Safety Act - Building Safety","Building Safety"],"sets":["designer"],"bsa":true},{"id":"CL-9992","scheme":"constructionline","ref":"9992","type":"Upload","text":"Please provide the arrangements you have in place to ensure that products specified and used as part of the design phase are suitably assessed and classified for durability, location and product performance as part of a holistic system and comply with relevant requirements, in your role as Designer and/or Principal Designer (e.g. Building Safety Act, Building Regulations, other legislation and industry standards).","sections":["Building Safety Act - Building Safety","Building Safety"],"sets":["designer"],"bsa":true},{"id":"CL-9993","scheme":"constructionline","ref":"9993","type":"Bool","text":"Does your company have arrangements in place to provide other duty holders with relevant information about the design, construction and maintenance of the building, in your role as Designer?","sections":["Building Safety Act - Building Safety","Building Safety"],"sets":["designer"],"bsa":true},{"id":"CL-9994","scheme":"constructionline","ref":"9994","type":"Upload","text":"Please provide the arrangements you have in place to provide other duty holders with relevant information about the design, construction and maintenance of the building, in your role as Designer.","sections":["Building Safety Act - Building Safety","Building Safety"],"sets":["designer"],"bsa":true},{"id":"CL-9995","scheme":"constructionline","ref":"9995","type":"Upload","text":"Please provide the arrangements you have in place to coordinate with the Principal Designer to report breaches or concerns with building work adhering to relevant requirements when working on a Higher-Risk Building, in your role as Designer.","sections":["Building Safety Act - Building Safety","Building Safety"],"sets":["designer"],"bsa":true},{"id":"CL-291","scheme":"constructionline","ref":"291","type":"Drop Down","text":"Title (Mr, Mrs, Ms etc)","sections":["Primary Contact"],"sets":["designer","contractor"]},{"id":"CL-292","scheme":"constructionline","ref":"292","type":"Text","text":"Forename","sections":["Primary Contact"],"sets":["designer","contractor"]},{"id":"CL-293","scheme":"constructionline","ref":"293","type":"Text","text":"Family name","sections":["Primary Contact"],"sets":["designer","contractor"]},{"id":"CL-294","scheme":"constructionline","ref":"294","type":"Drop Down","text":"Job title","sections":["Primary Contact"],"sets":["designer","contractor"]},{"id":"CL-295","scheme":"constructionline","ref":"295","type":"Text","text":"Telephone number","sections":["Primary Contact"],"sets":["designer","contractor"]},{"id":"CL-296","scheme":"constructionline","ref":"296","type":"Text","text":"Mobile","sections":["Primary Contact"],"sets":["designer","contractor"]},{"id":"CL-297","scheme":"constructionline","ref":"297","type":"Text","text":"Fax number","sections":["Primary Contact"],"sets":["designer","contractor"]},{"id":"CL-298","scheme":"constructionline","ref":"298","type":"Email","text":"E-mail","sections":["Primary Contact"],"sets":["designer","contractor"]},{"id":"CL-299","scheme":"constructionline","ref":"299","type":"Bool","text":"Is your head office your registered office?\n(Your registered office is the address submitted on your company accounts. If you are not registered with Companies House simply select 'Yes')","sections":["Registered Office"],"sets":["designer","contractor"],"fact":"regIsHead"},{"id":"CL-300","scheme":"constructionline","ref":"300","type":"Text","text":"Office name","sections":["Registered Office"],"sets":["designer"]},{"id":"CL-301","scheme":"constructionline","ref":"301","type":"Text","text":"Address line 1 (Property name / number)","sections":["Registered Office"],"sets":["designer"],"fact":"regOffice"},{"id":"CL-302","scheme":"constructionline","ref":"302","type":"Text","text":"Address line 2","sections":["Registered Office"],"sets":["designer"],"fact":"regOffice"},{"id":"CL-303","scheme":"constructionline","ref":"303","type":"Text","text":"Address line 3","sections":["Registered Office"],"sets":["designer"],"fact":"regOffice"},{"id":"CL-304","scheme":"constructionline","ref":"304","type":"Text","text":"Address line 4","sections":["Registered Office"],"sets":["designer"],"fact":"regOffice"},{"id":"CL-305","scheme":"constructionline","ref":"305","type":"Text","text":"Town","sections":["Registered Office"],"sets":["designer"],"fact":"regOffice"},{"id":"CL-306","scheme":"constructionline","ref":"306","type":"Text","text":"County","sections":["Registered Office"],"sets":["designer"],"fact":"regOffice"},{"id":"CL-307","scheme":"constructionline","ref":"307","type":"Text","text":"Postcode","sections":["Registered Office"],"sets":["designer"],"fact":"regOffice"},{"id":"CL-308","scheme":"constructionline","ref":"308","type":"Drop Down","text":"Country","sections":["Registered Office"],"sets":["designer"]},{"id":"CL-318","scheme":"constructionline","ref":"318","type":"Text","text":"Office name","sections":["Head Office"],"sets":["designer","contractor"]},{"id":"CL-319","scheme":"constructionline","ref":"319","type":"Text","text":"Head Office Address Line 1","sections":["Head Office"],"sets":["designer","contractor"],"fact":"headOffice"},{"id":"CL-320","scheme":"constructionline","ref":"320","type":"Text","text":"Address line 2","sections":["Head Office"],"sets":["designer","contractor"],"fact":"headOffice"},{"id":"CL-321","scheme":"constructionline","ref":"321","type":"Text","text":"Address line 3","sections":["Head Office"],"sets":["designer","contractor"],"fact":"headOffice"},{"id":"CL-322","scheme":"constructionline","ref":"322","type":"Text","text":"Address line 4","sections":["Head Office"],"sets":["designer","contractor"],"fact":"headOffice"},{"id":"CL-323","scheme":"constructionline","ref":"323","type":"Text","text":"Town","sections":["Head Office"],"sets":["designer","contractor"],"fact":"headOffice"},{"id":"CL-324","scheme":"constructionline","ref":"324","type":"Text","text":"County","sections":["Head Office"],"sets":["designer","contractor"],"fact":"headOffice"},{"id":"CL-325","scheme":"constructionline","ref":"325","type":"Text","text":"Postcode","sections":["Head Office"],"sets":["designer","contractor"],"fact":"headOffice"},{"id":"CL-326","scheme":"constructionline","ref":"326","type":"Drop Down","text":"Country","sections":["Head Office"],"sets":["designer","contractor"]},{"id":"CL-327","scheme":"constructionline","ref":"327","type":"Text","text":"Telephone number","sections":["Head Office"],"sets":["designer","contractor"]},{"id":"CL-328","scheme":"constructionline","ref":"328","type":"Text","text":"Fax number","sections":["Head Office"],"sets":["designer","contractor"]},{"id":"CL-329","scheme":"constructionline","ref":"329","type":"Website","text":"Website","sections":["Head Office"],"sets":["designer","contractor"]},{"id":"CL-17","scheme":"constructionline","ref":"17","type":"Bool","text":"Do you have any Branch offices?","sections":["Branch Office"],"sets":["designer","contractor"]},{"id":"CL-18","scheme":"constructionline","ref":"18","type":"BranchOffices","text":"Branch Office and Contacts","sections":["Branch Office"],"sets":["designer"]},{"id":"CL-331","scheme":"constructionline","ref":"331","type":"Bool","text":"Do you have any related or associated companies?","sections":["Related Companies"],"sets":["designer","contractor"]},{"id":"CL-333","scheme":"constructionline","ref":"333","type":"AreaOfOperation","text":"Please add the details of your areas of operation.","sections":["Areas of Operation"],"sets":["designer","contractor"]},{"id":"CL-1493","scheme":"constructionline","ref":"1493","type":"Text","text":"Please provide your principal bankers address\n\nName of bank","sections":["Enhanced Financial Information"],"sets":["designer","contractor"]},{"id":"CL-1494","scheme":"constructionline","ref":"1494","type":"Text","text":"Address Line 1","sections":["Enhanced Financial Information"],"sets":["designer","contractor"]},{"id":"CL-1495","scheme":"constructionline","ref":"1495","type":"Text","text":"Address Line 2","sections":["Enhanced Financial Information"],"sets":["designer","contractor"]},{"id":"CL-1496","scheme":"constructionline","ref":"1496","type":"Text","text":"Address Line 3","sections":["Enhanced Financial Information"],"sets":["designer","contractor"]},{"id":"CL-1497","scheme":"constructionline","ref":"1497","type":"Text","text":"Address Line 4","sections":["Enhanced Financial Information"],"sets":["designer","contractor"]},{"id":"CL-1498","scheme":"constructionline","ref":"1498","type":"Text","text":"Town","sections":["Enhanced Financial Information"],"sets":["designer","contractor"]},{"id":"CL-1499","scheme":"constructionline","ref":"1499","type":"Text","text":"County","sections":["Enhanced Financial Information"],"sets":["designer","contractor"]},{"id":"CL-1500","scheme":"constructionline","ref":"1500","type":"Text","text":"Postcode","sections":["Enhanced Financial Information"],"sets":["designer","contractor"]},{"id":"CL-1501","scheme":"constructionline","ref":"1501","type":"Drop Down","text":"Country","sections":["Enhanced Financial Information"],"sets":["designer","contractor"]},{"id":"CL-9805","scheme":"constructionline","ref":"9805","type":"Bool","text":"Are you legally required to report under the Reporting on Payment Practices and Performance Regulations?","sections":["Enhanced Financial Information"],"sets":["designer","contractor"]},{"id":"CL-309","scheme":"constructionline","ref":"309","type":"Bool","text":"Is the primary contact also the contact for business and/or pre-qualification enquiries?","sections":["Enquiry Contact"],"sets":["designer","contractor"]},{"id":"CL-310","scheme":"constructionline","ref":"310","type":"Drop Down","text":"Title","sections":["Enquiry Contact"],"sets":["designer"]},{"id":"CL-311","scheme":"constructionline","ref":"311","type":"Text","text":"Forename","sections":["Enquiry Contact"],"sets":["designer"]},{"id":"CL-312","scheme":"constructionline","ref":"312","type":"Text","text":"Surname","sections":["Enquiry Contact"],"sets":["designer"]},{"id":"CL-313","scheme":"constructionline","ref":"313","type":"Drop Down","text":"Job title","sections":["Enquiry Contact"],"sets":["designer"]},{"id":"CL-314","scheme":"constructionline","ref":"314","type":"Text","text":"Telephone number","sections":["Enquiry Contact"],"sets":["designer"]},{"id":"CL-315","scheme":"constructionline","ref":"315","type":"Text","text":"Mobile","sections":["Enquiry Contact"],"sets":["designer"]},{"id":"CL-316","scheme":"constructionline","ref":"316","type":"Text","text":"Fax number","sections":["Enquiry Contact"],"sets":["designer"]},{"id":"CL-317","scheme":"constructionline","ref":"317","type":"Email","text":"E-mail","sections":["Enquiry Contact"],"sets":["designer"]},{"id":"CL-3635","scheme":"constructionline","ref":"3635","type":"Bool","text":"Are there any other contacts for New Business?","sections":["Enquiry Contact"],"sets":["designer","contractor"]},{"id":"CL-3636","scheme":"constructionline","ref":"3636","type":"Bool","text":"Is the Supply Chain Manager the same as the Enquiry Contact?","sections":["Enquiry Contact"],"sets":["designer","contractor"]},{"id":"CL-9802","scheme":"constructionline","ref":"9802","type":"Bool","text":"Are you registered, based, and active in the UK, Channel Islands or Republic of Ireland?","sections":["Enhanced Company Information"],"sets":["designer","contractor"]},{"id":"CL-1490","scheme":"constructionline","ref":"1490","type":"Radio Buttons","text":"Do you have any associated or group companies?","sections":["Enhanced Company Information"],"sets":["designer","contractor"]},{"id":"CL-10399","scheme":"constructionline","ref":"10399","type":"Radio Buttons","text":"Are you registered with Companies House?","sections":["Company and Financial Information"],"sets":["designer","contractor"]},{"id":"CL-347","scheme":"constructionline","ref":"347","type":"Text","text":"Please provide your Companies House number.","sections":["Company and Financial Information"],"sets":["designer","contractor"],"fact":"companyNo"},{"id":"CL-348","scheme":"constructionline","ref":"348","type":"Radio Buttons","text":"Are you registered with a national equivalent to Companies House?","sections":["Company and Financial Information"],"sets":["designer","contractor"]},{"id":"CL-337","scheme":"constructionline","ref":"337","type":"Drop Down","text":"Please select your Supplier Type.","sections":["Company and Financial Information"],"sets":["designer","contractor"]},{"id":"CL-9800","scheme":"constructionline","ref":"9800","type":"Drop Down","text":"Please select your Organisation Type.","sections":["Company and Financial Information"],"sets":["designer","contractor"]},{"id":"CL-343","scheme":"constructionline","ref":"343","type":"Date","text":"Please select your incorporation date.","sections":["Company and Financial Information"],"sets":["designer","contractor"]},{"id":"CL-341","scheme":"constructionline","ref":"341","type":"Date","text":"Please select the date your organisation was set up.","sections":["Company and Financial Information"],"sets":["designer","contractor"]},{"id":"CL-350","scheme":"constructionline","ref":"350","type":"Radio Buttons","text":"Are you a registered charity?","sections":["Company and Financial Information"],"sets":["designer","contractor"]},{"id":"CL-330","scheme":"constructionline","ref":"330","type":"DirectorsPartners","text":"Please add the details of the following individuals associated with your organisation:\n\nProprietors\nPartners\nDirectors\nCompany Secretary","sections":["Company and Financial Information"],"sets":["designer","contractor"],"fact":"directors"},{"id":"CL-1971","scheme":"constructionline","ref":"1971","type":"FinancialAccounts","text":"Please add the details of your financial accounts.","sections":["Company and Financial Information"],"sets":["designer","contractor"]},{"id":"CL-3603","scheme":"constructionline","ref":"3603","type":"Number","text":"Please provide the total number of your direct employees (PAYE).","sections":["Company and Financial Information"],"sets":["designer","contractor"],"fact":"paye"},{"id":"CL-3604","scheme":"constructionline","ref":"3604","type":"Number","text":"Please provide the total number of your indirect personnel (non-PAYE).","sections":["Company and Financial Information"],"sets":["designer","contractor"]},{"id":"CL-2307","scheme":"constructionline","ref":"2307","type":"Number","text":"Please provide the total number of your workforce.","sections":["Company and Financial Information"],"sets":["designer","contractor"]},{"id":"CL-3369","scheme":"constructionline","ref":"3369","type":"Drop Down","text":"Please select your Organisation Size.","sections":["Company and Financial Information"],"sets":["designer","contractor"]},{"id":"CL-344","scheme":"constructionline","ref":"344","type":"Radio Buttons","text":"Do you have a Unique Tax Reference?","sections":["Company and Financial Information"],"sets":["designer","contractor"]},{"id":"CL-345","scheme":"constructionline","ref":"345","type":"Text","text":"Please provide your Unique Tax Reference.","sections":["Company and Financial Information"],"sets":["designer","contractor"]},{"id":"CL-352","scheme":"constructionline","ref":"352","type":"Radio Buttons","text":"Are you registered for VAT?","sections":["Company and Financial Information"],"sets":["designer","contractor"]},{"id":"CL-353","scheme":"constructionline","ref":"353","type":"Text","text":"Please provide your VAT Registration number.","sections":["Company and Financial Information"],"sets":["designer","contractor"]},{"id":"CL-9801","scheme":"constructionline","ref":"9801","type":"Multiline Text","text":"Please detail the percentage of your directly employed workforce that is in Earn and Learn positions.","sections":["Company and Financial Information"],"sets":["designer","contractor"]},{"id":"CL-29","scheme":"constructionline","ref":"29","type":"Bool","text":"Have you ever had any criminal or civil judgements against the organisation, or any of your Directors or Executive Officers in relation to its current business activities?","sections":["Company and Financial Information"],"sets":["designer","contractor"]},{"id":"CL-32","scheme":"constructionline","ref":"32","type":"Bool","text":"Do you have any ongoing or pending criminal or civil actions against the organisation, or any of your Directors or Executive Officers in relation to its current business activities?","sections":["Company and Financial Information"],"sets":["designer","contractor"]},{"id":"CL-35","scheme":"constructionline","ref":"35","type":"Bool","text":"Have you received any enforcement or remedial orders against the organisation, or any of your Directors or Executive Officers in the last 3 years that remain unresolved?","sections":["Company and Financial Information"],"sets":["designer","contractor"]},{"id":"CL-2310","scheme":"constructionline","ref":"2310","type":"Bool","text":"Do you operate as a sheltered workshop, social enterprise or social business or will you provide for the performance of the contract in the context of sheltered employment programmes?","sections":["Company and Financial Information"],"sets":["designer","contractor"]},{"id":"CL-335","scheme":"constructionline","ref":"335","type":"Bool","text":"Do you hold any Trade Association or Professional Body Memberships?","sections":["Company and Financial Information"],"sets":["designer","contractor"]},{"id":"CL-336","scheme":"constructionline","ref":"336","type":"TradeAssociations","text":"Please add your Trade Association or Professional Body Memberships.","sections":["Company and Financial Information"],"sets":["designer","contractor"]},{"id":"CL-25","scheme":"constructionline","ref":"25","type":"Insurance","text":"Please provide details of the insurances your company holds","sections":["Insurances"],"sets":["designer","contractor"],"fact":"insurance"},{"id":"CL-1464","scheme":"constructionline","ref":"1464","type":"Text","text":"Forename","sections":["Health and Safety Third Party / Exemption certificates"],"sets":["designer","contractor"]},{"id":"CL-1465","scheme":"constructionline","ref":"1465","type":"Text","text":"Surname","sections":["Health and Safety Third Party / Exemption certificates"],"sets":["designer","contractor"]},{"id":"CL-1466","scheme":"constructionline","ref":"1466","type":"Drop Down","text":"Position","sections":["Health and Safety Third Party / Exemption certificates"],"sets":["designer","contractor"]},{"id":"CL-1467","scheme":"constructionline","ref":"1467","type":"Text","text":"Telephone number","sections":["Health and Safety Third Party / Exemption certificates"],"sets":["designer","contractor"]},{"id":"CL-1468","scheme":"constructionline","ref":"1468","type":"Text","text":"Mobile","sections":["Health and Safety Third Party / Exemption certificates"],"sets":["designer","contractor"]},{"id":"CL-1469","scheme":"constructionline","ref":"1469","type":"Email","text":"Email","sections":["Health and Safety Third Party / Exemption certificates"],"sets":["designer","contractor"]},{"id":"CL-9830","scheme":"constructionline","ref":"9830","type":"Bool","text":"Do you work on, or intend to work on, any projects with a defined requirement for organised and digitised structured Information Management (IM)?","sections":["Information Management"],"sets":["designer","contractor"]},{"id":"CL-2690","scheme":"constructionline","ref":"2690","type":"Bool","text":"Does your company engage with and support the local community?","sections":["Community Engagement"],"sets":["designer","contractor"]},{"id":"CL-2691","scheme":"constructionline","ref":"2691","type":"Multiline Text","text":"Please detail how you have engaged with and supported your local community within the past 2 years.","sections":["Community Engagement"],"sets":["designer","contractor"]},{"id":"CL-2692","scheme":"constructionline","ref":"2692","type":"Multiline Text","text":"Over the past year, how many people hours were spent supporting local community integration, such as volunteering and other community-led initiatives?","sections":["Community Engagement"],"sets":["designer","contractor"]},{"id":"CL-2693","scheme":"constructionline","ref":"2693","type":"Bool","text":"Does your company support local groups and businesses?","sections":["Community Engagement"],"sets":["designer","contractor"]},{"id":"CL-2694","scheme":"constructionline","ref":"2694","type":"Multiline Text","text":"What initiatives do you have in place to support local groups/businesses?","sections":["Community Engagement"],"sets":["designer","contractor"]},{"id":"CL-2695","scheme":"constructionline","ref":"2695","type":"Multiline Text","text":"Please detail how your organisation has supported local groups and businesses including information relating to spend where applicable.","sections":["Community Engagement"],"sets":["designer","contractor"]},{"id":"CL-2696","scheme":"constructionline","ref":"2696","type":"Drop Down","text":"What percentage of your company's profit was invested back into the community over the past 2 years?","sections":["Community Engagement"],"sets":["designer","contractor"]},{"id":"CL-2697","scheme":"constructionline","ref":"2697","type":"Bool","text":"Do you support companies and businesses to manage and recover from the impacts of COVID-19, including where new ways of working are required to deliver services?","sections":["Community Engagement"],"sets":["designer","contractor"]},{"id":"CL-14563","scheme":"constructionline","ref":"14563","type":"Radio Buttons","text":"Do you confirm that you will comply with the BAM Vendor Code of Conduct?","sections":["BAM - Code of Conduct"],"sets":["contractor"]},{"id":"CL-3362","scheme":"constructionline","ref":"3362","type":"Bool","text":"Do you hold valid BS EN ISO 19650-2 certificate issued by a UKAS (or mutually recognised by UKAS) accredited certification body?","sections":["Information Management"],"sets":["contractor"]},{"id":"CL-3363","scheme":"constructionline","ref":"3363","type":"Bool","text":"If you act, or intend to act, as a Lead Appointed Party, does your company have the resources (people, processes and technologies) to undertake the Lead Appointed Party IM function as defined in BS EN ISO 19650-2?","sections":["Information Management"],"sets":["contractor"]},{"id":"CL-3620","scheme":"constructionline","ref":"3620","type":"Upload","text":"Please upload evidence that you have the resources to undertake the Lead Appointed Part IM function.","sections":["Information Management"],"sets":["contractor"]},{"id":"CL-3364","scheme":"constructionline","ref":"3364","type":"Bool","text":"Do you have arrangements in place to control, authorise, approve, and exchange information compliant with BS EN ISO 19650-2?","sections":["Information Management"],"sets":["contractor"]},{"id":"CL-3621","scheme":"constructionline","ref":"3621","type":"Upload","text":"Please upload arrangements you have in place to control, authorise, approve, and exchange information compliant with BS EN ISO 19650-2.","sections":["Information Management"],"sets":["contractor"]},{"id":"CL-3365","scheme":"constructionline","ref":"3365","type":"Bool","text":"Do you have a team and structure in place to generate, authorise, approve, and exchange information compliant with BS EN ISO 19650-2?","sections":["Information Management"],"sets":["contractor"]},{"id":"CL-3622","scheme":"constructionline","ref":"3622","type":"Upload","text":"Please upload evidence of your overall organisational structure and number of employees identifying those carrying out Information Management delivery.","sections":["Information Management"],"sets":["contractor"]},{"id":"CL-3366","scheme":"constructionline","ref":"3366","type":"Bool","text":"Do you have arrangements in place to provide your workforce with education and training about IM processes and requirements as defined in BS EN ISO 19650-1 and BS EN ISO 19650-2?","sections":["Information Management"],"sets":["contractor"]},{"id":"CL-3623","scheme":"constructionline","ref":"3623","type":"Upload","text":"Please upload your arrangements for implement training to ensure that your workforce has sufficient skills and understanding to carry out their various duties in line with BS EN ISO 19650-1 and BS EN ISO 19650-2.","sections":["Information Management"],"sets":["contractor"]},{"id":"CL-3367","scheme":"constructionline","ref":"3367","type":"Bool","text":"Do you commit to implementing the principles and procedures set out in the UK IM Framework, including BS EN ISO 19650-1 and BS EN ISO 19650-2, within your policies and processes?","sections":["Information Management"],"sets":["contractor"]},{"id":"CL-3624","scheme":"constructionline","ref":"3624","type":"Upload","text":"Please upload arrangements for committing to implement the principles and procedures set out in the UK IM Framework.","sections":["Information Management"],"sets":["contractor"]},{"id":"CL-3368","scheme":"constructionline","ref":"3368","type":"Bool","text":"Do you use the information management processes set out in BS EN ISO 19650-2 to add value to a project and to your business and to deliver benefits for your clients?","sections":["Information Management"],"sets":["contractor"]},{"id":"CL-3625","scheme":"constructionline","ref":"3625","type":"Upload","text":"Please upload two examples that include an explanation of how people, processes and technologies were used to deliver these benefits.","sections":["Information Management"],"sets":["contractor"]},{"id":"CL-2656","scheme":"constructionline","ref":"2656","type":"Number","text":"How many individuals in work experience placements have become full time employees?","sections":["Social Value"],"sets":["contractor"]},{"id":"CL-2661","scheme":"constructionline","ref":"2661","type":"Number","text":"How many of your apprentices found long-term employment within the company?","sections":["Social Value"],"sets":["contractor"]},{"id":"CL-2662","scheme":"constructionline","ref":"2662","type":"Bool","text":"Are you able to provide a case study to demonstrate an employee joining as an apprentice and finding long term employment?","sections":["Social Value"],"sets":["contractor"]},{"id":"CL-2663","scheme":"constructionline","ref":"2663","type":"Bool","text":"Are you an apprentice levy payer?","sections":["Social Value"],"sets":["contractor"]},{"id":"CL-2664","scheme":"constructionline","ref":"2664","type":"Bool","text":"Do you use apprenticeship qualifications to upskill existing staff?","sections":["Social Value"],"sets":["contractor"]},{"id":"CL-2665","scheme":"constructionline","ref":"2665","type":"Drop Down","text":"What is the minimum contract value you would require to take on an apprentice?","sections":["Social Value"],"sets":["contractor"]},{"id":"CL-2698","scheme":"constructionline","ref":"2698","type":"Multiline Text","text":"Please provide details.","sections":["Community Engagement"],"sets":["contractor"]},{"id":"CL-2722","scheme":"constructionline","ref":"2722","type":"Drop Down","text":"What level of membership do you hold?","sections":["Memberships & Accreditations"],"sets":["contractor"]}],"constructionline":{"captured":"2026-10-13","source":"Constructionline question banks read from RSSC (Designer, 418 questions) and MVL (Contractor, 377 questions) on 13 October 2026. Follow-up questions shown only after a particular answer, and buyer Upgrade modules, are not included.","rule":"Every REF either maps to a CAS master question (refs.constructionline) or is a Constructionline extra (MASTER.extras, scheme constructionline)."}};
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

  // ══════════════════════════════════════════════════════════════
  //  Constructionline section view: the portal mirror.
  //
  //  The two question banks (reports/cl-bank.js, CLBank) give every section
  //  and question in portal order, word for word. Each REF either maps to a
  //  CAS master question (q.refs.constructionline) or is a Constructionline
  //  extra (MASTER.extras). CAS stays the master: a line for a CAS question
  //  carries every REF that question answers in that section, so one piece of
  //  evidence covers them all.
  //
  //  What AHS records per client sits in state.accred.cl, created only when
  //  something is first recorded:
  //    set    'designer' | 'contractor' (else worked out from the roles)
  //    valid  { [portal section name]: 'YYYY-MM-DD' } valid until, per section
  //    rows   { [line key]: { st, ev, act, done } }
  // ══════════════════════════════════════════════════════════════
  var CL_STATUS = [
    { k: 'ahs', label: 'AHS Ltd' },
    { k: 'client', label: 'Client' },
    { k: 'ahs_sign', label: 'AHS Ltd, then client signs' },
    { k: 'covered', label: 'Covered in another answer' },
    { k: 'already', label: 'Already in Constructionline' }
  ];
  var CL_AMBER_DAYS = 90;
  var CL_SSIP = /^Once For All Health & Safety/i;
  var CL_HS = 'Health and Safety';
  function clBank() { return (root && root.CLBank) || null; }
  function isBsa(name) { return /^Building Safety Act/i.test(name || ''); }
  var _refQ = null, _extraByRef = null;
  function refIndex() {
    if (_refQ) return;
    _refQ = {}; _extraByRef = {};
    MASTER.questions.forEach(function (q) { ((q.refs && q.refs.constructionline) || []).forEach(function (r) { _refQ[String(r)] = q.id; }); });
    (MASTER.extras || []).forEach(function (e) { _extraByRef[e.ref] = e; });
  }
  function itemById(id) { return byId(id) || (MASTER.extras || []).find(function (e) { return e.id === id; }) || null; }
  function clQidOfRef(ref) { refIndex(); return _refQ[String(ref)] || null; }
  function clExtraOfRef(ref) { refIndex(); return _extraByRef[String(ref)] || null; }
  // The REFs a question or extra answers on the Constructionline portal.
  function clRefsOf(id) { var it = itemById(id); if (!it) return []; return it.ref ? [it.ref] : (((it.refs || {}).constructionline) || []).slice(); }

  function clCfg(state) {
    var a = (state && state.accred && typeof state.accred === 'object') ? state.accred : {};
    var c = (a.cl && typeof a.cl === 'object') ? a.cl : {};
    return { set: c.set === 'designer' || c.set === 'contractor' ? c.set : '', valid: (c.valid && typeof c.valid === 'object') ? c.valid : {},
      rows: (c.rows && typeof c.rows === 'object') ? c.rows : {} };
  }
  // The question set the client answers: chosen, or from the role picked at step 01.
  function clSetFor(state) {
    var c = clCfg(state); if (c.set) return c.set;
    var roles = askedRoles(cfgOf(state));
    if (roles.indexOf('contractor') >= 0) return 'contractor';
    if (roles.indexOf('designer') >= 0) return 'designer';
    return '';
  }
  function clOn(state) { var c = cfgOf(state).schemes.cl; return !!(c && c.on) && !!clSetFor(state); }

  // Red if expired or not yet valid, amber within 90 days, green otherwise.
  function clExpiry(date, today) {
    today = today || todayIso();
    if (!parse(date)) return { k: 'red', label: 'Not yet valid', days: null };
    var d = daysFrom(today, date);
    if (d < 0) return { k: 'red', label: 'Expired', days: d };
    if (d <= CL_AMBER_DAYS) return { k: 'amber', label: d === 0 ? 'Expires today' : 'Expires in ' + d + ' day' + (d === 1 ? '' : 's'), days: d };
    return { k: 'green', label: 'Valid', days: d };
  }
  var CL_RANK = { red: 0, amber: 1, green: 2 };
  function worst(a, b) { if (!a) return b; if (!b) return a; return CL_RANK[a.k] <= CL_RANK[b.k] ? a : b; }

  // ── the blocks for a question set, from the bank alone ──
  // A block is one portal section, except where the portal repeats itself:
  //  - the SSIP question set rides on the Health and Safety section when the
  //    two ask the same CAS questions (designer), its REFs in their own column;
  //  - a section whose REFs all sit in another section of the same kind joins
  //    it (contractor: Health and Safety inside the Third Party section).
  // Building Safety Act sections come last, in portal order.
  var _blocks = {};
  function keysOf(sec) { return sec.qs.map(function (x) { return clQidOfRef(x[0]) || ('X:' + x[0]); }); }
  function clBlocks(set) {
    if (_blocks[set]) return _blocks[set];
    var bank = clBank(); var b = bank && bank.sets && bank.sets[set]; if (!b) return [];
    var secs = b.sections.map(function (s, i) { return { name: s.name, qs: s.qs, i: i, host: null }; });
    var ssip = secs.find(function (s) { return CL_SSIP.test(s.name); });
    var hs = secs.find(function (s) { return s.name === CL_HS; });
    if (ssip && hs) {
      var hk = keysOf(hs), sk = keysOf(ssip).filter(function (k) { return k.indexOf('X:') !== 0; });
      var shared = sk.filter(function (k) { return hk.indexOf(k) >= 0; }).length;
      if (sk.length && shared / sk.length >= 0.8) ssip.host = hs;
    }
    secs.forEach(function (s) {
      if (s.host || CL_SSIP.test(s.name)) return;
      var mine = s.qs.map(function (x) { return x[0]; });
      var into = secs.find(function (o) {
        if (o === s || o.host || CL_SSIP.test(o.name) || isBsa(o.name) !== isBsa(s.name)) return false;
        var theirs = o.qs.map(function (x) { return x[0]; });
        return theirs.length > mine.length && mine.every(function (r) { return theirs.indexOf(r) >= 0; });
      });
      if (into) s.host = into;
    });
    var hosts = secs.filter(function (s) { return !s.host; });
    var blocks = hosts.map(function (h) {
      var members = [h].concat(secs.filter(function (s) { return s.host === h; }));
      members.sort(function (a, c) { return (a.name === CL_HS ? -1 : c.name === CL_HS ? 1 : a.i - c.i); });
      // One line per portal question. A follow-up that only makes sense with
      // the question before it (the upload, the details box, the dates) rides
      // on that line, as long as it answers the same thing.
      var items = [];
      function follows(prev, qid, type, text) {
        if (!prev) return false;
        if (qid) return prev.cas === qid && (/^(Upload|Multiline Text|Date)$/.test(type) || /^\s*(If\b|Please (provide details|select the certificate))/i.test(text));
        return !prev.cas && /^(Bool|Radio Buttons|Drop Down|Multiselect)$/.test(prev.type) && (/^(Upload|Multiline Text)$/.test(type) || /^\s*(If\b|Please provide details)/i.test(text));
      }
      members.forEach(function (s) {
        var ssipCol = CL_SSIP.test(s.name), riding = ssipCol && members.length > 1, prev = null;
        s.qs.forEach(function (x) {
          var ref = x[0], type = x[1], text = x[2];
          var qid = clQidOfRef(ref), m = /^\s*Question\s+(\d+(?:\.\d+)?)\)/i.exec(text), qno = m ? m[1] : '';
          // the same REF asked again in a repeated section
          var it = items.find(function (l) { return l.all.indexOf(ref) >= 0; });
          if (!it && follows(prev, qid, type, text)) it = prev;
          // the SSIP set riding on Health and Safety: the line asking the same thing
          if (!it && riding) {
            it = (qid && qno ? items.find(function (l) { return l.cas === qid && l.qnos.indexOf(qno) >= 0; }) : null)
              || items.find(function (l) { return l.text === text && !l.ssipRefs.length; })
              || (qid ? items.find(function (l) { return l.cas === qid && !l.ssipRefs.length; }) : null);
          }
          if (!it) {
            var e = qid ? null : clExtraOfRef(ref);
            it = { key: ref, cas: qid, extra: e ? e.id : null, ref: ref, type: type, text: text, hsRefs: [], ssipRefs: [], all: [], qno: qno, qnos: [], fact: e && e.fact ? e.fact : '' };
            items.push(it);
          }
          var col = ssipCol ? it.ssipRefs : it.hsRefs;
          if (col.indexOf(ref) < 0) col.push(ref);
          if (it.all.indexOf(ref) < 0) it.all.push(ref);
          if (qno && it.qnos.indexOf(qno) < 0) it.qnos.push(qno);
          prev = it;
        });
      });
      var hasSsip = members.some(function (s) { return CL_SSIP.test(s.name); });
      return { id: h.name, name: members.map(function (s) { return s.name; }).join(' and '), sections: members.map(function (s) { return s.name; }),
        hsSections: members.filter(function (s) { return !CL_SSIP.test(s.name); }).map(function (s) { return s.name; }),
        ssipSection: hasSsip ? members.find(function (s) { return CL_SSIP.test(s.name); }).name : '',
        bsa: isBsa(h.name), order: Math.min.apply(null, members.map(function (s) { return s.i; })), items: items };
    });
    blocks.sort(function (a, c) { return (a.bsa === c.bsa) ? a.order - c.order : (a.bsa ? 1 : -1); });
    _blocks[set] = blocks;
    return blocks;
  }

  // What the assessor wants, before AHS writes it for the client's trade.
  var CL_TYPE_EVIDENCE = { 'Upload': 'Document upload.', 'Bool': 'Declaration.', 'Radio Buttons': 'Declaration.', 'Drop Down': 'Selection.', 'Multiselect': 'Selection.',
    'Date': 'Date.', 'Number': 'Figure.', 'Multiline Text': 'Written answer.', 'Text': 'Company detail.', 'Email': 'Company detail.', 'Website': 'Company detail.' };
  // The fact sheet value a line answers from (Company set-up), as words.
  var CAS_FACT = { "HS-01": "hsLead", "HS-16": "headcount", "HS-20": "subcontractors", "BS-05": "roles", "BS-08": "hrb", "SS-01": "ssip" };
  function factLineValue(state, it) {
    var co = (state && state.company) || {}, k = it.fact || CAS_FACT[it.cas] || "";
    var yes = function (v) { return v === "yes" ? "Yes" : v === "no" ? "No" : ""; };
    var addr = function (v) { return String(v || "").replace(/\s*\n\s*/g, ", ").trim(); };
    switch (k) {
      case "legalName": return String(co.legalName || "").trim();
      case "tradeName": return String(co.tradingName || "").trim();
      case "companyNo": return String(co.regNo || "").trim();
      case "regOffice": return addr(co.address);
      case "headOffice": return co.headIsReg ? addr(co.address) : addr(co.headOffice);
      case "hsAddress": return co.headIsReg ? addr(co.address) : addr(co.headOffice || co.address);
      case "regIsHead": return co.headIsReg ? "Yes" : (co.headOffice ? "No" : "");
      case "directors": return String(co.directors || "").split(/\n+/).map(function (x) { return x.trim(); }).filter(Boolean).join(", ");
      case "paye": return String(co.paye || "").trim();
      case "hsLead": return [co.hsLead, co.hsLeadRole].filter(Boolean).join(", ");
      case "headcount": return co.headBand === "5+" ? "5 or more" : co.headBand === "1-4" ? "1 to 4" : (co.employees ? String(co.employees) : "");
      case "subcontractors": return yes(co.subcontractors);
      case "hrb": return yes(co.hrb);
      case "qset": case "roles": { return k === "qset" ? (clSetFor(state) === "designer" ? "Designer" : clSetFor(state) === "contractor" ? "Contractor" : "") : (cfgOf(state).roles.map(function (x) { return (ROLES.find(function (y) { return y.id === x; }) || {}).label; }).filter(Boolean).join(", ")); }
      case "ssip": return [co.ssipScheme, co.ssipExpiry ? "expires " + co.ssipExpiry : ""].filter(Boolean).join(", ");
      case "insurance": return [co.elciRenewal ? "employers’ liability renews " + co.elciRenewal : "", co.plRenewal ? "public liability renews " + co.plRenewal : "", co.piRenewal ? "professional indemnity renews " + co.piRenewal : ""].filter(Boolean).join("; ");
    }
    return "";
  }
  function clDefaultEvidence(it) {
    if (it.cas) { var q = byId(it.cas); var t = q.text.replace(/\.$/, ''); return t + '.' + (q.fresh ? ' ' + q.fresh.replace(/\.$/, '') + '.' : ''); }
    if (it.fact) return 'From the client fact sheet.';
    return CL_TYPE_EVIDENCE[it.type] || 'Answer in the portal.';
  }
  function clDefaultStatus(it, colour) {
    if (colour && colour.k === 'green') return 'already';
    if (it.cas) {
      var q = byId(it.cas);
      if (q.kind === 'policy') return 'ahs_sign';
      if (q.kind === 'info') return 'ahs';
      return 'client';
    }
    if (it.fact) return 'ahs';
    return /Upload|Bool|Radio|Drop|Multi|Number/.test(it.type) ? 'client' : 'ahs';
  }
  function clStatusLabel(k, client) {
    var c = client || 'Client';
    return k === 'client' ? c : k === 'ahs_sign' ? 'AHS Ltd, then ' + c + ' signs' : ((CL_STATUS.find(function (s) { return s.k === k; }) || {}).label || '');
  }
  function clDefaultAction(k, client) {
    var c = client || 'The client';
    return k === 'ahs' ? 'AHS Ltd enters it in the portal.'
      : k === 'client' ? c + ' to confirm or send it.'
      : k === 'ahs_sign' ? 'AHS Ltd prepares it. ' + c + ' to approve and sign, or send queries to AHS Ltd.'
      : k === 'covered' ? 'Covered in another answer.'
      : k === 'already' ? 'None needed now.' : '';
  }
  function minDate(list) { var ok = list.filter(function (d) { return !!parse(d); }); if (ok.length < list.length) return ''; ok.sort(); return ok[0] || ''; }

  // ── the section view for one client ──
  function clView(state, today, client) {
    today = today || todayIso();
    var set = clSetFor(state); if (!set) return { set: '', blocks: [], counts: { client: 0, ahs: 0, covered: 0, done: 0, lines: 0 } };
    var c = clCfg(state), n = 0, counts = { client: 0, ahs: 0, covered: 0, done: 0, lines: 0 };
    var blocks = clBlocks(set).map(function (b) {
      var hsValid = b.hsSections.length ? minDate(b.hsSections.map(function (s) { return c.valid[s] || ''; })) : '';
      var ssipValid = b.ssipSection ? (c.valid[b.ssipSection] || '') : '';
      var hsCol = b.hsSections.length ? clExpiry(hsValid, today) : null;
      var ssipCol = b.ssipSection ? clExpiry(ssipValid, today) : null;
      var colour = worst(hsCol, ssipCol);
      var firstOf = {};   // the first line in the block for a CAS question: later ones are covered by it
      var lines = b.items.map(function (it) {
        n++;
        var key = b.id + '|' + it.key, r = c.rows[key] || {};
        // a later upload for the same CAS question is the same evidence again;
        // a later declaration or written answer still needs answering
        var coveredBy = it.cas && firstOf[it.cas] && it.type === 'Upload' ? firstOf[it.cas] : 0;
        if (it.cas && !firstOf[it.cas]) firstOf[it.cas] = n;
        var st = r.st || (coveredBy && !(colour && colour.k === 'green') ? 'covered' : clDefaultStatus(it, colour));
        var done = r.done || '';
        var fv = factLineValue(state, it);
        counts.lines++;
        if (done) counts.done++;
        else if (st === 'client' || st === 'ahs_sign') counts.client++;
        else if (st === 'ahs') counts.ahs++;
        else counts.covered++;
        return { no: n, key: key, cas: it.cas, extra: it.extra, fact: it.fact, ref: it.ref, type: it.type, qno: it.qno, text: it.text,
          hsRefs: it.hsRefs.slice(), ssipRefs: it.ssipRefs.slice(),
          hsValid: it.hsRefs.length ? hsValid : '', ssipValid: it.ssipRefs.length ? ssipValid : '',
          hsColour: it.hsRefs.length ? hsCol : null, ssipColour: it.ssipRefs.length ? ssipCol : null,
          st: st, stLabel: clStatusLabel(st, client), stSet: !!r.st,
          evidence: r.ev != null && r.ev !== '' ? r.ev : (fv ? (it.cas ? clDefaultEvidence(it) + ' Fact sheet: ' + fv + '.' : 'From the client fact sheet: ' + fv + '.') : clDefaultEvidence(it)), evSet: r.ev != null && r.ev !== '',
          action: r.act != null && r.act !== '' ? r.act : (st === 'covered' && coveredBy ? 'Covered in item ' + coveredBy + '.'
            : fv && st === 'client' ? (client || 'The client') + ' to confirm. Suggested answer: ' + fv + '.'
            : fv && st === 'ahs' ? 'AHS Ltd enters it in the portal: ' + fv + '.' : clDefaultAction(st, client)), actSet: r.act != null && r.act !== '',
          factValue: fv,
          coveredBy: coveredBy, done: done };
      });
      return { id: b.id, name: b.name, sections: b.sections.slice(), hsSections: b.hsSections.slice(), ssipSection: b.ssipSection, bsa: b.bsa,
        hsValid: hsValid, ssipValid: ssipValid, hsColour: hsCol, ssipColour: ssipCol, colour: colour, lines: lines };
    });
    return { set: set, blocks: blocks, counts: counts };
  }

  // ══════════════════════════════════════════════════════════════
  //  The client fact sheet (Company set-up). A handful of facts cause most
  //  rejections: the offices, the directors, headcount, subcontractors and the
  //  duty holder role. Each is held once, in state.company (the roles in
  //  state.accred.roles, the one place they live), and each knows the portal
  //  questions it feeds, so a change lists what needs updating.
  // ══════════════════════════════════════════════════════════════
  var FACTS = [
    { k: 'legalName', label: 'Registered name', extras: ['legalName'], fields: ['legalName'] },
    { k: 'regNo', label: 'Company number', extras: ['companyNo'], fields: ['regNo'] },
    { k: 'address', label: 'Registered office', extras: ['regOffice', 'regIsHead', 'hsAddress'], fields: ['address'] },
    { k: 'headOffice', label: 'Head office', extras: ['headOffice', 'regIsHead', 'hsAddress'], fields: ['headOffice', 'headIsReg'] },
    { k: 'directors', label: 'Directors', extras: ['directors'], fields: ['directors'] },
    { k: 'hsLead', label: 'Person responsible for health and safety', cas: ['HS-01'], fields: ['hsLead', 'hsLeadRole'] },
    { k: 'headBand', label: 'Headcount band', cas: ['HS-16', 'HS-17'], fields: ['headBand'] },
    { k: 'paye', label: 'Number on PAYE', cas: ['HS-16'], extras: ['paye'], fields: ['paye'] },
    { k: 'employees', label: 'Number of employees', cas: ['HS-16', 'HS-17'], fields: ['employees'] },
    { k: 'subcontractors', label: 'Uses subcontractors', cas: ['HS-20'], fields: ['subcontractors'] },
    { k: 'roles', label: 'Duty holder roles', cas: ['BS-05'], extras: ['qset'], fields: [] },
    { k: 'hrb', label: 'Works on higher-risk buildings', cas: ['BS-08'], fields: ['hrb'] },
    { k: 'ssip', label: 'SSIP scheme and certificate dates', cas: ['SS-01'], fields: ['ssipScheme', 'ssipStart', 'ssipExpiry'] },
    { k: 'insurance', label: 'Insurance renewal dates', extras: ['insurance'], fields: ['elciRenewal', 'plRenewal', 'piRenewal'] }
  ];
  function factOfField(field) { var f = FACTS.find(function (x) { return x.fields.indexOf(field) >= 0; }); return f ? f.k : null; }
  function factDef(k) { return FACTS.find(function (x) { return x.k === k; }) || null; }
  // The portal questions a fact feeds, for this client: the sections and lines.
  function factImpact(state, k, today) {
    var f = factDef(k); if (!f) return { sections: [], lines: [], cas: [] };
    var cas = f.cas || [], ex = f.extras || [];
    var out = { sections: [], lines: [], cas: cas.slice() };
    if (!clOn(state)) return out;
    clView(state, today).blocks.forEach(function (b) {
      var hit = b.lines.filter(function (l) { return (l.cas && cas.indexOf(l.cas) >= 0) || (l.fact && ex.indexOf(l.fact) >= 0); });
      if (!hit.length) return;
      out.sections.push(b.name);
      hit.forEach(function (l) { out.lines.push({ no: l.no, section: b.name, text: l.text, refs: l.hsRefs.concat(l.ssipRefs.filter(function (r) { return l.hsRefs.indexOf(r) < 0; })) }); });
    });
    return out;
  }
  function num(v) { var n = parseInt(String(v == null ? '' : v).replace(/[^\d]/g, ''), 10); return isNaN(n) ? null : n; }
  function yn(v) { v = String(v || '').toLowerCase(); return v === 'yes' || v === 'no' ? v : ''; }
  // Facts that disagree with an answer or a date: the warning panel.
  function factConflicts(state, today) {
    today = today || todayIso();
    var co = (state && state.company) || {}, ans = cfgOf(state).answers, out = [];
    function add(k, text) { out.push({ fact: k, label: (factDef(k) || {}).label || k, text: text }); }
    var band = co.headBand === '1-4' || co.headBand === '5+' ? co.headBand : '';
    var emp = num(co.employees), paye = num(co.paye);
    var hs16 = num(ans['HS-16'] && ans['HS-16'].text);
    function bandOf(n) { return n == null ? '' : n >= 5 ? '5+' : '1-4'; }
    function bandText(b) { return b === '5+' ? '5 or more' : '1 to 4'; }
    if (band && emp != null && bandOf(emp) !== band) add('headBand', 'The headcount band is ' + bandText(band) + ' but the number of employees is ' + emp + '.');
    if (band && paye != null && bandOf(paye) !== band && !(band === '5+' && emp != null && emp >= 5)) add('paye', 'The headcount band is ' + bandText(band) + ' but ' + paye + ' are on PAYE.');
    if (emp != null && paye != null && paye > emp) add('paye', paye + ' on PAYE is more than the ' + emp + ' employees recorded.');
    if (hs16 != null && (band || emp != null) && bandOf(hs16) !== (band || bandOf(emp))) add('headBand', 'The number of employees answered at HS-16 (' + hs16 + ') does not match the headcount on the fact sheet.');
    var sub = yn(co.subcontractors), d20 = yn(ans['HS-20'] && ans['HS-20'].decl);
    if (sub && d20 && sub !== d20) add('subcontractors', 'The fact sheet says ' + (sub === 'yes' ? 'Yes' : 'No') + ' to subcontractors but HS-20 is declared ' + (d20 === 'yes' ? 'Yes' : 'No') + '.');
    var hrb = yn(co.hrb), d08 = yn(ans['BS-08'] && ans['BS-08'].decl);
    if (hrb && d08 && hrb !== d08) add('hrb', 'The fact sheet says ' + (hrb === 'yes' ? 'Yes' : 'No') + ' to higher-risk buildings but BS-08 is declared ' + (d08 === 'yes' ? 'Yes' : 'No') + '.');
    var lead = String(co.hsLead || '').trim(), hs01 = String((ans['HS-01'] && ans['HS-01'].text) || '').trim();
    if (lead && hs01 && hs01.toLowerCase().indexOf(lead.toLowerCase()) < 0) add('hsLead', 'The person responsible for health and safety is ' + lead + ' but HS-01 is answered "' + hs01 + '".');
    var c = clCfg(state), roles = askedRoles(cfgOf(state));
    if (clOn(state) && c.set && roles.length && roles.indexOf(c.set) < 0) add('roles', 'The Constructionline question set is ' + (c.set === 'designer' ? 'Designer' : 'Contractor') + ' but the duty holder roles do not include it.');
    var ssipExp = parse(co.ssipExpiry) ? co.ssipExpiry : '';
    if (ssipExp && daysFrom(today, ssipExp) < 0) add('ssip', 'The ' + (co.ssipScheme || 'SSIP') + ' certificate expired on ' + ssipExp + '.');
    if (ssipExp && clOn(state)) ['Health and Safety Third Party / Exemption certificates', 'SSIP Third Party Exemption'].forEach(function (s) {
      var v = c.valid[s]; if (parse(v) && v > ssipExp) add('ssip', s + ' is valid until ' + v + ' but the SSIP certificate expires on ' + ssipExp + '.');
    });
    var ins = ['elciRenewal', 'plRenewal', 'piRenewal'].map(function (k) { return parse(co[k]) ? co[k] : ''; }).filter(Boolean).sort();
    if (ins.length && clOn(state)) {
      var iv = c.valid.Insurances;
      if (parse(iv) && iv > ins[0]) add('insurance', 'Insurances is valid until ' + iv + ' but the first policy renews on ' + ins[0] + ': the renewal certificate is needed.');
    }
    if (ins.length && daysFrom(today, ins[0]) < 0) add('insurance', 'An insurance renewal date has passed (' + ins[0] + '): record the new date.');
    return out;
  }

  var api = { MASTER: MASTER, AREAS: AREAS, ROLES: ROLES, SCHEMES: SCHEMES, STATUS: STATUS, STATUS_ORDER: STATUS_ORDER, DUE_DAYS: DUE_DAYS,
    FACTS: FACTS, factOfField: factOfField, factDef: factDef, factImpact: factImpact, factConflicts: factConflicts,
    addMonths: addMonths, daysFrom: daysFrom, todayIso: todayIso, freshRule: freshRule, cfgOf: cfgOf, setsOn: setsOn, setsFor: setsFor, setRole: setRole, schemeOf: schemeOf,
    refsOf: refsOf, inScope: inScope, questions: questions, byId: byId, usedIn: usedIn, facts: facts, siteItems: siteItems, siteFor: siteFor,
    evidenceOf: evidenceOf, statusOf: statusOf, renewals: renewals, summary: summary, started: started, focusFor: focusFor,
    answerText: answerText, packRows: packRows,
    CL_STATUS: CL_STATUS, CL_AMBER_DAYS: CL_AMBER_DAYS, itemById: itemById, clQidOfRef: clQidOfRef, clExtraOfRef: clExtraOfRef, clRefsOf: clRefsOf,
    clCfg: clCfg, clSetFor: clSetFor, clOn: clOn, clExpiry: clExpiry, clBlocks: clBlocks, clView: clView, clStatusLabel: clStatusLabel, clDefaultAction: clDefaultAction };
  root.AccredCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
