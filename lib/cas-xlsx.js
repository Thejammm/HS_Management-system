// CAS question-set workbook in the TRIAGE layout - the format Simon approved.
// No repeated client/trade blobs in the rows: the client is named once on the
// Read me. The filters he works by are columns: "Who answers" (Client /
// Consultant) and "Applies to this business" (in scope or not, and why).
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

  // ── Read me: the client is named here, once ──
  const rm = wb.addWorksheet('Read me');
  rm.getColumn(1).width = 110;
  const L = (t, o = {}) => { const r = rm.addRow([t]); r.getCell(1).font = Object.assign({}, ARIAL, o); r.getCell(1).alignment = { wrapText: true, vertical: 'top' }; };
  L('CAS question set - ' + client + (trade ? (' (' + trade + ')') : ''), { bold: true, size: 13, color: { argb: NAVY } });
  L('Every question in the standard, the Building Safety Act section included.');
  L('The two filters that matter: "Who answers" (Client = needs their input; Consultant = held or verified this side) and "Applies to this business" (in scope, or not and why).');
  L('The client fills the two yellow columns. Answers need evidence - a certificate, a policy, a record. Not having it yet is fine to say: it becomes part of the plan, never a black mark.', { bold: true, color: { argb: 'FFB45309' } });

  // ── the question set, triage layout ──
  const ws = wb.addWorksheet('CAS question set', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: 'Section', key: 'section', width: 22 },
    { header: 'Q', key: 'q', width: 9 },
    { header: 'Question (our summary)', key: 'req', width: 62 },
    { header: 'Evidence you will be asked for', key: 'docType', width: 24 },
    { header: 'Applies to this business', key: 'scope', width: 24 },
    { header: 'Who answers', key: 'who', width: 13 },
    { header: 'Status in Compass', key: 'status', width: 14 },
    { header: 'Your answer', key: 'answer', width: 17 },
    { header: 'Where the evidence lives / notes', key: 'notes', width: 44 },
  ];
  ws.getRow(1).font = Object.assign({}, ARIAL, { bold: true, color: { argb: 'FFFFFFFF' } });
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  ws.getRow(1).height = 24;

  rows.forEach(r => {
    const scope = String(r.scope || '');
    const inScope = scope === 'In scope';
    const status = String(r.status || 'Unassessed');
    const who = !inScope ? 'n/a' : (status === 'Ready' || status === 'N/A') ? 'Consultant' : 'Client';
    const row = ws.addRow({
      section: String(r.section || ''), q: String(r.q || ''), req: String(r.req || ''),
      docType: String(r.docType || ''), scope, who, status: inScope ? status : '-', answer: '', notes: '',
    });
    row.font = ARIAL;
    row.alignment = { wrapText: true, vertical: 'top' };
    ['H', 'I'].forEach(c => { row.getCell(c).fill = YELLOW; });
    row.getCell('H').dataValidation = { type: 'list', allowBlank: true, formulae: ['"We have this,We don\'t have this,Not sure"'] };
    const wc = row.getCell('F');
    wc.font = Object.assign({}, ARIAL, { bold: true, color: { argb: who === 'Client' ? 'FF15803D' : who === 'Consultant' ? 'FF6B7280' : 'FF9CA3AF' } });
    const sc = row.getCell('G');
    if (status === 'Ready' && inScope) sc.font = Object.assign({}, ARIAL, { bold: true, color: { argb: 'FF15803D' } });
    else if (status === 'Gap' && inScope) sc.font = Object.assign({}, ARIAL, { bold: true, color: { argb: 'FFDC2626' } });
  });

  // the filter must span the data, never just the header
  ws.autoFilter = 'A1:I' + (rows.length + 1);

  return await wb.xlsx.writeBuffer();
}

module.exports = { buildCasWorkbook };
