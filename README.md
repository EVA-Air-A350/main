# Ground Control Sim (Beta)

A lightweight, offline-first ground control simulator prototype inspired by atc-sim.com and openscope.co.

## What this beta includes

- Scenario setup page (airport, season/deicing slider, traffic level, operation mode)
- Ground map and moving aircraft labels
- ATC-style compact command parser with chained command support
- Route validation against taxiway graph connectivity
- Hold short validation (must exist and be on assigned route)
- Simple deicing flow tied to season slider
- Conflict detection with cooldown to avoid log spam
- Runs fully offline from local files

## Run offline

Because this is static HTML/CSS/JS, you can run it in a Chromebook browser without installing dependencies.

### Option 1: Open directly

Open `launcher.html` in Chrome and click **Open Simulator**.

### Option 2: Serve locally (recommended)

From this folder:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080/launcher.html`.

## Command syntax

Each command line starts with a callsign and then one or more segments:

- `c pb <n|e|s|w>`: cleared pushback with facing direction
- `c es`: cleared engine start
- `t <destination> v <taxiway...> hs <holdpoint>`: taxi route with hold short

Example:

```text
DAL201 c pb n c es t 25r v a b c1 hs c1
```

## Validation behavior

- Taxi routes are rejected when segments are disconnected.
- Hold short points are rejected if unknown or not on route.
- Multi-segment commands are applied atomically (all valid, or none applied).

## Development checks

```bash
node --check sim_core.js
node --check app.js
node tests/sim_core.test.js
```

## Notes

- Voice recognition is intentionally not included in this beta to keep performance and size low.
