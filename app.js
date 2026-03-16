const THEME_KEY = "theme_mode";
const AUTH_TOKEN_KEY = "auth_token";
const AUTH_USER_KEY = "auth_user";
const MOCK_USERS_KEY = "mock_auth_users_v1";
const MOCK_COMPUTERS_KEY = "mock_inventory_computers_v1";
const MOCK_CORPORATE_EMAILS_KEY = "mock_inventory_corporate_emails_v1";
const MOCK_COMPUTER_MOVEMENTS_KEY = "mock_inventory_computer_movements_v1";
const appConfig = window.APP_CONFIG || {};
const defaultApiBase = window.location.origin && window.location.origin !== "null"
  ? `${window.location.origin}/api`
  : "http://localhost:3000/api";
const API_BASE_URL = String(appConfig.API_BASE_URL || defaultApiBase).replace(/\/$/, "");
const AUTH_BASE_URL = `${API_BASE_URL}/auth`;
const AUTH_USE_MOCK = Boolean(appConfig.AUTH_USE_MOCK || false);

const elements = {
  appShell: document.getElementById("app-shell"),
  navButtons: Array.from(document.querySelectorAll(".nav-btn")),
  dashboardView: document.getElementById("view-dashboard"),
  computersView: document.getElementById("view-computadores"),
  emailsView: document.getElementById("view-emails"),
  movementsView: document.getElementById("view-movimentacoes"),
  permissionsView: document.getElementById("view-permissoes"),
  historyView: document.getElementById("view-historico"),
  modalLayer: document.getElementById("modal-layer"),
  modalTitle: document.getElementById("modal-title"),
  form: document.getElementById("computer-form"),
  tableBody: document.getElementById("table-body"),
  tableCount: document.getElementById("table-count"),
  filterSearch: document.getElementById("filter-search"),
  filterStatus: document.getElementById("filter-status"),
  metricTotal: document.getElementById("metric-total"),
  metricActive: document.getElementById("metric-active"),
  metricSoon: document.getElementById("metric-soon"),
  metricExpired: document.getElementById("metric-expired"),
  commonSpecs: document.getElementById("common-specs"),
  importInput: document.getElementById("import-csv-input"),
  importFeedback: document.getElementById("import-feedback"),
  downloadCsvTemplate: document.getElementById("download-csv-template"),
  userEmail: document.getElementById("user-email"),
  themeToggle: document.getElementById("theme-toggle"),
  logoutButton: document.getElementById("logout-btn"),
  authTabs: document.getElementById("auth-tabs"),
  authSubtitle: document.getElementById("auth-subtitle"),
  authLayer: document.getElementById("auth-modal-layer"),
  authTabLogin: document.getElementById("tab-login"),
  authTabRegister: document.getElementById("tab-register"),
  authError: document.getElementById("auth-error"),
  oauthAuthSection: document.getElementById("oauth-auth-section"),
  oauthAuthCopy: document.getElementById("oauth-auth-copy"),
  googleSigninButton: document.getElementById("google-signin-button"),
  loginForm: document.getElementById("login-form"),
  registerForm: document.getElementById("register-form"),
  corporateEmailForm: document.getElementById("corporate-email-form"),
  corporateEmailInput: document.getElementById("corporate-email-input"),
  computerCorporateEmail: document.getElementById("computer-corporate-email"),
  corporateEmailFeedback: document.getElementById("corporate-email-feedback"),
  corporateEmailCount: document.getElementById("corporate-email-count"),
  corporateEmailTableBody: document.getElementById("corporate-email-table-body"),
  movementForm: document.getElementById("movement-form"),
  movementComputer: document.getElementById("movement-computer"),
  movementType: document.getElementById("movement-type"),
  movementCurrentOwner: document.getElementById("movement-current-owner"),
  movementCurrentEmail: document.getElementById("movement-current-email"),
  movementTargetFields: document.getElementById("movement-target-fields"),
  movementNextOwner: document.getElementById("movement-next-owner"),
  movementNextEmail: document.getElementById("movement-next-email"),
  movementReason: document.getElementById("movement-reason"),
  movementFeedback: document.getElementById("movement-feedback"),
  movementCount: document.getElementById("movement-count"),
  movementTableBody: document.getElementById("movement-table-body"),
  usersCount: document.getElementById("users-count"),
  usersTableBody: document.getElementById("users-table-body"),
  permissionsFeedback: document.getElementById("permissions-feedback"),
  auditCount: document.getElementById("audit-count"),
  auditTableBody: document.getElementById("audit-table-body"),
};

const state = {
  currentView: "dashboard",
  editingId: null,
  searchTerm: "",
  statusFilter: "todos",
  computers: [],
  corporateEmails: [],
  computerMovements: [],
  users: [],
  auditLogs: [],
  theme: loadTheme(),
  auth: {
    user: loadUser(),
    token: localStorage.getItem(AUTH_TOKEN_KEY),
    isAuthenticated: false,
    loading: false,
    error: "",
    mode: "login",
    provider: "local",
    googleClientId: "",
    googleInitialized: false,
    corporateEmailDomain: ""
  }
};

function loadUser() {
  try {
    const user = JSON.parse(localStorage.getItem(AUTH_USER_KEY) || "null");
    return user && typeof user.email === "string"
      ? { email: user.email, role: user.role === "admin" ? "admin" : "member" }
      : null;
  } catch (error) {
    return null;
  }
}

function loadTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  return saved === "dark" ? "dark" : "light";
}

function applyTheme() {
  const isDark = state.theme === "dark";
  document.body.classList.toggle("dark-mode", isDark);
  elements.themeToggle.textContent = isDark ? "Modo Claro" : "Modo Escuro";
}

function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, state.theme);
  applyTheme();
}
function setCorporateFeedback(message, kind = "ok") {
  if (!message) {
    elements.corporateEmailFeedback.textContent = "";
    elements.corporateEmailFeedback.className = "mt-3 hidden text-sm";
    return;
  }
  elements.corporateEmailFeedback.textContent = message;
  elements.corporateEmailFeedback.className =
    kind === "error"
      ? "mt-3 text-sm text-rose-600"
      : "mt-3 text-sm text-emerald-600";
}

function setMovementFeedback(message = "", kind = "ok") {
  if (!message) {
    elements.movementFeedback.textContent = "";
    elements.movementFeedback.className = "hidden rounded-lg border px-3 py-2 text-sm";
    return;
  }

  elements.movementFeedback.textContent = message;
  elements.movementFeedback.className = kind === "error"
    ? "rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
    : "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700";
}

function setImportFeedback(message = "", kind = "ok") {
  if (!message) {
    elements.importFeedback.textContent = "";
    elements.importFeedback.className = "mt-4 hidden rounded-lg border px-3 py-2 text-sm";
    return;
  }

  elements.importFeedback.textContent = message;
  elements.importFeedback.className = kind === "error"
    ? "mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
    : "mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700";
}

function persistAuthSession(payload) {
  state.auth.user = payload.user;
  state.auth.token = payload.token;
  state.auth.isAuthenticated = true;
  localStorage.setItem(AUTH_TOKEN_KEY, payload.token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(payload.user));
}

function clearAuthSession() {
  state.auth.user = null;
  state.auth.token = null;
  state.auth.isAuthenticated = false;
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}

function setAuthError(message) {
  state.auth.error = message;
  if (!message) {
    elements.authError.textContent = "";
    elements.authError.classList.add("hidden");
    return;
  }
  elements.authError.textContent = message;
  elements.authError.classList.remove("hidden");
}

function setAuthMode(mode) {
  state.auth.mode = mode;
  setAuthError("");
  const isLocalAuth = state.auth.provider === "local";
  elements.authTabs.classList.toggle("hidden", !isLocalAuth);
  elements.loginForm.classList.toggle("hidden", !isLocalAuth || mode !== "login");
  elements.registerForm.classList.toggle("hidden", !isLocalAuth || mode !== "register");
  elements.oauthAuthSection.classList.toggle("hidden", state.auth.provider !== "google");

  if (state.auth.provider === "google") {
    elements.authSubtitle.textContent = "Entre com sua conta Google para acessar o inventario.";
    elements.oauthAuthCopy.textContent = "Use sua conta Google para entrar.";
    return;
  }

  elements.authSubtitle.textContent = "Entre para gerenciar os computadores.";
  elements.authTabLogin.classList.toggle("bg-white", mode === "login");
  elements.authTabLogin.classList.toggle("text-brand-600", mode === "login");
  elements.authTabRegister.classList.toggle("bg-white", mode === "register");
  elements.authTabRegister.classList.toggle("text-brand-600", mode === "register");
}

