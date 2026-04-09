const STORAGE_KEY = "habitGardenStateV2";

const PALETTES = {
  mint: "tone-mint",
  sunset: "tone-sunset",
  citrus: "tone-citrus",
  berry: "tone-berry",
};

const KOREAN_DAYS = ["일", "월", "화", "수", "목", "금", "토"];
const WEEK_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

const habitForm = document.querySelector("#habitForm");
const habitEmojiInput = document.querySelector("#habitEmoji");
const habitNameInput = document.querySelector("#habitName");
const habitNoteInput = document.querySelector("#habitNote");
const habitColorInput = document.querySelector("#habitColor");
const habitTrack = document.querySelector("#habitTrack");
const emptyState = document.querySelector("#emptyState");
const carouselFooter = document.querySelector(".carousel-footer");
const carouselCount = document.querySelector("#carouselCount");
const pageDots = document.querySelector("#pageDots");
const prevHabitButton = document.querySelector("#prevHabit");
const nextHabitButton = document.querySelector("#nextHabit");
const todayLabel = document.querySelector("#todayLabel");
const activeCount = document.querySelector("#activeCount");
const doneTodayCount = document.querySelector("#doneTodayCount");
const strongestStreak = document.querySelector("#strongestStreak");
const weeklyRate = document.querySelector("#weeklyRate");
const insightTitle = document.querySelector("#insightTitle");
const insightText = document.querySelector("#insightText");
const weekOverview = document.querySelector("#weekOverview");
const presetButtons = Array.from(document.querySelectorAll(".preset-chip"));

let habits = loadHabits();
let currentIndex = 0;
let activeHabitId = null;
let scrollFrame = null;

function loadHabits() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeHabit);
  } catch (error) {
    console.error("Failed to load habits", error);
    return [];
  }
}

