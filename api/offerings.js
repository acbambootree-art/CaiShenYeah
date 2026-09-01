/**
 * Living Altar API — devotees join an offering round; the temple keeper marks
 * a round as actually offered at the physical altar.
 *
 * Design rule: never promise the future, report the past. An offering is only
 * ever shown as made after a human confirms it happened.
 *
 * Records are immutable and their state is their folder — a blob is written
 * once and never rewritten. Overwriting a pathname is unreliable here: the
 * blob CDN keeps serving the old body, so an offered round would silently
 * revert to pending on the next read.
 *
 *   offerings/pending/<ts>-<rand>.json  { name, dedication, ts }
 *   offerings/offered/<ts>-<rand>.json  { name, dedication, ts, offeredAt, clip }
 *
 * GET   /api/offerings -> { pending: [...], offered: [...], pendingCount }
 * POST  /api/offerings -> { ok } ; body { name?, dedication?, altar? }
 * PATCH /api/offerings -> { ok, offered } ; body { clip? } + x-temple-key
 */

const { put, list, del } = require('@vercel/blob');
const { keyOk, readBody, loadRecords } = require('./_temple');

const MAX_NAME = 24;
const MAX_DEDICATION = 80;
const RECENT = 24;
const SCAN = 300;

const slug = (ts) => `${ts}-${Math.random().toString(36).slice(2, 8)}.json`;
const write = (path, rec) => put(path, JSON.stringify(rec), {
  access: 'public', contentType: 'application/json', addRandomSuffix: false
});

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    // Browsers must revalidate or a devotee cannot see themselves join the round
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate, s-maxage=15, stale-while-revalidate=60');
    const { records } = await loadRecords(list, 'offerings/', SCAN);
    const pending = records.filter(o => o.id.startsWith('offerings/pending/'))
      .sort((a, b) => a.ts - b.ts);
    const offered = records.filter(o => o.id.startsWith('offerings/offered/'))
      .sort((a, b) => b.offeredAt - a.offeredAt).slice(0, RECENT);
    return res.status(200).json({ pending, offered, pendingCount: pending.length });
  }

  if (req.method === 'POST') {
    res.setHeader('Cache-Control', 'no-store');
    const body = readBody(req);
    if (body.altar) return res.status(200).json({ ok: true }); // honeypot: pretend success

    const name = String(body.name || '').trim().slice(0, MAX_NAME);
    const dedication = String(body.dedication || '').trim().slice(0, MAX_DEDICATION);
    if (!name) return res.status(400).json({ error: 'The altar needs a name to read aloud.' });

    const ts = Date.now();
    await write(`offerings/pending/${slug(ts)}`, { name, dedication, ts });
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'PATCH') {
    res.setHeader('Cache-Control', 'no-store');
    if (!keyOk(req.headers['x-temple-key'])) {
      return res.status(401).json({ error: 'Only the temple keeper may offer a round.' });
    }
    const clip = String(readBody(req).clip || '').trim().slice(0, 300);
    if (clip && !/^https:\/\/[^\s]+$/.test(clip)) {
      return res.status(400).json({ error: 'A clip link must be https.' });
    }

    const { records } = await loadRecords(list, 'offerings/pending/', SCAN);
    if (!records.length) return res.status(200).json({ ok: true, offered: 0 });

    const offeredAt = Date.now();
    // ponytail: two blob ops per name; batch into a single round record if a
    // round ever carries more than a few hundred
    await Promise.all(records.map(async (o) => {
      await write(`offerings/offered/${slug(o.ts)}`, {
        name: o.name, dedication: o.dedication, ts: o.ts, offeredAt, clip: clip || null
      });
      await del(o.id);
    }));
    return res.status(200).json({ ok: true, offered: records.length, offeredAt });
  }

  res.setHeader('Allow', 'GET, POST, PATCH');
  return res.status(405).json({ error: 'Method not allowed' });
};
