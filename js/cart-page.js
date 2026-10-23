import { FULFILLMENT, money, PRODUCTS } from './pricing.js';
import { cart, uploadBlob, emailShop } from './store.js';
import { toast } from './site.js';

const $ = (s, el = document) => el.querySelector(s);

function fulfillment() {
  return $('input[name=fulfillment]:checked')?.value || 'pickup';
}

function render() {
  const items = cart.items();
  const list = $('#cart-items');
  $('#cart-empty').hidden = items.length > 0;
  $('#cart-main').hidden = items.length === 0;
  list.replaceChildren(...items.map((it) => {
    const li = document.createElement('li');
    li.className = 'cart-item';
    li.innerHTML = `
      <img src="${it.thumb || '/assets/img/inkd-logo.jpg'}" alt="" width="120" height="120">
      <div class="ci-body">
        <h3></h3>
        <p class="ci-desc"></p>
        ${it.notes ? '<p class="ci-notes"></p>' : ''}
        <div class="ci-actions">
          <a class="link-btn" href="/design.html?p=${it.productId}">Design another</a>
          <button type="button" class="link-btn danger">Remove</button>
        </div>
      </div>
      <p class="ci-price">${money(it.total)}</p>`;
    li.querySelector('h3').textContent = PRODUCTS[it.productId].name;
    li.querySelector('.ci-desc').textContent = it.description;
    if (it.notes) li.querySelector('.ci-notes').textContent = `Note: ${it.notes}`;
    li.querySelector('.danger').addEventListener('click', async () => { await cart.remove(it.id); render(); });
    return li;
  }));
  const sub = cart.subtotal();
  const ship = FULFILLMENT[fulfillment()].amount;
  $('#sum-sub').textContent = money(sub);
  $('#sum-ship').textContent = ship ? money(ship) : 'Free';
  $('#sum-total').textContent = money(sub + ship);
  $('#ship-price').textContent = money(FULFILLMENT.ship.amount);
}

async function uploadArtwork(items, status) {
  const out = [];
  let stored = true;
  for (const [i, it] of items.entries()) {
    status(`Uploading artwork ${i + 1} of ${items.length}…`);
    const files = await cart.files(it.id);
    const links = [];
    for (const f of files) {
      const url = await uploadBlob(f.blob, `${it.id}-${f.name}`).catch(() => null);
      if (url) links.push({ label: f.label, url });
      else stored = false;
    }
    out.push({
      productId: it.productId, options: it.options, notes: it.notes, texts: it.texts, placement: it.placement,
      description: it.description, total: it.total, files: links,
    });
  }
  return { orderItems: out, stored };
}

function orderText(orderItems) {
  return orderItems.map((it, i) => [
    `#${i + 1} ${PRODUCTS[it.productId].name} — ${money(it.total)}`,
    `   ${it.description}`,
    it.texts?.length ? `   Text: ${it.texts.join('; ')}` : '',
    it.placement ? `   Placement on vehicle (inches from front, height): ${it.placement.map((n) => Math.round(n)).join(', ')}` : '',
    it.notes ? `   Customer note: ${it.notes}` : '',
    ...it.files.map((f) => `   ${f.label}: ${f.url}`),
  ].filter(Boolean).join('\n')).join('\n\n');
}

async function checkout() {
  const btn = $('#pay-btn');
  const status = $('#pay-status');
  const set = (t, cls = '') => { status.className = `form-status ${cls}`; status.textContent = t; };
  btn.disabled = true;
  try {
    const items = cart.items();
    if (!items.length) return;
    const { orderItems, stored } = await uploadArtwork(items, set);
    set('Opening secure checkout…');
    const resp = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: orderItems,
        fulfillment: fulfillment(),
        needBy: $('#need-by').value,
        orderNotes: $('#order-notes').value.trim(),
      }),
    });
    const j = await resp.json().catch(() => ({}));
    if (!resp.ok || !j.url) {
      const e = new Error(j.error || 'Checkout could not start.');
      e.code = j.code;
      throw e;
    }
    sessionStorage.setItem('inkd-pending', JSON.stringify({
      text: orderText(orderItems), stored, fulfillment: fulfillment(), needBy: $('#need-by').value, orderNotes: $('#order-notes').value.trim(),
    }));
    location.href = j.url;
  } catch (e) {
    if (e.code === 'not_configured') {
      set('Online card payment is still being set up. Send your order below and we’ll confirm the details and take payment.', 'error');
      $('#request').open = true;
      $('#request').scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      set(`${e.message} Try again, or send your order as a request below.`, 'error');
    }
    btn.disabled = false;
  }
}

async function sendRequest(e) {
  e.preventDefault();
  const form = e.target;
  if (!form.reportValidity()) return;
  const btn = form.querySelector('button[type=submit]');
  const status = $('#request-status');
  const set = (t, cls = '') => { status.className = `form-status ${cls}`; status.textContent = t; };
  btn.disabled = true;
  try {
    const items = cart.items();
    const { orderItems, stored } = await uploadArtwork(items, set);
    set('Sending your order…');
    const f = FULFILLMENT[fulfillment()];
    await emailShop({
      _subject: `Order request (pay later): ${form.rname.value} — ${money(cart.subtotal() + f.amount)}`,
      _replyto: form.remail.value,
      Name: form.rname.value,
      Email: form.remail.value,
      Phone: form.rphone.value,
      Fulfillment: f.label,
      'Needed by': $('#need-by').value || '—',
      'Order notes': $('#order-notes').value.trim() || '—',
      Total: money(cart.subtotal() + f.amount),
      Items: orderText(orderItems),
      Artwork: stored ? 'Linked above' : 'Online file storage is not set up — ask the customer to email their artwork.',
    });
    await cart.clear();
    render();
    $('#cart-empty').querySelector('h2').textContent = 'Order sent — we’ll be in touch.';
    $('#cart-empty').querySelector('p').textContent = `We got your order and will call or email ${form.remail.value} to confirm the proof and payment.`;
    toast('Order sent to INK’D Prints.', 'ok');
  } catch (err) {
    set(`${err.message} You can also call 775-297-5632.`, 'error');
    btn.disabled = false;
  }
}

document.querySelectorAll('input[name=fulfillment]').forEach((r) => r.addEventListener('change', render));
$('#pay-btn').addEventListener('click', checkout);
$('#request-form').addEventListener('submit', sendRequest);
const today = new Date();
$('#need-by').min = today.toISOString().slice(0, 10);
window.addEventListener('cart:change', render);
render();
