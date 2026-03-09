
const API_URL = "https://script.google.com/macros/s/AKfycbxIZR-iyCc1BxmIixLllk_W9T5VCo-nC0yEP97cqj1tZKFkPh4jeEg7oUfOZUdt6ZeW/exec";
const FALLBACK_WHATSAPP = "0533172872";
const FALLBACK_TELEGRAM = "https://t.me/";
let SITE_SETTINGS = null;

function qs(s, root=document) { return root.querySelector(s); }
function qsa(s, root=document) { return [...root.querySelectorAll(s)]; }

async function api(action, payload = {}, method = "POST") {
  try {
    const url = new URL(API_URL);

    if (method === "GET") {
      url.searchParams.set("action", action);
      Object.entries(payload).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") {
          url.searchParams.set(k, v);
        }
      });
      const res = await fetch(url.toString());
      return await res.json();
    }

    const formBody = new URLSearchParams();
    formBody.append("action", action);
    Object.entries(payload).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") {
        formBody.append(k, v);
      }
    });

    const res = await fetch(API_URL, {
      method: "POST",
      body: formBody
    });
    return await res.json();
  } catch (error) {
    return { success: false, message: error.message };
  }
}

async function getSettings() {
  if (SITE_SETTINGS) return SITE_SETTINGS;
  const res = await api("getSettings", {}, "GET");
  SITE_SETTINGS = res && res.success ? res.data : {};
  return SITE_SETTINGS;
}

function saveCurrentUser(user) {
  localStorage.setItem("aqari_current_user", JSON.stringify(user));
}
function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("aqari_current_user")) || null;
  } catch {
    return null;
  }
}
function logout() {
  localStorage.removeItem("aqari_current_user");
  location.href = "index.html";
}
function isAdmin() {
  const user = getCurrentUser();
  return !!user && String(user.role || "").toLowerCase() === "admin";
}

function showMessage(containerId, text, type="success") {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `<div class="message ${type}">${text}</div>`;
}

function normalizePhone(phone) {
  let p = String(phone || "").replace(/\s+/g, "").replace(/^\+/, "");
  if (p.startsWith("0")) p = "966" + p.substring(1);
  return p;
}

function fmtPrice(v) {
  const num = Number(String(v || "").replace(/,/g, ""));
  if (Number.isNaN(num)) return v || "-";
  return new Intl.NumberFormat("ar-SA").format(num);
}

function statusClass(status) {
  const s = String(status || "").toLowerCase();
  if (s === "approved") return "status-approved";
  if (s === "rejected") return "status-rejected";
  return "status-pending";
}

function statusText(status) {
  const s = String(status || "").toLowerCase();
  if (s === "approved") return "Approved";
  if (s === "rejected") return "Rejected";
  return "Pending";
}

function propertyWhatsAppUrl(property) {
  const phone = normalizePhone((SITE_SETTINGS && SITE_SETTINGS.office_whatsapp) || FALLBACK_WHATSAPP);
  const msg = encodeURIComponent(`السلام عليكم، لدي استفسار عن العقار: ${property.title} | المدينة: ${property.city} | السعر: ${property.price}`);
  return `https://wa.me/${phone}?text=${msg}`;
}

function propertyTelegramUrl() {
  return (SITE_SETTINGS && SITE_SETTINGS.office_telegram) || FALLBACK_TELEGRAM;
}

function cardTemplate(p, adminMode=false) {
  return `
    <article class="card">
      <span class="status-pill ${statusClass(p.status)}">${statusText(p.status)}</span>
      <h3>${p.title || "بدون عنوان"}</h3>
      <div class="meta">
        <span>المدينة: ${p.city || "-"}</span>
        <span>الحي: ${p.district || "-"}</span>
        <span>النوع: ${p.category || "-"}</span>
        <span>المساحة: ${p.area || "-"}</span>
      </div>
      <div class="price">${fmtPrice(p.price)} ريال</div>
      <div class="card-actions">
        <a class="btn btn-secondary" href="property-details.html?id=${encodeURIComponent(p.property_id)}">التفاصيل</a>
        <a class="btn btn-ghost" target="_blank" href="${p.maps_url || '#'}">الخريطة</a>
        <a class="btn btn-primary" target="_blank" href="${propertyWhatsAppUrl(p)}">واتساب</a>
        <a class="btn btn-secondary" target="_blank" href="${propertyTelegramUrl()}">تلغرام</a>
      </div>
      ${adminMode ? adminButtons(p) : ""}
    </article>
  `;
}

