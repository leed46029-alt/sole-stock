/*
  APP.JS (admin panel)
  --------------------
  Handles the stats dashboard, and adding/editing/deleting shoes.
*/

const API_BASE = "https://sole-stock-api.sole-stock.workers.dev";

// Cloudinary (free image hosting, no card needed).
const CLOUDINARY_CLOUD_NAME = "pbbkhshn";
const CLOUDINARY_UPLOAD_PRESET = "sole-stock-unsigned";

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
    const res = await fetch(`${API_BASE}/api/admin/stats`);
    const data = await res.json();

    const visitsToday = data.todayVisits !== undefined ? data.todayVisits : (data.totalVisits || 0);
    const clicksToday = data.todayClicks !== undefined ? data.todayClicks : (data.totalClicks || 0);

    const statGrid = document.getElementById("stat-grid");
    if (statGrid) {
      statGrid.innerHTML = `
        <div class="stat-card"><div class="n">${visitsToday}</div><div class="label">Today's visits</div></div>
        <div class="stat-card"><div class="n">${clicksToday}</div><div class="label">Today's WhatsApp clicks</div></div>
      `;
    }

    const tbody = document.querySelector("#stats-table tbody");
    if (tbody) {
      if (!data.perProduct.length) {
        tbody.innerHTML = `<tr><td colspan="2" class="empty">No products yet.</td></tr>`;
      } else {
        tbody.innerHTML = data.perProduct
          .map((p) => `<tr><td>${p.name}</td><td>${p.clicks}</td></tr>`)
          .join("");
      }
    }
  } catch (err) {
    const statGrid = document.getElementById("stat-grid");
    if (statGrid) statGrid.innerHTML = `<p class="empty">Couldn't load stats.</p>`;
  }
}

// Auto-refresh stats every 30 seconds (resets to 0 at 12:00 AM midnight)
setInterval(loadDashboard, 30000);

/* ---------- Products ---------- */

const listEl = document.getElementById("product-list");
const formTitle = document.getElementById("form-title");
const editIdInput = document.getElementById("edit-id");
const existingImageInput = document.getElementById("existing-image");
const fName = document.getElementById("f-name");
const fCategory = document.getElementById("f-category");
const fPrice = document.getElementById("f-price");
const fSizes = document.getElementById("f-sizes");
const fImage = document.getElementById("f-image");
const previewContainer = document.getElementById("image-preview-container");
const saveBtn = document.getElementById("save-btn");
const cancelEditBtn = document.getElementById("cancel-edit-btn");

let previewImages = []; // Array of { type: 'existing' | 'file', url: string, file?: File }

function renderImagePreviews() {
  if (!previewContainer) return;
  previewContainer.innerHTML = "";
  if (previewImages.length === 0) {
    previewContainer.style.display = "none";
    return;
  }
  previewContainer.style.display = "flex";

  previewImages.forEach((item, index) => {
    const thumb = document.createElement("div");
    thumb.className = "preview-thumb" + (index === 0 ? " is-cover" : "");
    thumb.innerHTML = `
      <img src="${item.url}" alt="preview">
      ${index === 0 ? '<span class="cover-badge">Main</span>' : ''}
      <div class="thumb-actions">
        ${index > 0 ? '<button class="thumb-btn make-cover" type="button" title="Set as Cover">★ Cover</button>' : ''}
        <button class="thumb-btn delete-thumb" type="button" title="Remove photo">✕</button>
      </div>
    `;

    const makeCoverBtn = thumb.querySelector(".make-cover");
    if (makeCoverBtn) {
      makeCoverBtn.addEventListener("click", (e) => {
        e.preventDefault();
        const selected = previewImages.splice(index, 1)[0];
        previewImages.unshift(selected);
        renderImagePreviews();
      });
    }

    const deleteBtn = thumb.querySelector(".delete-thumb");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", (e) => {
        e.preventDefault();
        const removed = previewImages.splice(index, 1)[0];
        if (removed && removed.type === "file" && removed.url) {
          URL.revokeObjectURL(removed.url);
        }
        renderImagePreviews();
      });
    }

    previewContainer.appendChild(thumb);
  });
}

if (fImage) {
  fImage.addEventListener("change", (e) => {
    const files = Array.from(e.target.files);
    files.forEach((file) => {
      previewImages.push({
        type: "file",
        file: file,
        url: URL.createObjectURL(file),
      });
    });
    fImage.value = ""; // Reset input so same file can be re-selected if needed
    renderImagePreviews();
  });
}

