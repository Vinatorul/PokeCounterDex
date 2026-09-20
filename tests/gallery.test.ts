import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { galleryPokemon, gallerySelection } from '../src/gallery.ts';
import type { Catalog, GalleryFilters } from '../src/models.ts';

const catalog: Catalog = JSON.parse(
  readFileSync(new URL('../public/data/catalog.json', import.meta.url), 'utf8'),
);
const unfiltered: GalleryFilters = { generation: null, game: null, query: '' };

test('unfiltered gallery includes every species, including the final Pokédex entry', () => {
  const pokemon = galleryPokemon(catalog, unfiltered);
  assert.equal(pokemon.length, 1025);
  assert.equal(pokemon[0].id, 1);
  assert.equal(pokemon.at(-1)!.id, 1025);
});

test('generation filter matches the generation a Pokémon was introduced in', () => {
  const pokemon = galleryPokemon(catalog, { ...unfiltered, generation: 2 });
  assert.equal(pokemon.length, 100);
  assert.ok(pokemon.some((entry) => entry.id === 152));
  assert.ok(pokemon.every((entry) => entry.generation === 2));
});

test('game filter includes trades, transfers and DLC while excluding unsupported species', () => {
  const leafgreen = galleryPokemon(catalog, { ...unfiltered, game: 7 });
  assert.equal(leafgreen.length, 386);
  assert.ok(leafgreen.some((entry) => entry.id === 12));
  assert.ok(
    leafgreen.some((entry) => entry.id === 152),
    'Trading can bring Chikorita into LeafGreen',
  );
  const scarlet = galleryPokemon(catalog, { ...unfiltered, game: 25 });
  assert.equal(scarlet.length, 733);
  assert.ok(
    scarlet.some((entry) => entry.id === 1017),
    'DLC species are included',
  );
  assert.ok(
    scarlet.some((entry) => entry.id === 151),
    'Transfer and event species are included',
  );
  assert.ok(!scarlet.some((entry) => entry.id === 12), 'Butterfree is unsupported in Scarlet/Violet');
  const sword = galleryPokemon(catalog, { ...unfiltered, game: 20 });
  assert.equal(sword.length, 664);
  assert.ok(
    sword.some((entry) => entry.id === 249),
    'Lugia is supported outside the regional dex',
  );
  assert.ok(!sword.some((entry) => entry.id === 152));
});

test('game rosters distinguish releases within the same generation and missing learnsets', () => {
  const ids = (game: number) => galleryPokemon(catalog, { ...unfiltered, game }).map((entry) => entry.id);
  assert.equal(ids(17).length, 802);
  assert.equal(ids(18).length, 807);
  assert.ok(!ids(17).includes(803));
  assert.ok(ids(18).includes(803));
  assert.equal(ids(19).length, 153);
  assert.ok(ids(19).includes(808));
  assert.ok(!ids(19).includes(152));
  assert.equal(ids(23).length, 493);
  assert.ok(ids(23).includes(493), 'Arceus is included despite missing move data');
});

test('gallery combines optional filters and can return to an unrestricted list', () => {
  assert.equal(galleryPokemon(catalog, { generation: 1, game: 7, query: 'pidgey' })[0].id, 16);
  assert.equal(galleryPokemon(catalog, { generation: 9, game: 7, query: '' }).length, 0);
  assert.equal(galleryPokemon(catalog, { ...unfiltered, query: '#1000' })[0].id, 1000);
  assert.equal(galleryPokemon(catalog, { ...unfiltered, query: '   ' }).length, 1025);
  assert.equal(galleryPokemon(catalog, unfiltered).length, 1025);
});

test('gallery selection uses its game rules and leaves existing rules alone without filters', () => {
  const current = { generation: 3, game: 7 };
  assert.deepEqual(gallerySelection(catalog, unfiltered, current), current);
  assert.deepEqual(gallerySelection(catalog, { ...unfiltered, generation: 1 }, current), {
    generation: 1,
    game: null,
  });
  assert.deepEqual(gallerySelection(catalog, { ...unfiltered, generation: 1, game: 25 }, current), {
    generation: 9,
    game: 25,
  });
});

test('every game roster is nonempty, unique, and references catalog Pokémon', () => {
  const pokemon = new Map(catalog.pokemon.map((entry) => [entry.id, entry]));
  for (const game of catalog.games) {
    assert.ok(game.availablePokemon.length > 0, game.name);
    assert.equal(game.availablePokemon.length, new Set(game.availablePokemon).size, game.name);
    assert.ok(
      game.availablePokemon.every((id) => pokemon.has(id) && pokemon.get(id)!.generation <= game.generation),
      game.name,
    );
  }
});
