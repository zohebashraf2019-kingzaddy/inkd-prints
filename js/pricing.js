/*
 * INK'D Prints — product catalog + pricing.
 *
 * This one file is shared by the website (live price on the design page)
 * and by the Stripe checkout function (api/checkout.js), which re-computes
 * every price on the server so a customer can't change what they pay.
 *
 * Prices marked  // CONFIRM  are starter numbers that weren't on INK'D's
 * flyers. Change them here and the whole site + checkout update together.
 * Prices marked  // FLYER  come straight from INK'D's posted price sheets.
 */

export const SHOP = {
  name: "INK'D Prints",
  email: 'inkddesigns775@gmail.com',
  phone: '775-297-5632',
  phoneHref: '+17752975632',
  address: '240 Linden St, Reno, NV 89502',
  hours: 'Mon–Fri 10am–6pm',
  instagram: 'https://www.instagram.com/inkd_prints/',
};

// Fulfillment options offered at checkout (cents)
export const FULFILLMENT = {
  pickup: { label: 'Pick up at the shop — 240 Linden St, Reno', amount: 0 },
  ship: { label: 'Ship it to me (US)', amount: 1500 }, // CONFIRM flat shipping rate
};

const $ = (dollars) => Math.round(dollars * 100);

export const SHIRT_COLORS = [
  { value: 'black', label: 'Black', hex: '#141414' },
  { value: 'white', label: 'White', hex: '#f5f5f5' },
  { value: 'heather', label: 'Heather gray', hex: '#a9abad' },
  { value: 'navy', label: 'Navy', hex: '#1d2a4a' },
  { value: 'red', label: 'Red', hex: '#c4202b' },
  { value: 'forest', label: 'Forest green', hex: '#1f4a33' },
  { value: 'sand', label: 'Sand', hex: '#d9c7a3' },
  { value: 'purple', label: 'Purple', hex: '#5b2a86' },
];

export const INK_COLORS = [
  { value: 'black', label: 'Black', hex: '#111111' },
  { value: 'white', label: 'White', hex: '#ffffff' },
  { value: 'red', label: 'Red', hex: '#d7262f' },
  { value: 'purple', label: 'Purple', hex: '#6a2bbf' },
  { value: 'blue', label: 'Blue', hex: '#1f5fd6' },
  { value: 'green', label: 'Green', hex: '#1e9a4a' },
  { value: 'orange', label: 'Orange', hex: '#f26a1b' },
  { value: 'gold', label: 'Gold', hex: '#d4a017' },
];

export const APPAREL_SIZES = ['S', 'M', 'L', 'XL', '2XL', '3XL'];

/*
 * Option types the design page knows how to draw:
 *  choice   — buttons; a choice can carry `only: {otherKey: [values]}`
 *  swatch   — color dots
 *  number   — quantity box (min / step)
 *  sizes    — apparel size breakdown
 *  dims     — width × height in inches
 */
