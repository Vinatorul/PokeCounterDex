import { asset } from './data.ts';
import { battleTypes, pokemonTypes } from './engine.ts';
import type { AppState, Catalog, Pokemon, Type } from './models.ts';

export const escapeHtml = (value: string | number): string =>
  String(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  );
export const roman = (number: number): string =>
  ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'][number] ?? String(number);
export const typeById = (catalog: Catalog, id: number): Type => catalog.types.find((type) => type.id === id)!;
export const typeBadge = (type: Type, detail = ''): string =>
  `<span class="type-badge" data-type="${escapeHtml(type.name.toLowerCase())}">${escapeHtml(type.name)}${detail ? `<b>${escapeHtml(detail)}</b>` : ''}</span>`;
export const typeBadges = (catalog: Catalog, types: number[]): string =>
  types.map((id) => typeBadge(typeById(catalog, id))).join('');
export const ruleName = (catalog: Catalog, state: AppState): string =>
  catalog.games.find((game) => game.id === state.game)?.name ?? `Generation ${roman(state.generation)}`;

export function shell(): string {
  return `<header class="header"><div class="header-inner">
    <a class="brand" href="./" aria-label="PokéCounterDex home"><span class="brand-mark" aria-hidden="true">P</span>Poké<span>CounterDex</span></a>
    </div></header>
    <main id="main" class="workspace"><div class="toolbar">
      <nav class="tabs" aria-label="Lookup mode"><button id="pokemon-tab" class="tab active" type="button" aria-pressed="true">Pokémon</button><button id="types-tab" class="tab" type="button" aria-pressed="false">Types</button></nav>
      <div class="rules"><label>Generation<select id="generation"></select></label><label>Game<select id="game"></select></label></div>
    </div><div id="lookup"></div><div id="results"></div>
    <p id="announcement" class="sr-only" role="status" aria-live="polite"></p></main>
    <footer class="footer">
      <span>Data & sprites: <a href="https://pokeapi.co/about" target="_blank" rel="noreferrer">PokéAPI</a> · Unofficial fan project</span></footer>`;
}

export function rulesOptions(catalog: Catalog, state: AppState): { generations: string; games: string } {
  const generations = catalog.generations
    .map(
      (gen) =>
        `<option value="${gen.id}" ${gen.id === state.generation ? 'selected' : ''}>${escapeHtml(gen.name)}</option>`,
    )
    .join('');
  const groups = catalog.generations
    .map(
      (gen) =>
        `<optgroup label="${escapeHtml(gen.name)}">${catalog.games
          .filter((game) => game.generation === gen.id)
          .map(
            (game) =>
              `<option value="${game.id}" ${game.id === state.game ? 'selected' : ''}>${escapeHtml(game.name)}</option>`,
          )
          .join('')}</optgroup>`,
    )
    .join('');
  return {
    generations,
    games: `<option value="" ${state.game === null ? 'selected' : ''}>Any game · type rules only</option>${groups}`,
  };
}

export function pokemonLookup(): string {
  return `<div class="section-heading"><h1>Who are you facing?</h1></div>
    <div class="search-area"><div class="search-shell"><span class="search-symbol" aria-hidden="true">⌕</span>
    <input id="pokemon-search" type="search" role="combobox" aria-label="Search Pokémon" aria-autocomplete="list" aria-expanded="false" aria-controls="suggestions" autocomplete="off" spellcheck="false" placeholder="Name or Pokédex number…" /><kbd aria-hidden="true">/</kbd></div>
    <div id="suggestions" class="suggestions" role="listbox" aria-label="Matching Pokémon" hidden></div></div>
    <p class="search-hint">Availability varies by game; some Pokémon require trading.</p>`;
}

export function pokemonCard(catalog: Catalog, pokemon: Pokemon, state: AppState): string {
  return `<article class="pokemon-card"><div class="card-top"><span>#${String(pokemon.id).padStart(4, '0')}</span><span>GEN ${roman(pokemon.generation)}</span></div>
    <div class="sprite-stage"><span class="sprite-number" aria-hidden="true">${String(pokemon.id).padStart(3, '0')}</span>
    <img src="${asset(`sprites/${pokemon.id}.png`)}" alt="${escapeHtml(pokemon.displayName)}" width="160" height="160" /></div>
    <h2>${escapeHtml(pokemon.displayName)}</h2><div class="type-list">${typeBadges(catalog, pokemonTypes(pokemon, state.generation))}</div></article>`;
}

export function suggestions(catalog: Catalog, pokemon: Pokemon[], state: AppState): string {
  return pokemon
    .slice(0, 8)
    .map(
      (
        entry,
        index,
      ) => `<div class="suggestion" id="suggestion-${index}" role="option" aria-selected="false" data-pokemon="${entry.id}">
    <img src="${asset(`sprites/${entry.id}.png`)}" alt="" width="40" height="40" /><span class="suggestion-name">${escapeHtml(entry.displayName)}<small>#${String(entry.id).padStart(4, '0')}</small></span>
    <span class="type-list">${typeBadges(catalog, pokemonTypes(entry, state.generation))}</span></div>`,
    )
    .join('');
}

export function typeLookup(catalog: Catalog, state: AppState): string {
  const types = battleTypes(catalog, state.generation);
  const options = types
    .map(
      (type) =>
        `<option value="${type.id}" ${state.types[1] === type.id ? 'selected' : ''} ${state.types[0] === type.id ? 'disabled' : ''}>${escapeHtml(type.name)}</option>`,
    )
    .join('');
  return `<div class="section-heading"><h1>Find the right matchup.</h1></div>
    <div class="type-picker"><div class="type-picker-heading"><label for="type-search">Pick or search a type</label><input id="type-search" type="search" placeholder="Filter types…" /></div>
    <div class="type-grid" id="type-grid">${types.map((type) => `<button type="button" class="type-choice" data-type-id="${type.id}" aria-pressed="${type.id === state.types[0]}">${typeBadge(type)}</button>`).join('')}</div>
    <p id="no-types" class="muted" hidden>No matching types in this generation.</p>
    <label class="second-type">Second defending type <select id="second-type"><option value="">None · single type</option>${options}</select></label></div>`;
}
