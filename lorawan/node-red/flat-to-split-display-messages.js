// Node-RED function: split flat payload into 4 messages (Humidity, Temperature_F, Temperature_C, Pressure_hPa).
// Input: msg.payload = { Room, Floor, ..., Humidity, Temperature_F, Temperature_C, Pressure_hPa, reading_timestamp_utc, mqtt_topic, ... }
// Output: 4 messages on same output; each has topic, payload, qos, retain, ts (epoch from reading_timestamp_utc), parts.

const p = msg.payload;
if (!p || typeof p !== 'object') {
  return null;
}

const topic = p.mqtt_topic || msg.topic;
if (!topic) return null;

let ts = p.reading_timestamp_utc;
if (typeof ts === 'number' && !Number.isNaN(ts)) {
  ts = ts < 1e12 ? ts : Math.floor(ts / 1000);
} else if (ts != null && ts !== '') {
  const ms = Date.parse(ts);
  ts = Number.isNaN(ms) ? null : Math.floor(ms / 1000);
} else {
  ts = null;
}

const METRIC_KEYS = ['Humidity', 'Temperature_F', 'Temperature_C', 'Pressure_hPa'];
const count = METRIC_KEYS.length;
const partsId = (ts != null ? String(ts) : String(Date.now())) + '-' + String(Math.random()).slice(2, 11);

const out = METRIC_KEYS.map((key, index) => ({
  topic: topic,
  payload: p[key] !== undefined ? p[key] : null,
  qos: 0,
  retain: false,
  ts: ts,
  parts: {
    id: partsId,
    type: 'object',
    key: key,
    index: index,
    count: count
  }
}));

for (var i = 0; i < out.length; i++) {
  node.send(out[i]);
}
return null;
