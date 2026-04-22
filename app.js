const TAXIWAY_NODES = {
  gatea1: { x: 90, y: 450 },
  gateb23: { x: 220, y: 430 },
  p: { x: 320, y: 420 },
  l: { x: 420, y: 400 },
  m: { x: 520, y: 370 },
  a: { x: 220, y: 320 },
  b: { x: 330, y: 280 },
  c1: { x: 500, y: 250 },
  f: { x: 280, y: 230 },
  o: { x: 410, y: 205 },
  w3: { x: 550, y: 220 },
  rwy25r: { x: 700, y: 200 },
  deice: { x: 150, y: 330 },
};

const TAXIWAY_EDGES = [
  ['gatea1', 'a'],
  ['gateb23', 'p'],
  ['p', 'l'],
  ['l', 'm'],
  ['m', 'c1'],
  ['a', 'b'],
  ['b', 'c1'],
  ['a', 'f'],
  ['f', 'o'],
  ['o', 'w3'],
  ['c1', 'w3'],
  ['w3', 'rwy25r'],
  ['c1', 'rwy25r'],
  ['a', 'deice'],
];

const ADJ = SimCore.buildAdjacency(TAXIWAY_EDGES);
const aircraft = [];
let tickHandle = null;
let config = null;
let deicePadOccupant = null;
let conflictCooldown = 0;

const airportEl = document.getElementById('airport');
const seasonEl = document.getElementById('season');
const trafficEl = document.getElementById('traffic');
const opsEl = document.getElementById('ops');
const seasonValueEl = document.getElementById('season-value');
const trafficValueEl = document.getElementById('traffic-value');
const generateEl = document.getElementById('generate');
const commandEl = document.getElementById('command');
const runCommandEl = document.getElementById('run-command');
const listEl = document.getElementById('aircraft-list');
const logEl = document.getElementById('log');
const canvas = document.getElementById('map');
const ctx = canvas.getContext('2d');

seasonEl.addEventListener('input', () => {
  seasonValueEl.textContent = `${seasonEl.value}%`;
});
trafficEl.addEventListener('input', () => {
  trafficValueEl.textContent = trafficEl.value;
});
generateEl.addEventListener('click', generateSession);
runCommandEl.addEventListener('click', runCommand);
commandEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') runCommand();
});

function log(msg) {
  const t = new Date().toISOString().slice(11, 19);
  logEl.textContent += `[${t}] ${msg}\n`;
  logEl.scrollTop = logEl.scrollHeight;
}

function generateCallsign(i) {
  return `${['DAL', 'AAL', 'UAL', 'SWA'][i % 4]}${100 + i}`;
}

function spawnAircraft(i, ops, seasonBias) {
  const type = ops === 'departures' ? 'dep' : ops === 'arrivals' ? 'arr' : i % 2 === 0 ? 'dep' : 'arr';
  const deiceRequired = type === 'dep' && Math.random() * 100 < seasonBias * 0.65;

  return {
    id: generateCallsign(i),
    x: type === 'dep' ? TAXIWAY_NODES.gatea1.x + i * 8 : TAXIWAY_NODES.rwy25r.x - i * 7,
    y: type === 'dep' ? TAXIWAY_NODES.gatea1.y - i * 6 : TAXIWAY_NODES.rwy25r.y + i * 5,
    type,
    state: type === 'dep' ? 'at_gate' : 'arrival_waiting_taxi',
    pushFacing: null,
    engineStarted: false,
    route: [],
    holdShort: null,
    speed: 0,
    deiceRequired,
    deiceDone: !deiceRequired,
    deiceTimer: 0,
  };
}

function generateSession() {
  aircraft.length = 0;
  deicePadOccupant = null;
  conflictCooldown = 0;

  config = {
    airport: airportEl.value,
    seasonBias: Number(seasonEl.value),
    trafficLevel: Number(trafficEl.value),
    ops: opsEl.value,
  };

  const count = 2 + config.trafficLevel * 3;
  for (let i = 0; i < count; i += 1) {
    aircraft.push(spawnAircraft(i, config.ops, config.seasonBias));
  }

  if (tickHandle) clearInterval(tickHandle);
  tickHandle = setInterval(tick, 100);
  log(`Session generated: ${config.airport}, traffic ${config.trafficLevel}, ops ${config.ops}.`);
  render();
}

