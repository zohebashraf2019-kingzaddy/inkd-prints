/*
 * Cart storage. Item details live in localStorage; the heavy files
 * (original artwork, print proofs, mockups) live in IndexedDB.
 */
import { PRODUCTS, quote } from './pricing.js';

const KEY = 'inkd-cart-v1';
const DB = 'inkd-files';

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
}
function write(items) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch (e) {
    console.warn('Cart could not be saved', e);
  }
  window.dispatchEvent(new CustomEvent('cart:change', { detail: items }));
}

function db() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('files');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function idb(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction('files', mode);
    const req = fn(tx.objectStore('files'));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
  });
}

export const cart = {
  items() {
    // re-price on every read so the cart always matches the current price list
    return read().flatMap((it) => {
      try {
        const q = quote(it.productId, it.options);
        return [{ ...it, total: q.total, description: q.description }];
      } catch {
        return [];
      }
    });
  },
  count() {
    return read().length;
  },
  subtotal() {
    return this.items().reduce((s, it) => s + it.total, 0);
  },
  async add(item, files) {
    const id = `it_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    try {
      await idb('readwrite', (s) => s.put(files, id));
    } catch (e) {
      console.warn('Artwork could not be stored locally', e);
    }
    write([...read(), { ...item, id, createdAt: Date.now() }]);
    return id;
  },
  async files(id) {
    try {
      return (await idb('readonly', (s) => s.get(id))) || [];
    } catch {
      return [];
    }
  },
  async remove(id) {
    write(read().filter((i) => i.id !== id));
    try {
      await idb('readwrite', (s) => s.delete(id));
    } catch {}
  },
  async clear() {
    const ids = read().map((i) => i.id);
    write([]);
    try {
      await idb('readwrite', (s) => {
        ids.forEach((id) => s.delete(id));
      });
    } catch {}
  },
  productName(id) {
    return PRODUCTS[id]?.name || id;
  },
};

/** Upload one blob to /api/upload. Returns a public URL, or null if storage isn't set up. */
export async function uploadBlob(blob, name) {
  const dataUrl = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
  const resp = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, data: dataUrl }),
  });
  if (!resp.ok) return null;
  const j = await resp.json().catch(() => ({}));
  return j.url || null;
}

/** Send a message to the shop inbox through FormSubmit (no server needed). */
export async function emailShop(fields) {
  const resp = await fetch('https://formsubmit.co/ajax/inkddesigns775@gmail.com', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ _template: 'table', _captcha: 'false', ...fields }),
  });
  const j = await resp.json().catch(() => ({}));
  if (!resp.ok || j.success === 'false' || j.success === false) throw new Error(j.message || 'The message could not be sent.');
  return j;
}