function setAuthLoading(isLoading) {
  state.auth.loading = isLoading;
  if (state.auth.provider === "local") {
    const loginButton = elements.loginForm.querySelector("button[type='submit']");
    const registerButton = elements.registerForm.querySelector("button[type='submit']");
    loginButton.disabled = isLoading;
    registerButton.disabled = isLoading;
    loginButton.classList.toggle("opacity-70", isLoading);
    registerButton.classList.toggle("opacity-70", isLoading);
    loginButton.textContent = isLoading ? "Aguarde..." : "Entrar";
    registerButton.textContent = isLoading ? "Aguarde..." : "Cadastrar e Entrar";
    return;
  }

  elements.oauthAuthSection.classList.toggle("opacity-70", isLoading);
  elements.oauthAuthSection.classList.toggle("pointer-events-none", isLoading);
}

function applyAuthGate() {
  const locked = !state.auth.isAuthenticated;
  elements.appShell.classList.toggle("auth-locked", locked);
  elements.authLayer.classList.toggle("hidden", !locked);
  elements.authLayer.classList.toggle("flex", locked);
  elements.userEmail.textContent = state.auth.user?.email || "Nao autenticado";
  elements.logoutButton.classList.toggle("hidden", locked);
}

function renderNav() {
  elements.navButtons.forEach((button) => {
    const needsAdmin = button.dataset.nav === "permissoes";
    button.classList.toggle("hidden", needsAdmin && !isAdmin());
    if (needsAdmin && !isAdmin() && state.currentView === "permissoes") {
      state.currentView = "dashboard";
    }
    const active = button.dataset.nav === state.currentView;
    button.classList.toggle("bg-blue-50", active);
    button.classList.toggle("text-brand-600", active);
    button.classList.toggle("text-slate-700", !active);
  });
}

function getRemainingDays(computer) {
  if (computer.purchaseDate && (computer.warrantyMonths || computer.warrantyMonths === 0)) {
    const startDate = new Date(computer.purchaseDate);
    if (!Number.isNaN(startDate.getTime())) {
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + Number(computer.warrantyMonths || 0));
      return Math.ceil((endDate.getTime() - Date.now()) / 86400000);
    }
  }

  const createdAtMs = new Date(computer.createdAt || Date.now()).getTime();
  if (Number.isNaN(createdAtMs)) {
    return Number(computer.warrantyDays) || 0;
  }
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - createdAtMs) / 86400000);
  return Number(computer.warrantyDays) - diffDays;
}

function getWarrantyStatus(computer) {
  const remaining = getRemainingDays(computer);
  if (remaining <= 0) return "vencida";
  if (remaining <= 30) return "proxima";
  return "ativa";
}

function statusBadge(status) {
  if (status === "ativa") {
    return '<span class="inline-flex rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Ativa</span>';
  }
  if (status === "proxima") {
    return '<span class="inline-flex rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">Proxima</span>';
  }
  return '<span class="inline-flex rounded-full border border-rose-300 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">Vencida</span>';
}

function formatRemaining(remaining) {
  if (remaining <= 0) return "Sem cobertura";
  if (remaining === 1) return "1 dia";
  return `${remaining} dias`;
}

function buildSpecs(payload) {
  const parts = [];
  if (payload.cpu) parts.push(payload.cpu);
  if (payload.ram) parts.push(payload.ram);
  if (payload.gpu) parts.push(payload.gpu);
  if (payload.storage) {
    const storageInfo = payload.storageType ? `${payload.storage} ${payload.storageType}` : payload.storage;
    parts.push(storageInfo.trim());
  }
  if (payload.os) parts.push(payload.os);
  return parts.join(" / ");
}

function renderCorporateEmailOptions(selectedEmail = "") {
  const options = ['<option value="">Sem vínculo</option>'];
  state.corporateEmails.forEach((item) => {
    const selected = item.email === selectedEmail ? "selected" : "";
    options.push(`<option value="${escapeHtml(item.email)}" ${selected}>${escapeHtml(item.email)}</option>`);
  });
  elements.computerCorporateEmail.innerHTML = options.join("");
}

function renderMovementComputerOptions(selectedId = "") {
  const options = ['<option value="">Selecione um computador</option>'];
  state.computers.forEach((computer) => {
    const selected = computer.id === selectedId ? "selected" : "";
    options.push(
      `<option value="${escapeHtml(computer.id)}" ${selected}>${escapeHtml(computer.serial)} - ${escapeHtml(computer.owner || "Sem responsável")}</option>`
    );
  });
  elements.movementComputer.innerHTML = options.join("");
}

function renderMovementEmailOptions(selectedEmail = "") {
  const options = ['<option value="">Sem vínculo</option>'];
  state.corporateEmails.forEach((item) => {
    const selected = item.email === selectedEmail ? "selected" : "";
    options.push(`<option value="${escapeHtml(item.email)}" ${selected}>${escapeHtml(item.email)}</option>`);
  });
  elements.movementNextEmail.innerHTML = options.join("");
}

function movementTypeBadge(type) {
  if (type === "troca") {
    return '<span class="inline-flex rounded-full border border-blue-300 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">Troca</span>';
  }
  return '<span class="inline-flex rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">Devolução</span>';
}

function syncMovementForm() {
  const selectedComputer = state.computers.find((item) => item.id === elements.movementComputer.value);
  const movementType = String(elements.movementType.value || "devolucao").toLowerCase();
  const isExchange = movementType === "troca";

  elements.movementCurrentOwner.textContent = selectedComputer?.owner || "-";
  elements.movementCurrentEmail.textContent = selectedComputer?.corporateEmail || "-";
  elements.movementTargetFields.classList.toggle("opacity-70", !isExchange);
  elements.movementNextOwner.disabled = !isExchange;
  elements.movementNextEmail.disabled = !isExchange;
  elements.movementNextOwner.required = isExchange;

  if (!isExchange) {
    elements.movementNextOwner.value = "";
    elements.movementNextEmail.value = "";
  }
}

function isAdmin() {
  return state.auth.user?.role === "admin";
}

function roleLabel(role) {
  return role === "admin" ? "Administrador" : "Membro";
}

function roleBadge(role) {
  if (role === "admin") {
    return '<span class="inline-flex rounded-full border border-indigo-300 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">Administrador</span>';
  }
  return '<span class="inline-flex rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Membro</span>';
}

function providerLabel(provider) {
  return provider === "google" ? "Google" : "Local";
}

function activeBadge(active) {
  return active
    ? '<span class="inline-flex rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Ativo</span>'
    : '<span class="inline-flex rounded-full border border-rose-300 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">Inativo</span>';
}


function statusLabel(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "inativo") return "Inativo";
  if (normalized === "pendente") return "Pendente";
  return "Ativo";
}

function deviceStatusBadge(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "inativo") {
    return '<span class="inline-flex rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Inativo</span>';
  }
  if (normalized === "pendente") {
    return '<span class="inline-flex rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">Pendente</span>';
  }
  return '<span class="inline-flex rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Ativo</span>';
}
function filteredComputers() {
  return state.computers.filter((computer) => {
    const status = getWarrantyStatus(computer);
    const joined = `${computer.serial} ${computer.owner} ${computer.corporateEmail || ""} ${computer.specs} ${computer.machine}`.toLowerCase();
    const matchesSearch = joined.includes(state.searchTerm.toLowerCase());
    const matchesStatus = state.statusFilter === "todos" ? true : status === state.statusFilter;
    return matchesSearch && matchesStatus;
  });
}

