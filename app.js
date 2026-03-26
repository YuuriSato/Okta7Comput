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

// Cache central de elementos para evitar queries repetidas no DOM.
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
  importSection: document.getElementById("computer-import-section"),
  computerTemplateSection: document.getElementById("computer-template-section"),
  computerTemplateHelp: document.getElementById("computer-template-help"),
  computerTemplateSelect: document.getElementById("computer-template-select"),
  purchaseDateUnknown: document.getElementById("purchase-date-unknown"),
  warrantyMonthsUnknown: document.getElementById("warranty-months-unknown"),
  tableBody: document.getElementById("table-body"),
  tableCount: document.getElementById("table-count"),
  filterSearch: document.getElementById("filter-search"),
  filterStatus: document.getElementById("filter-status"),
  metricTotal: document.getElementById("metric-total"),
  metricActive: document.getElementById("metric-active"),
  metricSoon: document.getElementById("metric-soon"),
  metricExpired: document.getElementById("metric-expired"),
  commonSpecs: document.getElementById("common-specs"),
  deviceStatusChart: document.getElementById("device-status-chart"),
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
  movementCurrentCompany: document.getElementById("movement-current-company"),
  movementCurrentEmail: document.getElementById("movement-current-email"),
  movementTargetFields: document.getElementById("movement-target-fields"),
  movementNextOwner: document.getElementById("movement-next-owner"),
  movementNextCompany: document.getElementById("movement-next-company"),
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
  goComputers: document.getElementById("go-computers"),
  newFromDashboard: document.getElementById("new-from-dashboard"),
  newFromTable: document.getElementById("new-from-table"),
  floatingAdd: document.getElementById("floating-add"),
  exportCsv: document.getElementById("export-csv"),
  exportPdf: document.getElementById("export-pdf"),
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

function normalizeComputerPermissions(rawPermissions = {}, role = "member") {
  if (role === "admin") {
    return { create: true, edit: true, delete: true };
  }

  const source = rawPermissions?.computers || rawPermissions || {};
  return {
    create: source.create !== false,
    edit: source.edit !== false,
    delete: source.delete !== false
  };
}

function normalizeUser(user) {
  if (!user || typeof user.email !== "string") return null;
  const role = user.role === "admin" ? "admin" : "member";
  return {
    email: user.email,
    role,
    permissions: {
      computers: normalizeComputerPermissions(user.permissions, role)
    }
  };
}

// Recupera a sessao persistida e normaliza o papel para evitar valores inesperados.
function loadUser() {
  try {
    const user = JSON.parse(localStorage.getItem(AUTH_USER_KEY) || "null");
    return normalizeUser(user);
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

function describeDeviceStatus(status) {
  if (status === "inativo") return { label: "Inativo", color: "#64748b", bg: "bg-slate-100", text: "text-slate-700" };
  if (status === "pendente") return { label: "Pendente", color: "#f59e0b", bg: "bg-amber-50", text: "text-amber-700" };
  return { label: "Ativo", color: "#10b981", bg: "bg-emerald-50", text: "text-emerald-700" };
}

function persistAuthSession(payload) {
  state.auth.user = normalizeUser(payload.user);
  state.auth.token = payload.token;
  state.auth.isAuthenticated = true;
  localStorage.setItem(AUTH_TOKEN_KEY, payload.token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(state.auth.user));
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

function parseOptionalNonNegativeNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function getRemainingDays(computer) {
  const warrantyMonths = parseOptionalNonNegativeNumber(computer.warrantyMonths);
  const warrantyDays = parseOptionalNonNegativeNumber(computer.warrantyDays) ?? 0;
  // Preferimos a data de compra quando existe; o fallback por createdAt cobre cadastros legados.
  if (computer.purchaseDate && warrantyMonths !== null) {
    const startDate = new Date(computer.purchaseDate);
    if (!Number.isNaN(startDate.getTime())) {
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + warrantyMonths);
      return Math.ceil((endDate.getTime() - Date.now()) / 86400000);
    }
  }

  if (!warrantyDays) {
    return null;
  }

  const createdAtMs = new Date(computer.createdAt || Date.now()).getTime();
  if (Number.isNaN(createdAtMs)) {
    return warrantyDays;
  }
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - createdAtMs) / 86400000);
  return warrantyDays - diffDays;
}

function getWarrantyStatus(computer) {
  const remaining = getRemainingDays(computer);
  if (remaining === null) return "nao_informada";
  if (remaining <= 0) return "vencida";
  if (remaining <= 30) return "proxima";
  return "ativa";
}

function statusBadge(status) {
  if (status === "nao_informada") {
    return '<span class="inline-flex rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Nao informada</span>';
  }
  if (status === "ativa") {
    return '<span class="inline-flex rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Ativa</span>';
  }
  if (status === "proxima") {
    return '<span class="inline-flex rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">Proxima</span>';
  }
  return '<span class="inline-flex rounded-full border border-rose-300 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">Vencida</span>';
}

function formatRemaining(remaining) {
  if (remaining === null) return "Nao informado";
  if (remaining <= 0) return "Sem cobertura";
  if (remaining === 1) return "1 dia";
  return `${remaining} dias`;
}