function adminButtons(p) {
  return `
    <div class="card-actions">
      <button class="btn btn-success" onclick="approveProperty('${p.property_id}')">قبول</button>
      <button class="btn btn-warning" onclick="rejectProperty('${p.property_id}')">رفض</button>
      <button class="btn btn-danger" onclick="removeProperty('${p.property_id}')">حذف</button>
    </div>
  `;
}

async function initLayout() {
  await getSettings();
  const navLink = document.getElementById("navAuthLink");
  const user = getCurrentUser();
  if (navLink) {
    if (user) {
      navLink.textContent = `خروج (${user.name})`;
      navLink.href = "#";
      navLink.onclick = (e) => { e.preventDefault(); logout(); };
    } else {
      navLink.textContent = "دخول";
      navLink.href = "login.html";
    }
  }
}

async function loadHomeStats() {
  const [approved, pending] = await Promise.all([
    api("getApprovedProperties", {}, "GET"),
    api("getPendingProperties", {}, "GET")
  ]);
  const approvedCount = approved.success && Array.isArray(approved.data) ? approved.data.length : 0;
  const pendingCount = pending.success && Array.isArray(pending.data) ? pending.data.length : 0;
  const a = document.getElementById("approvedCount");
  const p = document.getElementById("pendingCount");
  if (a) a.textContent = approvedCount;
  if (p) p.textContent = pendingCount;
}

async function loadFeaturedProperties() {
  const wrap = document.getElementById("featuredProperties");
  if (!wrap) return;
  const res = await api("getApprovedProperties", {}, "GET");
  const items = res.success && Array.isArray(res.data) ? res.data.slice(0, 3) : [];
  wrap.innerHTML = items.length ? items.map(cardTemplate).join("") : `<div class="empty-state">لا توجد عقارات معتمدة حاليًا.</div>`;
}

async function initPropertiesPage() {
  await getSettings();
  const res = await api("getApprovedProperties", {}, "GET");
  const all = res.success && Array.isArray(res.data) ? res.data : [];

  const grid = document.getElementById("propertiesGrid");
  const empty = document.getElementById("propertiesEmpty");
  const cityFilter = document.getElementById("cityFilter");
  const categoryFilter = document.getElementById("categoryFilter");
  const searchInput = document.getElementById("searchInput");
  const priceFilter = document.getElementById("priceFilter");

  const cities = [...new Set(all.map(x => x.city).filter(Boolean))];
  const cats = [...new Set(all.map(x => x.category).filter(Boolean))];

  cityFilter.innerHTML += cities.map(c => `<option value="${c}">${c}</option>`).join("");
  categoryFilter.innerHTML += cats.map(c => `<option value="${c}">${c}</option>`).join("");

  function render() {
    const s = (searchInput.value || "").trim().toLowerCase();
    const city = cityFilter.value;
    const cat = categoryFilter.value;
    const price = priceFilter.value;

    const filtered = all.filter(p => {
      const text = `${p.title || ""} ${p.city || ""} ${p.district || ""}`.toLowerCase();
      const priceNum = Number(String(p.price || "").replace(/,/g, ""));
      const okSearch = !s || text.includes(s);
      const okCity = !city || p.city === city;
      const okCat = !cat || p.category === cat;

      let okPrice = true;
      if (price === "lt500") okPrice = priceNum < 500000;
      if (price === "500to1000") okPrice = priceNum >= 500000 && priceNum <= 1000000;
      if (price === "gt1000") okPrice = priceNum > 1000000;

      return okSearch && okCity && okCat && okPrice;
    });

    grid.innerHTML = filtered.map(cardTemplate).join("");
    empty.classList.toggle("hidden", filtered.length !== 0);
  }

  [cityFilter, categoryFilter, searchInput, priceFilter].forEach(el => el.addEventListener("input", render));
  render();
}

