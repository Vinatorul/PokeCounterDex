import { battleTypes, rulesForPokemon } from './engine.ts';
import type { AppState, Catalog, Pokemon, Selection } from './models.ts';

const ruleQuery = (selection: Selection): string =>
  `generation=${selection.generation}&game=${selection.game ?? 0}`;

export function pokemonHref(pokemon: Pokemon, selection: Selection): string {
  return `#pokemon/${pokemon.id}?${ruleQuery(rulesForPokemon(pokemon, selection))}`;
}

export function pageHref(state: AppState, mode = state.mode): string {
  if (mode === 'gallery') return '#gallery';
  if (mode === 'types') return `#types?${ruleQuery(state)}&types=${state.types.join(',')}`;
  return `#pokemon/${state.pokemon}?${ruleQuery(state)}`;
}

function routeSelection(catalog: Catalog, params: URLSearchParams, fallback: Selection): Selection {
  const requested = Number(params.get('generation'));
  const generation = catalog.generations.some((entry) => entry.id === requested)
    ? requested
    : fallback.generation;
  const id = params.has('game') ? Number(params.get('game')) : fallback.game;
  const game = catalog.games.find((entry) => entry.id === id && entry.generation === generation);
  return { generation, game: game?.id ?? null };
}

export function readRoute(catalog: Catalog, hash: string, fallback: AppState): AppState {
  const [path, query = ''] = hash.replace(/^#/, '').split('?');
  const [page, id] = path.split('/');
  const mode = page === 'gallery' || page === 'types' ? page : 'pokemon';
  const params = new URLSearchParams(query);
  const pokemon =
    catalog.pokemon.find((entry) => entry.id === Number(id)) ??
    catalog.pokemon.find((entry) => entry.id === fallback.pokemon)!;
  const requested = routeSelection(catalog, params, fallback);
  const selection =
    mode === 'pokemon' && !params.has('generation') ? rulesForPokemon(pokemon, requested) : requested;
  const available = battleTypes(catalog, selection.generation).map((entry) => entry.id);
  const types = [
    ...new Set(params.has('types') ? params.get('types')!.split(',').map(Number) : fallback.types),
  ]
    .filter((type) => available.includes(type))
    .slice(0, 2);
  return { ...selection, mode, pokemon: pokemon.id, types: types.length ? types : [1] };
}
