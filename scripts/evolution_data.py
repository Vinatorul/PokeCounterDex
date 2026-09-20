"""Build standard-form evolution methods from the pinned PokéAPI tables."""

from collections import defaultdict

EVOLUTION_TABLES = ("pokemon_evolution", "item_names", "location_names", "nature_names")
AREA_EVOLUTIONS = {462, 470, 471, 476, 738, 740}
AREA_CONTEXT = {8: 8, 9: 8, 11: 11, 14: 11, 15: 15, 16: 16, 17: 17, 18: 17, 23: 8}
SPECIAL_TRIGGERS = {
    5: "Spin while holding a Sweet",
    6: "Complete the Tower of Darkness and read the Scroll of Darkness",
    7: "Complete the Tower of Waters and read the Scroll of Waters",
    8: "Land 3 critical hits in one battle",
    10: "Gain a level in battle",
    11: "Use the required move in Agile Style",
    14: "Level up after using the required move",
    15: "Defeat 3 Bisharp leading groups of Pawniard, then level up",
    16: "Level up with 999 Gimmighoul Coins in your bag",
    17: "Evolve in Pokémon GO with 400 Meltan Candy, then transfer Melmetal",
}


def english_names(data, table, key):
    return {int(row[key]): row["name"] for row in data[table] if row["local_language_id"] == "9"}


def evolution_context(data, pokemon):
    defaults = {int(row["id"]): row for row in data["pokemon"] if row["is_default"] == "1"}
    forms = {
        int(row["id"])
        for row in data["pokemon_forms"]
        if row["is_default"] == "1" and int(row["pokemon_id"]) in defaults
    }
    return {
        "forms": forms,
        "species": {int(row["id"]): row for row in data["pokemon_species"]},
        "defaults": {int(row["species_id"]): int(row["id"]) for row in defaults.values()},
        "pokemon": {row["id"]: row for row in pokemon},
        "order": {int(row["id"]): int(row["order"]) for row in data["version_groups"]},
        "items": english_names(data, "item_names", "item_id"),
        "locations": english_names(data, "location_names", "location_id"),
        "moves": english_names(data, "move_names", "move_id"),
        "types": english_names(data, "type_names", "type_id"),
        "names": english_names(data, "pokemon_species_names", "pokemon_species_id"),
        "natures": english_names(data, "nature_names", "nature_id"),
    }


def standard_edge(row, context):
    for field in ("required_pokemon_form_id", "evolved_pokemon_form_id"):
        if row[field] and int(row[field]) not in context["forms"]:
            return None
    target = int(row["evolved_species_id"])
    source = context["species"][target]["evolves_from_species_id"]
    if not source or int(row["version_group_id"]) in {30, 31, 32}:
        return None
    if row["region_id"] == "9" or (row["version_group_id"] == "24" and target not in {899, 900, 901}):
        return None
    edge = (context["defaults"].get(int(source)), context["defaults"].get(target))
    return edge if all(value in context["pokemon"] for value in edge) else None


def latest_methods(rows, context, game_id):
    last_group = {20: 22, 25: 27}.get(game_id, game_id)
    applicable = [row for row in rows if context["order"][int(row["version_group_id"])] <= context["order"][last_group]]
    if not applicable:
        return []
    newest = max(context["order"][int(row["version_group_id"])] for row in applicable)
    return [row for row in applicable if context["order"][int(row["version_group_id"])] == newest]


def area_methods(rows, target, game_id, context):
    if game_id in AREA_CONTEXT:
        version = AREA_CONTEXT[game_id]
        selected = [row for row in rows if int(row["version_group_id"]) == version]
        if game_id == 17:
            selected = [row for row in selected if row["location_id"] != "771"]
        if game_id == 23 and target in {462, 470}:
            selected += [row for row in rows if row["version_group_id"] == "20"]
        return selected
    return latest_methods(rows, context, game_id)


def selected_methods(rows, target, game_id, context):
    if target == 350:
        versions = {5} if game_id in {5, 6, 7, 8, 9, 10, 23} else {11}
        if game_id == 16:
            versions = {11, 16}
        return [row for row in rows if int(row["version_group_id"]) in versions]
    if target in AREA_EVOLUTIONS:
        return area_methods(rows, target, game_id, context)
    return latest_methods(rows, context, game_id)


def external_method(target, game_id, context):
    if game_id == 7 and target in {196, 197}:
        return ["Evolve Eevee in Ruby / Sapphire / Emerald, then trade back"]
    if game_id == 10 and target in {462, 470, 471, 476}:
        return ["Evolve in Diamond / Pearl / Platinum, then trade back"]
    if game_id == 25 and target in {899, 900, 901}:
        return [f"Transfer an evolved {context['names'][target]} from Pokémon Legends: Arceus"]
    if game_id == 17 and target in {26, 103, 105}:
        return [f"Transfer an evolved {context['names'][target]} from an earlier game"]
    if game_id == 20 and target in {110, 122}:
        return [f"Transfer an evolved {context['names'][target]} from another game"]
    return None


def trigger_conditions(row, game, context):
    trigger = int(row["evolution_trigger_id"])
    if trigger == 1:
        return [] if row["minimum_level"] else ["Level up"]
    if trigger == 2:
        return ["Trade"]
    if trigger == 3:
        return [f"Use {context['items'][int(row['trigger_item_id'])]}"]
    if trigger == 4:
        conditions = ["Evolve Nincada into Ninjask with an empty party slot"]
        return conditions + (["Keep a spare Poké Ball in your bag"] if game["generation"] >= 4 else [])
    if trigger in SPECIAL_TRIGGERS:
        return [SPECIAL_TRIGGERS[trigger]]
    raise ValueError(f"Untranslated standard-form evolution trigger: {trigger}")


