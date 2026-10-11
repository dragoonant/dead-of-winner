# Art prompts (Dead of Winner)

Figure concepts were made locally with SDXL (base + fp16 VAE) on the RTX 5080: 4 seeds (0-3) per figure, 832x1216, 30 steps, CFG 6.5. Prompts longer than 77 tokens are encoded in 75-token chunks and concatenated. The picked seed per figure is listed below; every candidate for a figure used the same prompt.

Style consistency: the first survivors (alexis-grey, andrew-evans, annaleigh-chan, arthur-thurston, ashley-ross, bev-russell) were generated with no style reference (style 0). The alexis-grey concept (seed 0) was then cut out onto white and used as an IP-Adapter style reference (style-only block, scale 0.25) for every later survivor and zombie. Reference scans of the original cards were used only to write our own text descriptions (age, build, clothing, colours, occupation prop); the characters are original designs inspired by the occupation. Nothing was traced, and no scan is in the repo.

Known deviation: SDXL does not hold an exact head-to-height ratio. Picks measure roughly 5 to 6 heads (the closest of four candidates); the Hunyuan stages keep what the concept shows. Sparky is a dog, so his prompt says "realistic dog proportions" instead of the head-count sentence. The background renders pale grey rather than pure white; the cutout stage removes it.

Zombie prompts add "gaunt" and grey-blue winter clothing to the same prefix.

## Shared figure prompt

Prefix (survivors and zombies): `one single character, full body, front three-quarter view, standing, winter apocalypse clothing, isolated on a pure white background, plain white background, high-key even soft lighting, no shadows, no text, no logos, mildly stylized heroic proportions, about four and a half heads tall, the head is almost a fifth of the whole height, large head, broad torso, short sturdy legs, detailed clothing and gear, not cute, painted miniature concept, `

Dog prefix (Sparky): `one single dog, full body, front three-quarter view, standing, winter apocalypse gear, plain white background, even soft lighting, no shadows, no text, no logos, realistic dog proportions, detailed fur and gear, not cute, `

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

### brian-lee (Mayor), seed 0, style 0.25, reference alexis-grey s0

`one single character, full body, front three-quarter view, standing, winter apocalypse clothing, isolated on a pure white background, plain white background, high-key even soft lighting, no shadows, no text, no logos, mildly stylized heroic proportions, about four and a half heads tall, the head is almost a fifth of the whole height, large head, broad torso, short sturdy legs, detailed clothing and gear, not cute, painted miniature concept, a lean man in his 40s with slicked dark hair, black wool peacoat with brass buttons, dark scarf, a brass mayoral medallion chain, holding a battered megaphone`

### buddy-davis (Fitness Trainer), seed 2, style 0.25, reference alexis-grey s0

`one single character, full body, front three-quarter view, standing, winter apocalypse clothing, isolated on a pure white background, plain white background, high-key even soft lighting, no shadows, no text, no logos, mildly stylized heroic proportions, about four and a half heads tall, the head is almost a fifth of the whole height, large head, broad torso, short sturdy legs, detailed clothing and gear, not cute, painted miniature concept, a muscular man in his 30s with messy blond hair, grey quilted vest over a striped long-sleeve athletic top, track trousers, trail boots, stopwatch on a cord, carrying a kettlebell`

### carla-thompson (Police Dispatcher), seed 0, style 0.25, reference alexis-grey s0

`one single character, full body, front three-quarter view, standing, winter apocalypse clothing, isolated on a pure white background, plain white background, high-key even soft lighting, no shadows, no text, no logos, mildly stylized heroic proportions, about four and a half heads tall, the head is almost a fifth of the whole height, large head, broad torso, short sturdy legs, detailed clothing and gear, not cute, painted miniature concept, a woman in her 40s with wavy shoulder-length brown hair, bright yellow raincoat over a dark sweater, radio headset around her neck, handheld radio in one hand`

### daniel-smith (Sheriff), seed 0, style 0.25, reference alexis-grey s0

`one single character, full body, front three-quarter view, standing, winter apocalypse clothing, isolated on a pure white background, plain white background, high-key even soft lighting, no shadows, no text, no logos, mildly stylized heroic proportions, about four and a half heads tall, the head is almost a fifth of the whole height, large head, broad torso, short sturdy legs, detailed clothing and gear, not cute, painted miniature concept, a broad man in his 50s with a grey beard, cream cowboy hat, tan leather jacket over a red flannel shirt, tin star badge, revolver holstered, lever-action rifle in both hands`

