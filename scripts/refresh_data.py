#!/usr/bin/env python3
"""Build deterministic static PokéAPI assets; the website never calls an API."""

import argparse
import csv
import hashlib
import json
import re
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from evolution_data import EVOLUTION_TABLES, build_evolutions
from game_availability import SHOWDOWN_FILES, SHOWDOWN_REPOSITORY, SHOWDOWN_REVISION, game_availability

REVISION = "575291cdb197a7e3a320297be276c9de4ef8401a"
REPOSITORY = "https://github.com/PokeAPI/pokeapi"
ROOT = Path(__file__).resolve().parents[1]
GAME_IDS = (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14, 15, 16, 17, 18, 19, 20, 23, 25)
EXCLUDED_GAMES = (
    "Legends: Arceus",
    "Legends: Z-A",
    "Mega Dimension",
    "Champions",
    "Colosseum",
    "XD",
    "Japanese Red/Green and Blue",
)
TABLES = [
    "pokemon",
    "pokemon_species",
    "pokemon_species_names",
    "pokemon_types",
    "pokemon_types_past",
    "pokemon_abilities",
    "pokemon_abilities_past",
    "abilities",
    "ability_names",
    "ability_prose",
    "ability_flavor_text",
    "moves",
    "move_names",
    "move_changelog",
    "pokemon_moves",
    "pokemon_move_methods",
    "pokemon_move_method_prose",
    "types",
    "type_names",
    "type_efficacy",
    "type_efficacy_past",
    "generations",
    "generation_names",
    "version_groups",
    "versions",
    "version_names",
    "pokemon_forms",
    "pokemon_form_names",
    *EVOLUTION_TABLES,
]
FILES = [f"data/v2/csv/{name}.csv" for name in TABLES] + ["LICENSE.md"]


def arguments():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--revision", default=REVISION, help="Full PokéAPI commit SHA")
    parser.add_argument("--offline", action="store_true", help="Use the cached CSV files")
    parser.add_argument("--output", type=Path, default=ROOT / "public/data")
    parser.add_argument("--cache", type=Path, default=ROOT / ".data-cache")
    return parser.parse_args()


def download_file(item):
    relative, url, cache = item
    destination = cache / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(url, timeout=90) as response:
        content = response.read()
    destination.write_bytes(content)


def source_files(revision):
    result = {path: f"https://raw.githubusercontent.com/PokeAPI/pokeapi/{revision}/{path}" for path in FILES}
    result.update(
        {
            f"showdown/{path}": f"https://raw.githubusercontent.com/smogon/pokemon-showdown/{SHOWDOWN_REVISION}/{path}"
            for path in SHOWDOWN_FILES
        }
    )
    return result


def prepare_source(args):
    if not re.fullmatch(r"[0-9a-f]{40}", args.revision):
        raise ValueError("--revision must be a full lowercase commit SHA")
    marker = args.cache / "REVISION"
    showdown_marker = args.cache / "showdown/REVISION"
    if args.offline:
        if not marker.exists() or marker.read_text().strip() != args.revision:
            raise ValueError("Offline cache does not match the requested revision")
        if not showdown_marker.exists() or showdown_marker.read_text().strip() != SHOWDOWN_REVISION:
            raise ValueError("Offline Showdown cache does not match the requested revision")
        return
    with ThreadPoolExecutor(max_workers=6) as pool:
        list(pool.map(download_file, ((path, url, args.cache) for path, url in source_files(args.revision).items())))
    marker.write_text(args.revision + "\n")
    showdown_marker.write_text(SHOWDOWN_REVISION + "\n")


def read_table(cache, name):
    with (cache / f"data/v2/csv/{name}.csv").open(encoding="utf-8", newline="") as stream:
        yield from csv.DictReader(stream)


def load_tables(cache):
    return {name: list(read_table(cache, name)) for name in TABLES if name != "pokemon_moves"}


def index(rows, key="id"):
    return {int(row[key]): row for row in rows}


def group(rows, key):
    result = defaultdict(list)
    for row in rows:
        result[int(row[key])].append(row)
    return result


