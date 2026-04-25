# Chromebook launch flow (Option 2)

This is the folder-linked approach:

- OpenScope source/build files stay as-is.
- `chromebook-launch-openscope.html` is only a top-layer launcher.
- The launcher points to `./openscope-6.28.0/public/index.html`.

## Expected structure

```text
/workspace-or-download-folder/
  chromebook-launch-openscope.html
  openscope-6.28.0/
    public/
      index.html
      assets/
      ...
```

## How to use on Chromebook

1. Place this launcher file in the same folder as `openscope-6.28.0/`.
2. Ensure `openscope-6.28.0/public/index.html` exists.
3. Open `chromebook-launch-openscope.html` in Chrome.
4. It auto-forwards (or click **Launch OpenScope**).

## Notes

- If `public/index.html` is missing, OpenScope has not been built/exported yet.
- This launcher does not modify OpenScope itself; it only links to the existing files.
