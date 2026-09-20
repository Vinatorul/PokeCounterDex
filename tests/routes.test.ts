import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { AppState, Catalog } from '../src/models.ts';
import { pageHref, pokemonHref, readRoute } from '../src/routes.ts';

const catalog: Catalog = JSON.parse(
  readFileSync(new URL('../public/data/catalog.json', import.meta.url), 'utf8'),
);
const fallback: AppState = { mode: 'pokemon', pokemon: 12, generation: 3, game: 7, types: [14] };
const pokemon = (id: number) => catalog.pokemon.find((entry) => entry.id === id)!;

test('Pokémon URLs preserve the species and rules in a new tab with different saved settings', () => {
  const href = pokemonHref(pokemon(16), fallback);
  const restored = readRoute(catalog, href, { ...fallback, pokemon: 1000, generation: 9, game: 25 });
  assert.equal(restored.pokemon, 16);
  assert.equal(restored.generation, 3);
  assert.equal(restored.game, 7);
});

test('generation-only links clear any game stored in the destination tab', () => {
  const href = pokemonHref(pokemon(35), { generation: 6, game: null });
  const restored = readRoute(catalog, href, { ...fallback, generation: 6, game: 15 });
  assert.equal(restored.generation, 6);
  assert.equal(restored.game, null);
});

test('links to newer species use their earliest valid rules', () => {
  const restored = readRoute(catalog, pokemonHref(pokemon(1000), fallback), fallback);
  assert.equal(restored.pokemon, 1000);
  assert.equal(restored.generation, 9);
  assert.equal(restored.game, null);
});

test('an explicitly selected older generation survives reload of an unavailable Pokémon', () => {
  const state: AppState = { ...fallback, pokemon: 1000 };
  assert.deepEqual(readRoute(catalog, pageHref(state), fallback), state);
});

test('back and forward routes restore different Pokémon within the same page mode', () => {
  const first = readRoute(catalog, pokemonHref(pokemon(1), fallback), fallback);
  const second = readRoute(catalog, pokemonHref(pokemon(2), fallback), first);
  assert.equal(second.pokemon, 2);
  assert.equal(readRoute(catalog, pokemonHref(pokemon(1), fallback), second).pokemon, 1);
});

test('malformed routes retain valid species, generations, games and types', () => {
  const result = readRoute(catalog, '#pokemon/999999?generation=99&game=25&types=999,18,18,14', fallback);
  assert.equal(result.pokemon, 12);
  assert.equal(result.generation, 3);
  assert.equal(result.game, null);
  assert.deepEqual(result.types, [14]);
  assert.equal(readRoute(catalog, '#pokemon/not-a-number', fallback).pokemon, 12);
});

test('legacy pages still open, and type links carry both defending types', () => {
  assert.equal(readRoute(catalog, '#gallery', fallback).mode, 'gallery');
  assert.equal(readRoute(catalog, '#pokemon', fallback).pokemon, 12);
  const state: AppState = { ...fallback, mode: 'types', types: [1, 3] };
  assert.deepEqual(readRoute(catalog, pageHref(state), fallback), state);
});
