# Cube Texture Specification

The rolling cube uses one image atlas at `cube-atlas.png`.

## Canvas

- Recommended size: `1024 x 768 px`
- Aspect ratio: `4:3`
- Grid: `4 columns x 3 rows`
- Face size: `256 x 256 px`
- Color space: sRGB
- Recommended formats: PNG or WebP

## Layout

```text
+--------+--------+--------+--------+
| unused |  TOP   | unused | unused |
+--------+--------+--------+--------+
|  LEFT  | FRONT  | RIGHT  |  BACK  |
+--------+--------+--------+--------+
| unused | BOTTOM | unused | unused |
+--------+--------+--------+--------+
```

Draw every face upright as viewed directly from outside that face. The code maps
the six cells to the Three.js box automatically.

## Safe Area

- Keep important artwork at least `16 px` away from each face edge.
- A `24 px` inset is safer for faces containing a character or logo.
- Extend background colors all the way to the edge of every `256 x 256` cell.
- Avoid small text. It becomes hard to read while the cube is moving.
- Avoid transparent face backgrounds unless seeing through the cube is intended.

The UV coordinates are inset by `2 px` on every face to reduce color bleeding
between neighboring cells.

## Replacing It

1. Export the new atlas as `1024 x 768 px`.
2. Replace `cube-atlas.png` and keep the same filename.
3. Rebuild the web project in HBuilderX.

To use another filename or format, change `CUBE_TEXTURE_URL` near the top of
`static/cube-world.js`.

`cube-atlas.svg` is the editable source for the included example texture.
