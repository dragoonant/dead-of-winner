# Gemini figure concept prompts

Full-body figure concepts for the 30 survivors, generated with Google Gemini (image generation) from each survivor's own card portrait (`public/assets/portraits/<slug>.webp`, converted to PNG and attached as the reference). One chat per batch of 8 (the last batch had 6). Gemini returned 765x1024 or 820x1024 images, saved unchanged as `art/unit-concepts/<slug>.png`. The earlier SDXL concepts are archived in `art/archive/concepts-sdxl/`. Zombie concepts are unchanged.

Quality gates: whole body visible, white background, no text, clothing colours and prop match the portrait. All 30 passed on the first generation, so no retries were needed. Those first figures read as roughly 6 to 7 heads tall (more realistic than the requested 4.5); they are archived in `art/archive/concepts-gemini-realistic/` and replaced by the miniature-proportion edits described in the last section. The sheet `art/figure-sheets/gemini-figures.png` shows each portrait beside its figure.

## Prompt (each survivor except Sparky, with the survivor's portrait attached)

```
Create an image: Using the attached character as the design reference (same face, hair, clothing, colours and prop), create a full-body figure of this character: front three-quarter view, standing in a natural pose, feet visible, mildly stylized heroic proportions about four and a half heads tall, detailed clothing and gear, realistic not cute, plain pure white background, even soft studio lighting, no shadows, no ground, no text, no logos.
```

## Prompt (Sparky, the dog)

```
Create an image: Using the attached character as the design reference (same face, fur, colours and gear), create a full-body side three-quarter view of this same dog, realistic proportions, plain pure white background, even soft studio lighting, no shadows, no ground, no text, no logos.
```

## Batches

1. alexis-grey, andrew-evans, annaleigh-chan, arthur-thurston, ashley-ross, bev-russell, brandon-kane, brian-lee
2. carla-thompson, daniel-smith, david-garcia, edward-white, forest-plum, gabriel-diaz, gray-beard, harman-brooks
3. buddy-davis, james-meyers, janet-taylor, jenny-clark, john-price, loretta-clay, maria-lopez, mike-cho
4. olivia-brown, rod-miller, sophie-robinson, sparky, talia-jones, thomas-heart

## Proportion edit (second pass, replaces the figures above)

Each survivor's figure PNG was edited in Gemini (Claude in Chrome, Windows PC, images attached through the hidden file input, never the clipboard) to about 4.5 heads tall. One chat per batch of 8 (the last had 5). Sparky is unchanged (a dog keeps natural proportions). Edited results are saved over `art/unit-concepts/<slug>.png`; the previous Gemini figures are in `art/archive/concepts-gemini-realistic/`. Gemini returned 765x1024 images, saved unchanged. Ratios on `art/figure-sheets/gemini-figures.png` are head-to-height measured with PIL on the silhouette (crown or hat top to feet) plus a chin line read by eye on a ruler overlay, so each is good to about 0.15 heads.

Test results on daniel-smith and janet-taylor (head-to-height, hat included for Daniel):

1. Wording A, the plain edit prompt below: Daniel 5.3 (and it turned into a photo of a miniature on a base), Janet 7.1 (unchanged). Failed.
2. Wording B ("a clearly larger head, a short sturdy torso and short stocky legs, head about one fifth of the total height"): Janet 5.8, only the head grew, legs stayed long, caricature look.
3. Wording C ("head about 22 percent ... legs shortened by about a third ... not a caricature"): Janet unchanged at about 7. Failed.
4. Wording D (B plus "legs about a third shorter than in this image"): Janet 6.6. Failed.

Gemini keeps the composition of the attached image, so text alone cannot shorten the body. What worked (wording E): before uploading, the body below the chin line was squashed vertically by a per-figure factor (0.50 to 0.90, aimed at 4.4 heads, with the head left unscaled) with PIL, and Gemini was asked to repaint the squashed figure cleanly and keep its proportions. Result: Daniel 4.35, Janet 4.45; all 29 survivors measure 4.2 to 5.3 heads, mean 4.6.

### Wording A (first test, did not work)

```
Edit this image: keep the exact same character, face, clothing, colours, prop and pose, but restyle the body proportions as a premium painted tabletop miniature: the head is larger relative to the body so the total height is about four and a half head-heights, sturdy slightly shorter legs, slightly oversized hands and prop, detailed and realistic surfaces, not cute. Full body head to feet, plain pure white background, even soft lighting, no shadows, no text.
```

### Wording E (used for all 29 survivors, with the pre-squashed figure attached)

```
Edit this image: this figure has deliberately short, sturdy premium painted tabletop miniature proportions, about four and a half heads tall. Keep exactly the same overall proportions, head size and height, and keep the exact same character, face, clothing, colours, prop and pose. Repaint it cleanly with natural anatomy, sharp detail and consistent realistic surfaces, slightly oversized hands and prop, not cute. Full body head to feet, standing on nothing (no base, no ground), plain pure white background, even soft lighting, no shadows, no text.
```

Batches: 1. alexis-grey, andrew-evans, annaleigh-chan, arthur-thurston, ashley-ross, bev-russell, brandon-kane, brian-lee. 2. daniel-smith, carla-thompson, david-garcia, edward-white, forest-plum, gabriel-diaz, gray-beard, harman-brooks. 3. buddy-davis, james-meyers, janet-taylor, jenny-clark, john-price, loretta-clay, maria-lopez, mike-cho. 4. olivia-brown, rod-miller, sophie-robinson, talia-jones, thomas-heart. No figure needed a retry (one slow generation, jenny-clark, was still collected intact).
