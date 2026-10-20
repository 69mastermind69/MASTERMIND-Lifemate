
"use strict";

/* =========================================================
   LifeMate Offline — MASTERMIND Ultimate
   Offline-first personal organizer
   ========================================================= */

const STORAGE_KEY = "lifemate_mastermind_v1";
const THEME_KEY = "lifemate_theme_mastermind_v1";
const PIN_KEY = "lifemate_pin_hash_mastermind_v1";
const WATER_TARGET = 2000;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const todayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const makeId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const escapeText = value => String(value ?? "");

const defaultData = () => ({
  money: [],
  shopping: [],
  habits: [],
  diary: [],
  water: { date: todayString(), count: 0 },
  todos: [],
  planner: [],
  moods: [],
  goals: [],
  notes: [],
  pomodoro: { sessions: 0 }
});

let data = defaultData();
let activePage = "home";
let installPromptEvent = null;
let toastTimeout = null;
let timerInterval = null;
let timerRemaining = 25 * 60;
let timerDuration = 25 * 60;
let timerRunning = false;
let timerMode = "Focus";
let completedSessions = 0;
let pinUnlocked = false;
let pinAttempts = 0;

/* ---------- GENERAL HELPERS ---------- */

function showToast(message) {
  const toast = $("#toast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("show"), 2800);
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = String(text);
  return element;
}

function clearElement(element) {
  if (element) element.replaceChildren();
}

function formatMoney(amount) {
  const value = Number(amount) || 0;
  return "৳" + value.toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatDate(date) {
  if (!date) return "";
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(date);
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function normalizeRecord(record, prefix = "item") {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return { id: makeId(), title: String(record ?? ""), createdAt: Date.now() };
  }

  return {
    ...record,
    id: record.id || `${prefix}-${makeId()}`
  };
}

function ensureDataShape(input) {
  const result = {
    ...defaultData(),
    ...(input && typeof input === "object" ? input : {})
  };

  for (const key of [
    "money", "shopping", "habits", "diary", "todos",
    "planner", "moods", "goals", "notes"
  ]) {
    if (!Array.isArray(result[key])) result[key] = [];
  }

  result.money = result.money.map(item => normalizeRecord(item, "money"));
  result.shopping = result.shopping.map(item => normalizeRecord(item, "shopping"));
  result.habits = result.habits.map(item => normalizeRecord(item, "habit"));
  result.diary = result.diary.map(item => normalizeRecord(item, "diary"));
  result.todos = result.todos.map(item => normalizeRecord(item, "todo"));
  result.planner = result.planner.map(item => normalizeRecord(item, "plan"));
  result.moods = result.moods.map(item => normalizeRecord(item, "mood"));
  result.goals = result.goals.map(item => normalizeRecord(item, "goal"));
  result.notes = result.notes.map(item => normalizeRecord(item, "note"));

  if (!result.water || typeof result.water !== "object") {
    result.water = { date: todayString(), count: 0 };
  }

  if (result.water.date !== todayString()) {
    result.water = { date: todayString(), count: 0 };
  }

  result.water.count = Math.max(0, Number(result.water.count) || 0);

  if (!result.pomodoro || typeof result.pomodoro !== "object") {
    result.pomodoro = { sessions: 0 };
  }

  result.pomodoro.sessions = Math.max(0, Number(result.pomodoro.sessions) || 0);

  return result;
}

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    data = saved ? ensureDataShape(JSON.parse(saved)) : defaultData();
  } catch (error) {
    console.error("Could not load LifeMate data:", error);
    data = defaultData();
    showToast("Saved data could not be read. Check your browser storage.");
  }

  saveData(false);
}

function saveData(notify = false) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    if (notify) showToast("Saved successfully.");
    return true;
  } catch (error) {
    console.error("Could not save LifeMate data:", error);
    showToast("Could not save. Browser storage may be full.");
    return false;
  }
}

function addActionButton(container, label, action, className = "") {
  const button = makeElement("button", className || "small-btn", label);
  button.type = "button";
  button.addEventListener("click", action);
  container.append(button);
  return button;
}

function createItemActions() {
  return makeElement("div", "item-actions");
}

function getField(record, candidates, fallback = "") {
  for (const key of candidates) {
    if (record[key] !== undefined && record[key] !== null) {
      return record[key];
    }
  }
  return fallback;
}

/* ---------- THEME ---------- */

function applyTheme(theme) {
  const selected = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = selected;

  const meta = $('meta[name="theme-color"]');
  if (meta) {
    meta.content = selected === "dark" ? "#170b0e" : "#f7f1f3";
  }

  try {
    localStorage.setItem(THEME_KEY, selected);
  } catch (error) {
    console.warn("Could not save theme preference.", error);
  }
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === "dark"
    ? "light"
    : "dark";
  applyTheme(next);
  showToast(`${next === "dark" ? "Dark" : "Light"} theme enabled.`);
}

function initTheme() {
  let savedTheme = "dark";
  try {
    savedTheme = localStorage.getItem(THEME_KEY) || "dark";
  } catch {}
  applyTheme(savedTheme);
}

/* ---------- NAVIGATION ---------- */

