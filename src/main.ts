import './style.css';
import { loadCatalog, loadLearnsets } from './data.ts';
import { battleTypes, normalize, pokemonAbilities, pokemonTypes, searchPokemon } from './engine.ts';
import { attackPanel, defensePanel, typeResultHeading } from './matchup-view.ts';
import type { AppState, Catalog, Learnset } from './models.ts';
import { filterMoves, moveRows, movesShell, movesTable } from './moves-view.ts';
import { readSelection, saveSelection } from './storage.ts';
import {
  escapeHtml,
  pokemonCard,
  pokemonLookup,
  roman,
  ruleName,
  rulesOptions,
  shell,
  suggestions,
  typeLookup,
} from './view.ts';
import { registerTools } from './webmcp.ts';

const app = document.querySelector<HTMLDivElement>('#app')!;
const element = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
let catalog: Catalog;
let state: AppState;
let activeSuggestion = -1;
let moveRequest = 0;
let currentMoves: Learnset = [];
let showAllMoves = false;

async function start(): Promise<void> {
  app.innerHTML =
    '<main class="workspace"><h1>PokéCounterDex</h1><p role="status">Loading your Pokédex…</p></main>';
  try {
    catalog = await loadCatalog();
    state = { ...readSelection(catalog), mode: 'pokemon', pokemon: 12, types: [14], ability: 0 };
    app.innerHTML = shell();
    bindEvents();
    render();
    registerTools(catalog, () => state, choosePokemon, setRules);
  } catch {
    app.innerHTML =
      '<main class="workspace"><h1>Couldn’t load the Pokédex</h1><p>Check your connection and try again.</p><button id="retry" type="button">Try again</button></main>';
    element('retry').addEventListener('click', () => void start());
  }
}

function bindEvents(): void {
  element('generation').addEventListener('change', () =>
    setRules(Number(element<HTMLSelectElement>('generation').value), null),
  );
  element('game').addEventListener('change', changeGame);
  element('pokemon-tab').addEventListener('click', () => changeMode('pokemon'));
  element('types-tab').addEventListener('click', () => changeMode('types'));
  app.addEventListener('click', handleClick);
  app.addEventListener('change', handleChange);
  app.addEventListener('input', handleInput);
  app.addEventListener('keydown', handleKey);
  document.addEventListener('click', (event) => {
    if (!(event.target as HTMLElement).closest('.search-area')) closeSuggestions();
  });
  document.addEventListener('keydown', (event) => {
    if (
      event.key !== '/' ||
      event.ctrlKey ||
      event.metaKey ||
      /INPUT|SELECT|TEXTAREA/.test((event.target as HTMLElement).tagName)
    )
      return;
    event.preventDefault();
    element<HTMLInputElement>(state.mode === 'pokemon' ? 'pokemon-search' : 'type-search').focus();
  });
}

function render(): void {
  const options = rulesOptions(catalog, state);
  element('generation').innerHTML = options.generations;
  element('game').innerHTML = options.games;
  for (const mode of ['pokemon', 'types']) {
    element(`${mode}-tab`).classList.toggle('active', state.mode === mode);
    element(`${mode}-tab`).setAttribute('aria-pressed', String(state.mode === mode));
  }
  element('lookup').innerHTML =
    state.mode === 'pokemon' ? pokemonLookup(catalog, state) : typeLookup(catalog, state);
  renderResults();
}

function renderResults(): void {
  moveRequest++;
  if (state.mode === 'types') {
    element('results').innerHTML =
      `${typeResultHeading(catalog, state)}<div class="type-results">${defensePanel(catalog, state.types, state)}${attackPanel(catalog, state)}</div>`;
    return;
  }
  const pokemon = catalog.pokemon.find((entry) => entry.id === state.pokemon)!;
  if (pokemon.generation > state.generation) {
    element('results').innerHTML =
      `<div class="empty-state"><h2>${escapeHtml(pokemon.displayName)} isn’t in this generation.</h2><p>It was introduced in Generation ${roman(pokemon.generation)}. Choose a later generation or search for another Pokémon.</p></div>`;
    return;
  }
  const types = pokemonTypes(pokemon, state.generation);
  element('results').innerHTML =
    `<div class="result-layout">${pokemonCard(catalog, pokemon, state)}${defensePanel(catalog, types, state)}</div>${movesShell(catalog, state)}`;
  void renderMoves();
}

async function renderMoves(): Promise<void> {
  if (state.mode !== 'pokemon' || !state.game) return;
  const request = ++moveRequest;
  const { game, pokemon } = state;
  try {
    const data = await loadLearnsets(game);
    if (request !== moveRequest) return;
    currentMoves = data[String(pokemon)] ?? [];
    showAllMoves = false;
    element('moves-content').innerHTML = movesTable(catalog, currentMoves, state.generation);
    updateMoveRows();
  } catch {
    if (request !== moveRequest) return;
    element('moves-content').innerHTML =
      '<p>Couldn’t load these moves.</p><button type="button" class="text-button" id="retry-moves">Try again</button>';
  }
}

function updateMoveRows(): void {
  if (!element('move-rows')) return;
  const type = Number(element<HTMLSelectElement>('move-type').value);
  const method = Number(element<HTMLSelectElement>('move-method').value);
  const entries = filterMoves(catalog, currentMoves, state.generation, type, method);
  const shown = showAllMoves ? entries : entries.slice(0, 12);
  element('move-rows').innerHTML = moveRows(catalog, shown, state.generation);
  element('move-count').textContent = `${shown.length} of ${entries.length} learning entries`;
  element('more-moves').hidden = entries.length <= shown.length;
  element('no-moves').hidden = entries.length > 0;
}

