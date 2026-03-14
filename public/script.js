const STORAGE_KEYS = {
  history: 'uvbrowser_history_v1',
  bookmarks: 'uvbrowser_bookmarks_v1',
  tabs: 'uvbrowser_tabs_v1',
  activeTab: 'uvbrowser_active_tab_v1'
};

const browserFrame = document.getElementById('browserFrame');
const tabStrip = document.getElementById('tabStrip');
const addressBar = document.getElementById('addressBar');
const addressForm = document.getElementById('addressForm');
const openBtn = document.getElementById('openBtn');
const newTabBtn = document.getElementById('newTabBtn');
const backBtn = document.getElementById('backBtn');
const forwardBtn = document.getElementById('forwardBtn');
const reloadBtn = document.getElementById('reloadBtn');
const historyList = document.getElementById('historyList');
const bookmarksList = document.getElementById('bookmarks');
const bookmarkNameInput = document.getElementById('bookmarkName');
const saveBookmarkBtn = document.getElementById('saveBookmarkBtn');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const statusText = document.getElementById('statusText');
const activeUrlText = document.getElementById('activeUrlText');
const loadingOverlay = document.getElementById('loadingOverlay');

let tabs = loadJson(STORAGE_KEYS.tabs, []);
let activeTabId = localStorage.getItem(STORAGE_KEYS.activeTab);
let historyItems = loadJson(STORAGE_KEYS.history, []);
let bookmarks = loadJson(STORAGE_KEYS.bookmarks, [
  { name: 'Wikipedia', url: 'https://www.wikipedia.org/' },
  { name: 'DuckDuckGo', url: 'https://duckduckgo.com/' },
  { name: 'NASA', url: 'https://www.nasa.gov/' }
]);
let ready = false;

if (!tabs.length) {
  tabs = [{ id: crypto.randomUUID(), title: 'New Tab', url: 'https://www.wikipedia.org/' }];
  activeTabId = tabs[0].id;
}
if (!tabs.find((tab) => tab.id === activeTabId)) {
  activeTabId = tabs[0].id;
}

boot().catch((error) => {
  console.error(error);
  statusText.textContent = 'Proxy setup failed';
});

async function boot() {
  await registerServiceWorker();
  await configureTransport();
  ready = true;
  renderTabs();
  renderHistory();
  renderBookmarks();
  navigateToTab(getActiveTab(), false);
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service workers are not supported in this browser.');
  }
  await navigator.serviceWorker.register('/sw.js', { scope: __uv$config.prefix });
  await navigator.serviceWorker.ready;
}

async function configureTransport() {
  const connection = new BareMux.BareMuxConnection('/baremux/worker.js');
  await connection.setTransport('/epoxy/index.mjs', [
    { wisp: `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/wisp/` }
  ]);
}

function loadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEYS.tabs, JSON.stringify(tabs));
  localStorage.setItem(STORAGE_KEYS.activeTab, activeTabId || '');
  localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(historyItems.slice(0, 100)));
  localStorage.setItem(STORAGE_KEYS.bookmarks, JSON.stringify(bookmarks));
}

function getActiveTab() {
  return tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
}

function normalizeInput(input) {
  const trimmed = input.trim();
  if (!trimmed) return '';
  const hasProtocol = /^https?:\/\//i.test(trimmed);
  const looksLikeDomain = /^(localhost|[\w-]+(\.[\w-]+)+)(:\d+)?(\/.*)?$/i.test(trimmed);
  if (hasProtocol) return trimmed;
  if (looksLikeDomain) return `https://${trimmed}`;
  return `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
}

function encodeProxyUrl(url) {
  return __uv$config.prefix + __uv$config.encodeUrl(url);
}

function setLoading(isLoading) {
  loadingOverlay.classList.toggle('hidden', !isLoading);
  statusText.textContent = isLoading ? 'Loading' : 'Ready';
}

function recordHistory(url, title) {
  historyItems.unshift({
    url,
    title: title || url,
    visitedAt: new Date().toISOString()
  });
  const seen = new Set();
  historyItems = historyItems.filter((item) => {
    const key = `${item.url}|${item.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 100);
  renderHistory();
  saveState();
}

function renderTabs() {
  tabStrip.innerHTML = '';
  tabs.forEach((tab) => {
    const tabEl = document.createElement('button');
    tabEl.className = `tab${tab.id === activeTabId ? ' active' : ''}`;
    tabEl.type = 'button';
    tabEl.innerHTML = `<span class="tab-title">${escapeHtml(tab.title || 'New Tab')}</span><button class="tab-close" type="button">×</button>`;
    tabEl.addEventListener('click', () => {
      activeTabId = tab.id;
      saveState();
      renderTabs();
      navigateToTab(tab, false);
    });
    tabEl.querySelector('.tab-close').addEventListener('click', (event) => {
      event.stopPropagation();
      closeTab(tab.id);
    });
    tabStrip.appendChild(tabEl);
  });
}