def names(data, table, key, field="name"):
    return {int(row[key]): row[field] for row in data[table] if row["local_language_id"] == "9" and row[field]}


def build_games(data, availability):
    groups = index(data["version_groups"])
    versions = group(data["versions"], "version_group_id")
    labels = names(data, "version_names", "version_id")
    games = []
    for game_id in GAME_IDS:
        label = " / ".join(labels[int(row["id"])] for row in versions[game_id])
        games.append(
            {
                "id": game_id,
                "name": label,
                "generation": int(groups[game_id]["generation_id"]),
                "abilitiesEnabled": game_id != 19 and int(groups[game_id]["generation_id"]) >= 3,
                "availablePokemon": availability[game_id],
            }
        )
    return games


def build_types(data):
    labels = names(data, "type_names", "type_id")
    return [
        {"id": int(row["id"]), "name": labels[int(row["id"])], "generation": int(row["generation_id"])}
        for row in data["types"]
        if int(row["id"]) in {*range(1, 19), 10001}
    ]


def build_ability_descriptions(data):
    groups = index(data["version_groups"])
    result = {}
    prose = names(data, "ability_prose", "ability_id", "short_effect")
    rows = sorted(data["ability_flavor_text"], key=lambda row: int(groups[int(row["version_group_id"])]["order"]))
    for row in rows:
        if row["language_id"] == "9" and int(row["version_group_id"]) in GAME_IDS:
            result[int(row["ability_id"])] = (" ".join(row["flavor_text"].split()), int(row["version_group_id"]))
    for ability_id, text in prose.items():
        result.setdefault(ability_id, (" ".join(text.split()), None))
    return result


def build_abilities(data):
    labels = names(data, "ability_names", "ability_id")
    descriptions = build_ability_descriptions(data)
    result = []
    for row in data["abilities"]:
        if row["is_main_series"] != "1" or int(row["generation_id"]) > 9:
            continue
        ability_id = int(row["id"])
        description, version = descriptions.get(ability_id, ("No English description in this source snapshot.", None))
        result.append(
            {
                "id": ability_id,
                "name": labels[ability_id],
                "description": description,
                "generation": int(row["generation_id"]),
                "descriptionVersionGroup": version,
            }
        )
    return result


def packed_abilities(rows):
    return [
        {"id": int(row["ability_id"]), "hidden": row["is_hidden"] == "1"}
        for row in sorted(rows, key=lambda row: int(row["slot"]))
        if row["ability_id"]
    ]


def abilities_at(current, history, generation):
    if generation < 3:
        return []
    slots = {int(row["slot"]): row for row in current}
    for slot, changes in group(history, "slot").items():
        applicable = [row for row in changes if int(row["generation_id"]) >= generation]
        if applicable:
            slots[slot] = min(applicable, key=lambda row: int(row["generation_id"]))
    rows = [row for row in slots.values() if generation >= 5 or row["is_hidden"] != "1"]
    return packed_abilities(rows)


def ability_history(current, history, introduction):
    cutoffs = {int(row["generation_id"]) for row in history} | {2, 4}
    return [
        {"generation": generation, "abilities": abilities_at(current, history, generation)}
        for generation in sorted(cutoffs)
        if introduction <= generation <= 9
    ]


def type_history(rows):
    result = []
    for generation, values in sorted(group(rows, "generation_id").items()):
        types = [int(row["type_id"]) for row in sorted(values, key=lambda row: int(row["slot"]))]
        result.append({"generation": generation, "types": types})
    return result


def pokemon_display_names(data):
    species = names(data, "pokemon_species_names", "pokemon_species_id")
    form_names = names(data, "pokemon_form_names", "pokemon_form_id", "form_name")
    forms = {int(row["pokemon_id"]): row for row in data["pokemon_forms"] if row["is_default"] == "1"}
    result = {}
    for row in data["pokemon"]:
        if row["is_default"] != "1":
            continue
        pokemon_id = int(row["id"])
        label = species[int(row["species_id"])]
        form = form_names.get(int(forms[pokemon_id]["id"]), "")
        result[pokemon_id] = f"{label} ({form})" if form else label
    return result