function applySegmentsAtomically(ac, segments) {
  const preview = {
    state: ac.state,
    pushFacing: ac.pushFacing,
    engineStarted: ac.engineStarted,
    route: ac.route.slice(),
    holdShort: ac.holdShort,
    speed: ac.speed,
  };

  const stagedLogs = [];

  for (const seg of segments) {
    if (seg.type === 'pushback') {
      preview.pushFacing = seg.dir;
      preview.state = 'pushback_cleared';
      stagedLogs.push(`${ac.id}: pushback approved facing ${seg.dir.toUpperCase()}.`);
      continue;
    }

    if (seg.type === 'engine_start') {
      preview.engineStarted = true;
      if (preview.state === 'at_gate') preview.state = 'ready_to_taxi';
      stagedLogs.push(`${ac.id}: engine start approved.`);
      continue;
    }

    if (seg.type === 'continue_taxi') {
      preview.speed = 0.7;
      if (preview.state === 'holding_short') preview.state = ac.type === 'dep' ? 'taxi_out' : 'taxi_in';
      stagedLogs.push(`${ac.id}: continue taxi approved.`);
      continue;
    }

    if (seg.type === 'taxi') {
      const startNode = SimCore.nearestNodeId(TAXIWAY_NODES, ac.x, ac.y);
      const compiled = SimCore.compileTaxiRoute({
        startNode,
        via: seg.via,
        destination: seg.destination,
        holdShort: seg.holdShort,
        nodes: TAXIWAY_NODES,
        adjacency: ADJ,
      });
      if (compiled.error) return { error: `${ac.id}: ${compiled.error}` };

      let route = compiled.route.slice();
      if (ac.type === 'dep' && compiled.destination === 'rwy25r' && ac.deiceRequired && !ac.deiceDone && !route.includes('deice')) {
        const withDeice = SimCore.compileTaxiRoute({
          startNode,
          via: ['deice', ...seg.via],
          destination: seg.destination,
          holdShort: seg.holdShort,
          nodes: TAXIWAY_NODES,
          adjacency: ADJ,
        });
        if (withDeice.error) return { error: `${ac.id}: ${withDeice.error}` };
        route = withDeice.route;
        stagedLogs.push(`${ac.id}: deice required, inserted DEICE waypoint.`);
      }

      preview.route = route;
      preview.holdShort = compiled.holdShort;
      preview.speed = 0.7;
      preview.state = ac.type === 'dep' ? 'taxi_out' : 'taxi_in';
      stagedLogs.push(`${ac.id}: taxi ${seg.destination.toUpperCase()} via ${seg.via.join(' ').toUpperCase()}${preview.holdShort ? ` hold short ${preview.holdShort.toUpperCase()}` : ''}.`);
    }
  }

  Object.assign(ac, preview);
  stagedLogs.forEach(log);
  return { ok: true };
}

function runCommand() {
  const raw = commandEl.value.trim();
  if (!raw) return;

  const parsed = SimCore.parseCommand(raw);
  if (parsed.error) {
    log(`ERR: ${parsed.error}`);
    return;
  }

  const ac = aircraft.find((a) => a.id.toLowerCase() === parsed.callsign.toLowerCase());
  if (!ac) {
    log(`ERR: Aircraft ${parsed.callsign} not found.`);
    return;
  }

  const result = applySegmentsAtomically(ac, parsed.segments);
  if (result.error) {
    log(`ERR: ${result.error}`);
  }

  commandEl.value = '';
  render();
}

