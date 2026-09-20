# Local web fonts

DM Sans and Space Grotesk are bundled as unmodified Latin WOFF2 variable fonts from Google Fonts. Both use the SIL Open Font License 1.1; the original licenses are included alongside the files.

- **DM Sans**: DM Sans Project Authors, 2014. [Project source](https://github.com/googlefonts/dm-fonts). License: `DM-Sans-OFL.txt`.
- **Space Grotesk**: Space Grotesk Project Authors, 2020. [Project source](https://github.com/floriankarsten/space-grotesk). License: `Space-Grotesk-OFL.txt`.

Downloaded September 20, 2026 using the official [Google Fonts CSS API](https://fonts.googleapis.com/css2?family=DM+Sans:wght@400..700&family=Space+Grotesk:wght@400..700&display=swap). The requested normal weight range is 400–700. Only the Latin subset was downloaded; it includes the accented `é` in Pokémon and the multiplication sign `×`.

`google-fonts-original.css` preserves the provider response for provenance. Do not import that file into the site. `fonts.css` contains only local font URLs and assumes that the two WOFF2 files are served from `/fonts/`. Remove the existing Google Fonts import when integrating this file.

The license copies come from [google/fonts revision e44c4b011a820c2cbe2fd2cfa8052037d7edb571](https://github.com/google/fonts/tree/e44c4b011a820c2cbe2fd2cfa8052037d7edb571). The WOFF2 download URLs and SHA-256 checksums are recorded separately in `manifest.json`.