export const PRODUCTS = {
  cups: {
    id: 'cups',
    name: 'Custom printed cups',
    nav: 'Cups',
    category: 'Drinkware',
    mockup: 'cup',
    blurb: 'Your logo on hot or cold cups. Cup + lid included, 8–32 oz.',
    from: 'Sale: $0.25 / cup',
    options: [
      { key: 'style', label: 'Cup', type: 'choice', default: 'cold', choices: [
        { value: 'cold', label: 'Cold cup', note: 'Clear PET + lid' },
        { value: 'hot', label: 'Hot cup', note: 'Paper + sip lid' },
      ] },
      { key: 'size', label: 'Size', type: 'choice', default: '16', choices: [
        { value: '8', label: '8 oz', only: { style: ['hot'] } },
        { value: '12', label: '12 oz' },
        { value: '16', label: '16 oz' },
        { value: '20', label: '20 oz' },
        { value: '24', label: '24 oz', only: { style: ['cold'] } },
        { value: '32', label: '32 oz', only: { style: ['cold'] } },
      ] },
      { key: 'cupColor', label: 'Cup color', type: 'choice', default: 'white', choices: [
        { value: 'clear', label: 'Clear', only: { style: ['cold'] } },
        { value: 'white', label: 'White', only: { style: ['hot'] } },
        { value: 'kraft', label: 'Kraft brown', only: { style: ['hot'] } },
      ] },
      { key: 'colors', label: 'Print colors', type: 'choice', default: '1', choices: [
        { value: '1', label: '1 color', note: '$0.25 / cup' },
        { value: '2', label: '2 color', note: '$0.35 / cup' },
      ] },
      { key: 'ink', label: 'Ink color', type: 'swatch', default: 'black', swatches: INK_COLORS,
        hint: '1-color prints turn your logo into a single ink color — the preview shows exactly how.' },
      { key: 'qty', label: 'How many cups', type: 'number', default: 1000, min: 1000, step: 500,
        hint: '1,000 cup minimum.' },
    ],
    price(o) {
      const unit = o.colors === '2' ? 0.35 /* CONFIRM */ : 0.25; /* FLYER */
      const qty = o.qty;
      return { total: $(unit * qty), qty, unitLabel: `$${unit.toFixed(2)} / cup` };
    },
    describe(o) {
      return `${fmtInt(o.qty)} × ${o.size} oz ${o.style} cups (${o.cupColor}), ${o.colors}-color print${o.colors === '1' ? `, ${o.ink} ink` : ''}, lids included`;
    },
  },

  apparel: {
    id: 'apparel',
    name: 'Custom T-shirts & apparel',
    nav: 'Apparel',
    category: 'Apparel',
    mockup: 'shirt',
    blurb: 'Full-color DTF prints on tees, long sleeves, crewnecks and hoodies. Mix sizes freely.',
    from: 'From $14 / shirt',
    options: [
      { key: 'garment', label: 'Garment', type: 'choice', default: 'tee', choices: [
        { value: 'tee', label: 'T-shirt', note: '$14' },
        { value: 'longsleeve', label: 'Long sleeve', note: '$18' },
        { value: 'crew', label: 'Crewneck', note: '$26' },
        { value: 'hoodie', label: 'Hoodie', note: '$32' },
      ] },
      { key: 'color', label: 'Garment color', type: 'swatch', default: 'black', swatches: SHIRT_COLORS },
      { key: 'side', label: 'Print location', type: 'choice', default: 'front', choices: [
        { value: 'front', label: 'Front' },
        { value: 'back', label: 'Back' },
        { value: 'both', label: 'Front + back', note: '+$5 / shirt' },
      ] },
      { key: 'sizes', label: 'Sizes & quantities', type: 'sizes', sizes: APPAREL_SIZES,
        default: { S: 0, M: 2, L: 2, XL: 0, '2XL': 0, '3XL': 0 },
        hint: '2XL +$2, 3XL +$3. Bulk savings: 12+ save 10%, 24+ save 15%, 48+ save 20%.' },
    ],
    price(o) {
      const base = { tee: 14, longsleeve: 18, crew: 26, hoodie: 32 }[o.garment]; // CONFIRM
      const upsize = { '2XL': 2, '3XL': 3 }; // CONFIRM
      let qty = 0, sum = 0;
      for (const s of APPAREL_SIZES) {
        const n = o.sizes[s] || 0;
        qty += n;
        sum += n * (base + (upsize[s] || 0) + (o.side === 'both' ? 5 : 0));
      }
      const off = qty >= 48 ? 0.2 : qty >= 24 ? 0.15 : qty >= 12 ? 0.1 : 0; // CONFIRM
      const total = $(sum * (1 - off));
      return { total, qty, unitLabel: qty ? `${off ? `${off * 100}% bulk savings · ` : ''}$${(total / 100 / qty).toFixed(2)} avg / piece` : '' };
    },
    describe(o) {
      const sizes = APPAREL_SIZES.filter((s) => o.sizes[s]).map((s) => `${s}×${o.sizes[s]}`).join(', ');
      const g = { tee: 'T-shirts', longsleeve: 'long sleeves', crew: 'crewnecks', hoodie: 'hoodies' }[o.garment];
      return `${o.color} ${g}, print ${o.side === 'both' ? 'front + back' : o.side} — ${sizes}`;
    },
  },

  signs: {
    id: 'signs',
    name: 'Banners & yard signs',
    nav: 'Banners & signs',
    category: 'Signs & banners',
    mockup: 'sign',
    blurb: 'Hemmed & grommeted vinyl banners, retractable stands and yard signs with stakes.',
    from: 'Banners from $45',
    options: [
      { key: 'type', label: 'Size', type: 'choice', default: '3x6', choices: [
        { value: '2x4', label: "2' × 4' banner", note: '$45' },
        { value: '3x6', label: "3' × 6' banner", note: '$85' },
        { value: '4x8', label: "4' × 8' banner", note: '$120' },
        { value: '4x10', label: "4' × 10' banner", note: '$150' },
        { value: 'retract', label: 'Retractable banner', note: '$99 with stand' },
        { value: 'yard', label: 'Yard sign 18" × 24"', note: '$18 with stake' },
      ] },
      { key: 'bg', label: 'Background color', type: 'swatch', default: 'white', swatches: [
        { value: 'white', label: 'White', hex: '#ffffff' },
        { value: 'black', label: 'Black', hex: '#111111' },
        { value: 'yellow', label: 'Yellow', hex: '#ffd21f' },
        { value: 'purple', label: 'Purple', hex: '#5b2a86' },
        { value: 'red', label: 'Red', hex: '#c4202b' },
        { value: 'blue', label: 'Blue', hex: '#1d4ed8' },
      ] },
      { key: 'qty', label: 'Quantity', type: 'number', default: 1, min: 1, step: 1,
        hint: 'Full color, indoor/outdoor. Yard signs drop to $14 each at 10+.' },
    ],
    // inches (w × h) of the printed face
    dims: { '2x4': [48, 24], '3x6': [72, 36], '4x8': [96, 48], '4x10': [120, 48], retract: [33, 81], yard: [24, 18] },
    price(o) {
      const unit = { '2x4': 45, '3x6': 85, '4x8': 120, '4x10': 150, retract: 99 }[o.type] // FLYER
        ?? (o.qty >= 10 ? 14 : 18); // yard sign — CONFIRM
      return { total: $(unit * o.qty), qty: o.qty, unitLabel: `$${unit} each` };
    },
    describe(o) {
      const t = this.options[0].choices.find((c) => c.value === o.type).label;
      return `${fmtInt(o.qty)} × ${t}, ${o.bg} background, full color`;
    },
  },

  paper: {
    id: 'paper',
    name: 'Flyers & business cards',
    nav: 'Flyers & cards',
    category: 'Paper print',
    mockup: 'paper',
    blurb: 'Business cards, postcards, flyers and menus on thick stock. Menus in as little as 24 hours.',
    from: 'Cards from $35',
    options: [
      { key: 'type', label: 'Item', type: 'choice', default: 'card', choices: [
        { value: 'card', label: 'Business cards', note: '3.5" × 2"' },
        { value: 'f46', label: 'Flyer / postcard', note: '4" × 6"' },
        { value: 'f57', label: 'Flyer', note: '5" × 7"' },
        { value: 'f811', label: 'Flyer / menu', note: '8.5" × 11"' },
      ] },
      { key: 'sides', label: 'Printed sides', type: 'choice', default: '1', choices: [
        { value: '1', label: 'Front only' },
        { value: '2', label: 'Front + back', note: '+25%' },
      ] },
      { key: 'bg', label: 'Background color', type: 'swatch', default: 'white', swatches: [
        { value: 'white', label: 'White', hex: '#ffffff' },
        { value: 'black', label: 'Black', hex: '#111111' },
        { value: 'cream', label: 'Cream', hex: '#f3ead6' },
        { value: 'purple', label: 'Purple', hex: '#5b2a86' },
        { value: 'yellow', label: 'Yellow', hex: '#ffd21f' },
      ] },
      { key: 'qty', label: 'Quantity', type: 'choice', default: '250', choices: [
        { value: '100', label: '100', only: { type: ['f46', 'f57', 'f811'] } },
        { value: '250', label: '250' },
        { value: '500', label: '500' },
        { value: '1000', label: '1,000' },
      ] },
    ],
    dims: { card: [3.5, 2], f46: [6, 4], f57: [7, 5], f811: [8.5, 11] },
    table: { // CONFIRM all paper pricing
      card: { 250: 35, 500: 50, 1000: 75 },
      f46: { 100: 45, 250: 65, 500: 95, 1000: 145 },
      f57: { 100: 55, 250: 80, 500: 120, 1000: 185 },
      f811: { 100: 65, 250: 110, 500: 175, 1000: 290 },
    },
    price(o) {
      const base = this.table[o.type][o.qty];
      const total = $(base * (o.sides === '2' ? 1.25 : 1));
      return { total, qty: Number(o.qty), unitLabel: `${fmtInt(Number(o.qty))} pieces` };
    },
    describe(o) {
      const t = this.options[0].choices.find((c) => c.value === o.type);
      return `${fmtInt(Number(o.qty))} × ${t.label} ${t.note}, ${o.sides === '2' ? 'double' : 'single'}-sided, ${o.bg} background`;
    },
  },

  stickers: {
    id: 'stickers',
    name: 'Die-cut stickers',
    nav: 'Stickers',
    category: 'Stickers & labels',
    mockup: 'sticker',
    blurb: '3" die-cut, laminated, weatherproof vinyl. We cut right around your logo.',
    from: '50 for $35',
    options: [
      { key: 'finish', label: 'Finish', type: 'choice', default: 'gloss', choices: [
        { value: 'gloss', label: 'Gloss' },
        { value: 'matte', label: 'Matte' },
        { value: 'holo', label: 'Holographic', note: '+25%' },
      ] },
      { key: 'qty', label: 'Quantity', type: 'choice', default: '100', choices: [
        { value: '50', label: '50', note: '$35' },
        { value: '100', label: '100', note: '$55' },
        { value: '250', label: '250', note: '$80' },
        { value: '500', label: '500', note: '$140' },
        { value: '1000', label: '1,000', note: '$240' },
      ] },
    ],
    table: { 50: 35, 100: 55, 250: 80, 500: 140, 1000: 240 }, // FLYER
    price(o) {
      const base = this.table[o.qty];
      return { total: $(base * (o.finish === 'holo' ? 1.25 /* CONFIRM */ : 1)), qty: Number(o.qty), unitLabel: '3" die cut, laminated' };
    },
    describe(o) {
      return `${fmtInt(Number(o.qty))} × 3" die-cut stickers, ${o.finish === 'holo' ? 'holographic' : o.finish}, laminated`;
    },
  },

  labels: {
    id: 'labels',
    name: 'Roll labels',
    nav: 'Roll labels',
    category: 'Stickers & labels',
    mockup: 'label',
    blurb: '3" round labels on a roll for cups, candles, food and product packaging.',
    from: '250 for $40',
    options: [
      { key: 'finish', label: 'Finish', type: 'choice', default: 'gloss', choices: [
        { value: 'gloss', label: 'Gloss' },
        { value: 'matte', label: 'Matte' },
      ] },
      { key: 'bg', label: 'Label color', type: 'swatch', default: 'white', swatches: [
        { value: 'white', label: 'White', hex: '#ffffff' },
        { value: 'black', label: 'Black', hex: '#111111' },
        { value: 'kraft', label: 'Kraft', hex: '#c8a678' },
        { value: 'yellow', label: 'Yellow', hex: '#ffd21f' },
        { value: 'purple', label: 'Purple', hex: '#5b2a86' },
      ] },
      { key: 'qty', label: 'Quantity', type: 'choice', default: '500', choices: [
        { value: '250', label: '250', note: '$40' },
        { value: '500', label: '500', note: '$70' },
        { value: '1000', label: '1,000', note: '$120' },
        { value: '2500', label: '2,500', note: '$240' },
        { value: '5000', label: '5,000', note: '$420' },
      ] },
    ],
    table: { 250: 40, 500: 70, 1000: 120, 2500: 240, 5000: 420 }, // FLYER
    price(o) {
      return { total: $(this.table[o.qty]), qty: Number(o.qty), unitLabel: '3" round, permanent adhesive' };
    },
    describe(o) {
      return `${fmtInt(Number(o.qty))} × 3" round roll labels, ${o.finish}, ${o.bg}`;
    },
  },

  decals: {
    id: 'decals',
    name: 'Car & truck decals',
    nav: 'Vehicle decals',
    category: 'Vehicles',
    mockup: 'vehicle',
    blurb: 'Door logos, window lettering and rear-window graphics at any size. Preview it on the vehicle at real scale.',
    from: 'From $25',
    options: [
      { key: 'vehicle', label: 'Preview on', type: 'choice', default: 'van', choices: [
        { value: 'van', label: 'Work van' },
        { value: 'truck', label: 'Pickup truck' },
        { value: 'car', label: 'Car' },
      ] },
      { key: 'size', label: 'Decal size (inches)', type: 'dims', default: { w: 48, h: 24 }, min: 2, max: 120,
        hint: 'Measure the panel first — a front door is usually about 30" wide.' },
      { key: 'material', label: 'Material', type: 'choice', default: 'vinyl', choices: [
        { value: 'vinyl', label: 'Printed vinyl', note: 'Laminated' },
        { value: 'reflective', label: 'Reflective', note: '+35%' },
        { value: 'perf', label: 'Window perf', note: 'See-through, +20%' },
      ] },
      { key: 'qty', label: 'Quantity', type: 'number', default: 2, min: 1, step: 1, hint: 'Ordering a pair for both doors? Set this to 2.' },
    ],
    price(o) {
      const sqft = (o.size.w * o.size.h) / 144;
      const mult = { vinyl: 1, reflective: 1.35, perf: 1.2 }[o.material]; // CONFIRM
      const unit = Math.max(25, sqft * 9 * mult); // CONFIRM $9 / sq ft, $25 min each
      return { total: $(Math.round(unit * 100) / 100) * o.qty, qty: o.qty, unitLabel: `$${unit.toFixed(2)} each · ${sqft.toFixed(1)} sq ft` };
    },
    describe(o) {
      const m = { vinyl: 'printed vinyl', reflective: 'reflective vinyl', perf: 'window perf' }[o.material];
      return `${fmtInt(o.qty)} × ${o.size.w}" × ${o.size.h}" ${m} decal`;
    },
  },
};

