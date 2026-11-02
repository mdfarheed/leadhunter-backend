// Template rotation: within one category the 5 templates are used in a fixed order, one per message the admin opens:
// lead 1 -> template 1, lead 2 -> template 2, ... lead 5 -> template 5, lead 6 -> template 1 again.
// The admin still sees a preview, may pick a different template and may edit the text; WhatsApp only opens on their click.

const seedNumber = (t) => { const m = /-(\d+)$/.exec(t.seedKey || ''); return m ? Number(m[1]) : null; };

// Starter templates in their numbered order (1..5), then any templates the admin added, oldest first.
function orderTemplates(list) {
  return [...list].sort((a, b) => {
    const x = seedNumber(a); const y = seedNumber(b);
    if (x !== null && y !== null) return x - y;
    if (x !== null) return -1;
    if (y !== null) return 1;
    return (new Date(a.createdAt || 0) - new Date(b.createdAt || 0)) || String(a._id).localeCompare(String(b._id));
  });
}

// The template that comes after `lastUsedId` (wraps around). With no history, or if the last one was deleted, it starts at #1.
function nextInRotation(list, lastUsedId) {
  const ordered = orderTemplates(list);
  if (!ordered.length) return null;
  const i = ordered.findIndex((t) => String(t._id) === String(lastUsedId));
  const index = (i + 1) % ordered.length;
  return { template: ordered[index], position: index + 1, total: ordered.length };
}

module.exports = { orderTemplates, nextInRotation };
