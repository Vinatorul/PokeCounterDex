import { asset } from './data.ts';
import { pokemonTypes } from './engine.ts';
import type { Catalog, GalleryFilters, Pokemon, Selection } from './models.ts';
import { pokemonHref } from './routes.ts';
import { escapeHtml, typeBadges } from './view.ts';

export function galleryLookup(catalog: Catalog, filters: GalleryFilters): string {
  const generations = catalog.generations.map(
    (entry) =>
      `<option value="${entry.id}" ${entry.id === filters.generation ? 'selected' : ''}>${escapeHtml(entry.name)}</option>`,
  );
  const games = catalog.games.map(
    (entry) =>
      `<option value="${entry.id}" ${entry.id === filters.game ? 'selected' : ''}>${escapeHtml(entry.name)}</option>`,
  );
  return `<div class="section-heading"><h1>Browse Pokémon</h1></div>
    <div class="gallery-filters"><div class="search-shell"><span class="search-symbol" aria-hidden="true">⌕</span>
    <input id="gallery-search" type="search" aria-label="Search gallery" placeholder="Name or Pokédex number…" value="${escapeHtml(filters.query)}" autocomplete="off" spellcheck="false" /><kbd aria-hidden="true">/</kbd></div>
    <div class="gallery-filter-row"><label>Generation introduced<select id="gallery-generation"><option value="">All generations</option>${generations.join('')}</select></label>
    <label>Game<select id="gallery-game"><option value="">All games</option>${games.join('')}</select></label>
    <button id="clear-gallery" class="text-button" type="button">Clear filters</button></div></div>
    <p id="gallery-count" class="gallery-count" role="status" aria-live="polite"></p>`;
}

export function galleryCards(catalog: Catalog, pokemon: Pokemon[], selection: Selection): string {
  if (!pokemon.length) return '<p class="empty-state">No Pokémon match these filters.</p>';
  return `<section class="gallery-grid" aria-label="Pokémon gallery">${pokemon.map((entry) => galleryCard(catalog, entry, selection)).join('')}</section>`;
}

function galleryCard(catalog: Catalog, pokemon: Pokemon, selection: Selection): string {
  return `<a class="gallery-card" href="${escapeHtml(pokemonHref(pokemon, selection))}" data-pokemon="${pokemon.id}" aria-label="View ${escapeHtml(pokemon.displayName)}">
    <span class="gallery-number">#${String(pokemon.id).padStart(4, '0')}</span>
    <img src="${asset(`sprites/${pokemon.id}.png`)}" alt="" width="96" height="96" loading="lazy" decoding="async" />
    <strong>${escapeHtml(pokemon.displayName)}</strong>
    <span class="type-list">${typeBadges(catalog, pokemonTypes(pokemon, Math.max(pokemon.generation, selection.generation)))}</span></a>`;
}
