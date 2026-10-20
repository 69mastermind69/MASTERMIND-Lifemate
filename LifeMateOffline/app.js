
/* ==========================================
   LifeMate Offline - MASTERMIND Ultimate
   PIN Lock + Advanced Dashboard + PWA
   Existing data key preserved
========================================== */

"use strict";

const STORAGE_KEY = "lifemate_mastermind_v1";
const THEME_KEY = "lifemate_theme_mastermind_v1";
const PIN_KEY = "lifemate_pin_hash_mastermind_v1";
const WATER_TARGET = 2000;

const $ = (id) => document.getElementById(id);

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function todayString() {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString().slice(0, 10);
}

function formatMoney(value) {
  return "৳" + Number(value || 0).toLocaleString("en-BD", {
    maximumFractionDigits: 2
  });
}

/* ------------------------------------------
   DATA - KEEP OLD STORAGE KEY
------------------------------------------ */

function defaultData() {
  return {
    money: [],
    shopping: [],
    habits: [],
    diary: [],
    water: { date: todayString(), count: 0 },
    todos: []
  };
}

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return defaultData();

    const parsed = JSON.parse(saved);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return defaultData();
    }

    return {
      ...defaultData(),
      ...parsed,
      money: safeArray(parsed.money),
      shopping: safeArray(parsed.shopping),
      habits: safeArray(parsed.habits),
      diary: safeArray(parsed.diary),
      todos: safeArray(parsed.todos),
      water: parsed.water && typeof parsed.water === "object"
        ? parsed.water
        : defaultData().water
    };
  } catch (error) {
    console.error("Could not load LifeMate data:", error);
    return defaultData();
  }
}

let data = loadData();

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error("Could not save LifeMate data:", error);
    showToast("Could not save data. Check device storage.");
    return false;
  }
}

/* ------------------------------------------
   TOAST
------------------------------------------ */

let toastTimeout;

