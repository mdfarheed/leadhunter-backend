const XLSX = require('xlsx');
const Lead = require('../models/Lead');
const asyncHandler = require('../utils/asyncHandler');
const { buildLeadFilter, buildSort } = require('../utils/leadFilter');

const fmt = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const COLUMNS = [
  ['Business Name', (l) => l.businessName], ['Category', (l) => l.category], ['Phone', (l) => l.phone], ['WhatsApp Number', (l) => l.whatsappNumber],
  ['Website', (l) => l.website], ['Address', (l) => l.address], ['City', (l) => l.city], ['State', (l) => l.state], ['Lead Status', (l) => l.status],
  ['Notes', (l) => l.notes], ['Last Contacted', (l) => fmt(l.lastContactedAt)], ['Next Follow-up', (l) => fmt(l.nextFollowUpAt)],
];

// Spreadsheet formula-injection guard
const safe = (v) => (typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? `'${v}` : v);

async function rows(query) {
  const leads = await Lead.find(buildLeadFilter(query)).sort(buildSort(query)).limit(50000).lean();
  return leads.map((l) => Object.fromEntries(COLUMNS.map(([h, fn]) => [h, safe(fn(l) ?? '')])));
}
const stamp = () => new Date().toISOString().slice(0, 10);

exports.json = asyncHandler(async (req, res) => { const data = await rows(req.query); res.json({ data, total: data.length }); });

exports.csv = asyncHandler(async (req, res) => {
  const data = await rows(req.query);
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const head = COLUMNS.map(([h]) => esc(h)).join(',');
  const body = data.map((r) => COLUMNS.map(([h]) => esc(r[h])).join(',')).join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="leads-${stamp()}.csv"`);
  res.send(`\uFEFF${head}\r\n${body}`);
});

exports.excel = asyncHandler(async (req, res) => {
  const data = await rows(req.query);
  const ws = XLSX.utils.json_to_sheet(data, { header: COLUMNS.map(([h]) => h) });
  ws['!cols'] = COLUMNS.map(([h]) => ({ wch: Math.max(h.length + 2, h === 'Notes' || h === 'Address' ? 40 : 16) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Leads');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="leads-${stamp()}.xlsx"`);
  res.send(buf);
});
