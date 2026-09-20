"""Focused checks for historical and form-specific evolution selection."""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from evolution_data import (
    area_methods,
    describe_method,
    external_method,
    methods_for_game,
    selected_methods,
    standard_edge,
)

FIELDS = [
    "evolution_trigger_id",
    "version_group_id",
    "evolved_species_id",
    "minimum_level",
    "trigger_item_id",
    "held_item_id",
    "known_move_id",
    "known_move_type_id",
    "party_species_id",
    "party_type_id",
    "trade_species_id",
    "gender_id",
    "minimum_happiness",
    "minimum_beauty",
    "minimum_affection",
    "relative_physical_stats",
    "nature_bitmask",
    "time_of_day",
    "location_id",
    "needs_overworld_rain",
    "turn_upside_down",
    "needs_multiplayer",
    "used_move_id",
    "minimum_move_count",
    "minimum_steps",
    "percentage_chance",
    "required_pokemon_form_id",
    "evolved_pokemon_form_id",
    "region_id",
]


def evolution_row(**values):
    return dict.fromkeys(FIELDS, "") | {"evolution_trigger_id": "1", "version_group_id": "1"} | values


def context():
    return {
        "items": {85: "Leaf Stone"},
        "moves": {},
        "types": {},
        "names": {26: "Raichu", 899: "Wyrdeer"},
        "locations": {771: "Blush Mountain", 789: "Vast Poni Canyon"},
        "natures": {},
        "order": {1: 1, 5: 5, 8: 8, 11: 11, 15: 15, 16: 16, 17: 17, 20: 20, 22: 22, 25: 25, 27: 27},
    }


class EvolutionDataTests(unittest.TestCase):
    def test_level_and_item_requirements_are_separate(self):
        level = evolution_row(minimum_level="16", evolved_species_id="2")
        stone = evolution_row(evolution_trigger_id="3", trigger_item_id="85", evolved_species_id="470")
        self.assertEqual(describe_method(level, 2, {"id": 1, "generation": 1}, context()), (16, []))
        self.assertEqual(
            describe_method(stone, 470, {"id": 20, "generation": 8}, context()), (None, ["Use Leaf Stone"])
        )

    def test_friendship_does_not_expose_modern_numeric_threshold(self):
        row = evolution_row(minimum_happiness="160", evolved_species_id="169")
        level, conditions = describe_method(row, 169, {"id": 3, "generation": 2}, context())
        self.assertIsNone(level)
        self.assertEqual(conditions, ["Level up", "High friendship"])

    def test_shedinja_only_requires_a_spare_ball_from_generation_four(self):
        row = evolution_row(evolution_trigger_id="4", evolved_species_id="292")
        level, old = describe_method(row, 292, {"id": 6, "generation": 3}, context())
        _, new = describe_method(row, 292, {"id": 8, "generation": 4}, context())
        self.assertEqual(level, 20)
        self.assertEqual(len(old), 1)
        self.assertIn("Keep a spare Poké Ball in your bag", new)

    def test_unavailable_local_evolutions_require_another_game(self):
        self.assertIn("trade back", external_method(196, 7, context())[0])
        self.assertIn("Diamond / Pearl / Platinum", external_method(470, 10, context())[0])
        self.assertIn("earlier game", external_method(26, 17, context())[0])
        self.assertIn("Legends: Arceus", external_method(899, 25, context())[0])

    def test_sun_moon_does_not_inherit_ultra_only_location(self):
        rows = [evolution_row(version_group_id="17", location_id=location) for location in ("771", "789")]
        self.assertEqual([row["location_id"] for row in area_methods(rows, 462, 17, context())], ["789"])
        self.assertEqual(len(area_methods(rows, 462, 18, context())), 2)

    def test_evolve_elsewhere_retains_actual_requirements(self):
        row = evolution_row(evolved_species_id="196", minimum_happiness="160", time_of_day="day")
        methods = methods_for_game([row], 196, {"id": 7, "generation": 3}, context())
        self.assertEqual(len(methods), 1)
        self.assertIsNone(methods[0][0])
        self.assertIn("High friendship", methods[0][1])
        self.assertIn("During the day", methods[0][1])
        self.assertIn("trade back", methods[0][1][0])

    def test_milotic_retains_remake_beauty_alternative(self):
        rows = [evolution_row(version_group_id=str(version)) for version in (5, 11, 16)]
        expected = {7: ["5"], 15: ["11"], 16: ["11", "16"], 20: ["11"], 23: ["5"]}
        for game, versions in expected.items():
            self.assertEqual(
                [row["version_group_id"] for row in selected_methods(rows, 350, game, context())], versions
            )

    def test_regional_parent_does_not_become_a_standard_species_edge(self):
        row = evolution_row(evolved_species_id="980", required_pokemon_form_id="10422")
        self.assertIsNone(standard_edge(row, {"forms": {194}}))

    def test_hisui_level_override_is_not_reused_in_other_games(self):
        row = evolution_row(evolved_species_id="156", version_group_id="24", region_id="9")
        self.assertIsNone(standard_edge(row, {"forms": set(), "species": {156: {"evolves_from_species_id": "155"}}}))


if __name__ == "__main__":
    unittest.main()