def build_pokemon(data):
    species = index(data["pokemon_species"])
    labels = pokemon_display_names(data)
    related = {
        table: group(data[table], "pokemon_id")
        for table in ("pokemon_types", "pokemon_types_past", "pokemon_abilities", "pokemon_abilities_past")
    }
    result = []
    for row in data["pokemon"]:
        generation = int(species[int(row["species_id"])]["generation_id"])
        if row["is_default"] != "1" or generation > 9:
            continue
        pokemon_id = int(row["id"])
        current = related["pokemon_abilities"][pokemon_id]
        types = sorted(related["pokemon_types"][pokemon_id], key=lambda row: int(row["slot"]))
        result.append(
            {
                "id": pokemon_id,
                "name": row["identifier"],
                "displayName": labels[pokemon_id],
                "generation": generation,
                "types": [int(value["type_id"]) for value in types],
                "pastTypes": type_history(related["pokemon_types_past"][pokemon_id]),
                "abilities": packed_abilities(current),
                "pastAbilities": ability_history(current, related["pokemon_abilities_past"][pokemon_id], generation),
            }
        )
    return result


def build_learnsets(cache, pokemon, games, data):
    species = {row["id"]: row for row in pokemon}
    game_map = {row["id"]: row for row in games}
    moves = index(data["moves"])
    result = {game_id: defaultdict(set) for game_id in GAME_IDS}
    for row in read_table(cache, "pokemon_moves"):
        pokemon_id, game_id, move_id = (int(row[key]) for key in ("pokemon_id", "version_group_id", "move_id"))
        if pokemon_id not in species or game_id not in game_map:
            continue
        generation = game_map[game_id]["generation"]
        if species[pokemon_id]["generation"] > generation or int(moves[move_id]["generation_id"]) > generation:
            continue
        result[game_id][pokemon_id].add((move_id, int(row["pokemon_move_method_id"]), int(row["level"])))
    return {
        game_id: {str(pid): sorted(values) for pid, values in sorted(entries.items())}
        for game_id, entries in result.items()
    }


def move_type_history(data):
    groups = index(data["version_groups"])
    earliest = {}
    for row in groups.values():
        generation = int(row["generation_id"])
        earliest[generation] = min(earliest.get(generation, int(row["order"])), int(row["order"]))
    result = defaultdict(list)
    for row in data["move_changelog"]:
        if not row["type_id"]:
            continue
        changed = groups[int(row["changed_in_version_group_id"])]
        generation = int(changed["generation_id"])
        if int(changed["order"]) != earliest[generation]:
            raise ValueError("Move type changed within a generation; schema must be extended")
        result[int(row["move_id"])].append({"generation": generation - 1, "type": int(row["type_id"])})
    return {key: sorted(values, key=lambda value: value["generation"]) for key, values in result.items()}


def build_moves(data, learnsets):
    used = {move[0] for entries in learnsets.values() for values in entries.values() for move in values}
    labels = names(data, "move_names", "move_id")
    past = move_type_history(data)
    return [
        {
            "id": int(row["id"]),
            "name": labels[int(row["id"])],
            "type": int(row["type_id"]),
            "generation": int(row["generation_id"]),
            "pastTypes": past.get(int(row["id"]), []),
        }
        for row in data["moves"]
        if int(row["id"]) in used
    ]


def source_metadata(revision):
    return {
        "name": "PokéAPI",
        "url": REPOSITORY,
        "revision": revision,
        "csvUrl": f"{REPOSITORY}/tree/{revision}/data/v2/csv",
        "schemaVersion": 1,
        "historySemantics": "Inclusive generation cutoff: select the first past entry with cutoff >= requested generation, else use current.",
        "pokemonScope": "One default Pokémon per species through generation IX. No alternate or regional forms.",
        "availabilityNote": "Generation is species introduction, not proof of local catchability, transferability, or availability in a selected game.",
        "availabilitySource": {"url": SHOWDOWN_REPOSITORY, "revision": SHOWDOWN_REVISION},
        "learnsetNote": "Only explicit records for the selected version group. Missing entries mean no data; no fallback to another game. Groups 20 and 25 contain source DLC-era updates.",
        "abilityHistoryNote": "Reconstructed from sparse slot changes; source history can be incomplete. No abilities before generation III or in Let's Go; no hidden abilities before generation V. Hidden slot presence does not establish release availability.",
        "abilityDescriptionNote": "Descriptions use the latest available English text in a supported game, not historical battle effects.",
        "excludedGames": EXCLUDED_GAMES,
        "excludedMechanics": [
            "Terastallization and Stellar",
            "Mega Evolution",
            "Dynamax",
            "alternate and regional forms",
        ],
        "battleTypeIds": list(range(1, 19)),
        "displayOnlyTypeIds": [10001],
        "license": "BSD-3-Clause; see POKEAPI-LICENSE.txt",
        "attributionManifest": "manifest.json",
    }


