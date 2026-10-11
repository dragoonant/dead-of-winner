# Gemini figure concept prompts

Full-body figure concepts for the 30 survivors, generated with Google Gemini (image generation) from each survivor's own card portrait (`public/assets/portraits/<slug>.webp`, converted to PNG and attached as the reference). One chat per batch of 8 (the last batch had 6). Gemini returned 765x1024 or 820x1024 images, saved unchanged as `art/unit-concepts/<slug>.png`. The earlier SDXL concepts are archived in `art/archive/concepts-sdxl/`. Zombie concepts are unchanged.

Quality gates: whole body visible, white background, no text, clothing colours and prop match the portrait. All 30 passed on the first generation, so no retries were needed. Figures read as roughly 6 to 7 heads tall (more realistic than the requested 4.5), and the sheet `art/figure-sheets/gemini-figures.png` shows each portrait beside its figure.

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