### david-garcia (Accountant), seed 0, style 0.25, reference alexis-grey s0

`one single character, full body, front three-quarter view, standing, winter apocalypse clothing, isolated on a pure white background, plain white background, high-key even soft lighting, no shadows, no text, no logos, mildly stylized heroic proportions, about four and a half heads tall, the head is almost a fifth of the whole height, large head, broad torso, short sturdy legs, detailed clothing and gear, not cute, painted miniature concept, a slim man in his 30s with short dark hair and stubble, long grey-green trench coat, loosened tie, leather messenger bag, ledger notebook in one hand, pencil behind his ear`

### edward-white (Chemist), seed 2, style 0.25, reference alexis-grey s0

`one single character, full body, front three-quarter view, standing, winter apocalypse clothing, isolated on a pure white background, plain white background, high-key even soft lighting, no shadows, no text, no logos, mildly stylized heroic proportions, about four and a half heads tall, the head is almost a fifth of the whole height, large head, broad torso, short sturdy legs, detailed clothing and gear, not cute, painted miniature concept, a tall man in his 40s with swept-back hair and a goatee, red and black insulated jacket, stained grey lab apron, rubber gloves, safety goggles pushed up on his forehead, holding a glass flask`

### gabriel-diaz (Fireman), seed 1, style 0.25, reference alexis-grey s0

`one single character, full body, front three-quarter view, standing, winter apocalypse clothing, isolated on a pure white background, plain white background, high-key even soft lighting, no shadows, no text, no logos, mildly stylized heroic proportions, about four and a half heads tall, the head is almost a fifth of the whole height, large head, broad torso, short sturdy legs, detailed clothing and gear, not cute, painted miniature concept, a broad-shouldered man in his 30s with dark hair, bright yellow turnout coat and trousers with reflective stripes, fire helmet tucked under one arm, fire axe in the other hand`

### gray-beard (Pirate), seed 2, style 0.25, reference alexis-grey s0

`one single character, full body, front three-quarter view, standing, winter apocalypse clothing, isolated on a pure white background, plain white background, high-key even soft lighting, no shadows, no text, no logos, mildly stylized heroic proportions, about four and a half heads tall, the head is almost a fifth of the whole height, large head, broad torso, short sturdy legs, detailed clothing and gear, not cute, painted miniature concept, a weathered man in his 60s with long grey hair and a long grey beard, eyepatch, long brown leather coat, red sash, cutlass at his belt, flintlock pistol raised in one hand`

### harman-brooks (Park Ranger), seed 0, style 0.25, reference alexis-grey s0

`one single character, full body, front three-quarter view, standing, winter apocalypse clothing, isolated on a pure white background, plain white background, high-key even soft lighting, no shadows, no text, no logos, mildly stylized heroic proportions, about four and a half heads tall, the head is almost a fifth of the whole height, large head, broad torso, short sturdy legs, detailed clothing and gear, not cute, painted miniature concept, a man in his 50s with dark skin and a moustache, olive green ranger jacket, grey trousers, yellow work gloves, flat-brimmed ranger hat, felling axe in one hand, coil of rope on the shoulder`

### james-meyers (Psychiatrist), seed 0, style 0.25, reference alexis-grey s0

`one single character, full body, front three-quarter view, standing, winter apocalypse clothing, isolated on a pure white background, plain white background, high-key even soft lighting, no shadows, no text, no logos, mildly stylized heroic proportions, about four and a half heads tall, the head is almost a fifth of the whole height, large head, broad torso, short sturdy legs, detailed clothing and gear, not cute, painted miniature concept, a heavyset man in his 50s with receding dark hair and glasses, mustard fur-collared parka, grey trousers, leather notebook and pen in his hands, calm knowing expression`

### janet-taylor (Nurse), seed 0, style 0.25, reference alexis-grey s0

`one single character, full body, front three-quarter view, standing, winter apocalypse clothing, isolated on a pure white background, plain white background, high-key even soft lighting, no shadows, no text, no logos, mildly stylized heroic proportions, about four and a half heads tall, the head is almost a fifth of the whole height, large head, broad torso, short sturdy legs, detailed clothing and gear, not cute, painted miniature concept, a woman in her 30s with long copper-red hair, olive parka with a fur-trimmed hood over teal scrubs, stethoscope around her neck, white medical bag with a plain red cross`

