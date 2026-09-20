import { searchPokemon } from './engine.ts';
import type { Catalog, GalleryFilters, Pokemon, Selection } from './models.ts';

export function galleryPokemon(catalog: Catalog, filters: GalleryFilters): Pokemon[] {
  const pokemon = filters.query.trim() ? searchPokemon(catalog, filters.query) : catalog.pokemon;
  const game = catalog.games.find((entry) => entry.id === filters.game);
  const available = game ? new Set(game.availablePokemon) : null;
  return pokemon.filter(
    (entry) =>
      (!filters.generation || entry.generation === filters.generation) &&
      (!available || available.has(entry.id)),
  );
}

export function gallerySelection(catalog: Catalog, filters: GalleryFilters, current: Selection): Selection {
  const game = catalog.games.find((entry) => entry.id === filters.game);
  if (game) return { generation: game.generation, game: game.id };
  if (filters.generation) return { generation: filters.generation, game: null };
  return { generation: current.generation, game: current.game };
}
