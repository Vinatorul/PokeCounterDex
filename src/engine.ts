import type { AbilitySlot, Catalog, Matchup, Move, Pokemon, Selection } from './models.ts';

export function historical<T extends { generation: number }>(
  entries: T[],
  generation: number,
): T | undefined {
  return entries
    .filter((entry) => entry.generation >= generation)
    .sort((a, b) => a.generation - b.generation)[0];
}

export function pokemonTypes(pokemon: Pokemon, generation: number): number[] {
  return historical(pokemon.pastTypes, generation)?.types ?? pokemon.types;
}

export function pokemonAbilities(pokemon: Pokemon, generation: number): AbilitySlot[] {
  if (generation < 3) return [];
  const slots = historical(pokemon.pastAbilities, generation)?.abilities ?? pokemon.abilities;
  return slots.filter((slot) => generation >= 5 || !slot.hidden);
}

export function moveType(move: Move, generation: number): number {
  return historical(move.pastTypes, generation)?.type ?? move.type;
}

export function battleTypes(catalog: Catalog, generation: number) {
  return catalog.types.filter((type) => type.id <= 18 && type.generation <= generation);
}

export function effectiveness(catalog: Catalog, attack: number, defense: number, generation: number): number {
  const past = catalog.pastEfficacy.filter((row) => row.attack === attack && row.defense === defense);
  return (
    historical(past, generation)?.factor ??
    catalog.efficacy.find((row) => row[0] === attack && row[1] === defense)?.[2] ??
    1
  );
}

const immunityAbilities: Record<string, number> = {
  Levitate: 5,
  'Volt Absorb': 13,
  'Water Absorb': 11,
  'Flash Fire': 10,
  'Motor Drive': 13,
  'Dry Skin': 11,
  'Sap Sipper': 12,
  'Earth Eater': 5,
  'Well-Baked Body': 10,
};

export function abilityFactor(name: string, attack: number, base: number, generation: number): number {
  if (base === 0 || immunityAbilities[name] === attack) return 0;
  if (
    generation >= 5 &&
    ((name === 'Lightning Rod' && attack === 13) || (name === 'Storm Drain' && attack === 11))
  )
    return 0;
  if (name === 'Wonder Guard' && base <= 1) return 0;
  if (name === 'Thick Fat' && [10, 15].includes(attack)) return base / 2;
  if (['Heatproof', 'Water Bubble'].includes(name) && attack === 10) return base / 2;
  if (name === 'Purifying Salt' && attack === 8) return base / 2;
  if (name === 'Dry Skin' && attack === 10) return base * 1.25;
  if (['Filter', 'Solid Rock', 'Prism Armor'].includes(name) && base > 1) return base * 0.75;
  return base;
}

export function supportedAbility(name: string): boolean {
  return (
    Object.hasOwn(immunityAbilities, name) ||
    [
      'Lightning Rod',
      'Storm Drain',
      'Wonder Guard',
      'Thick Fat',
      'Heatproof',
      'Water Bubble',
      'Purifying Salt',
      'Filter',
      'Solid Rock',
      'Prism Armor',
    ].includes(name)
  );
}

export function defenseMatchups(
  catalog: Catalog,
  types: number[],
  generation: number,
  ability = '',
): Matchup[] {
  return battleTypes(catalog, generation).map((type) => {
    const parts = types.map((defense) => effectiveness(catalog, type.id, defense, generation));
    const base = parts.reduce((total, factor) => total * factor, 1);
    return { type, parts, factor: abilityFactor(ability, type.id, base, generation) };
  });
}

export function attackMatchups(catalog: Catalog, attack: number, generation: number): Matchup[] {
  return battleTypes(catalog, generation).map((type) => {
    const factor = effectiveness(catalog, attack, type.id, generation);
    return { type, parts: [factor], factor };
  });
}

export function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/♀/g, 'f')
    .replace(/♂/g, 'm')
    .replace(/[^a-z0-9]/g, '');
}

export function searchPokemon(catalog: Catalog, query: string): Pokemon[] {
  const term = normalize(query);
  if (!term) return [];
  return catalog.pokemon
    .filter(
      (pokemon) =>
        normalize(pokemon.displayName).includes(term) ||
        normalize(pokemon.name).includes(term) ||
        String(pokemon.id) === String(Number(term)),
    )
    .sort(
      (a, b) =>
        Number(normalize(b.displayName).startsWith(term)) -
          Number(normalize(a.displayName).startsWith(term)) || a.id - b.id,
    );
}

export function rulesForPokemon(pokemon: Pokemon, selection: Selection): Selection {
  return pokemon.generation > selection.generation
    ? { generation: pokemon.generation, game: null }
    : { generation: selection.generation, game: selection.game };
}
