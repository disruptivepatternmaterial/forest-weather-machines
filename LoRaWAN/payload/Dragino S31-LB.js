/**
 * S31-LB payload decoder for TTN. Dragino LoRaWAN Temperature & Humidity (SHT31, 3m probe).
 * Same payload as S31B-LB/LS; see Dragino "S31/S31B-LB/LS" user manual.
 *
 * Uplink: fPort 2 (11 bytes), 3 (datalog), 5 (device status).  fPort 2: Bat(2)|Ts(4)|Alarm&MOD&PA8(1)|Temp(2)|Hum(2).
 *
 * Downlink (fPort 2, HEX):
 *   Get device status (replies fPort 5):  26 01
 *   Set interval 30s / 60s:              01 00 00 1E  /  01 00 00 3C
 *   Get alarm settings:                  0E 01
 *   Temp alarm >30°C / Humidity <70%:    0C 01 00 1E  /  0C 02 46 00
 *   Alarm interval 30 min:              0D 00 1E
 *   Interrupt off / rising:               06 00 00 00  /  06 00 00 03
 *   Poll datalog:                        31 [ts_start 4B] [ts_end 4B] [interval_sec]
 *   Set time:                            30 [4B Unix ts]
 *   Time sync SYNCMOD=1:                 28 01
 */
function datalog(i, bytes) {
  var humRaw = (bytes[2 + i] << 8) | bytes[3 + i];
  var tempRaw = bytes[4 + i] << 24 >> 16 | bytes[5 + i];
  var humidity = parseFloat((humRaw / 10).toFixed(1));
  var temperature_C = parseFloat((tempRaw / 10).toFixed(1));
  var flags = bytes[6 + i];
  var alarm = (flags & 0x01) === 0x01;
  var pa8_level = (flags & 0x80) ? "Low" : "High";
  var time = getMyDate((bytes[7 + i] << 24 | bytes[8 + i] << 16 | bytes[9 + i] << 8 | bytes[10 + i]).toString(10));

  return {
    temperature_C: temperature_C,
    humidity: humidity,
    pa8_level: pa8_level,
    alarm: alarm,
    time: time
  };
}

function getzf(c_num){ 
  if(parseInt(c_num) < 10)
    c_num = '0' + c_num; 

  return c_num; 
}

function getMyDate(str){ 
  var c_Date;
  if(str > 9999999999)
    c_Date = new Date(parseInt(str));
  else 
    c_Date = new Date(parseInt(str) * 1000);
  
  var c_Year = c_Date.getFullYear(), 
  c_Month = c_Date.getMonth()+1, 
  c_Day = c_Date.getDate(),
  c_Hour = c_Date.getHours(), 
  c_Min = c_Date.getMinutes(), 
  c_Sen = c_Date.getSeconds();
  var c_Time = c_Year +'-'+ getzf(c_Month) +'-'+ getzf(c_Day) +' '+ getzf(c_Hour) +':'+ getzf(c_Min) +':'+getzf(c_Sen); 
  
  return c_Time;
}

function Decoder(bytes, port) {
  if (port === 0x02) {
    var decode = {};
    var mode = (bytes[6] & 0x7C) >> 2;
    if (mode === 0) {
      decode.BatV = (bytes[0]<<8 | bytes[1])/1000;
      decode.EXTI_Trigger = (bytes[6] & 0x01) === 0x01;
      decode.Door_status = (bytes[6] & 0x80) ? "CLOSE" : "OPEN";
      decode.TempC_SHT31 = parseFloat(((bytes[7]<<24>>16 | bytes[8])/10).toFixed(1));
      decode.Hum_SHT31 = parseFloat(((bytes[9]<<8 | bytes[10])/10).toFixed(1));
      decode.Data_time = getMyDate((bytes[2]<<24 | bytes[3]<<16 | bytes[4]<<8 | bytes[5]).toString(10));
    } else if (mode === 31) {
      decode.SHTEMP_MIN = bytes[7]<<24>>24;
      decode.SHTEMP_MAX = bytes[8]<<24>>24;
      decode.SHHUM_MIN = bytes[9];
      decode.SHHUM_MAX = bytes[10];
    }
    decode.Node_type = "S31-LB";
    if (bytes.length === 11) {
      return decode;
    }
  }
  if (port === 0x03) {
    var pnack = ((bytes[6]>>7) & 0x01) === 1;
    var datalogArray = [];
    for (var j = 0; j + 11 <= bytes.length; j += 11) {
      datalogArray.push(datalog(j, bytes));
    }
    return {
      Node_type: "S31-LB",
      DATALOG: datalogArray,
      PNACKMD: pnack
    };
  }
  if (port === 0x05) {
    var sensor = (bytes[0] === 0x0A) ? "S31-LB" : undefined;
    var sub_band = bytes[4] === 0xff ? null : bytes[4];
    var freq_band_map = { 1: "EU868", 2: "US915", 3: "IN865", 4: "AU915", 5: "KZ865", 6: "RU864", 7: "AS923", 8: "AS923_1", 9: "AS923_2", 10: "AS923_3", 11: "CN470", 12: "EU433", 13: "KR920", 14: "MA869", 15: "AS923_4" };
    var freq_band = freq_band_map[bytes[3]];
    var firm_ver = (bytes[1]&0x0f) + "." + (bytes[2]>>4&0x0f) + "." + (bytes[2]&0x0f);
    var bat = (bytes[5]<<8 | bytes[6])/1000;
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
  return { data: Decoder(input.bytes, input.fPort) };
}