const assert = require('node:assert/strict');
const core = require('../sim_core');

const nodes = {
  gatea1: { x: 0, y: 0 },
  a: { x: 1, y: 0 },
  b: { x: 2, y: 0 },
  c1: { x: 3, y: 0 },
  rwy25r: { x: 4, y: 0 },
};
const edges = [
  ['gatea1', 'a'],
  ['a', 'b'],
  ['b', 'c1'],
  ['c1', 'rwy25r'],
];
const adjacency = core.buildAdjacency(edges);

{
  const parsed = core.parseCommand('DAL201 c pb n c es t 25r v a b hs c1');
  assert.equal(parsed.error, undefined);
  assert.equal(parsed.callsign, 'DAL201');
  assert.equal(parsed.segments.length, 3);
}

{
  const parsed = core.parseCommand('DAL201 t 25r a b');
  assert.equal(parsed.error, 'Taxi command missing v.');
}

{
  const ok = core.validateRoute({
    startNode: 'gatea1',
    via: ['a', 'b', 'c1'],
    destination: '25r',
    holdShort: 'c1',
    nodes,
    adjacency,
  });
  assert.equal(ok.error, undefined);
  assert.deepEqual(ok.route, ['a', 'b', 'c1', 'rwy25r']);
}

{
  const fail = core.validateRoute({
    startNode: 'gatea1',
    via: ['b'],
    destination: '25r',
    holdShort: 'c1',
    nodes,
    adjacency,
  });
  assert.match(fail.error, /Disconnected route/);
}

{
  const failHs = core.validateRoute({
    startNode: 'gatea1',
    via: ['a', 'b', 'c1'],
    destination: '25r',
    holdShort: 'a9',
    nodes,
    adjacency,
  });
  assert.match(failHs.error, /Unknown hold short point/);
}

console.log('sim_core tests passed');