### jenny-clark (Waitress), seed 2, style 0.25, reference alexis-grey s0

`one single character, full body, front three-quarter view, standing, winter apocalypse clothing, isolated on a pure white background, plain white background, high-key even soft lighting, no shadows, no text, no logos, mildly stylized heroic proportions, about four and a half heads tall, the head is almost a fifth of the whole height, large head, broad torso, short sturdy legs, detailed clothing and gear, not cute, painted miniature concept, a woman in her 40s with curly blonde hair under a grey knit beanie, beige double-breasted peacoat, red skirt, grey gloves, serving tray in one hand, kitchen knife in the other`

### john-price (Student), seed 2, style 0.25, reference alexis-grey s0

`one single character, full body, front three-quarter view, standing, winter apocalypse clothing, isolated on a pure white background, plain white background, high-key even soft lighting, no shadows, no text, no logos, mildly stylized heroic proportions, about four and a half heads tall, the head is almost a fifth of the whole height, large head, broad torso, short sturdy legs, detailed clothing and gear, not cute, painted miniature concept, a lean young man in his early 20s with dark hair, black hooded jacket over a red hoodie, fingerless gloves, heavy backpack stuffed with textbooks, camping knife in one hand`

### loretta-clay (Cook), seed 2, style 0.25, reference alexis-grey s0

`one single character, full body, front three-quarter view, standing, winter apocalypse clothing, isolated on a pure white background, plain white background, high-key even soft lighting, no shadows, no text, no logos, mildly stylized heroic proportions, about four and a half heads tall, the head is almost a fifth of the whole height, large head, broad torso, short sturdy legs, detailed clothing and gear, not cute, painted miniature concept, a woman in her 60s with a short silver bob, black quilted puffer coat, grey scarf, red dress and stained apron, holding a big steel stock pot and a wooden ladle`

### maria-lopez (Teacher), seed 1, style 0.25, reference alexis-grey s0

`one single character, full body, front three-quarter view, standing, winter apocalypse clothing, isolated on a pure white background, plain white background, high-key even soft lighting, no shadows, no text, no logos, mildly stylized heroic proportions, about four and a half heads tall, the head is almost a fifth of the whole height, large head, broad torso, short sturdy legs, detailed clothing and gear, not cute, painted miniature concept, a woman in her 30s with long wavy dark brown hair, burgundy knitted coat, dark leggings, scuffed boots, holding a stack of books and a wooden yardstick`

### mike-cho (Ninja), seed 0, style 0.25, reference alexis-grey s0

`one single character, full body, front three-quarter view, standing, winter apocalypse clothing, isolated on a pure white background, plain white background, high-key even soft lighting, no shadows, no text, no logos, mildly stylized heroic proportions, about four and a half heads tall, the head is almost a fifth of the whole height, large head, broad torso, short sturdy legs, detailed clothing and gear, not cute, painted miniature concept, a lean man in his 20s in an all-black hooded jacket and trousers, black face wrap leaving only the eyes visible, fingerless gloves, chain on his belt, short straight sword in one hand`

### olivia-brown (Doctor), seed 1, style 0.25, reference alexis-grey s0

`one single character, full body, front three-quarter view, standing, winter apocalypse clothing, isolated on a pure white background, plain white background, high-key even soft lighting, no shadows, no text, no logos, mildly stylized heroic proportions, about four and a half heads tall, the head is almost a fifth of the whole height, large head, broad torso, short sturdy legs, detailed clothing and gear, not cute, painted miniature concept, a woman in her 40s with long red hair and rectangular glasses, long grey wool coat over a white coat, holding a medicine bottle, leather doctor's bag`

### rod-miller (Truck Driver), seed 0, style 0.25, reference alexis-grey s0

`one single character, full body, front three-quarter view, standing, winter apocalypse clothing, isolated on a pure white background, plain white background, high-key even soft lighting, no shadows, no text, no logos, mildly stylized heroic proportions, about four and a half heads tall, the head is almost a fifth of the whole height, large head, broad torso, short sturdy legs, detailed clothing and gear, not cute, painted miniature concept, a big man in his 50s with a grey beard, fur trapper hat with ear flaps, olive green jacket under a hi-vis orange vest, jeans, steel thermos on his belt, heavy tire iron in one hand`

