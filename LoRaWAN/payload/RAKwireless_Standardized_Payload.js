/**
 * RAKwireless Standardized Payload decoder for The Things Stack (TTN).
 *
 * Decodes Cayenne LPP–style payloads used by many RAK devices (RAK10701, WisBlock
 * sensors, etc.). Supports standard and RAK-specific IPSO/LPP types (temperature,
 * humidity, GPS, voltage, soil moisture, wind, PM2.5, etc.).
 *
 * Refs:
 *   https://github.com/RAKWireless/RAKwireless_Standardized_Payload/blob/main/RAKwireless_Standardized_Payload.js
 *   https://docs.rakwireless.com/product-categories/wisnode/rak2560/payload-decoder/
 *   https://www.thethingsindustries.com/docs/integrations/payload-formatters/javascript/
 *   https://www.thethingsindustries.com/docs/integrations/payload-formatters/create/
 *
 * Usage: Application or End Device payload formatter → Uplink → Formatter type: JavaScript
 * Paste this file (or its decodeUplink + dependencies) as the uplink formatter.
 *
 * Output: flat decoded_payload keys like temperature_1, humidity_1, gps_1, location_1, altitude_1.
 */
"use strict";

function decodeUplink(input) {
  var warnings = [];
  var errors = [];
  var bytes = ensureByteArray(input.bytes);
  if (bytes === null || bytes === undefined || bytes.length === 0) {
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

/**
 * TTN may pass bytes as number[], hex string, or base64 string.
 * Returns a plain array of numbers 0–255.
 */
function ensureByteArray(bytes) {
  if (bytes === null || bytes === undefined) return [];
  if (typeof bytes === "string") {
    var s = bytes.replace(/\s/g, "");
    if (s.length === 0) return [];
    if (s.length % 2 !== 0 && s.length % 4 !== 0) return [];
    var out = [];
    var isHex = /^[0-9A-Fa-f]+$/.test(s);
    if (isHex && s.length % 2 === 0) {
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
    } catch (e) { return []; }
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

/**
 * RAKwireless Standardized Payload (Cayenne LPP–extended) decoder.
 * Decodes to flat object: name_channel = value (e.g. temperature_1, humidity_2).
 */
function lppDecodeToFlat(bytes) {
  var sensors = lppDecode(bytes);
  var response = {};
  for (var idx = 0; idx < sensors.length; idx++) {
    var field = sensors[idx];
    response[field.name + "_" + field.channel] = field.value;
  }
  return response;
}

function arrayToDecimal(stream, is_signed, divisor) {
  var value = 0;
  for (var i = 0; i < stream.length; i++) {
    if (stream[i] > 0xFF) throw new Error("Byte value overflow");
    value = (value << 8) | stream[i];
  }
  if (is_signed) {
    var edge = 1 << (stream.length * 8);
    var max = (edge - 1) >> 1;
    value = (value > max) ? value - edge : value;
  }
  value /= divisor;
  return value;
}

var SENSOR_TYPES = {
  0: { size: 1, name: "digital_in", signed: false, divisor: 1 },
  1: { size: 1, name: "digital_out", signed: false, divisor: 1 },
  2: { size: 2, name: "analog_in", signed: true, divisor: 100 },
  3: { size: 2, name: "analog_out", signed: true, divisor: 100 },
  16: { size: 2, name: "nitrogen", signed: false, divisor: 1 },
  17: { size: 2, name: "phosphorus", signed: false, divisor: 1 },
  18: { size: 2, name: "potassium", signed: false, divisor: 1 },
  19: { size: 2, name: "salinity", signed: false, divisor: 1 },
  20: { size: 2, name: "dissolved_oxygen", signed: false, divisor: 100 },
  21: { size: 2, name: "orp", signed: false, divisor: 10 },
  22: { size: 2, name: "cod", signed: false, divisor: 1 },
  23: { size: 2, name: "turbidity", signed: false, divisor: 1 },
  24: { size: 2, name: "no3", signed: false, divisor: 10 },
  25: { size: 2, name: "nh4+", signed: false, divisor: 100 },
  26: { size: 2, name: "bod", signed: false, divisor: 1 },
  27: { size: 2, name: "accel-x", signed: true, divisor: 1 },
  28: { size: 2, name: "accel-y", signed: true, divisor: 1 },
  29: { size: 2, name: "accel-z", signed: true, divisor: 1 },
  100: { size: 4, name: "generic", signed: false, divisor: 1 },
  101: { size: 2, name: "illuminance", signed: false, divisor: 1 },
  102: { size: 1, name: "presence", signed: false, divisor: 1 },
  103: { size: 2, name: "temperature", signed: true, divisor: 10 },
  104: { size: 1, name: "humidity", signed: false, divisor: 2 },
  105: { size: 2, name: "air_quality_index", signed: false, divisor: 1 },
  112: { size: 2, name: "humidity_prec", signed: true, divisor: 10 },
  113: { size: 6, name: "accelerometer", signed: true, divisor: 1000 },
  115: { size: 2, name: "barometer", signed: false, divisor: 10 },
  116: { size: 2, name: "voltage", signed: false, divisor: 100 },
  117: { size: 2, name: "current", signed: false, divisor: 1000 },
  118: { size: 4, name: "frequency", signed: false, divisor: 1 },
  119: { size: 4, name: "precipitation", signed: false, divisor: 1 },
  120: { size: 1, name: "percentage", signed: false, divisor: 1 },
  121: { size: 2, name: "altitude", signed: true, divisor: 1 },
  125: { size: 2, name: "concentration", signed: false, divisor: 1 },
  126: { size: 3, name: "rak_device_serial_number", signed: false, divisor: 1 },
  127: { size: 4, name: "high_precision_ec", signed: false, divisor: 1000 },
  128: { size: 2, name: "power", signed: false, divisor: 1 },
  130: { size: 4, name: "distance", signed: false, divisor: 1000 },
  131: { size: 4, name: "energy", signed: false, divisor: 1000 },
  132: { size: 2, name: "direction", signed: false, divisor: 1 },
  133: { size: 4, name: "time", signed: false, divisor: 1 },
  134: { size: 6, name: "gyrometer", signed: true, divisor: 100 },
  135: { size: 3, name: "colour", signed: false, divisor: 1 },
  136: { size: 9, name: "gps", signed: true, divisor: [10000, 10000, 100] },
  137: { size: 11, name: "gps", signed: true, divisor: [1000000, 1000000, 100] },
  138: { size: 2, name: "voc", signed: false, divisor: 1 },
  142: { size: 1, name: "switch", signed: false, divisor: 1 },
  144: { size: 2, name: "wind_speed", signed: false, divisor: 100 },
  145: { size: 2, name: "strikes", signed: false, divisor: 1 },
  152: { size: 1, name: "capacity", signed: false, divisor: 1 },
  153: { size: 2, name: "dc_current", signed: false, divisor: 100 },
  154: { size: 2, name: "dc_voltage", signed: false, divisor: 100 },
  156: { size: 2, name: "moisture", signed: false, divisor: 10 },
  158: { size: 2, name: "wind_speed", signed: false, divisor: 100 },
  159: { size: 2, name: "wind_direction", signed: false, divisor: 1 },
  161: { size: 2, name: "high_precision_ph", signed: false, divisor: 100 },
  162: { size: 2, name: "ph", signed: false, divisor: 10 },
  163: { size: 2, name: "pyranometer", signed: false, divisor: 1 },
  184: { size: 1, name: "capacity_batt", signed: false, divisor: 1 },
  185: { size: 2, name: "dc_current_batt", signed: false, divisor: 100 },
  186: { size: 2, name: "dc_voltage_batt", signed: false, divisor: 100 },
  187: { size: 2, name: "hub_voltage", signed: false, divisor: 100 },
  188: { size: 2, name: "soil_moist", signed: false, divisor: 10 },
  190: { size: 2, name: "wind_speed", signed: false, divisor: 100 },
  191: { size: 2, name: "wind_direction", signed: false, divisor: 1 },
  192: { size: 2, name: "soil_ec", signed: false, divisor: 1000 },
  193: { size: 2, name: "soil_ph_h", signed: false, divisor: 100 },
  194: { size: 2, name: "soil_ph_l", signed: false, divisor: 10 },
  195: { size: 2, name: "pyranometer", signed: false, divisor: 1 },
  203: { size: 1, name: "light", signed: false, divisor: 1 },
  227: { size: 2, name: "pm10", signed: false, divisor: 1 },
  228: { size: 2, name: "pm2_5", signed: false, divisor: 1 },
  229: { size: 2, name: "orientation", signed: true, divisor: 10 },
  233: { size: 2, name: "noise", signed: false, divisor: 10 },
  243: { size: 2, name: "raw2byte", signed: false, divisor: 1 },
  244: { size: 4, name: "raw4byte", signed: false, divisor: 1 },
  245: { size: 4, name: "float", signed: false, divisor: 1 },
  246: { size: 4, name: "int32", signed: true, divisor: 1 },
  247: { size: 4, name: "uint32", signed: false, divisor: 1 }
};

function lppDecode(bytes) {
  var sensors = [];
  var i = 0;
  while (i < bytes.length) {
    var s_no = bytes[i++];
    var s_type = bytes[i++];
    var type = SENSOR_TYPES[s_type];
    if (typeof type === "undefined") {
      throw new Error("Unknown sensor type: " + s_type);
    }
    if (typeof type.size !== "number") {
      throw new Error("Unsupported variable-length type: " + s_type);
    }
    var s_value;
    switch (s_type) {
      case 113:
      case 134:
        s_value = {
          x: arrayToDecimal(bytes.slice(i, i + 2), type.signed, type.divisor),
          y: arrayToDecimal(bytes.slice(i + 2, i + 4), type.signed, type.divisor),
          z: arrayToDecimal(bytes.slice(i + 4, i + 6), type.signed, type.divisor)
        };
        break;
      case 136:
        s_value = {
          latitude: arrayToDecimal(bytes.slice(i, i + 3), type.signed, type.divisor[0]),
          longitude: arrayToDecimal(bytes.slice(i + 3, i + 6), type.signed, type.divisor[1]),
          altitude: arrayToDecimal(bytes.slice(i + 6, i + 9), type.signed, type.divisor[2])
        };
        break;
      case 137:
        s_value = {
          latitude: arrayToDecimal(bytes.slice(i, i + 4), type.signed, type.divisor[0]),
          longitude: arrayToDecimal(bytes.slice(i + 4, i + 8), type.signed, type.divisor[1]),
          altitude: arrayToDecimal(bytes.slice(i + 8, i + 11), type.signed, type.divisor[2])
        };
        sensors.push({ channel: s_no, type: s_type, name: "location", value: "(" + s_value.latitude + "," + s_value.longitude + ")" });
        sensors.push({ channel: s_no, type: s_type, name: "altitude", value: s_value.altitude });
        i += type.size;
        continue;
      case 135:
        s_value = {
          r: arrayToDecimal(bytes.slice(i, i + 1), type.signed, type.divisor),
          g: arrayToDecimal(bytes.slice(i + 1, i + 2), type.signed, type.divisor),
          b: arrayToDecimal(bytes.slice(i + 2, i + 3), type.signed, type.divisor)
        };
        break;
      default:
        s_value = arrayToDecimal(bytes.slice(i, i + type.size), type.signed, type.divisor);
        break;
    }
    sensors.push({ channel: s_no, type: s_type, name: type.name, value: s_value });
    i += type.size;
  }
  return sensors;
}
