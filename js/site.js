import { cart, emailShop, uploadBlob } from './store.js';

const $ = (s, el = document) => el.querySelector(s);

export function updateCartBadge() {
  const n = cart.count();
  document.querySelectorAll('[data-cart-count]').forEach((b) => {
    b.textContent = n;
    b.hidden = n === 0;
  });
}

let toastTimer;
export function toast(content, kind = 'info') {
  let t = $('#toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.setAttribute('role', 'status');
    t.setAttribute('aria-live', 'polite');
    document.body.append(t);
  }
  t.className = `toast ${kind} show`;
  t.replaceChildren(typeof content === 'string' ? document.createTextNode(content) : content);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), kind === 'error' ? 7000 : 5000);
}

/* mobile menu */
const menuBtn = $('#menu-btn');
if (menuBtn) {
  menuBtn.addEventListener('click', () => {
    const open = document.body.classList.toggle('menu-open');
    menuBtn.setAttribute('aria-expanded', String(open));
  });
  document.querySelectorAll('.site-nav a').forEach((a) => a.addEventListener('click', () => {
    document.body.classList.remove('menu-open');
    menuBtn.setAttribute('aria-expanded', 'false');
  }));
}

/* contact form */
const form = $('#contact-form');
if (form) {
  const params = new URLSearchParams(location.search);
  if (params.get('service')) form.elements.service.value = params.get('service');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const F = form.elements;
    if (F._honey.value) return;
    const status = $('#contact-status');
    const btn = form.querySelector('button[type=submit]');
    if (!form.reportValidity()) return;
    btn.disabled = true;
    status.className = 'form-status';
    status.textContent = 'Sending…';
    try {
      let artwork = 'None attached';
      const f = F.artwork.files[0];
      if (f) {
        if (f.size > 3 * 1024 * 1024) throw new Error('That file is over 3 MB. Send a smaller version, or reply to our email with the full file.');
        const url = await uploadBlob(f, f.name).catch(() => null);
        artwork = url || `${f.name} (customer will email it — online file storage isn't set up yet)`;
      }
      await emailShop({
        _subject: `Website inquiry: ${F.service.value} — ${F.name.value}`,
        _replyto: F.email.value,
        Name: F.name.value,
        Email: F.email.value,
        Phone: F.phone.value || '—',
        Business: F.business.value || '—',
        'Interested in': F.service.value,
        Quantity: F.quantity.value || '—',
        'Needed by': F.needby.value || '—',
        Message: F.message.value,
        Artwork: artwork,
      });
      form.reset();
      status.classList.add('ok');
      status.textContent = 'Thanks — your message is in. We usually reply within one business day.';
    } catch (err) {
      status.classList.add('error');
      status.textContent = `${err.message} You can also call 775-297-5632.`;
    } finally {
      btn.disabled = false;
    }
  });
}

/* videos: play only while visible, respect reduced motion */
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const vids = document.querySelectorAll('video[data-autoplay]');
if (vids.length && 'IntersectionObserver' in window && !reduce) {
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (en.isIntersecting) en.target.play().catch(() => {});
    else en.target.pause();
  }), { threshold: 0.35 });
  vids.forEach((v) => io.observe(v));
}

const year = $('#year');
if (year) year.textContent = new Date().getFullYear();

updateCartBadge();
window.addEventListener('cart:change', updateCartBadge);
window.addEventListener('storage', updateCartBadge);
