# Palette

`commitcity.hex` and `commitcity.gpl` hold the project's master palette: the 64 colors of **[Resurrect 64](https://lospec.com/palette-list/resurrect-64) by Kerrie Lake**, unchanged. Every opaque pixel in a sprite must use one of these colors (`ART_DIRECTION.md` §6); `pnpm validate-assets` checks it.

- `.gpl` loads in GIMP, Aseprite and Krita. `.hex` is one color per line and is what the validator reads.
- Changing a color requires its own pull request and maintainer approval.

## License

The palette page states no formal license. Its author answered on that page that it may be used in commercial games, and a list of color values is generally not protected by copyright. We credit Kerrie Lake here and in `ART_DIRECTION.md` §6. Checked on 2026-10-09 for milestone 4.1.
