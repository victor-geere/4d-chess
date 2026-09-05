# 4D Chess

Two-player, hot-seat chess on a 4×4×4×4 hypercube (256 cells), rendered as a
4×4 grid of 4×4 mini-boards. Static site: plain HTML, CSS and vanilla
JavaScript — no build step, no dependencies.

## Rules in brief

- **Board**: axes x, y, z, w each 0..3. Each mini-board is one (z, w) slice;
  inside it columns are x and rows are y. Boards run left→right by z and
  bottom→top by w. Cell colour follows (x+y+z+w) parity.
- **Setup**: White on the w=0 slice, Black mirrored on w=3 with the same x, y, z
  layout. Board z=0 back rank (y=0): R N K B; board z=1 back rank: B Q N R;
  four pawns on y=1 of each of those two boards. Boards z=2,3 start empty.
  Each side: 1 K, 1 Q, 2 R, 2 B, 2 N, 8 P.
- **Rook** slides along one axis. **Bishop** slides changing exactly two axes at
  once. **Queen** slides along any of the 80 directions in {−1,0,1}⁴.
  **King** steps one cell in any of those 80 directions. **Knight** jumps
  ±2 on one axis and ±1 on another (48 jumps). Sliders stop at the first
  occupied cell (capture if enemy).
- **Pawns** move one step forward in w (White +w, Black −w) onto an empty
  cell; no double step. They capture one step forward plus one step in
  exactly one of x, y, z. They promote to a Queen on the far w rank.
- You may never leave your own king in check. Checkmate and stalemate are
  detected and announced; a missing king also ends the game.

## Run locally

Serve the folder with any static file server, e.g.

```sh
python3 -m http.server 8080
# or: npx serve .
```

then open <http://localhost:8080/>. (A server is needed because `game.js` is
loaded as an ES module.)

## Tests

```sh
node --test tests/
```

## Deploy

Import the repo at <https://vercel.com/new> — no build step, no configuration.
