# Asset placeholders

Add the following image files to complete the visual presentation:

- `israel-oladeji` portrait (preferred `jpg`, but `jpeg`, `png`, or `webp` work as well).
- `morawatch` app icon (preferred `png`, but `jpg` or `webp` are also supported).
- `all-saints-online` app icon (preferred `png`, but `jpg` or `webp` are also supported).

These images are optional at runtime; if they are not present the layout will automatically fall back to gradient-based placeholders. When you are ready, place the optimized images (preferably square PNGs for the app icons and a portrait JPG for the hero) in this folder.

## How to collect the artwork

1. Open each App Store listing in a desktop browser:
   - Morawatch: <https://apps.apple.com/us/app/morawatch/id6752028378>
   - All Saints Online: <https://apps.apple.com/us/app/all-saints-online/id6746954455>
2. Hover over the large icon in the left sidebar, right-click, and choose **“Open Image in New Tab”** (or **“Open Link in New Tab”**). The URL ends in `1024x1024bb.png`. Save that PNG—it’s the production asset Apple serves to devices.
3. Rename the downloaded files to `morawatch.png` and `all-saints-online.png` before copying them into this folder. (The page will also accept `.jpg`, `.jpeg`, or `.webp` versions if you prefer another format.)
4. Alternatively, from the Apple Developer profile (<https://apps.apple.com/us/developer/israel-oladeji/id1810104310>) select the app, open the icon preview, and download the same 1024×1024 PNG via the browser context menu.
5. For the portrait, drop your headshot into this folder as `israel-oladeji.jpg`. If your file uses a different extension, keep the base name (`israel-oladeji`) and the site will automatically try `.jpg`, `.jpeg`, `.png`, `.webp`, and uppercase variants.
6. When you replace any of these images, bump the `data-asset-version` value on the `<html>` tag in `index.html` to bust caches (e.g., change it from `2` to `3`).

> ⚠️ File names on the web are case-sensitive. Stick to lowercase names (e.g., `morawatch.png`, not `MoraWatch.PNG`) to guarantee the images load everywhere.

## Troubleshooting

- **Portrait or icons still not showing?** Confirm the filenames exactly match the patterns above and make sure there are no spaces (e.g., `israel-oladeji.JPG` is OK, `Israel Oladeji.jpg` is not). After renaming, refresh the page or increment `data-asset-version`.
- **Need to optimize the icons?** For best results, keep them square, 1024×1024, and under 500 KB. Tools like [Squoosh](https://squoosh.app/) can compress PNGs without quality loss.
