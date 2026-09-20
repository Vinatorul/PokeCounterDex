export interface Type {
  id: number;
  name: string;
  generation: number;
}
export interface AbilitySlot {
  id: number;
  hidden: boolean;
}
export interface Pokemon {
  id: number;
  name: string;
  displayName: string;
  generation: number;
  types: number[];
  pastTypes: { generation: number; types: number[] }[];
  abilities: AbilitySlot[];
  pastAbilities: { generation: number; abilities: AbilitySlot[] }[];
}
export interface Ability {
  id: number;
  name: string;
  description: string;
  generation: number;
}
export interface Move {
  id: number;
  name: string;
  type: number;
  generation: number;
  pastTypes: { generation: number; type: number }[];
}
export interface Game {
  id: number;
  name: string;
  generation: number;
  abilitiesEnabled: boolean;
  availablePokemon: number[];
}
export interface Catalog {
  generations: { id: number; name: string }[];
  games: Game[];
  types: Type[];
  pokemon: Pokemon[];
  abilities: Ability[];
  moves: Move[];
  methods: { id: number; name: string; identifier: string }[];
  efficacy: [number, number, number][];
  pastEfficacy: { generation: number; attack: number; defense: number; factor: number }[];
}
export interface Matchup {
  type: Type;
  factor: number;
  parts: number[];
}
export interface Selection {
  generation: number;
  game: number | null;
}
export interface AppState extends Selection {
  mode: 'pokemon' | 'types' | 'gallery';
  pokemon: number;
  types: number[];
}
export interface GalleryFilters {
  generation: number | null;
  game: number | null;
  query: string;
}
export type Learnset = [move: number, method: number, level: number][];
export type Learnsets = Record<string, Learnset>;
