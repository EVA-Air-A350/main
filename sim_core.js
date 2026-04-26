(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SimCore = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  function normalizeTokens(raw) {
    return String(raw || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  }

  function parseCommand(raw) {
    const tokens = normalizeTokens(raw);
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

      if (t === 'c' && tokens[i + 1] === 'ct') {
        segments.push({ type: 'continue_taxi' });
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

  function resolveDestinationToken(token) {
    const destination = String(token || '').toLowerCase();
    if (destination === '25r' || destination === 'rwy25r' || destination === '1') return 'rwy25r';
    if (destination === 'b23') return 'gateb23';
    if (destination === 'a1') return 'gatea1';
    return destination;
  }

  function nearestNodeId(nodes, x, y) {
    let best = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const [id, node] of Object.entries(nodes)) {
      const d = Math.hypot(node.x - x, node.y - y);
      if (d < bestDist) {
        bestDist = d;
        best = id;
      }
    }
    return best;
  }

  function shortestPath(adjacency, from, to) {
    if (from === to) return [from];
    const q = [from];
    const prev = new Map([[from, null]]);

    for (let head = 0; head < q.length; head += 1) {
      const n = q[head];
      const neighbors = adjacency.get(n);
      if (!neighbors) continue;
      for (const next of neighbors) {
        if (prev.has(next)) continue;
        prev.set(next, n);
        if (next === to) {
          const path = [to];
          let cur = n;
          while (cur) {
            path.push(cur);
            cur = prev.get(cur);
          }
          return path.reverse();
        }
        q.push(next);
      }
    }

    return null;
  }

  function compileTaxiRoute({ startNode, via, destination, holdShort, nodes, adjacency }) {
    if (!nodes[startNode]) return { error: `Unknown start node ${startNode}.` };

    const waypoints = via.map((v) => resolveDestinationToken(v));
    const dest = resolveDestinationToken(destination);

    for (const wp of waypoints) {
      if (!nodes[wp]) return { error: `Unknown taxiway ${wp}.` };
    }
    if (!nodes[dest]) return { error: `Unknown destination ${destination}.` };

    const checkpoints = [...waypoints, dest];
    let cursor = startNode;
    let fullPath = [startNode];

    for (const cp of checkpoints) {
      const segment = shortestPath(adjacency, cursor, cp);
      if (!segment) {
        return { error: `No route available from ${cursor.toUpperCase()} to ${cp.toUpperCase()}.` };
      }
      fullPath = fullPath.concat(segment.slice(1));
      cursor = cp;
    }

    let hs = null;
    if (holdShort) {
      hs = resolveDestinationToken(holdShort);
      if (!nodes[hs]) return { error: `Unknown hold short point ${holdShort}.` };
      if (!fullPath.includes(hs)) return { error: `Hold short ${holdShort.toUpperCase()} not on assigned route.` };
    }

    return {
      destination: dest,
      holdShort: hs,
      fullPath,
      route: fullPath.slice(1),
    };
  }

  return {
    parseCommand,
    buildAdjacency,
    resolveDestinationToken,
    nearestNodeId,
    shortestPath,
    compileTaxiRoute,
  };
}));