### sophie-robinson (Pilot), seed 2, style 0.25, reference alexis-grey s0

`one single character, full body, front three-quarter view, standing, winter apocalypse clothing, isolated on a pure white background, plain white background, high-key even soft lighting, no shadows, no text, no logos, mildly stylized heroic proportions, about four and a half heads tall, the head is almost a fifth of the whole height, large head, broad torso, short sturdy legs, detailed clothing and gear, not cute, painted miniature concept, a young woman in her late 20s with a blond ponytail, brown leather bomber jacket with a patch, olive flight coveralls, aviator goggles on her forehead, rolled map under one arm`

### sparky (Stunt Dog), seed 0, style 0.25, reference alexis-grey s0

`one single dog, full body, front three-quarter view, standing, winter apocalypse gear, plain white background, even soft lighting, no shadows, no text, no logos, realistic dog proportions, detailed fur and gear, not cute, a golden retriever stunt dog, a small red cape tied at the neck, studded collar, little snow boots, alert and confident, realistic dog proportions with detailed fur`

### talia-jones (Fortune Teller), seed 0, style 0.25, reference alexis-grey s0

`one single character, full body, front three-quarter view, standing, winter apocalypse clothing, isolated on a pure white background, plain white background, high-key even soft lighting, no shadows, no text, no logos, mildly stylized heroic proportions, about four and a half heads tall, the head is almost a fifth of the whole height, large head, broad torso, short sturdy legs, detailed clothing and gear, not cute, painted miniature concept, a woman in her 30s with dark skin and long locs, deep crimson hooded coat, brass bangles and rings, layered patterned skirts, holding a fan of tarot-style cards`

### thomas-heart (Soldier), seed 1, style 0.25, reference alexis-grey s0

`one single character, full body, front three-quarter view, standing, winter apocalypse clothing, isolated on a pure white background, plain white background, high-key even soft lighting, no shadows, no text, no logos, mildly stylized heroic proportions, about four and a half heads tall, the head is almost a fifth of the whole height, large head, broad torso, short sturdy legs, detailed clothing and gear, not cute, painted miniature concept, a man in his 30s with brown skin, charcoal knit beanie, camouflage field jacket and trousers, black combat boots, rucksack, pistol in one hand`

### zombie-shambler (Zombie), seed 0, style 0.25, reference alexis-grey s0

`one single character, full body, front three-quarter view, standing, winter apocalypse clothing, isolated on a pure white background, plain white background, high-key even soft lighting, no shadows, no text, no logos, mildly stylized heroic proportions, about four and a half heads tall, the head is almost a fifth of the whole height, large head, broad torso, short sturdy legs, detailed clothing and gear, not cute, painted miniature concept, a gaunt shambling zombie in a torn grey-blue winter coat and scarf, grey-blue skin, hollow eyes, slack jaw, one arm reaching forward, frost on the shoulders`

### zombie-bloated (Zombie), seed 3, style 0.25, reference alexis-grey s0

`one single character, full body, front three-quarter view, standing, winter apocalypse clothing, isolated on a pure white background, plain white background, high-key even soft lighting, no shadows, no text, no logos, mildly stylized heroic proportions, about four and a half heads tall, the head is almost a fifth of the whole height, large head, broad torso, short sturdy legs, detailed clothing and gear, not cute, painted miniature concept, a bloated gaunt-faced zombie in a stretched grey-blue puffer coat, swollen sagging belly, wide slumped posture, grey-blue skin, hanging arms`

### zombie-frozen (Zombie), seed 0, style 0.25, reference alexis-grey s0

`one single character, full body, front three-quarter view, standing, winter apocalypse clothing, isolated on a pure white background, plain white background, high-key even soft lighting, no shadows, no text, no logos, mildly stylized heroic proportions, about four and a half heads tall, the head is almost a fifth of the whole height, large head, broad torso, short sturdy legs, detailed clothing and gear, not cute, painted miniature concept, a stiff frozen zombie in a grey-blue winter coat rimed with ice, icicles hanging from the arms and jaw, pale blue frosted skin, rigid upright pose, one arm forward`
