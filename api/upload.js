// POST /api/upload — stores customer artwork / mockups in Vercel Blob and returns a public link.
// If Blob storage isn't connected yet, it answers { url: null } and the site keeps working.
import { put } from '@vercel/blob';

const TYPES = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'application/pdf': 'pdf',
};
const MAX = 4 * 1024 * 1024;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Use POST.' });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(200).json({ url: null, stored: false });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const m = /^data:([\w/+.-]+);base64,(.+)$/s.exec(body?.data || '');
  if (!m || !TYPES[m[1]]) return res.status(400).json({ error: 'Upload a PNG, JPG, WebP, GIF, SVG or PDF.' });
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > MAX) return res.status(413).json({ error: 'That file is over 4 MB.' });

  const base = String(body.name || 'artwork').replace(/\.[a-z0-9]+$/i, '').replace(/[^a-z0-9_-]+/gi, '-').slice(0, 60) || 'artwork';
  const day = new Date().toISOString().slice(0, 10);
  try {
    const blob = await put(`orders/${day}/${base}.${TYPES[m[1]]}`, buf, {
      access: 'public',
      contentType: m[1],
      addRandomSuffix: true,
    });
    return res.status(200).json({ url: blob.url, stored: true });
  } catch (e) {
    console.error('Blob upload failed', e);
    return res.status(200).json({ url: null, stored: false });
  }
}
