(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SimCore = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  function normalizeTokens(raw) {
    return raw.trim().toLowerCase().split(/\s+/).filter(Boolean);
  }

  function parseCommand(raw) {
    const tokens = normalizeTokens(raw || '');
    if (tokens.length < 2) return { error: 'Command too short.' };

    const callsign = tokens[0].toUpperCase();
    const segments = [];
    let i = 1;

    while (i < tokens.length) {
      const t = tokens[i];

      if (t === 'c' && tokens[i + 1] === 'pb') {
        const dir = tokens[i + 2];
        if (!['n', 'e', 's', 'w'].includes(dir)) return { error: 'Pushback requires n/e/s/w.' };
        segments.push({ type: 'pushback', dir });
        i += 3;
        continue;
      }

      if (t === 'c' && tokens[i + 1] === 'es') {
        segments.push({ type: 'engine_start' });
        i += 2;
        continue;
      }

      if (t === 't') {
        const destination = tokens[i + 1];
        if (!destination) return { error: 'Taxi command missing destination.' };
        i += 2;

        if (tokens[i] !== 'v') return { error: 'Taxi command missing v.' };
        i += 1;

        const via = [];
        while (i < tokens.length && tokens[i] !== 'hs' && tokens[i] !== 'c' && tokens[i] !== 't') {
          via.push(tokens[i]);
          i += 1;
        }
        if (via.length === 0) return { error: 'Taxi command missing via taxiways.' };

        let holdShort = null;
        if (tokens[i] === 'hs') {
          holdShort = tokens[i + 1];
          if (!holdShort) return { error: 'hs requires holdpoint token.' };
          i += 2;
        }

        segments.push({ type: 'taxi', destination, via, holdShort });
        continue;
      }

      return { error: `Unexpected token: ${tokens[i]}` };
    }

    return { callsign, segments };
  }

  function buildAdjacency(edges) {
    const g = new Map();
    for (const [a, b] of edges) {
      if (!g.has(a)) g.set(a, new Set());
      if (!g.has(b)) g.set(b, new Set());
      g.get(a).add(b);
      g.get(b).add(a);
    }
    return g;
  }

  function resolveDestinationToken(destination) {
    if (destination === '25r' || destination === 'rwy25r' || destination === '1') return 'rwy25r';
    if (destination === 'b23') return 'gateb23';
    if (destination === 'a1') return 'gatea1';
    return destination;
  }

  function nearestNodeId(nodes, x, y) {
    let best = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const [id, n] of Object.entries(nodes)) {
      const d = Math.hypot(n.x - x, n.y - y);
      if (d < bestDist) {
        bestDist = d;
        best = id;
      }
    }
    return best;
  }

  function validateRoute({ startNode, via, destination, holdShort, nodes, adjacency }) {
    const normalizedVia = via.map((t) => t.toLowerCase());
    const dest = resolveDestinationToken(destination.toLowerCase());

    if (!nodes[startNode]) return { error: `Unknown start node ${startNode}.` };

    for (const token of normalizedVia) {
      if (!nodes[token]) return { error: `Unknown taxiway ${token}.` };
    }

    if (!nodes[dest]) return { error: `Unknown destination ${destination}.` };

    const path = [startNode, ...normalizedVia, dest];
    for (let i = 0; i < path.length - 1; i += 1) {
      const a = path[i];
      const b = path[i + 1];
      if (!adjacency.get(a) || !adjacency.get(a).has(b)) {
        return { error: `Disconnected route at ${a.toUpperCase()} -> ${b.toUpperCase()}.` };
      }
    }

    let hs = null;
    if (holdShort) {
      hs = holdShort.toLowerCase();
      if (!nodes[hs]) return { error: `Unknown hold short point ${holdShort}.` };
      if (!path.includes(hs)) return { error: `Hold short ${holdShort.toUpperCase()} not on assigned route.` };
    }

    return {
      route: [...normalizedVia, dest],
      destination: dest,
      holdShort: hs,
    };
  }

  return {
    parseCommand,
    buildAdjacency,
    validateRoute,
    resolveDestinationToken,
    nearestNodeId,
  };
}));
