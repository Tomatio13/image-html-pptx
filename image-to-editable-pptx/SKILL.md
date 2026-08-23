---
name: image-to-editable-pptx
description: Reconstruct one or more reference slide images as a high-fidelity PowerPoint deck whose text, basic shapes, lines, tables, and simple charts remain editable. Use for PNG, JPEG, or WebP slide screenshots that must become editable PPTX; do not use for ordinary image-only embedding or editing an existing PPTX.
---

# Image to Editable PPTX

Rebuild reference slide images as HTML/CSS, then export the browser-computed layout to native PowerPoint objects. Preserve the reference rather than redesigning it.

## Required outcome

- Create one PowerPoint slide per input image, preserving input order.
- Recreate text, backgrounds, basic shapes, lines, tables, and simple charts as editable objects.
- Keep photographs, logos, and complex illustrations as separately movable or replaceable image objects.
- Never satisfy the task by placing the complete source image over an otherwise empty slide.
- Deliver the `.pptx`, reconstruction HTML, local assets, comparison preview, and validation result.

## Workflow

Set `SKILL_DIR` to the absolute path of the directory containing this `SKILL.md` before running its scripts.

1. Resolve every input image and inspect it at original resolution. Accept only real PNG, JPEG, and WebP raster inputs. Record its pixel dimensions and transcribe visible text exactly. Ask about unreadable text instead of inventing it.
2. Read [references/conversion-rules.md](references/conversion-rules.md) before deciding which regions are native objects and which remain raster assets.
3. Copy [assets/slide-template.html](assets/slide-template.html) into a task-local working directory. Build every slide as one `.slide` element.
4. Use local relative assets only. For photos or complex artwork, define pixel regions in JSON and run:

   ```bash
   node "$SKILL_DIR/scripts/extract-regions.mjs" \
     --input reference.png \
     --regions regions.json \
     --output-dir work/assets
   ```

5. Use the first image's aspect ratio for the deck. Keep later images fully visible when their ratio differs; represent the necessary letterbox area in the reconstructed slide.

   🔴 **CHECKPOINT — fidelity exception:** Before the first export, stop and ask for user approval if any visible text remains unreadable, a font substitution materially changes the layout, or a region must remain raster because it cannot be reconstructed faithfully. Resume only after the user approves the stated tradeoff.

6. Validate before export:

   ```bash
   node "$SKILL_DIR/scripts/validate-html.mjs" \
     --input work/slides.html \
     --report work/html-validation.json
   ```

7. Export with the local pinned converter. Do not use `npx` or a CDN at runtime:

   ```bash
   node "$SKILL_DIR/scripts/export-pptx.mjs" \
     --input work/slides.html \
     --output work/presentation.pptx
   ```

8. Verify editability and render a comparison preview:

   ```bash
   node "$SKILL_DIR/scripts/verify-pptx.mjs" \
     --input work/presentation.pptx \
     --expected-slides 2 \
     --report work/pptx-validation.json

   node "$SKILL_DIR/scripts/render-preview.mjs" \
     --input work/presentation.pptx \
     --reference slide-01.png \
     --reference slide-02.png \
     --output-dir work/preview
   ```

9. Inspect every side-by-side preview. Fix missing text, clipping, overlaps, incorrect crop, font substitution, and material layout differences, then repeat validation and export.

## Reconstruction rules

- Use explicit pixel dimensions and absolute positioning inside each slide when matching a reference. CSS Grid or Flexbox is acceptable when it produces the same computed geometry.
- Keep text as real text nodes. Match line breaks deliberately; do not convert text to SVG paths or images.
- Prefer native CSS rectangles, ellipses, borders, and lines over SVG. Use SVG for simple charts or icons when that preserves editability better.
- Preserve source content and hierarchy. Do not introduce new claims, labels, decoration, animations, or speaker notes unless requested.
- Treat validation errors as blocking. Warnings require visual review and a short disclosure if they cannot be corrected.

## Environment and failure handling

- Run `npm install` in this skill directory once before first use.
- Chrome or Chromium is required for DOM measurement.
- Normalize every raster asset through `extract-regions.mjs`; do not pass arbitrary formats or data URLs to the converter. The pinned converter has an unpatched transitive `image-size` denial-of-service advisory for crafted ICNS, JXL, and HEIF input.
- Export runs in a killable child process with a 120-second timeout. LibreOffice and `pdftoppm` are required only for comparison previews.
  | Trigger                                      | First response                                                                                  | If it still fails                                                                     |
  | -------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
  | Input is not a local PNG, JPEG, or WebP file | Stop and request a supported local raster file.                                                 | Reject the input; do not download a URL or widen the format allowlist.                |
  | Visible text cannot be read                  | Stop and request the exact text from the user.                                                  | Preserve the region as an image only when the user explicitly approves that tradeoff. |
  | HTML validation reports an error             | Correct the reported HTML or asset-path issue, then rerun validation.                           | Do not export until validation passes.                                                |
  | Export fails or exceeds 120 seconds          | Report the command, stderr, and root cause; correct the reconstruction or runtime prerequisite. | Stop without a PPTX; do not replace the deck with screenshots.                        |
  | Preview rendering is unavailable             | Deliver the passing PPTX validation report and state that visual comparison was not produced.   | Do not claim visual fidelity was verified.                                            |
- If a source uses an unavailable proprietary font, use the closest installed font consistently and disclose the substitution.
