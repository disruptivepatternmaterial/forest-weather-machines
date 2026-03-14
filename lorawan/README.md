# The Things Stack Open Source (Docker)

Self-hosted LoRaWAN network server using the [official Docker guide](https://www.thethingsindustries.com/docs/enterprise/docker/).

## Prerequisites

- Docker and Docker Compose
- 4 vCPUs, 16GB RAM recommended
- DNS record pointing to your server (or use `localhost` for local-only)

## Quick start

1. **Set your domain**  
   Replace `thethings.example.com` in `config/stack/ttn-lw-stack-docker.yml` with your hostname (or `localhost` for local dev). Use search-and-replace across the file.

2. **Generate HTTP keys** (required)  
   ```bash
   # block-key: 32 bytes hex
   openssl rand -hex 32
   # hash-key: 64 bytes hex
   openssl rand -hex 64
   ```  
   Put them in `config/stack/ttn-lw-stack-docker.yml` under `http.cookie.block-key` and `http.cookie.hash-key`.

3. **TLS / certificates**
   - **Let's Encrypt:** Uncomment the `acme` volume in `docker-compose.yaml` (stack service), then:
     ```bash
     mkdir -p acme && sudo chown 886:886 acme
     ```
     Certificates are requested on first HTTPS access.
   - **Custom certs:** Put `ca.pem`, `cert.pem`, `key.pem` in this directory, uncomment the `secrets` section in `docker-compose.yaml` and the custom `tls` block in `ttn-lw-stack-docker.yml`, then `sudo chown 886:886 cert.pem key.pem`.

4. **Create dirs and start**
   ```bash
   mkdir -p blob data/postgres data/redis
   docker compose pull
   docker compose run --rm stack is-db migrate
   docker compose up -d
   ```

5. **Console**  
   Open `https://<your-domain>/console` (or `http://localhost/console` if using localhost). Create the first user when prompted.

## Directory layout

```
lorawan/
├── docker-compose.yaml
├── config/stack/ttn-lw-stack-docker.yml
├── payload/                    # TTN payload formatters (paste into TTN Console)
├── node-red/                   # Node-RED function scripts + sample flow
├── docs/                       # Pipeline and common flat format (PIPELINE-AND-NODE-RED.md)
├── RAK2560_weather_station_settings.md
├── blob/          # created at first run
├── data/          # postgres & redis persistence (DEV_DATA_DIR or ./data)
└── acme/          # optional; for Let's Encrypt
```

- **Payload decoders and Node-RED pipeline:** See [docs/PIPELINE-AND-NODE-RED.md](docs/PIPELINE-AND-NODE-RED.md) for the full summary (TTN formatters, common flat format, ttn-uplink-to-flat, particle-webhook-to-flat, Windy station, flow import). For a full overview of the weather station and device stack (Particle, LoRaWAN, TTN, EMQX, HA), see [docs/WEATHER-STATION-OVERVIEW.md](docs/WEATHER-STATION-OVERVIEW.md).

## Data

- Default data dir: `./data` (override with `DEV_DATA_DIR`).
- For production, pin image tags and consider external PostgreSQL/Redis.

## References

- [Configuration](https://www.thethingsindustries.com/docs/enterprise/docker/configuration/)
- [Certificates](https://www.thethingsindustries.com/docs/enterprise/docker/certificates/)
- [Running the stack](https://www.thethingsindustries.com/docs/enterprise/docker/running-the-stack/)
