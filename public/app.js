/*
  APP.JS (public site)
  --------------------
  Loads shoes from the live API instead of a fixed file, so anything you
  add in the admin panel shows up here automatically. Also reports page
  visits and WhatsApp button clicks so they show up in your admin stats.
*/

const API_BASE = "https://sole-stock-api.sole-stock.workers.dev";
const WHATSAPP_NUMBER = "254712215746"; // +254 712 215746, no + or spaces

const grid = document.getElementById("product-grid");
const tabsWrap = document.getElementById("category-tabs");
const searchInput = document.getElementById("search-input");
const resultCount = document.getElementById("result-count");
const emptyState = document.getElementById("empty-state");

let PRODUCTS = [];
let activeCategory = "All";
let searchTerm = "";

/* ---------- Image URL optimizer ---------- */

/**
 * If the URL is a Cloudinary URL, append transform params so Cloudinary
 * serves a smaller, faster WebP/AVIF image (600px wide, auto quality,
 * auto format). Non-Cloudinary URLs are returned unchanged.
 */
function optimizeImageUrl(url) {
  if (!url) return url;
  if (!url.includes("res.cloudinary.com")) return url;
  // Avoid double-appending if params already present
  if (url.includes("w_600")) return url;
  // Insert transform after /upload/
  return url.replace("/upload/", "/upload/w_600,q_auto,f_auto/");
}

/* ---------- WhatsApp link builders ---------- */

function waLink(message) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

function productWaLink(product) {
  const message =
    `Hi Sole Stock! I'd like to order:\n` +
    `${product.name} (${product.sku})\n` +
    `Category: ${product.category}\n` +
    `Price: KES ${product.price.toLocaleString()}\n` +
    `Available sizes: ${product.sizes}\n\n` +
    `Please let me know if it's in stock.`;
  return waLink(message);
}

const generalMessage = "Hi Sole Stock! I'd like to ask about your shoes.";
["header-whatsapp", "footer-whatsapp", "float-whatsapp"].forEach((id) => {
  const el = document.getElementById(id);
  if (el) el.href = waLink(generalMessage);
});

/* ---------- Tracking ---------- */

function trackVisit() {
  fetch(`${API_BASE}/api/track/visit`, { method: "POST" }).catch(() => {});
}

function trackClick(productId) {
  fetch(`${API_BASE}/api/track/click`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId }),
  }).catch(() => {});
}

/* ---------- Category tabs ---------- */

function getCategories() {
  const set = new Set(PRODUCTS.map((p) => p.category));
  return ["All", ...Array.from(set)];
}

function renderTabs() {
  tabsWrap.innerHTML = "";
  getCategories().forEach((cat) => {
    const btn = document.createElement("button");
    btn.className = "tab" + (cat === activeCategory ? " active" : "");
    btn.textContent = cat;
    btn.addEventListener("click", () => {
      activeCategory = cat;
      renderTabs();
      renderGrid();
    });
    tabsWrap.appendChild(btn);
  });
}

/* ---------- Product card ---------- */

function createCard(product) {
  const card = document.createElement("article");
  card.className = "tag-card";

  const imgSrc = optimizeImageUrl(product.image);

  card.innerHTML = `
    <div class="tag-image-wrap">
      <img
        src="${imgSrc}"
        alt="${product.name}"
        width="600"
        height="600"
        loading="lazy"
        decoding="async"
      >
    </div>
    <div class="tag-body">
      <p class="tag-cat-label">${product.category}</p>
      <h3 class="tag-name">${product.name}</h3>
      <p class="tag-meta">Sizes: ${product.sizes}</p>
      <div class="tag-price-row">
        <span class="tag-price">${product.price.toLocaleString()}</span>
        <span class="tag-sku">${product.sku || ""}</span>
      </div>
      <a class="order-btn" href="${productWaLink(product)}" target="_blank" rel="noopener">
        Order Now
      </a>
    </div>
  `;

  // Remove shimmer once image loads
  const img = card.querySelector("img");
  img.addEventListener("load", () => img.classList.add("loaded"));

  card.querySelector(".order-btn").addEventListener("click", () => {
    trackClick(product.id);
  });

  return card;
}

/* ---------- Filtering + render ---------- */

function matchesFilters(product) {
  const inCategory = activeCategory === "All" || product.category === activeCategory;
  const term = searchTerm.trim().toLowerCase();
  const inSearch =
    term === "" ||
    product.name.toLowerCase().includes(term) ||
    product.category.toLowerCase().includes(term) ||
    product.sizes.toLowerCase().includes(term) ||
    (product.sku || "").toLowerCase().includes(term);
  return inCategory && inSearch;
}

function renderGrid() {
  const filtered = PRODUCTS.filter(matchesFilters);

  grid.innerHTML = "";
  filtered.forEach((product) => grid.appendChild(createCard(product)));

  resultCount.textContent = `${filtered.length} pair${filtered.length === 1 ? "" : "s"} shown`;
  emptyState.style.display = filtered.length === 0 ? "block" : "none";
}

searchInput.addEventListener("input", (e) => {
  searchTerm = e.target.value;
  renderGrid();
});

/* ---------- Load products from the API ---------- */

async function loadProducts() {
  resultCount.textContent = "Loading shoes…";
  try {
    const res = await fetch(`${API_BASE}/api/products`);
    if (!res.ok) throw new Error("Request failed");
    PRODUCTS = await res.json();
  } catch (err) {
    resultCount.textContent = "Couldn't load the catalog right now — please refresh.";
    return;
  }
  renderTabs();
  renderGrid();
}

/* ---------- Init ---------- */

trackVisit();
loadProducts();