function showToast(message) {
  const toast = $("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("show"), 2600);
}

/* ------------------------------------------
   THEME
------------------------------------------ */

function applyTheme(theme) {
  const selectedTheme = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", selectedTheme);

  const toggle = $("themeToggle");
  if (toggle) {
    toggle.textContent = selectedTheme === "dark" ? "☀️" : "🌙";
    toggle.setAttribute("aria-label",
      selectedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode");
    toggle.title = selectedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  }

  const settingsToggle = $("themeToggleSettings");
  if (settingsToggle) {
    settingsToggle.textContent = selectedTheme === "dark"
      ? "☀️ Switch to Light Mode"
      : "🌙 Switch to Dark Mode";
  }

  try {
    localStorage.setItem(THEME_KEY, selectedTheme);
  } catch (error) {
    console.warn("Theme preference could not be saved.");
  }

  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) {
    themeColor.content = selectedTheme === "dark" ? "#170b0e" : "#fff5f6";
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  applyTheme(current === "dark" ? "light" : "dark");
}

function initTheme() {
  let savedTheme = "dark";

  try {
    savedTheme = localStorage.getItem(THEME_KEY) || "dark";
  } catch (error) {
    console.warn("Could not read theme preference.");
  }

  applyTheme(savedTheme);
  $("themeToggle")?.addEventListener("click", toggleTheme);
  $("themeToggleSettings")?.addEventListener("click", toggleTheme);
}

/* ------------------------------------------
   NAVIGATION
------------------------------------------ */

function showPage(pageId) {
  const target = $(pageId);
  if (!target || !target.classList.contains("page")) return;

  document.querySelectorAll(".page").forEach((page) => {
    page.classList.toggle("active", page.id === pageId);
  });

  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.page === pageId);
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function initNavigation() {
  document.querySelectorAll("[data-page]").forEach((button) => {
    button.addEventListener("click", () => showPage(button.dataset.page));
  });
}

/* ------------------------------------------
   ADVANCED DASHBOARD
------------------------------------------ */

function refreshWaterDate() {
  if (!data.water || typeof data.water !== "object") {
    data.water = { date: todayString(), count: 0 };
  }

  if (data.water.date !== todayString()) {
    data.water.date = todayString();
    data.water.count = 0;
    saveData();
  }

  data.water.count = Math.max(0, Number(data.water.count) || 0);
}

function renderDashboard() {
  const income = data.money
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const expenses = data.money
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const completedTasks = data.todos.filter((item) => item.done).length;
  const totalTasks = data.todos.length;

  const today = todayString();
  const completedHabits = data.habits.filter((habit) =>
    Array.isArray(habit.completedDates) && habit.completedDates.includes(today)
  ).length;

  const totalHabits = data.habits.length;
  const boughtItems = data.shopping.filter((item) => item.done).length;
  const totalShopping = data.shopping.length;

  $("dashIncome").textContent = formatMoney(income);
  $("dashExpense").textContent = formatMoney(expenses);
  $("dashBalance").textContent = formatMoney(income - expenses);
  $("dashTasks").textContent = `${completedTasks} / ${totalTasks}`;

  const totalItems = totalTasks + totalHabits + totalShopping;
  const completedItems = completedTasks + completedHabits + boughtItems;
  const percent = totalItems ? Math.round((completedItems / totalItems) * 100) : 0;

  $("dashProgressPercent").textContent = `${percent}%`;
  $("dashProgressBar").style.width = `${percent}%`;
  $("dashHabitSummary").textContent = `Habits: ${completedHabits} / ${totalHabits}`;
  $("dashShoppingSummary").textContent = `Shopping: ${boughtItems} / ${totalShopping}`;

  refreshWaterDate();
  const waterCount = data.water.count;
  const waterPercent = Math.min(100, Math.round((waterCount / WATER_TARGET) * 100));

  $("dashWaterText").textContent = `${waterCount.toLocaleString("en-BD")} ml today`;
  $("dashWaterBar").style.width = `${waterPercent}%`;
  $("dashWaterPercent").textContent = `${waterPercent}% of the ${WATER_TARGET} ml target`;

  const dateElement = $("dashboardDate");
  if (dateElement) {
    dateElement.textContent = new Date().toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }
}

/* ------------------------------------------
   MONEY MANAGER
------------------------------------------ */

function renderMoney() {
  const income = data.money
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const expenses = data.money
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  $("totalIncome").textContent = formatMoney(income);
  $("totalExpense").textContent = formatMoney(expenses);
  $("balance").textContent = formatMoney(income - expenses);

  const list = $("moneyList");
  list.replaceChildren();

  [...data.money].reverse().forEach((item) => {
    const row = document.createElement("div");
    row.className = "transaction";

    const info = document.createElement("div");
    info.style.minWidth = "0";

    const title = document.createElement("strong");
    title.textContent = item.note || (item.type === "income" ? "Income" : "Expense");

    const detail = document.createElement("p");
    detail.textContent = `${item.date || ""} · ${item.type === "income" ? "Income" : "Expense"}`;

    const amount = document.createElement("strong");
    amount.textContent = `${item.type === "income" ? "+" : "−"}${formatMoney(item.amount)}`;
    amount.style.color = item.type === "income" ? "var(--success)" : "var(--danger)";

    info.append(title, detail, amount);

    const remove = createActionButton("Delete", () => {
      if (!confirm("Delete this transaction?")) return;
      data.money = data.money.filter((entry) => entry.id !== item.id);
      saveData();
      renderAll();
      showToast("Transaction deleted.");
    });

    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.justifyContent = "space-between";
    row.style.gap = "12px";
    row.append(info, remove);
    list.append(row);
  });

  renderDashboard();
}

function initMoney() {
  $("moneyForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const type = $("moneyType").value;
    const amount = Number($("moneyAmount").value);
    const note = $("moneyNote").value.trim();

    if (!["income", "expense"].includes(type) ||
        !Number.isFinite(amount) || amount <= 0) {
      showToast("Enter a valid amount.");
      return;
    }

    data.money.push({ id: makeId(), type, amount, note, date: todayString() });
    saveData();
    event.target.reset();
    renderAll();
    showToast("Transaction added.");
  });

  renderMoney();
}

/* ------------------------------------------
   LIST HELPERS
------------------------------------------ */

function createActionButton(label, onClick, className = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  if (className) button.className = className;
  button.addEventListener("click", onClick);
  return button;
}

/* ------------------------------------------
   SHOPPING LIST
------------------------------------------ */

function renderShopping() {
  const list = $("shoppingList");
  list.replaceChildren();

  data.shopping.forEach((item) => {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(item.done);
    checkbox.setAttribute("aria-label", `Mark ${item.text} as purchased`);

    checkbox.addEventListener("change", () => {
      item.done = checkbox.checked;
      saveData();
      renderAll();
    });

    const label = document.createElement("span");
    label.textContent = item.text;
    label.style.flex = "1";
    label.style.minWidth = "0";
    label.style.overflowWrap = "anywhere";

    if (item.done) {
      label.style.textDecoration = "line-through";
      label.style.opacity = "0.6";
    }

    const row = document.createElement("div");
    row.className = "shopping-item";
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.gap = "10px";

    row.append(checkbox, label, createActionButton("Delete", () => {
      data.shopping = data.shopping.filter((entry) => entry.id !== item.id);
      saveData();
      renderAll();
      showToast("Item deleted.");
    }));

    list.append(row);
  });

  renderDashboard();
}

function initShopping() {
  $("shoppingForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const text = $("shoppingInput").value.trim();
    if (!text) return;

    data.shopping.push({ id: makeId(), text, done: false });
    saveData();
    event.target.reset();
    renderAll();
    showToast("Shopping item added.");
  });

  renderShopping();
}

