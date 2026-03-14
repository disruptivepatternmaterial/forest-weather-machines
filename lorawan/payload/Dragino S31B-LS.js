/**
 * S31B-LS payload decoder for The Things Network (TTN / The Things Stack).
 *
 * Device: Dragino S31B-LS LoRaWAN Temperature & Humidity Sensor (solar + Li-ion, SHT31).
 * Same payload as S31-LB / S31B-LB; see Dragino "S31/S31B-LB/LS" user manual.
 *
 * Uplink: fPort 2 (11 bytes): Bat(2)|UnixTime(4)|Alarm&MOD&PA8(1)|Temp(2)|Hum(2).  fPort 3 = datalog, 5 = device status.
 *
 * Downlink (fPort 2, HEX payload):
 *   Get device status (replies fPort 5):  26 01
 *   Set transmit interval 30s:            01 00 00 1E
 *   Set transmit interval 60s:           01 00 00 3C
 *   Get alarm settings (replies fPort 2 mode 31):  0E 01
 *   Temp alarm above 30°C:               0C 01 00 1E
 *   Humidity alarm below 70%:            0C 02 46 00
 *   Alarm interval 30 min:              0D 00 1E
 *   Interrupt mode off:                  06 00 00 00
 *   Interrupt rising edge:               06 00 00 03
 *   Poll datalog (start_ts 4B + end_ts 4B + interval_sec 1B):  31 [ts_start] [ts_end] [5-255]
 *     Example (last 6 hours, 1 sample/min): 31 + uint32be(now-21600) + uint32be(now) + 0x3C
 *     e.g. now=1736280000: 31 67 7C 7B E0 67 7D 0E 60 3C
 *   Set system time (Unix, 6 bytes):     30 [4B timestamp]
 *   Time sync via MAC (SYNCMOD=1):      28 01
 *
 * Lat/lon/alt: No GPS; use TTN metadata. Ref: wiki.dragino.com S31/S31B-LB/LS §2.3, §2.5.4, §3.3.
 */

function getzf(c_num) {
  if (parseInt(c_num, 10) < 10) {
    c_num = '0' + c_num;
  }
  return c_num;
}

function getMyDate(str) {
  var c_Date;
  if (str > 9999999999) {
    c_Date = new Date(parseInt(str, 10));
  } else {
    c_Date = new Date(parseInt(str, 10) * 1000);
  }
  var c_Year = c_Date.getFullYear();
  var c_Month = c_Date.getMonth() + 1;
  var c_Day = c_Date.getDate();
  var c_Hour = c_Date.getHours();
  var c_Min = c_Date.getMinutes();
  var c_Sen = c_Date.getSeconds();
  return c_Year + '-' + getzf(c_Month) + '-' + getzf(c_Day) + ' ' +
    getzf(c_Hour) + ':' + getzf(c_Min) + ':' + getzf(c_Sen);
}

// S31 datalog entry: Bat(2), Hum(2), Temp(2), flag(1), Unix(4). Same field names as fPort 2 for MQTT/backend.
function datalogEntry(i, bytes) {
  var batMv = (bytes[i] << 8) | bytes[i + 1];
  var humRaw = (bytes[i + 2] << 8) | bytes[i + 3];
  var tempRaw = (bytes[i + 4] << 24) >> 16 | bytes[i + 5];
  var humidity = parseFloat((humRaw / 10).toFixed(1));
  var tempC = parseFloat((tempRaw / 10).toFixed(1));
  var flags = bytes[i + 6];
  var ts = (bytes[i + 7] << 24) | (bytes[i + 8] << 16) | (bytes[i + 9] << 8) | bytes[i + 10];
  return {
    BatV: batMv / 1000,
    TempC_SHT31: tempC,
    Hum_SHT31: humidity,
    Data_time: getMyDate(String(ts)),
    timestamp: ts,
    alarm: (flags & 0x01) === 0x01,
    PA8_level: (flags & 0x80) ? 'Low' : 'High'
  };
}

function Decoder(bytes, port) {
  if (port === 0x02) {
    var decode = {};
    var mode = (bytes[6] & 0x7C) >> 2;

    if (mode === 0) {
      decode.BatV = (bytes[0] << 8 | bytes[1]) / 1000;
      decode.EXTI_Trigger = (bytes[6] & 0x01) === 0x01;
      decode.Door_status = (bytes[6] & 0x80) ? 'CLOSE' : 'OPEN';
      decode.PA8_level = (bytes[6] & 0x80) ? 'Low' : 'High';
      decode.TempC_SHT31 = parseFloat(((bytes[7] << 24 >> 16 | bytes[8]) / 10).toFixed(1));
      decode.Hum_SHT31 = parseFloat(((bytes[9] << 8 | bytes[10]) / 10).toFixed(1));
      if (bytes.length >= 6) {
        var ts = (bytes[2] << 24) | (bytes[3] << 16) | (bytes[4] << 8) | bytes[5];
        decode.Data_time = getMyDate(String(ts));
        decode.timestamp = ts;
      }
    } else if (mode === 31) {
      decode.SHTEMP_MIN = bytes[7] << 24 >> 24;
      decode.SHTEMP_MAX = bytes[8] << 24 >> 24;
      decode.SHHUM_MIN = bytes[9];
      decode.SHHUM_MAX = bytes[10];
    }

    decode.Node_type = 'S31B-LS';
    if (bytes.length === 11) {
      return decode;
    }
    return decode;
  }

  if (port === 0x03) {
    var datalogArray = [];
    var j;
    for (j = 0; j + 11 <= bytes.length; j += 11) {
      datalogArray.push(datalogEntry(j, bytes));
    }
    if (datalogArray.length === 0) {
      return { Node_type: 'S31B-LS', datalog: true, datalog_entries: [] };
    }
    // First entry at top level so MQTT/backend see same shape as fPort 2; timestamp = device RTC (MAC-synced).
    var first = datalogArray[0];
    return {
      Node_type: 'S31B-LS',
      datalog: true,
      BatV: first.BatV,
      TempC_SHT31: first.TempC_SHT31,
      Hum_SHT31: first.Hum_SHT31,
      Data_time: first.Data_time,
      timestamp: first.timestamp,
      datalog_entries: datalogArray
    };
  }

  if (port === 0x05) {
    var sensor = (bytes[0] === 0x0A) ? 'S31B-LS' : undefined;
    var sub_band = bytes[4] === 0xff ? null : bytes[4];
    var freq_band_map = {
      1: 'EU868', 2: 'US915', 3: 'IN865', 4: 'AU915', 5: 'KZ865', 6: 'RU864',
      7: 'AS923', 8: 'AS923_1', 9: 'AS923_2', 10: 'AS923_3', 11: 'CN470',
      12: 'EU433', 13: 'KR920', 14: 'MA869', 15: 'AS923_4'
    };
    var freq_band = freq_band_map[bytes[3]];
    var firm_ver = (bytes[1] & 0x0f) + '.' + (bytes[2] >> 4 & 0x0f) + '.' + (bytes[2] & 0x0f);
    var bat = (bytes[5] << 8 | bytes[6]) / 1000;
    return {
      SENSOR_MODEL: sensor,
      FIRMWARE_VERSION: firm_ver,
      FREQUENCY_BAND: freq_band,
      SUB_BAND: sub_band,
      BAT: bat
    };
  }

  return {};
}

function decodeUplink(input) {
  var bytes = input.bytes;
  var fPort = input.fPort;
  if (!bytes || !bytes.length) {
    return { data: {}, errors: ['Empty payload'] };
  }
  var data = Decoder(bytes, fPort);
  return { data: data };
}
