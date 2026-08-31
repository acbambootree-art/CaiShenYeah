/**
 * Prayer Wall API — each wish is its own blob (no read-modify-write races).
 * GET  /api/wishes        -> { wishes: [{name, wish, ts}], count }
 * POST /api/wishes        -> { ok: true } ; body { name?, wish, altar? }
 */

const { put, list } = require('@vercel/blob');

const MAX_WISH = 140;
const MAX_NAME = 24;
const WALL_SIZE = 48;

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

  if (req.method === 'GET') {
    // ponytail: fan-out fetch of newest N blobs; an index blob if the wall
    // ever outgrows one list() page (1000 wishes)
    const { blobs } = await list({ prefix: 'wishes/', limit: 1000 });
    const newest = blobs
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
      .slice(0, WALL_SIZE);
    const wishes = (await Promise.all(
      newest.map(b => fetch(b.url).then(r => r.ok ? r.json() : null).catch(() => null))
    )).filter(Boolean);
    return res.status(200).json({ wishes, count: blobs.length });
  }

  if (req.method === 'POST') {
    res.setHeader('Cache-Control', 'no-store');
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    body = body || {};

    if (body.altar) return res.status(200).json({ ok: true }); // honeypot: pretend success

    const wish = String(body.wish || '').trim().slice(0, MAX_WISH);
    const name = String(body.name || '').trim().slice(0, MAX_NAME);
    if (wish.length < 2) return res.status(400).json({ error: 'The temple could not hear your wish.' });

    const entry = { wish, name, ts: Date.now() };
    await put(`wishes/${entry.ts}-${Math.random().toString(36).slice(2, 8)}.json`,
      JSON.stringify(entry),
      { access: 'public', contentType: 'application/json', addRandomSuffix: false });
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
};
