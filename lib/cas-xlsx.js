// CAS question-set workbook, in the triage shape Simon actually works with:
// one clean flat table, Client and Trade leading so it filters, one row per
// question, and only the columns that earn their place. Pure builder so the
// tests can exercise it without a server.
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

  // ── Read me: short ──
  const rm = wb.addWorksheet('Read me');
  rm.getColumn(1).width = 110;
  const L = (t, o = {}) => { const r = rm.addRow([t]); r.getCell(1).font = Object.assign({}, ARIAL, o); r.getCell(1).alignment = { wrapText: true, vertical: 'top' }; };
  L('CAS question set - ' + client + (trade ? (' (' + trade + ')') : ''), { bold: true, size: 13, color: { argb: NAVY } });
  L('Every question in the standard, the Building Safety Act section included. Where one does not apply, the Status column says so and why.');
  L('Fill in the two yellow columns: Your answer (dropdown) and where the evidence lives. Answers need evidence - a certificate, a policy, a record. If you do not have it yet, say so: it becomes part of the plan, never a black mark.', { bold: true, color: { argb: 'FFB45309' } });

  // ── the question set, triage-style ──
  const ws = wb.addWorksheet('CAS question set', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: 'Client', key: 'client', width: 20 },
    { header: 'Trade', key: 'trade', width: 24 },
    { header: 'Section', key: 'section', width: 26 },
    { header: 'Q', key: 'q', width: 8 },
    { header: 'Question (our summary)', key: 'req', width: 64 },
    { header: 'Evidence you will be asked for', key: 'docType', width: 26 },
    { header: 'Status in Compass', key: 'status', width: 22 },
    { header: 'Your answer', key: 'answer', width: 17 },
    { header: 'Where the evidence lives / notes', key: 'notes', width: 46 },
  ];
  ws.getRow(1).font = Object.assign({}, ARIAL, { bold: true, color: { argb: 'FFFFFFFF' } });
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  ws.getRow(1).height = 24;

  rows.forEach(r => {
    const scope = String(r.scope || '');
    // one status the reader parses in one look: out-of-scope rows say so here
    const status = scope === 'In scope' ? String(r.status || 'Unassessed') : scope;
    const row = ws.addRow({
      client, trade,
      section: String(r.section || ''), q: String(r.q || ''), req: String(r.req || ''),
      docType: String(r.docType || ''), status, answer: '', notes: '',
    });
    row.font = ARIAL;
    row.alignment = { wrapText: true, vertical: 'top' };
    ['H', 'I'].forEach(c => { row.getCell(c).fill = YELLOW; });
    row.getCell('H').dataValidation = { type: 'list', allowBlank: true, formulae: ['"We have this,We don\'t have this,Not sure"'] };
    const sc = row.getCell('G');
    if (status === 'Ready') sc.font = Object.assign({}, ARIAL, { bold: true, color: { argb: 'FF15803D' } });
    else if (status === 'Gap') sc.font = Object.assign({}, ARIAL, { bold: true, color: { argb: 'FFDC2626' } });
    else if (scope !== 'In scope') sc.font = Object.assign({}, ARIAL, { color: { argb: 'FF6B7280' } });
  });

  // the filter must span the data, never just the header
  ws.autoFilter = 'A1:I' + (rows.length + 1);

  return await wb.xlsx.writeBuffer();
}

module.exports = { buildCasWorkbook };
