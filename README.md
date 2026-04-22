# Ground Control Sim (Beta)

A lightweight, offline-first ground control simulator prototype inspired by atc-sim.com and openscope.co.

## What works in this build

- Offline startup from `launcher.html` / `simulator.html`
- Scenario setup (airport selector, deice bias slider, traffic slider, ops mode)
- ATC compact command parser with chained transmissions
- Taxi routing via graph pathfinding between waypoints
- Hold-short logic and continue-taxi control
- Deice workflow (auto-inserted DEICE stop for qualifying departures)
- Conflict detection with automatic conflict hold

## Run locally

```bash
python3 -m http.server 8080
```

Open: `http://localhost:8080/launcher.html`

## Command syntax

All commands start with a callsign:

- `DAL201 c pb n` — cleared pushback facing north
- `DAL201 c es` — cleared engine start
- `DAL201 t 25r v a b c1 hs c1` — taxi to RWY 25R via A B C1, hold short C1
- `DAL201 c ct` — continue taxi (release hold-short/conflict stop)

Chaining is supported:

```text
DAL201 c pb n c es t 25r v a b c1 hs c1
```

## Dev checks

```bash
node --check sim_core.js
node --check app.js
node tests/sim_core.test.js
```

## Notes

- This is intentionally browser-only and lightweight for Chromebook/offline use.
- Voice recognition is not included to keep runtime overhead low.
