import type { Catalog, Selection } from './models.ts';

const key = 'pokecounterdex-rules-v1';

export function readSelection(catalog: Catalog, storage?: Pick<Storage, 'getItem'>): Selection {
  const fallback = { generation: 3, game: 7 };
  try {
    const saved = JSON.parse((storage ?? localStorage).getItem(key) ?? 'null');
    if (!saved || !catalog.generations.some((generation) => generation.id === saved.generation))
      return fallback;
    const game = catalog.games.find(
      (entry) => entry.id === saved.game && entry.generation === saved.generation,
    );
    return { generation: saved.generation, game: game?.id ?? null };
  } catch {
    return fallback;
  }
}

export function saveSelection(selection: Selection): void {
  try {
    localStorage.setItem(key, JSON.stringify({ generation: selection.generation, game: selection.game }));
  } catch {
    /* Lookups still work when browser storage is unavailable. */
  }
}