function normalizeHabit(habit) {
  const normalizedHistory = normalizeDateList(Array.isArray(habit.history) ? habit.history : []);
  return {
    id: typeof habit.id === "string" ? habit.id : `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    emoji: typeof habit.emoji === "string" && habit.emoji.trim() ? habit.emoji.trim() : "🌿",
    name: typeof habit.name === "string" ? habit.name.trim() : "",
    note: typeof habit.note === "string" ? habit.note.trim() : "",
    color: PALETTES[habit.color] ? habit.color : "mint",
    createdAt: typeof habit.createdAt === "string" ? habit.createdAt : new Date().toISOString(),
    history: normalizedHistory,
  };
}

function saveHabits() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
}

function normalizeDateList(list) {
  return [...new Set(list.filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item)))].sort();
}

function getDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatToday(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = KOREAN_DAYS[date.getDay()];
  return `${year}년 ${month}월 ${day}일 ${weekday}요일`;
}

function formatShortDate(dateKey) {
  const date = parseDateKey(dateKey);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = KOREAN_DAYS[date.getDay()];
  return `${month}월 ${day}일 (${weekday})`;
}

function getStartOfWeek(date = new Date()) {
  const current = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = current.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  current.setDate(current.getDate() + diff);
  return current;
}

function getWeekDates(date = new Date()) {
  const start = getStartOfWeek(date);
  return Array.from({ length: 7 }, (_, index) => {
    const next = new Date(start);
    next.setDate(start.getDate() + index);
    return next;
  });
}

function isHabitDoneOn(habit, dateKey) {
  return habit.history.includes(dateKey);
}

function getCurrentStreak(habit) {
  if (!habit.history.length) return 0;

  let streak = 0;
  let pointer = new Date();

  while (true) {
    const pointerKey = getDateKey(pointer);
    if (!isHabitDoneOn(habit, pointerKey)) {
      if (streak === 0) {
        pointer.setDate(pointer.getDate() - 1);
        const previousKey = getDateKey(pointer);
        if (!isHabitDoneOn(habit, previousKey)) break;
        streak += 1;
      } else {
        break;
      }
    } else {
      streak += 1;
    }
    pointer.setDate(pointer.getDate() - 1);
  }

  return streak;
}

function getWeeklyCount(habit, weekDates = getWeekDates()) {
  return weekDates.reduce((count, date) => count + Number(isHabitDoneOn(habit, getDateKey(date))), 0);
}

function addHabit({ emoji, name, note, color }) {
  const nextHabit = normalizeHabit({
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    emoji,
    name,
    note,
    color,
    createdAt: new Date().toISOString(),
    history: [],
  });

  if (!nextHabit.name) return;

  habits = [nextHabit, ...habits];
  activeHabitId = nextHabit.id;
  saveHabits();
}

function toggleHabitToday(id) {
  activeHabitId = id;
  const todayKey = getDateKey();
  habits = habits.map((habit) => {
    if (habit.id !== id) return habit;
    const hasToday = isHabitDoneOn(habit, todayKey);
    const nextHistory = hasToday
      ? habit.history.filter((entry) => entry !== todayKey)
      : [...habit.history, todayKey];
    return {
      ...habit,
      history: normalizeDateList(nextHistory),
    };
  });
  saveHabits();
}

function deleteHabit(id) {
  const visibleHabits = getSortedHabits(habits);
  const deletedIndex = visibleHabits.findIndex((habit) => habit.id === id);
  habits = habits.filter((habit) => habit.id !== id);

  if (!habits.length) {
    activeHabitId = null;
    currentIndex = 0;
  } else {
    const nextVisibleHabits = getSortedHabits(habits);
    const safeIndex = Math.min(deletedIndex, nextVisibleHabits.length - 1);
    activeHabitId = nextVisibleHabits[safeIndex]?.id ?? nextVisibleHabits[0].id;
  }

  saveHabits();
}

function getSummary(list, weekDates = getWeekDates()) {
  const totalHabits = list.length;
  const todayKey = getDateKey();
  const doneToday = list.filter((habit) => isHabitDoneOn(habit, todayKey)).length;
  const longestStreak = list.reduce((max, habit) => Math.max(max, getCurrentStreak(habit)), 0);
  const weeklyChecks = list.reduce((count, habit) => count + getWeeklyCount(habit, weekDates), 0);
  const weeklyTarget = totalHabits * weekDates.filter((date) => getDateKey(date) <= todayKey).length;
  const weeklyPercent = weeklyTarget > 0 ? Math.round((weeklyChecks / weeklyTarget) * 100) : 0;

  return {
    totalHabits,
    doneToday,
    longestStreak,
    weeklyPercent,
  };
}

function getInsight(summary) {
  if (summary.totalHabits === 0) {
    return {
      title: "씨앗을 심어볼 시간이에요",
      text: "첫 습관 하나만 적어도 오늘의 정원이 바로 시작돼요.",
    };
  }

  if (summary.doneToday === summary.totalHabits) {
    return {
      title: "오늘 정원을 모두 돌봤어요",
      text: "가볍게 이어온 체크가 하루의 리듬을 만들어주고 있어요.",
    };
  }

  if (summary.doneToday === 0) {
    return {
      title: "오늘의 첫 물주기를 기다리고 있어요",
      text: "가장 쉬운 습관 하나부터 체크하면 리듬이 금방 살아나요.",
    };
  }

  return {
    title: "좋은 흐름이 이어지고 있어요",
    text: `오늘 ${summary.doneToday}개를 완료했어요. 남은 카드도 천천히 넘겨보세요.`,
  };
}

function getSortedHabits(list) {
  const todayKey = getDateKey();
  return [...list].sort((left, right) => {
    const leftDone = isHabitDoneOn(left, todayKey);
    const rightDone = isHabitDoneOn(right, todayKey);
    if (leftDone !== rightDone) return Number(leftDone) - Number(rightDone);
    return right.createdAt.localeCompare(left.createdAt);
  });
}

function renderSummary(summary) {
  activeCount.textContent = `${summary.totalHabits}`;
  doneTodayCount.textContent = `${summary.doneToday}`;
  strongestStreak.textContent = `${summary.longestStreak}일`;
  weeklyRate.textContent = `${summary.weeklyPercent}%`;

  const insight = getInsight(summary);
  insightTitle.textContent = insight.title;
  insightText.textContent = insight.text;
}

function renderWeekOverview(list, weekDates = getWeekDates()) {
  weekOverview.innerHTML = "";

  weekDates.forEach((date, index) => {
    const dateKey = getDateKey(date);
    const completed = list.filter((habit) => isHabitDoneOn(habit, dateKey)).length;
    const total = list.length;
    const isFuture = dateKey > getDateKey();
    const ratio = total > 0 ? Math.round((completed / total) * 100) : 0;
    const ratioLabel = isFuture ? "예정" : total === 0 ? "-" : `${completed}/${total}`;
    const caption = isFuture ? "기록 전" : total === 0 ? "습관 없음" : `${ratio}%`;

    const item = document.createElement("li");
    item.className = "week-pill";
    item.innerHTML = `
      <span class="week-day">${WEEK_LABELS[index]}</span>
      <span class="week-ratio">${ratioLabel}</span>
      <span class="week-track"><span class="week-fill" style="width:${isFuture || total === 0 ? 0 : ratio}%"></span></span>
      <span class="week-caption">${caption}</span>
    `;
    weekOverview.appendChild(item);
  });
}

function createHabitWeek(habit, weekDates = getWeekDates()) {
  const container = document.createElement("div");
  container.className = "habit-week";

  weekDates.forEach((date, index) => {
    const dateKey = getDateKey(date);
    const isFuture = dateKey > getDateKey();
    const isToday = dateKey === getDateKey();
    const isDone = isHabitDoneOn(habit, dateKey);

    const item = document.createElement("div");
    item.className = `habit-day${isDone ? " is-done" : ""}${isFuture ? " is-future" : ""}${isToday ? " is-today" : ""}`;
    item.innerHTML = `
      <span class="habit-day-label">${WEEK_LABELS[index]}</span>
      <span class="habit-day-dot"></span>
    `;
    container.appendChild(item);
  });

  return container;
}

function createHabitSlide(habit, weekDates = getWeekDates()) {
  const slide = document.createElement("article");
  slide.className = "habit-slide";
  slide.dataset.id = habit.id;

  const streak = getCurrentStreak(habit);
  const weeklyCount = getWeeklyCount(habit, weekDates);
  const todayDone = isHabitDoneOn(habit, getDateKey());
  const note = habit.note || "작게 시작해도 충분해요.";

  const panel = document.createElement("section");
  panel.className = `habit-panel ${PALETTES[habit.color] || PALETTES.mint}`;

  const top = document.createElement("div");
  top.className = "habit-panel-top";
  top.innerHTML = `
    <div class="habit-icon">${habit.emoji}</div>
    <details class="habit-menu">
      <summary aria-label="습관 메뉴">⋯</summary>
      <div class="habit-menu-popover">
        <button type="button" class="menu-button">이 습관 삭제</button>
      </div>
    </details>
  `;

  const title = document.createElement("div");
  title.className = "habit-copy";
  title.innerHTML = `
    <h3 class="habit-title">${escapeHtml(habit.name)}</h3>
    <p class="habit-description">${escapeHtml(note)}</p>
  `;

  const stats = document.createElement("div");
  stats.className = "habit-stats";
  stats.innerHTML = `
    <span class="stat-badge">${streak}일 연속</span>
    <span class="stat-pill">이번 주 ${weeklyCount}/7</span>
  `;

  const week = createHabitWeek(habit, weekDates);

  const action = document.createElement("button");
  action.type = "button";
  action.className = `habit-main-action${todayDone ? " is-complete" : ""}`;
  action.textContent = todayDone ? "체크 취소" : "오늘 완료";
  action.addEventListener("click", () => {
    toggleHabitToday(habit.id);
    render();
  });

  const deleteButton = top.querySelector(".menu-button");
  deleteButton.addEventListener("click", () => {
    const shouldDelete = window.confirm(`"${habit.name}" 습관을 삭제할까요?`);
    if (!shouldDelete) return;
    deleteHabit(habit.id);
    render();
  });

  panel.append(top, title, stats, week, action);
  slide.appendChild(panel);
  return slide;
}

function renderHabitCarousel(list, weekDates = getWeekDates()) {
  habitTrack.innerHTML = "";
  pageDots.innerHTML = "";

  if (!list.length) {
    emptyState.classList.remove("is-hidden");
    habitTrack.classList.add("is-hidden");
    carouselFooter.classList.add("is-hidden");
    carouselCount.textContent = "0 / 0";
    return;
  }

  emptyState.classList.add("is-hidden");
  habitTrack.classList.remove("is-hidden");
  carouselFooter.classList.remove("is-hidden");

  const sorted = getSortedHabits(list);
  const activeIndexFromId = activeHabitId ? sorted.findIndex((habit) => habit.id === activeHabitId) : -1;
  currentIndex = activeIndexFromId >= 0 ? activeIndexFromId : Math.min(currentIndex, sorted.length - 1);
  activeHabitId = sorted[currentIndex]?.id ?? sorted[0].id;

  sorted.forEach((habit, index) => {
    habitTrack.appendChild(createHabitSlide(habit, weekDates));

    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = `page-dot${index === currentIndex ? " is-active" : ""}`;
    dot.setAttribute("aria-label", `${index + 1}번째 습관으로 이동`);
    dot.addEventListener("click", () => scrollToHabit(index));
    pageDots.appendChild(dot);
  });

  syncCarouselMeta(sorted.length);

  requestAnimationFrame(() => {
    scrollToHabit(currentIndex, "auto");
  });
}

function scrollToHabit(index, behavior = "smooth") {
  const slides = Array.from(habitTrack.children);
  const nextSlide = slides[index];
  if (!nextSlide) return;

  const targetLeft = nextSlide.offsetLeft - (habitTrack.clientWidth - nextSlide.clientWidth) / 2;
  habitTrack.scrollTo({ left: targetLeft, behavior });
  currentIndex = index;
  activeHabitId = nextSlide.dataset.id || activeHabitId;
  syncCarouselMeta(slides.length);
}

function getNearestSlideIndex() {
  const slides = Array.from(habitTrack.children);
  if (!slides.length) return 0;

  const trackRect = habitTrack.getBoundingClientRect();
  const trackCenter = trackRect.left + trackRect.width / 2;

  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;

  slides.forEach((slide, index) => {
    const rect = slide.getBoundingClientRect();
    const slideCenter = rect.left + rect.width / 2;
    const distance = Math.abs(trackCenter - slideCenter);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });

  return nearestIndex;
}

function syncCarouselMeta(totalSlides) {
  carouselCount.textContent = `${totalSlides === 0 ? 0 : currentIndex + 1} / ${totalSlides}`;

  Array.from(pageDots.children).forEach((dot, index) => {
    dot.classList.toggle("is-active", index === currentIndex);
  });

  prevHabitButton.disabled = currentIndex <= 0;
  nextHabitButton.disabled = currentIndex >= totalSlides - 1;
}

function renderTodayLabel() {
  todayLabel.textContent = formatToday();
}

function render() {
  habits = habits.map(normalizeHabit);
  const weekDates = getWeekDates();
  const summary = getSummary(habits, weekDates);
  renderTodayLabel();
  renderSummary(summary);
  renderHabitCarousel(habits, weekDates);
  renderWeekOverview(habits, weekDates);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

habitForm.addEventListener("submit", (event) => {
  event.preventDefault();

  addHabit({
    emoji: habitEmojiInput.value.trim() || "🌿",
    name: habitNameInput.value.trim(),
    note: habitNoteInput.value.trim(),
    color: habitColorInput.value,
  });

  habitForm.reset();
  habitEmojiInput.value = "🌿";
  habitColorInput.value = "mint";
  render();
  habitNameInput.focus();
});

presetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    habitEmojiInput.value = button.dataset.emoji || "🌿";
    habitNameInput.value = button.dataset.name || "";
    habitNoteInput.value = button.dataset.note || "";
    habitColorInput.value = button.dataset.color || "mint";
    habitNameInput.focus();
    habitNameInput.setSelectionRange(habitNameInput.value.length, habitNameInput.value.length);
  });
});

prevHabitButton.addEventListener("click", () => {
  scrollToHabit(Math.max(0, currentIndex - 1));
});

nextHabitButton.addEventListener("click", () => {
  const totalSlides = habitTrack.children.length;
  scrollToHabit(Math.min(totalSlides - 1, currentIndex + 1));
});

habitTrack.addEventListener("scroll", () => {
  if (scrollFrame) cancelAnimationFrame(scrollFrame);
  scrollFrame = requestAnimationFrame(() => {
    const nextIndex = getNearestSlideIndex();
    if (nextIndex !== currentIndex) {
      currentIndex = nextIndex;
      activeHabitId = habitTrack.children[nextIndex]?.dataset.id || activeHabitId;
      syncCarouselMeta(habitTrack.children.length);
    }
  });
});

window.addEventListener("resize", () => {
  if (!habitTrack.children.length) return;
  scrollToHabit(currentIndex, "auto");
});

document.addEventListener("click", (event) => {
  const menus = Array.from(document.querySelectorAll(".habit-menu[open]"));
  menus.forEach((menu) => {
    if (!menu.contains(event.target)) {
      menu.removeAttribute("open");
    }
  });
});

habitEmojiInput.value = habitEmojiInput.value || "🌿";
habitColorInput.value = habitColorInput.value || "mint";
render();
