# LoRaWAN + Node-RED pipeline and common flat format

This doc summarizes the end-to-end work: **TTN payload decoders**, **Node-RED normalization to a common flat format**, **MQTT topics**, and **downstream use** (Windy, HA, etc.). Everything lives under `lorawan/` for a single place to resume work.

---

## 1. Directory layout

```
lorawan/
├── README.md                          # Stack + quick start
├── RAK2560_weather_station_settings.md # WisToolBox + LoRaWAN settings for RAK2560
├── docs/
│   ├── PIPELINE-AND-NODE-RED.md       # This file
│   └── RAK10701-FIELD-TESTER.md       # RAK10701-Plus with TTN (gateway + EMQX + HA; no Node-RED)
├── payload/                           # TTN payload formatters (paste into TTN Console)
│   ├── rak-wx-station-default.js      # RAK2560 + RK900-09 weather (recommended for Wx)
│   ├── RAKwireless_Standardized_Payload.js  # Generic RAK LPP (many device types)
│   ├── Dragino DDS75-LB.js            # Snow depth / distance
│   ├── Dragino S31B-LS.js             # Temp/humidity/door
│   ├── Dragino LHT65N.js
│   ├── Dragino S31-LB.js
│   ├── RAK rak10701-plus.js           # RAK10701 Field Tester (GPS only, fPort 1)
│   └── VS370-915M.js
└── node-red/                         # Node-RED assets (copy into Function nodes / import)
    ├── ttn-uplink-to-flat.js          # TTN uplink → common flat payload
    ├── particle-webhook-to-flat.js    # Particle payload → same flat payload
    ├── station.js                     # Windy.com observation URL from flat or HA state
    └── lorawanproc.json               # Flow: TTN MQTT in → extract & store (last 20) → debug
```

---

## 2. TTN payload formatters (upstream)

Used in **TTN Console → Application (or device) → Payload formatter → Uplink → JavaScript**.

