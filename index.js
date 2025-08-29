const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.post('/nepa-proxy', async (req, res) => {
  try {
    const { coords, type, bufferSize } = req.body;
    const url = `https://nepassisttool.epa.gov/nepassist/nepaRESTbroker.aspx?ptitle=&coords=${coords}&type=${type}&newBufferDistance=${bufferSize}&newBufferUnits=miles&f=pjson`;
    console.log('NEPA Proxy Request:', url);
    const fetchRes = await fetch(url);
    if (!fetchRes.ok) {
      const text = await fetchRes.text();
      console.error('NEPA Proxy Error:', fetchRes.status, text);
      return res.status(502).json({ error: `Upstream error ${fetchRes.status}`, details: text });
    }
    const data = await fetchRes.json();
    res.json(data);
  } catch (err) {
    console.error('NEPA Proxy Exception:', err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// New proxy for ArcGIS geometry buffer endpoint. This forwards the JSON body
// exactly as received to the NEPA Assist ArcGIS buffer API and returns JSON.
app.post('/geometry-buffer-proxy', async (req, res) => {
  try {
    console.log('Geometry Buffer Proxy request body:', JSON.stringify(req.body));
    // The nepassist ArcGIS geometry endpoint was returning 404. The
    // nepaRESTbroker.aspx endpoint accepts the same coords/type/buffer params
    // as query parameters and has worked previously. Translate the incoming
    // JSON POST into the query-style GET used by nepaRESTbroker.aspx.
    const { coords, type, bufferSize } = req.body;
    // coords may be an array of [x,y] pairs or a comma string. Ensure it's a
    // flat comma-separated string like the existing /nepa-proxy produces.
    let coordsParam = '';
    if (Array.isArray(coords)) {
      // If coords is nested arrays, .toString() will flatten to "x,y,x2,y2,..."
      coordsParam = coords.toString();
    } else if (typeof coords === 'string') {
      coordsParam = coords;
    } else {
      coordsParam = '';
    }
    const url = `https://nepassisttool.epa.gov/nepassist/nepaRESTbroker.aspx?ptitle=&coords=${encodeURIComponent(coordsParam)}&type=${encodeURIComponent(type || '')}&newBufferDistance=${encodeURIComponent(bufferSize || '')}&newBufferUnits=miles&f=pjson`;
    // First attempt: try the ArcGIS JSON POST endpoint (preferred).
    const arcgisUrl = 'https://nepassisttool.epa.gov/nepassist/api/arcgis/geometry/buffer';
    try {
      console.log('Geometry Buffer Proxy attempting ArcGIS POST to:', arcgisUrl);
      const postResp = await fetch(arcgisUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
      });
      const ct = postResp.headers.get('content-type') || '';
      const bodyText = await postResp.text();
      if (!postResp.ok) {
        console.error('ArcGIS POST non-OK:', postResp.status, bodyText.slice(0, 400));
        // fall through to try broker GET
      } else {
        // Try to parse JSON, else return text
        if (ct.includes('application/json')) {
          try {
            return res.json(JSON.parse(bodyText));
          } catch (e) {
            console.warn('ArcGIS returned content-type JSON but parsing failed, returning raw text');
            return res.type('text').send(bodyText);
          }
        }
        return res.type('text').send(bodyText);
      }
    } catch (arcErr) {
      console.error('ArcGIS POST attempt failed:', arcErr && arcErr.message ? arcErr.message : arcErr);
      // Network error (ECONNREFUSED, timeout, DNS) - fall back to broker below
    }

    // Fallback: translate to the query-style nepaRESTbroker.aspx which the
    // existing /nepa-proxy uses. This sometimes succeeds when the ArcGIS
    // JSON endpoint is unreachable from the environment.
    try {
      console.log('Geometry Buffer Proxy forwarding to broker URL:', url);
      const brokerResp = await fetch(url);
      const text = await brokerResp.text();
      if (!brokerResp.ok) {
        console.error('Geometry Buffer Broker Upstream Error:', brokerResp.status, text.slice(0, 400));
        return res.status(502).json({ error: `Upstream error ${brokerResp.status}`, details: text });
      }
      // broker typically returns JSON
      try {
        return res.json(JSON.parse(text));
      } catch (e) {
        return res.type('text').send(text);
      }
    } catch (brokerErr) {
      console.error('Geometry Buffer Broker Exception:', brokerErr);
      // Return network error information when possible
      const causeMsg = brokerErr.cause && brokerErr.cause.message ? brokerErr.cause.message : brokerErr.message || String(brokerErr);
      return res.status(502).json({ error: 'Upstream network error', details: causeMsg });
    }
  } catch (err) {
    console.error('Geometry Buffer Proxy Exception:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Temporary diagnostic endpoint: probe outbound connectivity to a given host/path.
// Usage: GET /diag/probe?target=https://nepassisttool.epa.gov/
// Returns the status or detailed error encountered when trying to fetch the URL.
app.get('/diag/probe', async (req, res) => {
  const target = req.query.target;
  if (!target) return res.status(400).json({ error: 'missing target query param' });
  try {
    console.log('Diag probe to:', target);
    const resp = await fetch(target, { method: 'GET' });
    const text = await resp.text();
    return res.json({ ok: resp.ok, status: resp.status, statusText: resp.statusText, bodySnippet: text.slice(0, 200) });
  } catch (err) {
    console.error('Diag probe error for', target, err);
    // Include cause information when available (undici provides .cause for network errors)
    return res.status(502).json({ error: err.message, cause: err.cause && err.cause.message ? err.cause.message : err.cause || null });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
