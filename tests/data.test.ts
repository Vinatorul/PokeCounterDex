import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { moveType, pokemonTypes } from '../src/engine.ts';
import type { Catalog, Learnsets } from '../src/models.ts';

const read = (path: string) =>
  JSON.parse(readFileSync(new URL(`../public/${path}`, import.meta.url), 'utf8'));
const catalog: Catalog = read('data/catalog.json');

test('every selectable Pokémon has a local sprite and valid historical types', () => {
  for (const pokemon of catalog.pokemon) {
    assert.ok(existsSync(new URL(`../public/sprites/${pokemon.id}.png`, import.meta.url)), pokemon.name);
    for (let generation = pokemon.generation; generation <= 9; generation++) {
      for (const type of pokemonTypes(pokemon, generation)) {
        assert.ok(catalog.types.some((entry) => entry.id === type && entry.generation <= generation));
      }
    }
  }
});

test('every game has a coherent learnset with existing moves and methods', () => {
  const moves = new Map(catalog.moves.map((move) => [move.id, move]));
  for (const game of catalog.games) {
    const learnsets: Learnsets = read(`data/learnsets/${game.id}.json`);
    assert.ok(Object.keys(learnsets).length > 0, game.name);
    for (const [id, entries] of Object.entries(learnsets)) {
      assert.ok(
        catalog.pokemon.some((pokemon) => pokemon.id === Number(id) && pokemon.generation <= game.generation),
      );
      for (const [moveId, method, level] of entries) {
        const move = moves.get(moveId);
        assert.ok(move && move.generation <= game.generation, `${game.name}: ${moveId}`);
        assert.ok(catalog.types.some((type) => type.id === moveType(move, game.generation)));
        assert.ok(catalog.methods.some((entry) => entry.id === method));
        assert.ok(Number.isInteger(level) && level >= 0);
      }
    }
  }
});

test('LeafGreen uses its own learnset rather than a modern moveset', () => {
  const leafgreen: Learnsets = read('data/learnsets/7.json');
  assert.ok(leafgreen['12'].some(([move, method, level]) => move === 318 && method === 1 && level === 47));
  assert.ok(leafgreen['12'].every(([id]) => catalog.moves.find((move) => move.id === id)!.generation <= 3));
  assert.equal(catalog.games.find((game) => game.id === 19)?.abilitiesEnabled, false);
  assert.equal(catalog.games.find((game) => game.id === 1)?.abilitiesEnabled, false);
});
