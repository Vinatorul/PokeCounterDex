import type { Catalog, Learnsets } from './models.ts';

export const asset = (path: string): string => `${import.meta.env.BASE_URL}${path}`;
const learnsets = new Map<number, Promise<Learnsets>>();

async function readJson<T>(path: string): Promise<T> {
  const response = await fetch(asset(path));
  if (!response.ok) throw new Error(`Could not load ${path}`);
  return response.json() as Promise<T>;
}

export async function loadCatalog(): Promise<Catalog> {
  return readJson<Catalog>('data/catalog.json');
}

export function loadLearnsets(game: number): Promise<Learnsets> {
  const cached = learnsets.get(game);
  if (cached) return cached;
  const pending = readJson<Learnsets>(`data/learnsets/${game}.json`).catch((error) => {
    learnsets.delete(game);
    throw error;
  });
  learnsets.set(game, pending);
  return pending;
}