function navigateTo(page) {
  const target = document.getElementById(page);
  if (!target || !target.classList.contains("page")) return;

  activePage = page;

  $$(".page[data-page-section]").forEach(section => {
    const isActive = section.id === page;
    section.classList.toggle("active", isActive);
    section.hidden = !isActive;
  });

  $$("[data-page]").forEach(button => {
    button.classList.toggle("active", button.dataset.page === page);
    if (button.classList.contains("nav-link") ||
        button.classList.contains("bottom-nav-item")) {
      button.setAttribute("aria-current", button.dataset.page === page ? "page" : "false");
    }
  });

  if (page === "pomodoro") updateTimerDisplay();

  if (page === "search" && $("#globalSearchInput")?.value.trim()) {
    runGlobalSearch($("#globalSearchInput").value);
  }

  if (page === "calendar") renderPlanner();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function initNavigation() {
  $$("[data-page]").forEach(button => {
    button.addEventListener("click", () => navigateTo(button.dataset.page));
  });

  $$("[data-page-link]").forEach(link => {
    link.addEventListener("click", event => {
      event.preventDefault();
      navigateTo(link.dataset.pageLink);
    });
  });
}

/* ---------- DASHBOARD ---------- */

function getMoneyTotals() {
  return data.money.reduce((totals, item) => {
    const amount = Math.max(0, Number(item.amount) || 0);
    const type = item.type || item.kind;
    if (type === "income") totals.income += amount;
    else if (type === "expense") totals.expense += amount;
    return totals;
  }, { income: 0, expense: 0 });
}

function renderDashboard() {
  const now = new Date();
  const dateEl = $("#dashboardDate");
  if (dateEl) {
    dateEl.textContent = now.toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  }

  const totals = getMoneyTotals();
  const pending = data.todos.filter(todo =>
    !(todo.completed || todo.done)
  ).length;

  const values = {
    dashIncome: formatMoney(totals.income),
    dashExpense: formatMoney(totals.expense),
    dashBalance: formatMoney(totals.income - totals.expense),
    dashTasks: pending
  };

  Object.entries(values).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) element.textContent = String(value);
  });

  const completed = data.todos.filter(todo =>
    todo.completed || todo.done
  ).length;
  const taskTotal = data.todos.length;
  const progress = taskTotal ? Math.round(completed / taskTotal * 100) : 0;

  const progressText = $("#dashProgressPercent");
  if (progressText) progressText.textContent = `${progress}%`;

  const progressBar = $("#dashProgressBar");
  if (progressBar) {
    progressBar.setAttribute("aria-valuenow", String(progress));
    const fill = $("span", progressBar);
    if (fill) fill.style.width = `${progress}%`;
  }

  const waterPercent = Math.min(100, Math.round(data.water.count / WATER_TARGET * 100));

  const waterText = $("#dashWaterText");
  if (waterText) {
    waterText.textContent = `${data.water.count} / ${WATER_TARGET} ml`;
  }

  const waterBar = $("#dashWaterBar");
  if (waterBar) {
    waterBar.setAttribute("aria-valuenow", String(data.water.count));
    const fill = $("span", waterBar);
    if (fill) fill.style.width = `${waterPercent}%`;
  }

  const waterPercentEl = $("#dashWaterPercent");
  if (waterPercentEl) waterPercentEl.textContent = `${waterPercent}% of daily target`;

  renderDashboardHabits();
  renderDashboardShopping();
}

function renderDashboardHabits() {
  const container = $("#dashHabitSummary");
  if (!container) return;
  clearElement(container);

  if (!data.habits.length) {
    container.append(makeElement("p", "empty-state", "Your habits will appear here."));
    return;
  }

  data.habits.slice(0, 4).forEach(habit => {
    const row = makeElement("div", "list-item");
    const name = getField(habit, ["name", "title", "text"], "Untitled habit");
    const done = habit.doneDates?.includes(todayString()) ||
      habit.completedDates?.includes(todayString()) ||
      habit.lastCompleted === todayString();

    row.append(
      makeElement("span", "", name),
      makeElement("span", done ? "money-positive" : "muted", done ? "Done ✓" : "In progress")
    );
    container.append(row);
  });
}

function renderDashboardShopping() {
  const container = $("#dashShoppingSummary");
  if (!container) return;
  clearElement(container);

  const pending = data.shopping.filter(item =>
    !(item.done || item.completed || item.checked)
  );

  if (!pending.length) {
    container.append(makeElement("p", "empty-state", "Your shopping items will appear here."));
    return;
  }

  pending.slice(0, 4).forEach(item => {
    container.append(makeElement(
      "div",
      "list-item",
      getField(item, ["text", "name", "title", "item"], "Shopping item")
    ));
  });
}

/* ---------- MONEY MANAGER ---------- */

function renderMoney() {
  const totals = getMoneyTotals();
  const balance = totals.income - totals.expense;

  if ($("#totalIncome")) $("#totalIncome").textContent = formatMoney(totals.income);
  if ($("#totalExpense")) $("#totalExpense").textContent = formatMoney(totals.expense);
  if ($("#balance")) $("#balance").textContent = formatMoney(balance);

  const list = $("#moneyList");
  if (list) {
    clearElement(list);

    const sorted = [...data.money].sort((a, b) =>
      Number(b.createdAt || b.timestamp || 0) - Number(a.createdAt || a.timestamp || 0)
    );

    if (!sorted.length) {
      list.append(makeElement("p", "empty-state", "No transactions yet."));
    }

    sorted.forEach(item => {
      const type = item.type || item.kind || "expense";
      const row = makeElement("div", "money-item");
      const content = makeElement("div", "item-content");
      const note = getField(item, ["note", "description", "title"], "Transaction");
      const date = item.date || (item.createdAt ? new Date(item.createdAt).toISOString().slice(0, 10) : "");

      content.append(
        makeElement("h3", "", note),
        makeElement("p", "item-meta", `${type === "income" ? "Income" : "Expense"}${date ? " · " + formatDate(date) : ""}`)
      );

      const actions = createItemActions();
      actions.append(makeElement(
        "strong",
        type === "income" ? "money-positive" : "money-negative",
        `${type === "income" ? "+" : "−"}${formatMoney(item.amount)}`
      ));

      addActionButton(actions, "Delete", () => {
        if (!confirm("Delete this transaction?")) return;
        data.money = data.money.filter(entry => entry.id !== item.id);
        saveData();
        renderAll();
        showToast("Transaction deleted.");
      });

      row.append(content, actions);
      list.append(row);
    });
  }

  renderMoneyChart(totals);
}

function renderMoneyChart(totals) {
  const container = $("#moneyChart");
  if (!container) return;
  clearElement(container);

  const max = Math.max(totals.income, totals.expense, 1);

  const rows = [
    { label: "Income", amount: totals.income, className: "money-positive" },
    { label: "Expenses", amount: totals.expense, className: "money-negative" }
  ];

  rows.forEach(item => {
    const wrap = makeElement("div", "chart-row");
    wrap.style.marginBottom = "18px";

    const labelRow = makeElement("div");
    labelRow.style.display = "flex";
    labelRow.style.justifyContent = "space-between";
    labelRow.style.gap = "12px";
    labelRow.style.marginBottom = "7px";

    labelRow.append(
      makeElement("span", "", item.label),
      makeElement("strong", item.className, formatMoney(item.amount))
    );

    const track = makeElement("div", "progress-track");
    const fill = makeElement("span");
    fill.style.width = `${item.amount / max * 100}%`;
    if (item.label === "Expenses") fill.style.background = "var(--danger)";
    track.append(fill);

    wrap.append(labelRow, track);
    container.append(wrap);
  });

  if (!data.money.length) {
    container.append(makeElement("p", "empty-state", "Add transactions to see your overview."));
  }
}

