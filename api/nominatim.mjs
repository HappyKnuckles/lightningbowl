// Same-origin proxy for Nominatim geocoding — see api/overpass.mjs for why the
// hosted web app can't call the upstream directly. Nominatim's usage policy
// also requires a descriptive User-Agent, which a serverless request can set.

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'LightningBowl/1.0 (+https://lightningbowl.de)';

export default async function handler(req, res) {
  const query = req.query.q;
  if (!query) {
    res.status(400).json({ error: 'Missing q parameter' });
    return;
  }

  try {
    const url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=1`;
    const upstream = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' },
    });
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', 'application/json');
    res.send(text);
  } catch (error) {
    res.status(502).json({ error: 'Nominatim proxy failed', details: String(error) });
  }
}
