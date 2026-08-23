# Conversion rules

Use these rules when classifying each visible region in a reference slide.

## Native PowerPoint objects

Recreate these through HTML/CSS so the exporter emits editable text boxes or shapes:

- titles, labels, paragraphs, bullets, numeric values, and footnotes;
- solid or gradient backgrounds, cards, pills, circles, dividers, and connector lines;
- simple tables whose cell boundaries and text are visible;
- bars, columns, progress rings, and line charts whose visible values can be reproduced;
- simple icons that can be represented by inline SVG without changing their appearance.

Keep meaningful elements separate. A label and its background should not become one raster image.

## Raster or vector assets

Retain these as separately positioned assets:

- photographs and product screenshots;
- detailed illustrations, maps, textures, and irregular artwork;
- logos whose exact vector source is unavailable;
- chart regions whose underlying values cannot be read reliably.

Crop only the required source region. Never use the full source slide as a background or full-slide image.

## Text fidelity

- Preserve wording, punctuation, capitalization, numbers, and visible line breaks.
- Use the font visible in the reference when installed. Prefer `Noto Sans CJK JP` as the Japanese fallback.
- Tune font size, weight, line height, and letter spacing independently.
- Do not silently correct apparent spelling or data errors in the source.

## Layout fidelity

- Use the first source image's aspect ratio for the whole deck.
- Map coordinates proportionally from the source image to the slide canvas.
- When later images use another aspect ratio, contain their composition within the deck ratio instead of cropping content.
- Preserve whitespace, alignment axes, visual grouping, and layer order.

## Known boundaries

- A screenshot does not contain hidden chart data, theme definitions, animations, notes, or original font metadata.
- SVG remains a vector object in PowerPoint but may require “Convert to Shape” for point-level editing.
- Browser and PowerPoint font metrics can differ slightly. Comparison rendering is required after export.
- Complex CSS may be rasterized by the converter. Prefer supported, simple CSS when editability matters.

## Security boundary

- Normalize raster assets through `extract-regions.mjs`; it verifies the decoded format and emits PNG.
- Reject remote URLs, data URLs, absolute paths, and formats other than PNG, JPEG, and WebP.
- Keep conversion isolated behind the 120-second process timeout.
- Do not widen the image allowlist until the transitive `image-size` advisories GHSA-w3rx-r6r6-pgpr and GHSA-5p2g-fcmc-qvqq have a reviewed upstream fix.