/* ------------------------------------------
   HABIT TRACKER
------------------------------------------ */

function renderHabits() {
  const list = $("habitList");
  list.replaceChildren();
  const today = todayString();

  data.habits.forEach((habit) => {
    if (!Array.isArray(habit.completedDates)) habit.completedDates = [];
    const done = habit.completedDates.includes(today);

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = done;
    checkbox.setAttribute("aria-label", `Complete habit: ${habit.text}`);

    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        if (!habit.completedDates.includes(today)) habit.completedDates.push(today);
      } else {
        habit.completedDates = habit.completedDates.filter((date) => date !== today);
      }

      saveData();
      renderAll();
      showToast(checkbox.checked ? "Habit completed!" : "Habit unchecked.");
    });

    const label = document.createElement("span");
    label.textContent = habit.text;
    label.style.flex = "1";
    if (done) label.style.color = "var(--success)";

    const row = document.createElement("div");
    row.className = "habit-item";
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.gap = "10px";

    row.append(checkbox, label, createActionButton("Delete", () => {
      data.habits = data.habits.filter((entry) => entry.id !== habit.id);
      saveData();
      renderAll();
      showToast("Habit deleted.");
    }));

    list.append(row);
  });

  renderDashboard();
}

function initHabits() {
  $("habitForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const text = $("habitInput").value.trim();
    if (!text) return;

    data.habits.push({ id: makeId(), text, completedDates: [] });
    saveData();
    event.target.reset();
    renderAll();
    showToast("Habit added.");
  });

  renderHabits();
}

/* ------------------------------------------
   DIARY
------------------------------------------ */

function renderDiary() {
  const list = $("diaryList");
  list.replaceChildren();

  [...data.diary]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .forEach((entry) => {
      const row = document.createElement("div");
      row.className = "diary-entry";

      const date = document.createElement("strong");
      date.textContent = entry.date || "Undated entry";

      const text = document.createElement("p");
      text.textContent = entry.text || "";
      text.style.whiteSpace = "pre-wrap";
      text.style.overflowWrap = "anywhere";

      row.append(date, text, createActionButton("Delete Entry", () => {
        if (!confirm("Delete this diary entry?")) return;
        data.diary = data.diary.filter((item) => item.id !== entry.id);
        saveData();
        renderDiary();
        showToast("Diary entry deleted.");
      }));

      list.append(row);
    });
}

function initDiary() {
  $("diaryDate").value = todayString();

  $("diaryForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const date = $("diaryDate").value;
    const text = $("diaryText").value.trim();

    if (!date || !text) {
      showToast("Enter a date and diary entry.");
      return;
    }

    data.diary.push({
      id: makeId(),
      date,
      text,
      createdAt: new Date().toISOString()
    });

    saveData();
    $("diaryText").value = "";
    $("diaryDate").value = todayString();
    renderDiary();
    showToast("Diary entry saved.");
  });

  renderDiary();
}

/* ------------------------------------------
   WATER TRACKER
------------------------------------------ */

function renderWater() {
  refreshWaterDate();

  const count = data.water.count;
  const percentage = Math.min(100, Math.round((count / WATER_TARGET) * 100));

  $("waterCount").textContent = `${count.toLocaleString("en-BD")} ml`;
  $("waterProgress").style.width = `${percentage}%`;
  $("waterProgressText").textContent =
    `${percentage}% of your daily target (${WATER_TARGET} ml)`;

  renderDashboard();
}

