/**
 * Shared helpers for the temple's API routes.
 * The underscore prefix keeps this file out of Vercel's route table.
 */

const crypto = require('crypto');

// Constant-time compare so the keeper key can't be guessed byte-by-byte via timing
function keyOk(given) {
  const secret = process.env.TEMPLE_KEEPER_KEY || '';
  if (!secret || !given) return false;
  const a = Buffer.from(String(given));
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function readBody(req) {
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  return body || {};
}

// Newest-first blob records, each tagged with its pathname as `id`
async function loadRecords(list, prefix, scan) {
  const { blobs } = await list({ prefix, limit: 1000 });
  const newest = blobs
    .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
    .slice(0, scan);
  const records = await Promise.all(newest.map(b => fetch(b.url)
    .then(r => r.ok ? r.json() : null)
    .then(j => j && Object.assign(j, { id: b.pathname }))
    .catch(() => null)));
  return { records: records.filter(Boolean), total: blobs.length };
}

module.exports = { keyOk, readBody, loadRecords };