function renderHistory() {
  historyList.innerHTML = '';
  if (!historyItems.length) {
    historyList.innerHTML = '<div class="empty-state">No history yet.</div>';
    return;
  }
  historyItems.forEach((item) => {
    const row = document.createElement('button');
    row.className = 'history-item';
    row.type = 'button';
    row.innerHTML = `${escapeHtml(item.title)}<small>${escapeHtml(item.url)}</small>`;
    row.addEventListener('click', () => openUrl(item.url));
    historyList.appendChild(row);
  });
}

function renderBookmarks() {
  bookmarksList.innerHTML = '';
  if (!bookmarks.length) {
    bookmarksList.innerHTML = '<div class="empty-state">No bookmarks saved.</div>';
    return;
  }
  bookmarks.forEach((item, index) => {
    const row = document.createElement('button');
    row.className = 'bookmark-item';
    row.type = 'button';
    row.innerHTML = `${escapeHtml(item.name)}<small>${escapeHtml(item.url)}</small>`;
    row.addEventListener('click', () => openUrl(item.url));
    row.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      bookmarks.splice(index, 1);
      renderBookmarks();
      saveState();
    });
    bookmarksList.appendChild(row);
  });
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function openUrl(rawValue) {
  if (!ready) return;
  const url = normalizeInput(rawValue);
  if (!url) return;
  const activeTab = getActiveTab();
  activeTab.url = url;
  activeTab.title = new URL(url).hostname.replace(/^www\./, '') || 'New Tab';
  addressBar.value = url;
  activeUrlText.textContent = url;
  renderTabs();
  saveState();
  setLoading(true);
  browserFrame.src = encodeProxyUrl(url);
  recordHistory(url, activeTab.title);
}

function navigateToTab(tab, pushToHistory = false) {
  if (!tab) return;
  addressBar.value = tab.url || '';
  activeUrlText.textContent = tab.url || '';
  if (tab.url) {
    setLoading(true);
    browserFrame.src = encodeProxyUrl(tab.url);
    if (pushToHistory) recordHistory(tab.url, tab.title);
  } else {
    browserFrame.removeAttribute('src');
    setLoading(false);
  }
}

function createTab(initialUrl = 'https://www.wikipedia.org/') {
  const tab = {
    id: crypto.randomUUID(),
    title: 'New Tab',
    url: initialUrl
  };
  tabs.push(tab);
  activeTabId = tab.id;
  renderTabs();
  saveState();
  navigateToTab(tab, true);
}

function closeTab(tabId) {
  if (tabs.length === 1) {
    tabs = [{ id: crypto.randomUUID(), title: 'New Tab', url: 'https://www.wikipedia.org/' }];
    activeTabId = tabs[0].id;
  } else {
    const index = tabs.findIndex((tab) => tab.id === tabId);
    tabs = tabs.filter((tab) => tab.id !== tabId);
    if (activeTabId === tabId) {
      activeTabId = tabs[Math.max(0, index - 1)].id;
    }
  }
  renderTabs();
  saveState();
  navigateToTab(getActiveTab(), false);
}

addressForm.addEventListener('submit', (event) => {
  event.preventDefault();
  openUrl(addressBar.value);
});
openBtn.addEventListener('click', () => openUrl(addressBar.value));
newTabBtn.addEventListener('click', () => createTab());
backBtn.addEventListener('click', () => browserFrame.contentWindow?.history.back());
forwardBtn.addEventListener('click', () => browserFrame.contentWindow?.history.forward());
reloadBtn.addEventListener('click', () => browserFrame.contentWindow?.location.reload());
clearHistoryBtn.addEventListener('click', () => {
  historyItems = [];
  renderHistory();
  saveState();
});
saveBookmarkBtn.addEventListener('click', () => {
  const url = getActiveTab()?.url;
  const name = bookmarkNameInput.value.trim() || getActiveTab()?.title || 'Bookmark';
  if (!url) return;
  bookmarks.unshift({ name, url });
  bookmarkNameInput.value = '';
  renderBookmarks();
  saveState();
});

browserFrame.addEventListener('load', () => {
  setLoading(false);
  statusText.textContent = 'Loaded';
});

window.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'l') {
    event.preventDefault();
    addressBar.focus();
    addressBar.select();
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 't') {
    event.preventDefault();
    createTab();
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'r') {
    event.preventDefault();
    browserFrame.contentWindow?.location.reload();
  }
});
