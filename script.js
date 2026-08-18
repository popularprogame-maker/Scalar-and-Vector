const storageKey = "scalar-vector-notebook-v1";
const app = document.getElementById("notebookApp");
const pageImage = document.getElementById("slideImage");
const pageList = document.getElementById("pageList");
const sectionNav = document.getElementById("sectionNav");
const searchInput = document.getElementById("searchInput");
const notesPanel = document.getElementById("notesPanel");
const notesArea = document.getElementById("notesArea");
const toast = document.getElementById("toast");

const saved = (() => {
  try { return JSON.parse(localStorage.getItem(storageKey)) || {}; }
  catch { return {}; }
})();

const state = {
  pageIndex: Math.min(Math.max(Number(saved.pageIndex) || 0, 0), PAGE_DATA.length - 1),
  activeFilter: saved.activeFilter || "overview",
  bookmarks: new Set(Array.isArray(saved.bookmarks) ? saved.bookmarks : []),
  notes: saved.notes && typeof saved.notes === "object" ? saved.notes : {},
  theme: saved.theme === "dark" ? "dark" : "light",
  viewMode: saved.viewMode === "original" ? "original" : "designed",
  zoom: 100,
  presentation: false,
  sidebarOpen: false
};

function persist() {
  localStorage.setItem(storageKey, JSON.stringify({
    pageIndex: state.pageIndex,
    activeFilter: state.activeFilter,
    bookmarks: [...state.bookmarks],
    notes: state.notes,
    theme: state.theme,
    viewMode: state.viewMode
  }));
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function currentPage() { return PAGE_DATA[state.pageIndex]; }

function pageExcerpt(page, query) {
  const clean = page.text || page.title;
  if (!query) return page.sectionTitle;
  const lower = clean.toLowerCase();
  const index = lower.indexOf(query.toLowerCase());
  if (index < 0) return page.sectionTitle;
  const start = Math.max(0, index - 26);
  const end = Math.min(clean.length, index + query.length + 58);
  return `${start ? "…" : ""}${clean.slice(start, end)}${end < clean.length ? "…" : ""}`;
}

function filteredPages() {
  const query = searchInput.value.trim().toLowerCase();
  if (query) {
    return PAGE_DATA.filter(page => `${page.title} ${page.sectionTitle} ${page.text}`.toLowerCase().includes(query));
  }
  if (state.activeFilter === "bookmarks") {
    return PAGE_DATA.filter(page => state.bookmarks.has(page.number));
  }
  return PAGE_DATA.filter(page => page.section === state.activeFilter);
}

function renderSections() {
  sectionNav.replaceChildren();
  SECTION_DATA.forEach(section => {
    const button = document.createElement("button");
    button.className = "section-button";
    button.type = "button";
    button.setAttribute("aria-pressed", String(state.activeFilter === section.id && !searchInput.value));
    const label = document.createElement("span");
    label.className = "section-label";
    const dot = document.createElement("span");
    dot.className = "section-dot";
    dot.style.setProperty("--section-accent", section.accent);
    dot.setAttribute("aria-hidden", "true");
    const labelText = document.createElement("span");
    labelText.textContent = section.title;
    label.append(dot, labelText);
    const range = document.createElement("span");
    range.textContent = `${section.start}–${section.end}`;
    button.append(label, range);
    button.addEventListener("click", () => {
      searchInput.value = "";
      state.activeFilter = section.id;
      setPage(section.start - 1, false);
      renderSections();
      renderPageList();
      closeSidebar();
    });
    sectionNav.append(button);
  });

  const bookmarkButton = document.createElement("button");
  bookmarkButton.className = "bookmark-filter";
  bookmarkButton.type = "button";
  bookmarkButton.setAttribute("aria-pressed", String(state.activeFilter === "bookmarks" && !searchInput.value));
  const bookmarkLabel = document.createElement("span");
  bookmarkLabel.textContent = "★ Bookmarks";
  const bookmarkCount = document.createElement("span");
  bookmarkCount.textContent = state.bookmarks.size;
  bookmarkButton.append(bookmarkLabel, bookmarkCount);
  bookmarkButton.addEventListener("click", () => {
    searchInput.value = "";
    state.activeFilter = "bookmarks";
    renderSections();
    renderPageList();
    if (!state.bookmarks.size) showToast("Bookmark pages to build a quick lecture set.");
  });
  sectionNav.append(bookmarkButton);
}

function renderPageList() {
  const pages = filteredPages();
  const query = searchInput.value.trim();
  document.getElementById("pageListLabel").textContent = query ? "Search results" : state.activeFilter === "bookmarks" ? "Bookmarks" : "Pages";
  document.getElementById("pageListCount").textContent = pages.length;
  pageList.replaceChildren();

  if (!pages.length) {
    const empty = document.createElement("p");
    empty.style.cssText = "padding:12px;color:var(--sidebar-muted);font-size:12px;line-height:1.5";
    empty.textContent = query ? "No matching pages. Try a broader term." : "No bookmarked pages yet.";
    pageList.append(empty);
    return;
  }

  pages.forEach(page => {
    const button = document.createElement("button");
    button.className = "page-link";
    button.type = "button";
    if (page.number === currentPage().number) button.setAttribute("aria-current", "page");
    const number = document.createElement("span");
    number.className = "page-number";
    number.textContent = page.number;
    const copy = document.createElement("span");
    copy.className = "page-link-copy";
    const title = document.createElement("span");
    title.className = "page-link-title";
    title.textContent = `${state.bookmarks.has(page.number) ? "★ " : ""}${page.title}`;
    const excerpt = document.createElement("span");
    excerpt.className = "page-link-excerpt";
    excerpt.textContent = pageExcerpt(page, query);
    copy.append(title, excerpt);
    button.append(number, copy);
    button.addEventListener("click", () => {
      setPage(page.number - 1);
      closeSidebar();
    });
    pageList.append(button);
  });
}

function updateZoom() {
  const mobileLayout = window.matchMedia("(max-width: 900px)").matches;
  if (mobileLayout && !state.presentation) {
    pageImage.style.width = `${state.zoom}%`;
    pageImage.style.height = "auto";
  } else {
    pageImage.style.width = "auto";
    pageImage.style.height = `${state.zoom}%`;
  }
  document.getElementById("zoomValue").textContent = `${state.zoom}%`;
  document.getElementById("zoomOutBtn").disabled = state.zoom <= 70;
  document.getElementById("zoomInBtn").disabled = state.zoom >= 140;
}

function setPage(nextIndex, syncFilter = true) {
  state.pageIndex = Math.min(Math.max(nextIndex, 0), PAGE_DATA.length - 1);
  const page = currentPage();
  if (syncFilter && !searchInput.value && state.activeFilter !== "bookmarks") state.activeFilter = page.section;
  const designedView = state.viewMode === "designed";
  pageImage.src = designedView ? page.image : page.originalImage;
  pageImage.alt = designedView
    ? `Page ${page.number}: ${page.title}. Redesigned lecture-note page preserving the original content.`
    : `Page ${page.number}: ${page.title}. Original lecture slide.`;
  app.style.setProperty("--accent", page.accent);
  app.style.setProperty("--accent-2", page.accent2);
  document.getElementById("currentSection").textContent = page.sectionTitle;
  document.getElementById("currentTitle").textContent = page.title;
  document.getElementById("pageCounter").textContent = `Page ${page.number} of ${PAGE_DATA.length}`;
  document.getElementById("pageRange").textContent = page.sectionTitle;
  document.getElementById("prevBtn").disabled = state.pageIndex === 0;
  document.getElementById("nextBtn").disabled = state.pageIndex === PAGE_DATA.length - 1;
  const percent = Math.round((page.number / PAGE_DATA.length) * 100);
  document.getElementById("progressBar").style.width = `${percent}%`;
  document.getElementById("progressTrack").setAttribute("aria-valuenow", page.number);
  document.getElementById("progressCopy").textContent = `${percent}% complete · Use ← → to navigate`;
  const bookmarked = state.bookmarks.has(page.number);
  const bookmarkBtn = document.getElementById("bookmarkBtn");
  bookmarkBtn.setAttribute("aria-pressed", String(bookmarked));
  bookmarkBtn.innerHTML = bookmarked ? "★ <span class=\"label-optional\">Bookmarked</span>" : "☆ <span class=\"label-optional\">Bookmark</span>";
  document.getElementById("notesTitle").textContent = `Notes for page ${page.number}`;
  notesArea.value = state.notes[page.number] || "";
  const viewBtn = document.getElementById("viewBtn");
  viewBtn.setAttribute("aria-pressed", String(designedView));
  viewBtn.textContent = designedView ? "View original pages" : "Use designed pages";
  document.getElementById("slideViewport").scrollTo({ top: 0, left: 0, behavior: "smooth" });
  document.title = `${page.title} · Scalar & Vector`;
  renderSections();
  renderPageList();
  persist();
}

function toggleBookmark() {
  const pageNumber = currentPage().number;
  if (state.bookmarks.has(pageNumber)) {
    state.bookmarks.delete(pageNumber);
    showToast(`Removed page ${pageNumber} from bookmarks.`);
  } else {
    state.bookmarks.add(pageNumber);
    showToast(`Bookmarked page ${pageNumber}.`);
  }
  setPage(state.pageIndex, false);
}

function toggleNotes() {
  const open = notesPanel.hasAttribute("hidden");
  notesPanel.toggleAttribute("hidden", !open);
  document.getElementById("notesToggle").setAttribute("aria-expanded", String(open));
  if (open) setTimeout(() => notesArea.focus(), 0);
}

function saveNote() {
  const pageNumber = currentPage().number;
  const value = notesArea.value.trimEnd();
  if (value) state.notes[pageNumber] = value;
  else delete state.notes[pageNumber];
  document.getElementById("notesStatus").textContent = "Saved locally";
  persist();
}

function exportNotes() {
  const entries = Object.entries(state.notes)
    .filter(([, note]) => note && note.trim())
    .sort((a, b) => Number(a[0]) - Number(b[0]));
  if (!entries.length) {
    showToast("Add a note before exporting.");
    return;
  }
  const lines = ["# Chapter 3: Scalar & Vector - Lecturer Notes", ""];
  entries.forEach(([number, note]) => {
    const page = PAGE_DATA[Number(number) - 1];
    lines.push(`## Page ${number}: ${page.title}`, "", note, "");
  });
  downloadBlob(new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" }), "chapter-3-scalar-vector-lecturer-notes.md");
  showToast("Lecturer notes exported.");
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function downloadOriginalPdf() {
  const link = document.createElement("a");
  link.href = "assets/chapter-3-scalar-vector.pdf";
  link.download = "CHAPTER 3 SCALAR AND VECTOR.pdf";
  document.body.append(link);
  link.click();
  link.remove();
  showToast("Original PDF download started.");
}

async function togglePresentation() {
  state.presentation = !state.presentation;
  app.classList.toggle("presentation", state.presentation);
  document.getElementById("presentBtn").textContent = state.presentation ? "Exit presentation" : "Present";
  if (state.presentation && document.documentElement.requestFullscreen) {
    try { await document.documentElement.requestFullscreen(); } catch { /* CSS presentation mode remains available. */ }
  } else if (!state.presentation && document.fullscreenElement) {
    try { await document.exitFullscreen(); } catch { /* no-op */ }
  }
  updateZoom();
}

function openSidebar() {
  state.sidebarOpen = true;
  app.classList.add("sidebar-open");
}
function closeSidebar() {
  state.sidebarOpen = false;
  app.classList.remove("sidebar-open");
}

document.getElementById("prevBtn").addEventListener("click", () => setPage(state.pageIndex - 1));
document.getElementById("nextBtn").addEventListener("click", () => setPage(state.pageIndex + 1));
document.getElementById("bookmarkBtn").addEventListener("click", toggleBookmark);
document.getElementById("viewBtn").addEventListener("click", () => {
  state.viewMode = state.viewMode === "designed" ? "original" : "designed";
  setPage(state.pageIndex, false);
  showToast(state.viewMode === "designed" ? "Designed notebook pages enabled." : "Showing the original lecture pages.");
});
document.getElementById("notesToggle").addEventListener("click", toggleNotes);
document.getElementById("presentBtn").addEventListener("click", togglePresentation);
document.getElementById("mobileMenuBtn").addEventListener("click", openSidebar);
document.getElementById("mobileScrim").addEventListener("click", closeSidebar);
document.getElementById("downloadPdfBtn").addEventListener("click", downloadOriginalPdf);
document.getElementById("exportNotesBtn").addEventListener("click", exportNotes);
document.getElementById("exportNotesInlineBtn").addEventListener("click", exportNotes);
document.getElementById("clearNoteBtn").addEventListener("click", () => {
  notesArea.value = "";
  saveNote();
  showToast(`Cleared the note for page ${currentPage().number}.`);
});
document.getElementById("zoomOutBtn").addEventListener("click", () => { state.zoom = Math.max(70, state.zoom - 10); updateZoom(); });
document.getElementById("zoomInBtn").addEventListener("click", () => { state.zoom = Math.min(140, state.zoom + 10); updateZoom(); });
document.getElementById("themeBtn").addEventListener("click", () => {
  state.theme = state.theme === "light" ? "dark" : "light";
  app.dataset.theme = state.theme;
  document.getElementById("themeBtn").textContent = state.theme === "light" ? "Dark" : "Light";
  persist();
});

searchInput.addEventListener("input", () => {
  if (!searchInput.value.trim() && state.activeFilter !== "bookmarks") {
    state.activeFilter = currentPage().section;
  }
  renderSections();
  renderPageList();
});
searchInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    const results = filteredPages();
    if (results.length) setPage(results[0].number - 1, false);
  }
  if (event.key === "Escape") {
    searchInput.value = "";
    renderSections();
    renderPageList();
  }
});
notesArea.addEventListener("input", () => {
  document.getElementById("notesStatus").textContent = "Saving…";
  clearTimeout(saveNote.timer);
  saveNote.timer = setTimeout(saveNote, 280);
});

document.addEventListener("keydown", event => {
  const tag = document.activeElement?.tagName;
  const typing = tag === "INPUT" || tag === "TEXTAREA";
  if (!typing && (event.key === "ArrowRight" || event.key === "PageDown")) {
    event.preventDefault();
    setPage(state.pageIndex + 1);
  } else if (!typing && (event.key === "ArrowLeft" || event.key === "PageUp")) {
    event.preventDefault();
    setPage(state.pageIndex - 1);
  } else if (!typing && event.key === "/") {
    event.preventDefault();
    searchInput.focus();
    openSidebar();
  } else if (!typing && event.key.toLowerCase() === "b") {
    toggleBookmark();
  } else if (!typing && event.key.toLowerCase() === "n") {
    toggleNotes();
  } else if (!typing && event.key.toLowerCase() === "f") {
    togglePresentation();
  }
});

window.addEventListener("resize", updateZoom, { passive: true });
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement && state.presentation) {
    state.presentation = false;
    app.classList.remove("presentation");
    document.getElementById("presentBtn").textContent = "Present";
  }
});

app.dataset.theme = state.theme;
document.getElementById("themeBtn").textContent = state.theme === "light" ? "Dark" : "Light";
updateZoom();
setPage(state.pageIndex);
