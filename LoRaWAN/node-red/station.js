// Node-RED function: build Windy.com station observation URL from normalized sensor payload or HA state.
// Input: msg.payload = normalized entry { sensorName, deviceId, data: { TempC_SHT31, Hum_SHT31, ... }, ts } OR uses HA states for Wx1.
// Output: msg to http request node; msg.url = Windy API URL; output 1 = fresh (<1h), output 2 = stale.
// Config: ONE_HOUR, stationId (Windy station ID). See: lorawan/docs/PIPELINE-AND-NODE-RED.md

/************ CONFIG ************/
const ONE_HOUR = 60 * 60 * 1000;
const stationId = "4ks5xFmh";
/********************************/

/************ HELPERS ************/
function calculateDewPoint(temperature, humidity) {
    if (humidity < 0 || humidity > 100) {
        throw new Error("Humidity must be between 0 and 100");
    }
    return temperature - ((100 - humidity) / 5);
}

function normalizeTimestamp(ts) {
    if (!ts) return NaN;
    let t = Number(ts);
    if (!isNaN(t)) {
        if (t < 1e12) t = t * 1000;
        return t;
    }
    const match = ts.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
    if (match) {
        const [_, year, month, day, hour, min, sec] = match.map(Number);
        return Date.UTC(year, month - 1, day, hour, min, sec);
    }
    const parsed = Date.parse(ts);
    return isNaN(parsed) ? NaN : parsed;
}
/********************************/

/************ READ INPUT ************/
const payload = msg.payload;
const isNormalized = payload && payload.sensorName != null && payload.deviceId != null && payload.data && typeof payload.data === "object";

// Influx key/value payload: { Humidity, Pressure_hPa, Temperature_C, ts? } (we use Temperature_C only), timestamp in msg.ts or payload.ts or payload.time or payload._time
const isInfluxPayload = payload && typeof payload === "object" && "Humidity" in payload && "Temperature_C" in payload;

let temp, rh, pressure_hpa, ts_raw;

if (isInfluxPayload) {
    temp = parseFloat(payload.Temperature_C);
    rh = parseFloat(payload.Humidity);
    pressure_hpa = payload.Pressure_hPa != null ? parseFloat(payload.Pressure_hPa) : NaN;
    const tsIn = msg.ts != null ? msg.ts : (payload.time != null ? payload.time : (payload.ts != null ? payload.ts : payload._time));
    if (typeof tsIn === "number") {
        ts_raw = tsIn < 1e12 ? tsIn * 1000 : tsIn;
    } else if (tsIn != null && tsIn !== "") {
        const parsed = Date.parse(tsIn);
        ts_raw = isNaN(parsed) ? NaN : parsed;
    } else {
        ts_raw = NaN;
    }
} else if (isNormalized) {
    const d = payload.data;
    temp = typeof d.TempC_SHT31 === "number" ? d.TempC_SHT31 : (typeof d.TempC_DS18B20 === "number" ? d.TempC_DS18B20 : parseFloat(d.TempC_SHT31 ?? d.TempC_DS18B20));
    rh = typeof d.Hum_SHT31 === "number" ? d.Hum_SHT31 : parseFloat(d.Hum_SHT31 ?? d.Hum_SHT);
    pressure_hpa = (d.pressure != null || d.Pressure_hpa != null) ? parseFloat(d.pressure ?? d.Pressure_hpa) : NaN;
    const tsIn = payload.ts ?? payload.receivedAt;
    ts_raw = typeof tsIn === "number" ? tsIn : (tsIn != null ? new Date(tsIn).getTime() : null);
} else {
    temp = rh = pressure_hpa = ts_raw = NaN;
}
/***************************************/

let timestamp = typeof ts_raw === "number" ? ts_raw : normalizeTimestamp(ts_raw);
const now = Date.now();
if (isNaN(temp) || isNaN(rh) || isNaN(timestamp)) {
    const parts = [];
    if (isNaN(temp)) parts.push("temp");
    if (isNaN(rh)) parts.push("humidity");
    if (isNaN(timestamp)) parts.push("timestamp");
    node.warn("Invalid sensor or timestamp data: " + parts.join(", ") + " (Influx path needs msg.ts or payload.ts or payload.time or payload._time)");
    return null;
}
if (isNaN(pressure_hpa)) pressure_hpa = 0;
const ageMs = now - timestamp;

const dewpoint = calculateDewPoint(temp, rh);
const pressure = pressure_hpa * 100;

msg.method = "GET";
const tsSeconds = Math.floor(timestamp / 1000);
let url = `https://stations.windy.com/api/v2/observation/update?id=${stationId}&ts=${tsSeconds}&temp=${temp}&humidity=${rh}&dewpoint=${dewpoint}`;
if (pressure >= 50000) url += `&pressure=${pressure}`;
msg.url = url;
msg.timestamp = timestamp;
msg.age_ms = ageMs;

if (ageMs <= ONE_HOUR && ageMs >= 0) {
    msg.fresh = true;
    msg.status = "fresh";
    return [msg, null];
} else {
    msg.fresh = false;
    msg.status = "stale";
    return [null, msg];
}
