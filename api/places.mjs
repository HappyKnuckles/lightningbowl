// Google Places proxy — the fallback for alleys that OpenStreetMap doesn't know.
//
// Overpass only returns what someone mapped in OSM, which misses a lot of
// smaller alleys. Google's Places index covers them, but its key must never
// reach the client, so every Places call goes through here. Native apps have no
// same-origin /api, so they call the deployed proxy directly — hence the CORS
// header. Without GOOGLE_PLACES_API_KEY the endpoint reports 501 and the app
// falls back to the Overpass-only result list.

const PLACES_URL = 'https://places.googleapis.com/v1/places:searchText';
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.nationalPhoneNumber',
  'places.websiteUri',
].join(',');
const MAX_RESULTS = 10;
/** Bias radius around the caller's origin, in meters. Google caps circles at 50 km. */
const BIAS_RADIUS_M = 50000;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const query = req.query.q;
  if (!query) {
    res.status(400).json({ error: 'Missing q parameter' });
    return;
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    res.status(501).json({ error: 'Places search is not configured' });
    return;
  }

  const body = {
    textQuery: `${query} bowling`,
    includedType: 'bowling_alley',
    maxResultCount: MAX_RESULTS,
  };

  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    body.locationBias = { circle: { center: { latitude: lat, longitude: lon }, radius: BIAS_RADIUS_M } };
  }

  try {
    const upstream = await fetch(PLACES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify(body),
    });
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', 'application/json');
    res.send(text);
  } catch (error) {
    res.status(502).json({ error: 'Places proxy failed', details: String(error) });
  }
}
