import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { evolutionPaths } from '../src/evolutions.ts';
import type { Catalog } from '../src/models.ts';

const catalog: Catalog = JSON.parse(
  readFileSync(new URL('../public/data/catalog.json', import.meta.url), 'utf8'),
);
const paths = (pokemon: number, game: number) =>
  evolutionPaths(catalog, pokemon, {
    game,
    generation: catalog.games.find((entry) => entry.id === game)!.generation,
  });
const methods = (from: number, to: number, game: number) =>
  paths(from, game).find((edge) => edge.from === from && edge.to === to)!.methods;
const conditions = (from: number, to: number, game: number) =>
  methods(from, to, game)
    .flatMap((method) => method.conditions)
    .join(' ');

test('evolution family includes both stages and their levels for any selected stage', () => {
  for (const selected of [1, 2, 3]) {
    assert.deepEqual(
      paths(selected, 7).map((edge) => [edge.from, edge.to, edge.methods[0].level]),
      [
        [1, 2, 16],
        [2, 3, 32],
      ],
    );
  }
});

test('trade and item evolutions do not invent a level requirement', () => {
  assert.equal(methods(66, 67, 7)[0].level, 28);
  assert.equal(methods(67, 68, 7)[0].level, null);
  assert.match(conditions(67, 68, 7), /trade/i);
  assert.equal(methods(133, 134, 7)[0].level, null);
  assert.match(conditions(133, 134, 7), /water stone/i);
});

test('evolution branches respect the selected game and its special requirements', () => {
  assert.deepEqual(
    paths(133, 1)
      .map((edge) => edge.to)
      .sort((a, b) => a - b),
    [134, 135, 136],
  );
  assert.match(conditions(133, 196, 7), /trade/i);
  assert.match(conditions(133, 196, 7), /Ruby|Sapphire|Emerald/i);
  assert.match(conditions(133, 196, 7), /friendship/i);
  assert.match(conditions(133, 196, 7), /during the day/i);
  assert.match(conditions(133, 700, 15), /affection/i);
  assert.match(conditions(133, 700, 20), /friendship/i);
});

test('modern special evolutions include their actual quantities and actions', () => {
  assert.match(conditions(57, 979, 25), /Rage Fist.*20|20.*Rage Fist/i);
  assert.match(conditions(625, 983, 25), /3.*Bisharp|Bisharp.*3/i);
  assert.match(conditions(999, 1000, 25), /999.*coin/i);
});

test('regional ancestry is not presented as an evolution of the standard form', () => {
  for (const [from, to] of [
    [52, 863],
    [194, 980],
    [83, 865],
    [264, 862],
  ]) {
    assert.ok(!catalog.evolutions.some((edge) => edge.from === from && edge.to === to));
  }
});

test('generation-only rules retain labeled game alternatives and isolate unrelated families', () => {
  const family = evolutionPaths(catalog, 133, { generation: 3, game: null });
  const espeon = family.find((edge) => edge.to === 196)!;
  assert.ok(espeon.methods.some((method) => method.games.includes(7)));
  assert.ok(espeon.methods.some((method) => method.games.includes(5)));
  assert.ok(!family.some((edge) => edge.from === 1));
  assert.deepEqual(paths(150, 7), []);
});

test('every evolution method has valid endpoints, game references and meaningful requirements', () => {
  const pokemon = new Map(catalog.pokemon.map((entry) => [entry.id, entry]));
  for (const edge of catalog.evolutions) {
    assert.ok(pokemon.has(edge.from) && pokemon.has(edge.to));
    assert.notEqual(edge.from, edge.to);
    assert.ok(edge.methods.length > 0);
    for (const method of edge.methods) {
      assert.ok(method.level === null || (Number.isInteger(method.level) && method.level > 0));
      assert.ok(method.level !== null || method.conditions.length > 0);
      assert.ok(method.games.length > 0);
      for (const id of method.games) {
        const game = catalog.games.find((entry) => entry.id === id)!;
        assert.ok(game.availablePokemon.includes(edge.from) && game.availablePokemon.includes(edge.to));
      }
    }
  }
});
