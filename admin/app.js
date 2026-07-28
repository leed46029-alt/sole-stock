/*
  APP.JS (admin panel)
  --------------------
  Handles login, the stats dashboard, and adding/editing/deleting shoes.
  Change API_BASE below once your backend is deployed
  (see backend/README-DEPLOY.md).
*/

const API_BASE = "https://sole-stock-api.sole-stock.workers.dev"; // <-- replace after deploying the backend
const TOKEN_KEY = "sole_stock_admin_token";

const loginScreen = document.getElementById("login-screen");
const appScreen = document.getElementById("app-screen");
const passwordInput = document.getElementById("password-input");
const loginBtn = document.getElementById("login-btn");
const loginError = document.getElementById("login-error");
const logoutBtn = document.getElementById("logout-btn");

/* ---------- Auth ---------- */

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function authHeaders() {
  return { Authorization: `Bearer ${getToken()}` };
}

async function login() {
  loginError.style.display = "none";
  const password = passwordInput.value;
  try {
    const res = await fetch(`${API_BASE}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) throw new Error("bad login");
    const data = await res.json();
    setToken(data.token);
    showApp();
  } catch (err) {
    loginError.style.display = "block";
  }
}

loginBtn.addEventListener("click", login);
passwordInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") login();
});

logoutBtn.addEventListener("click", () => {
  clearToken();
  location.reload();
});

function showApp() {
  loginScreen.style.display = "none";
  appScreen.style.display = "block";
  loadDashboard();
  loadProducts();
}

if (getToken()) {
  showApp();
}

/* ---------- Tabs ---------- */

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`panel-${btn.dataset.panel}`).classList.add("active");
  });
});

/* ---------- Dashboard ---------- */

async function loadDashboard() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/stats`, { headers: authHeaders() });
    if (res.status === 401) return handleAuthError();
    const data = await res.json();

    const statGrid = document.getElementById("stat-grid");
    statGrid.innerHTML = `
      <div class="stat-card"><div class="n">${data.totalVisits}</div><div class="label">Total visits</div></div>
      <div class="stat-card"><div class="n">${data.totalClicks}</div><div class="label">WhatsApp clicks</div></div>
    `;

    const tbody = document.querySelector("#stats-table tbody");
    if (!data.perProduct.length) {
      tbody.innerHTML = `<tr><td colspan="2" class="empty">No products yet.</td></tr>`;
    } else {
      tbody.innerHTML = data.perProduct
        .map((p) => `<tr><td>${p.name}</td><td>${p.clicks}</td></tr>`)
        .join("");
    }
  } catch (err) {
    document.getElementById("stat-grid").innerHTML = `<p class="empty">Couldn't load stats.</p>`;
  }
}

/* ---------- Products ---------- */

const listEl = document.getElementById("product-list");
const formTitle = document.getElementById("form-title");
const editIdInput = document.getElementById("edit-id");
const existingImageInput = document.getElementById("existing-image");
const fName = document.getElementById("f-name");
const fCategory = document.getElementById("f-category");
const fPrice = document.getElementById("f-price");
const fSizes = document.getElementById("f-sizes");
const fSku = document.getElementById("f-sku");
const fImage = document.getElementById("f-image");
const saveBtn = document.getElementById("save-btn");
const cancelEditBtn = document.getElementById("cancel-edit-btn");

function handleAuthError() {
  clearToken();
  location.reload();
}

async function loadProducts() {
  listEl.innerHTML = `<p class="loading">Loading…</p>`;
  try {
    const res = await fetch(`${API_BASE}/api/admin/products`, { headers: authHeaders() });
    if (res.status === 401) return handleAuthError();
    const products = await res.json();
    renderProductList(products);
  } catch (err) {
    listEl.innerHTML = `<p class="empty">Couldn't load products.</p>`;
  }
}

function renderProductList(products) {
  if (!products.length) {
    listEl.innerHTML = `<p class="empty">No shoes yet — add your first one above.</p>`;
    return;
  }
  listEl.innerHTML = "";
  products.forEach((p) => {
    const row = document.createElement("div");
    row.className = "product-list-item";
    row.innerHTML = `
      <img src="${p.image || ''}" alt="${p.name}">
      <div class="info">
        <div class="name">${p.name}</div>
        <div class="meta">${p.category} · KES ${p.price.toLocaleString()} · sizes ${p.sizes}</div>
      </div>
      <div class="actions">
        <button class="icon-btn edit-btn">Edit</button>
        <button class="icon-btn delete delete-btn">Delete</button>
      </div>
    `;
    row.querySelector(".edit-btn").addEventListener("click", () => startEdit(p));
    row.querySelector(".delete-btn").addEventListener("click", () => deleteProduct(p.id, p.name));
    listEl.appendChild(row);
  });
}

function startEdit(product) {
  formTitle.textContent = `Editing: ${product.name}`;
  editIdInput.value = product.id;
  existingImageInput.value = product.image || "";
  fName.value = product.name;
  fCategory.value = product.category;
  fPrice.value = product.price;
  fSizes.value = product.sizes;
  fSku.value = product.sku || "";
  fImage.value = "";
  cancelEditBtn.style.display = "inline-block";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetForm() {
  formTitle.textContent = "Add a shoe";
  editIdInput.value = "";
  existingImageInput.value = "";
  fName.value = "";
  fCategory.value = "";
  fPrice.value = "";
  fSizes.value = "";
  fSku.value = "";
  fImage.value = "";
  cancelEditBtn.style.display = "none";
}

cancelEditBtn.addEventListener("click", resetForm);

saveBtn.addEventListener("click", async () => {
  if (!fName.value || !fCategory.value || !fPrice.value || !fSizes.value) {
    alert("Please fill in name, category, price, and sizes.");
    return;
  }
  const formData = new FormData();
  formData.append("name", fName.value);
  formData.append("category", fCategory.value);
  formData.append("price", fPrice.value);
  formData.append("sizes", fSizes.value);
  formData.append("sku", fSku.value);
  formData.append("existingImage", existingImageInput.value);
  if (fImage.files[0]) formData.append("image", fImage.files[0]);

  const id = editIdInput.value;
  const url = id ? `${API_BASE}/api/admin/products/${id}` : `${API_BASE}/api/admin/products`;
  const method = id ? "PUT" : "POST";

  saveBtn.disabled = true;
  saveBtn.textContent = "Saving…";
  try {
    const res = await fetch(url, { method, headers: authHeaders(), body: formData });
    if (res.status === 401) return handleAuthError();
    if (!res.ok) throw new Error("save failed");
    resetForm();
    loadProducts();
    loadDashboard();
  } catch (err) {
    alert("Couldn't save. Please check your connection and try again.");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save shoe";
  }
});

async function deleteProduct(id, name) {
  if (!confirm(`Delete "${name}"? This can't be undone.`)) return;
  try {
    const res = await fetch(`${API_BASE}/api/admin/products/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (res.status === 401) return handleAuthError();
    loadProducts();
    loadDashboard();
  } catch (err) {
    alert("Couldn't delete. Please try again.");
  }
}

/* ---------- Service worker (PWA) ---------- */

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
