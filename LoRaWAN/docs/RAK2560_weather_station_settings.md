# RAK2560 + RK900-09 Weather Station — Settings Reference

Device: RAK2560 WisNode Sensor Hub with RK900-09 Miniature Ultrasonic Weather Station Sensor.  
Configured via **WisToolBox** (Sensor Probe and LoRaWAN parameters). Threshold/interval configuration is **not** documented as available via TTN downlink; use the app.

---

## App setting names (WisToolBox)

Per-sensor screens use these exact labels:


| Label                                                     | Meaning                                                     |
| --------------------------------------------------------- | ----------------------------------------------------------- |
| **Sensor interval, s**                                    | Periodic uplink interval in seconds (60–86400).             |
| **Send periodic uplink**                                  | Send uplinks on the interval above.                         |
| **Send threshold trigger uplink**                         | Master toggle: use threshold-based uplinks for this sensor. |
| **Lower threshold, °F** / **Lower threshold, hPa** / etc. | Lower bound for threshold (units depend on sensor).         |
| **Send uplink if below threshold**                        | Send when value is below lower threshold.                   |
| **Upper threshold, °F** / **Upper threshold, hPa** / etc. | Upper bound for threshold.                                  |
| **Send uplink if above threshold**                        | Send when value is above upper threshold.                   |
| **Thresholds, °F** / **Thresholds, hPa**                  | Read-only summary of lower–upper range.                     |
| **Send uplink if between thresholds**                     | Send when value is inside the range (usually OFF).          |
| **FETCH DATA**                                            | Request a one-off uplink from the sensor.                   |
| **APPLY**                                                 | Send queued commands to the device.                         |


---

## Recommended preset (mountain / backcountry use)

Baseline: **1 h** periodic; threshold triggers only for temp, wind, and pressure.

### Temperature

- **Sensor interval, s:** `3600`
- **Send periodic uplink:** ON
- **Send threshold trigger uplink:** ON
- **Lower threshold, °F:** `30` (≈ −1 °C)
- **Send uplink if below threshold:** ON
- **Upper threshold, °F:** `34` (≈ +1 °C)
- **Send uplink if above threshold:** ON
- **Send uplink if between thresholds:** OFF

### Wind speed

- **Sensor interval, s:** `3600`
- **Send periodic uplink:** ON
- **Send threshold trigger uplink:** ON
- **Upper threshold** (m/s): `12.0`
- **Send uplink if above threshold:** ON
- **Lower threshold:** leave default
- **Send uplink if below threshold:** OFF
- **Send uplink if between thresholds:** OFF

### Pressure

- **Sensor interval, s:** `3600`
- **Send periodic uplink:** ON
- **Send threshold trigger uplink:** ON
- **Upper threshold, hPa:** set to a value **above** your lower threshold (e.g. `1100` or `1260`) so the app accepts the range. You can leave "Send uplink if above threshold" OFF.
- **Lower threshold, hPa:** `1005`
- **Send uplink if below threshold:** ON
- **Send uplink if above threshold:** OFF
- **Send uplink if between thresholds:** OFF

If you get an out-of-range error on Lower threshold: set **Upper threshold** first (e.g. 1100), then set Lower to 1005. The app may require Lower < Upper before it accepts either.

### Humidity

- **Sensor interval, s:** `3600`
- **Send periodic uplink:** ON
- **Send threshold trigger uplink:** OFF

### Wind direction

- **Sensor interval, s:** `3600`
- **Send periodic uplink:** ON
- **Send threshold trigger uplink:** OFF

After editing any sensor, tap **APPLY** and wait for “All commands applied successfully” (or “Message was confirmed”).

---

## LoRaWAN parameters (for robustness)

Set under **LORA & LORAWAN PARAMETERS** in WisToolBox. Expand **Global settings** for Join mode and Region; expand **LoRaWAN keys, ID, EUI** for OTAA keys. Then use the section below.

### Data on LoRaWAN® network

| Setting (exact label) | Recommended | Note |
|------------------------|-------------|------|
| **Confirm mode** | OFF | ON = confirmed uplinks; use OFF for periodic weather data to save battery and airtime. |
| **Confirm status** | (read-only) | Shows current confirmation state. |

### Join network

| Setting (exact label) | Recommended | Note |
|------------------------|-------------|------|
| **Enable Join Process** | ON | So the device can attempt to join. |
| **Automatic access** | ON | Rejoin automatically after power cycle or loss. |
| **Reattempt period (s)** | 8–30 | Delay between join retries (e.g. 8 or 10). |
| **Max number of reattempts** | 5–10 | Use &gt; 0 so the device retries; 0 can mean no retries and prevent rejoin. |

Tap **JOIN NETWORK** once to perform the initial join. After that, with Automatic access ON and Max reattempts &gt; 0, the device will rejoin on its own if needed.

### Other

- **Join mode:** OTAA (in Global settings).
- **Active region:** Match your gateway/TTN (e.g. US915, EU868).
- **ADR:** ON if shown.
- **Class:** A.

---

## Payload / TTN

- Uplink payload format: RAKwireless Standardized Payload (Cayenne LPP–style).  
- Decoder: use [payload/RAKwireless_Standardized_Payload.js](payload/RAKwireless_Standardized_Payload.js) in this repo as the TTN uplink formatter (JavaScript).  
- Weather station channel/type codes from the solution manual: Wind speed `0xBE`, Wind direction `0xBF`, Temperature `0x67`, Humidity `0x70`, Pressure `0x73`.

---

## References

- [Weather Station Solution User Manual](https://downloads.rakwireless.com/LoRa/SensorHub/Sensor%20Hub%20Solutions/Weather%20Station%20Solution%20User%20Manual.pdf) (RAK)
- [Weather Station Monitoring Solution overview](https://docs.rakwireless.com/product-categories/wisnode/weather-station/overview/)
- [RAK2560 on The Things Stack](https://www.thethingsindustries.com/docs/hardware/devices/models/rakwireless-rak2560/)

