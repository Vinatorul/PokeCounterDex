#!/usr/bin/env python3
"""Verify cross-file integrity and representative historical mechanics."""

import ast
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public/data"
GAME_IDS = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14, 15, 16, 17, 18, 19, 20, 23, 25}


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def historical(row, history_field, value_field, generation):
    for entry in row[history_field]:
        if entry["generation"] >= generation:
            return entry[value_field]
    return row[value_field]


def check_catalog(catalog):
    assert len(catalog["pokemon"]) == 1025
    assert {row["id"] for row in catalog["games"]} == GAME_IDS
    assert {row["id"] for row in catalog["generations"]} == set(range(1, 10))
    assert len(catalog["efficacy"]) == 324
    assert len(catalog["pastEfficacy"]) == 6
    assert catalog["source"]["battleTypeIds"] == list(range(1, 19))
    for key in ("pokemon", "games", "moves", "types", "abilities", "methods"):
        assert len(catalog[key]) == len({row["id"] for row in catalog[key]})
    for pokemon in catalog["pokemon"]:
        assert pokemon["displayName"] and pokemon["name"]
        for field in ("pastTypes", "pastAbilities"):
            cutoffs = [row["generation"] for row in pokemon[field]]
            assert cutoffs == sorted(set(cutoffs))
    for attack, defense, factor in catalog["efficacy"]:
        assert attack in range(1, 19) and defense in range(1, 19)
        assert factor in (0, 0.5, 1, 2)
    for row in catalog["pastEfficacy"]:
        assert row["factor"] in (0, 0.5, 1, 2)


def check_pokemon_history(catalog):
    pokemon = {row["id"]: row for row in catalog["pokemon"]}
    types = lambda number, gen: historical(pokemon[number], "pastTypes", "types", gen)
    abilities = lambda number, gen: historical(pokemon[number], "pastAbilities", "abilities", gen)
    assert types(81, 1) == [13] and types(81, 2) == [13, 9]
    assert types(35, 5) == [1] and types(35, 6) == [18]
    assert abilities(1, 2) == []
    assert abilities(1, 3) == [{"id": 65, "hidden": False}]
    assert abilities(94, 6) == [{"id": 26, "hidden": False}]
    assert abilities(94, 7) == [{"id": 130, "hidden": False}]
    assert "Normal" in pokemon[386]["displayName"]
    assert pokemon[1025]["name"] == "pecharunt"
    for row in catalog["games"]:
        assert row["abilitiesEnabled"] == (row["generation"] >= 3 and row["id"] != 19)


def check_move_history(catalog):
    moves = {row["id"]: row for row in catalog["moves"]}
    expected = [(2, 1, 1), (16, 1, 1), (28, 1, 1), (44, 1, 1), (174, 4, 10001), (186, 5, 1), (204, 5, 1), (236, 5, 1)]
    for number, cutoff, old_type in expected:
        assert historical(moves[number], "pastTypes", "type", cutoff) == old_type
        assert historical(moves[number], "pastTypes", "type", cutoff + 1) == moves[number]["type"]
    assert {(row["generation"], row["attack"], row["defense"], row["factor"]) for row in catalog["pastEfficacy"]} == {
        (1, 4, 7, 2),
        (1, 7, 4, 2),
        (1, 8, 14, 0),
        (1, 15, 10, 1),
        (5, 8, 9, 0.5),
        (5, 17, 9, 0.5),
    }


def check_generation_references(catalog):
    types = {row["id"]: row for row in catalog["types"]}
    abilities = {row["id"]: row for row in catalog["abilities"]}
    for pokemon in catalog["pokemon"]:
        for generation in range(pokemon["generation"], 10):
            selected = historical(pokemon, "pastTypes", "types", generation)
            assert all(types[type_id]["generation"] <= generation for type_id in selected)
            selected = historical(pokemon, "pastAbilities", "abilities", generation)
            assert generation >= 3 or not selected
            for ability in selected:
                assert abilities[ability["id"]]["generation"] <= generation
                assert generation >= 5 or not ability["hidden"]
    for move in catalog["moves"]:
        for generation in range(move["generation"], 10):
            type_id = historical(move, "pastTypes", "type", generation)
            assert types[type_id]["generation"] <= generation


def check_learnsets(catalog):
    pokemon = {row["id"]: row for row in catalog["pokemon"]}
    moves = {row["id"]: row for row in catalog["moves"]}
    methods = {row["id"] for row in catalog["methods"]}
    used, total = set(), 0
    for game in catalog["games"]:
        learnset = load(DATA / f"learnsets/{game['id']}.json")
        assert learnset, game["name"]
        for pokemon_id, entries in learnset.items():
            assert pokemon[int(pokemon_id)]["generation"] <= game["generation"]
            assert len(entries) == len({tuple(entry) for entry in entries})
            for move_id, method_id, level in entries:
                assert moves[move_id]["generation"] <= game["generation"]
                assert method_id in methods and isinstance(level, int) and level >= 0
                used.add(move_id)
            total += len(entries)
    assert used == set(moves)
    return total


def check_manifest():
    manifest = load(DATA / "manifest.json")
    sections = [("outputs", DATA)]
    if (ROOT / ".data-cache").exists():
        sections.append(("inputs", ROOT / ".data-cache"))
    for section, directory in sections:
        for record in manifest[section]:
            content = (directory / record["path"]).read_bytes()
            assert len(content) == record["bytes"]
            assert hashlib.sha256(content).hexdigest() == record["sha256"]
    return manifest


def check_function_sizes():
    for path in (ROOT / "scripts").glob("*.py"):
        for node in ast.walk(ast.parse(path.read_text())):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                size = node.end_lineno - node.lineno + 1
                assert size <= 30, f"{path.name}:{node.name} has {size} lines"


def main():
    catalog = load(DATA / "catalog.json")
    check_catalog(catalog)
    check_pokemon_history(catalog)
    check_move_history(catalog)
    check_generation_references(catalog)
    records = check_learnsets(catalog)
    manifest = check_manifest()
    assert records == manifest["counts"]["learnsetRecords"]
    check_function_sizes()
    print(f"Verified {len(catalog['pokemon'])} Pokémon, {len(catalog['games'])} games, {records} learnset records.")


if __name__ == "__main__":
    main()
