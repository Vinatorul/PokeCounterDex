import { asset } from './data.ts';
import { evolutionPaths } from './evolutions.ts';
import type { AppState, Catalog, Evolution, EvolutionMethod } from './models.ts';
import { pokemonHref } from './routes.ts';
import { escapeHtml } from './view.ts';

export function evolutionsPanel(catalog: Catalog, state: AppState): string {
  const paths = evolutionPaths(catalog, state.pokemon, state);
  const related = catalog.evolutions.some((edge) => edge.from === state.pokemon || edge.to === state.pokemon);
  const empty = related ? 'No evolution paths available for these rules.' : 'No further evolutions.';
  return `<section class="evolutions-panel" aria-label="Evolutions"><h2>Evolutions</h2>${
    paths.length
      ? `<div class="evolution-grid">${paths.map((edge) => evolutionRow(catalog, edge, state)).join('')}</div>`
      : `<p class="empty-inline">${empty}</p>`
  }</section>`;
}

function evolutionRow(catalog: Catalog, edge: Evolution, state: AppState): string {
  return `<div class="evolution-row">${evolutionPokemon(catalog, edge.from, state)}
    <div class="evolution-requirements"><span class="evolution-arrow" aria-hidden="true">→</span>
    ${edge.methods.map((method) => evolutionMethod(catalog, method, !state.game && edge.methods.length > 1)).join('<span class="evolution-or">or</span>')}</div>
    ${evolutionPokemon(catalog, edge.to, state)}</div>`;
}

function evolutionPokemon(catalog: Catalog, id: number, state: AppState): string {
  const pokemon = catalog.pokemon.find((entry) => entry.id === id)!;
  return `<a class="evolution-pokemon" href="${escapeHtml(pokemonHref(pokemon, state))}" data-pokemon="${id}" ${id === state.pokemon ? 'aria-current="page"' : ''}>
    <img src="${asset(`sprites/${id}.png`)}" alt="" width="80" height="80" loading="lazy" />
    <strong>${escapeHtml(pokemon.displayName)}</strong></a>`;
}

function evolutionMethod(catalog: Catalog, method: EvolutionMethod, showGames: boolean): string {
  const [first, ...rest] =
    method.level === null ? method.conditions : [`Level ${method.level}`, ...method.conditions];
  const games = showGames
    ? method.games.map((id) => catalog.games.find((game) => game.id === id)!.name).join(', ')
    : '';
  return `<div class="evolution-method"><strong>${escapeHtml(first ?? 'Requirements not recorded')}</strong>
    ${rest.map((condition) => `<span>${escapeHtml(condition)}</span>`).join('')}
    ${games ? `<span class="evolution-games">${escapeHtml(games)}</span>` : ''}</div>`;
}
