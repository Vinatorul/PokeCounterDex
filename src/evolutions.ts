import type { Catalog, Evolution, Selection } from './models.ts';

export function evolutionFamily(edges: Evolution[], pokemon: number): Set<number> {
  const family = new Set([pokemon]);
  let size = 0;
  while (size !== family.size) {
    size = family.size;
    for (const edge of edges) {
      if (family.has(edge.from) || family.has(edge.to)) {
        family.add(edge.from);
        family.add(edge.to);
      }
    }
  }
  return family;
}

export function evolutionPaths(catalog: Catalog, pokemon: number, selection: Selection): Evolution[] {
  const family = evolutionFamily(catalog.evolutions, pokemon);
  const games = new Set(
    catalog.games
      .filter((game) =>
        selection.game ? game.id === selection.game : game.generation === selection.generation,
      )
      .map((game) => game.id),
  );
  return catalog.evolutions
    .filter((edge) => family.has(edge.from))
    .map((edge) => ({
      ...edge,
      methods: edge.methods
        .map((method) => ({ ...method, games: method.games.filter((id) => games.has(id)) }))
        .filter((method) => method.games.length > 0),
    }))
    .filter((edge) => edge.methods.length > 0);
}