function initWater() {
  $("waterAdd").addEventListener("click", () => {
    refreshWaterDate();
    data.water.count += 250;
    saveData();
    renderWater();
    showToast("250 ml added.");
  });

  $("waterRemove").addEventListener("click", () => {
    refreshWaterDate();
    data.water.count = Math.max(0, data.water.count - 250);
    saveData();
    renderWater();
    showToast("Water count updated.");
  });

  $("waterReset").addEventListener("click", () => {
    if (!confirm("Reset today's water count?")) return;
    data.water = { date: todayString(), count: 0 };
    saveData();
    renderWater();
    showToast("Water count reset.");
  });

  renderWater();
}

/* ------------------------------------------
   TO-DO LIST
------------------------------------------ */

function renderTodos() {
  const list = $("todoList");
  list.replaceChildren();

  data.todos.forEach((todo) => {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(todo.done);
    checkbox.setAttribute("aria-label", `Complete task: ${todo.text}`);

    checkbox.addEventListener("change", () => {
      todo.done = checkbox.checked;
      saveData();
      renderAll();
      showToast(checkbox.checked ? "Task completed!" : "Task reopened.");
    });

    const label = document.createElement("span");
    label.textContent = todo.text;
    label.style.flex = "1";
    label.style.minWidth = "0";
    label.style.overflowWrap = "anywhere";

    if (todo.done) {
      label.style.textDecoration = "line-through";
      label.style.opacity = "0.6";
    }

    const row = document.createElement("div");
    row.className = "todo-item";
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.gap = "10px";

    row.append(checkbox, label, createActionButton("Delete", () => {
      data.todos = data.todos.filter((item) => item.id !== todo.id);
      saveData();
      renderAll();
      showToast("Task deleted.");
    }));

    list.append(row);
  });

  renderDashboard();
}

function initTodos() {
  $("todoForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const text = $("todoInput").value.trim();
    if (!text) return;

    data.todos.push({
      id: makeId(),
      text,
      done: false,
      createdAt: new Date().toISOString()
    });

    saveData();
    event.target.reset();
    renderAll();
    showToast("Task added.");
  });

  renderTodos();
}

/* ------------------------------------------
   QR GENERATOR
------------------------------------------ */

function initQR() {
  $("qrForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const text = $("qrInput").value.trim();
    const output = $("qrOutput");
    output.replaceChildren();

    if (!text) {
      showToast("Enter text or a URL first.");
      return;
    }

    if (typeof window.QRCode !== "function") {
      showToast("QR library not found. Check qrcode.min.js.");
      return;
    }

    try {
      new window.QRCode(output, {
        text,
        width: 220,
        height: 220,
        colorDark: "#1b1013",
        colorLight: "#ffffff",
        correctLevel: window.QRCode.CorrectLevel
          ? window.QRCode.CorrectLevel.M
          : 0
      });

      output.append(createActionButton("Download QR Code", () => {
        const canvas = output.querySelector("canvas");
        const image = output.querySelector("img");
        const url = canvas ? canvas.toDataURL("image/png") : image?.src;

        if (!url) {
          showToast("QR image is not ready yet.");
          return;
        }

        const link = document.createElement("a");
        link.href = url;
        link.download = "lifemate-qrcode.png";
        document.body.append(link);
        link.click();
        link.remove();
      }, "primary-button"));

      showToast("QR code generated.");
    } catch (error) {
      console.error("QR generation failed:", error);
      showToast("Could not generate QR code.");
    }
  });
}

/* ------------------------------------------
   BACKUP EXPORT / IMPORT
------------------------------------------ */