def named_conditions(row, context):
    fields = {
        "held_item_id": ("items", "Hold {}"),
        "known_move_id": ("moves", "Know {}"),
        "known_move_type_id": ("types", "Know a {}-type move"),
        "party_species_id": ("names", "Have {} in your party"),
        "party_type_id": ("types", "Have a {}-type Pokémon in your party"),
        "trade_species_id": ("names", "Trade for {}"),
    }
    return [text.format(context[names][int(row[field])]) for field, (names, text) in fields.items() if row[field]]


def personal_conditions(row, context):
    result = []
    if row["gender_id"]:
        result.append({"1": "Female", "2": "Male"}[row["gender_id"]])
    for field, text in (("minimum_happiness", "High friendship"), ("minimum_beauty", "High Beauty")):
        if row[field]:
            result.append(text)
    if row["minimum_affection"]:
        result.append(f"At least {row['minimum_affection']} affection hearts")
    if row["relative_physical_stats"]:
        result.append(
            {"-1": "Attack < Defense", "0": "Attack = Defense", "1": "Attack > Defense"}[row["relative_physical_stats"]]
        )
    if row["nature_bitmask"]:
        mask = int(row["nature_bitmask"])
        names = [name for key, name in sorted(context["natures"].items()) if mask & (1 << (key - 1))]
        result.append("Nature: " + ", ".join(names))
    return result


def environment_conditions(row, context):
    result = []
    if row["time_of_day"]:
        result.append(
            {
                "day": "During the day",
                "night": "At night",
                "dusk": "At dusk",
                "full-moon": "During a full moon",
            }[row["time_of_day"]]
        )
    if row["location_id"]:
        prefix = "Near the Moss Rock in " if row["evolved_species_id"] == "470" else "In "
        if row["evolved_species_id"] == "471":
            prefix = "Near the Ice Rock on "
        result.append(prefix + context["locations"][int(row["location_id"])])
    flags = {
        "needs_overworld_rain": "While it is raining in the overworld",
        "turn_upside_down": "Hold the console upside down",
        "needs_multiplayer": "While connected to another player in the Union Circle",
    }
    return result + [text for field, text in flags.items() if row[field] == "1"]


def special_conditions(row, context):
    result = []
    if row["used_move_id"]:
        result.append(f"Use {context['moves'][int(row['used_move_id'])]} {row['minimum_move_count']} times")
    if row["minimum_steps"]:
        result.append(f"Walk {int(row['minimum_steps']):,} steps in Let's Go mode without returning to its Poké Ball")
    target = int(row["evolved_species_id"])
    if target in {266, 268}:
        result.append("Evolution branch is fixed for each Wurmple")
    if target in {925, 982}:
        form = "Family of Four" if target == 925 else "Two-Segment Form"
        result.append(f"{form}: {row['percentage_chance']}% of individuals")
    return result


def historical_conditions(row, target, game_id):
    result = []
    if game_id == 7 and target > 151:
        result.append("National Pokédex required")
    if target == 350 and game_id in {7, 10}:
        other = "Ruby / Sapphire / Emerald" if game_id == 7 else "Diamond / Pearl / Platinum"
        result.append(f"Raise Beauty in {other} before trading")
    if target in {196, 197} and game_id in {15, 16, 17, 18, 20, 25}:
        result.append("Do not meet Sylveon's Fairy-move requirement")
    if target == 745 and game_id in {17, 18}:
        result.append("Sun / Ultra Sun version")
    if target in {26, 103, 105} and game_id == 18:
        result.append("While in Ultra Space")
    return result


def describe_method(row, target, game, context):
    conditions = trigger_conditions(row, game, context) + named_conditions(row, context)
    conditions += personal_conditions(row, context) + environment_conditions(row, context)
    conditions += special_conditions(row, context) + historical_conditions(row, target, game["id"])
    level = int(row["minimum_level"]) if row["minimum_level"] else None
    if int(row["evolution_trigger_id"]) == 4:
        level = 20
    return level, list(dict.fromkeys(conditions))


def methods_for_game(rows, target, game, context):
    external = external_method(target, game["id"], context)
    if not external:
        return [
            describe_method(row, target, game, context) for row in selected_methods(rows, target, game["id"], context)
        ]
    source_id = {7: 5, 10: 8, 17: 16, 20: 16, 25: 24}[game["id"]]
    source_game = {"id": source_id, "generation": {5: 3, 8: 4, 16: 6, 24: 8}[source_id]}
    selected = selected_methods(rows, target, source_id, context)
    return [
        (level, external + conditions)
        for row in selected
        for level, conditions in [describe_method(row, target, source_game, context)]
    ]


def edge_methods(edge, rows, games, context):
    target = int(rows[0]["evolved_species_id"])
    grouped = {}
    for game in games:
        if not all(key in game["availablePokemon"] for key in edge):
            continue
        if any(context["pokemon"][key]["generation"] > game["generation"] for key in edge):
            continue
        methods = methods_for_game(rows, target, game, context)
        for level, conditions in methods:
            key = (level, tuple(conditions))
            method = grouped.setdefault(key, {"games": [], "level": level, "conditions": conditions})
            if game["id"] not in method["games"]:
                method["games"].append(game["id"])
    return list(grouped.values())


def build_evolutions(data, pokemon, games):
    context = evolution_context(data, pokemon)
    grouped = defaultdict(list)
    for row in data["pokemon_evolution"]:
        edge = standard_edge(row, context)
        if edge:
            grouped[edge].append(row)
    result = []
    for edge, rows in sorted(grouped.items()):
        methods = edge_methods(edge, rows, games, context)
        if methods:
            result.append({"from": edge[0], "to": edge[1], "methods": methods})
    return result