async function initPropertyDetailsPage() {
  await getSettings();
  const wrap = document.getElementById("propertyDetailsWrap");
  const id = new URLSearchParams(location.search).get("id");
  if (!id) {
    wrap.innerHTML = `<div class="empty-state">معرف العقار غير موجود.</div>`;
    return;
  }

  const res = await api("getPropertyById", { property_id: id }, "GET");
  const p = res.success ? res.data : null;

  if (!p) {
    wrap.innerHTML = `<div class="empty-state">العقار غير موجود.</div>`;
    return;
  }

  wrap.innerHTML = `
    <div class="details-panel">
      <span class="status-pill ${statusClass(p.status)}">${statusText(p.status)}</span>
      <h1>${p.title || "بدون عنوان"}</h1>
      <p class="lead">${p.description || "لا يوجد وصف."}</p>
      <div class="info-grid">
        <div class="info-box"><span>المدينة</span><strong>${p.city || "-"}</strong></div>
        <div class="info-box"><span>الحي</span><strong>${p.district || "-"}</strong></div>
        <div class="info-box"><span>النوع</span><strong>${p.category || "-"}</strong></div>
        <div class="info-box"><span>المساحة</span><strong>${p.area || "-"}</strong></div>
        <div class="info-box"><span>السعر</span><strong>${fmtPrice(p.price)} ريال</strong></div>
        <div class="info-box"><span>المالك</span><strong>${p.owner_name || "-"}</strong></div>
      </div>
    </div>
    <aside class="side-panel">
      <h3>التواصل والموقع</h3>
      <div class="inline-actions">
        <a class="btn btn-primary full" target="_blank" href="${propertyWhatsAppUrl(p)}">واتساب المكتب</a>
        <a class="btn btn-secondary full" target="_blank" href="${propertyTelegramUrl()}">تلغرام</a>
        <a class="btn btn-ghost full" target="_blank" href="${p.maps_url || '#'}">فتح Google Maps</a>
      </div>
    </aside>
  `;
}

function requireLogin(redirect=true) {
  const user = getCurrentUser();
  if (!user && redirect) location.href = "login.html";
  return user;
}

async function initRegisterPage() {
  const form = document.getElementById("registerForm");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(form).entries());
    fd.phone = normalizePhone(fd.phone);
    const res = await api("registerUser", fd);
    if (res.success) {
      saveCurrentUser(res.user);
      showMessage("registerMessage", "تم إنشاء الحساب بنجاح وتسجيل دخولك تلقائيًا.");
      setTimeout(() => location.href = "index.html", 800);
    } else {
      showMessage("registerMessage", res.message || "تعذر إنشاء الحساب.", "error");
    }
  });
}

async function initLoginPage() {
  const form = document.getElementById("loginForm");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(form).entries());
    fd.phone = normalizePhone(fd.phone);
    const res = await api("loginUser", fd);
    if (res.success) {
      saveCurrentUser(res.user);
      showMessage("loginMessage", "تم تسجيل الدخول بنجاح.");
      setTimeout(() => location.href = "index.html", 800);
    } else {
      showMessage("loginMessage", res.message || "فشل تسجيل الدخول.", "error");
    }
  });
}

async function initAddPropertyPage() {
  const user = requireLogin();
  if (!user) return;

  const form = document.getElementById("propertyForm");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(form).entries());

    const payload = {
      ...fd,
      owner_id: user.id || "",
      owner_name: user.name || "",
      owner_phone: user.phone || ""
    };

    const res = await api("addProperty", payload);
    if (res.success) {
      form.reset();
      showMessage("propertyMessage", "تم إرسال العقار للمراجعة بنجاح.");
    } else {
      showMessage("propertyMessage", res.message || "تعذر إرسال العقار.", "error");
    }
  });
}

async function initMyPropertiesPage() {
  await getSettings();
  const user = requireLogin();
  if (!user) return;

  const grid = document.getElementById("myPropertiesGrid");
  const empty = document.getElementById("myPropertiesEmpty");
  const res = await api("getAllProperties", {}, "GET");
  const items = res.success && Array.isArray(res.data)
    ? res.data.filter(p => String(p.owner_id) === String(user.id))
    : [];

  grid.innerHTML = items.map(cardTemplate).join("");
  empty.classList.toggle("hidden", items.length !== 0);
}

async function initAdminPage() {
  if (!isAdmin()) {
    document.getElementById("adminGate").classList.remove("hidden");
    document.getElementById("adminContent").classList.add("hidden");
    return;
  }

  document.getElementById("adminGate").classList.add("hidden");
  document.getElementById("adminContent").classList.remove("hidden");

  initTabs();
  await Promise.all([loadAdminProperties(), loadAdminUsers()]);
}

