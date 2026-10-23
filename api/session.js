// GET /api/session?id=cs_... — confirms a finished checkout for the thank-you page.
import Stripe from 'stripe';

export default async function handler(req, res) {
  const id = String(req.query?.id || '');
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(id)) return res.status(400).json({ error: 'Missing order reference.' });
  if (!process.env.STRIPE_SECRET_KEY) return res.status(503).json({ error: 'Online payment is not connected yet.' });
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const s = await stripe.checkout.sessions.retrieve(id);
    const ship = s.shipping_details || s.collected_information?.shipping_details;
    const a = ship?.address;
    return res.status(200).json({
      payment_status: s.payment_status,
      amount_total: s.amount_total,
      email: s.customer_details?.email || '',
      name: s.customer_details?.name || '',
      phone: s.customer_details?.phone || '',
      shipping: a ? `Ship to ${ship.name || ''}, ${[a.line1, a.line2, a.city, a.state, a.postal_code].filter(Boolean).join(', ')}` : '',
      ref: s.id.slice(-8).toUpperCase(),
    });
  } catch (e) {
    console.error(e);
    return res.status(404).json({ error: 'We couldn’t find that order.' });
  }
}
