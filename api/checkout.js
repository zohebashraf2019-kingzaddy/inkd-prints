// POST /api/checkout — re-prices the cart on the server and opens a Stripe Checkout page.
import Stripe from 'stripe';
import { PRODUCTS, FULFILLMENT, SHOP, quote, money } from '../js/pricing.js';

const ART_HOST = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i;
const clip = (s, n) => (String(s || '').length > n ? `${String(s).slice(0, n - 1)}…` : String(s || ''));

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Use POST.' });
  }
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return res.status(503).json({ code: 'not_configured', error: 'Online payment is not connected yet.' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const items = Array.isArray(body?.items) ? body.items : [];
  if (!items.length) return res.status(400).json({ error: 'Your cart is empty.' });
  if (items.length > 20) return res.status(400).json({ error: 'That’s a big order — send it as a quote request so we can price it for you.' });
  const fulfillment = FULFILLMENT[body.fulfillment] ? body.fulfillment : 'pickup';

  const lineItems = [];
  const metadata = {
    fulfillment,
    need_by: clip(body.needBy, 40) || 'not specified',
    order_notes: clip(body.orderNotes, 480) || '—',
  };
  try {
    items.forEach((it, i) => {
      const q = quote(it.productId, it.options); // throws on bad input
      const files = (Array.isArray(it.files) ? it.files : []).filter((f) => ART_HOST.test(f?.url || '')).slice(0, 6);
      const mockup = files.find((f) => /^Mockup/.test(f.label));
      const note = clip(it.notes, 200);
      const texts = (Array.isArray(it.texts) ? it.texts : []).map((t) => clip(t, 80)).join('; ');
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: q.total,
          product_data: {
            name: PRODUCTS[it.productId].name,
            description: clip(`${q.description}${note ? ` — Note: ${note}` : ''}`, 480),
            ...(mockup ? { images: [mockup.url] } : {}),
          },
        },
      });
      metadata[`item_${i + 1}`] = clip(`${q.description} | ${money(q.total)}${texts ? ` | Text: ${texts}` : ''}${note ? ` | Note: ${note}` : ''}`, 500);
      if (files.length) metadata[`item_${i + 1}_art`] = clip(files.map((f) => f.url).join(' '), 500);
    });
  } catch (e) {
    return res.status(400).json({ error: e.message || 'Something in your cart isn’t valid.' });
  }

  const origin = process.env.SITE_URL?.replace(/\/$/, '') || `https://${req.headers['x-forwarded-host'] || req.headers.host}`;
  const f = FULFILLMENT[fulfillment];
  const stripe = new Stripe(key);
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      metadata,
      payment_intent_data: { metadata, description: `INK'D Prints web order (${lineItems.length} item${lineItems.length > 1 ? 's' : ''})` },
      customer_creation: 'always',
      phone_number_collection: { enabled: true },
      billing_address_collection: 'auto',
      ...(fulfillment === 'ship' ? { shipping_address_collection: { allowed_countries: ['US'] } } : {}),
      shipping_options: [{
        shipping_rate_data: {
          type: 'fixed_amount',
          display_name: fulfillment === 'ship' ? 'Shipping (US)' : `Pickup — ${SHOP.address}`,
          fixed_amount: { amount: f.amount, currency: 'usd' },
        },
      }],
      ...(process.env.STRIPE_AUTOMATIC_TAX === 'true' ? { automatic_tax: { enabled: true } } : {}),
      custom_text: {
        submit: { message: 'We check every design before it prints and will contact you if anything needs a tweak.' },
      },
      success_url: `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cart.html`,
    });
    return res.status(200).json({ url: session.url });
  } catch (e) {
    console.error('Stripe error', e);
    return res.status(502).json({ error: 'The payment page could not be opened.' });
  }
}
