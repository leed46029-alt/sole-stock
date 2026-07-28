/*
  APP.JS (admin panel)
  --------------------
  Handles login, the stats dashboard, and adding/editing/deleting shoes.
  Change API_BASE below once your backend is deployed
  (see backend/README-DEPLOY.md).
*/

const API_BASE = "https://sole-stock-api.your-name.workers.dev"; // <-- replace after deploying the backend
const TOKEN_KEY = "sole_stock_admin_token";

// Cloudinary (free image hosting, no card needed). Fill these in after
// creating your free Cloudinary account — see README for exact steps.
const CLOUDINARY_CLOUD_NAME = "pbbkhshn";
const CLOUDINARY_UPLOAD_PRESET = "sole-stock-unsigned.";

const loginScreen = document.getElementById("login-screen");
const appScreen = document.getElementById("app-screen");
const passwordInput = document.getElementById("password-input");
const loginBtn = document.getElementById("login-btn");
const loginError = document.getElementById("login-error");
const logoutBtn = document.getElementById("logout-btn");

const loginFormBox = document.getElementById("login-form-box");
const resetFormBox = document.getElementById("reset-form-box");
const showResetBtn = document.getElementById("show-reset-btn");
const showLoginBtn = document.getElementById("show-login-btn");
const recoveryKeyInput = document.getElementById("recovery-key-input");
const newPasswordInput = document.getElementById("new-password-input");
const resetBtn = document.getElementById("reset-btn");
const resetError = document.getElementById("reset-error");
const resetSuccess = document.getElementById("reset-success");

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
  loginError.textContent = "";
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
    loginError.textContent = "Wrong password. Try again.";
  }
}

loginBtn.addEventListener("click", login);
passwordInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") login();
});

/* ---------- Forgot password / reset ---------- */

showResetBtn.addEventListener("click", () => {
  loginFormBox.style.display = "none";
  resetFormBox.style.display = "block";
  resetError.textContent = "";
  resetSuccess.textContent = "";
});

showLoginBtn.addEventListener("click", () => {
  resetFormBox.style.display = "none";
  loginFormBox.style.display = "block";
});

resetBtn.addEventListener("click", async () => {
  resetError.textContent = "";
  resetSuccess.textContent = "";
  const recoveryKey = recoveryKeyInput.value;
  const newPassword = newPasswordInput.value;
  if (!recoveryKey || !newPassword) {
    resetError.textContent = "Please fill in both fields.";
    return;
  }
  if (newPassword.length < 6) {
    resetError.textContent = "New password must be at least 6 characters.";
    return;
  }
  resetBtn.disabled = true;
  resetBtn.textContent = "Setting password…";
  try {
    const res = await fetch(`${API_BASE}/api/admin/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recoveryKey, newPassword }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Reset failed");
    resetSuccess.textContent = "Password set! You can log in with it now.";
    recoveryKeyInput.value = "";
    newPasswordInput.value = "";
    setTimeout(() => {
      resetFormBox.style.display = "none";
      loginFormBox.style.display = "block";
    }, 1500);
  } catch (err) {
    resetError.textContent = err.message === "Wrong recovery key"
      ? "That recovery key doesn't match."
      : "Couldn't reset password. Please try again.";
  } finally {
    resetBtn.disabled = false;
    resetBtn.textContent = "Set new password";
  }
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

async function uploadToCloudinary(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData }
  );
  if (!res.ok) throw new Error("Cloudinary upload failed");
  const data = await res.json();
  return data.secure_url;
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

  saveBtn.disabled = true;
  saveBtn.textContent = "Saving…";

  try {
    let imageUrl = existingImageInput.value || "";
    if (fImage.files[0]) {
      saveBtn.textContent = "Uploading photo…";
      imageUrl = await uploadToCloudinary(fImage.files[0]);
    }

    const payload = {
      name: fName.value,
      category: fCategory.value,
      price: Number(fPrice.value) || 0,
      sizes: fSizes.value,
      sku: fSku.value,
      image: imageUrl,
    };

    const id = editIdInput.value;
    const url = id ? `${API_BASE}/api/admin/products/${id}` : `${API_BASE}/api/admin/products`;
    const method = id ? "PUT" : "POST";

    saveBtn.textContent = "Saving…";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(payload),
    });
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

/* ---------- Change password (Settings tab) ---------- */

const currentPasswordInput = document.getElementById("current-password-input");
const newPasswordSettingsInput = document.getElementById("new-password-settings-input");
const changePwBtn = document.getElementById("change-pw-btn");
const changePwError = document.getElementById("change-pw-error");
const changePwSuccess = document.getElementById("change-pw-success");

changePwBtn.addEventListener("click", async () => {
  changePwError.textContent = "";
  changePwSuccess.textContent = "";
  const currentPassword = currentPasswordInput.value;
  const newPassword = newPasswordSettingsInput.value;
  if (!currentPassword || !newPassword) {
    changePwError.textContent = "Please fill in both fields.";
    return;
  }
  if (newPassword.length < 6) {
    changePwError.textContent = "New password must be at least 6 characters.";
    return;
  }
  changePwBtn.disabled = true;
  changePwBtn.textContent = "Updating…";
  try {
    const res = await fetch(`${API_BASE}/api/admin/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (res.status === 401) {
      const data = await res.json().catch(() => ({}));
      // Distinguish "session expired" from "current password wrong":
      // a wrong current password returns 401 with an error message but
      // the token itself is still fine, so don't log the user out for that.
      if (data.error === "Current password is wrong") {
        changePwError.textContent = "Current password is wrong.";
        return;
      }
      return handleAuthError();
    }
    if (!res.ok) throw new Error("failed");
    changePwSuccess.textContent = "Password updated. You'll need it next time you log in.";
    currentPasswordInput.value = "";
    newPasswordSettingsInput.value = "";
  } catch (err) {
    changePwError.textContent = "Couldn't update password. Please try again.";
  } finally {
    changePwBtn.disabled = false;
    changePwBtn.textContent = "Update password";
  }
});

/* ---------- Service worker (PWA) ---------- */

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
