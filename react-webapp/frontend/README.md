# JitHub frontend

React + Vite + TypeScript. `npm run dev` to start, `npm run build` to produce `dist/`.

## Deploy caching (`vercel.json`)

Two `Cache-Control` rules mark everything under `public/` as immutable for a year.
The reasoning is recorded here because **`vercel.json` cannot hold it**: JSON has no
comment syntax, and Vercel's schema sets `additionalProperties: false` on header
objects, so a `"//"` key fails the build with

```
`headers[0]` should NOT have additional property `//`
```

### `/videos/(.*)`

Files in `public/` are served under their own names, so Vercel cannot content-hash
them and defaults to `max-age=0, must-revalidate` — meaning every repeat visitor
re-validates all 20 backdrop clips before the auth screen appears. These are
write-once assets: a changed clip gets a new filename in `pages/auth/backgroundVideos.ts`,
so caching them immutably is safe and makes the second visit instant.

### `/(.*)\.(png|jpg|jpeg|webp|svg|glb)`

Same reasoning for the logo, favicons, club images, and 3D models in `public/`.

**If you ever overwrite a file in `public/` in place rather than giving it a new
name, browsers will keep the old copy for up to a year.** Rename instead.
