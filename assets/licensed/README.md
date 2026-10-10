# Licensed art (not committed)

Some interface art is cut from paid packs the maintainers bought:

| Pack | Author | Where |
|---|---|---|
| Humble Gift v1.3, Humble Gift Paper UI System v1.1 | [Humble Pixel](https://humblepixel.itch.io) | `humble-gift/` |

Their license allows use and modification in commercial and non-commercial projects, but not redistribution in any form, original or modified. So the packs and everything cut from them stay out of git: only this README is committed.

To use them, unzip each pack into `assets/licensed/humble-gift/` and run `pnpm art`. `scripts/art/licensed.ts` cuts and recolors the pieces into `assets/licensed/ui/`, and `pnpm pack-assets` uses them instead of the code-drawn images of the same name in `assets/ui/`. Without the packs, the code-drawn images are used and nothing breaks.