function renderDashboard() {
  const all = state.computers;
  const active = all.filter((item) => getWarrantyStatus(item) === "ativa").length;
  const soon = all.filter((item) => getWarrantyStatus(item) === "proxima").length;
  const expired = all.filter((item) => getWarrantyStatus(item) === "vencida").length;

  elements.metricTotal.textContent = all.length;
  elements.metricActive.textContent = active;
  elements.metricSoon.textContent = soon;
  elements.metricExpired.textContent = expired;

  const grouped = all.reduce((acc, item) => {
    const key = item.specs.trim() || "Sem especificacao";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const entries = Object.entries(grouped)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  if (!entries.length) {
    elements.commonSpecs.innerHTML = "<p class='text-slate-500'>Nenhuma especificacao cadastrada.</p>";
    return;
  }

  const max = entries[0][1];
  elements.commonSpecs.innerHTML = entries
    .map(([spec, count]) => {
      const pct = Math.max(8, Math.round((count / max) * 100));
      return `
        <div class="grid grid-cols-[1fr_120px_40px] items-center gap-3">
          <p class="truncate text-sm font-medium">${escapeHtml(spec)}</p>
          <div class="h-3 rounded-full bg-slate-200">
            <div class="h-3 rounded-full bg-brand-500" style="width:${pct}%"></div>
          </div>
          <p class="text-right text-sm font-semibold">${count}</p>
        </div>
      `;
    })
    .join("");
}

function renderTable() {
  const rows = filteredComputers();
  elements.tableCount.textContent = `${rows.length} computador(es) encontrado(s)`;

  if (!rows.length) {
    elements.tableBody.innerHTML = `
      <tr>
        <td colspan="8" class="px-4 py-8 text-center text-slate-500">Nenhum computador encontrado para os filtros atuais.</td>
      </tr>
    `;
    return;
  }

  elements.tableBody.innerHTML = rows
    .map((computer) => {
      const status = getWarrantyStatus(computer);
      const remaining = getRemainingDays(computer);
      return `
        <tr class="hover:bg-slate-50/80">
          <td class="px-4 py-4 font-semibold">${escapeHtml(computer.serial)}</td>
          <td class="px-4 py-4">${escapeHtml(computer.owner)}</td>
          <td class="px-4 py-4">${escapeHtml(computer.corporateEmail || "-")}</td>
          <td class="px-4 py-4">${escapeHtml(computer.machine || "-")}</td>
          <td class="px-4 py-4">${deviceStatusBadge(computer.deviceStatus || "ativo")}</td>
          <td class="px-4 py-4">${escapeHtml(computer.specs)}</td>
          <td class="px-4 py-4">
            <div class="space-y-1">
              ${statusBadge(status)}
              <p class="text-xs text-slate-500">${formatRemaining(remaining)}</p>
            </div>
          </td>
          <td class="px-4 py-4">
            <div class="flex justify-end gap-2">
              <button data-action="view" data-id="${computer.id}" class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-100">Ver</button>
              <button data-action="edit" data-id="${computer.id}" class="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100">Editar</button>
              <button data-action="delete" data-id="${computer.id}" class="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100">Deletar</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function formatDate(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-BR");
}

function renderCorporateEmails() {
  const rows = state.corporateEmails;
  elements.corporateEmailCount.textContent = `${rows.length} email(s) cadastrado(s)`;

  if (!rows.length) {
    elements.corporateEmailTableBody.innerHTML = `
      <tr>
        <td colspan="4" class="px-4 py-8 text-center text-slate-500">Nenhum email corporativo cadastrado.</td>
      </tr>
    `;
    return;
  }

  elements.corporateEmailTableBody.innerHTML = rows
    .map((item) => {
      const linkedMachines = Number.isFinite(item.machineCount)
        ? item.machineCount
        : state.computers.filter((computer) => computer.corporateEmail === item.email).length;
      return `
      <tr class="hover:bg-slate-50/80">
        <td class="px-4 py-4 font-medium">${escapeHtml(item.email)}</td>
        <td class="px-4 py-4">${linkedMachines}</td>
        <td class="px-4 py-4">${formatDate(item.createdAt)}</td>
        <td class="px-4 py-4 text-right">
          <button data-email-action="delete" data-id="${item.id}" class="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100">Remover</button>
        </td>
      </tr>
    `;
    })
    .join("");
}

function renderMovements() {
  renderMovementComputerOptions(elements.movementComputer.value);
  renderMovementEmailOptions(elements.movementNextEmail.value);
  syncMovementForm();

  const rows = state.computerMovements;
  elements.movementCount.textContent = `${rows.length} movimentação(ões)`;

  if (!rows.length) {
    elements.movementTableBody.innerHTML = `
      <tr>
        <td colspan="7" class="px-4 py-8 text-center text-slate-500">Nenhuma movimentação registrada.</td>
      </tr>
    `;
    return;
  }

  elements.movementTableBody.innerHTML = rows.map((movement) => `
    <tr class="hover:bg-slate-50/80">
      <td class="px-4 py-4">${new Date(movement.createdAt).toLocaleString("pt-BR")}</td>
      <td class="px-4 py-4">${movementTypeBadge(movement.movementType)}</td>
      <td class="px-4 py-4">
        <div class="space-y-1">
          <p class="font-semibold">${escapeHtml(movement.serial || "-")}</p>
          <p class="text-xs text-slate-500">${escapeHtml(movement.machine || "-")}</p>
        </div>
      </td>
      <td class="px-4 py-4">
        <div class="space-y-1">
          <p>${escapeHtml(movement.previousOwner || "-")}</p>
          <p class="text-xs text-slate-500">${escapeHtml(movement.previousCorporateEmail || "-")}</p>
        </div>
      </td>
      <td class="px-4 py-4">
        <div class="space-y-1">
          <p>${escapeHtml(movement.nextOwner || (movement.movementType === "devolucao" ? "Estoque" : "-"))}</p>
          <p class="text-xs text-slate-500">${escapeHtml(movement.nextCorporateEmail || "-")}</p>
        </div>
      </td>
      <td class="px-4 py-4">${escapeHtml(movement.reason || "-")}</td>
      <td class="px-4 py-4">${escapeHtml(movement.createdByEmail || "-")}</td>
    </tr>
  `).join("");
}

function setPermissionsFeedback(message = "", kind = "muted") {
  elements.permissionsFeedback.textContent = message;
  elements.permissionsFeedback.className =
    kind === "error" ? "text-sm text-rose-600"
      : kind === "ok" ? "text-sm text-emerald-600"
        : "text-sm text-slate-500";
}

function renderPermissions() {
  const rows = state.users;
  elements.usersCount.textContent = `${rows.length} usuário(s)`;

  if (!isAdmin()) {
    elements.usersTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="px-4 py-8 text-center text-slate-500">Somente administradores podem gerenciar permissões.</td>
      </tr>
    `;
    return;
  }

  if (!rows.length) {
    elements.usersTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="px-4 py-8 text-center text-slate-500">Nenhum usuário encontrado.</td>
      </tr>
    `;
    return;
  }

  elements.usersTableBody.innerHTML = rows.map((user) => `
    <tr class="hover:bg-slate-50/80">
      <td class="px-4 py-4 font-medium">${escapeHtml(user.email)}</td>
      <td class="px-4 py-4">${roleBadge(user.role)}</td>
      <td class="px-4 py-4">${escapeHtml(providerLabel(user.authProvider))}</td>
      <td class="px-4 py-4">${activeBadge(user.active)}</td>
      <td class="px-4 py-4">${formatDate(user.createdAt)}</td>
      <td class="px-4 py-4 text-right">
        <div class="flex justify-end gap-2">
          <button data-user-action="make-member" data-id="${user.id}" class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-100" ${user.role !== "admin" ? "disabled" : ""}>Tornar Membro</button>
          <button data-user-action="make-admin" data-id="${user.id}" class="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100" ${user.role === "admin" ? "disabled" : ""}>Tornar Admin</button>
        </div>
      </td>
    </tr>
  `).join("");
}

function renderAuditLogs() {
  const rows = state.auditLogs;
  elements.auditCount.textContent = `${rows.length} evento(s)`;

  if (!rows.length) {
    elements.auditTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="px-4 py-8 text-center text-slate-500">Nenhum evento encontrado.</td>
      </tr>
    `;
    return;
  }

  elements.auditTableBody.innerHTML = rows.map((log) => `
    <tr class="hover:bg-slate-50/80">
      <td class="px-4 py-4">${new Date(log.createdAt).toLocaleString("pt-BR")}</td>
      <td class="px-4 py-4">${escapeHtml(log.actorEmail || "-")}</td>
      <td class="px-4 py-4">${escapeHtml(log.actionType)}</td>
      <td class="px-4 py-4">${escapeHtml(log.entityType)}${log.entityId ? ` #${escapeHtml(log.entityId)}` : ""}</td>
      <td class="px-4 py-4">${escapeHtml(log.description)}</td>
    </tr>
  `).join("");
}

function render() {
  elements.dashboardView.classList.toggle("hidden", state.currentView !== "dashboard");
  elements.computersView.classList.toggle("hidden", state.currentView !== "computadores");
  elements.emailsView.classList.toggle("hidden", state.currentView !== "emails");
  elements.movementsView.classList.toggle("hidden", state.currentView !== "movimentacoes");
  elements.permissionsView.classList.toggle("hidden", state.currentView !== "permissoes");
  elements.historyView.classList.toggle("hidden", state.currentView !== "historico");
  renderNav();
  renderDashboard();
  renderTable();
  renderCorporateEmails();
  renderMovements();
  renderPermissions();
  renderAuditLogs();
  applyAuthGate();
  renderGoogleAuth();
}

function openModal(computer = null) {
  if (!state.auth.isAuthenticated) return;
  state.editingId = computer ? computer.id : null;
  renderCorporateEmailOptions(computer?.corporateEmail || "");
  elements.modalTitle.textContent = computer ? "Editar Computador" : "Adicionar Novo Computador";
  elements.form.owner.value = computer?.owner || "";
  elements.form.serial.value = computer?.serial || "";
  elements.form.machine.value = computer?.machine || "";
  elements.form.purchaseDate.value = computer?.purchaseDate || "";
  elements.form.warrantyMonths.value = computer?.warrantyMonths ?? "";
  elements.form.cpu.value = computer?.cpu || "";
  elements.form.ram.value = computer?.ram || "";
  elements.form.gpu.value = computer?.gpu || "";
  elements.form.storage.value = computer?.storage || "";
  elements.form.storageType.value = computer?.storageType || "SSD";
  elements.form.deviceStatus.value = computer?.deviceStatus || "ativo";
  elements.form.corporateEmail.value = computer?.corporateEmail || "";
  elements.form.os.value = computer?.os || "";
  elements.form.notes.value = computer?.notes || "";
  elements.modalLayer.classList.remove("hidden");
  elements.modalLayer.classList.add("flex");
}

function closeModal() {
  state.editingId = null;
  elements.form.reset();
  elements.modalLayer.classList.add("hidden");
  elements.modalLayer.classList.remove("flex");
}

async function upsertComputer(formData) {
  const payload = {
    owner: formData.get("owner").trim(),
    serial: formData.get("serial").trim(),
    machine: formData.get("machine").trim(),
    purchaseDate: String(formData.get("purchaseDate") || ""),
    warrantyMonths: Number(formData.get("warrantyMonths") || 0),
    cpu: formData.get("cpu").trim(),
    ram: formData.get("ram").trim(),
    gpu: formData.get("gpu").trim(),
    storage: formData.get("storage").trim(),
    storageType: formData.get("storageType").trim(),
    deviceStatus: String(formData.get("deviceStatus") || "ativo"),
    corporateEmail: String(formData.get("corporateEmail") || "").trim().toLowerCase(),
    os: formData.get("os").trim(),
    notes: formData.get("notes").trim()
  };
  payload.warrantyDays = payload.warrantyMonths * 30;
  payload.specs = buildSpecs(payload);

  if (!payload.owner || !payload.serial) {
    throw new Error("Dono e numero de serie sao obrigatorios.");
  }
  if (!state.auth.token) {
    throw new Error("Sessao invalida. Faca login novamente.");
  }

  if (state.editingId) {
    await inventoryService.updateComputer(state.auth.token, state.editingId, payload);
  } else {
    await inventoryService.createComputer(state.auth.token, payload);
  }

  await refreshInventoryData();
}

async function addCorporateEmail(emailValue) {
  const email = String(emailValue || "").trim().toLowerCase();
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!valid) {
    throw new Error("Informe um email corporativo valido.");
  }

  if (!state.auth.token) {
    throw new Error("Sessao invalida. Faca login novamente.");
  }

  await inventoryService.createCorporateEmail(state.auth.token, email);
  await refreshInventoryData();
}

async function removeCorporateEmail(id) {
  if (!state.auth.token) {
    throw new Error("Sessao invalida. Faca login novamente.");
  }

  await inventoryService.removeCorporateEmail(state.auth.token, id);
  await refreshInventoryData();
}

async function createComputerMovement(formData) {
  if (!state.auth.token) {
    throw new Error("Sessao invalida. Faca login novamente.");
  }

  const movementType = String(formData.get("movementType") || "devolucao").trim().toLowerCase();
  const payload = {
    computerId: String(formData.get("computerId") || "").trim(),
    movementType,
    nextOwner: String(formData.get("nextOwner") || "").trim(),
    nextCorporateEmail: String(formData.get("nextCorporateEmail") || "").trim().toLowerCase(),
    reason: String(formData.get("reason") || "").trim()
  };

  if (!payload.computerId) {
    throw new Error("Selecione um computador.");
  }
  if (!["devolucao", "troca"].includes(movementType)) {
    throw new Error("Tipo de movimentacao invalido.");
  }
  if (movementType === "troca" && !payload.nextOwner) {
    throw new Error("Informe o novo responsavel para a troca.");
  }
  if (movementType === "devolucao") {
    payload.nextOwner = "";
    payload.nextCorporateEmail = "";
  }

  await inventoryService.createComputerMovement(state.auth.token, payload);
  await refreshInventoryData();
}

function viewComputer(id) {
  const computer = state.computers.find((item) => item.id === id);
  if (!computer) return;
  const remaining = getRemainingDays(computer);
  window.alert(
    `Dono: ${computer.owner}\nEmail corporativo: ${computer.corporateEmail || "-"}\nSerie: ${computer.serial}\nMaquina: ${computer.machine || "-"}\nStatus: ${statusLabel(computer.deviceStatus)}\nData de compra: ${computer.purchaseDate || "-"}\nGarantia: ${computer.warrantyMonths ?? "-"} meses\nRestante: ${formatRemaining(remaining)}\nCPU: ${computer.cpu || "-"}\nRAM: ${computer.ram || "-"}\nGPU: ${computer.gpu || "-"}\nArmazenamento: ${computer.storage || "-"} ${computer.storageType || ""}\nSO: ${computer.os || "-"}\nObservacoes: ${computer.notes || "-"}`
  );
}

async function deleteComputer(id) {
  const ok = window.confirm("Deseja realmente deletar este computador?");
  if (!ok) return;

  if (!state.auth.token) {
    throw new Error("Sessao invalida. Faca login novamente.");
  }

  await inventoryService.deleteComputer(state.auth.token, id);
  await refreshInventoryData();
  render();
}

const CSV_COLUMNS = [
  { key: "owner", header: "dono", required: true, aliases: ["owner"], example: "Maria Silva" },
  { key: "corporateEmail", header: "email_corporativo", aliases: ["emailcorporativo", "corporateemail"], example: "maria@okta7.com.br" },
  { key: "serial", header: "numero_serie", required: true, aliases: ["serial", "numerodeserie"], example: "SN-001" },
  { key: "machine", header: "modelo", aliases: ["maquina", "machine", "maquinamodelo"], example: "Dell Latitude 5440" },
  { key: "deviceStatus", header: "status", aliases: ["devicestatus"], example: "ativo" },
  { key: "purchaseDate", header: "data_compra", aliases: ["datacompra", "datadecompra", "purchasedate"], example: "2026-03-16" },
  { key: "warrantyMonths", header: "garantia_meses", aliases: ["garantiameses", "warrantymonths"], example: "12" },
  { key: "cpu", header: "cpu", example: "Intel Core i7" },
  { key: "ram", header: "ram", example: "16 GB" },
  { key: "gpu", header: "gpu", example: "Intel Iris Xe" },
  { key: "storage", header: "armazenamento", aliases: ["storage"], example: "512 GB" },
  { key: "storageType", header: "tipo_armazenamento", aliases: ["storagetype", "tipodearmazenamento"], example: "SSD" },
  { key: "os", header: "sistema_operacional", aliases: ["sistemaoperacional", "operatingsystem", "os"], example: "Windows 11 Pro" },
  { key: "notes", header: "observacoes", aliases: ["notes"], example: "Notebook do comercial" },
  { key: "warrantyDays", header: "garantia_dias", aliases: ["garantiadias", "warrantydays"], example: "360" },
  { key: "specs", header: "specs", aliases: ["resumospecs"], example: "Intel Core i7 / 16 GB / 512 GB SSD / Windows 11 Pro" },
  { key: "createdAt", header: "cadastro", aliases: ["createdat"], example: "2026-03-16 09:00:00" }
];

function normalizeCsvHeader(header) {
  const normalized = String(header || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w]/g, "")
    .toLowerCase();

  const matched = CSV_COLUMNS.find((column) => {
    const candidates = [column.header, ...(column.aliases || [])]
      .map((value) => String(value).replace(/[^\w]/g, "").toLowerCase());
    return candidates.includes(normalized);
  });

  return matched?.key || String(header || "").trim();
}

function csvValueForExport(column, computer) {
  if (column.key === "deviceStatus") return computer.deviceStatus || "ativo";
  if (column.key === "purchaseDate") return computer.purchaseDate || "";
  if (column.key === "createdAt") return computer.createdAt ? new Date(computer.createdAt).toISOString() : "";
  return computer[column.key];
}

function downloadCsv(content, filename) {
  const blob = new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function downloadCsvTemplate() {
  const delimiter = ";";
  const toCsvCell = (value) => `"${String(value ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
  const headerLine = CSV_COLUMNS.map((column) => toCsvCell(column.header)).join(delimiter);
  const exampleLine = CSV_COLUMNS.map((column) => toCsvCell(column.example || "")).join(delimiter);
  downloadCsv(["sep=;", headerLine, exampleLine].join("\r\n"), "modelo-importacao-computadores.csv");
  setImportFeedback("Modelo CSV baixado com sucesso. Abra no Excel e preencha as colunas.", "ok");
}

function exportCsv() {
  const delimiter = ";";
  const toCsvCell = (value) => `"${String(value ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
  const headerLine = CSV_COLUMNS.map((column) => toCsvCell(column.header)).join(delimiter);
  const rows = state.computers.map((computer) =>
    CSV_COLUMNS
      .map((column) => {
        const raw = csvValueForExport(column, computer);
        return toCsvCell(raw);
      })
      .join(delimiter)
  );

  downloadCsv(["sep=;", headerLine, ...rows].join("\r\n"), "inventario-computadores.csv");
}

function importCsv(file) {
  const reader = new FileReader();
  reader.onload = async (event) => {
    const text = String(event.target?.result || "");
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) {
      setImportFeedback("CSV sem dados validos.", "error");
      return;
    }

    const startIndex = lines[0].toLowerCase().startsWith("sep=") ? 1 : 0;
    const delimiter = lines[startIndex].includes(";") ? ";" : ",";
    const rawHeaders = parseCsvLine(lines[startIndex], delimiter).map((h) => h.replace(/(^"|"$)/g, "").trim());
    const headers = rawHeaders.map(normalizeCsvHeader);
    const required = CSV_COLUMNS.filter((column) => column.required).map((column) => column.key);
    const missing = required.filter((key) => !headers.includes(key));
    if (missing.length) {
      const expected = CSV_COLUMNS.filter((column) => missing.includes(column.key)).map((column) => column.header);
      setImportFeedback(`CSV invalido. Campos obrigatorios ausentes: ${expected.join(", ")}.`, "error");
      return;
    }

    const imported = lines
      .slice(startIndex + 1)
      .map((line) => {
        const values = parseCsvLine(line, delimiter);
        const row = Object.fromEntries(headers.map((key, idx) => [key, values[idx] || ""]));
        const normalized = {
          owner: row.owner.trim(),
          corporateEmail: row.corporateEmail?.trim().toLowerCase() || "",
          serial: row.serial.trim(),
          machine: row.machine?.trim() || "",
          deviceStatus: ["ativo", "inativo", "pendente"].includes((row.deviceStatus || "").toLowerCase())
            ? row.deviceStatus.toLowerCase()
            : "ativo",
          purchaseDate: row.purchaseDate || "",
          warrantyMonths: Number(row.warrantyMonths || 0),
          cpu: row.cpu?.trim() || "",
          ram: row.ram?.trim() || "",
          gpu: row.gpu?.trim() || "",
          storage: row.storage?.trim() || "",
          storageType: row.storageType?.trim() || "SSD",
          os: row.os?.trim() || "",
          notes: row.notes?.trim() || "",
          warrantyDays: Number(row.warrantyDays || Number(row.warrantyMonths || 0) * 30 || 0),
          specs: row.specs?.trim() || ""
        };
        normalized.specs = normalized.specs || buildSpecs(normalized);
        return normalized;
      })
      .filter((item) => item.owner && item.serial);

    if (!imported.length) {
      setImportFeedback("Nenhuma linha valida encontrada para importar.", "error");
      return;
    }

    if (!state.auth.token) {
      setImportFeedback("Sessao invalida. Faca login novamente.", "error");
      return;
    }

    let successCount = 0;
    let failCount = 0;
    for (const item of imported) {
      try {
        await inventoryService.createComputer(state.auth.token, item);
        successCount += 1;
      } catch (_error) {
        failCount += 1;
      }
    }

    await refreshInventoryData();
    render();
    if (failCount > 0) {
      setImportFeedback(`${successCount} computador(es) importado(s) e ${failCount} linha(s) falharam. Revise os headers e emails corporativos do arquivo.`, "error");
      return;
    }
    setImportFeedback(`${successCount} computador(es) importado(s) com sucesso a partir de ${file.name}.`, "ok");
  };
  reader.readAsText(file, "utf-8");
}

function parseCsvLine(line, delimiter = ",") {
  const values = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function readMockUsers() {
  try {
    const users = JSON.parse(localStorage.getItem(MOCK_USERS_KEY) || "[]");
    return Array.isArray(users) ? users : [];
  } catch (error) {
    return [];
  }
}

function writeMockUsers(users) {
  localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(users));
}

function readMockComputers() {
  try {
    const computers = JSON.parse(localStorage.getItem(MOCK_COMPUTERS_KEY) || "[]");
    return Array.isArray(computers) ? computers : [];
  } catch (error) {
    return [];
  }
}

function writeMockComputers(computers) {
  localStorage.setItem(MOCK_COMPUTERS_KEY, JSON.stringify(computers));
}

function readMockCorporateEmails() {
  try {
    const emails = JSON.parse(localStorage.getItem(MOCK_CORPORATE_EMAILS_KEY) || "[]");
    return Array.isArray(emails) ? emails : [];
  } catch (error) {
    return [];
  }
}

function writeMockCorporateEmails(emails) {
  localStorage.setItem(MOCK_CORPORATE_EMAILS_KEY, JSON.stringify(emails));
}

function readMockComputerMovements() {
  try {
    const movements = JSON.parse(localStorage.getItem(MOCK_COMPUTER_MOVEMENTS_KEY) || "[]");
    return Array.isArray(movements) ? movements : [];
  } catch (error) {
    return [];
  }
}

function writeMockComputerMovements(movements) {
  localStorage.setItem(MOCK_COMPUTER_MOVEMENTS_KEY, JSON.stringify(movements));
}

function buildMockId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function sortByCreatedAtDesc(items) {
  return [...items].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
}

function normalizeMockComputer(payload, existingComputer = null) {
  const createdAt = existingComputer?.createdAt || new Date().toISOString();
  const warrantyMonths = Number(payload.warrantyMonths || 0);
  const warrantyDays = Number(payload.warrantyDays || (warrantyMonths > 0 ? warrantyMonths * 30 : 0));
  const computer = {
    id: existingComputer?.id || buildMockId("pc"),
    owner: String(payload.owner || "").trim(),
    serial: String(payload.serial || "").trim(),
    machine: String(payload.machine || "").trim(),
    deviceStatus: String(payload.deviceStatus || "ativo").trim().toLowerCase(),
    corporateEmail: String(payload.corporateEmail || "").trim().toLowerCase(),
    purchaseDate: String(payload.purchaseDate || "").trim(),
    warrantyMonths,
    warrantyDays,
    cpu: String(payload.cpu || "").trim(),
    ram: String(payload.ram || "").trim(),
    gpu: String(payload.gpu || "").trim(),
    storage: String(payload.storage || "").trim(),
    storageType: String(payload.storageType || "SSD").trim(),
    os: String(payload.os || "").trim(),
    notes: String(payload.notes || "").trim(),
    specs: String(payload.specs || "").trim(),
    createdAt
  };

  if (!["ativo", "inativo", "pendente"].includes(computer.deviceStatus)) {
    computer.deviceStatus = "ativo";
  }

  if (!computer.specs) {
    computer.specs = buildSpecs(computer);
  }

  return computer;
}

function normalizeMockCorporateEmail(email, existingEmail = null) {
  return {
    id: existingEmail?.id || buildMockId("mail"),
    email: String(email || "").trim().toLowerCase(),
    active: true,
    createdAt: existingEmail?.createdAt || new Date().toISOString()
  };
}

function buildMockCorporateEmailsWithCounts() {
  const emails = readMockCorporateEmails();
  const computers = readMockComputers();
  return sortByCreatedAtDesc(
    emails.map((item) => ({
      ...item,
      machineCount: computers.filter((computer) => computer.corporateEmail === item.email).length
    }))
  );
}

function normalizeMockComputerMovement(payload, computer, actorEmail) {
  return {
    id: buildMockId("move"),
    computerId: computer.id,
    movementType: String(payload.movementType || "devolucao").trim().toLowerCase(),
    serial: computer.serial,
    machine: computer.machine,
    previousOwner: computer.owner,
    previousCorporateEmail: computer.corporateEmail || "",
    nextOwner: String(payload.nextOwner || "").trim(),
    nextCorporateEmail: String(payload.nextCorporateEmail || "").trim().toLowerCase(),
    reason: String(payload.reason || "").trim(),
    createdByEmail: actorEmail,
    createdAt: new Date().toISOString()
  };
}

function buildMockToken(email) {
  const safeEmail = btoa(unescape(encodeURIComponent(email)));
  return `mock.${safeEmail}.${Date.now()}`;
}

function decodeMockToken(token) {
  const parts = String(token || "").split(".");
  if (parts.length < 3 || parts[0] !== "mock") return null;
  try {
    return decodeURIComponent(escape(atob(parts[1])));
  } catch (error) {
    return null;
  }
}

const mockAuthService = {
  async login(payload) {
    const email = String(payload.email || "").trim().toLowerCase();
    const password = String(payload.password || "");
    const users = readMockUsers();
    const found = users.find((user) => user.email === email && user.password === password);
    if (!found) {
      throw new Error("Credenciais invalidas.");
    }
    return { token: buildMockToken(email), user: { email } };
  },
  async register(payload) {
    const email = String(payload.email || "").trim().toLowerCase();
    const password = String(payload.password || "");
    const users = readMockUsers();
    const exists = users.some((user) => user.email === email);
    if (exists) {
      throw new Error("Email ja cadastrado.");
    }
    users.push({ email, password });
    writeMockUsers(users);
    return { token: buildMockToken(email), user: { email } };
  },
  async me(token) {
    const email = decodeMockToken(token);
    if (!email) {
      throw new Error("Sessao invalida.");
    }
    return { user: { email } };
  },
  async logout() {
    return true;
  }
};

const mockInventoryService = {
  async listComputers() {
    return sortByCreatedAtDesc(readMockComputers());
  },

  async createComputer(_token, payload) {
    const computers = readMockComputers();
    const corporateEmails = readMockCorporateEmails();
    const serial = String(payload.serial || "").trim().toLowerCase();

    if (computers.some((computer) => String(computer.serial || "").trim().toLowerCase() === serial)) {
      throw new Error("Numero de serie ja cadastrado.");
    }

    if (payload.corporateEmail && !corporateEmails.some((item) => item.email === payload.corporateEmail)) {
      throw new Error("Email corporativo nao autorizado.");
    }

    const computer = normalizeMockComputer(payload);
    computers.push(computer);
    writeMockComputers(computers);
    return computer;
  },

  async updateComputer(_token, id, payload) {
    const computers = readMockComputers();
    const corporateEmails = readMockCorporateEmails();
    const index = computers.findIndex((computer) => computer.id === id);

    if (index < 0) {
      throw new Error("Computador nao encontrado.");
    }

    const serial = String(payload.serial || "").trim().toLowerCase();
    if (computers.some((computer, currentIndex) => currentIndex !== index && String(computer.serial || "").trim().toLowerCase() === serial)) {
      throw new Error("Numero de serie ja cadastrado.");
    }

    if (payload.corporateEmail && !corporateEmails.some((item) => item.email === payload.corporateEmail)) {
      throw new Error("Email corporativo nao autorizado.");
    }

    const updated = normalizeMockComputer(payload, computers[index]);
    computers[index] = updated;
    writeMockComputers(computers);
    return updated;
  },

  async deleteComputer(_token, id) {
    const computers = readMockComputers();
    const filtered = computers.filter((computer) => computer.id !== id);

    if (filtered.length === computers.length) {
      throw new Error("Computador nao encontrado.");
    }

    writeMockComputers(filtered);
    return true;
  },

  async listCorporateEmails() {
    return buildMockCorporateEmailsWithCounts();
  },

  async createCorporateEmail(_token, email) {
    const emails = readMockCorporateEmails();
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (emails.some((item) => item.email === normalizedEmail)) {
      throw new Error("Este email ja foi cadastrado.");
    }

    const created = normalizeMockCorporateEmail(normalizedEmail);
    emails.push(created);
    writeMockCorporateEmails(emails);
    return { ...created, machineCount: 0 };
  },

  async removeCorporateEmail(_token, id) {
    const emails = readMockCorporateEmails();
    const emailToRemove = emails.find((item) => item.id === id);

    if (!emailToRemove) {
      throw new Error("Email nao encontrado.");
    }

    writeMockCorporateEmails(emails.filter((item) => item.id !== id));

    const computers = readMockComputers().map((computer) =>
      computer.corporateEmail === emailToRemove.email
        ? { ...computer, corporateEmail: "" }
        : computer
    );
    writeMockComputers(computers);
    return true;
  },

  async listComputerMovements() {
    return sortByCreatedAtDesc(readMockComputerMovements());
  },

  async createComputerMovement(token, payload) {
    const computers = readMockComputers();
    const corporateEmails = readMockCorporateEmails();
    const computer = computers.find((item) => item.id === payload.computerId);

    if (!computer) {
      throw new Error("Computador nao encontrado.");
    }

    const movementType = String(payload.movementType || "").trim().toLowerCase();
    if (!["devolucao", "troca"].includes(movementType)) {
      throw new Error("Tipo de movimentacao invalido.");
    }

    if (movementType === "troca" && !String(payload.nextOwner || "").trim()) {
      throw new Error("Informe o novo responsavel para a troca.");
    }

    if (payload.nextCorporateEmail && !corporateEmails.some((item) => item.email === payload.nextCorporateEmail)) {
      throw new Error("Email corporativo nao autorizado.");
    }

    const actorEmail = decodeMockToken(token) || "mock@example.com";
    const movement = normalizeMockComputerMovement(payload, computer, actorEmail);
    const updatedComputer = {
      ...computer,
      owner: movementType === "devolucao" ? "Estoque" : movement.nextOwner,
      corporateEmail: movementType === "devolucao" ? "" : movement.nextCorporateEmail,
      deviceStatus: movementType === "devolucao" ? "pendente" : "ativo"
    };

    writeMockComputers(computers.map((item) => item.id === computer.id ? updatedComputer : item));
    const movements = readMockComputerMovements();
    movements.push(movement);
    writeMockComputerMovements(movements);
    return movement;
  }
};

async function apiRequest({ url, method = "GET", body, token }) {
  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const raw = await response.text();
    let data = {};
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch (_error) {
        data = {};
      }
    }

    if (response.ok) {
      return { ok: true, data };
    }

    return {
      ok: false,
      status: response.status,
      message: data.message || `Falha na requisicao (${response.status}).`
    };
  } catch (_error) {
    return {
      ok: false,
      networkError: true,
      message: "Nao foi possivel conectar com a API."
    };
  }
}

async function loadAuthConfig() {
  const result = await apiRequest({
    url: `${AUTH_BASE_URL}/config`,
    method: "GET"
  });

  if (!result.ok) {
    throw new Error(result.message || "Falha ao carregar configuracao de autenticacao.");
  }

  const provider = result.data?.provider === "google" ? "google" : "local";
  state.auth.provider = provider;
  state.auth.googleClientId = provider === "google" ? String(result.data?.googleClientId || "") : "";
  state.auth.corporateEmailDomain = String(result.data?.corporateEmailDomain || "");
}

function canUseMockFallback(result) {
  if (!AUTH_USE_MOCK) return false;
  if (result.networkError) return true;
  return result.status === 404 || result.status === 405 || result.status >= 500;
}

const authService = {
  async login(payload) {
    if (AUTH_USE_MOCK) return mockAuthService.login(payload);
    const apiResult = await apiRequest({
      url: `${AUTH_BASE_URL}/login`,
      method: "POST",
      body: payload
    });
    if (apiResult.ok) return normalizeAuthPayload(apiResult.data);
    if (canUseMockFallback(apiResult)) return mockAuthService.login(payload);
    throw new Error(apiResult.message || "Falha ao autenticar.");
  },
  async register(payload) {
    if (AUTH_USE_MOCK) return mockAuthService.register(payload);
    const apiResult = await apiRequest({
      url: `${AUTH_BASE_URL}/register`,
      method: "POST",
      body: payload
    });
    if (apiResult.ok) return normalizeAuthPayload(apiResult.data);
    if (canUseMockFallback(apiResult)) return mockAuthService.register(payload);
    throw new Error(apiResult.message || "Falha ao cadastrar.");
  },
  async me(token) {
    if (AUTH_USE_MOCK) return mockAuthService.me(token);
    const apiResult = await apiRequest({
      url: `${AUTH_BASE_URL}/me`,
      method: "GET",
      token
    });
    if (apiResult.ok) return normalizeMePayload(apiResult.data);
    if (canUseMockFallback(apiResult)) return mockAuthService.me(token);
    throw new Error(apiResult.message || "Sessao invalida.");
  },
  async logout() {
    if (AUTH_USE_MOCK) {
      await mockAuthService.logout();
      return;
    }
    await mockAuthService.logout();
  },
  async googleLogin(credential) {
    const apiResult = await apiRequest({
      url: `${AUTH_BASE_URL}/google`,
      method: "POST",
      body: { credential }
    });
    if (apiResult.ok) return normalizeAuthPayload(apiResult.data);
    throw new Error(apiResult.message || "Falha ao autenticar com Google.");
  }
};

function normalizeAuthPayload(data) {
  if (!data || typeof data.token !== "string" || !data.user || typeof data.user.email !== "string") {
    throw new Error("Resposta invalida da autenticacao.");
  }
  return {
    token: data.token,
    user: { email: data.user.email, role: data.user.role === "admin" ? "admin" : "member" }
  };
}

function normalizeMePayload(data) {
  if (!data || !data.user || typeof data.user.email !== "string") {
    throw new Error("Sessao invalida.");
  }
  return { user: { email: data.user.email, role: data.user.role === "admin" ? "admin" : "member" } };
}

async function handleGoogleCredentialResponse(response) {
  const credential = String(response?.credential || "").trim();
  if (!credential) {
    setAuthError("Nao foi possivel receber a credencial do Google.");
    return;
  }

  setAuthError("");
  setAuthLoading(true);
  try {
    const result = await authService.googleLogin(credential);
    persistAuthSession(result);
    await refreshInventoryData();
    render();
  } catch (error) {
    clearAuthSession();
    setAuthError(error.message || "Falha ao autenticar com Google.");
  } finally {
    setAuthLoading(false);
    render();
  }
}

function renderGoogleAuth() {
  if (state.auth.provider !== "google") return;
  if (state.auth.isAuthenticated) return;
  if (!state.auth.googleClientId) {
    setAuthError("Google Login nao configurado no servidor.");
    return;
  }
  if (!window.google?.accounts?.id) {
    window.setTimeout(() => {
      if (!state.auth.isAuthenticated) {
        renderGoogleAuth();
      }
    }, 400);
    return;
  }
  if (state.auth.googleInitialized) return;

  window.google.accounts.id.initialize({
    client_id: state.auth.googleClientId,
    callback: handleGoogleCredentialResponse,
    auto_select: false,
    cancel_on_tap_outside: true
  });

  elements.googleSigninButton.innerHTML = "";
  window.google.accounts.id.renderButton(elements.googleSigninButton, {
    type: "standard",
    theme: "outline",
    size: "large",
    text: "signin_with",
    shape: "pill",
    width: 320
  });

  state.auth.googleInitialized = true;
}

const inventoryService = {
  async listComputers(token) {
    if (AUTH_USE_MOCK) return mockInventoryService.listComputers(token);
    const result = await apiRequest({
      url: `${API_BASE_URL}/computers`,
      method: "GET",
      token
    });
    if (!result.ok) {
      throw new Error(result.message || "Falha ao carregar computadores.");
    }
    return Array.isArray(result.data.computers) ? result.data.computers : [];
  },

  async createComputer(token, payload) {
    if (AUTH_USE_MOCK) return mockInventoryService.createComputer(token, payload);
    const result = await apiRequest({
      url: `${API_BASE_URL}/computers`,
      method: "POST",
      token,
      body: payload
    });
    if (!result.ok) {
      throw new Error(result.message || "Falha ao criar computador.");
    }
    return result.data.computer;
  },

  async updateComputer(token, id, payload) {
    if (AUTH_USE_MOCK) return mockInventoryService.updateComputer(token, id, payload);
    const result = await apiRequest({
      url: `${API_BASE_URL}/computers/${encodeURIComponent(id)}`,
      method: "PUT",
      token,
      body: payload
    });
    if (!result.ok) {
      throw new Error(result.message || "Falha ao atualizar computador.");
    }
    return result.data.computer;
  },

  async deleteComputer(token, id) {
    if (AUTH_USE_MOCK) return mockInventoryService.deleteComputer(token, id);
    const result = await apiRequest({
      url: `${API_BASE_URL}/computers/${encodeURIComponent(id)}`,
      method: "DELETE",
      token
    });
    if (!result.ok) {
      throw new Error(result.message || "Falha ao remover computador.");
    }
    return true;
  },

  async listCorporateEmails(token) {
    if (AUTH_USE_MOCK) return mockInventoryService.listCorporateEmails(token);
    const result = await apiRequest({
      url: `${API_BASE_URL}/corporate-emails`,
      method: "GET",
      token
    });
    if (!result.ok) {
      throw new Error(result.message || "Falha ao carregar emails corporativos.");
    }
    return Array.isArray(result.data.emails) ? result.data.emails : [];
  },

  async createCorporateEmail(token, email) {
    if (AUTH_USE_MOCK) return mockInventoryService.createCorporateEmail(token, email);
    const result = await apiRequest({
      url: `${API_BASE_URL}/corporate-emails`,
      method: "POST",
      token,
      body: { email }
    });
    if (!result.ok) {
      throw new Error(result.message || "Falha ao adicionar email corporativo.");
    }
    return result.data.email;
  },

  async removeCorporateEmail(token, id) {
    if (AUTH_USE_MOCK) return mockInventoryService.removeCorporateEmail(token, id);
    const result = await apiRequest({
      url: `${API_BASE_URL}/corporate-emails/${encodeURIComponent(id)}`,
      method: "DELETE",
      token
    });
    if (!result.ok) {
      throw new Error(result.message || "Falha ao remover email corporativo.");
    }
    return true;
  },

  async listComputerMovements(token) {
    if (AUTH_USE_MOCK) return mockInventoryService.listComputerMovements(token);
    const result = await apiRequest({
      url: `${API_BASE_URL}/computer-movements`,
      method: "GET",
      token
    });
    if (!result.ok) {
      throw new Error(result.message || "Falha ao carregar movimentacoes.");
    }
    return Array.isArray(result.data.movements) ? result.data.movements : [];
  },

  async createComputerMovement(token, payload) {
    if (AUTH_USE_MOCK) return mockInventoryService.createComputerMovement(token, payload);
    const result = await apiRequest({
      url: `${API_BASE_URL}/computer-movements`,
      method: "POST",
      token,
      body: payload
    });
    if (!result.ok) {
      throw new Error(result.message || "Falha ao registrar movimentacao.");
    }
    return result.data.movement;
  },

  async listUsers(token) {
    const result = await apiRequest({
      url: `${API_BASE_URL}/users`,
      method: "GET",
      token
    });
    if (!result.ok) {
      throw new Error(result.message || "Falha ao carregar usuarios.");
    }
    return Array.isArray(result.data.users) ? result.data.users : [];
  },

  async updateUserRole(token, id, role) {
    const result = await apiRequest({
      url: `${API_BASE_URL}/users/${encodeURIComponent(id)}/role`,
      method: "PUT",
      token,
      body: { role }
    });
    if (!result.ok) {
      throw new Error(result.message || "Falha ao atualizar permissao.");
    }
    return result.data.user;
  },

  async listAuditLogs(token) {
    const result = await apiRequest({
      url: `${API_BASE_URL}/audit-logs`,
      method: "GET",
      token
    });
    if (!result.ok) {
      throw new Error(result.message || "Falha ao carregar historico.");
    }
    return Array.isArray(result.data.logs) ? result.data.logs : [];
  }
};

async function refreshInventoryData() {
  if (!state.auth.isAuthenticated || !state.auth.token) {
    state.computers = [];
    state.corporateEmails = [];
    state.computerMovements = [];
    state.users = [];
    state.auditLogs = [];
    return;
  }

  // Carregamento em paralelo para reduzir tempo de espera apos login e refresh.
  const promises = [
    inventoryService.listComputers(state.auth.token),
    inventoryService.listCorporateEmails(state.auth.token),
    inventoryService.listComputerMovements(state.auth.token)
  ];

  if (isAdmin()) {
    promises.push(inventoryService.listUsers(state.auth.token));
  }
  promises.push(inventoryService.listAuditLogs(state.auth.token));

  const [computers, corporateEmails, computerMovements, maybeUsersOrLogs, maybeLogs] = await Promise.all(promises);

  state.computers = computers;
  state.corporateEmails = corporateEmails;
  state.computerMovements = computerMovements;
  state.users = isAdmin() ? maybeUsersOrLogs : [];
  state.auditLogs = isAdmin() ? maybeLogs : maybeUsersOrLogs;
}

async function validateExistingSession() {
  if (!state.auth.token) {
    state.auth.isAuthenticated = false;
    return;
  }
  try {
    setAuthLoading(true);
    const result = await authService.me(state.auth.token);
    state.auth.user = result.user;
    state.auth.isAuthenticated = true;
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(result.user));
  } catch (error) {
    clearAuthSession();
    setAuthMode("login");
  } finally {
    setAuthLoading(false);
  }
}

async function submitAuth(mode, formElement) {
  const formData = new FormData(formElement);
  const payload = {
    email: String(formData.get("email") || "").trim(),
    password: String(formData.get("password") || "")
  };

  setAuthError("");
  setAuthLoading(true);
  try {
    let result;
    if (mode === "login") {
      result = await authService.login(payload);
    } else {
      result = await authService.register(payload);
    }
    persistAuthSession(result);
    await refreshInventoryData();
    formElement.reset();
    render();
  } catch (error) {
    setAuthError(error.message || "Falha na autenticacao.");
  } finally {
    setAuthLoading(false);
    render();
  }
}

async function logout() {
  await authService.logout();
  if (window.google?.accounts?.id) {
    window.google.accounts.id.disableAutoSelect();
  }
  clearAuthSession();
  state.computers = [];
  state.corporateEmails = [];
  state.computerMovements = [];
  state.users = [];
  state.auditLogs = [];
  closeModal();
  setAuthMode("login");
  setAuthError("");
  setPermissionsFeedback("");
  setMovementFeedback("");
  setImportFeedback("");
  render();
}

function bindEvents() {
  elements.navButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (!state.auth.isAuthenticated) return;
      state.currentView = button.dataset.nav;
      setCorporateFeedback("");
      setMovementFeedback("");
      setPermissionsFeedback("");
      setImportFeedback("");
      render();
    });
  });

  document.getElementById("go-computers").addEventListener("click", () => {
    if (!state.auth.isAuthenticated) return;
    state.currentView = "computadores";
    render();
  });

  document.querySelectorAll("#new-from-dashboard, #new-from-table, #floating-add").forEach((button) => {
    button.addEventListener("click", () => openModal());
  });

  document.getElementById("close-modal").addEventListener("click", closeModal);
  document.getElementById("cancel-modal").addEventListener("click", closeModal);
  elements.modalLayer.addEventListener("click", (event) => {
    if (event.target === elements.modalLayer) closeModal();
  });

  elements.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.auth.isAuthenticated) return;
    const data = new FormData(elements.form);
    try {
      await upsertComputer(data);
      closeModal();
      render();
    } catch (error) {
      window.alert(error.message || "Falha ao salvar computador.");
    }
  });

  elements.filterSearch.addEventListener("input", (event) => {
    state.searchTerm = event.target.value;
    renderTable();
  });

  elements.filterStatus.addEventListener("change", (event) => {
    state.statusFilter = event.target.value;
    renderTable();
  });

  elements.corporateEmailForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.auth.isAuthenticated) return;
    try {
      await addCorporateEmail(elements.corporateEmailInput.value);
      elements.corporateEmailForm.reset();
      setCorporateFeedback("Email corporativo adicionado com sucesso.");
      render();
    } catch (error) {
      setCorporateFeedback(error.message || "Falha ao adicionar email.", "error");
    }
  });

  elements.corporateEmailTableBody.addEventListener("click", async (event) => {
    if (!state.auth.isAuthenticated) return;
    const button = event.target.closest("button[data-email-action='delete']");
    if (!button) return;
    try {
      await removeCorporateEmail(button.dataset.id);
      setCorporateFeedback("Email corporativo removido.");
      render();
    } catch (error) {
      setCorporateFeedback(error.message || "Falha ao remover email.", "error");
    }
  });

  elements.usersTableBody.addEventListener("click", async (event) => {
    if (!state.auth.isAuthenticated || !isAdmin()) return;
    const button = event.target.closest("button[data-user-action]");
    if (!button) return;

    const role = button.dataset.userAction === "make-admin" ? "admin" : "member";
    try {
      await inventoryService.updateUserRole(state.auth.token, button.dataset.id, role);
      setPermissionsFeedback(`Permissão atualizada para ${roleLabel(role)}.`, "ok");
      await refreshInventoryData();
      render();
    } catch (error) {
      setPermissionsFeedback(error.message || "Falha ao atualizar permissao.", "error");
    }
  });

  elements.movementComputer.addEventListener("change", () => {
    setMovementFeedback("");
    syncMovementForm();
  });

  elements.movementType.addEventListener("change", () => {
    setMovementFeedback("");
    syncMovementForm();
  });

  elements.movementForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.auth.isAuthenticated) return;
    try {
      await createComputerMovement(new FormData(elements.movementForm));
      elements.movementForm.reset();
      setMovementFeedback("Movimentacao registrada com sucesso.", "ok");
      render();
    } catch (error) {
      setMovementFeedback(error.message || "Falha ao registrar movimentacao.", "error");
    }
  });

  elements.tableBody.addEventListener("click", async (event) => {
    if (!state.auth.isAuthenticated) return;
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const { action, id } = button.dataset;
    if (action === "view") viewComputer(id);
    if (action === "edit") {
      const computer = state.computers.find((item) => item.id === id);
      if (computer) openModal(computer);
    }
    if (action === "delete") {
      try {
        await deleteComputer(id);
      } catch (error) {
        window.alert(error.message || "Falha ao remover computador.");
      }
    }
  });

  document.getElementById("export-csv").addEventListener("click", () => {
    if (!state.auth.isAuthenticated) return;
    exportCsv();
  });
  document.getElementById("export-pdf").addEventListener("click", () => {
    if (!state.auth.isAuthenticated) return;
    window.print();
  });
  elements.importInput.addEventListener("change", (event) => {
    if (!state.auth.isAuthenticated) return;
    const file = event.target.files?.[0];
    if (!file) return;
    setImportFeedback(`Importando ${file.name}...`, "ok");
    importCsv(file);
    event.target.value = "";
  });

  elements.downloadCsvTemplate.addEventListener("click", () => {
    if (!state.auth.isAuthenticated) return;
    downloadCsvTemplate();
  });

  elements.authTabLogin.addEventListener("click", () => setAuthMode("login"));
  elements.authTabRegister.addEventListener("click", () => setAuthMode("register"));

  elements.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await submitAuth("login", elements.loginForm);
  });

  elements.registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await submitAuth("register", elements.registerForm);
  });

  elements.themeToggle.addEventListener("click", toggleTheme);
  elements.logoutButton.addEventListener("click", logout);
}

async function bootstrap() {
  applyTheme();
  try {
    await loadAuthConfig();
  } catch (error) {
    setAuthError(error.message || "Falha ao carregar autenticacao.");
  }
  bindEvents();
  setAuthMode("login");
  await validateExistingSession();
  if (state.auth.isAuthenticated) {
    try {
      await refreshInventoryData();
    } catch (error) {
      clearAuthSession();
      setAuthError(error.message || "Falha ao carregar dados da API.");
    }
  }
  render();
}

bootstrap();