function formatWarrantyMonthsLabel(value) {
  const warrantyMonths = parseOptionalNonNegativeNumber(value);
  if (warrantyMonths === null) return "Nao informada";
  return `${warrantyMonths} meses`;
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

function renderComputerTemplateOptions(selectedId = "") {
  const options = ['<option value="">Preencher manualmente</option>'];
  const templates = [...state.computers].sort((a, b) => {
    const machineCompare = String(a.machine || "").localeCompare(String(b.machine || ""), "pt-BR");
    if (machineCompare !== 0) return machineCompare;
    return String(a.serial || "").localeCompare(String(b.serial || ""), "pt-BR");
  });

  templates.forEach((computer) => {
    const selected = computer.id === selectedId ? "selected" : "";
    const model = computer.machine || "Modelo sem nome";
    const owner = computer.owner || "Sem responsável";
    options.push(
      `<option value="${escapeHtml(computer.id)}" ${selected}>${escapeHtml(model)} - ${escapeHtml(computer.serial || "Sem série")} - ${escapeHtml(owner)}</option>`
    );
  });

  const hasTemplates = templates.length > 0;
  elements.computerTemplateSelect.innerHTML = options.join("");
  elements.computerTemplateSelect.disabled = !hasTemplates;
  elements.computerTemplateHelp.textContent = hasTemplates
    ? "Selecione um computador já cadastrado para reaproveitar as informações e trocar apenas o número de série."
    : "Cadastre o primeiro computador manualmente para liberar a cópia de informações nos próximos cadastros.";
}

function renderMovementComputerOptions(selectedId = "") {
  const options = ['<option value="">Selecione um computador</option>'];
  state.computers.forEach((computer) => {
    const selected = computer.id === selectedId ? "selected" : "";
    options.push(
      `<option value="${escapeHtml(computer.id)}" ${selected}>${escapeHtml(computer.serial)} - ${escapeHtml(computer.owner || "Sem responsável")}${computer.company ? ` (${escapeHtml(computer.company)})` : ""}</option>`
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

// A troca exige novos dados de destino; a devolucao limpa os campos porque o ativo volta ao estoque.
function syncMovementForm() {
  const selectedComputer = state.computers.find((item) => item.id === elements.movementComputer.value);
  const movementType = String(elements.movementType.value || "devolucao").toLowerCase();
  const isExchange = movementType === "troca";

  elements.movementCurrentOwner.textContent = selectedComputer?.owner || "-";
  elements.movementCurrentCompany.textContent = selectedComputer?.company || "-";
  elements.movementCurrentEmail.textContent = selectedComputer?.corporateEmail || "-";
  elements.movementTargetFields.classList.toggle("opacity-70", !isExchange);
  elements.movementNextOwner.disabled = !isExchange;
  elements.movementNextCompany.disabled = !isExchange;
  elements.movementNextEmail.disabled = !isExchange;
  elements.movementNextOwner.required = isExchange;

  if (!isExchange) {
    elements.movementNextOwner.value = "";
    elements.movementNextCompany.value = "";
    elements.movementNextEmail.value = "";
  }
}

function isAdmin() {
  return state.auth.user?.role === "admin";
}

function currentComputerPermissions(user = state.auth.user) {
  if (!user) {
    return { create: false, edit: false, delete: false };
  }
  return normalizeComputerPermissions(user?.permissions, user?.role || "member");
}

function canCreateComputers(user = state.auth.user) {
  return currentComputerPermissions(user).create;
}

function canEditComputers(user = state.auth.user) {
  return currentComputerPermissions(user).edit;
}

function canDeleteComputers(user = state.auth.user) {
  return currentComputerPermissions(user).delete;
}

function isComputerReadOnly(user) {
  const permissions = currentComputerPermissions(user);
  return !permissions.create && !permissions.edit && !permissions.delete;
}

function computerAccessSummary(user) {
  if (user?.role === "admin") return "Acesso total";
  if (isComputerReadOnly(user)) return "Somente leitura";
  return "Personalizado";
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
    const joined = `${computer.serial} ${computer.owner} ${computer.company || ""} ${computer.corporateEmail || ""} ${computer.specs} ${computer.machine}`.toLowerCase();
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
  const deviceStatusTotals = ["ativo", "pendente", "inativo"].map((status) => ({
    status,
    count: all.filter((item) => (item.deviceStatus || "ativo") === status).length,
    ...describeDeviceStatus(status)
  }));
  const chartTotal = deviceStatusTotals.reduce((acc, item) => acc + item.count, 0);

  elements.metricTotal.textContent = all.length;
  elements.metricActive.textContent = active;
  elements.metricSoon.textContent = soon;
  elements.metricExpired.textContent = expired;

  if (!chartTotal) {
    elements.deviceStatusChart.innerHTML = "<p class='text-slate-500'>Nenhum equipamento cadastrado para gerar o gráfico.</p>";
  } else {
    // O grafico circular eh montado manualmente em SVG para nao depender de biblioteca externa.
    const radius = 70;
    const circumference = 2 * Math.PI * radius;
    let offsetAccumulator = 0;
    const segments = deviceStatusTotals
      .filter((item) => item.count > 0)
      .map((item) => {
        const value = item.count / chartTotal;
        const dash = Math.max(0, circumference * value);
        const segment = `
          <circle
            cx="90"
            cy="90"
            r="${radius}"
            fill="none"
            stroke="${item.color}"
            stroke-width="18"
            stroke-dasharray="${dash} ${circumference - dash}"
            stroke-dashoffset="${-offsetAccumulator}"
            stroke-linecap="round"
            transform="rotate(-90 90 90)"
          ></circle>
        `;
        offsetAccumulator += dash;
        return segment;
      })
      .join("");

    elements.deviceStatusChart.innerHTML = `
      <!-- Grid do card analitico: grafico circular em destaque e legenda detalhada ao lado. -->
      <div class="grid gap-5 lg:grid-cols-[200px_minmax(0,1fr)] lg:items-center">
        <div class="flex justify-center">
          <!-- Miolo do grafico: aro SVG com o total absoluto sobreposto no centro. -->
          <div class="relative flex h-[220px] w-[220px] items-center justify-center rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
            <svg viewBox="0 0 180 180" class="h-[180px] w-[180px]">
              <circle cx="90" cy="90" r="${radius}" fill="none" stroke="#e2e8f0" stroke-width="18"></circle>
              ${segments}
            </svg>
            <!-- Resumo central para leitura rapida sem depender da legenda lateral. -->
            <div class="absolute text-center">
              <p class="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Total</p>
              <p class="mt-1 text-4xl font-extrabold text-slate-900">${chartTotal}</p>
              <p class="text-xs text-slate-500">equipamentos</p>
            </div>
          </div>
        </div>
        <!-- Lista de cards por status com contagem e barra proporcional. -->
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          ${deviceStatusTotals.map((item) => {
            const percentage = chartTotal ? Math.round((item.count / chartTotal) * 100) : 0;
            return `
              <div class="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="h-3 w-3 rounded-full" style="background:${item.color}"></span>
                      <p class="text-sm font-semibold text-slate-900">${item.label}</p>
                    </div>
                    <p class="mt-1 text-xs text-slate-500">${percentage}% do parque atual</p>
                  </div>
                  <span class="rounded-full ${item.bg} px-3 py-1 text-sm font-semibold ${item.text}">${item.count}</span>
                </div>
                <div class="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div class="h-full rounded-full" style="width:${percentage}%; background:${item.color}"></div>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

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
  // Cada linha combina rótulo, barra e contagem para deixar o comparativo compacto no dashboard.
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
      const actions = [
        `<button data-action="view" data-id="${computer.id}" class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-100">Ver</button>`
      ];
      if (canEditComputers()) {
        actions.push(`<button data-action="edit" data-id="${computer.id}" class="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100">Editar</button>`);
      }
      if (canDeleteComputers()) {
        actions.push(`<button data-action="delete" data-id="${computer.id}" class="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100">Deletar</button>`);
      }
      return `
        <tr class="hover:bg-slate-50/80">
          <td class="px-4 py-4 font-semibold">${escapeHtml(computer.serial)}</td>
          <td class="px-4 py-4">
            <div class="space-y-1">
              <p>${escapeHtml(computer.owner)}</p>
              <p class="text-xs text-slate-500">${escapeHtml(computer.company || "-")}</p>
            </div>
          </td>
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
              ${actions.join("")}
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
  // O botao de reversao so aparece ativo para a movimentacao mais recente de cada computador.
  const latestByComputerId = new Map();
  rows.forEach((movement) => {
    if (!latestByComputerId.has(movement.computerId)) {
      latestByComputerId.set(movement.computerId, movement.id);
    }
  });
  elements.movementCount.textContent = `${rows.length} movimentação(ões)`;

  if (!rows.length) {
    elements.movementTableBody.innerHTML = `
      <tr>
        <td colspan="8" class="px-4 py-8 text-center text-slate-500">Nenhuma movimentação registrada.</td>
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
          <p class="text-xs text-slate-500">${escapeHtml(movement.previousCompany || "-")}</p>
          <p class="text-xs text-slate-500">${escapeHtml(movement.previousCorporateEmail || "-")}</p>
        </div>
      </td>
      <td class="px-4 py-4">
        <div class="space-y-1">
          <p>${escapeHtml(movement.nextOwner || (movement.movementType === "devolucao" ? "Estoque" : "-"))}</p>
          <p class="text-xs text-slate-500">${escapeHtml(movement.nextCompany || "-")}</p>
          <p class="text-xs text-slate-500">${escapeHtml(movement.nextCorporateEmail || "-")}</p>
        </div>
      </td>
      <td class="px-4 py-4">${escapeHtml(movement.reason || "-")}</td>
      <td class="px-4 py-4">${escapeHtml(movement.createdByEmail || "-")}</td>
      <td class="px-4 py-4">
        <div class="flex justify-end gap-2">
          <button data-movement-action="delete" data-id="${movement.id}" class="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100">Excluir</button>
          <button data-movement-action="revert" data-id="${movement.id}" class="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100" ${latestByComputerId.get(movement.computerId) !== movement.id ? "disabled title=\"Reverta apenas a ultima movimentacao deste computador\"" : ""}>Reverter</button>
        </div>
      </td>
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
        <td colspan="7" class="px-4 py-8 text-center text-slate-500">Somente administradores podem gerenciar permissões.</td>
      </tr>
    `;
    return;
  }

  if (!rows.length) {
    elements.usersTableBody.innerHTML = `
      <tr>
        <td colspan="7" class="px-4 py-8 text-center text-slate-500">Nenhum usuário encontrado.</td>
      </tr>
    `;
    return;
  }

  elements.usersTableBody.innerHTML = rows.map((user) => `
    <tr class="hover:bg-slate-50/80">
      <td class="px-4 py-4">
        <div class="space-y-1">
          <p class="font-medium">${escapeHtml(user.email)}</p>
          <p class="text-xs text-slate-500">Provedor: ${escapeHtml(providerLabel(user.authProvider))}</p>
          <p class="text-xs text-slate-500">Cadastro: ${formatDate(user.createdAt)}</p>
        </div>
      </td>
      <td class="px-4 py-4">${roleBadge(user.role)}</td>
      <td class="px-4 py-4">
        <div class="space-y-2">
          ${activeBadge(user.active)}
          <p class="text-xs font-medium text-slate-500">${escapeHtml(computerAccessSummary(user))}</p>
        </div>
      </td>
      <td class="px-4 py-4 text-center">
        <input data-permission-input="create" data-id="${user.id}" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-200" ${currentComputerPermissions(user).create ? "checked" : ""} ${user.role === "admin" ? "disabled" : ""} />
      </td>
      <td class="px-4 py-4 text-center">
        <input data-permission-input="edit" data-id="${user.id}" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-200" ${currentComputerPermissions(user).edit ? "checked" : ""} ${user.role === "admin" ? "disabled" : ""} />
      </td>
      <td class="px-4 py-4 text-center">
        <input data-permission-input="delete" data-id="${user.id}" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-200" ${currentComputerPermissions(user).delete ? "checked" : ""} ${user.role === "admin" ? "disabled" : ""} />
      </td>
      <td class="px-4 py-4 text-right">
        <div class="flex justify-end gap-2">
          <button data-user-action="make-member" data-id="${user.id}" class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-100" ${user.role !== "admin" ? "disabled" : ""}>Tornar Membro</button>
          <button data-user-action="make-admin" data-id="${user.id}" class="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100" ${user.role === "admin" ? "disabled" : ""}>Tornar Admin</button>
          <button data-user-action="save-computer-permissions" data-id="${user.id}" class="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100" ${user.role === "admin" ? "disabled" : ""}>Salvar Acessos</button>
        </div>
      </td>
    </tr>
  `).join("");
}

function applyComputerPermissionUI() {
  const canCreate = state.auth.isAuthenticated && canCreateComputers();
  elements.newFromDashboard.classList.toggle("hidden", !canCreate);
  elements.newFromTable.classList.toggle("hidden", !canCreate);
  elements.floatingAdd.classList.toggle("hidden", !canCreate);
  elements.importSection.classList.toggle("hidden", !canCreate);
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
  applyComputerPermissionUI();
}

function fillComputerForm(computer = null, options = {}) {
  const values = {
    owner: computer?.owner || "",
    company: computer?.company || "",
    serial: computer?.serial || "",
    machine: computer?.machine || "",
    purchaseDate: computer?.purchaseDate || "",
    warrantyMonths: computer?.warrantyMonths ?? "",
    cpu: computer?.cpu || "",
    ram: computer?.ram || "",
    gpu: computer?.gpu || "",
    storage: computer?.storage || "",
    storageType: computer?.storageType || "SSD",
    deviceStatus: computer?.deviceStatus || "ativo",
    corporateEmail: computer?.corporateEmail || "",
    os: computer?.os || "",
    machinePassword: computer?.machinePassword || "",
    notes: computer?.notes || "",
    ...options
  };

  renderCorporateEmailOptions(values.corporateEmail);
  elements.form.owner.value = values.owner;
  elements.form.company.value = values.company;
  elements.form.serial.value = values.serial;
  elements.form.machine.value = values.machine;
  elements.form.purchaseDate.value = values.purchaseDate;
  elements.form.warrantyMonths.value = values.warrantyMonths;
  elements.form.cpu.value = values.cpu;
  elements.form.ram.value = values.ram;
  elements.form.gpu.value = values.gpu;
  elements.form.storage.value = values.storage;
  elements.form.storageType.value = values.storageType;
  elements.form.deviceStatus.value = values.deviceStatus;
  elements.form.corporateEmail.value = values.corporateEmail;
  elements.form.os.value = values.os;
  elements.form.machinePassword.value = values.machinePassword;
  elements.form.notes.value = values.notes;
  elements.purchaseDateUnknown.checked = !values.purchaseDate;
  elements.warrantyMonthsUnknown.checked = values.warrantyMonths === null || values.warrantyMonths === "";
  syncComputerOptionalFields();
}

function applyComputerTemplate(templateId) {
  const template = state.computers.find((item) => item.id === templateId);
  if (!template || state.editingId) return;

  fillComputerForm(template, { serial: "" });
  elements.form.serial.focus();
}

function syncComputerOptionalFields() {
  const purchaseDateUnknown = elements.purchaseDateUnknown.checked;
  const warrantyMonthsUnknown = elements.warrantyMonthsUnknown.checked;

  elements.form.purchaseDate.disabled = purchaseDateUnknown;
  elements.form.warrantyMonths.disabled = warrantyMonthsUnknown;

  if (purchaseDateUnknown) {
    elements.form.purchaseDate.value = "";
  }
  if (warrantyMonthsUnknown) {
    elements.form.warrantyMonths.value = "";
  }
}

function openModal(computer = null) {
  if (!state.auth.isAuthenticated) return;
  if (computer && !canEditComputers()) return;
  if (!computer && !canCreateComputers()) return;
  state.editingId = computer ? computer.id : null;
  renderComputerTemplateOptions();
  elements.computerTemplateSection.classList.toggle("hidden", Boolean(computer));
  elements.computerTemplateSelect.value = "";
  elements.modalTitle.textContent = computer ? "Editar Computador" : "Adicionar Novo Computador";
  fillComputerForm(computer);
  if (!computer) {
    elements.purchaseDateUnknown.checked = false;
    elements.warrantyMonthsUnknown.checked = false;
    syncComputerOptionalFields();
  }
  elements.modalLayer.classList.remove("hidden");
  elements.modalLayer.classList.add("flex");
  if (!computer) {
    elements.form.serial.focus();
  }
}

function closeModal() {
  state.editingId = null;
  elements.form.reset();
  elements.computerTemplateSelect.value = "";
  elements.computerTemplateSection.classList.remove("hidden");
  syncComputerOptionalFields();
  elements.modalLayer.classList.add("hidden");
  elements.modalLayer.classList.remove("flex");
}

async function upsertComputer(formData) {
  if (state.editingId && !canEditComputers()) {
    throw new Error("Voce nao tem permissao para editar computadores.");
  }
  if (!state.editingId && !canCreateComputers()) {
    throw new Error("Voce nao tem permissao para cadastrar computadores.");
  }
  const rawWarrantyMonths = String(formData.get("warrantyMonths") || "").trim();
  const warrantyMonths = elements.warrantyMonthsUnknown.checked || !rawWarrantyMonths
    ? null
    : parseOptionalNonNegativeNumber(rawWarrantyMonths);
  const payload = {
    owner: formData.get("owner").trim(),
    company: String(formData.get("company") || "").trim(),
    serial: formData.get("serial").trim(),
    machine: formData.get("machine").trim(),
    purchaseDate: elements.purchaseDateUnknown.checked ? "" : String(formData.get("purchaseDate") || "").trim(),
    warrantyMonths,
    cpu: formData.get("cpu").trim(),
    ram: formData.get("ram").trim(),
    gpu: formData.get("gpu").trim(),
    storage: formData.get("storage").trim(),
    storageType: formData.get("storageType").trim(),
    deviceStatus: String(formData.get("deviceStatus") || "ativo"),
    corporateEmail: String(formData.get("corporateEmail") || "").trim().toLowerCase(),
    os: formData.get("os").trim(),
    machinePassword: String(formData.get("machinePassword") || "").trim(),
    notes: formData.get("notes").trim()
  };
  payload.warrantyDays = !payload.purchaseDate || payload.warrantyMonths === null
    ? 0
    : payload.warrantyMonths * 30;
  payload.specs = buildSpecs(payload);

  if (!payload.owner || !payload.serial) {
    throw new Error("Dono e numero de serie sao obrigatorios.");
  }
  if (!elements.warrantyMonthsUnknown.checked && rawWarrantyMonths && payload.warrantyMonths === null) {
    throw new Error("Informe um tempo de garantia valido ou marque como nao informado.");
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
    nextCompany: String(formData.get("nextCompany") || "").trim(),
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
    payload.nextCompany = "";
    payload.nextCorporateEmail = "";
  }

  await inventoryService.createComputerMovement(state.auth.token, payload);
  await refreshInventoryData();
}

async function deleteComputerMovement(id) {
  if (!state.auth.token) {
    throw new Error("Sessao invalida. Faca login novamente.");
  }

  const confirmed = window.confirm("Deseja excluir este registro de movimentacao? O estado atual do computador nao sera alterado.");
  if (!confirmed) return false;

  await inventoryService.deleteComputerMovement(state.auth.token, id);
  await refreshInventoryData();
  return true;
}

async function revertComputerMovement(id) {
  if (!state.auth.token) {
    throw new Error("Sessao invalida. Faca login novamente.");
  }

  const confirmed = window.confirm("Deseja reverter esta movimentacao e restaurar o computador para o estado anterior?");
  if (!confirmed) return false;

  await inventoryService.revertComputerMovement(state.auth.token, id);
  await refreshInventoryData();
  return true;
}

function viewComputer(id) {
  const computer = state.computers.find((item) => item.id === id);
  if (!computer) return;
  const remaining = getRemainingDays(computer);
  window.alert(
    `Dono: ${computer.owner}\nEmpresa atual: ${computer.company || "-"}\nEmail corporativo: ${computer.corporateEmail || "-"}\nSerie: ${computer.serial}\nMaquina: ${computer.machine || "-"}\nStatus: ${statusLabel(computer.deviceStatus)}\nData de compra: ${computer.purchaseDate || "Nao informada"}\nGarantia: ${formatWarrantyMonthsLabel(computer.warrantyMonths)}\nRestante: ${formatRemaining(remaining)}\nCPU: ${computer.cpu || "-"}\nRAM: ${computer.ram || "-"}\nGPU: ${computer.gpu || "-"}\nArmazenamento: ${computer.storage || "-"} ${computer.storageType || ""}\nSO: ${computer.os || "-"}\nSenha da maquina: ${computer.machinePassword || "-"}\nObservacoes: ${computer.notes || "-"}`
  );
}

async function deleteComputer(id) {
  if (!canDeleteComputers()) {
    throw new Error("Voce nao tem permissao para excluir computadores.");
  }
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
  { key: "owner", header: "dono", required: true, aliases: ["owner"], example: "Maria Silva", width: 24 },
  { key: "company", header: "empresa_atual", aliases: ["empresa", "company", "empresaatual"], example: "Cliente XPTO", width: 22 },
  { key: "corporateEmail", header: "email_corporativo", aliases: ["emailcorporativo", "corporateemail"], example: "maria@okta7.com.br", width: 28 },
  { key: "serial", header: "numero_serie", required: true, aliases: ["serial", "numerodeserie"], example: "SN-001", width: 20 },
  { key: "machine", header: "modelo", aliases: ["maquina", "machine", "maquinamodelo"], example: "Dell Latitude 5440", width: 26 },
  { key: "deviceStatus", header: "status", aliases: ["devicestatus"], example: "ativo", width: 14 },
  { key: "purchaseDate", header: "data_compra", aliases: ["datacompra", "datadecompra", "purchasedate"], example: "2026-03-16", width: 16 },
  { key: "warrantyMonths", header: "garantia_meses", aliases: ["garantiameses", "warrantymonths"], example: "12", width: 16 },
  { key: "storage", header: "armazenamento", aliases: ["storage"], example: "512 GB", width: 18 },
  { key: "storageType", header: "tipo_armazenamento", aliases: ["storagetype", "tipodearmazenamento"], example: "SSD", width: 18 },
  { key: "os", header: "sistema_operacional", aliases: ["sistemaoperacional", "operatingsystem", "os"], example: "Windows 11 Pro", width: 22 },
  { key: "machinePassword", header: "senha_maquina", aliases: ["senhadamaquina", "machinepassword", "localpassword"], example: "Senha@123", width: 20 },
  { key: "notes", header: "observacoes", aliases: ["notes"], example: "Notebook do comercial", width: 28 },
  { key: "warrantyDays", header: "garantia_dias", aliases: ["garantiadias", "warrantydays"], example: "360", width: 16 },
  { key: "specs", header: "specs", aliases: ["resumospecs"], example: "Intel Core i7 / 16 GB / 512 GB SSD / Windows 11 Pro", width: 42 },
  { key: "createdAt", header: "cadastro", aliases: ["createdat"], example: "2026-03-16 09:00:00", width: 22 }
];

const LEGACY_CSV_HEADER_MAP = {
  cpu: "cpu",
  ram: "ram",
  gpu: "gpu"
};

// Aceita o cabecalho novo e alguns aliases antigos para manter compatibilidade com planilhas anteriores.
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

  return matched?.key || LEGACY_CSV_HEADER_MAP[normalized] || String(header || "").trim();
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

function downloadExcelWorkbook({ filename, title, subtitle, rows }) {
  if (!window.XLSX?.utils) {
    return false;
  }

  // As primeiras linhas servem como instrucoes e o header real fica separado da area de preenchimento.
  const headers = CSV_COLUMNS.map((column) => column.header);
  const sheetRows = [
    [title],
    [subtitle],
    [],
    headers,
    ...rows
  ];

  const worksheet = window.XLSX.utils.aoa_to_sheet(sheetRows);
  const lastColumnIndex = CSV_COLUMNS.length - 1;
  const headerRowIndex = 3;
  const firstDataRowIndex = 4;
  const lastColumnRef = window.XLSX.utils.encode_col(lastColumnIndex);

  worksheet["!cols"] = CSV_COLUMNS.map((column) => ({ wch: column.width || 16 }));
  worksheet["!rows"] = [
    { hpt: 24 },
    { hpt: 34 },
    { hpt: 8 },
    { hpt: 22 }
  ];
  worksheet["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: lastColumnIndex } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: lastColumnIndex } }
  ];
  worksheet["!autofilter"] = {
    ref: `A${headerRowIndex + 1}:${lastColumnRef}${headerRowIndex + 1}`
  };
  worksheet["!freeze"] = { xSplit: 0, ySplit: firstDataRowIndex, topLeftCell: `A${firstDataRowIndex + 1}`, activePane: "bottomLeft", state: "frozen" };

  const workbook = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(workbook, worksheet, "Computadores");
  window.XLSX.writeFile(workbook, filename);
  return true;
}

function downloadCsvTemplate() {
  const delimiter = ";";
  const toCsvCell = (value) => `"${String(value ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
  const headerLine = CSV_COLUMNS.map((column) => toCsvCell(column.header)).join(delimiter);
  const exampleLine = CSV_COLUMNS.map((column) => toCsvCell(column.example || "")).join(delimiter);
  const usedExcel = downloadExcelWorkbook({
    filename: "modelo-importacao-computadores.xlsx",
    title: "Modelo de importacao de computadores",
    subtitle: "Preencha a partir da linha 5. Obrigatorios: dono e numero_serie. Use specs para concentrar hardware.",
    rows: [CSV_COLUMNS.map((column) => column.example || "")]
  });

  if (!usedExcel) {
    downloadCsv(["sep=;", headerLine, exampleLine].join("\r\n"), "modelo-importacao-computadores.csv");
  }

  setImportFeedback("Modelo de importacao baixado com sucesso para abrir no Excel.", "ok");
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
  const excelRows = state.computers.map((computer) => CSV_COLUMNS.map((column) => csvValueForExport(column, computer) ?? ""));
  const usedExcel = downloadExcelWorkbook({
    filename: "inventario-computadores.xlsx",
    title: "Exportacao de computadores",
    subtitle: "Planilha gerada pelo sistema. A linha 4 contem os headers para reimportacao.",
    rows: excelRows
  });

  if (!usedExcel) {
    downloadCsv(["sep=;", headerLine, ...rows].join("\r\n"), "inventario-computadores.csv");
  }
}

function readFileAsText(file, encoding = "utf-8") {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(String(event.target?.result || ""));
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo selecionado."));
    reader.readAsText(file, encoding);
  });
}

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target?.result);
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo selecionado."));
    reader.readAsArrayBuffer(file);
  });
}

