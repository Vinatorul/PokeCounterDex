import { moveType } from './engine.ts';
import type { AppState, Catalog, Learnset } from './models.ts';
import { escapeHtml, typeBadge, typeById } from './view.ts';

export function movesShell(state: AppState): string {
  return `<section class="moves-panel" aria-label="Learnable moves"><div class="panel-heading"><h2>Moves it can learn</h2></div>
    <div id="moves-content"><p class="muted">${state.game ? 'Loading this game’s moves…' : 'Choose a game above to see learnable moves.'}</p></div></section>`;
}

export function movesTable(catalog: Catalog, entries: Learnset, generation: number): string {
  if (!entries.length)
    return '<p class="empty-inline">No learnset is recorded for this Pokémon in this game. It may be unavailable, or the data may be incomplete.</p>';
  const usedTypes = [
    ...new Set(entries.map(([id]) => moveType(catalog.moves.find((move) => move.id === id)!, generation))),
  ];
  const methods = [...new Set(entries.map((entry) => entry[1]))];
  return `<div class="move-filters"><label>Move type<select id="move-type"><option value="">All types</option>${usedTypes.map((id) => `<option value="${id}">${escapeHtml(typeById(catalog, id).name)}</option>`).join('')}</select></label>
    <label>Learn method<select id="move-method"><option value="">All methods</option>${methods.map((id) => `<option value="${id}">${escapeHtml(catalog.methods.find((method) => method.id === id)!.name)}</option>`).join('')}</select></label><span id="move-count" class="muted"></span></div>
    <div class="table-scroll"><table><caption class="sr-only">Moves and ways to learn them in the selected game</caption><thead><tr><th scope="col">Move</th><th scope="col">Type</th><th scope="col">How to learn</th></tr></thead><tbody id="move-rows"></tbody></table></div>
    <p id="no-moves" class="empty-inline" hidden>No moves match these filters.</p>
    <button class="text-button" id="more-moves" type="button" hidden>Show all matching moves</button>
    <p class="calculation-note">Egg, tutor and transfer moves may need other games.</p>`;
}

export function moveRows(catalog: Catalog, entries: Learnset, generation: number): string {
  return entries
    .map(([id, method, level]) => {
      const move = catalog.moves.find((entry) => entry.id === id)!;
      const methodName = catalog.methods.find((entry) => entry.id === method)!.name;
      const how =
        method === 1
          ? level === 0
            ? 'On evolution'
            : level === 1
              ? 'Starting move / Lv. 1'
              : `Level ${level}`
          : methodName;
      return `<tr><td>${escapeHtml(move.name)}</td><td>${typeBadge(typeById(catalog, moveType(move, generation)))}</td><td>${escapeHtml(how)}</td></tr>`;
    })
    .join('');
}

export function filterMoves(
  catalog: Catalog,
  entries: Learnset,
  generation: number,
  type: number,
  method: number,
): Learnset {
  return entries
    .filter(
      ([id, learnMethod]) =>
        (!type || moveType(catalog.moves.find((move) => move.id === id)!, generation) === type) &&
        (!method || method === learnMethod),
    )
    .sort(
      (a, b) =>
        a[1] - b[1] ||
        a[2] - b[2] ||
        catalog.moves
          .find((move) => move.id === a[0])!
          .name.localeCompare(catalog.moves.find((move) => move.id === b[0])!.name),
    );
}
