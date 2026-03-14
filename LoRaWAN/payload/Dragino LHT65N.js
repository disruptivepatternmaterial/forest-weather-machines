/**
 * LHT65N/S payload decoder for TTN. Dragino LoRaWAN Temperature & Humidity (built-in SHT + optional external).
 *
 * Uplink: fPort 2 = normal; fPort 3 = datalog poll reply (11-byte entries: Ext_data(2), Temp(2), Hum(2), flag(1), Unix(4)).
 *
 * Downlink (fPort 2, HEX payload). Ref: wiki.dragino.com LHT65N/S §4.
 *   Set transmit interval (3 bytes, big-endian sec):  01 00 00 1E  (30s)  /  01 00 00 3C  (60s)
 *   Set external sensor mode (e.g. Ext=6 ADC, timeout ms):  A2 00 03 E8  (1000 ms)
 *   Get firmware/device info (replies uplink):         26 01
 *   Set system time (Unix, 4 bytes):                  30 [4B timestamp]
 *   Time sync SYNCMOD=1:                              28 01
 *   Poll datalog (start_ts 4B + end_ts 4B + interval 1B):  31 [ts] [ts] [5-255]
 */
function str_pad(byte) {
  var zero = "00";
  var hex = byte.toString(16);
  var tmp = 2 - hex.length;
  return zero.substr(0, tmp) + hex + " ";
}

function getMyDate(ts) {
  var d = new Date(ts > 9999999999 ? ts : ts * 1000);
  var pad = function (n) { return n < 10 ? '0' + n : n; };
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' +
    pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
}

// LHT65N datalog entry: Ext_data(2), Temp(2), Hum(2), flag(1), Unix(4). Same field names as fPort 2.
function lht65nDatalogEntry(i, bytes) {
  var tempRaw = (bytes[i + 2] << 24) >> 16 | bytes[i + 3];
  var humRaw = ((bytes[i + 4] << 8) | bytes[i + 5]) & 0xfff;
  var ts = (bytes[i + 7] << 24) | (bytes[i + 8] << 16) | (bytes[i + 9] << 8) | bytes[i + 10];
  return {
    TempC_SHT: parseFloat((tempRaw / 100).toFixed(2)),
    Hum_SHT: parseFloat((humRaw / 10).toFixed(1)),
    Data_time: getMyDate(ts),
    timestamp: ts
  };
}

function decodeUplink(input) {
  var bytes = input.bytes;
  var data = {};

  if (input.fPort === 3) {
    var datalogArray = [];
    for (var j = 0; j + 11 <= bytes.length; j += 11) {
      datalogArray.push(lht65nDatalogEntry(j, bytes));
    }
    if (datalogArray.length === 0) {
      return { data: { Node_type: 'LHT65N', datalog: true, datalog_entries: [] } };
    }
    var first = datalogArray[0];
    return {
      data: {
        Node_type: 'LHT65N',
        datalog: true,
        TempC_SHT: first.TempC_SHT,
        Hum_SHT: first.Hum_SHT,
        Data_time: first.Data_time,
        timestamp: first.timestamp,
        datalog_entries: datalogArray
      }
    };
  }

  if (input.fPort !== 2) {
    return { errors: ["unknown FPort"] };
  }

  var Ext = bytes[6] & 0x0f;
  var Connect = (bytes[6] & 0x80) >> 7;

  if (Ext === 0x09) {
    data.TempC_DS = parseFloat(((((bytes[0] << 24) >> 16) | bytes[1]) / 100).toFixed(2));
    data.Bat_status = bytes[4] >> 6;
  } else {
    data.BatV = (((bytes[0] << 8) | bytes[1]) & 0x3fff) / 1000;
    data.Bat_status = bytes[0] >> 6;
  }

  if (Ext !== 0x0f) {
    data.TempC_SHT = parseFloat(((((bytes[2] << 24) >> 16) | bytes[3]) / 100).toFixed(2));
    data.Hum_SHT = parseFloat(((((bytes[4] << 8) | bytes[5]) & 0xfff) / 10).toFixed(1));
  }
  if (Connect === 1) {
    data.No_connect = "Sensor no connection";
  }

  if (Ext === 0) {
    data.Ext_sensor = "No external sensor";
  } else if (Ext === 1) {
    data.Ext_sensor = "Temperature Sensor";
    data.TempC_DS = parseFloat(((((bytes[7] << 24) >> 16) | bytes[8]) / 100).toFixed(2));
  } else if (Ext === 4) {
    data.Work_mode = "Interrupt Sensor send";
    data.Exti_pin_level = bytes[7] ? "High" : "Low";
    data.Exti_status = (bytes[8] !== 0);
  } else if (Ext === 5) {
    data.Work_mode = "Illumination Sensor";
    data.ILL_lx = (bytes[7] << 8) | bytes[8];
  } else if (Ext === 6) {
    data.Work_mode = "ADC Sensor";
    data.ADC_V = ((bytes[7] << 8) | bytes[8]) / 1000;
  } else if (Ext === 7) {
    data.Work_mode = "Interrupt Sensor count";
    data.Exit_count = (bytes[7] << 8) | bytes[8];
  } else if (Ext === 8) {
    data.Work_mode = "Interrupt Sensor count";
    data.Exit_count = (bytes[7] << 24) | (bytes[8] << 16) | (bytes[9] << 8) | bytes[10];
  } else if (Ext === 9) {
    data.Work_mode = "DS18B20 & timestamp";
    data.Systimestamp = (bytes[7] << 24) | (bytes[8] << 16) | (bytes[9] << 8) | bytes[10];
  } else if (Ext === 0x0f) {
    data.Work_mode = "DS18B20ID";
    data.ID = str_pad(bytes[2]) + str_pad(bytes[3]) + str_pad(bytes[4]) + str_pad(bytes[5]) + str_pad(bytes[7]) + str_pad(bytes[8]) + str_pad(bytes[9]) + str_pad(bytes[10]);
  }

  return { data: data };
}

function normalizeUplink(input) {
  var data = [];

  if (input.data.TempC_SHT) {
    data.push({
      air: {
        location: "indoor",
        temperature: input.data.TempC_SHT,
        relativeHumidity: input.data.Hum_SHT
      }
    });
  }

  if (input.data.TempC_DS) {
    var val = {
      air: {
        location: "outdoor",
        temperature: input.data.TempC_DS
      }
    };
    if (input.data.BatV) {
      val.battery = input.data.BatV;
    }
    data.push(val);
  }

  return { data: data };
}
  