function getImportRequiredHeaders() {
  return CSV_COLUMNS.filter((column) => column.required).map((column) => column.key);
}

function isKnownImportHeader(key) {
  return CSV_COLUMNS.some((column) => column.key === key) || Object.values(LEGACY_CSV_HEADER_MAP).includes(key);
}

function scoreImportHeaderRow(row = []) {
  const normalizedHeaders = row.map(normalizeCsvHeader);
  const recognized = normalizedHeaders.filter((key) => isKnownImportHeader(key)).length;
  const requiredMatches = getImportRequiredHeaders().filter((key) => normalizedHeaders.includes(key)).length;
  return { recognized, requiredMatches };
}

function findImportHeaderRowIndex(rows = []) {
  const requiredCount = getImportRequiredHeaders().length;
  let bestIndex = -1;
  let bestScore = -1;

  rows.slice(0, 25).forEach((row, index) => {
    const { recognized, requiredMatches } = scoreImportHeaderRow(row);
    if (requiredMatches < requiredCount || !recognized) return;
    const score = (requiredMatches * 100) + recognized;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function normalizeImportedText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function excelSerialToIsoDate(serial) {
  if (!Number.isFinite(serial)) return "";
  const excelEpoch = Date.UTC(1899, 11, 30);
  const date = new Date(excelEpoch + Math.round(serial * 86400000));
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function normalizeImportedDate(value, options = {}) {
  const { keepTime = false } = options;
  if (value === null || value === undefined || value === "") return "";

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : (keepTime ? value.toISOString() : value.toISOString().slice(0, 10));
  }

  if (typeof value === "number") {
    const isoDate = excelSerialToIsoDate(value);
    return keepTime ? (isoDate ? `${isoDate}T00:00:00.000Z` : "") : isoDate;
  }

  const text = String(value).trim();
  if (!text) return "";

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (isoMatch) {
    return keepTime && text.includes("T") ? text : `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const dateMatch = text.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})(?:\s+.*)?$/);
  if (dateMatch) {
    let [, first, second, year] = dateMatch;
    if (year.length === 2) {
      year = Number(year) >= 70 ? `19${year}` : `20${year}`;
    }
    let day = Number(first);
    let month = Number(second);
    if (day <= 12 && month > 12) {
      day = Number(second);
      month = Number(first);
    }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return keepTime ? text : "";
  return keepTime ? parsed.toISOString() : parsed.toISOString().slice(0, 10);
}

function buildImportedComputerPayload(row = {}) {
  const normalized = {
    owner: normalizeImportedText(row.owner),
    company: normalizeImportedText(row.company),
    corporateEmail: normalizeImportedText(row.corporateEmail).toLowerCase(),
    serial: normalizeImportedText(row.serial),
    machine: normalizeImportedText(row.machine),
    deviceStatus: ["ativo", "inativo", "pendente"].includes(normalizeImportedText(row.deviceStatus).toLowerCase())
      ? normalizeImportedText(row.deviceStatus).toLowerCase()
      : "ativo",
    purchaseDate: normalizeImportedDate(row.purchaseDate),
    warrantyMonths: parseOptionalNonNegativeNumber(row.warrantyMonths),
    cpu: normalizeImportedText(row.cpu),
    ram: normalizeImportedText(row.ram),
    gpu: normalizeImportedText(row.gpu),
    storage: normalizeImportedText(row.storage),
    storageType: normalizeImportedText(row.storageType) || "SSD",
    os: normalizeImportedText(row.os),
    machinePassword: normalizeImportedText(row.machinePassword),
    notes: normalizeImportedText(row.notes),
    warrantyDays: parseOptionalNonNegativeNumber(row.warrantyDays),
    specs: normalizeImportedText(row.specs)
  };

  normalized.warrantyDays = normalized.warrantyDays
    ?? (normalized.purchaseDate ? (parseOptionalNonNegativeNumber(row.warrantyMonths) ?? 0) * 30 : 0);
  normalized.specs = normalized.specs || buildSpecs(normalized);
  return normalized;
}

function parseCsvTextToRows(text) {
  const lines = String(text || "").split(/\r?\n/).filter((line) => line.trim() !== "");
  if (!lines.length) return [];
  const startIndex = lines[0].toLowerCase().startsWith("sep=") ? 1 : 0;
  const referenceLine = lines.find((line, index) => index >= startIndex && line.trim()) || "";
  const delimiter = referenceLine.includes(";") ? ";" : ",";
  return lines
    .slice(startIndex)
    .map((line) => parseCsvLine(line, delimiter).map((value) => String(value || "").trim()));
}

function parseSpreadsheetRows(rows = []) {
  const preparedRows = rows
    .map((row) => Array.isArray(row) ? row : [])
    .map((row) => row.map((value) => (value === null || value === undefined ? "" : value)));
  const headerRowIndex = findImportHeaderRowIndex(preparedRows);

  if (headerRowIndex === -1) {
    const expected = CSV_COLUMNS.filter((column) => column.required).map((column) => column.header).join(", ");
    throw new Error(`Planilha invalida. Nao encontrei uma linha de cabecalho com os campos obrigatorios: ${expected}.`);
  }

  const rawHeaders = preparedRows[headerRowIndex].map((value) => normalizeImportedText(value));
  const headers = rawHeaders.map(normalizeCsvHeader);
  const required = getImportRequiredHeaders();
  const missing = required.filter((key) => !headers.includes(key));
  if (missing.length) {
    const expected = CSV_COLUMNS.filter((column) => missing.includes(column.key)).map((column) => column.header);
    throw new Error(`Planilha invalida. Campos obrigatorios ausentes: ${expected.join(", ")}.`);
  }

  const imported = preparedRows
    .slice(headerRowIndex + 1)
    .map((values) => Object.fromEntries(headers.map((key, idx) => [key, values[idx] ?? ""])))
    .map((row) => buildImportedComputerPayload(row))
    .filter((item) => item.owner && item.serial);

  if (!imported.length) {
    throw new Error("Nenhuma linha valida encontrada para importar.");
  }

  return imported;
}

async function readSpreadsheetRows(file) {
  const fileName = String(file?.name || "").toLowerCase();
  if (fileName.endsWith(".csv")) {
    const text = await readFileAsText(file, "utf-8");
    return parseCsvTextToRows(text);
  }

  if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
    if (!window.XLSX?.read || !window.XLSX?.utils?.sheet_to_json) {
      throw new Error("A leitura de Excel nao esta disponivel agora. Tente novamente ou use CSV.");
    }
    const data = await readFileAsArrayBuffer(file);
    const workbook = window.XLSX.read(data, { type: "array", cellDates: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new Error("A planilha Excel nao possui abas para importar.");
    }
    return window.XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1,
      raw: true,
      defval: "",
      blankrows: false
    });
  }

  throw new Error("Formato nao suportado. Envie um arquivo CSV ou Excel (.xlsx).");
}

async function importSpreadsheet(file) {
  try {
    const rows = await readSpreadsheetRows(file);
    const imported = parseSpreadsheetRows(rows);

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
  } catch (error) {
    setImportFeedback(error.message || "Falha ao importar a planilha.", "error");
  }
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
    if (!Array.isArray(users)) return [];
    const normalized = users.map((user, index) => normalizeMockUserRecord(user, index === 0));
    if (JSON.stringify(normalized) !== JSON.stringify(users)) {
      writeMockUsers(normalized);
    }
    return normalized;
  } catch (error) {
    return [];
  }
}

function writeMockUsers(users) {
  localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(users));
}

function buildMockUserId(email = "") {
  const normalized = encodeURIComponent(String(email || "").trim().toLowerCase()).replace(/%/g, "");
  return `usr_${normalized || "anon"}`;
}

function normalizeMockUserRecord(user = {}, isFirstUser = false) {
  const role = user.role === "admin" || isFirstUser ? "admin" : "member";
  return {
    id: user.id || buildMockUserId(user.email),
    email: String(user.email || "").trim().toLowerCase(),
    password: String(user.password || ""),
    role,
    permissions: {
      computers: normalizeComputerPermissions(user.permissions, role)
    },
    authProvider: user.authProvider || "local",
    active: user.active !== false,
    createdAt: user.createdAt || new Date().toISOString()
  };
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
  const warrantyMonths = parseOptionalNonNegativeNumber(payload.warrantyMonths);
  const warrantyDays = parseOptionalNonNegativeNumber(payload.warrantyDays)
    ?? (payload.purchaseDate && (warrantyMonths ?? 0) > 0 ? warrantyMonths * 30 : 0);
  const computer = {
    id: existingComputer?.id || buildMockId("pc"),
    owner: String(payload.owner || "").trim(),
    company: String(payload.company || "").trim(),
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
    machinePassword: String(payload.machinePassword || "").trim(),
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

// O modo mock replica os formatos do backend para a UI funcionar igual com ou sem API real.
function normalizeMockComputerMovement(payload, computer, actorEmail) {
  const movementType = String(payload.movementType || "devolucao").trim().toLowerCase();
  const nextDeviceStatus = movementType === "devolucao" ? "pendente" : "ativo";
  return {
    id: buildMockId("move"),
    computerId: computer.id,
    movementType,
    serial: computer.serial,
    machine: computer.machine,
    previousOwner: computer.owner,
    previousCompany: computer.company || "",
    previousCorporateEmail: computer.corporateEmail || "",
    previousDeviceStatus: computer.deviceStatus || "ativo",
    nextOwner: String(payload.nextOwner || "").trim(),
    nextCompany: String(payload.nextCompany || "").trim(),
    nextCorporateEmail: String(payload.nextCorporateEmail || "").trim().toLowerCase(),
    nextDeviceStatus,
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

function getMockUserByToken(token) {
  const email = decodeMockToken(token);
  if (!email) return null;
  return readMockUsers().find((user) => user.email === email) || null;
}

function assertMockComputerPermission(token, permission) {
  const user = getMockUserByToken(token);
  if (!user) {
    throw new Error("Sessao invalida.");
  }
  if (user.role === "admin") {
    return user;
  }
  const permissions = normalizeComputerPermissions(user.permissions, user.role);
  if (!permissions[permission]) {
    throw new Error("Voce nao tem permissao para esta operacao em computadores.");
  }
  return user;
}

function assertMockAdmin(token) {
  const user = getMockUserByToken(token);
  if (!user) {
    throw new Error("Sessao invalida.");
  }
  if (user.role !== "admin") {
    throw new Error("Permissao de administrador necessaria.");
  }
  return user;
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
    return { token: buildMockToken(email), user: normalizeUser(found) };
  },
  async register(payload) {
    const email = String(payload.email || "").trim().toLowerCase();
    const password = String(payload.password || "");
    const users = readMockUsers();
    const exists = users.some((user) => user.email === email);
    if (exists) {
      throw new Error("Email ja cadastrado.");
    }
    const created = normalizeMockUserRecord({
      email,
      password,
      role: users.length === 0 ? "admin" : "member",
      permissions: { computers: { create: true, edit: true, delete: true } }
    }, users.length === 0);
    users.push(created);
    writeMockUsers(users);
    return { token: buildMockToken(email), user: normalizeUser(created) };
  },
  async me(token) {
    const email = decodeMockToken(token);
    if (!email) {
      throw new Error("Sessao invalida.");
    }
    const users = readMockUsers();
    const found = users.find((user) => user.email === email);
    if (!found) {
      throw new Error("Sessao invalida.");
    }
    return { user: normalizeUser(found) };
  },
  async logout() {
    return true;
  }
};

const mockInventoryService = {
  async listComputers() {
    return sortByCreatedAtDesc(readMockComputers());
  },

  async createComputer(token, payload) {
    assertMockComputerPermission(token, "create");
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

  async updateComputer(token, id, payload) {
    assertMockComputerPermission(token, "edit");
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

  async deleteComputer(token, id) {
    assertMockComputerPermission(token, "delete");
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
      company: movementType === "devolucao" ? "" : movement.nextCompany,
      corporateEmail: movementType === "devolucao" ? "" : movement.nextCorporateEmail,
      deviceStatus: movement.nextDeviceStatus
    };

    writeMockComputers(computers.map((item) => item.id === computer.id ? updatedComputer : item));
    const movements = readMockComputerMovements();
    movements.push(movement);
    writeMockComputerMovements(movements);
    return movement;
  },

  async deleteComputerMovement(_token, id) {
    const movements = readMockComputerMovements();
    const filtered = movements.filter((movement) => movement.id !== id);
    if (filtered.length === movements.length) {
      throw new Error("Movimentacao nao encontrada.");
    }
    writeMockComputerMovements(filtered);
    return true;
  },

  async revertComputerMovement(_token, id) {
    const movements = readMockComputerMovements();
    const movement = movements.find((item) => item.id === id);
    if (!movement) {
      throw new Error("Movimentacao nao encontrada.");
    }

    const latestForComputer = sortByCreatedAtDesc(
      movements.filter((item) => item.computerId === movement.computerId)
    )[0];
    if (!latestForComputer || latestForComputer.id !== movement.id) {
      throw new Error("So e possivel reverter a ultima movimentacao deste computador.");
    }

    const computers = readMockComputers();
    const updatedComputers = computers.map((computer) => {
      if (computer.id !== movement.computerId) return computer;
      return {
        ...computer,
        owner: movement.previousOwner || "",
        company: movement.previousCompany || "",
        corporateEmail: movement.previousCorporateEmail || "",
        deviceStatus: movement.previousDeviceStatus || "ativo"
      };
    });

    writeMockComputers(updatedComputers);
    writeMockComputerMovements(movements.filter((item) => item.id !== id));
    return updatedComputers.find((computer) => computer.id === movement.computerId) || null;
  },

  async listUsers(token) {
    assertMockAdmin(token);
    return sortByCreatedAtDesc(readMockUsers()).map((user) => ({
      id: String(user.id),
      email: user.email,
      role: user.role,
      permissions: user.permissions,
      authProvider: user.authProvider || "local",
      active: user.active !== false,
      createdAt: user.createdAt || new Date().toISOString()
    }));
  },

  async updateUserRole(token, id, role) {
    assertMockAdmin(token);
    const users = readMockUsers();
    const index = users.findIndex((user) => String(user.id) === String(id));
    if (index < 0) {
      throw new Error("Usuario nao encontrado.");
    }

    users[index] = normalizeMockUserRecord({
      ...users[index],
      role
    });
    writeMockUsers(users);
    return {
      id: String(users[index].id),
      email: users[index].email,
      role: users[index].role,
      permissions: users[index].permissions
    };
  },

  async updateUserComputerPermissions(token, id, permissions) {
    assertMockAdmin(token);
    const users = readMockUsers();
    const index = users.findIndex((user) => String(user.id) === String(id));
    if (index < 0) {
      throw new Error("Usuario nao encontrado.");
    }
    if (users[index].role === "admin") {
      throw new Error("Administradores possuem acesso total fixo.");
    }

    users[index] = normalizeMockUserRecord({
      ...users[index],
      permissions: {
        computers: normalizeComputerPermissions(permissions, users[index].role)
      }
    });
    writeMockUsers(users);
    return {
      id: String(users[index].id),
      email: users[index].email,
      role: users[index].role,
      permissions: users[index].permissions
    };
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

// Em desenvolvimento ou contingencia, alguns endpoints podem cair no mock para a interface continuar utilizavel.
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
    user: normalizeUser(data.user)
  };
}

function normalizeMePayload(data) {
  if (!data || !data.user || typeof data.user.email !== "string") {
    throw new Error("Sessao invalida.");
  }
  return { user: normalizeUser(data.user) };
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

  async deleteComputerMovement(token, id) {
    if (AUTH_USE_MOCK) return mockInventoryService.deleteComputerMovement(token, id);
    const result = await apiRequest({
      url: `${API_BASE_URL}/computer-movements/${encodeURIComponent(id)}`,
      method: "DELETE",
      token
    });
    if (!result.ok) {
      throw new Error(result.message || "Falha ao excluir movimentacao.");
    }
    return true;
  },

  async revertComputerMovement(token, id) {
    if (AUTH_USE_MOCK) return mockInventoryService.revertComputerMovement(token, id);
    const result = await apiRequest({
      url: `${API_BASE_URL}/computer-movements/${encodeURIComponent(id)}/revert`,
      method: "POST",
      token
    });
    if (!result.ok) {
      throw new Error(result.message || "Falha ao reverter movimentacao.");
    }
    return result.data.computer || null;
  },

  async listUsers(token) {
    if (AUTH_USE_MOCK) return mockInventoryService.listUsers(token);
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
    if (AUTH_USE_MOCK) return mockInventoryService.updateUserRole(token, id, role);
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

  async updateUserComputerPermissions(token, id, permissions) {
    if (AUTH_USE_MOCK) return mockInventoryService.updateUserComputerPermissions(token, id, permissions);
    const result = await apiRequest({
      url: `${API_BASE_URL}/users/${encodeURIComponent(id)}/computer-permissions`,
      method: "PUT",
      token,
      body: { permissions }
    });
    if (!result.ok) {
      throw new Error(result.message || "Falha ao atualizar acessos de computador.");
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

  // Carregamos tudo em paralelo para o painel nao ficar lento apos login, importacao ou troca.
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
    state.auth.user = normalizeUser(result.user);
    state.auth.isAuthenticated = true;
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(state.auth.user));
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
  // Toda a tela e dirigida por eventos; daqui sai a navegacao, modais, importacao e movimentacoes.
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

  elements.goComputers.addEventListener("click", () => {
    if (!state.auth.isAuthenticated) return;
    state.currentView = "computadores";
    render();
  });

  [elements.newFromDashboard, elements.newFromTable, elements.floatingAdd].forEach((button) => {
    button.addEventListener("click", () => openModal());
  });

  document.getElementById("close-modal").addEventListener("click", closeModal);
  document.getElementById("cancel-modal").addEventListener("click", closeModal);
  elements.modalLayer.addEventListener("click", (event) => {
    if (event.target === elements.modalLayer) closeModal();
  });
  elements.purchaseDateUnknown.addEventListener("change", syncComputerOptionalFields);
  elements.warrantyMonthsUnknown.addEventListener("change", syncComputerOptionalFields);
  elements.computerTemplateSelect.addEventListener("change", (event) => {
    applyComputerTemplate(event.target.value);
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

    try {
      if (button.dataset.userAction === "save-computer-permissions") {
        const row = button.closest("tr");
        const permissions = {
          computers: {
            create: !!row?.querySelector('input[data-permission-input="create"]')?.checked,
            edit: !!row?.querySelector('input[data-permission-input="edit"]')?.checked,
            delete: !!row?.querySelector('input[data-permission-input="delete"]')?.checked
          }
        };
        await inventoryService.updateUserComputerPermissions(state.auth.token, button.dataset.id, permissions);
        setPermissionsFeedback("Acessos de computadores atualizados.", "ok");
      } else {
        const role = button.dataset.userAction === "make-admin" ? "admin" : "member";
        await inventoryService.updateUserRole(state.auth.token, button.dataset.id, role);
        setPermissionsFeedback(`Permissão atualizada para ${roleLabel(role)}.`, "ok");
      }
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

  elements.movementTableBody.addEventListener("click", async (event) => {
    if (!state.auth.isAuthenticated) return;
    const button = event.target.closest("button[data-movement-action]");
    if (!button) return;

    try {
      if (button.dataset.movementAction === "delete") {
        const changed = await deleteComputerMovement(button.dataset.id);
        if (changed) {
          setMovementFeedback("Movimentacao excluida com sucesso.", "ok");
          render();
        }
      }
      if (button.dataset.movementAction === "revert") {
        const changed = await revertComputerMovement(button.dataset.id);
        if (changed) {
          setMovementFeedback("Movimentacao revertida e computador restaurado.", "ok");
          render();
        }
      }
    } catch (error) {
      setMovementFeedback(error.message || "Falha ao processar movimentacao.", "error");
    }
  });

  elements.tableBody.addEventListener("click", async (event) => {
    if (!state.auth.isAuthenticated) return;
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const { action, id } = button.dataset;
    if (action === "view") viewComputer(id);
    if (action === "edit") {
      if (!canEditComputers()) {
        window.alert("Voce nao tem permissao para editar computadores.");
        return;
      }
      const computer = state.computers.find((item) => item.id === id);
      if (computer) openModal(computer);
    }
    if (action === "delete") {
      if (!canDeleteComputers()) {
        window.alert("Voce nao tem permissao para excluir computadores.");
        return;
      }
      try {
        await deleteComputer(id);
      } catch (error) {
        window.alert(error.message || "Falha ao remover computador.");
      }
    }
  });

  elements.exportCsv.addEventListener("click", () => {
    if (!state.auth.isAuthenticated) return;
    exportCsv();
  });
  elements.exportPdf.addEventListener("click", () => {
    if (!state.auth.isAuthenticated) return;
    window.print();
  });
  elements.importInput.addEventListener("change", (event) => {
    if (!state.auth.isAuthenticated) return;
    if (!canCreateComputers()) {
      setImportFeedback("Voce nao tem permissao para importar ou cadastrar computadores.", "error");
      event.target.value = "";
      return;
    }
    const file = event.target.files?.[0];
    if (!file) return;
    setImportFeedback(`Importando ${file.name}...`, "ok");
    importSpreadsheet(file);
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