| File | Use for | Notes |
|------|--------|--------|
| **rak-wx-station-default.js** | RAK2560 + RK900-09 weather station | Ch 1–5 + hub_voltage (type 187). Types: 103 temp, 112 humidity, 115 pressure, 187 hub_voltage, 190 wind speed, 191 wind direction. **Must include type 187** or decode fails. |
| **RAKwireless_Standardized_Payload.js** | Any RAK LPP device (WisBlock, etc.) | Full type set. Handles hex/base64 `input.bytes`. RAK2560 value/channel swap fix inside. |
| **Dragino DDS75-LB.js** | Snow depth / distance sensor | Outputs `Distance` (mm), battery, temp. |
| **Dragino S31B-LB / S31-LB** | Temp/humidity (and door) | Outputs `TempC_SHT31`, `Hum_SHT31`, `BatV`, etc. |
| **RAK rak10701-plus.js** | RAK10701-Plus Field Tester | fPort 1 or 5; 10-byte GPS. Quality gate: only expose position when hdop &lt; 2 and sats ≥ 5 (else `error` + hdop/sats). Aligned with [RAKwireless_Standardized_Payload](https://github.com/RAKWireless/RAKwireless_Standardized_Payload) (RAK10701-TTN-Helium-payload-decoder.js). Paste into TTN Console → Application → Payload formatters → Uplink. |

**RAK2560 decode failure "Unknown sensor type: 187"**  
→ Device sends hub voltage (type 187). Use `rak-wx-station-default.js` (includes 187) or ensure `RAKwireless_Standardized_Payload.js` in TTN has the 187 entry.

**RAK Weather Station datasheet**  
[Weather Station Datasheet](https://docs.rakwireless.com/product-categories/wisnode/weather-station/datasheet/) — payload is Channel (1) + Type (1) + Data (2). Temp 0x67, Humidity 0x70, Pressure 0x73; hub voltage is extra in same payload.

---

## 3. Common flat format (one pipeline for TTN + Particle)

Both **TTN** and **Particle** are normalized to the same schema so one downstream flow (MQTT publish, InfluxDB, HA, Windy) can consume either.

### Output shape

```json
{
  "Room": "WRidgeNTwin",
  "Floor": "TwinsForestLands",
  "Location": "Mountains",
  "Dev_Name": "North Twin West Ridge",
  "Humidity": 82,
  "Temperature_F": 30.38,
  "Temperature_C": -0.9,
  "Pressure_hPa": null,
  "Sea_Level_Pressure_hPa": null,
  "AQI100": null,
  "AQI25": null,
  "device_id": "la666054870",
  "reading_timestamp_utc": "2026-03-08T22:38:51Z",
  "battery_voltage_V": 4.11,
  "battery_soc_pct": null,
  "latitude": 48.71778666666667,
  "longitude": -122.0132138833333,
  "altitude": 1439,
  "Distance_mm": null,
  "Wind_speed_m_s": 5.56,
  "Wind_direction_deg": 88,
  "source": "ttn",
  "mqtt_topic": "baargsiitsch/environment/Mountains/TwinsForestLands/WRidgeNTwin/NorthTwinWestRidge/display",
  "extra": { "Door_status": "OPEN", "Node_type": "S31B-LS", ... }
}
```

- **Room, Floor, Location** — From TTN: parsed from `attributes.mqttpath` (path after `environment/`). From Particle: registry by `device_name` (e.g. Wx1 → Bowman, wx1).
- **mqtt_topic** — TTN: `mqttpath` + `"/"` + name (no spaces) + `"/display"`. Particle: built from path registry (e.g. `baargsiitsch/environment/Mountains/TwinsForestLands/Bowman/wx1/display`).
- **Location (lat/lon/alt)** — TTN: prefer `locations["frm-payload"]` (SOURCE_GPS), else `locations.user` (SOURCE_REGISTRY); else null. Particle: from `location` + `elevation_m`.
- **Distance_mm** — From decoded payload when present (e.g. Dragino DDS75); null otherwise.
- **extra** — TTN: any decoded key not mapped to the flat fields (e.g. Door_status, Node_type). Particle: undefined.

---

## 4. Node-RED functions

### 4.1 `ttn-uplink-to-flat.js`

- **Input:** `msg.payload` = TTN uplink JSON (`end_device_ids`, `uplink_message.decoded_payload`, `received_at`, `locations`, `uplink_message.attributes` / `end_device_ids.attributes`).
- **Output:** `msg.payload` = common flat object above; `msg.topic` = `mqtt_topic` (for MQTT out).
- **Where:** Paste into a Function node after TTN webhook or MQTT in (`v3/.../devices/+/up`). Then feed an MQTT out node (topic from `msg.topic`) or other consumers.

**TTN device attributes (set in TTN Console):**

- **mqttpath** — Base path, e.g. `baargsiitsch/environment/Mountains/TwinsForestLands/WRidgeNTwin`. Topic becomes `mqttpath/<name_no_spaces>/display`.
- **name** — Display name (spaces removed for topic segment).

### 4.2 `particle-webhook-to-flat.js`

- **Input:** `msg.payload` = Particle webhook body (e.g. `device`, `device_id`, `device_name`, `weather`, `sensor_data`, `location`, `reading_timestamp_utc`, `elevation_m`).
- **Output:** Same flat shape; `source: 'particle'`; `msg.topic` = MQTT topic from registry (Wx1/Wx2).
- **Where:** After HTTP in (webhook) or MQTT in that receives Particle payloads. Same downstream as TTN.

**Particle path registry (inside script):**  
`pathByDevice`: Wx1 → Bowman/wx1, Wx2 → NTwin/wx2. Extend for more devices.

### 4.3 `station.js` (Windy)

- **Input:** Either normalized entry `{ sensorName, deviceId, data: { TempC_SHT31, Hum_SHT31, ... }, ts }` or reads HA states for Wx1 (temp, humidity, pressure, published_at).
- **Output:** `msg.url` = Windy API observation URL; `msg.method = 'GET'`. Output 1 = fresh (age ≤ 1 h), output 2 = stale.
- **Config:** `ONE_HOUR`, `stationId` (Windy station ID) at top of script.
- **Where:** Function node → HTTP request (GET) → optional logging. Wire fresh output to HTTP request.

### 4.4 `lorawanproc.json`

- **Flow:** MQTT in on `v3/my-app-tobi@ttn/devices/+/up` + inject tests → “Extract and store (last 20)” → debug.
- **Extract and store:** Parses TTN uplink, builds `{ sensorName, deviceId, receivedAt, data, signal, locationUser, ts }`, keeps last 20 per sensor in `global.lorawan`, forwards each entry.
- **Separate branch:** “Every 15 min” → “Latest per sensor (<2h)” → debug (payload of recent sensors).
- **Import:** Node-RED → Menu → Import → paste/clipboard or select `lorawanproc.json`. Create a tab “lorawan_tab_001” if needed; broker node references `mqtt.tableman.com` (edit to your broker).

To **add normalization to flat format** in this flow: after “Extract and store” (or after MQTT in), add a Function node with the contents of `ttn-uplink-to-flat.js`. Its input expects the full TTN uplink object (with `end_device_ids`, `uplink_message`); so either feed the raw MQTT payload into it or the stored entry reshaped back to uplink shape. Easiest: run `ttn-uplink-to-flat` on the **raw** uplink from MQTT in, then optionally store or publish `msg.payload` + `msg.topic`.

---

## 5. Field aliases (TTN → flat)

`ttn-uplink-to-flat.js` maps various decoder outputs into the common names:

| Flat field | Decoder keys (first match wins) |
|------------|----------------------------------|
| Temperature_C | temperature_3, TempC_SHT31, TempC_DS18B20, temperature, temp_c |
| Humidity | Hum_SHT31, humidity_prec_4, humidity_4, humidity, humidity_pct, humidity_rh |
| Pressure_hPa | barometer_5, pressure, pressure_hpa, barometer |
| Sea_Level_Pressure_hPa | sea_level_pressure_hpa, sea_level_pressure |
| battery_voltage_V | hub_voltage_77, BatV, Bat, battery_v, voltage |
| battery_soc_pct | battery_pct, soc, battery_percent |
| Distance_mm | Distance, distance_mm, distance |
| Wind_speed_m_s | wind_speed_1, wind_speed (m/s) |
| Wind_direction_deg | wind_direction_2, wind_direction (degrees 0–359) |

Unmapped decoded keys go into **extra**.

---

## 6. Quick reference: where to paste what

| What | Where |
|------|--------|
| RAK2560 / RK900-09 decoder | TTN Console → Application (or device 9181010k6060118006) → Payload formatter → Uplink → paste `payload/rak-wx-station-default.js` |
| **RAK10701-Plus decoder** | TTN Console → Application **my-app-tobi** → Payload formatters → Uplink → paste `payload/RAK rak10701-plus.js`. Then send activation downlink once (FPort 10, hex `76312E312E30`). |
| Generic RAK LPP decoder | TTN → Payload formatter → paste `payload/RAKwireless_Standardized_Payload.js` |
| TTN → flat | Node-RED Function node: paste `node-red/ttn-uplink-to-flat.js` |
| Particle → flat | Node-RED Function node: paste `node-red/particle-webhook-to-flat.js` |
| Windy station URL | Node-RED Function node: paste `node-red/station.js` |
| TTN store + latest | Node-RED Import: `node-red/lorawanproc.json` |
| **RAK10701-Plus full flow** | See §7 below; summary in `docs/RAK10701-FIELD-TESTER.md` |

---

## 7. RAK10701-Plus Field Tester: connection data on device (TTN)

Per [RAK10701-Plus Network Setup](https://docs.rakwireless.com/product-categories/wisgate/rak10701-plus/network-setup/), the **Field Test Data Processor Extension** on the RAK gateway connects to the **MQTT broker** (your local EMQX) to receive uplinks and publish downlinks. **No Node-RED is required.**

### One-time activation (device must send on f_port 1)

The device only sends the 10-byte GPS field-test payload on **f_port 1** after it has received an activation downlink. In **TTN Console** → Application **my-app-tobi** → **rak10701-plus** → **Downlink** tab, send **once**:

- **FPort:** 10  
- **Payload type:** Hex  
- **Payload (hex):** `76312E312E30` (ASCII `"v1.1.0"`)

After the device receives it, it will switch to sending the 10-byte GPS on **f_port 1**; the extension then processes those uplinks and sends stats downlinks.

### Payload formatter (TTN)

Paste the contents of **`lorawan/payload/RAK rak10701-plus.js`** into **TTN Console** → Application **my-app-tobi** → **Payload formatters** → **Uplink** (and save). Decodes the 10-byte GPS on f_port 1 or 5; applies the same quality gate as the official RAK decoder.

### Architecture (External LNS)

- **Field Tester** → **RAK7268V2** (Packet Forwarder / Basic Station) → **TTN** (Network Server).
- **EMQX** (mqtt.tableman.com) subscribes to TTN MQTT; rule **ttn_uplink_rak10701** republishes rak10701-plus uplinks to `v3/my-app-tobi@ttn/devices/rak10701-plus/up` so the extension receives them.
- **Extension** (on gateway) subscribes to that topic on EMQX and publishes downlinks to `v3/.../rak10701-plus/down`.
- **EMQX** rules **rak10701_down** and **ttn_downlink_replace** forward those to TTN so the device receives stats in its RX window.

### Gateway extension configuration (WisGateOS 2 → Extensions → Field Test Data Processor)

| Field | Value |
|-------|--------|
| LoRa Network Server | The Things Network |
| MQTT Broker Address | `mqtt.tableman.com` |
| Port | `1883` |
| Enable User Authentication | Off (unless your broker requires it) |
| Enable TLS | Off |
| Uplink Topic | `v3/my-app-tobi@ttn/devices/rak10701-plus/up` |
| Downlink Topic | `v3/my-app-tobi@ttn/devices/rak10701-plus/down` |

**Important:** Downlink topic must be exactly `.../down` (not `.../do` or truncated). Save changes on the gateway.

### EMQX (mqtt.tableman.com)

Config: **`docker/emqx/conf/conf.d/99-custom.hocon`**.

- **ttn_uplink_rak10701:** Messages from TTN bridge for rak10701-plus → republish to `v3/.../rak10701-plus/up` so the extension receives uplinks. Without this rule, the extension gets no uplinks and never publishes downlinks.
- **rak10701_down:** Messages on `v3/.../rak10701-plus/down` → republish to `.../down/replace`.
- **ttn_downlink_replace:** Messages on `v3/.../devices/+/down/replace` → forward to TTN via connector.

Restart EMQX after config changes.

### Device and f_port

The extension only processes uplinks on **f_port 1** (10-byte field-test payload) or **f_port 11**. Ensure the RAK10701-Plus has received the activation downlink (FPort 10, `76312E312E30`) so it sends on port 1. Uplinks on other ports (e.g. 5 with label-only payload) are ignored and no downlink is sent.

### Home Assistant

Sensors for the field tester are in **`docker/ha/config/mqtt.yaml`**: state_topic `v3/my-app-tobi@ttn/devices/rak10701-plus/up`. Templates use `uplink_message.decoded_payload` (latitude, longitude, altitude, accuracy, hdop, sats) with fallback to root-level `value_json.locations["frm-payload"]` when decoded_payload is missing. Entities: Location (with lat/lon in attributes), Altitude, GPS accuracy, HDOP, Satellites, Signal Strength (RSSI), Signal Quality (SNR), Gateway, Last Update.

### Min/Max distance on device

Distance (nearest/farthest gateway) on the field tester requires gateway positions. **Basic Station does not send gateway location to TTN.** Set the gateway's antenna location manually: **TTN Console** → **Gateways** → select your RAK7268V2 → **Location** → set latitude, longitude, altitude → Save. The extension may use that for distance if it queries TTN or has a gateway list; otherwise min/max distance can stay blank.

### References

- [RAK10701-Plus Network Setup](https://docs.rakwireless.com/product-categories/wisgate/rak10701-plus/network-setup/)
- [RAK10701-Plus Overview](https://docs.rakwireless.com/product-categories/wisgate/rak10701-plus/overview/)
- Field-tester flow details: **`lorawan/docs/RAK10701-FIELD-TESTER.md`**

---

## 8. References

- [RAK2560 Weather Station Datasheet](https://docs.rakwireless.com/product-categories/wisnode/weather-station/datasheet/)
- [RAK2560 payload decoder (TTS)](https://docs.rakwireless.com/product-categories/wisnode/rak2560/payload-decoder/)
- [TTN Payload formatters](https://www.thethingsindustries.com/docs/integrations/payload-formatters/)
- RAK2560 WisToolBox settings: `lorawan/RAK2560_weather_station_settings.md`
