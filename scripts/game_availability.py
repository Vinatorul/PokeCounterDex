"""Read pinned game rosters without executing upstream TypeScript."""

import re

SHOWDOWN_REVISION = "9e317a666d9fd250f36f494778e843141f09bdba"
SHOWDOWN_REPOSITORY = "https://github.com/smogon/pokemon-showdown"
SHOWDOWN_FILES = ("data/pokedex.ts", "data/formats-data.ts", "data/mods/gen8/formats-data.ts", "LICENSE")
SPECIES_LIMITS = {
    1: 151,
    2: 151,
    3: 251,
    4: 251,
    5: 386,
    6: 386,
    7: 386,
    8: 493,
    9: 493,
    10: 493,
    11: 649,
    14: 649,
    15: 721,
    16: 721,
    17: 802,
    18: 807,
    23: 493,
}


def entries(path):
    text = path.read_text(encoding="utf-8")
    return dict(re.findall(r"^\t([a-z0-9]+): \{\n(.*?)^\t\},?", text, re.M | re.S))


def default_species(cache):
    result = {}
    for key, body in entries(cache / "showdown/data/pokedex.ts").items():
        number = re.search(r"^\t\tnum: (\d+),", body, re.M)
        if not number or re.search(r"^\t\tbaseSpecies:", body, re.M):
            continue
        species_id = int(number[1])
        if 1 <= species_id <= 1025:
            result[key] = species_id
    if len(result) != 1025 or set(result.values()) != set(range(1, 1026)):
        raise ValueError("Showdown source must include exactly one base entry per catalog species")
    return result


def supported_species(cache, relative, species, limit):
    formats = entries(cache / "showdown" / relative)
    result = set()
    for key, species_id in species.items():
        if species_id > limit:
            continue
        if key not in formats:
            raise ValueError(f"Missing game support entry: {key}")
        marker = re.search(r'^\t\tisNonstandard: (null|"[^"]+"),', formats[key], re.M)
        if not marker or marker[1] == "null":
            result.add(species_id)
    return result


def game_availability(cache, pokemon_rows):
    species = default_species(cache)
    rosters = {game: set(range(1, limit + 1)) for game, limit in SPECIES_LIMITS.items()}
    rosters[19] = set(range(1, 152)) | {808, 809}
    rosters[20] = supported_species(cache, "data/mods/gen8/formats-data.ts", species, 898)
    rosters[25] = supported_species(cache, "data/formats-data.ts", species, 1025)
    defaults = {int(row["species_id"]): int(row["id"]) for row in pokemon_rows if row["is_default"] == "1"}
    return {game: sorted(defaults[species_id] for species_id in roster) for game, roster in rosters.items()}
