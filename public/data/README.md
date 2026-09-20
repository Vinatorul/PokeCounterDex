# PokéCounterDex static data

These files contain one default Pokémon for each of the 1,025 species introduced through generation IX, plus the learnsets explicitly recorded for 20 core-game version groups. The browser needs only `public/data/`; it does not call PokéAPI.

The source is the [PokéAPI CSV repository](https://github.com/PokeAPI/pokeapi/tree/575291cdb197a7e3a320297be276c9de4ef8401a/data/v2/csv), pinned to commit `575291cdb197a7e3a320297be276c9de4ef8401a`. PokéAPI is a community-maintained source, not an official Nintendo dataset. Its license and trademark notice are retained in `public/data/POKEAPI-LICENSE.txt`.

Game support lists use [Pokémon Showdown](https://github.com/smogon/pokemon-showdown/tree/9e317a666d9fd250f36f494778e843141f09bdba), pinned to `9e317a666d9fd250f36f494778e843141f09bdba`. Its MIT license is retained in `SHOWDOWN-LICENSE.txt`. These lists include trades, transfers, DLC and historical events; they do not imply current event availability or availability of every form.

## Refresh and verify

Python 3.10 or newer is sufficient; the scripts have no third-party dependencies.

```sh
python3 scripts/refresh_data.py
python3 scripts/verify_data.py
```

The refresh downloads the required CSV files, Showdown roster files and upstream licenses from the pinned commits. To rebuild without network access, use `python3 scripts/refresh_data.py --offline`. The cache's `REVISION` and `showdown/REVISION` files identify the snapshots. A different PokéAPI snapshot requires an explicit full SHA: `python3 scripts/refresh_data.py --revision FULL_COMMIT_SHA`. Review changes and run verification after refreshing. `--cache` and `--output` accept other directories.

The generated `manifest.json` records the revision, attribution, counts, and SHA-256 of every input and generated JSON output. Do not deploy `.data-cache/`, `.tools/`, or the scripts; only deploy `public/data/`.

## Files and schema

- `catalog.json` contains generations, games, Pokémon, types, abilities, move names/types, learning methods, and the type chart.
- Each game's `availablePokemon` lists supported species as default Pokémon IDs, including trades, transfers, DLC and historical events. This is independent of learnset coverage.
- `learnsets/{versionGroupId}.json` maps a Pokémon ID to arrays of `[moveId, methodId, level]`. The IDs are original PokéAPI IDs. Identical tuples are deduplicated. Level zero is preserved; do not assume it means a level-up move.
- `manifest.json` gives per-game Pokémon and record counts, input/output hashes, source notes, and attribution.
- `POKEAPI-LICENSE.txt` is the upstream license, copied verbatim.
- `SHOWDOWN-LICENSE.txt` is the game-roster source's license, copied verbatim.

The agreed catalog fields are preserved. Optional additional fields are `games[].abilitiesEnabled`, `abilities[].generation`, `abilities[].descriptionVersionGroup`, and `methods:[{id,name,identifier}]`. The `source` object includes scope and history notes plus `battleTypeIds` and `displayOnlyTypeIds`.

Pokémon `name` is the source identifier, for example `deoxys-normal`; `displayName` combines the English species and default form label, for example `Deoxys (Normal Forme)`. Move, type, ability, and game names are English display names. A Pokémon's `generation` is its species' introduction. This does not establish that it can be caught, transferred, or used in every game of that generation. Do not hide a species just because its selected game's learnset is absent; show that this dataset has no moves for that combination.

## Historical cutoffs

`pastTypes`, `pastAbilities`, `moves[].pastTypes`, and `pastEfficacy` use **inclusive final-generation cutoffs**. For requested generation `g`, choose the entry with the smallest cutoff that is at least `g`; use the current value if none matches. For efficacy, select history separately for each attack/defense pair.

```js
const historical = entries.find(entry => entry.generation >= generation);
const value = historical ? historical[field] : currentValue;
```

For example, Magnemite's cutoff 1 means Electric only in generation I, and Electric/Steel later. Clefairy's cutoff 5 means Normal through generation V and Fairy from VI. Steel's resistance to Ghost and Dark has cutoff 5. Ghost attacking Psychic has factor 0 through generation I. All factors are actual multipliers (`0`, `0.5`, `1`, `2`), not percentages.

PokéAPI explicitly documents the last-generation semantics for [Pokémon types and abilities](https://pokeapi.co/docs/v2#pokemon) and [type relations](https://pokeapi.co/docs/v2#types). The pinned `pokemon_v2/models.py` also describes these models as values used until a given generation.

Move history needs a different conversion: `move_changelog.csv` names the release **in which the old value changed**, in `changed_in_version_group_id`. For this snapshot all eight move-type changes occur in the first release group of a generation; the builder verifies this and stores `changed generation - 1`. Thus Bite is Normal through I, Curse is `???` through IV, and Charm is Normal through V. Refresh fails if a future source introduces a within-generation move-type change that this schema cannot represent. The `???` type (10001) is display-only and must not become a type-chart row. Use `source.battleTypeIds` (1–18), filtered by type introduction, for the ordinary battle chart.

## Ability limits

The upstream ability history is a sparse list of changed **slots**, not full ability sets. An empty ability ID means that the slot did not previously exist. The builder applies the nearest relevant cutoff separately to every slot, then emits complete `pastAbilities` snapshots. For example, Bulbasaur retains Overgrow in generations III–IV; only its hidden Chlorophyll slot is removed.

The source is not complete: 21 default species lack the early empty hidden-slot records needed to suppress hidden abilities in generations III–IV. The builder therefore also applies the general mechanics explicitly: no abilities before generation III, no hidden abilities before generation V, and `abilitiesEnabled:false` for Let's Go. Historical ability slot data does not prove that a hidden ability was released or obtainable in a particular game. Source ability changes can also be missing or only recorded at generation granularity. Do not label this a complete game-specific ability-availability database.

Ability descriptions use the latest available English flavor text from a supported game, falling back to the source's short effect text. `descriptionVersionGroup` identifies the flavor text's version group or is null for the fallback. These are reference descriptions, not verified historical effect descriptions. A calculator that applies abilities must independently handle historical effect changes and relevant battle conditions.

## Game and mechanic scope

The version-group IDs are `1,2,3,4,5,6,7,8,9,10,11,14,15,16,17,18,19,20,23,25`: Red/Blue, Yellow, Gold/Silver, Crystal, Ruby/Sapphire, Emerald, FireRed/LeafGreen, Diamond/Pearl, Platinum, HeartGold/SoulSilver, Black/White, Black 2/White 2, X/Y, Omega Ruby/Alpha Sapphire, Sun/Moon, Ultra Sun/Ultra Moon, Let's Go, Sword/Shield, Brilliant Diamond/Shining Pearl, Scarlet/Violet.

Only explicit learnset rows for each group are included. No moves are inferred from adjacent games or from another generation. Sword/Shield and Scarlet/Violet source rows include DLC-era updates; the source has no separate learnset rows for their DLC version-group IDs. There is no distinction here between base-game and DLC access, patches, individual paired versions, transfer-only legality, or event distribution. Absence of a row means no data, not proof that a move is impossible.

Legends: Arceus, Legends: Z-A, Mega Dimension, Champions, Colosseum/XD, and Japanese Red/Green/Blue groups are excluded. Regional forms, alternate forms, Mega Evolution, Dynamax, Terastallization, and Stellar mechanics are also excluded. Species originally introduced in excluded games remain in the species catalog if their introduction is generation IX or earlier; only their explicit learnsets in supported games are included.
