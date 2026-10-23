import { money } from './pricing.js';
import { cart, emailShop } from './store.js';

const $ = (s) => document.querySelector(s);
const id = new URLSearchParams(location.search).get('session_id');

async function main() {
  if (!id) {
    $('#ok-title').textContent = 'Nothing to show here yet';
    $('#ok-body').textContent = 'This page appears after you pay for an order.';
    return;
  }
  try {
    const r = await fetch(`/api/session?id=${encodeURIComponent(id)}`);
    const s = await r.json();
    if (!r.ok) throw new Error(s.error || 'Could not look up your order.');
    if (s.payment_status !== 'paid') {
      $('#ok-title').textContent = 'Payment not finished';
      $('#ok-body').textContent = 'Your card wasn’t charged. Your cart is still saved — head back and try again.';
      return;
    }
    $('#ok-title').textContent = `Thanks${s.name ? `, ${s.name.split(' ')[0]}` : ''} — your order is in.`;
    $('#ok-body').textContent = `We received ${money(s.amount_total)}. A receipt is on its way to ${s.email}. We’ll review your artwork and reach out if anything needs a tweak before we print.`;
    $('#ok-ref').textContent = `Order reference: ${s.ref}`;
    const flag = `inkd-mailed-${id}`;
    const pending = sessionStorage.getItem('inkd-pending');
    if (pending && !sessionStorage.getItem(flag)) {
      const p = JSON.parse(pending);
      sessionStorage.setItem(flag, '1');
      emailShop({
        _subject: `PAID order ${s.ref}: ${s.name || s.email} — ${money(s.amount_total)}`,
        _replyto: s.email,
        Customer: s.name || '—',
        Email: s.email,
        Phone: s.phone || '—',
        Paid: money(s.amount_total),
        Fulfillment: s.shipping || (p.fulfillment === 'ship' ? 'Ship' : 'Pickup at shop'),
        'Needed by': p.needBy || '—',
        'Order notes': p.orderNotes || '—',
        Items: p.text,
        'Stripe reference': s.ref,
      }).catch(() => {});
      sessionStorage.removeItem('inkd-pending');
    }
    await cart.clear();
  } catch (e) {
    $('#ok-title').textContent = 'We couldn’t confirm your order on this page';
    $('#ok-body').textContent = `${e.message} If you were charged, your order went through — call 775-297-5632 and we’ll sort it out.`;
  }
}
main();
