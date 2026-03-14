/**
 * RAK10701-Plus payload formatter for The Things Network (TTN).
 * Decodes the 10-byte GPS field-test payload on fPort 1 or fPort 5.
 * Matches RAKwireless_Standardized_Payload (RAK10701-TTN-Helium-payload-decoder.js):
 * same encoding math and quality gate (only expose position when hdop < 2 and sats >= 5).
 *
 * Paste into: TTN Console → Application my-app-tobi → Payload formatters → Uplink.
 */

function decodeUplink(input) {
  var bytes = input.bytes;
  var fPort = input.fPort;
  var decoded = {};
  var warnings = [];
  var errors = [];

  if ((fPort === 1 || fPort === 5) && bytes && bytes.length >= 10) {
    var lonSign = (bytes[0] >> 7) & 0x01 ? -1 : 1;
    var latSign = (bytes[0] >> 6) & 0x01 ? -1 : 1;
    var encLat = ((bytes[0] & 0x3f) << 17) + (bytes[1] << 9) + (bytes[2] << 1) + (bytes[3] >> 7);
    var encLon = ((bytes[3] & 0x7f) << 16) + (bytes[4] << 8) + bytes[5];
    var hdop = bytes[8] / 10;
    var sats = bytes[9];
    var maxHdop = 2;
    var minSats = 5;

    if (hdop < maxHdop && sats >= minSats) {
      decoded.latitude = latSign * (encLat * 108 + 53) / 10000000;
      decoded.longitude = lonSign * (encLon * 215 + 107) / 10000000;
      decoded.altitude = ((bytes[6] << 8) + bytes[7]) - 1000;
      decoded.accuracy = (hdop * 5 + 5) / 10;
      decoded.hdop = hdop;
      decoded.sats = sats;
    } else {
      decoded.error = "Need more GPS precision (hdop must be <" + maxHdop +
        " & sats must be >= " + minSats + ") current hdop: " + hdop + " & sats:" + sats;
      decoded.hdop = hdop;
      decoded.sats = sats;
    }
  }

  return { data: decoded, warnings: warnings, errors: errors };
}
