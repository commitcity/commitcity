# `assets`

Source artwork. Follow [`docs/ART_DIRECTION.md`](../docs/ART_DIRECTION.md). Licensed under CC BY-SA 4.0 (see [`ASSETS_LICENSE`](../ASSETS_LICENSE)).

```
assets/
  palette/        the 64 project colors (.hex, .gpl); see palette/README.md
  ui/             interface images: panels, buttons, cursors (ART_DIRECTION.md §16)
  buildings/
    <id>/         one folder per building, named like its manifest id
      manifest.json
      view-0.png
      view-0.abandoned.png
```

## Adding a building

1. Load `palette/commitcity.gpl` in your editor and draw with those colors only.
2. Create `buildings/<id>/` with a `manifest.json` (`ART_DIRECTION.md` §12) and one PNG per declared view and variant.
3. Run `pnpm validate-assets`. It lists every problem with the file, the pixel, and the fix.
4. Run `pnpm dev` and open `/dev/city?fixture=large`. Your building appears in the city without any code change.
