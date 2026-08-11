# Campus background clips

`.mp4` files dropped here become the video mosaic behind the landing page and
the sign-in / sign-up screens.

**Two steps to add one:**

1. Put the `.mp4` in this folder.
2. Add its filename to `BACKGROUND_VIDEOS` in
   `react-webapp/frontend/pages/auth/backgroundVideos.ts`.

Files in `public/` are copied verbatim by Vite and served from `/videos/<name>.mp4`,
so they never pass through the bundle — which is why the list in that file is
explicit rather than auto-discovered.

## Encoding

Every visitor downloads these before they can sign in, and they sit behind a
5px blur at ~80% brightness, so quality matters far less than size.

- **Codec:** H.264 (`avc1`) in an `.mp4`. Safari will not decode much else, and
  a clip that fails to decode leaves a visibly empty tile.
- **Length:** 5–15s. They loop.
- **Resolution:** 720p is plenty behind the blur.
- **Size:** aim for a few hundred KB each.
- **Audio:** strip it. The tiles are muted permanently (browsers block
  autoplay with sound), so an audio track is pure download weight.

A reasonable ffmpeg pass:

```bash
ffmpeg -i input.mp4 -an -vf "scale=-2:720" -c:v libx264 -crf 30 -preset slow \
  -movflags +faststart output.mp4
```

`-an` drops audio; `-movflags +faststart` moves the index to the front so
playback can begin before the whole file arrives.

## Notes

- The folder can be empty. The mosaic falls back to the design's translucent
  placeholder tiles, so the screens still look finished with no footage.
- At most `MAX_CONCURRENT_VIDEOS` (currently 10) tiles decode at once —
  browsers cap concurrent decoders, and exceeding that leaves tiles frozen on
  their first frame. Remaining tiles use the placeholder.
- Visitors with `prefers-reduced-motion` get no video at all, by design.
