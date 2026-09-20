# PokéCounterDex

A static Pokémon matchup guide. Choose a game or generation, find a Pokémon, and see its weaknesses, resistances, immunities and learnable moves. The type checker shows attack and defense separately and combines two defending types correctly.

## Run locally

Use Node.js 24 or newer (`nvm use` reads `.nvmrc`).

```sh
npm ci
npm run dev
```

The default selection is FireRed / LeafGreen. Game and generation preferences are saved in your browser. Selecting a game sets its generation; selecting a generation clears the game selection. Pick a game to see exact learnsets.

Search finds Pokémon from every generation. Selecting a Pokémon introduced after the current rules switches to its introduction generation and clears the older game selection.

Open **Browse** to choose a Pokémon by its picture. It starts with all 1,025 Pokémon, with optional name, introduction-generation and game filters. **Clear filters** restores the full gallery. The gallery is directly accessible at `#gallery` and supports browser Back/Forward navigation.

## GitHub Pages

1. In the repository, open **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Push the site to `main`, or run **Check and deploy Pages** from the Actions tab.

The workflow checks, tests and builds the site, then deploys `dist`. Pull requests run checks without deploying. The expected project URL is `https://vinatorul.github.io/PokeCounterDex/` once deployment succeeds.

All asset URLs are relative, so the build works under a repository subpath or a custom domain. No backend, API key, external fonts or runtime PokéAPI requests are needed.

```sh
npm run build
npm run preview
```

## Coverage

- Generations I–IX, 1,025 species in their standard forms and 20 game groups. Related releases such as FireRed / LeafGreen share their source learnset group.
- Historical Pokémon and move types, including Gen I quirks, the introduction of Steel/Dark/Fairy, and Steel’s changed resistances.
- Game filters include supported species obtainable through trades, transfers, DLC and historical events. They are not limited to regional Pokédexes or currently active events. Paired versions are combined; the lists do not show catch locations or form-specific availability.
- Regional, Mega and other alternate forms, Legends games, Colosseum/XD, Terastallization and other battle transformations are not included.
- Matchups use type effects. Abilities, weather, items and move-specific exceptions are not simulated.
- Learnsets can be missing. Missing data is shown explicitly rather than replaced with another game’s moves.
- A learnset lists possible moves, not an opponent’s actual four moves. Move power, accuracy and physical/special categories are not displayed.

## Checks and data refresh

```sh
npm run check
npm test
npm run build
python3 scripts/verify_data.py
```

PokéAPI data, Pokémon Showdown game rosters and sprites are bundled at pinned source revisions. Ordinary builds do not download data. See `public/data/README.md` and the attribution files under `public/` for source details and licenses. Refreshing the data requires Python 3.10+ and network access:

```sh
python3 scripts/refresh_data.py
python3 scripts/verify_data.py
```

The refresh script caches source files in `.data-cache/`. It rebuilds data, not sprites; adding species or forms requires matching sprite assets. Re-run the checks after updating.

The interface uses TypeScript, Vite and plain CSS. The browser’s experimental WebMCP interface is supported when available; it is optional and the normal controls work without it.

## Credits

Data: [PokéAPI](https://github.com/PokeAPI/pokeapi). Game rosters: [Pokémon Showdown](https://github.com/smogon/pokemon-showdown), distributed under the MIT license. Sprites: [PokéAPI sprites](https://github.com/PokeAPI/sprites), including community artwork for later generations. Fonts: DM Sans and Space Grotesk, distributed under the SIL Open Font License. Pokémon and Pokémon character names belong to their respective owners. This is an unofficial fan project.

Project code is distributed under the repository’s MIT license. Bundled third-party data, images and fonts retain their own notices.