function moveAircraft(ac) {
  if (ac.route.length === 0 || ac.speed <= 0) return;

  const nextNode = ac.route[0];
  if (ac.holdShort && nextNode === ac.holdShort) {
    ac.speed = 0;
    ac.state = 'holding_short';
    return;
  }

  const target = TAXIWAY_NODES[nextNode];
  const dx = target.x - ac.x;
  const dy = target.y - ac.y;
  const dist = Math.hypot(dx, dy);

  if (dist < 2) {
    ac.x = target.x;
    ac.y = target.y;
    ac.route.shift();

    if (nextNode === 'deice' && ac.deiceRequired && !ac.deiceDone && !deicePadOccupant) {
      deicePadOccupant = ac.id;
      ac.state = 'deicing';
      ac.speed = 0;
      ac.deiceTimer = 45;
      log(`${ac.id}: deicing started.`);
      return;
    }

    if (ac.route.length === 0) {
      ac.speed = 0;
      ac.state = ac.type === 'dep' ? 'hold_for_tower' : 'at_gate';
    }
  } else {
    const step = Math.min(ac.speed, dist);
    ac.x += (dx / dist) * step;
    ac.y += (dy / dist) * step;
  }
}

function updateDeice() {
  if (!deicePadOccupant) return;
  const ac = aircraft.find((a) => a.id === deicePadOccupant);
  if (!ac || ac.state !== 'deicing') {
    deicePadOccupant = null;
    return;
  }

  ac.deiceTimer -= 1;
  if (ac.deiceTimer <= 0) {
    ac.deiceDone = true;
    ac.state = 'taxi_out';
    ac.speed = 0.7;
    deicePadOccupant = null;
    log(`${ac.id}: deicing complete.`);
  }
}

function detectConflicts() {
  if (conflictCooldown > 0) {
    conflictCooldown -= 1;
    return;
  }

  for (let i = 0; i < aircraft.length; i += 1) {
    for (let j = i + 1; j < aircraft.length; j += 1) {
      const a = aircraft[i];
      const b = aircraft[j];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < 12) {
        a.speed = 0;
        b.speed = 0;
        a.state = 'conflict_hold';
        b.state = 'conflict_hold';
        conflictCooldown = 15;
        log(`ALERT: conflict hold issued for ${a.id}/${b.id}`);
        return;
      }
    }
  }
}

function tick() {
  aircraft.forEach(moveAircraft);
  updateDeice();
  detectConflicts();
  render();
}

function drawNode(id, color = '#5d80ba') {
  const n = TAXIWAY_NODES[id];
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(n.x, n.y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#b8c7e2';
  ctx.font = '12px sans-serif';
  ctx.fillText(id.toUpperCase(), n.x + 6, n.y - 6);
}

function renderMap() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#111f38';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#5a7fb5';
  ctx.lineWidth = 5;
  for (const [a, b] of TAXIWAY_EDGES) {
    const na = TAXIWAY_NODES[a];
    const nb = TAXIWAY_NODES[b];
    ctx.beginPath();
    ctx.moveTo(na.x, na.y);
    ctx.lineTo(nb.x, nb.y);
    ctx.stroke();
  }

  ctx.strokeStyle = '#d59a3a';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(580, 180);
  ctx.lineTo(940, 120);
  ctx.stroke();
  ctx.fillStyle = '#f4c06a';
  ctx.font = '14px sans-serif';
  ctx.fillText('RWY 25R', 835, 110);

  Object.keys(TAXIWAY_NODES).forEach((id) => drawNode(id));
}

function renderAircraft() {
  for (const ac of aircraft) {
    ctx.fillStyle = ac.state.includes('hold') ? '#f5cd56' : '#75dca9';
    ctx.beginPath();
    ctx.arc(ac.x, ac.y, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '12px monospace';
    ctx.fillText(`${ac.id} ${ac.state}`, ac.x + 10, ac.y - 10);

    if (ac.deiceRequired && !ac.deiceDone) {
      ctx.fillStyle = '#9bd0ff';
      ctx.fillText(ac.state === 'deicing' ? 'DEICING' : 'DEICE REQ', ac.x + 10, ac.y + 4);
    }
  }
}

function renderList() {
  listEl.innerHTML = '';
  for (const ac of aircraft) {
    const li = document.createElement('li');
    li.textContent = `${ac.id} • ${ac.state} • deice:${ac.deiceRequired ? (ac.deiceDone ? 'done' : 'req') : 'no'}${ac.holdShort ? ` • hs:${ac.holdShort.toUpperCase()}` : ''}`;
    listEl.appendChild(li);
  }
}

function render() {
  renderMap();
  renderAircraft();
  renderList();
}

render();
log('Ready. Configure scenario and click Generate Session.');
