# Frameo photo service

A small service that hands out photos from an [Immich](https://immich.app) album to
the Frameo launcher (`app.framelauncher`). The launcher's **NAS photos** mode asks it
for photos and shows them natively.

It reads the image assets of one album (default `Guido`) and gives them out in random
order: every photo once before any repeats. Videos are skipped. The frame never talks
to Immich directly; images go through this service, so the Immich API key stays on the NAS.

Node.js, no dependencies, runs in Docker.

## API

| Request                  | Response                                                         |
|--------------------------|------------------------------------------------------------------|
| `GET /api/next?count=12` | `{ "album": "Guido", "photos": [{ "id": "…", "url": "photo/…" }] }`. `url` is relative to the service. `count` is 1–50. |
| `GET /photo/<id>`        | Immich's preview rendition of the photo (about 1440 px, JPEG or WebP). Only photos from the album. |
| `GET /health`            | `{ "album", "images", "refreshedAt", "error" }`; HTTP 503 until the album has been read. |

The album is re-read every `REFRESH_MINUTES`, so new photos show up without a restart.

## Running it

You need Docker with the Compose plugin and an Immich API key.

1. In Immich, go to **Account settings > API keys** and create a key with the
   permissions `album.read`, `asset.read` and `asset.view`.
2. Configure and start:

   ```sh
   cp .env.example .env     # then edit .env
   docker compose up -d --build
   ```

3. Check `http://<host>:8088/health`. It should list the album and the number of images.
4. On the frame, set the **NAS photos** mode's service URL to `http://<host>:8088`.

`.env` settings:

| Variable                       | Meaning                                                       |
|--------------------------------|---------------------------------------------------------------|
| `BIND_ADDR`, `PORT`            | Address and host port the service is published on (default `8088`) |
| `IMMICH_URL`                   | Immich server, as reachable from the container, e.g. `http://192.168.1.10:2283` |
| `IMMICH_API_KEY`               | API key from step 1                                           |
| `IMMICH_ALBUM`                 | Album name (case-insensitive) or album id (default `Guido`)   |
| `REFRESH_MINUTES`              | How often the album is re-read (default `60`)                 |
| `NODE_TLS_REJECT_UNAUTHORIZED` | `0` to accept a self-signed certificate on `IMMICH_URL`       |
| `DEPLOY_HOST`, `DEPLOY_DIR`    | Used by `deploy.sh`                                           |

`.env` is git-ignored. Only `.env.example` is committed.

### Deploying to the NAS

```sh
./deploy.sh
```

This rsyncs the project, including `.env`, to `DEPLOY_HOST:DEPLOY_DIR` and runs
`docker compose up -d --build` there. It requires SSH key access to that host.
Without `rsync` (e.g. Git Bash on Windows) it sends a tarball over SSH instead and
replaces the remote directory's contents.

### Running without Docker

```sh
IMMICH_URL=http://192.168.1.10:2283 IMMICH_API_KEY=... node src/server.mjs
```

It listens on port 8080 (`LISTEN_PORT` changes that).

## Layout

```
src/server.mjs      the service
Dockerfile, docker-compose.yml, deploy.sh, .env.example
```
