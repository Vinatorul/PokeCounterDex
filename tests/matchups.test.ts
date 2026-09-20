import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  abilityFactor,
  attackMatchups,
  battleTypes,
  defenseMatchups,
  effectiveness,
  moveType,
  pokemonAbilities,
  pokemonTypes,
  searchPokemon,
} from '../src/engine.ts';
import type { Catalog } from '../src/models.ts';
import { readSelection } from '../src/storage.ts';

const catalog: Catalog = JSON.parse(
  readFileSync(new URL('../public/data/catalog.json', import.meta.url), 'utf8'),
);
const pokemon = (id: number) => catalog.pokemon.find((entry) => entry.id === id)!;
const move = (id: number) => catalog.moves.find((entry) => entry.id === id)!;
const factor = (id: number, attack: number, generation = 3, ability = '') =>
  defenseMatchups(catalog, pokemonTypes(pokemon(id), generation), generation, ability).find(
    (row) => row.type.id === attack,
  )!.factor;

test('dual typing multiplies weaknesses, resistances and immunities', () => {
  assert.equal(factor(12, 6), 4, 'Rock hits Butterfree for 4×');
  assert.equal(factor(12, 3), 2, 'Flying also hits Butterfree for 2×');
  assert.equal(factor(12, 2), 0.25);
  assert.equal(factor(16, 2), 1, 'Fighting is neutral against Pidgey');
  assert.equal(factor(16, 5), 0);
  assert.equal(factor(16, 8), 0);
  assert.equal(factor(43, 7), 1, 'Poison cancels Oddish’s Bug weakness');
  assert.equal(factor(51, 13), 0, 'Dugtrio is immune to Electric');
});

test('Generation I chart quirks are preserved', () => {
  assert.equal(effectiveness(catalog, 8, 14, 1), 0);
  assert.equal(effectiveness(catalog, 8, 14, 2), 2);
  assert.equal(effectiveness(catalog, 7, 4, 1), 2);
  assert.equal(effectiveness(catalog, 7, 4, 2), 0.5);
  assert.equal(effectiveness(catalog, 4, 7, 1), 2);
  assert.equal(effectiveness(catalog, 4, 7, 2), 1);
  assert.equal(effectiveness(catalog, 15, 10, 1), 1);
  assert.equal(effectiveness(catalog, 15, 10, 2), 0.5);
});

test('Steel loses Ghost and Dark resistances in Generation VI', () => {
  for (const type of [8, 17]) {
    assert.equal(effectiveness(catalog, type, 9, 3), 0.5);
    assert.equal(effectiveness(catalog, type, 9, 5), 0.5);
    assert.equal(effectiveness(catalog, type, 9, 6), 1);
  }
});

test('types and Pokémon typings follow their generation', () => {
  assert.equal(battleTypes(catalog, 1).length, 15);
  assert.equal(battleTypes(catalog, 3).length, 17);
  assert.equal(battleTypes(catalog, 9).length, 18);
  assert.deepEqual(pokemonTypes(pokemon(35), 5), [1]);
  assert.deepEqual(pokemonTypes(pokemon(35), 6), [18]);
  assert.deepEqual(pokemonTypes(pokemon(81), 1), [13]);
  assert.deepEqual(pokemonTypes(pokemon(81), 2), [13, 9]);
});

test('ability selection can account for historical Gengar and absorption', () => {
  assert.deepEqual(pokemonAbilities(pokemon(94), 2), []);
  assert.equal(pokemonAbilities(pokemon(94), 3)[0].id, 26);
  assert.equal(pokemonAbilities(pokemon(94), 6)[0].id, 26);
  assert.equal(pokemonAbilities(pokemon(94), 7)[0].id, 130);
  assert.equal(factor(94, 5), 2);
  assert.equal(factor(94, 5, 3, 'Levitate'), 0);
  assert.equal(abilityFactor('Lightning Rod', 13, 2, 4), 2);
  assert.equal(abilityFactor('Lightning Rod', 13, 2, 5), 0);
  assert.equal(abilityFactor('Thick Fat', 10, 2, 3), 1);
  assert.equal(abilityFactor('Wonder Guard', 11, 1, 3), 0);
  assert.equal(abilityFactor('Wonder Guard', 10, 2, 3), 2);
});

test('move type history includes Bite, Karate Chop, and the old Curse type', () => {
  assert.equal(moveType(move(44), 1), 1);
  assert.equal(moveType(move(44), 2), 17);
  assert.equal(moveType(move(2), 1), 1);
  assert.equal(moveType(move(2), 3), 2);
  assert.equal(moveType(move(174), 4), 10001);
  assert.equal(moveType(move(174), 5), 8);
});

test('offensive and defensive tables use distinct directions', () => {
  const psychicAttack = attackMatchups(catalog, 14, 3)
    .filter((row) => row.factor > 1)
    .map((row) => row.type.id);
  const psychicDefense = defenseMatchups(catalog, [14], 3)
    .filter((row) => row.factor > 1)
    .map((row) => row.type.id);
  assert.deepEqual(psychicAttack, [2, 4]);
  assert.deepEqual(psychicDefense, [7, 8, 17]);
});

test('search handles punctuation, gender, numbers and generation boundaries', () => {
  assert.equal(searchPokemon(catalog, 'Mr Mime', 3)[0].id, 122);
  assert.equal(searchPokemon(catalog, 'Nidoran♀', 3)[0].id, 29);
  assert.equal(searchPokemon(catalog, 'farfetchd', 3)[0].id, 83);
  assert.equal(searchPokemon(catalog, '#0025', 3)[0].id, 25);
  assert.equal(searchPokemon(catalog, 'gholdengo', 3).length, 0);
  assert.equal(searchPokemon(catalog, 'gholdengo', 9)[0].id, 1000);
  assert.equal(searchPokemon(catalog, '<script>', 9).length, 0);
});

test('saved settings reject malformed or mismatched rules', () => {
  const read = (value: string) => readSelection(catalog, { getItem: () => value });
  assert.deepEqual(read('{bad'), { generation: 3, game: 7 });
  assert.deepEqual(read('{"generation":1,"game":7}'), { generation: 1, game: null });
  assert.deepEqual(read('{"generation":99,"game":7}'), { generation: 3, game: 7 });
  assert.deepEqual(read('{"generation":9,"game":25}'), { generation: 9, game: 25 });
});
