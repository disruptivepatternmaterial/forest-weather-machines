/**
 * Payload decoder for RAK2560 WisNode Sensor Hub + RK900-09 Miniature Ultrasonic Weather Station.
 * Device: https://docs.rakwireless.com/product-categories/wisnode/weather-station/datasheet/
 *
 * Payload format: Cayenne LPP–style. Per sensor: Channel (1 byte) + Type (1 byte) + Data (2 bytes).
 *   Ch 1: Wind Speed    type 0xBE (190) × 0.01 → m/s
 *   Ch 2: Wind Direction type 0xBF (191) × 1   → °
 *   Ch 3: Temperature   type 0x67 (103) × 0.1  → °C
 *   Ch 4: Humidity      type 0x70 (112) × 0.1 → %RH
 *   Ch 5: Air Pressure  type 0x73 (115) × 0.1  → hPa
 *   Hub voltage        type 0xBB (187) × 0.01  → V (RAK2560 sends this in same payload)
 *
 * For TTN/TTS: Application payload formatter → Uplink → JavaScript.
 */
"use strict";

function decodeUplink(input) {
  var warnings = [];
  var errors = [];
  var bytes = ensureByteArray(input.bytes);
  if (bytes.length === 0) {
    return { data: {}, warnings: warnings, errors: ["Empty or invalid payload"] };
  }
  try {
    var data = lppDecodeToFlat(bytes);
    return { data: data, warnings: warnings, errors: errors };
  } catch (e) {
    return {
      data: {},
      warnings: warnings,
      errors: [e.message || "Decode failed"]
    };
  }
}

function ensureByteArray(bytes) {
  if (bytes === null || bytes === undefined) return [];
  if (typeof bytes === "string") {
    var s = bytes.replace(/\s/g, "");
    if (s.length === 0) return [];
    if (/^[0-9A-Fa-f]+$/.test(s) && s.length % 2 === 0) {
      var out = [];
      for (var i = 0; i < s.length; i += 2) {
        var n = parseInt(s.substr(i, 2), 16);
        if (isNaN(n)) return [];
        out.push(n & 0xff);
      }
      return out;
    }
    try {
      var binary = atob(s);
      var arr = [];
      for (var k = 0; k < binary.length; k++) arr.push(binary.charCodeAt(k) & 0xff);
      return arr;
    } catch (e) { return []; }
  }
  if (typeof bytes.length === "number") {
    var result = [];
    for (var j = 0; j < bytes.length; j++) {
      var b = bytes[j];
      result.push((typeof b === "number" && !isNaN(b)) ? (b & 0xff) : 0);
    }
    return result;
  }
  return [];
}

var WX_TYPES = {
  103: { size: 2, name: "temperature", signed: true, divisor: 10 },
  112: { size: 2, name: "humidity_prec", signed: false, divisor: 10 },
  115: { size: 2, name: "barometer", signed: false, divisor: 10 },
  187: { size: 2, name: "hub_voltage", signed: false, divisor: 100 },
  190: { size: 2, name: "wind_speed", signed: false, divisor: 100 },
  191: { size: 2, name: "wind_direction", signed: false, divisor: 1 }
};

function arrayToDecimal(stream, isSigned, divisor) {
  var value = 0;
  for (var i = 0; i < stream.length; i++) {
    if (stream[i] > 0xff) throw new Error("Byte value overflow");
    value = (value << 8) | stream[i];
  }
  if (isSigned) {
    var edge = 1 << (stream.length * 8);
    var max = (edge - 1) >> 1;
    value = (value > max) ? value - edge : value;
  }
  return value / divisor;
}

function lppDecode(bytes) {
  var sensors = [];
  var i = 0;
  while (i < bytes.length) {
    var channel = bytes[i++];
    var typeId = bytes[i++];
    var type = WX_TYPES[typeId];
    if (!type) {
      throw new Error("Unknown sensor type: " + typeId);
    }
    var raw = bytes.slice(i, i + type.size);
    i += type.size;
    var value = arrayToDecimal(raw, type.signed, type.divisor);
    sensors.push({ channel: channel, name: type.name, value: value });
  }
  return sensors;
}

function lppDecodeToFlat(bytes) {
  var sensors = lppDecode(bytes);
  var data = {};
  for (var idx = 0; idx < sensors.length; idx++) {
    var s = sensors[idx];
    data[s.name + "_" + s.channel] = s.value;
  }
  return data;
}
