# Font and audio licenses

Bundled fonts: Figtree, Courier Prime, Big Shoulders Stencil, Lilita One and Nunito, installed from their @fontsource packages under the SIL Open Font License 1.1. Full notices accompany this file. Other runtime dependencies retain their own licenses in their published packages. Supplied game artwork was carried over from Navid’s v0.6.00 archive; review its original provenance before store release.

## Music

Players pick a field track and a menu track under Settings → Tracks. Every track is credited in the game under Settings → Credits, with its licence link and what was changed. All files live in `src/audio/music/`; each was shortened to a seamless loop (50 ms crossfade at the seam), loudness-matched (EBU R128, −16 LUFS for field tracks, −17 for menu tracks) and re-encoded to 96 kbps MP3.

| File | Track | Author | Licence |
|---|---|---|---|
| `meatball.mp3` | Meatball Parade (default field track) | Kevin MacLeod (incompetech.com) | CC BY 4.0 |
| `hillbilly.mp3` | Hillbilly Swing | Kevin MacLeod (incompetech.com) | CC BY 4.0 |
| `nothing_broken.mp3` | Nothing Broken | Kevin MacLeod (incompetech.com) | CC BY 4.0 |
| `fireflies.mp3` | Fireflies and Stardust | Kevin MacLeod (incompetech.com) | CC BY 4.0 |
| `one_polka.mp3` | One | pheonton (OpenGameArt) | CC BY 3.0 |
| `jamboree.mp3` | Jumping Jamboree | tcarisland (OpenGameArt) | CC BY 4.0 |
| `joyful_jungle.mp3` | Joyful Jungle | MintoDog (OpenGameArt) | CC0 |
| `gone_fishin.mp3` | Gone Fishin' (default menu track) | Memoraphile @ You're Perfect Studio (OpenGameArt) | CC0 |

Licence texts: CC BY 4.0 https://creativecommons.org/licenses/by/4.0/ · CC BY 3.0 https://creativecommons.org/licenses/by/3.0/ · CC0 https://creativecommons.org/publicdomain/zero/1.0/

OpenGameArt's FAQ notes that Apple's App Store terms have been found to conflict with CC BY; check this before an iOS release.

## Rooster

`src/audio/rooster.mp3` (v0.11.2) is "Cartoon Rooster Sounds" by DRAGON-STUDIO, from Pixabay (https://pixabay.com/sound-effects/nature-cartoon-rooster-sounds-487663/), under the Pixabay Content License (free for commercial and non-commercial use, no attribution required; credited anyway in Settings → Credits). Navid supplied the file on 3 Nov 2026. Changes: loudness-matched to the old crow (about −16 LUFS), a 150 ms fade at the end, mono 44.1 kHz, re-encoded to 112 kbps. It replaces the earlier crow cut from a YouTube upload with no licence.
