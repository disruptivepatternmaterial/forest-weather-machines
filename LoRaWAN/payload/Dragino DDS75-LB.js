/**
 * DDS75-LB/LS payload decoder for TTN. Dragino LoRaWAN Distance Detection Sensor (ultrasonic).
 *
 * Uplink: fPort 2 (sensor), 3 (datalog), 5 (device status), 6 (detect mode data).
 *
 * Downlink (send as HEX payload; fPort varies by server, often same as uplink or 2):
 *   Get device status (device replies on fPort 5):  fPort 2  payload  26 01
 *   Set transmit interval (e.g. 30s):              fPort 2  payload  01 00 00 1E
 *   Set transmit interval (e.g. 60s):              fPort 2  payload  01 00 00 3C
 *   Interrupt mode off:                             fPort 2  payload  06 00 00 00
 *   Interrupt mode rising edge:                     fPort 2  payload  06 00 00 03
 *   Poll datalog (start_ts 4B + end_ts 4B + interval_sec 1B):  fPort 2  payload  31 [ts_start] [ts_end] [5-255]
 *   Set time (Unix timestamp, 6 bytes):            fPort 2  payload  30 [4B ts]
 *   Delta detect mode (v1.3+):                     fPort 2  payload  FB 02 00 01 00 1E 0A  (e.g. 1s sample, 30cm threshold, 10 samples)
 *   Debug mode (sends 20 raw readings):            fPort 2  payload  F1 01
 * Ref: wiki.dragino.com DDS75-LB/LS User Manual §2.6.4, §3.3.
 */
function datalog(i, bytes) {
    var value1 = (bytes[0 + i] << 8 | bytes[1 + i]);
    var value2 = bytes[2 + i] << 8 | bytes[3 + i];
    var distance_mm = (bytes[4 + i] << 8 | bytes[5 + i]) / 10;
    var flag_d = (bytes[6 + i] & 0x01) === 0x01;
    var flag_e = ((bytes[6 + i] >> 1) & 0x01) === 0x01;
    var flag_f = (bytes[6 + i] & 0x40) === 0x40;
    var time = getMyDate((bytes[7 + i] << 24 | bytes[8 + i] << 16 | bytes[9 + i] << 8 | bytes[10 + i]).toString(10));

    return {
        value1: value1,
        value2: value2,
        distance_mm: distance_mm,
        flag_d: flag_d,
        flag_e: flag_e,
        flag_f: flag_f,
        time: time
    };
}

function Detect(i, bytes) {
    return (bytes[0 + i] << 8 | bytes[1 + i]);
}

function getzf(c_num) {
    if (parseInt(c_num) < 10)
        c_num = '0' + c_num;

    return c_num;
}

function getMyDate(str) {
    var c_Date;
    if (str > 9999999999)
        c_Date = new Date(parseInt(str));
    else
        c_Date = new Date(parseInt(str) * 1000);

    var c_Year = c_Date.getFullYear(),
        c_Month = c_Date.getMonth() + 1,
        c_Day = c_Date.getDate(),
        c_Hour = c_Date.getHours(),
        c_Min = c_Date.getMinutes(),
        c_Sen = c_Date.getSeconds();
    var c_Time = c_Year + '-' + getzf(c_Month) + '-' + getzf(c_Day) + ' ' + getzf(c_Hour) + ':' + getzf(c_Min) + ':' + getzf(c_Sen);

    return c_Time;
}

function Decoder(bytes, port) {
    if (port === 0x02) {
        if (bytes[0] & 0x10) {
            var value = (bytes[0] << 8 | bytes[1]) & 0x0FFF;
            var batV = value / 1000;
            var additionalDistanceData = [];
            var endIndex = bytes.length - 4;
            var maxIndex = Math.min(8 + 40, endIndex);
            for (var idx = 8; idx < maxIndex; idx += 2) {
                value = bytes[idx] << 8 | bytes[idx + 1];
                additionalDistanceData.push(value);
            }
            var i_flag = bytes[bytes.length - 4];
            value = bytes[bytes.length - 3] << 8 | bytes[bytes.length - 2];
            if (value & 0x8000) {
                value = value - 0x10000;
            }
            var temp_DS18B20 = parseFloat((value / 10).toFixed(2));
            var s_flag = bytes[bytes.length - 1];
            return {
                Bat: batV,
                Additional_Distance_Data: additionalDistanceData,
                Interrupt_flag: i_flag,
                TempC_DS18B20: temp_DS18B20,
                Sensor_flag: s_flag
            };
        } else {
            var val = (bytes[0] << 8 | bytes[1]) & 0x3FFF;
            var batV2 = val / 1000;
            var distance = bytes[2] << 8 | bytes[3];
            var i_flag2 = bytes[4];
            val = bytes[5] << 8 | bytes[6];
            if (val & 0x8000) {
                val = val - 0x10000;
            }
            var temp2 = parseFloat((val / 100).toFixed(2));
            var s_flag2 = bytes[7];
            return {
                Node_type: "DDS75-LB",
                Bat: batV2,
                Distance: distance,
                Interrupt_flag: i_flag2,
                TempC_DS18B20: temp2,
                Sensor_flag: s_flag2
            };
        }
    }
    if (port === 0x03) {
        var pnack = ((bytes[0] >> 7) & 0x01) === 1;
        var datalogArray = [];
        for (var j = 0; j + 11 <= bytes.length; j += 11) {
            datalogArray.push(datalog(j, bytes));
        }
        return {
            Node_type: "DDS75-LB",
            DATALOG: datalogArray,
            PNACKMD: pnack
        };
    }
    if (port === 0x05) {
        var sensor = (bytes[0] === 0x27) ? "DDS75-LB" : undefined;
        var sub_band = (bytes[4] === 0xff) ? null : bytes[4];
        var freq_band_map = { 1: "EU868", 2: "US915", 3: "IN865", 4: "AU915", 5: "KZ865", 6: "RU864", 7: "AS923", 8: "AS923_1", 9: "AS923_2", 10: "AS923_3", 11: "CN470", 12: "EU433", 13: "KR920", 14: "MA869", 15: "AS923_4" };
        var freq_band = freq_band_map[bytes[3]];
        var firm_ver = (bytes[1] & 0x0f) + "." + (bytes[2] >> 4 & 0x0f) + "." + (bytes[2] & 0x0f);
        var bat = (bytes[5] << 8 | bytes[6]) / 1000;
        return {
            SENSOR_MODEL: sensor,
            FIRMWARE_VERSION: firm_ver,
            FREQUENCY_BAND: freq_band,
            SUB_BAND: sub_band,
            BAT: bat
        };
    }
    if (port === 0x06) {
        var detectArray = [];
        for (var k = 0; k < bytes.length; k += 2) {
            detectArray.push(Detect(k, bytes));
        }
        return {
            Detect_Mode_Data: detectArray
        };
    }
}

function decodeUplink(input) {
    return { data: Decoder(input.bytes, input.fPort) };
}