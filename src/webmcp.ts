import { defenseMatchups, normalize, pokemonTypes } from './engine.ts';
import type { AppState, Catalog, Pokemon, Selection } from './models.ts';

interface Tool {
  name: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown;
}
type ToolDocument = Document & {
  modelContext?: { registerTool: (tool: Tool, options: { signal: AbortSignal }) => void | Promise<void> };
};

const definition = {
  name: 'show_pokemon_matchup',
  description:
    'Select game or generation rules and show a Pokémon’s type matchups in the visible lookup. Does not model abilities.',
  inputSchema: {
    type: 'object',
    properties: {
      pokemon: { type: 'string' },
      generation: { type: 'integer', minimum: 1, maximum: 9 },
      game: { type: 'integer' },
    },
    required: ['pokemon', 'generation'],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: false, untrustedContentHint: false },
};

function validateInput(input: unknown, catalog: Catalog) {
  if (typeof input !== 'object' || !input) throw new Error('Provide a Pokémon name and generation.');
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some((key) => !['pokemon', 'generation', 'game'].includes(key)))
    throw new Error('Unknown parameter.');
  const pokemon = catalog.pokemon.find(
    (entry) =>
      normalize(entry.name) === normalize(String(value.pokemon)) ||
      normalize(entry.displayName) === normalize(String(value.pokemon)),
  );
  const generation = catalog.generations.find((entry) => entry.id === value.generation)?.id;
  const game = value.game === undefined ? null : catalog.games.find((entry) => entry.id === value.game);
  if (
    !pokemon ||
    !generation ||
    pokemon.generation > generation ||
    game === undefined ||
    (game && game.generation !== generation)
  )
    throw new Error('Choose a Pokémon and game available in that generation.');
  return { pokemon, generation, game: game?.id ?? null };
}

function lookupResult(catalog: Catalog, pokemon: Pokemon, selection: Selection) {
  const types = pokemonTypes(pokemon, selection.generation);
  return {
    pokemon: pokemon.displayName,
    ...selection,
    matchups: defenseMatchups(catalog, types, selection.generation).map((row) => ({
      type: row.type.name,
      factor: row.factor,
    })),
  };
}

export function registerTools(
  catalog: Catalog,
  getState: () => AppState,
  choose: (id: number) => void,
  rules: (generation: number, game: number | null) => void,
): void {
  const context = (document as ToolDocument).modelContext;
  if (!context?.registerTool) return;
  const lifecycle = new AbortController();
  const tool: Tool = {
    ...definition,
    execute(input) {
      const value = validateInput(input, catalog);
      rules(value.generation, value.game);
      choose(value.pokemon.id);
      return lookupResult(catalog, value.pokemon, { generation: getState().generation, game: value.game });
    },
  };
  try {
    void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => {});
    window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
  } catch {
    /* The ordinary interface works in browsers without WebMCP. */
  }
}
