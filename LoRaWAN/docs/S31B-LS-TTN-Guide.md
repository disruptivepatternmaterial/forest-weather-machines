# Dragino S31B-LS LoRaWAN Sensor — TTN Payload & Downlink Guide

Device: **Dragino S31B-LS** LoRaWAN Temperature & Humidity Sensor (solar + Li-ion, SHT31).  
Same payload as S31-LB / S31B-LB.  
Ref: [Dragino S31/S31B-LB/LS User Manual](https://wiki.dragino.com/xwiki/bin/view/Main/User%20Manual%20for%20LoRaWAN%20End%20Nodes/S31-LB_S31B-LB/).

---

## 1. Uplink payload (fPort 2) — 11 bytes

| Bytes | Field | Description |
|-------|--------|-------------|
| 2 | Battery | Voltage in mV (e.g. 0x0B45 = 2885 mV) |
| 4 | Unix time | Seconds since 1970-01-01 |
| 1 | Alarm & MOD & PA8 | Bit 0 = alarm, bits 2–7 = MOD, bit 7 = PA8 level |
| 2 | Temperature | Signed 16-bit, value ÷ 10 = °C |
| 2 | Humidity | Value ÷ 10 = % RH |

**Other fPorts:**  
- **fPort 3** — Datalog (historical readings when network was down).  
- **fPort 5** — Device status (model, firmware, band, battery); sent when requested via downlink.

---

## 2. Downlink commands (fPort 2, HEX)

All downlinks below use **fPort 2** and **Hexadecimal** payload in TTN.

| Purpose | Hex payload |
|--------|-------------|
| Get device status (reply on fPort 5) | `2601` |
| Set transmit interval 30 s | `0100001E` |
| Set transmit interval 60 s | `0100003C` |
| Set transmit interval 10 min | `01000258` |
| Set transmit interval 20 min | `010004B0` |
| Get alarm settings (reply fPort 2, MOD=31) | `0E01` |
| **Temp alarm above 24°C (≈75°F)** | `0C010018` |
| **Temp alarm above 25°C** | `0C010019` |
| **Humidity alarm below 30%** | `0C021E00` |
| Humidity alarm below 70% | `0C024600` |
| Alarm interval 30 min | `0D001E` |
| Interrupt mode off | `06000000` |
| Interrupt rising edge | `06000003` |
| Time sync via MAC (SYNCMOD=1) | `2801` |
| Set system time (4B Unix) | `30` + 4-byte timestamp |
| Poll datalog | `31` + 4B start_ts + 4B end_ts + 1B interval (5–255) |
| Clear flash record | `A301` |

---

## 3. Setting alarms via TTN

### Humidity alarm when below 30%

- Downlink: **fPort 2**, payload **`0C021E00`**  
  (0x1E = 30% low limit; high limit 0 = not set)

### Temperature alarm when above 75°F

- Device uses **Celsius**. 75°F ≈ 23.9°C → use **24°C** (or 25°C for margin).
- Downlink: **fPort 2**, payload **`0C010018`** (24°C) or **`0C010019`** (25°C)

In TTN: **Applications → Your app → Device → Downlink** → fPort **2**, Payload type **Hexadecimal**, paste payload, Send.

---

## 4. Transmit interval vs RF power

### Transmit interval (how often it sends)

Use the `01 xx xx xx` downlinks in the table above (e.g. `0100003C` for 60 s).  
Value is 3 bytes, big-endian (e.g. 60 = 0x00003C).

### RF transmit power (dBm)

Set via **general Dragino downlink 0x22** on **fPort 2**: payload **`220001`** + 1 byte TXP.

- **TXP 0–5** (LoRaWAN): 0 = max power, 5 = min. Example: `22000100` = TXP 0, `22000105` = TXP 5.
- **TXP 40–50** (extended): 40 = 10 dBm, 41 = 11 dBm, … 50 = 20 dBm (check hardware).

**Note:** TTN ADR can override TX power. To keep a fixed power, disable ADR for the device in TTN or send the Dragino ADR=0 downlink (see [End Device AT Commands and Downlink Command](https://wiki.dragino.com/xwiki/bin/view/Main/End%20Device%20AT%20Commands%20and%20Downlink%20Command/) §7.14).

---

## 5. Datalog polling via TTN

- Datalog = stored readings from when the device had no LoRaWAN.
- **Request:** Send downlink on **fPort 2**:  
  `31` + **4-byte start Unix timestamp** + **4-byte end Unix timestamp** + **1 byte interval** (5–255 s).
- Device replies with datalog on **fPort 3** in subsequent uplinks.

**Example (hex):**  
Start 0x646D84E1, end 0x646D856A, interval 10 s →  
`31 646D84E1 646D856A 0A` (bytes in hex, no spaces in TTN: `646D84E1646D856A0A` — check TTN input format).

**Via TTN:**  
- Queue/send this downlink from Console (Downlink tab) or via HTTP/MQTT API.  
- Device is **Class A**: it only receives after an uplink, so the downlink is delivered at the next device uplink.  
- The **payload formatter** (`payload/Dragino S31B-LS.js`) decodes **fPort 3** datalog replies: same field names as fPort 2 (**BatV**, **TempC_SHT31**, **Hum_SHT31**, **Data_time**, **timestamp**) so MQTT and your reporting backend see a normal message. First entry is at top level; all entries are in **datalog_entries**. **Timestamp** is the device Unix time (MAC-synced when SYNCMOD=1).

**Lat/lon/alt:** Device has no GPS; use TTN gateway metadata or a fixed position if needed. 