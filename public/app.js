/*
  APP.JS (public site)
  --------------------
  Loads shoes from the live API, renders a clean image-first grid, and opens
  a bottom-sheet modal with full shoe details when a customer taps any image.
*/

const API_BASE = "https://sole-stock-api.sole-stock.workers.dev";
const WHATSAPP_NUMBER = "254712215746"; // +254 712 215746, no + or spaces

const grid = document.getElementById("product-grid");
const tabsWrap = document.getElementById("category-tabs");
const searchInput = document.getElementById("search-input");
const resultCount = document.getElementById("result-count");
const emptyState = document.getElementById("empty-state");

// Modal elements
const modalOverlay = document.getElementById("modal-overlay");
const modalSheet = document.getElementById("modal-sheet");
const modalClose = document.getElementById("modal-close");
const modalImg = document.getElementById("modal-img");
const modalCategory = document.getElementById("modal-category");
const modalName = document.getElementById("modal-name");
const modalSizes = document.getElementById("modal-sizes");
const modalPrice = document.getElementById("modal-price");
const modalSku = document.getElementById("modal-sku");
const modalOrderBtn = document.getElementById("modal-order-btn");

let PRODUCTS = [];
let activeCategory = "All";
let searchTerm = "";

/* ---------- Image URL optimizer ---------- */

function optimizeImageUrl(url, width = 600) {
  if (!url) return url;
  if (!url.includes("res.cloudinary.com")) return url;
  if (url.includes("w_")) return url;
  return url.replace("/upload/", `/upload/w_${width},q_auto,f_auto/`);
}

/* ---------- WhatsApp link builders ---------- */

function waLink(message) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

function productWaLink(product) {
  const message =
    `Hi Lee's Soles and Tasks! I'd like to order:\n` +
    `${product.name} (${product.sku || "N/A"})\n` +
    `Category: ${product.category}\n` +
    `Price: KES ${product.price.toLocaleString()}\n` +
    `Available sizes: ${product.sizes}\n\n` +
    `Please let me know if it's in stock.`;
  return waLink(message);
}

const generalMessage = "Hi Lee's Soles and Tasks! I'd like to ask about your shoes.";
["header-whatsapp", "footer-whatsapp", "float-whatsapp"].forEach((id) => {
  const el = document.getElementById(id);
  if (el) el.href = waLink(generalMessage);
});

/* ---------- Tracking ---------- */

function trackVisit() {
  const lastVisit = localStorage.getItem("sole_stock_last_visit");
  const now = Date.now();
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000; // 24 hours in ms

  if (lastVisit && now - parseInt(lastVisit, 10) < TWENTY_FOUR_HOURS) {
    // Same browser visited within 24 hours — don't count duplicate visit
    return;
  }

  localStorage.setItem("sole_stock_last_visit", now.toString());
  fetch(`${API_BASE}/api/track/visit`, { method: "POST" }).catch(() => {});
}

function trackClick(productId) {
  fetch(`${API_BASE}/api/track/click`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId }),
  }).catch(() => {});
}

/* ---------- Modal Logic ---------- */

const galleryStrip = document.getElementById("modal-gallery-strip");

function openModal(product) {
  const images = (product.images && product.images.length > 0)
    ? product.images
    : (product.image ? [product.image] : []);

  modalImg.src = optimizeImageUrl(images[0] || "", 800);
  modalImg.alt = product.name;
  modalCategory.textContent = product.category;
  modalName.textContent = product.name;
  modalSizes.textContent = `Available Sizes: ${product.sizes}`;
  modalPrice.textContent = product.price.toLocaleString();
  modalSku.textContent = product.sku ? `SKU: ${product.sku}` : "";

  modalOrderBtn.href = productWaLink(product);

  // Set click tracker on order button
  modalOrderBtn.onclick = () => trackClick(product.id);

  // Render thumbnail gallery strip if more than 1 image
  if (galleryStrip) {
    galleryStrip.innerHTML = "";
    if (images.length > 1) {
      galleryStrip.style.display = "flex";
      images.forEach((url, i) => {
        const thumb = document.createElement("div");
        thumb.className = "gallery-thumb" + (i === 0 ? " active" : "");
        thumb.innerHTML = `<img src="${optimizeImageUrl(url, 200)}" alt="thumb ${i + 1}">`;
        thumb.addEventListener("click", () => {
          modalImg.src = optimizeImageUrl(url, 800);
          galleryStrip.querySelectorAll(".gallery-thumb").forEach((t) => t.classList.remove("active"));
          thumb.classList.add("active");
        });
        galleryStrip.appendChild(thumb);
      });
    } else {
      galleryStrip.style.display = "none";
    }
  }

  modalOverlay.classList.add("open");
  modalSheet.classList.add("open");
  document.body.classList.add("modal-open");
}

function closeModal() {
  modalOverlay.classList.remove("open");
  modalSheet.classList.remove("open");
  document.body.classList.remove("modal-open");
}

modalOverlay.addEventListener("click", closeModal);
modalClose.addEventListener("click", closeModal);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

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

/* ---------- Product card (Image + Price Badge) ---------- */

function createCard(product) {
  const card = document.createElement("article");
  card.className = "grid-card";

  const images = (product.images && product.images.length > 0)
    ? product.images
    : (product.image ? [product.image] : []);
  const coverUrl = images[0] || "";
  const imgSrc = optimizeImageUrl(coverUrl, 500);

  const countBadgeHtml = images.length > 1 ? `<div class="count-badge">📷 ${images.length}</div>` : "";

  card.innerHTML = `
    <img
      src="${imgSrc}"
      alt="${product.name}"
      width="500"
      height="500"
      loading="lazy"
      decoding="async"
    >
    ${countBadgeHtml}
    <div class="price-badge">${product.price.toLocaleString()}</div>
  `;

  // Remove shimmer class once loaded
  const img = card.querySelector("img");
  img.addEventListener("load", () => img.classList.add("loaded"));

  // Tapping card opens product details modal
  card.addEventListener("click", () => openModal(product));

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