function initTabs() {
  qsa(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      qsa(".tab-btn").forEach(x => x.classList.remove("active"));
      qsa(".tab-panel").forEach(x => x.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");
    });
  });
}

async function loadAdminProperties() {
  await getSettings();

  const [pending, approved, rejected] = await Promise.all([
    api("getPendingProperties", {}, "GET"),
    api("getApprovedProperties", {}, "GET"),
    api("getRejectedProperties", {}, "GET")
  ]);

  const pendingData = pending.success && Array.isArray(pending.data) ? pending.data : [];
  const approvedData = approved.success && Array.isArray(approved.data) ? approved.data : [];
  const rejectedData = rejected.success && Array.isArray(rejected.data) ? rejected.data : [];

  document.getElementById("statPending").textContent = pendingData.length;
  document.getElementById("statApproved").textContent = approvedData.length;
  document.getElementById("statRejected").textContent = rejectedData.length;

  renderAdminGroup("pendingGrid", "pendingEmpty", pendingData);
  renderAdminGroup("approvedGrid", "approvedEmpty", approvedData);
  renderAdminGroup("rejectedGrid", "rejectedEmpty", rejectedData);
}

function renderAdminGroup(gridId, emptyId, data) {
  const grid = document.getElementById(gridId);
  const empty = document.getElementById(emptyId);
  grid.innerHTML = data.map(x => cardTemplate(x, true)).join("");
  empty.classList.toggle("hidden", data.length !== 0);
}

async function approveProperty(id) {
  if (!confirm("تأكيد قبول العقار؟")) return;
  const user = getCurrentUser();
  const res = await api("approveProperty", { property_id: id, admin_name: user?.name || "admin" });
  if (res.success) {
    await loadAdminProperties();
  } else {
    alert(res.message || "تعذر تنفيذ العملية");
  }
}

async function rejectProperty(id) {
  if (!confirm("تأكيد رفض العقار؟")) return;
  const user = getCurrentUser();
  const res = await api("rejectProperty", { property_id: id, admin_name: user?.name || "admin" });
  if (res.success) {
    await loadAdminProperties();
  } else {
    alert(res.message || "تعذر تنفيذ العملية");
  }
}

async function removeProperty(id) {
  if (!confirm("تأكيد حذف العقار؟")) return;
  const res = await api("deleteProperty", { property_id: id });
  if (res.success) {
    await loadAdminProperties();
  } else {
    alert(res.message || "تعذر حذف العقار");
  }
}

async function loadAdminUsers() {
  const res = await api("getUsers", {}, "GET");
  const users = res.success && Array.isArray(res.data) ? res.data : [];
  document.getElementById("statUsers").textContent = users.length;

  const body = document.getElementById("usersTableBody");
  const search = document.getElementById("userSearch");

  function render() {
    const s = (search.value || "").toLowerCase();
    const filtered = users.filter(u => `${u.name || ""} ${u.phone || ""}`.toLowerCase().includes(s));
    body.innerHTML = filtered.map(u => `
      <tr>
        <td>${u.name || "-"}</td>
        <td>${u.phone || "-"}</td>
        <td>${u.role || "-"}</td>
        <td>${u.status || "-"}</td>
        <td>
          <div class="inline-actions">
            <button class="btn btn-secondary" onclick="toggleAdminRole('${u.id}', '${u.role || "user"}')">
              ${String(u.role || "").toLowerCase() === "admin" ? "إرجاع User" : "جعله Admin"}
            </button>
            <button class="btn btn-danger" onclick="removeUser('${u.id}')">حذف</button>
          </div>
        </td>
      </tr>
    `).join("");
  }

  search.addEventListener("input", render);
  render();
}

async function toggleAdminRole(userId, currentRole) {
  const action = String(currentRole || "").toLowerCase() === "admin" ? "makeUser" : "makeAdmin";
  const res = await api(action, { user_id: userId });
  if (res.success) {
    await loadAdminUsers();
  } else {
    alert(res.message || "تعذر تعديل الصلاحية");
  }
}

async function removeUser(userId) {
  if (!confirm("تأكيد حذف المستخدم؟")) return;
  const res = await api("deleteUser", { user_id: userId });
  if (res.success) {
    await loadAdminUsers();
  } else {
    alert(res.message || "تعذر حذف المستخدم");
  }
}