def build_past_efficacy(data):
    return [
        {
            "generation": int(row["generation_id"]),
            "attack": int(row["damage_type_id"]),
            "defense": int(row["target_type_id"]),
            "factor": int(row["damage_factor"]) / 100,
        }
        for row in data["type_efficacy_past"]
    ]


def build_catalog(data, revision, pokemon, games, learnsets):
    labels = names(data, "generation_names", "generation_id")
    methods = names(data, "pokemon_move_method_prose", "pokemon_move_method_id", "name")
    efficacy = [
        [int(row["damage_type_id"]), int(row["target_type_id"]), int(row["damage_factor"]) / 100]
        for row in data["type_efficacy"]
    ]
    past = build_past_efficacy(data)
    return {
        "source": source_metadata(revision),
        "generations": [{"id": key, "name": labels[key]} for key in range(1, 10)],
        "games": games,
        "types": build_types(data),
        "pokemon": pokemon,
        "evolutions": build_evolutions(data, pokemon, games),
        "abilities": build_abilities(data),
        "moves": build_moves(data, learnsets),
        "efficacy": efficacy,
        "pastEfficacy": sorted(past, key=lambda row: (row["generation"], row["attack"], row["defense"])),
        "methods": [
            {"id": int(row["id"]), "name": methods[int(row["id"])], "identifier": row["identifier"]}
            for row in data["pokemon_move_methods"]
        ],
    }


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")


def file_record(path, relative):
    content = path.read_bytes()
    return {"path": relative, "bytes": len(content), "sha256": hashlib.sha256(content).hexdigest()}


def build_manifest(args, catalog, learnsets):
    counts = {
        key: len(catalog[key]) for key in ("pokemon", "games", "types", "abilities", "moves", "methods", "evolutions")
    }
    counts["learnsetRecords"] = sum(len(values) for entries in learnsets.values() for values in entries.values())
    return {
        "source": source_metadata(args.revision),
        "counts": counts,
        "inputs": [file_record(args.cache / path, path) for path in source_files(args.revision)],
        "outputs": [
            file_record(path, str(path.relative_to(args.output)))
            for path in sorted(args.output.rglob("*.json"))
            if path.name != "manifest.json"
        ],
        "learnsets": [
            {
                "versionGroupId": game_id,
                "pokemon": len(entries),
                "records": sum(len(values) for values in entries.values()),
            }
            for game_id, entries in learnsets.items()
        ],
    }


def main():
    args = arguments()
    prepare_source(args)
    data = load_tables(args.cache)
    games = build_games(data, game_availability(args.cache, data["pokemon"]))
    pokemon = build_pokemon(data)
    learnsets = build_learnsets(args.cache, pokemon, games, data)
    catalog = build_catalog(data, args.revision, pokemon, games, learnsets)
    write_json(args.output / "catalog.json", catalog)
    for game_id, entries in learnsets.items():
        write_json(args.output / f"learnsets/{game_id}.json", entries)
    (args.output / "POKEAPI-LICENSE.txt").write_bytes((args.cache / "LICENSE.md").read_bytes())
    (args.output / "SHOWDOWN-LICENSE.txt").write_bytes((args.cache / "showdown/LICENSE").read_bytes())
    manifest = build_manifest(args, catalog, learnsets)
    write_json(args.output / "manifest.json", manifest)
    print(json.dumps(manifest["counts"], indent=2))


if __name__ == "__main__":
    main()