export const PRODUCT_ORDER = ['cups', 'apparel', 'signs', 'paper', 'stickers', 'labels', 'decals'];

export function fmtInt(n) {
  return Number(n).toLocaleString('en-US');
}
export function money(cents) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

/** True if a choice is allowed given the other selected options */
export function choiceAllowed(choice, opts) {
  if (!choice.only) return true;
  return Object.entries(choice.only).every(([k, vals]) => vals.includes(String(opts[k])));
}

export function defaultOptions(productId) {
  const p = PRODUCTS[productId];
  const o = {};
  for (const opt of p.options) o[opt.key] = structuredClone(opt.default);
  return normalizeOptions(productId, o);
}

/** Snap dependent choices to valid values (e.g. switching cup style fixes size & color) */
export function normalizeOptions(productId, o) {
  const p = PRODUCTS[productId];
  for (const opt of p.options) {
    if (opt.type === 'choice') {
      const ok = opt.choices.filter((c) => choiceAllowed(c, o));
      if (!ok.some((c) => c.value === String(o[opt.key]))) o[opt.key] = (ok.find((c) => c.value === opt.default) || ok[0]).value;
    }
  }
  return o;
}

/**
 * Validate options coming from the browser and return a clean copy.
 * Throws an Error with a customer-readable message if something is off.
 */