function setRules(generation: number, game: number | null): void {
  state.generation = generation;
  state.game = game;
  state.ability = 0;
  const available = battleTypes(catalog, generation).map((type) => type.id);
  state.types = state.types.filter((type) => available.includes(type));
  if (!state.types.length) state.types = [1];
  saveSelection(state);
  render();
  announce(`Using ${ruleName(catalog, state)} rules.`);
}

function changeGame(): void {
  const id = Number(element<HTMLSelectElement>('game').value);
  const game = catalog.games.find((entry) => entry.id === id);
  setRules(game?.generation ?? state.generation, game?.id ?? null);
}

function changeMode(mode: AppState['mode']): void {
  state.mode = mode;
  state.ability = 0;
  render();
}

function choosePokemon(id: number): void {
  state.pokemon = id;
  state.ability = 0;
  if (state.mode !== 'pokemon') changeMode('pokemon');
  const pokemon = catalog.pokemon.find((entry) => entry.id === id)!;
  element<HTMLInputElement>('pokemon-search').value = pokemon.displayName;
  closeSuggestions();
  renderResults();
  announce(`Showing ${pokemon.displayName} with ${ruleName(catalog, state)} rules.`);
}

function announce(message: string): void {
  element('announcement').textContent = message;
}

function handleClick(event: MouseEvent): void {
  const target = event.target as HTMLElement;
  const suggestion = target.closest<HTMLElement>('[data-pokemon]');
  if (suggestion) choosePokemon(Number(suggestion.dataset.pokemon));
  const type = target.closest<HTMLElement>('[data-type-id]');
  if (type) selectType(Number(type.dataset.typeId));
  if (target.id === 'more-moves') {
    showAllMoves = true;
    updateMoveRows();
  }
  if (target.id === 'retry-moves') void renderMoves();
}

function selectType(id: number): void {
  state.types = [id, ...state.types.slice(1).filter((type) => type !== id)];
  render();
  element('type-grid').querySelector<HTMLButtonElement>(`[data-type-id="${id}"]`)?.focus();
}

function handleChange(event: Event): void {
  const target = event.target as HTMLSelectElement;
  if (target.id === 'ability') {
    const pokemon = catalog.pokemon.find((entry) => entry.id === state.pokemon)!;
    state.ability = pokemonAbilities(pokemon, state.generation).some(
      (slot) => slot.id === Number(target.value),
    )
      ? Number(target.value)
      : 0;
    renderResults();
    element('ability')?.focus();
  }
  if (target.id === 'second-type') {
    state.types = [state.types[0], ...(target.value ? [Number(target.value)] : [])];
    renderResults();
  }
  if (['move-type', 'move-method'].includes(target.id)) {
    showAllMoves = false;
    updateMoveRows();
  }
}

function handleInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  if (target.id === 'pokemon-search') updateSuggestions();
  if (target.id === 'type-search') {
    const term = normalize(target.value);
    const choices = element('type-grid').querySelectorAll<HTMLButtonElement>('button');
    for (const choice of choices) choice.hidden = !normalize(choice.textContent ?? '').includes(term);
    element('no-types').hidden = [...choices].some((choice) => !choice.hidden);
  }
}

function updateSuggestions(): void {
  const input = element<HTMLInputElement>('pokemon-search');
  const query = input.value.trim();
  activeSuggestion = -1;
  input.removeAttribute('aria-activedescendant');
  if (!query) {
    closeSuggestions();
    return;
  }
  const matches = searchPokemon(catalog, query, state.generation);
  element('suggestions').innerHTML = matches.length
    ? suggestions(catalog, matches, state)
    : '<div class="search-empty">No matching standard form in this generation. Check the spelling or choose a later generation.</div>';
  element('suggestions').hidden = false;
  input.setAttribute('aria-expanded', 'true');
  announce(
    matches.length
      ? `${matches.length} matching Pokémon. Use arrow keys and Enter to choose.`
      : 'No matching Pokémon.',
  );
}

function closeSuggestions(): void {
  const list = element('suggestions');
  const input = element('pokemon-search');
  if (!list || !input) return;
  list.hidden = true;
  input.setAttribute('aria-expanded', 'false');
  input.removeAttribute('aria-activedescendant');
  activeSuggestion = -1;
}

function handleKey(event: KeyboardEvent): void {
  if ((event.target as HTMLElement).id !== 'pokemon-search') return;
  if (event.key === 'Escape' || event.key === 'Tab') {
    closeSuggestions();
    return;
  }
  if (!['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) return;
  event.preventDefault();
  if (element('suggestions').hidden) updateSuggestions();
  const options = [...element('suggestions').querySelectorAll<HTMLElement>('[data-pokemon]')];
  if (!options.length) return;
  if (event.key === 'Enter') {
    choosePokemon(Number(options[Math.max(activeSuggestion, 0)].dataset.pokemon));
    return;
  }
  const direction = event.key === 'ArrowDown' ? 1 : -1;
  activeSuggestion =
    activeSuggestion < 0
      ? direction > 0
        ? 0
        : options.length - 1
      : (activeSuggestion + direction + options.length) % options.length;
  options.forEach((option, index) => {
    option.setAttribute('aria-selected', String(index === activeSuggestion));
  });
  element('pokemon-search').setAttribute('aria-activedescendant', options[activeSuggestion].id);
  options[activeSuggestion].scrollIntoView({ block: 'nearest' });
}

void start();
