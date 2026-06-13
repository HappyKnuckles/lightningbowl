// Same-origin proxy for the Overpass API.
//
// The public Overpass instances are heavily loaded and intermittently reject
// browser requests (HTTP 406/429/504) — the failures are not deterministic and
// not tied to any one origin, so they surface unpredictably on the hosted site.
// Routing server-side lets us send a descriptive User-Agent (no browser CORS or
// Origin throttling) and transparently retry across mirrors so a single
// overloaded instance doesn't break the map.

const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const USER_AGENT = 'LightningBowl/1.0 (+https://lightningbowl.de)';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const query = await readBody(req);
  if (!query) {
    res.status(400).json({ error: 'Missing Overpass query' });
    return;
  }

  let lastStatus = 502;
  let lastBody = '{"error":"All Overpass mirrors failed"}';
  let lastContentType = 'application/json';

  for (const endpoint of ENDPOINTS) {
    try {
      const upstream = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain', 'User-Agent': USER_AGENT },
        body: query,
      });
      const text = await upstream.text();
      if (upstream.ok) {
        res.status(200);
        res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'application/json');
        res.send(text);
        return;
      }
      // Remember this failure and try the next mirror.
      lastStatus = upstream.status;
      lastBody = text;
      lastContentType = upstream.headers.get('content-type') ?? 'text/plain';
    } catch {
      lastStatus = 502;
      lastBody = '{"error":"Overpass proxy fetch failed"}';
      lastContentType = 'application/json';
    }
  }

  res.status(lastStatus);
  res.setHeader('Content-Type', lastContentType);
  res.send(lastBody);
}

/** Returns the request body as a string regardless of how Vercel parsed it. */
async function readBody(req) {
  if (typeof req.body === 'string') {
    return req.body;
  }
  if (Buffer.isBuffer(req.body)) {
    return req.body.toString('utf8');
  }
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}
