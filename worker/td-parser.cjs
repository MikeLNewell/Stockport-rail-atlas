'use strict';

/* Network Rail TD messages represent berth events, not GPS locations. */
const SUPPORTED = new Set(['CA', 'CB', 'CC']);
function parseTD(body, permittedAreas = []) {
  let events;
  try { events = JSON.parse(Buffer.isBuffer(body) ? body.toString('utf8') : String(body)); }
  catch { return []; }
  if (!Array.isArray(events)) events = [events];
  const areas = new Set(permittedAreas.map(s => String(s).trim().toUpperCase()).filter(Boolean));
  const output = [];
  for (const wrapper of events) {
    if (!wrapper || typeof wrapper !== 'object') continue;
    for (const [wrapperKey, payload] of Object.entries(wrapper)) {
      if (!wrapperKey.endsWith('_MSG') || !payload || typeof payload !== 'object') continue;
      const type = String(payload.msg_type || wrapperKey.replace('_MSG','')).toUpperCase();
      const area = String(payload.area_id || '').toUpperCase();
      if (!SUPPORTED.has(type) || !area || (areas.size && !areas.has(area))) continue;
      const t = Number(payload.time);
      if (!Number.isFinite(t) || t <= 0) continue;
      // Feed specifies milliseconds since Unix epoch.
      const when = new Date(t).toISOString();
      output.push({
        area_id: area,
        msg_type: type,
        from_berth: payload.from == null ? null : String(payload.from),
        to_berth: payload.to == null ? null : String(payload.to),
        berth: payload.to == null ? (payload.from == null ? null : String(payload.from)) : String(payload.to),
        description: payload.descr == null ? null : String(payload.descr),
        event_time: when,
        raw: payload
      });
    }
  }
  return output;
}
module.exports = {parseTD};