async function loadProducts() {
  listEl.innerHTML = `<p class="loading">Loading…</p>`;
  try {
    const res = await fetch(`${API_BASE}/api/admin/products`);
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
  fImage.value = "";

  previewImages = [];
  const imgs = product.images || (product.image ? [product.image] : []);
  imgs.forEach((url) => {
    if (url) previewImages.push({ type: "existing", url });
  });
  renderImagePreviews();

  cancelEditBtn.style.display = "inline-block";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function uploadToCloudinary(file) {
  const formData = new FormData();
  formData.append("file", file);
  // Always strip any accidental trailing punctuation from the preset name
  const preset = CLOUDINARY_UPLOAD_PRESET.replace(/[.\s]+$/, "");
  formData.append("upload_preset", preset);
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData }
  );
  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    const msg = errJson.error?.message || "Cloudinary upload failed";
    throw new Error(msg);
  }
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
  fImage.value = "";
  previewImages.forEach((item) => {
    if (item.type === "file" && item.url) {
      URL.revokeObjectURL(item.url);
    }
  });
  previewImages = [];
  renderImagePreviews();
  cancelEditBtn.style.display = "none";
}

cancelEditBtn.addEventListener("click", resetForm);

saveBtn.addEventListener("click", async () => {
  if (!fName.value || !fCategory.value || !fPrice.value || !fSizes.value) {
    alert("Please fill in name, category, price, and sizes.");
    return;
  }

  if (previewImages.length === 0) {
    alert("Please select at least one photo for the shoe.");
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = "Saving…";

  try {
    const finalUrls = [];
    for (let i = 0; i < previewImages.length; i++) {
      const item = previewImages[i];
      if (item.type === "existing") {
        finalUrls.push(item.url);
      } else if (item.type === "file") {
        saveBtn.textContent = `Uploading photo ${i + 1} of ${previewImages.length}…`;
        const uploadedUrl = await uploadToCloudinary(item.file);
        finalUrls.push(uploadedUrl);
      }
    }

    const payload = {
      name: fName.value,
      category: fCategory.value,
      price: Number(fPrice.value) || 0,
      sizes: fSizes.value,
      sku: "",
      images: finalUrls,
      image: finalUrls[0] || "",
    };

    const id = editIdInput.value;
    const url = id ? `${API_BASE}/api/admin/products/${id}` : `${API_BASE}/api/admin/products`;
    const method = id ? "PUT" : "POST";

    saveBtn.textContent = "Saving…";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("save failed");

    const savedName = payload.name;
    const wasEdit = !!id;

    resetForm();
    loadProducts();
    loadDashboard();
    showPostSavePrompt(savedName, wasEdit);
  } catch (err) {
    alert("Couldn't save: " + (err.message || "Please check your connection and try again."));
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
    });
    if (!res.ok) throw new Error("delete failed");
    loadProducts();
    loadDashboard();
  } catch (err) {
    alert("Couldn't delete. Please try again.");
  }
}

/* ---------- Post-Save Prompt Modal ---------- */
const postSaveBackdrop  = document.getElementById("post-save-backdrop");
const postSaveTitle     = document.getElementById("post-save-title");
const postSaveSubtitle  = document.getElementById("post-save-subtitle");
const btnViewStorefront = document.getElementById("btn-view-storefront");
const btnStayAdmin      = document.getElementById("btn-stay-admin");

function showPostSavePrompt(shoeName, isEdit) {
  if (!postSaveBackdrop) return;
  const actionText = isEdit ? "updated" : "posted";
  if (postSaveTitle)    postSaveTitle.textContent = `Shoe ${isEdit ? "Updated" : "Posted"} Successfully!`;
  if (postSaveSubtitle) postSaveSubtitle.textContent = `"${shoeName}" is now ${actionText} on your store. Would you like to view it on the live website now?`;
  postSaveBackdrop.style.display = "flex";
}

function hidePostSavePrompt() {
  if (postSaveBackdrop) postSaveBackdrop.style.display = "none";
}

if (btnStayAdmin) {
  btnStayAdmin.addEventListener("click", hidePostSavePrompt);
}

if (btnViewStorefront) {
  btnViewStorefront.addEventListener("click", () => {
    hidePostSavePrompt();
  });
}

/* ---------- Service worker (PWA) ---------- */

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

/* ---------- PWA Install Prompt ---------- */

let deferredInstallPrompt = null;
const installBanner = document.getElementById("install-banner");
const installBtn    = document.getElementById("install-btn");
const dismissBtn    = document.getElementById("install-dismiss");

// Capture the browser's install prompt
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;

  // Only show if the user hasn't dismissed before
  if (!localStorage.getItem("pwa-install-dismissed")) {
    // Small delay so the banner doesn't pop up instantly
    setTimeout(() => {
      installBanner.style.display = "flex";
    }, 2500);
  }
});

// User taps "Install"
if (installBtn) {
  installBtn.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    installBanner.style.display = "none";
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    if (outcome === "accepted") {
      deferredInstallPrompt = null;
    }
  });
}

// User taps ✕ — hide and remember
if (dismissBtn) {
  dismissBtn.addEventListener("click", () => {
    installBanner.style.display = "none";
    localStorage.setItem("pwa-install-dismissed", "1");
  });
}

// Hide banner once the app is installed
window.addEventListener("appinstalled", () => {
  installBanner.style.display = "none";
  deferredInstallPrompt = null;
});

/* ---------- Init ---------- */

loadDashboard();
loadProducts();

