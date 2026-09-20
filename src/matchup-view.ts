import { attackMatchups, defenseMatchups } from './engine.ts';
import type { AppState, Catalog, Matchup } from './models.ts';
import { escapeHtml, typeBadge, typeBadges, typeById } from './view.ts';

export const multiplier = (value: number): string => `${value}×`;

function damageCards(rows: Matchup[]): string {
  if (!rows.length) return '<p class="empty-inline">No super-effective types for this matchup.</p>';
  return `<div class="damage-grid">${rows
    .sort((a, b) => b.factor - a.factor || a.type.name.localeCompare(b.type.name))
    .map(
      (row) => `<div class="damage-card ${row.factor >= 4 ? 'standout' : ''}">
    ${typeBadge(row.type)}<strong>${multiplier(row.factor)}</strong>${row.factor >= 4 ? '<small>Double weakness</small>' : ''}</div>`,
    )
    .join('')}</div>`;
}

function compactGroup(title: string, rows: Matchup[]): string {
  return `<div class="minor-section"><h3>${title}</h3><div class="type-list">${rows.length ? rows.map((row) => typeBadge(row.type, multiplier(row.factor))).join('') : '<span class="muted">None</span>'}</div></div>`;
}

function dualTypeNote(catalog: Catalog, types: number[], rows: Matchup[]): string {
  if (types.length !== 2) return '';
  const row =
    rows.find((entry) => entry.factor >= 4) ??
    rows.find((entry) => entry.parts.includes(2) && entry.parts.includes(0.5));
  if (!row) return '';
  const names = types.map((id) => escapeHtml(typeById(catalog, id).name));
  const [first, second] = row.parts;
  return `<div class="matchup-note"><strong>${escapeHtml(row.type.name)}</strong> against ${names[0]} (${multiplier(first)}) and ${names[1]} (${multiplier(second)}): <strong>${first} × ${second} = ${multiplier(first * second)}.</strong></div>`;
}

export function defensePanel(catalog: Catalog, types: number[], state: AppState): string {
  const rows = defenseMatchups(catalog, types, state.generation);
  const heading = state.mode === 'pokemon' ? 'What to use against it' : 'What hits this combination';
  return `<section class="matchup-panel" aria-label="Defensive matchups"><div class="panel-heading"><h2>${heading}</h2></div>
    <p class="section-label">SUPER EFFECTIVE</p>${damageCards(rows.filter((row) => row.factor > 1))}
    ${dualTypeNote(catalog, types, rows)}
    ${compactGroup(
      'Not very effective',
      rows.filter((row) => row.factor > 0 && row.factor < 1),
    )}
    ${compactGroup(
      'No effect',
      rows.filter((row) => row.factor === 0),
    )}
    <details class="neutral-details"><summary>Normal damage · 1×</summary><div class="type-list">${
      rows
        .filter((row) => row.factor === 1)
        .map((row) => typeBadge(row.type))
        .join('') || 'None'
    }</div></details></section>`;
}

export function attackPanel(catalog: Catalog, state: AppState): string {
  return `<section class="matchup-panel attack-panel" aria-label="Attacking matchups"><h2>Where your moves work best</h2>
    <p class="muted">Against single defending types.</p>
    ${state.types.map((id) => attackTypeSection(catalog, id, state.generation)).join('')}</section>`;
}

function attackTypeSection(catalog: Catalog, id: number, generation: number): string {
  const rows = attackMatchups(catalog, id, generation);
  return `<div class="attack-type"><h3>${typeBadge(typeById(catalog, id))} moves</h3>
    ${compactGroup(
      'Strong against · 2×',
      rows.filter((row) => row.factor > 1),
    )}
    ${compactGroup(
      'Resisted by · 0.5×',
      rows.filter((row) => row.factor > 0 && row.factor < 1),
    )}
    ${compactGroup(
      'No effect on · 0×',
      rows.filter((row) => row.factor === 0),
    )}</div>`;
}

export function typeResultHeading(catalog: Catalog, state: AppState): string {
  return `<div class="type-result-heading"><div class="type-list">${typeBadges(catalog, state.types)}</div></div>`;
}
