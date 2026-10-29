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

## Rooster (needs a licence check before a store release)

`src/audio/rooster.mp3` is cut from `Rooster_Sound_Effect.mp3`, which Navid supplied on 29 Oct 2026: one crow (1.42 s to 4.2 s of the file), faded out, played back at double speed, loudness-matched and re-encoded to 112 kbps mono. The file's metadata points to a YouTube upload (channel "Animal Jam Giveaway", https://www.youtube.com/watch?v=SztUSAooJKc) and carries no licence. Until its rights are confirmed, treat it as unlicensed: before a Play Store release, either get written permission or replace it with a CC0 or CC BY crow (the earlier build used "Rooster Crow" by Mike Koenig, SoundBible.com, CC BY 3.0).
