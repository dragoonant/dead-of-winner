# Art prompts (Dead of Winner)

Figure concepts were made locally with SDXL (base + fp16 VAE) on the RTX 5080: 4 seeds (0-3) per figure, 832x1216, 30 steps, CFG 6.5. Prompts longer than 77 tokens are encoded in 75-token chunks and concatenated. The picked seed per figure is listed below; every candidate for a figure used the same prompt.

Style consistency: the first survivors (alexis-grey, andrew-evans, annaleigh-chan, arthur-thurston, ashley-ross, bev-russell) were generated with no style reference (style 0). The alexis-grey concept (seed 0) was then cut out onto white and used as an IP-Adapter style reference (style-only block, scale 0.25) for every later survivor and zombie. Reference scans of the original cards were used only to write our own text descriptions (age, build, clothing, colours, occupation prop); the characters are original designs inspired by the occupation. Nothing was traced, and no scan is in the repo.

Known deviation: SDXL does not hold an exact head-to-height ratio. Picks measure roughly 5 to 6 heads (the closest of four candidates); the Hunyuan stages keep what the concept shows. Sparky is a dog, so his prompt says "realistic dog proportions" instead of the head-count sentence. The background renders pale grey rather than pure white; the cutout stage removes it.

Zombie prompts add "gaunt" and grey-blue winter clothing to the same prefix.

## Shared figure prompt

Prefix (survivors and zombies): `one single character, full body, front three-quarter view, standing, winter apocalypse clothing, isolated on a pure white background, plain white background, high-key even soft lighting, no shadows, no text, no logos, mildly stylized heroic proportions, about four and a half heads tall, the head is almost a fifth of the whole height, large head, broad torso, short sturdy legs, detailed clothing and gear, not cute, painted miniature concept, `

Dog prefix (Sparky): ``

Negative prompt: `character sheet, model sheet, turnaround, multiple views, inset details, equipment pieces, collage, multiple figures, base, stand, pedestal, ground, floor, snow, forest, trees, scenery, shadow, grey background, beige background, dark background, vignette, gradient background, cast shadow, text, watermark, logo, blurry, cropped, cut off, tall slim fashion proportions, small head, long legs, cartoon, cute, toy, anime`

## Per figure (full prompt of the picked concept)

### alexis-grey (Librarian), seed 0, style 0 (none)

`one single character, full body, front three-quarter view, standing, winter apocalypse clothing, isolated on a pure white background, plain white background, high-key even soft lighting, no shadows, no text, no logos, mildly stylized heroic proportions, about four and a half heads tall, the head is almost a fifth of the whole height, large head, broad torso, short sturdy legs, detailed clothing and gear, not cute, painted miniature concept, a slim woman in her late 20s with auburn hair in a tight bun and round glasses, long charcoal wool coat, crimson scarf and gloves, hugging a thick leather-bound ledger, canvas satchel on one hip`

### andrew-evans (Farmer), seed 0, style 0 (none)

`one single character, full body, front three-quarter view, standing, winter apocalypse clothing, isolated on a pure white background, plain white background, high-key even soft lighting, no shadows, no text, no logos, mildly stylized heroic proportions, about four and a half heads tall with a large head, broad torso and short sturdy legs, detailed clothing and gear, not cute, painted miniature concept, a stocky bearded man in his 50s, green cap, olive quilted work jacket, canvas trousers, mud-caked boots, gripping a long-handled hay fork`

### annaleigh-chan (Lawyer), seed 0, style 0 (none)

`one single character, full body, front three-quarter view, standing, winter apocalypse clothing, isolated on a pure white background, plain white background, high-key even soft lighting, no shadows, no text, no logos, mildly stylized heroic proportions, about four and a half heads tall with a large head, broad torso and short sturdy legs, detailed clothing and gear, not cute, painted miniature concept, a slender woman in her 30s with a long black ponytail, long dark grey belted trench coat, leather briefcase in one hand, small flashlight in the other`

### arthur-thurston (Principal), seed 0, style 0 (none)

`one single character, full body, front three-quarter view, standing, winter apocalypse clothing, isolated on a pure white background, plain white background, high-key even soft lighting, no shadows, no text, no logos, mildly stylized heroic proportions, about four and a half heads tall, the head is almost a fifth of the whole height, large head, broad torso, short sturdy legs, detailed clothing and gear, not cute, painted miniature concept, a heavyset balding man in his 60s with a stern face, mustard-brown insulated jacket over a black turtleneck, grey slacks, ring of keys on his belt, whistle on a lanyard, clipboard under one arm`

### ashley-ross (Construction Worker), seed 0, style 0 (none)

`one single character, full body, front three-quarter view, standing, winter apocalypse clothing, isolated on a pure white background, plain white background, high-key even soft lighting, no shadows, no text, no logos, mildly stylized heroic proportions, about four and a half heads tall with a large head, broad torso and short sturdy legs, detailed clothing and gear, not cute, painted miniature concept, an athletic woman in her 30s with long brown hair, cream puffer jacket with a fur-trimmed hood, leather tool belt, work gloves, heavy boots, framing hammer in one hand`

### bev-russell (Mother), seed 0, style 0 (none)

`one single character, full body, front three-quarter view, standing, winter apocalypse clothing, isolated on a pure white background, plain white background, high-key even soft lighting, no shadows, no text, no logos, mildly stylized heroic proportions, about four and a half heads tall with a large head, broad torso and short sturdy legs, detailed clothing and gear, not cute, painted miniature concept, a woman in her 40s with curly golden hair, bright orange parka cinched at the waist, jeans, green gloves, canvas supply bag over one shoulder, cast-iron frying pan held ready`

### brandon-kane (Janitor), seed 0, style 0.25, reference alexis-grey s0

`one single character, full body, front three-quarter view, standing, winter apocalypse clothing, isolated on a pure white background, plain white background, high-key even soft lighting, no shadows, no text, no logos, mildly stylized heroic proportions, about four and a half heads tall, the head is almost a fifth of the whole height, large head, broad torso, short sturdy legs, detailed clothing and gear, not cute, painted miniature concept, an average-built man in his 50s with glasses and a thick moustache, olive-green work coat over a dark shirt, jeans, rubber boots, key ring on his belt, gripping a push broom`

### forest-plum (Mall Santa), seed 2, style 0.25, reference alexis-grey s0

`one single character, full body, front three-quarter view, standing, winter apocalypse clothing, isolated on a pure white background, plain white background, high-key even soft lighting, no shadows, no text, no logos, mildly stylized heroic proportions, about four and a half heads tall, the head is almost a fifth of the whole height, large head, broad torso, short sturdy legs, detailed clothing and gear, not cute, painted miniature concept, a round older man in his 60s with a wild white beard and hair, tattered red Santa coat with white fur trim, black belt, red trousers, snow boots, a lumpy sack over one shoulder`
