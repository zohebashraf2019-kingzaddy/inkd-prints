# INK'D Prints — website

"The Biggest Little Print Shop" · 240 Linden St, Reno NV · 775-297-5632

Static site + 3 Vercel serverless functions. No build step.

## What's in it

- **Home** (`index.html`): hero, product board, how-it-works, posted prices (from INK'D's flyers), vehicle-wrap section with both videos, about, contact form.
- **Design studio** (`design.html?p=cups|apparel|signs|paper|stickers|labels|decals`): customers upload a logo (PNG/JPG/SVG/WebP) or add text, drag / resize / rotate it on a live mockup, pick options, see the price, and add to cart.
  - White backgrounds on JPG logos are removed automatically (toggle per image).
  - 1-color cups re-ink the logo in the chosen ink color, so the preview matches what prints.
  - Stickers get a white die-cut border; holographic finish preview.
  - Decals are drawn **to real scale** on a van, pickup or car — type the size in inches and drag it into place.
  - Apparel / flyers support front + back designs.
- **Cart** (`cart.html`): pickup or shipping, need-by date, notes, then **Stripe Checkout**. If Stripe isn't connected yet, customers can send the order as a request instead (emailed to the shop).
- **Contact form**: emails `inkddesigns775@gmail.com` (via FormSubmit), with optional artwork upload.

## Deploy (GitHub → Vercel)

1. Push this folder to the `Inkd-prints` GitHub repo.
2. In Vercel: **Add New → Project → import the repo**. Framework preset: **Other**. No build command, no output directory. Deploy.
3. **Connect artwork storage**: Vercel project → **Storage → Create → Blob** → connect it to this project. This adds `BLOB_READ_WRITE_TOKEN` automatically. Customer artwork, print proofs and mockups are saved here and linked in every order.
4. **Connect Stripe**: Vercel project → **Settings → Environment Variables** → add `STRIPE_SECRET_KEY` (start with the `sk_test_...` key, test with card `4242 4242 4242 4242`, then switch to `sk_live_...`). Redeploy.
5. **Activate the email forms (one time)**: submit the contact form once on the live site. FormSubmit sends a confirmation email to inkddesigns775@gmail.com — click **Activate**. After that, every contact form and order email arrives normally.
6. Optional: `SITE_URL=https://yourdomain.com` once a custom domain is added; `STRIPE_AUTOMATIC_TAX=true` if Stripe Tax is turned on.

## Where orders show up

- **Stripe Dashboard → Payments**: each payment lists the items, options, notes, need-by date, and **links to the artwork, print proof and mockup** (in the payment's metadata). Stripe also emails the owner for each payment.
- **Email** (inkddesigns775@gmail.com): a "PAID order" summary with the same links, sent from the thank-you page.

## Prices — please confirm

All prices live in **`js/pricing.js`** (the site and the Stripe checkout both read it, so customers can't change prices).

Taken from INK'D's flyers (marked `// FLYER`): stickers, roll labels, banners, retractable banner, $0.25 one-color cups.

Starter numbers to confirm with the client (marked `// CONFIRM`):

| Item | Current setting |
| --- | --- |
| 2-color cups | $0.35 / cup |
| T-shirt / long sleeve / crewneck / hoodie | $14 / $18 / $26 / $32 |
| 2XL / 3XL upcharge | +$2 / +$3 |
| Front + back print | +$5 / piece |
| Apparel bulk savings | 12+ 10%, 24+ 15%, 48+ 20% |
| Yard sign 18"×24" with stake | $18 (10+ $14) |
| Business cards 250 / 500 / 1,000 | $35 / $50 / $75 |
| Flyers 4×6, 5×7, 8.5×11 | see `table` in `paper` |
| Double-sided paper | +25% |
| Holographic stickers | +25% |
| Vehicle decals | $9 / sq ft, $25 minimum each; reflective +35%, window perf +20% |
| Shipping | $15 flat (US) |

## Files

```
index.html  design.html  cart.html  success.html
css/styles.css
js/pricing.js     catalog + pricing (shared with the server)
js/mockups.js     canvas product mockups
js/studio.js      design studio
js/store.js       cart (localStorage + IndexedDB), uploads, email helper
js/site.js        header, contact form, videos
js/cart-page.js   cart + checkout
js/success.js     thank-you page
api/checkout.js   creates the Stripe Checkout session (re-prices on the server)
api/session.js    confirms a payment for the thank-you page
api/upload.js     saves artwork to Vercel Blob
assets/           logo, flyers, wrap videos
```

Local preview with the functions: `npm i -g vercel && vercel dev`.