function initBackup() {
  $("exportBackup").addEventListener("click", () => {
    const backup = {
      app: "LifeMate Offline",
      version: 2,
      exportedAt: new Date().toISOString(),
      data
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `lifemate-backup-${todayString()}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("Backup exported.");
  });

  $("importBackupButton").addEventListener("click", async () => {
    const file = $("importBackup").files[0];

    if (!file) {
      showToast("Choose a backup file first.");
      return;
    }

    try {
      const parsed = JSON.parse(await file.text());
      const incoming = parsed && parsed.data && typeof parsed.data === "object"
        ? parsed.data
        : parsed;

      if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
        throw new Error("Invalid backup format");
      }

      const keys = ["money", "shopping", "habits", "diary", "water", "todos"];
      if (!keys.some((key) => Object.prototype.hasOwnProperty.call(incoming, key))) {
        throw new Error("No LifeMate data found");
      }

      if (!confirm("Importing will replace current app data. Continue?")) return;

      data = {
        ...defaultData(),
        ...incoming,
        money: safeArray(incoming.money),
        shopping: safeArray(incoming.shopping),
        habits: safeArray(incoming.habits),
        diary: safeArray(incoming.diary),
        todos: safeArray(incoming.todos),
        water: incoming.water && typeof incoming.water === "object"
          ? incoming.water
          : defaultData().water
      };

      saveData();
      renderAll();
      $("importBackup").value = "";
      showToast("Backup imported successfully.");
    } catch (error) {
      console.error("Backup import failed:", error);
      showToast("Invalid backup file. Existing data was not imported.");
    }
  });

  $("resetApp").addEventListener("click", () => {
    if (!confirm("This will delete your saved LifeMate data. Continue?")) return;
    if (!confirm("Final confirmation: permanently reset app data?")) return;

    data = defaultData();
    saveData();
    renderAll();
    showPage("home");
    showToast("App data reset. Your PIN setting remains unchanged.");
  });
}

/* ------------------------------------------
   PIN LOCK
   SHA-256 hash when Web Crypto is available.
   This is not a replacement for data encryption.
------------------------------------------ */

let appIsLocked = false;

async function hashPin(pin) {
  if (window.crypto?.subtle && window.TextEncoder) {
    const bytes = new TextEncoder().encode(pin);
    const digest = await window.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  // Fallback for browsers without Web Crypto; not cryptographically secure.
  let hash = 2166136261;
  for (let i = 0; i < pin.length; i++) {
    hash ^= pin.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fallback-${(hash >>> 0).toString(16)}`;
}

function getSavedPinHash() {
  try {
    return localStorage.getItem(PIN_KEY);
  } catch (error) {
    return null;
  }
}

function updatePinStatus() {
  const enabled = Boolean(getSavedPinHash());
  const status = $("pinStatus");
  if (status) {
    status.textContent = enabled
      ? "🔒 PIN lock is enabled on this browser."
      : "🔓 PIN lock is not enabled.";
  }

  const disableButton = $("disablePin");
  if (disableButton) disableButton.disabled = !enabled;
}

function showLockScreen(message = "Enter your PIN to continue.") {
  appIsLocked = true;
  document.body.classList.add("app-locked");
  $("lockScreen").hidden = false;
  $("lockMessage").textContent = message;
  $("lockTitle").innerHTML = "LifeMate <span>Offline</span>";
  $("pinHint").textContent = "Your personal space, protected.";
  $("pinInput").value = "";
  $("pinInput").setAttribute("autocomplete", "current-password");
  $("pinSubmit").textContent = "Unlock App";
  setTimeout(() => $("pinInput").focus(), 50);
}

function hideLockScreen() {
  appIsLocked = false;
  document.body.classList.remove("app-locked");
  $("lockScreen").hidden = true;
  $("pinInput").value = "";
}

async function verifyPin(pin) {
  const savedHash = getSavedPinHash();
  if (!savedHash) return false;
  return (await hashPin(pin)) === savedHash;
}

function initPinLock() {
  updatePinStatus();

  if (getSavedPinHash()) {
    showLockScreen();
  }

  $("pinForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const pin = $("pinInput").value.trim();
    if (!/^\d{4,6}$/.test(pin)) {
      showToast("Enter a 4–6 digit PIN.");
      return;
    }

    $("pinSubmit").disabled = true;

    try {
      if (await verifyPin(pin)) {
        hideLockScreen();
        showToast("App unlocked.");
      } else {
        $("pinInput").value = "";
        $("lockMessage").textContent = "Incorrect PIN. Please try again.";
        $("pinInput").focus();
      }
    } catch (error) {
      console.error("PIN verification failed:", error);
      showToast("Could not verify PIN in this browser.");
    } finally {
      $("pinSubmit").disabled = false;
    }
  });

  $("setPinForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const newPin = $("newPin").value.trim();
    const confirmPin = $("confirmPin").value.trim();

    if (!/^\d{4,6}$/.test(newPin)) {
      showToast("PIN must contain 4–6 digits.");
      return;
    }

    if (newPin !== confirmPin) {
      showToast("PINs do not match.");
      $("confirmPin").focus();
      return;
    }

    try {
      const pinHash = await hashPin(newPin);
      localStorage.setItem(PIN_KEY, pinHash);
      $("setPinForm").reset();
      updatePinStatus();
      showToast("PIN lock enabled successfully.");
    } catch (error) {
      console.error("Could not save PIN:", error);
      showToast("Could not save PIN in this browser.");
    }
  });

  $("disablePin").addEventListener("click", async () => {
    const savedHash = getSavedPinHash();
    if (!savedHash) {
      showToast("PIN lock is already disabled.");
      return;
    }

    const currentPin = prompt("Enter your current PIN to turn off PIN lock:");
    if (currentPin === null) return;

    try {
      if (!(await verifyPin(currentPin.trim()))) {
        showToast("Incorrect PIN. PIN lock remains enabled.");
        return;
      }

      if (!confirm("Turn off PIN lock on this browser?")) return;
      localStorage.removeItem(PIN_KEY);
      updatePinStatus();
      showToast("PIN lock disabled.");
    } catch (error) {
      showToast("Could not verify the current PIN.");
    }
  });

  $("lockNow").addEventListener("click", () => {
    if (!getSavedPinHash()) {
      showToast("Set a PIN before locking the app.");
      return;
    }
    showLockScreen("App locked. Enter your PIN to continue.");
  });
}

/* ------------------------------------------
   PWA INSTALL
------------------------------------------ */

let installPromptEvent = null;

function updateInstallButtons(available) {
  const headerButton = $("installApp");
  const settingsButton = $("installAppSettings");

  if (headerButton) headerButton.hidden = !available;
  if (settingsButton) {
    settingsButton.disabled = !available;
    settingsButton.textContent = available ? "Install App" : "Install option unavailable";
  }
}

async function promptInstall() {
  if (!installPromptEvent) {
    showToast("Use your browser menu to install, if available.");
    return;
  }

  installPromptEvent.prompt();

  try {
    await installPromptEvent.userChoice;
  } catch (error) {
    console.warn("Install prompt result unavailable.");
  }

  installPromptEvent = null;
  updateInstallButtons(false);
}

function initPWA() {
  updateInstallButtons(false);

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPromptEvent = event;
    updateInstallButtons(true);
  });

  window.addEventListener("appinstalled", () => {
    installPromptEvent = null;
    updateInstallButtons(false);
    showToast("LifeMate installation completed.");
  });

  $("installApp").addEventListener("click", promptInstall);
  $("installAppSettings").addEventListener("click", promptInstall);

  const installHelp = $("installHelp");
  if (installHelp && window.matchMedia("(display-mode: standalone)").matches) {
    installHelp.textContent = "LifeMate is running in its installed app window.";
  }
}

  
/* ------------------------------------------
   SERVICE WORKER + AUTO UPDATE
------------------------------------------ */

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  let updatePromptShown = false;
  let refreshing = false;

  const hadController = Boolean(
    navigator.serviceWorker.controller
  );

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hadController && !refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });

  function offerLifeMateUpdate(worker) {
    if (!worker || updatePromptShown) return;

    updatePromptShown = true;

    const accepted = window.confirm(
      "LifeMate Offline-এর নতুন আপডেট পাওয়া গেছে!\n\n" +
      "Update now চাপলে নতুন ভার্সন চালু হবে।"
    );

    if (accepted) {
      worker.postMessage("SKIP_WAITING");
    }
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js")
      .then((registration) => {
        console.log("LifeMate service worker registered.");

        if (
          registration.waiting &&
          navigator.serviceWorker.controller
        ) {
          offerLifeMateUpdate(registration.waiting);
        }

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;

          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              offerLifeMateUpdate(
                registration.waiting || newWorker
              );
            }
          });
        });

        registration.update().catch((error) => {
          console.warn("Update check failed:", error);
        });
      })
      .catch((error) => {
        console.error(
          "Service worker registration failed:",
          error
        );
      });
  });
}


/* ------------------------------------------
   RENDER ALL
------------------------------------------ */

function renderAll() {
  renderMoney();
  renderShopping();
  renderHabits();
  renderDiary();
  renderWater();
  renderTodos();
  renderDashboard();
}

/* ------------------------------------------
   START APP
------------------------------------------ */

function initApp() {
  initTheme();
  initNavigation();
  initMoney();
  initShopping();
  initHabits();
  initDiary();
  initWater();
  initTodos();
  initQR();
  initBackup();
  initPinLock();
  initPWA();

  renderAll();
  showPage("home");

  console.log("LifeMate Offline by MASTERMIND is ready.");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
