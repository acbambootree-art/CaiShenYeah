/**
 * Prayer Wall API — each wish is its own blob (no read-modify-write races).
 * GET    /api/wishes[?limit=n]  -> { wishes: [{id, name, wish, ts}], count }
 * POST   /api/wishes            -> { ok: true } ; body { name?, wish, altar? }
 * DELETE /api/wishes            -> { ok: true } ; body { id } + x-temple-key header
 */

const crypto = require('crypto');
const { put, list, del } = require('@vercel/blob');

const MAX_WISH = 140;
const MAX_NAME = 24;
const WALL_SIZE = 48;
const KEEPER_MAX = 200;

// Constant-time compare so the key can't be guessed byte-by-byte via timing
function keyOk(given) {
  const secret = process.env.TEMPLE_KEEPER_KEY || '';
  if (!secret || !given) return false;
  const a = Buffer.from(String(given));
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    // CDN may hold it briefly; browsers must revalidate, or a freshly hung
    // wish stays invisible to the person who just hung it
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate, s-maxage=30, stale-while-revalidate=60');
    const asked = parseInt(req.query && req.query.limit, 10);
    const want = Math.min(Number.isFinite(asked) && asked > 0 ? asked : WALL_SIZE, KEEPER_MAX);
    // ponytail: fan-out fetch of newest N blobs; an index blob if the wall
    // ever outgrows one list() page (1000 wishes)
    const { blobs } = await list({ prefix: 'wishes/', limit: 1000 });
    const newest = blobs
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
      .slice(0, want);
    const wishes = (await Promise.all(
      newest.map(b => fetch(b.url)
        .then(r => r.ok ? r.json() : null)
        .then(j => j && Object.assign(j, { id: b.pathname }))
        .catch(() => null))
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

  if (req.method === 'DELETE') {
    res.setHeader('Cache-Control', 'no-store');
    if (!keyOk(req.headers['x-temple-key'])) {
      return res.status(401).json({ error: 'Only the temple keeper may take a wish down.' });
    }
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    const id = String((body || {}).id || '');
    // Confine deletion to the wishes folder, whatever the key holder sends
    if (!/^wishes\/[A-Za-z0-9._-]+\.json$/.test(id)) {
      return res.status(400).json({ error: 'That is not a wish.' });
    }
    await del(id);
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
};