export function validateOptions(productId, raw) {
  const p = PRODUCTS[productId];
  if (!p) throw new Error('Unknown product.');
  const o = {};
  for (const opt of p.options) {
    const v = raw?.[opt.key];
    switch (opt.type) {
      case 'choice': {
        if (!opt.choices.some((c) => c.value === String(v))) throw new Error(`Pick a ${opt.label.toLowerCase()}.`);
        o[opt.key] = String(v);
        break;
      }
      case 'swatch': {
        if (!opt.swatches.some((s) => s.value === v)) throw new Error(`Pick a ${opt.label.toLowerCase()}.`);
        o[opt.key] = v;
        break;
      }
      case 'number': {
        const n = Math.floor(Number(v));
        if (!Number.isFinite(n) || n < opt.min) throw new Error(`${opt.label} must be at least ${fmtInt(opt.min)}.`);
        if (n > 100000) throw new Error('For orders that large, send us a quote request.');
        o[opt.key] = n;
        break;
      }
      case 'sizes': {
        const s = {};
        let total = 0;
        for (const k of opt.sizes) {
          const n = Math.max(0, Math.floor(Number(v?.[k]) || 0));
          s[k] = Math.min(n, 5000);
          total += s[k];
        }
        if (total < 1) throw new Error('Add at least one size.');
        o[opt.key] = s;
        break;
      }
      case 'dims': {
        const w = Number(v?.w), h = Number(v?.h);
        if (!(w >= opt.min && w <= opt.max && h >= opt.min && h <= opt.max)) throw new Error(`Decal size must be between ${opt.min}" and ${opt.max}".`);
        o[opt.key] = { w: Math.round(w * 4) / 4, h: Math.round(h * 4) / 4 };
        break;
      }
    }
  }
  // dependent choices must be valid together
  for (const opt of p.options) {
    if (opt.type === 'choice') {
      const c = opt.choices.find((x) => x.value === o[opt.key]);
      if (!choiceAllowed(c, o)) throw new Error(`${c.label} isn't available with the other options you picked.`);
    }
  }
  return o;
}

/** Price a validated item → { total (cents), qty, unitLabel, description } */
export function quote(productId, options) {
  const p = PRODUCTS[productId];
  const o = validateOptions(productId, options);
  const r = p.price(o);
  return { ...r, description: p.describe(o), options: o };
}
