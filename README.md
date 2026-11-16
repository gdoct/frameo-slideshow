# Slideshow

A full-screen slideshow for a wall-mounted tablet or spare screen. It is a small
static web app with no build step and no dependencies, served by nginx in Docker.
The page picks a slideshow from the URL path. You switch photos and slideshows
by swiping.

| Path        | Slideshow                                                            |
|-------------|----------------------------------------------------------------------|
| `/picsum`   | Random photos from [picsum.photos](https://picsum.photos) (default)  |
| `/nas`      | Your own photos from a local folder, shuffled, subfolders included   |
| `/clock`    | Split-flap clock with date and current weather ([Open-Meteo](https://open-meteo.com), no API key) |
| `/wire`     | Wireframe animations in the style of early-1980s computer-generated TV interstitials |

Photos fade between each other with a slow Ken Burns zoom. The UI text is in Dutch.

## Controls

| Gesture (touch or mouse drag) | Key   | Action                                        |
|-------------------------------|-------|-----------------------------------------------|
| Swipe left / right            | → / ← | Next / previous photo (or animation scene)    |
| Swipe up                      | ↑     | Next slideshow                                |
| Swipe down                    | ↓     | Reload the current slideshow                  |

## URL options

- `?interval=30`: seconds per photo or scene (default 30).
- `?lat=52.10&lon=5.18`: location for the clock's weather (default De Bilt, NL).

Options stay in the URL when you switch slideshows, so `/clock?interval=60&lat=...` works.

## Running it

You need Docker with the Compose plugin.

```sh
cp .env.example .env     # then edit .env
docker compose up -d --build
```

Then open `http://<host>:8088/`.

`.env` settings:

| Variable      | Meaning                                                              |
|---------------|----------------------------------------------------------------------|
| `BIND_ADDR`   | Address the port is published on (`0.0.0.0` for all interfaces)     |
| `PORT`        | Host port (default `8088`)                                           |
| `PHOTOS_DIR`  | Photo folder for `/nas`, mounted read-only (default `./photos`)      |
| `DEPLOY_HOST` | SSH host used by `deploy.sh`                                         |
| `DEPLOY_DIR`  | Project directory on that host (default `slideshow`)                 |

`.env` is git-ignored. Only `.env.example` is committed.

To serve the slideshow over HTTPS, put it behind a reverse proxy such as Nginx
Proxy Manager or Caddy and forward to `BIND_ADDR:PORT`.

### Deploying to a remote server

```sh
./deploy.sh
```

This rsyncs the project, including `.env`, to `DEPLOY_HOST:DEPLOY_DIR` and runs
`docker compose up -d --build` there. It requires SSH key access to that host.

### Developing without Docker

The app is plain ES modules, so any static server works as long as unknown paths
fall back to `index.html`. For example:

```sh
cd src && npx serve -s .
```

The `/nas` slideshow needs nginx's JSON directory listing of `/photos/`, so it only
works in the container.

## Adding a slideshow

1. Create `src/shows/<name>.js` exporting `{ name, label, create() }`.
   `create()` returns `{ el, next?(), prev?(), stop?() }`:
   - `el` is the element to show.
   - `next` and `prev` handle horizontal swipes and the auto-advance timer.
   - `stop` cleans up when the user leaves the slideshow.
2. Import it in `src/app.js` and add it to `SHOWS`.

For photo slideshows, `photoShow()` in `src/shows/photos.js` handles the
crossfading. You only supply a function that returns the URL for photo `i`.

## Layout

```
src/
  index.html, style.css
  app.js            slideshow host: routing, gestures, auto-advance, HUD
  shows/
    photos.js       shared photo viewer (crossfade + Ken Burns)
    picsum.js       /picsum
    nas.js          /nas
    clock.js        /clock
    wire.js         /wire
nginx.conf          static serving + JSON listing of /photos/
Dockerfile, docker-compose.yml, deploy.sh, .env.example
```
