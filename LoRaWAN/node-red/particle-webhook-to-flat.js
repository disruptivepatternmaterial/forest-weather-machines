// Node-RED function: map Particle weather payload to same flat structure as TTN normalized output.
// Input: msg.payload = { device, device_id, device_name, weather, sensor_data, location, reading_timestamp_utc, elevation_m, ... }
// Output: msg.payload = { Room, Floor, Location, Dev_Name, Humidity, Temperature_F, Temperature_C, Pressure_hPa, ... source, mqtt_topic, extra } (same shape as TTN path)
// See: lorawan/docs/PIPELINE-AND-NODE-RED.md

const p = msg.payload;
if (!p || typeof p !== 'object') {
  msg.payload = null;
  return msg;
}

const toNum = (v) => (v != null && v !== '') ? Number(v) : null;
const toTempF = (c) => (c != null && !Number.isNaN(c)) ? (Number(c) * 9 / 5) + 32 : null;

const weather = p.weather || {};
const device = p.device || {};
const tempC = weather.temperature_C != null ? Number(weather.temperature_C) : null;
const tempF = toTempF(tempC);

const deviceName = p.device_name || '';

// Path: baargsiitsch/environment/LOCATION/FLOOR/ROOM/DEVICE/display — Room/Floor/Location in payload match these segments.
const pathByDevice = {
  'Wx1': { Location: 'Mountains', Floor: 'TwinsForestLands', Room: 'Bowman', deviceSegment: 'wx1' },
  'Wx2': { Location: 'Mountains', Floor: 'TwinsForestLands', Room: 'NTwin', deviceSegment: 'wx2' }
};
const pathSegments = pathByDevice[deviceName];
const location = pathSegments ? pathSegments.Location : 'Mountains';
const floor = pathSegments ? pathSegments.Floor : 'Baker';
const room = pathSegments ? pathSegments.Room : deviceName || 'Unknown';
const deviceSegment = pathSegments ? pathSegments.deviceSegment : (deviceName || 'unknown').replace(/\s+/g, '');
const mqttTopic = pathSegments
  ? `baargsiitsch/environment/${location}/${floor}/${room}/${deviceSegment}/display`
  : null;
msg.topic = mqttTopic;

// reading_timestamp_utc: normalize to epoch seconds (number) or null
let readingTimestampUtc = p.reading_timestamp_utc;
if (typeof readingTimestampUtc === 'number' && !Number.isNaN(readingTimestampUtc)) {
  readingTimestampUtc = readingTimestampUtc < 1e12 ? readingTimestampUtc : Math.floor(readingTimestampUtc / 1000);
} else if (readingTimestampUtc != null && readingTimestampUtc !== '') {
  const ms = Date.parse(readingTimestampUtc);
  readingTimestampUtc = Number.isNaN(ms) ? null : Math.floor(ms / 1000);
} else {
  readingTimestampUtc = null;
}

msg.payload = {
  Room: room,
  Floor: floor,
  Location: location,
  Dev_Name: deviceName,
  Humidity: toNum(weather.humidity_pct),
  Temperature_F: tempF,
  Temperature_C: tempC,
  Pressure_hPa: toNum(weather.pressure_hPa),
  Sea_Level_Pressure_hPa: toNum(weather.sea_level_pressure_hPa),
  AQI100: null,
  AQI25: null,
  device_id: p.device_id,
  reading_timestamp_utc: readingTimestampUtc,
  battery_voltage_V: device.battery ? toNum(device.battery.voltage_V) : null,
  battery_soc_pct: device.battery ? toNum(device.battery.soc_pct) : null,
  latitude: p.location ? toNum(p.location.latitude) : null,
  longitude: p.location ? toNum(p.location.longitude) : null,
  altitude: p.elevation_m != null ? toNum(p.elevation_m) : null,
  Distance_mm: null,
  Wind_speed_m_s: null,
  Wind_direction_deg: null,
  source: 'particle',
  mqtt_topic: mqttTopic,
  extra: undefined
};

return msg;
