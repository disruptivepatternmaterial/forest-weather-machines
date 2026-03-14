/**
 * RAK10703 WisBlock Earthquake Sensor — TTN uplink payload formatter.
 *
 * Decodes extended Cayenne LPP from RAK10703 (RAK12027 D7S seismic + optional
 * RAK1901 temp/humidity). Channel IDs per beegee-tokyo/WisBlock-Seismic-Sensor.
 *
 * Null-safe: no undefined in output; safe for TTN Payload formatters (JavaScript).
 * Use strict null checks: === null / !== null (and !== undefined where needed).
 * Usage: TTN Console → Application → Payload formatters → Uplink → Formatter type: JavaScript
 * Paste this entire file as the uplink formatter.
 */
"use strict";

function decodeUplink(input) {
  var warnings = [];
  var errors = [];
  var data = {};

  if (input === null || input === undefined || typeof input !== "object") {
    errors.push("Missing or invalid input");
    return { data: data, warnings: warnings, errors: errors };
  }

  var bytes = ensureByteArray((input.bytes !== null && input.bytes !== undefined) ? input.bytes : null);
  if (bytes.length === 0) {
    errors.push("Empty or invalid payload");
    return { data: data, warnings: warnings, errors: errors };
  }

  try {
    var parsed = parseLPP(bytes);
    if (parsed.battery_voltage_V !== null && parsed.battery_voltage_V !== undefined) data.battery_voltage_V = parsed.battery_voltage_V;
    if (parsed.humidity_rh !== null && parsed.humidity_rh !== undefined) data.humidity_rh = parsed.humidity_rh;
    if (parsed.temperature_c !== null && parsed.temperature_c !== undefined) data.temperature_c = parsed.temperature_c;
    if (parsed.earthquake_active !== null && parsed.earthquake_active !== undefined) data.earthquake_active = parsed.earthquake_active;
    if (parsed.si_value_m_s !== null && parsed.si_value_m_s !== undefined) data.si_value_m_s = parsed.si_value_m_s;
    if (parsed.pga_m_s2 !== null && parsed.pga_m_s2 !== undefined) data.pga_m_s2 = parsed.pga_m_s2;
    if (parsed.shutoff_alert !== null && parsed.shutoff_alert !== undefined) data.shutoff_alert = parsed.shutoff_alert;
    if (parsed.collapse_alert !== null && parsed.collapse_alert !== undefined) data.collapse_alert = parsed.collapse_alert;
  } catch (e) {
    errors.push((e !== null && e !== undefined && e.message !== null && e.message !== undefined) ? e.message : "Decode failed");
  }

  return { data: data, warnings: warnings, errors: errors };
}

function ensureByteArray(bytes) {
  if (bytes === null || bytes === undefined) return [];
  if (typeof bytes === "string") {
    var s = bytes.replace(/\s/g, "");
    if (s.length === 0) return [];
    if (s.length % 2 !== 0) return [];
    var out = [];
    var isHex = /^[0-9A-Fa-f]+$/.test(s);
    if (isHex) {
      for (var i = 0; i < s.length; i += 2) {
        var n = parseInt(s.substr(i, 2), 16);
        if (isNaN(n)) return [];
        out.push(n & 0xff);
      }
      return out;
    }
    try {
      var binary = atob(s);
      for (var k = 0; k < binary.length; k++) out.push(binary.charCodeAt(k) & 0xff);
      return out;
    } catch (err) { return []; }
  }
  if (typeof bytes.length === "number") {
    var arr = [];
    for (var j = 0; j < bytes.length; j++) {
      var b = bytes[j];
      arr.push((typeof b === "number" && !isNaN(b)) ? (b & 0xff) : 0);
    }
    return arr;
  }
  return [];
}

/** LPP type sizes: channel (1) + type (1) + payload. Cayenne: 2=analog_in, 103=temp(0x67), 104=hum(0x68), 102=presence(0x66), 116=voltage(0x74). */
var LPP_SIZES = {
  2: 2,
  102: 1,
  103: 2,
  104: 1,
  116: 2
};

function parseLPP(bytes) {
  var out = {};
  var i = 0;
  while (i + 2 <= bytes.length) {
    var ch = bytes[i];
    var typ = bytes[i + 1];
    var size = LPP_SIZES[typ];
    if (size === null || size === undefined || i + 2 + size > bytes.length) break;
    var payload = bytes.slice(i + 2, i + 2 + size);
    i += 2 + size;

    if (ch === 1 && typ === 116) {
      out.battery_voltage_V = (payload[0] << 8 | payload[1]) / 100;
    } else if (ch === 2 && typ === 104) {
      out.humidity_rh = payload[0] / 2;
    } else if (ch === 3 && typ === 103) {
      var raw = (payload[0] << 8 | payload[1]);
      if (raw > 32767) raw -= 65536;
      out.temperature_c = raw / 10;
    } else if (ch === 43 && typ === 102) {
      out.earthquake_active = payload[0] === 1;
    } else if (ch === 44 && typ === 2) {
      var raw44 = (payload[0] << 8 | payload[1]);
      if (raw44 > 32767) raw44 -= 65536;
      out.si_value_m_s = (raw44 / 100) / 10;
    } else if (ch === 45 && typ === 2) {
      var raw45 = (payload[0] << 8 | payload[1]);
      if (raw45 > 32767) raw45 -= 65536;
      out.pga_m_s2 = (raw45 / 100) / 10;
    } else if (ch === 46 && typ === 102) {
      out.shutoff_alert = payload[0] === 1;
    } else if (ch === 47 && typ === 102) {
      out.collapse_alert = payload[0] === 1;
    }
  }
  return out;
}