function initMoney() {
  $("#moneyForm")?.addEventListener("submit", event => {
    event.preventDefault();

    const type = $("#moneyType")?.value;
    const amount = Number($("#moneyAmount")?.value);
    const note = $("#moneyNote")?.value.trim() || (type === "income" ? "Income" : "Expense");

    if (!["income", "expense"].includes(type)) {
      showToast("Choose a valid transaction type.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      showToast("Enter an amount greater than zero.");
      return;
    }

    data.money.push({
      id: makeId(),
      type,
      amount,
      note,
      date: todayString(),
      createdAt: Date.now()
    });

    saveData();
    $("#moneyForm").reset();
    renderAll();
    showToast("Transaction added.");
  });
}

/* ---------- SHOPPING LIST ---------- */

function renderShopping() {
  const list = $("#shoppingList");
  if (!list) return;
  clearElement(list);

  if (!data.shopping.length) {
    list.append(makeElement("p", "empty-state", "Your shopping list is empty."));
    return;
  }

  data.shopping.forEach(item => {
    const done = Boolean(item.done || item.completed || item.checked);
    const name = getField(item, ["text", "name", "title", "item"], "Shopping item");
    const row = makeElement("div", `shopping-item${done ? " is-done" : ""}`);

    const label = makeElement("label");
    const checkbox = makeElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = done;
    checkbox.setAttribute("aria-label", `Mark ${name} as ${done ? "not bought" : "bought"}`);

    checkbox.addEventListener("change", () => {
      item.done = checkbox.checked;
      item.completed = checkbox.checked;
      saveData();
      renderAll();
    });

    label.append(checkbox, makeElement("span", "item-title", name));

    const actions = createItemActions();
    addActionButton(actions, "Delete", () => {
      data.shopping = data.shopping.filter(entry => entry.id !== item.id);
      saveData();
      renderAll();
      showToast("Shopping item removed.");
    });

    row.append(label, actions);
    list.append(row);
  });
}

function initShopping() {
  $("#shoppingForm")?.addEventListener("submit", event => {
    event.preventDefault();
    const input = $("#shoppingInput");
    const text = input?.value.trim();
    if (!text) return;

    data.shopping.push({
      id: makeId(),
      text,
      done: false,
      createdAt: Date.now()
    });

    saveData();
    event.target.reset();
    renderAll();
    showToast("Shopping item added.");
  });
}

/* ---------- HABITS AND STREAKS ---------- */

function habitIsDoneToday(habit) {
  const today = todayString();
  return habit.doneDates?.includes(today) ||
    habit.completedDates?.includes(today) ||
    habit.lastCompleted === today;
}

function getHabitDates(habit) {
  const dates = habit.doneDates || habit.completedDates || [];
  return Array.isArray(dates) ? [...new Set(dates)] : [];
}

function getHabitStreak(habit) {
  const dates = new Set(getHabitDates(habit));
  if (habit.lastCompleted) dates.add(habit.lastCompleted);

  let cursor = new Date(`${todayString()}T12:00:00`);
  if (!dates.has(todayString())) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;

  while (dates.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function renderHabits() {
  const list = $("#habitList");
  if (!list) return;
  clearElement(list);

  if (!data.habits.length) {
    list.append(makeElement("p", "empty-state", "No habits yet. Add your first habit above."));
    return;
  }

  data.habits.forEach(habit => {
    const done = habitIsDoneToday(habit);
    const name = getField(habit, ["name", "title", "text"], "Habit");
    const row = makeElement("div", `habit-item${done ? " is-done" : ""}`);

    const label = makeElement("label", "item-check");
    const checkbox = makeElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(done);
    checkbox.setAttribute("aria-label", `Mark habit ${name} complete today`);

    checkbox.addEventListener("change", () => {
      const today = todayString();
      const dates = getHabitDates(habit);

      const nextDates = checkbox.checked
        ? [...new Set([...dates, today])]
        : dates.filter(date => date !== today);

      habit.doneDates = nextDates;
      habit.completedDates = nextDates;
      habit.lastCompleted = nextDates.length
        ? [...nextDates].sort().at(-1)
        : "";

      saveData();
      renderAll();
    });

    label.append(checkbox, makeElement("span", "item-title", name));

    const actions = createItemActions();
    actions.append(makeElement("span", "habit-streak", `🔥 ${getHabitStreak(habit)} day streak`));

    addActionButton(actions, "Delete", () => {
      if (!confirm("Delete this habit and its streak history?")) return;
      data.habits = data.habits.filter(entry => entry.id !== habit.id);
      saveData();
      renderAll();
      showToast("Habit deleted.");
    });

    row.append(label, actions);
    list.append(row);
  });
}

function initHabits() {
  $("#habitForm")?.addEventListener("submit", event => {
    event.preventDefault();
    const input = $("#habitInput");
    const name = input?.value.trim();
    if (!name) return;

    data.habits.push({
      id: makeId(),
      name,
      doneDates: [],
      completedDates: [],
      createdAt: Date.now()
    });

    saveData();
    event.target.reset();
    renderAll();
    showToast("Habit added.");
  });
}

/* ---------- DIARY ---------- */

function renderDiary() {
  const list = $("#diaryList");
  if (!list) return;
  clearElement(list);

  const entries = [...data.diary].sort((a, b) =>
    String(b.date || "").localeCompare(String(a.date || ""))
  );

  if (!entries.length) {
    list.append(makeElement("p", "empty-state", "Your diary entries will appear here."));
    return;
  }

  entries.forEach(entry => {
    const date = entry.date || "";
    const text = getField(entry, ["text", "entry", "content", "note"], "");
    const row = makeElement("div", "diary-item");
    const content = makeElement("div", "diary-content");

    content.append(
      makeElement("h3", "", formatDate(date) || "Diary entry"),
      makeElement("p", "item-description", text)
    );

    const actions = createItemActions();

    addActionButton(actions, "Edit", () => {
      if ($("#diaryDate")) $("#diaryDate").value = date;
      if ($("#diaryText")) $("#diaryText").value = text;
      $("#diaryText")?.focus();
      editingDiaryId = entry.id;
      showToast("Edit the entry and save it.");
    });

    addActionButton(actions, "Delete", () => {
      if (!confirm("Delete this diary entry?")) return;
      data.diary = data.diary.filter(item => item.id !== entry.id);
      saveData();
      renderAll();
      showToast("Diary entry deleted.");
    });

    row.append(content, actions);
    list.append(row);
  });
}

let editingDiaryId = null;

function initDiary() {
  const dateInput = $("#diaryDate");
  if (dateInput && !dateInput.value) dateInput.value = todayString();

  $("#diaryForm")?.addEventListener("submit", event => {
    event.preventDefault();

    const date = $("#diaryDate")?.value || todayString();
    const text = $("#diaryText")?.value.trim();
    if (!text) return;

    if (editingDiaryId) {
      const existing = data.diary.find(item => item.id === editingDiaryId);
      if (existing) {
        existing.date = date;
        existing.text = text;
        existing.entry = text;
        existing.updatedAt = Date.now();
      }
      editingDiaryId = null;
    } else {
      data.diary.push({
        id: makeId(),
        date,
        text,
        createdAt: Date.now()
      });
    }

    saveData();
    $("#diaryText").value = "";
    $("#diaryDate").value = todayString();
    renderAll();
    showToast("Diary entry saved.");
  });
}

/* ---------- WATER TRACKER ---------- */

function refreshWaterDay() {
  if (data.water.date !== todayString()) {
    data.water = { date: todayString(), count: 0 };
    saveData();
  }
}

function renderWater() {
  refreshWaterDay();

  const count = data.water.count;
  const percent = Math.min(100, Math.round(count / WATER_TARGET * 100));

  if ($("#waterCount")) $("#waterCount").textContent = `${count} ml`;
  if ($("#waterProgressText")) {
    $("#waterProgressText").textContent = `${percent}% of ${WATER_TARGET} ml target`;
  }

  const progress = $("#waterProgress");
  if (progress) {
    progress.setAttribute("aria-valuenow", String(count));
    const fill = $("span", progress);
    if (fill) fill.style.width = `${percent}%`;
  }
}

function initWater() {
  $("#waterAdd")?.addEventListener("click", () => {
    refreshWaterDay();
    data.water.count += 250;
    saveData();
    renderAll();
    showToast("Added 250 ml.");
  });

  $("#waterRemove")?.addEventListener("click", () => {
    refreshWaterDay();
    data.water.count = Math.max(0, data.water.count - 250);
    saveData();
    renderAll();
  });

  $("#waterReset")?.addEventListener("click", () => {
    if (!confirm("Reset today's water count?")) return;
    data.water = { date: todayString(), count: 0 };
    saveData();
    renderAll();
    showToast("Water tracker reset.");
  });
}

/* ---------- TASKS ---------- */

function renderTodos() {
  const list = $("#todoList");
  if (!list) return;
  clearElement(list);

  if (!data.todos.length) {
    list.append(makeElement("p", "empty-state", "No tasks yet. Add your first task above."));
    return;
  }

  const sorted = [...data.todos].sort((a, b) =>
    Number(Boolean(a.completed || a.done)) - Number(Boolean(b.completed || b.done))
  );

  sorted.forEach(todo => {
    const done = Boolean(todo.completed || todo.done);
    const text = getField(todo, ["text", "title", "task", "name"], "Task");
    const row = makeElement("div", `todo-item${done ? " is-done" : ""}`);

    const label = makeElement("label");
    const checkbox = makeElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = done;
    checkbox.setAttribute("aria-label", `Mark task ${text} complete`);

    checkbox.addEventListener("change", () => {
      todo.completed = checkbox.checked;
      todo.done = checkbox.checked;
      todo.completedAt = checkbox.checked ? Date.now() : null;
      saveData();
      renderAll();
    });

    label.append(checkbox, makeElement("span", "item-title", text));

    const actions = createItemActions();
    addActionButton(actions, "Delete", () => {
      data.todos = data.todos.filter(item => item.id !== todo.id);
      saveData();
      renderAll();
      showToast("Task deleted.");
    });

    row.append(label, actions);
    list.append(row);
  });
}

function initTodos() {
  $("#todoForm")?.addEventListener("submit", event => {
    event.preventDefault();
    const input = $("#todoInput");
    const text = input?.value.trim();
    if (!text) return;

    data.todos.push({
      id: makeId(),
      text,
      completed: false,
      createdAt: Date.now()
    });

    saveData();
    event.target.reset();
    renderAll();
    showToast("Task added.");
  });
}

/* ---------- CALENDAR AND PLANNER ---------- */

function renderPlanner() {
  const list = $("#plannerList");
  if (!list) return;
  clearElement(list);

  const filterDate = $("#plannerFilterDate")?.value || "";
  const entries = data.planner
    .filter(item => !filterDate || item.date === filterDate)
    .sort((a, b) =>
      `${a.date || ""} ${a.time || ""}`.localeCompare(`${b.date || ""} ${b.time || ""}`)
    );

  if (!entries.length) {
    list.append(makeElement("p", "empty-state", "No plans for this date."));
    return;
  }

  entries.forEach(plan => {
    const row = makeElement("div", "planner-item");
    const content = makeElement("div", "item-content");

    content.append(
      makeElement("time", "", `${formatDate(plan.date)}${plan.time ? " · " + plan.time : ""}`),
      makeElement("h3", "", plan.title || "Untitled plan")
    );

    if (plan.details) {
      content.append(makeElement("p", "item-description", plan.details));
    }

    const actions = createItemActions();

    addActionButton(actions, "Edit", () => {
      $("#plannerDate").value = plan.date || todayString();
      $("#plannerTime").value = plan.time || "";
      $("#plannerTitle").value = plan.title || "";
      $("#plannerDetails").value = plan.details || "";
      editingPlanId = plan.id;
      $("#plannerTitle")?.focus();
      showToast("Edit the plan and save it.");
    });

    addActionButton(actions, "Delete", () => {
      data.planner = data.planner.filter(item => item.id !== plan.id);
      saveData();
      renderAll();
      showToast("Plan deleted.");
    });

    row.append(content, actions);
    list.append(row);
  });
}

let editingPlanId = null;

function initPlanner() {
  if ($("#plannerDate") && !$("#plannerDate").value) {
    $("#plannerDate").value = todayString();
  }
  if ($("#plannerFilterDate") && !$("#plannerFilterDate").value) {
    $("#plannerFilterDate").value = todayString();
  }

  $("#plannerFilterDate")?.addEventListener("change", renderPlanner);

  $("#plannerForm")?.addEventListener("submit", event => {
    event.preventDefault();

    const plan = {
      date: $("#plannerDate")?.value || todayString(),
      time: $("#plannerTime")?.value || "",
      title: $("#plannerTitle")?.value.trim() || "",
      details: $("#plannerDetails")?.value.trim() || ""
    };

    if (!plan.title) return;

    if (editingPlanId) {
      const existing = data.planner.find(item => item.id === editingPlanId);
      if (existing) Object.assign(existing, plan, { updatedAt: Date.now() });
      editingPlanId = null;
    } else {
      data.planner.push({ id: makeId(), ...plan, createdAt: Date.now() });
    }

    saveData();
    event.target.reset();
    $("#plannerDate").value = todayString();
    $("#plannerFilterDate").value = plan.date;
    renderAll();
    showToast("Plan saved.");
  });
}

/* ---------- POMODORO TIMER ---------- */

function updateTimerDisplay() {
  const minutes = Math.floor(timerRemaining / 60);
  const seconds = timerRemaining % 60;

  if ($("#pomodoroDisplay")) {
    $("#pomodoroDisplay").textContent =
      `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  if ($("#pomodoroMode")) {
    $("#pomodoroMode").textContent = timerRunning ? `${timerMode} in progress` : `${timerMode}`;
  }

  if ($("#pomodoroSessions")) {
    $("#pomodoroSessions").textContent = `Sessions completed: ${completedSessions}`;
  }

  if ($("#pomodoroStart")) $("#pomodoroStart").disabled = timerRunning;
  if ($("#pomodoroPause")) $("#pomodoroPause").disabled = !timerRunning;
}

function stopTimer() {
  timerRunning = false;
  if (timerInterval !== null) clearInterval(timerInterval);
  timerInterval = null;
  updateTimerDisplay();
}

function setTimer(minutes, mode) {
  stopTimer();
  timerDuration = minutes * 60;
  timerRemaining = timerDuration;
  timerMode = mode;
  updateTimerDisplay();
}

function startTimer() {
  if (timerRunning) return;

  if (timerRemaining <= 0) timerRemaining = timerDuration;
  timerRunning = true;
  updateTimerDisplay();

  timerInterval = setInterval(() => {
    if (timerRemaining > 0) timerRemaining--;

    if (timerRemaining <= 0) {
      stopTimer();

      if (timerMode === "Focus") {
        completedSessions++;
        data.pomodoro.sessions = completedSessions;
        saveData();
      }

      showToast(`${timerMode} session complete!`);
      updateTimerDisplay();
      return;
    }

    updateTimerDisplay();
  }, 1000);
}

function initPomodoro() {
  completedSessions = Number(data.pomodoro.sessions) || 0;

  $$("[data-timer-minutes]").forEach(button => {
    button.addEventListener("click", () => {
      const minutes = Number(button.dataset.timerMinutes);
      const mode = minutes === 25 ? "Focus" : minutes === 5 ? "Short break" : "Long break";
      setTimer(minutes, mode);
    });
  });

  $("#pomodoroStart")?.addEventListener("click", startTimer);
  $("#pomodoroPause")?.addEventListener("click", () => {
    stopTimer();
    showToast("Timer paused.");
  });

  $("#pomodoroReset")?.addEventListener("click", () => {
    stopTimer();
    timerRemaining = timerDuration;
    updateTimerDisplay();
  });

  updateTimerDisplay();
}

/* ---------- MOOD TRACKER ---------- */

function renderMoods() {
  const list = $("#moodList");
  if (!list) return;
  clearElement(list);

  const entries = [...data.moods].sort((a, b) =>
    String(b.date || "").localeCompare(String(a.date || ""))
  );

  if (!entries.length) {
    list.append(makeElement("p", "empty-state", "Your mood check-ins will appear here."));
    return;
  }

  const moodLabels = {
    great: "😄 Great",
    good: "🙂 Good",
    okay: "😐 Okay",
    low: "😔 Low",
    stressed: "😣 Stressed"
  };

  entries.forEach(item => {
    const row = makeElement("div", "mood-item");
    const content = makeElement("div", "item-content");

    content.append(
      makeElement("h3", "", moodLabels[item.mood] || item.mood || "Mood"),
      makeElement("p", "item-meta", formatDate(item.date))
    );

    if (item.note) content.append(makeElement("p", "item-description", item.note));

    const actions = createItemActions();
    addActionButton(actions, "Delete", () => {
      data.moods = data.moods.filter(entry => entry.id !== item.id);
      saveData();
      renderAll();
      showToast("Mood entry deleted.");
    });

    row.append(content, actions);
    list.append(row);
  });
}

function initMoods() {
  $("#moodForm")?.addEventListener("submit", event => {
    event.preventDefault();

    const selected = $('input[name="mood"]:checked');
    if (!selected) {
      showToast("Choose a mood first.");
      return;
    }

    const note = $("#moodNote")?.value.trim() || "";
    const existing = data.moods.find(item => item.date === todayString());

    if (existing) {
      existing.mood = selected.value;
      existing.note = note;
      existing.updatedAt = Date.now();
    } else {
      data.moods.push({
        id: makeId(),
        date: todayString(),
        mood: selected.value,
        note,
        createdAt: Date.now()
      });
    }

    saveData();
    renderAll();
    showToast("Mood saved.");
  });
}

/* ---------- GOALS ---------- */

function renderGoals() {
  const list = $("#goalList");
  if (!list) return;
  clearElement(list);

  if (!data.goals.length) {
    list.append(makeElement("p", "empty-state", "Your goals will appear here."));
    return;
  }

  data.goals.forEach(goal => {
    const row = makeElement("div", "goal-item");
    const content = makeElement("div", "item-content");
    const title = getField(goal, ["title", "name", "text"], "Goal");
    const target = Math.max(1, Number(goal.target) || 1);
    const progress = Math.min(target, Math.max(0, Number(goal.progress) || 0));
    const percent = Math.round(progress / target * 100);

    content.append(makeElement("h3", "", title));

    if (goal.deadline) {
      content.append(makeElement("p", "item-meta", `Target date: ${formatDate(goal.deadline)}`));
    }

    const progressWrap = makeElement("div", "goal-progress");
    const progressTrack = makeElement("div", "progress-track");
    const fill = makeElement("span");
    fill.style.width = `${percent}%`;
    progressTrack.append(fill);

    progressWrap.append(
      makeElement("p", "", `${progress} / ${target} steps · ${percent}%`),
      progressTrack
    );
    content.append(progressWrap);

    const actions = createItemActions();

    addActionButton(actions, "+1 step", () => {
      goal.progress = Math.min(target, (Number(goal.progress) || 0) + 1);
      if (goal.progress >= target) goal.completed = true;
      saveData();
      renderAll();
      showToast("Goal progress updated.");
    });

    addActionButton(actions, "−1 step", () => {
      goal.progress = Math.max(0, (Number(goal.progress) || 0) - 1);
      goal.completed = false;
      saveData();
      renderAll();
    });

    addActionButton(actions, "Delete", () => {
      if (!confirm("Delete this goal?")) return;
      data.goals = data.goals.filter(item => item.id !== goal.id);
      saveData();
      renderAll();
    });

    row.append(content, actions);
    list.append(row);
  });
}

function initGoals() {
  $("#goalForm")?.addEventListener("submit", event => {
    event.preventDefault();

    const title = $("#goalTitle")?.value.trim();
    const target = Number($("#goalTarget")?.value);
    const deadline = $("#goalDeadline")?.value || "";

    if (!title || !Number.isInteger(target) || target < 1) {
      showToast("Enter a goal title and a valid target.");
      return;
    }

    data.goals.push({
      id: makeId(),
      title,
      target,
      progress: 0,
      deadline,
      completed: false,
      createdAt: Date.now()
    });

    saveData();
    event.target.reset();
    if ($("#goalTarget")) $("#goalTarget").value = "10";
    renderAll();
    showToast("Goal created.");
  });
}

/* ---------- NOTES ---------- */

function renderNotes() {
  const list = $("#notesList");
  if (!list) return;
  clearElement(list);

  const entries = [...data.notes].sort((a, b) =>
    Number(b.updatedAt || b.createdAt || 0) -
    Number(a.updatedAt || a.createdAt || 0)
  );

  if (!entries.length) {
    list.append(makeElement("p", "empty-state", "No notes yet."));
    return;
  }

  entries.forEach(note => {
    const row = makeElement("div", "note-item");
    const content = makeElement("div", "note-content");

    content.append(
      makeElement("h3", "", note.title || "Untitled note"),
      makeElement("p", "item-description", note.content || ""),
      makeElement("p", "item-meta", `Updated ${formatDate(note.updatedAt ? new Date(note.updatedAt).toISOString().slice(0, 10) : note.date || todayString())}`)
    );

    const actions = createItemActions();

    addActionButton(actions, "Edit", () => {
      $("#noteTitle").value = note.title || "";
      $("#noteContent").value = note.content || "";
      editingNoteId = note.id;
      $("#noteTitle")?.focus();
      showToast("Edit your note and save it.");
    });

    addActionButton(actions, "Delete", () => {
      if (!confirm("Delete this note?")) return;
      data.notes = data.notes.filter(item => item.id !== note.id);
      saveData();
      renderAll();
      showToast("Note deleted.");
    });

    row.append(content, actions);
    list.append(row);
  });
}

let editingNoteId = null;

function initNotes() {
  $("#noteForm")?.addEventListener("submit", event => {
    event.preventDefault();

    const title = $("#noteTitle")?.value.trim();
    const content = $("#noteContent")?.value.trim();
    if (!title || !content) return;

    if (editingNoteId) {
      const existing = data.notes.find(item => item.id === editingNoteId);
      if (existing) {
        existing.title = title;
        existing.content = content;
        existing.updatedAt = Date.now();
      }
      editingNoteId = null;
    } else {
      data.notes.push({
        id: makeId(),
        title,
        content,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }

    saveData();
    event.target.reset();
    renderAll();
    showToast("Note saved.");
  });
}

/* ---------- SAFE CALCULATOR ---------- */

/*
  A small arithmetic parser is used instead of eval().
  Supported: + - * / parentheses and decimals.
*/

function calculateExpression(source) {
  const input = source.replace(/[×]/g, "*").replace(/[÷]/g, "/").replace(/[−]/g, "-");
  const tokens = input.match(/\d*\.?\d+|[()+\-*/]/g) || [];

  if (!input.trim() || tokens.join("") !== input.replace(/\s+/g, "")) {
    throw new Error("Invalid expression");
  }

  let position = 0;

  function expression() {
    let value = term();

    while (tokens[position] === "+" || tokens[position] === "-") {
      const operator = tokens[position++];
      const right = term();
      value = operator === "+" ? value + right : value - right;
    }

    return value;
  }

  function term() {
    let value = factor();

    while (tokens[position] === "*" || tokens[position] === "/") {
      const operator = tokens[position++];
      const right = factor();

      if (operator === "/" && right === 0) {
        throw new Error("Cannot divide by zero");
      }

      value = operator === "*" ? value * right : value / right;
    }

    return value;
  }

  function factor() {
    const token = tokens[position];

    if (token === "+") {
      position++;
      return factor();
    }

    if (token === "-") {
      position++;
      return -factor();
    }

    if (token === "(") {
      position++;
      const value = expression();

      if (tokens[position] !== ")") throw new Error("Missing closing parenthesis");
      position++;
      return value;
    }

    if (token === undefined || !/^\d*\.?\d+$/.test(token)) {
      throw new Error("Invalid expression");
    }

    position++;
    return Number(token);
  }

  const result = expression();

  if (position !== tokens.length || !Number.isFinite(result)) {
    throw new Error("Invalid expression");
  }

  return Number(result.toPrecision(12));
}

function initCalculator() {
  const display = $("#calculatorDisplay");
  const resultEl = $("#calculatorResult");

  function calculate() {
    if (!display || !resultEl) return;

    try {
      const result = calculateExpression(display.value);
      resultEl.textContent = `= ${result}`;
      return result;
    } catch {
      resultEl.textContent = "Check your calculation.";
      return null;
    }
  }

  $$(".calculator-grid [data-calc]").forEach(button => {
    button.addEventListener("click", () => {
      if (!display) return;
      const value = button.dataset.calc;

      if (value === "clear") {
        display.value = "";
        if (resultEl) resultEl.textContent = "";
      } else if (value === "backspace") {
        display.value = display.value.slice(0, -1);
      } else if (value === "equals") {
        calculate();
      } else {
        display.value += value;
      }

      display.focus();
    });
  });

  display?.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === "=") {
      event.preventDefault();
      calculate();
    }
  });
}

/* ---------- QR GENERATOR ---------- */

function initQR() {
  $("#qrForm")?.addEventListener("submit", event => {
    event.preventDefault();

    const input = $("#qrInput")?.value.trim();
    const output = $("#qrOutput");
    if (!input || !output) return;

    clearElement(output);

    if (typeof window.QRCode !== "function") {
      output.append(makeElement(
        "p",
        "empty-state",
        "QR library is unavailable. Check that qrcode.min.js is in the app folder."
      ));
      return;
    }

    try {
      new window.QRCode(output, {
        text: input,
        width: 220,
        height: 220,
        colorDark: "#160b0f",
        colorLight: "#ffffff",
        correctLevel: window.QRCode.CorrectLevel?.H ?? 2
      });

      const downloadButton = makeElement("button", "btn btn-secondary", "Download QR code");
      downloadButton.type = "button";

      downloadButton.addEventListener("click", () => {
        const canvas = $("canvas", output);
        const image = $("img", output);

        let url = "";

        if (canvas) url = canvas.toDataURL("image/png");
        else if (image?.src) url = image.src;

        if (!url) {
          showToast("QR image is not ready yet.");
          return;
        }

        const link = document.createElement("a");
        link.href = url;
        link.download = "lifemate-qr.png";
        link.click();
      });

      output.append(downloadButton);
      showToast("QR code generated.");
    } catch (error) {
      console.error("QR generation failed:", error);
      output.append(makeElement("p", "empty-state", "Could not generate this QR code."));
    }
  });
}

/* ---------- GLOBAL SEARCH ---------- */

function runGlobalSearch(query) {
  const results = $("#globalSearchResults");
  if (!results) return;

  clearElement(results);
  const term = String(query || "").trim().toLowerCase();

  if (!term) {
    results.append(makeElement("p", "empty-state", "Type a word or phrase to search your saved data."));
    return;
  }

  const searchable = [];

  data.todos.forEach(item => searchable.push({
    type: "Task",
    title: getField(item, ["text", "title", "task", "name"], ""),
    body: "",
    page: "todo",
    id: item.id
  }));

  data.money.forEach(item => searchable.push({
    type: "Transaction",
    title: getField(item, ["note", "description", "title"], ""),
    body: `${item.type || ""} ${item.amount || ""}`,
    page: "money",
    id: item.id
  }));

  data.shopping.forEach(item => searchable.push({
    type: "Shopping",
    title: getField(item, ["text", "name", "title", "item"], ""),
    body: "",
    page: "shopping",
    id: item.id
  }));

  data.habits.forEach(item => searchable.push({
    type: "Habit",
    title: getField(item, ["name", "title", "text"], ""),
    body: "",
    page: "habits",
    id: item.id
  }));

  data.diary.forEach(item => searchable.push({
    type: "Diary",
    title: item.date || "Diary entry",
    body: getField(item, ["text", "entry", "content", "note"], ""),
    page: "diary",
    id: item.id
  }));

  data.planner.forEach(item => searchable.push({
    type: "Plan",
    title: item.title || "",
    body: item.details || "",
    page: "calendar",
    id: item.id
  }));

  data.moods.forEach(item => searchable.push({
    type: "Mood",
    title: `${item.mood || ""} ${item.date || ""}`,
    body: item.note || "",
    page: "mood",
    id: item.id
  }));

  data.goals.forEach(item => searchable.push({
    type: "Goal",
    title: item.title || "",
    body: "",
    page: "goals",
    id: item.id
  }));

  data.notes.forEach(item => searchable.push({
    type: "Note",
    title: item.title || "",
    body: item.content || "",
    page: "notes",
    id: item.id
  }));

  const matches = searchable.filter(item =>
    `${item.title} ${item.body} ${item.type}`.toLowerCase().includes(term)
  );

  if (!matches.length) {
    results.append(makeElement("p", "empty-state", "No matching results found."));
    return;
  }

  results.append(makeElement(
    "p",
    "muted",
    `${matches.length} result${matches.length === 1 ? "" : "s"} found`
  ));

  matches.slice(0, 100).forEach(item => {
    const row = makeElement("div", "list-item search-result");
    const content = makeElement("div", "item-content");

    content.append(
      makeElement("span", "tag", item.type),
      makeElement("h3", "", item.title || item.type)
    );

    if (item.body) {
      const excerpt = item.body.length > 220
        ? item.body.slice(0, 220) + "…"
        : item.body;
      content.append(makeElement("p", "item-description", excerpt));
    }

    const actions = createItemActions();
    addActionButton(actions, "Open", () => navigateTo(item.page));

    row.append(content, actions);
    results.append(row);
  });
}

function initSearch() {
  $("#globalSearchForm")?.addEventListener("submit", event => {
    event.preventDefault();
    runGlobalSearch($("#globalSearchInput")?.value || "");
  });

  $("#globalSearchInput")?.addEventListener("input", event => {
    if (event.target.value.trim()) runGlobalSearch(event.target.value);
    else {
      const results = $("#globalSearchResults");
      if (results) {
        clearElement(results);
        results.append(makeElement("p", "empty-state", "Type a word or phrase to search your saved data."));
      }
    }
  });
}

/* ---------- BACKUP EXPORT AND IMPORT ---------- */

function downloadTextFile(filename, content, type = "application/json") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function initBackup() {
  $("#exportBackup")?.addEventListener("click", () => {
    const backup = {
      app: "LifeMate Offline - MASTERMIND Ultimate",
      version: 2,
      exportedAt: new Date().toISOString(),
      data
    };

    downloadTextFile(
      `lifemate-backup-${todayString()}.json`,
      JSON.stringify(backup, null, 2)
    );

    showToast("Backup exported. Keep it somewhere private.");
  });

  $("#importBackupButton")?.addEventListener("click", () => {
    $("#importBackup")?.click();
  });

  $("#importBackup")?.addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const imported = parsed.data && typeof parsed.data === "object"
        ? parsed.data
        : parsed;

      const looksLikeBackup = imported &&
        ["money", "shopping", "habits", "diary", "todos", "planner", "notes", "goals"]
          .some(key => Array.isArray(imported[key]));

      if (!looksLikeBackup) {
        throw new Error("This file does not look like a LifeMate backup.");
      }

      if (!confirm("Importing this backup will replace your current LifeMate data. Continue?")) {
        event.target.value = "";
        return;
      }

      data = ensureDataShape(imported);
      saveData();
      renderAll();
      showToast("Backup restored successfully.");
    } catch (error) {
      console.error("Backup import failed:", error);
      showToast(error.message || "Could not import this backup.");
    } finally {
      event.target.value = "";
    }
  });

  $("#resetApp")?.addEventListener("click", () => {
    const confirmed = confirm(
      "This will permanently delete your saved LifeMate data from this browser. Export a backup first if you need one. Continue?"
    );

    if (!confirmed) return;

    data = defaultData();
    saveData();
    renderAll();
    showToast("App data reset.");
    navigateTo("home");
  });
}

/* ---------- PIN LOCK ---------- */

async function hashPin(pin) {
  if (window.crypto?.subtle && window.isSecureContext) {
    const bytes = new TextEncoder().encode(pin);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)]
      .map(byte => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  // Compatibility fallback for environments without Web Crypto.
  // This is not cryptographically secure.
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
  } catch {
    return null;
  }
}

function setAppLocked(locked) {
  const lockScreen = $("#lockScreen");
  const appShell = $("#appShell");

  if (lockScreen) lockScreen.hidden = !locked;
  if (appShell) appShell.hidden = locked;

  if (locked) {
    setTimeout(() => $("#pinInput")?.focus(), 50);
  } else {
    pinUnlocked = true;
  }
}

function initPinLock() {
  const savedHash = getSavedPinHash();

  if (savedHash) {
    setAppLocked(true);
    if ($("#lockTitle")) $("#lockTitle").textContent = "Welcome back";
    if ($("#lockMessage")) $("#lockMessage").textContent = "Enter your PIN to continue.";
    if ($("#pinHint")) $("#pinHint").textContent = "Your saved app data remains on this device.";
  } else {
    setAppLocked(false);
  }

  $("#pinForm")?.addEventListener("submit", async event => {
    event.preventDefault();

    const pin = $("#pinInput")?.value || "";
    const expected = getSavedPinHash();

    if (!expected) {
      setAppLocked(false);
      return;
    }

    if (pinAttempts >= 8) {
      showToast("Too many attempts. Reload the app before trying again.");
      return;
    }

    const enteredHash = await hashPin(pin);

    if (enteredHash === expected) {
      pinAttempts = 0;
      if ($("#pinInput")) $("#pinInput").value = "";
      setAppLocked(false);
      showToast("Welcome back.");
    } else {
      pinAttempts++;
      if ($("#lockMessage")) $("#lockMessage").textContent = "That PIN did not match. Try again.";
      if ($("#pinInput")) {
        $("#pinInput").value = "";
        $("#pinInput").focus();
      }
      showToast("Incorrect PIN.");
    }
  });

  $("#setPinForm")?.addEventListener("submit", async event => {
    event.preventDefault();

    const newPin = $("#newPin")?.value || "";
    const confirmPin = $("#confirmPin")?.value || "";

    if (newPin.length < 4) {
      showToast("Use a PIN with at least 4 characters.");
      return;
    }

    if (newPin !== confirmPin) {
      showToast("The PINs do not match.");
      return;
    }

    try {
      const hash = await hashPin(newPin);
      localStorage.setItem(PIN_KEY, hash);

      if ($("#pinStatus")) $("#pinStatus").textContent = "PIN saved on this device.";
      event.target.reset();
      showToast("PIN saved.");
    } catch (error) {
      console.error(error);
      showToast("Could not save the PIN.");
    }
  });

  $("#disablePin")?.addEventListener("click", () => {
    if (!getSavedPinHash()) {
      showToast("No PIN is currently set.");
      return;
    }

    if (!confirm("Disable the PIN lock on this device?")) return;

    localStorage.removeItem(PIN_KEY);
    if ($("#pinStatus")) $("#pinStatus").textContent = "PIN lock is disabled.";
    showToast("PIN lock disabled.");
  });

  $("#lockNow")?.addEventListener("click", () => {
    if (!getSavedPinHash()) {
      showToast("Set a PIN first to use the lock screen.");
      return;
    }
    setAppLocked(true);
  });
}

/* ---------- PWA INSTALL AND OFFLINE SUPPORT ---------- */

function initInstall() {
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    installPromptEvent = event;

    if ($("#installApp")) $("#installApp").hidden = false;
    if ($("#installAppSettings")) $("#installAppSettings").hidden = false;
  });

  async function installApp() {
    if (!installPromptEvent) {
      showToast("If installation is available, use your browser menu to install this app.");
      return;
    }

    installPromptEvent.prompt();
    await installPromptEvent.userChoice;
    installPromptEvent = null;

    if ($("#installApp")) $("#installApp").hidden = true;
    if ($("#installAppSettings")) $("#installAppSettings").hidden = true;
  }

  $("#installApp")?.addEventListener("click", installApp);
  $("#installAppSettings")?.addEventListener("click", installApp);

  $("#installHelp")?.addEventListener("click", () => {
    showToast("Open your browser menu and choose Install app or Add to Home Screen.");
  });

  window.addEventListener("appinstalled", () => {
    showToast("LifeMate installed.");
    if ($("#installApp")) $("#installApp").hidden = true;
    if ($("#installAppSettings")) $("#installAppSettings").hidden = true;
  });

  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js")
        .then(registration => {
          registration.update().catch(() => {});
        })
        .catch(error => {
          console.warn("Service worker registration failed:", error);
        });
    });
  }
}

/* ---------- SETTINGS ---------- */

function initSettings() {
  $("#themeToggle")?.addEventListener("click", toggleTheme);
  $("#themeToggleSettings")?.addEventListener("click", toggleTheme);
}

/* ---------- RENDER EVERYTHING ---------- */

function renderAll() {
  refreshWaterDay();
  renderDashboard();
  renderMoney();
  renderShopping();
  renderHabits();
  renderDiary();
  renderWater();
  renderTodos();
  renderPlanner();
  renderMoods();
  renderGoals();
  renderNotes();
  updateTimerDisplay();
}

/* ---------- INITIALIZATION ---------- */

function initApp() {
  loadData();
  initTheme();
  initNavigation();

  initMoney();
  initShopping();
  initHabits();
  initDiary();
  initWater();
  initTodos();
  initPlanner();
  initPomodoro();
  initMoods();
  initGoals();
  initNotes();
  initCalculator();
  initQR();
  initSearch();
  initBackup();
  initPinLock();
  initInstall();
  initSettings();

  renderAll();
  navigateTo("home");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp, { once: true });
} else {
  initApp();
}
