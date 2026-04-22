const assert = require('node:assert/strict');
const core = require('../sim_core');

const nodes = {
  gatea1: { x: 0, y: 0 },
  a: { x: 1, y: 0 },
  b: { x: 2, y: 0 },
  c1: { x: 3, y: 0 },
  deice: { x: 1, y: 1 },
  rwy25r: { x: 4, y: 0 },
};
const edges = [
  ['gatea1', 'a'],
  ['a', 'b'],
  ['b', 'c1'],
  ['c1', 'rwy25r'],
  ['a', 'deice'],
];
const adjacency = core.buildAdjacency(edges);

{
  const parsed = core.parseCommand('DAL201 c pb n c es t 25r v a b hs c1');
  assert.equal(parsed.error, undefined);
  assert.equal(parsed.segments.length, 3);
}

{
  const parsed = core.parseCommand('DAL201 c ct');
  assert.equal(parsed.error, undefined);
  assert.equal(parsed.segments[0].type, 'continue_taxi');
}

{
  const route = core.compileTaxiRoute({
    startNode: 'gatea1',
    via: ['a', 'b'],
    destination: '25r',
    holdShort: 'c1',
    nodes,
    adjacency,
  });
  assert.equal(route.error, undefined);
  assert.deepEqual(route.route, ['a', 'b', 'c1', 'rwy25r']);
}

{
  const route = core.compileTaxiRoute({
    startNode: 'gatea1',
    via: ['deice'],
    destination: '25r',
    holdShort: null,
    nodes,
    adjacency,
  });
  assert.equal(route.error, undefined);
  assert.deepEqual(route.route, ['a', 'deice', 'a', 'b', 'c1', 'rwy25r']);
}

{
  const fail = core.compileTaxiRoute({
    startNode: 'gatea1',
    via: ['z9'],
    destination: '25r',
    holdShort: null,
    nodes,
    adjacency,
  });
  assert.match(fail.error, /Unknown taxiway/);
}

console.log('sim_core tests passed');
