// CAS question-set workbook: every question in the framework - the Building
// Safety Act section included - with what Compass currently holds against
// each, the evidence that will be asked for, and two columns for the client
// to answer in. Client and Trade lead the table so collated workbooks filter
// by who and by what they do; Needs-your-answer is the client's one-click
// to-do filter. Pure builder so the tests can exercise it without a server.
const ExcelJS = require('exceljs');

const NAVY = 'FF1E3A5F';
const YELLOW = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3B8' } };
const ARIAL = { name: 'Arial', size: 10 };

async function buildCasWorkbook(payload) {
  const client = String((payload && payload.client) || 'Client').slice(0, 120);
  const trade = String((payload && payload.trade) || '').slice(0, 160);
  const rows = Array.isArray(payload && payload.rows) ? payload.rows : [];
  if (!rows.length) throw new Error('no_rows');

  const wb = new ExcelJS.Workbook();
  wb.creator = 'AHS Compass';

  // ── How to use ──
  const rm = wb.addWorksheet('How to use');
  rm.getColumn(1).width = 112;
  const L = (t, o = {}) => { const r = rm.addRow([t]); r.getCell(1).font = Object.assign({}, ARIAL, o); r.getCell(1).alignment = { wrapText: true, vertical: 'top' }; };
  L('Common Assessment Standard - the full question set for ' + client + (trade ? (' (' + trade + ')') : ''), { bold: true, size: 13, color: { argb: NAVY } });
  L('');
  L('Every question in the standard is here, including the Building Safety Act section. Nothing is hidden: where a question does not apply to this business, the Scope column says so and why.');
  L('');
  L('The quickest way in: filter "Needs your answer" to Yes - that is your to-do list. Everything else is either already evidenced or does not apply.', { bold: true });
  L('');
  L('Answers need evidence. The "Evidence you will be asked for" column says what sits behind each question - a certificate, a policy, a record. Where you have it, say where it lives in the notes column. Where you do not have it yet, say that too: it becomes part of the plan, never a black mark.', { bold: true, color: { argb: 'FFB45309' } });
  L('');
  L('Fill in the two yellow columns only: "Your answer" (pick from the dropdown) and "Where the evidence lives / notes".');
  L('Example: against "Employers liability insurance", pick "We have this" and write "Certificate on the office noticeboard, renewed March - Aviva".');

  // ── the question set ──
  const ws = wb.addWorksheet('CAS question set', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: 'Client', key: 'client', width: 22 },
    { header: 'Trade', key: 'trade', width: 26 },
    { header: 'Section', key: 'section', width: 28 },
    { header: 'Q', key: 'q', width: 9 },
    { header: 'Requirement (our summary)', key: 'req', width: 62 },
    { header: 'Flags', key: 'flags', width: 19 },
    { header: 'Evidence you will be asked for', key: 'docType', width: 24 },
    { header: 'Scope for this business', key: 'scope', width: 25 },
    { header: 'Status in Compass', key: 'status', width: 15 },
    { header: 'Needs your answer', key: 'needs', width: 14 },
    { header: 'Evidence already linked', key: 'evidence', width: 28 },
    { header: 'Your answer', key: 'answer', width: 18 },
    { header: 'Where the evidence lives / notes', key: 'notes', width: 42 },
  ];
  ws.getRow(1).font = Object.assign({}, ARIAL, { bold: true, color: { argb: 'FFFFFFFF' } });
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  ws.getRow(1).height = 26;

  rows.forEach(r => {
    const status = String(r.status || '');
    const needs = String(r.scope || '') === 'In scope' && !['Ready', 'N/A'].includes(status) ? 'Yes' : 'No';
    const row = ws.addRow({
      client, trade,
      section: String(r.section || ''), q: String(r.q || ''), req: String(r.req || ''),
      flags: String(r.flags || ''), docType: String(r.docType || ''), scope: String(r.scope || ''),
      status, needs, evidence: String(r.evidence || ''), answer: '', notes: '',
    });
    row.font = ARIAL;
    row.alignment = { wrapText: true, vertical: 'top' };
    ['L', 'M'].forEach(c => { row.getCell(c).fill = YELLOW; });
    row.getCell('L').dataValidation = { type: 'list', allowBlank: true, formulae: ['"We have this,We don\'t have this,Not sure"'] };
    if (status === 'Ready') row.getCell('I').font = Object.assign({}, ARIAL, { bold: true, color: { argb: 'FF15803D' } });
    if (status === 'Gap') row.getCell('I').font = Object.assign({}, ARIAL, { bold: true, color: { argb: 'FFDC2626' } });
    if (needs === 'Yes') row.getCell('J').font = Object.assign({}, ARIAL, { bold: true, color: { argb: 'FFB45309' } });
  });

  // the filter must span the data, never just the header
  ws.autoFilter = 'A1:M' + (rows.length + 1);

  return await wb.xlsx.writeBuffer();
}

module.exports = { buildCasWorkbook };
