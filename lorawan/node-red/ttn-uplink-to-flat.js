// Node-RED function: normalize TTN/The Things Stack uplink webhook to common flat format.
// Input: msg.payload = TTN uplink JSON (end_device_ids, uplink_message, received_at, ...).
// Output: msg.payload = same flat structure as particle-webhook-to-flat.js so one pipeline can consume both.
// Topic: mqttpath + '/' + (name, spaces removed) + '/display'. Room, Floor, Location derived from mqttpath when present.
// Location: prefer SOURCE_GPS (locations["frm-payload"]), then SOURCE_REGISTRY (locations.user); else lat/lon/alt null.
// See: lorawan/docs/PIPELINE-AND-NODE-RED.md

const p = msg.payload;
if (!p || typeof p !== 'object') {
  msg.payload = null;
  return msg;
}

const endDeviceIds = p.end_device_ids;
const uplink = p.uplink_message;
if (!endDeviceIds || !uplink || typeof uplink.decoded_payload !== 'object') {
  return msg;
}

const deviceId = endDeviceIds.device_id || '';
const attrs = Object.assign({}, endDeviceIds.attributes || {}, uplink.attributes || {});
const decoded = uplink.decoded_payload;
const receivedAt = p.received_at || uplink.received_at || '';

// Derive Room, Floor, Location from mqttpath so they match the topic.
let room = 'Unknown', floor = 'Baker', location = 'Mountains';
const mqttpathRaw = (attrs.mqttpath != null && attrs.mqttpath !== '') ? String(attrs.mqttpath).trim() : null;
if (mqttpathRaw) {
  const parts = mqttpathRaw.split('/').filter(Boolean);
  const envIdx = parts.indexOf('environment');
  if (envIdx >= 0 && parts.length >= envIdx + 3) {
    location = parts[envIdx + 1];
    floor = parts[envIdx + 2];
    room = parts[envIdx + 3];
  }
}

const devNameRaw = attrs.name || deviceId || 'unknown';
const devName = devNameRaw.replace(/\s+/g, '');
const mqttTopic = mqttpathRaw ? `${mqttpathRaw}/${devName}/display` : null;
msg.topic = mqttTopic;

const toNum = (v) => (v != null && v !== '') ? Number(v) : null;
const toTempF = (c) => (c != null && !Number.isNaN(c)) ? (Number(c) * 9 / 5) + 32 : null;

const fieldAliases = {
  Temperature_C: ['temperature_3', 'TempC_SHT31', 'TempC_DS18B20', 'temperature', 'temp_c'],
  Humidity:       ['Hum_SHT31', 'humidity_prec_4', 'humidity_4', 'humidity', 'humidity_pct', 'humidity_rh'],
  Pressure_hPa:  ['barometer_5', 'pressure', 'pressure_hpa', 'barometer'],
  Sea_Level_Pressure_hPa: ['sea_level_pressure_hpa', 'sea_level_pressure'],
  battery_voltage_V: ['hub_voltage_77', 'BatV', 'Bat', 'battery_v', 'voltage'],
  battery_soc_pct: ['battery_pct', 'soc', 'battery_percent'],
  Distance_mm:   ['Distance', 'distance_mm', 'distance'],
  Wind_speed_m_s: ['wind_speed_1', 'wind_speed'],
  Wind_direction_deg: ['wind_direction_2', 'wind_direction']
};

function firstMapped(aliases, decoded) {
  for (const key of aliases) {
    if (decoded[key] != null && decoded[key] !== '') return toNum(decoded[key]);
  }
  return null;
}

const temperatureC = firstMapped(fieldAliases.Temperature_C, decoded);
const humidity = firstMapped(fieldAliases.Humidity, decoded);
const pressureHpa = firstMapped(fieldAliases.Pressure_hPa, decoded);
const seaLevelHpa = firstMapped(fieldAliases.Sea_Level_Pressure_hPa, decoded);
const batteryV = firstMapped(fieldAliases.battery_voltage_V, decoded);
const batterySoc = firstMapped(fieldAliases.battery_soc_pct, decoded);
const distanceMm = firstMapped(fieldAliases.Distance_mm, decoded);
const windSpeedMs = firstMapped(fieldAliases.Wind_speed_m_s, decoded);
const windDirectionDeg = firstMapped(fieldAliases.Wind_direction_deg, decoded);

// Location: SOURCE_GPS (frm-payload) if present and non-empty, else SOURCE_REGISTRY (user), else all null.
let lat = null, lon = null, alt = null;
const locs = p.locations || uplink.locations;
if (locs) {
  const gps = locs['frm-payload'];
  const reg = locs.user;
  const hasGps = gps && (gps.latitude != null || gps.longitude != null);
  const hasReg = reg && (reg.latitude != null || reg.longitude != null);
  if (hasGps) {
    lat = toNum(gps.latitude);
    lon = toNum(gps.longitude);
    alt = toNum(gps.altitude);
  } else if (hasReg) {
    lat = toNum(reg.latitude);
    lon = toNum(reg.longitude);
    alt = toNum(reg.altitude);
  }
}

const readingTimestampUtc = receivedAt ? (typeof receivedAt === 'string' ? receivedAt.replace(/\.\d+Z$/, 'Z') : String(receivedAt)) : null;

const mappedKeys = new Set();
Object.values(fieldAliases).forEach(keys => keys.forEach(k => mappedKeys.add(k)));
const extra = {};
for (const [k, v] of Object.entries(decoded)) {
  if (!mappedKeys.has(k) && v !== undefined) extra[k] = v;
}

msg.payload = {
  Room: room,
  Floor: floor,
  Location: location,
  Dev_Name: devNameRaw,
  Humidity: humidity,
  Temperature_F: toTempF(temperatureC),
  Temperature_C: temperatureC,
  Pressure_hPa: pressureHpa,
  Sea_Level_Pressure_hPa: seaLevelHpa,
  AQI100: null,
  AQI25: null,
  device_id: deviceId,
  reading_timestamp_utc: readingTimestampUtc,
  battery_voltage_V: batteryV,
  battery_soc_pct: batterySoc,
  latitude: lat,
  longitude: lon,
  altitude: alt,
  Distance_mm: distanceMm,
  Wind_speed_m_s: windSpeedMs,
  Wind_direction_deg: windDirectionDeg,
  source: 'ttn',
  mqtt_topic: mqttTopic,
  extra: Object.keys(extra).length ? extra : undefined
};

return msg;
