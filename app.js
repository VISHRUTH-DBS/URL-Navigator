(() => {
  'use strict';

  /* ------------------------------------------------------------ helpers */
  const $ = (s, r = document) => r.querySelector(s);

  // The same UI runs as a Chrome extension and as a static Vercel site.
  const isExtension = typeof chrome !== 'undefined' && !!chrome.storage?.local;
  const browserStore = {
    async get(keys) {
      if (isExtension) return chrome.storage.local.get(keys);
      const names = Array.isArray(keys) ? keys : Object.keys(keys || {});
      return Object.fromEntries(names.map(key => {
        try { return [key, JSON.parse(localStorage.getItem(`url-navigator:${key}`))]; }
        catch { return [key, undefined]; }
      }));
    },
    async set(values) {
      if (isExtension) return chrome.storage.local.set(values);
      for (const [key, value] of Object.entries(values)) localStorage.setItem(`url-navigator:${key}`, JSON.stringify(value));
    },
    async remove(keys) {
      if (isExtension) return chrome.storage.local.remove(keys);
      for (const key of keys) localStorage.removeItem(`url-navigator:${key}`);
    }
  };
  const assetUrl = path => isExtension ? chrome.runtime.getURL(path) : path;

  const esc = s => String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const uid = () => (
    crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2)
  );

  const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

  const ICONS = {
    logo: '<svg viewBox="0 0 36 36" aria-hidden="true"><rect width="36" height="36" rx="9" fill="currentColor"/><path d="M9 10.5A2.5 2.5 0 0 1 11.5 8h13A2.5 2.5 0 0 1 27 10.5v9a2.5 2.5 0 0 1-2.5 2.5H17l-5 4v-4h-.5A2.5 2.5 0 0 1 9 19.5z" fill="#fff"/><path d="M14.5 14.8h7M14.5 17.4h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    chat: svg('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>'),
    settings: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>'),
    compose: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
    more: svg('<circle cx="5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="19" cy="12" r="1.2" fill="currentColor"/>'),
    send: svg('<path d="M22 2 11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>'),
    stop: svg('<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>'),
    trash: svg('<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v7M14 10v7"/>'),
    edit: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
    search: svg('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>'),
    menu: svg('<path d="M3 6h18M3 12h18M3 18h18"/>'),
    bot: svg('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1"/>')
  };

  const paintIcons = (root = document) =>
    root.querySelectorAll('[data-icon]').forEach(n => {
      n.innerHTML = ICONS[n.dataset.icon] || '';
    });

  function md(src, { links = false } = {}) {
    const blocks = [];

    src = String(src).replace(
      /```[\w-]*\n?([\s\S]*?)(```|$)/g,
      (m, c) => {
        blocks.push(
          `<pre><code>${esc(c.replace(/\n$/, ''))}</code></pre>`
        );
        return `\u0000${blocks.length - 1}\u0000`;
      }
    );

    let h = esc(src)
      .replace(/`([^`\n]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, '$1<em>$2</em>');

    if (links) {
      h = h.replace(
        /(https?:\/\/[^\s<)]+[^\s<).,;!?])/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
      );
    }

    const out = [];
    let list = null;
    let para = [];

    const flushPara = () => {
      if (para.length) {
        out.push(`<p>${para.join('<br>')}</p>`);
        para = [];
      }
    };

    const flushList = () => {
      if (list) {
        out.push(`</${list}>`);
        list = null;
      }
    };

    for (const line of h.split('\n')) {
      let m;

      if ((m = line.match(/^\s*[-*•]\s+(.*)/))) {
        flushPara();
        if (list !== 'ul') {
          flushList();
          out.push('<ul>');
          list = 'ul';
        }
        out.push(`<li>${m[1]}</li>`);
      } else if ((m = line.match(/^\s*\d+[.)]\s+(.*)/))) {
        flushPara();
        if (list !== 'ol') {
          flushList();
          out.push('<ol>');
          list = 'ol';
        }
        out.push(`<li>${m[1]}</li>`);
      } else if ((m = line.match(/^#{1,6}\s+(.*)/))) {
        flushPara();
        flushList();
        out.push(`<h4>${m[1]}</h4>`);
      } else if (!line.trim()) {
        flushPara();
        flushList();
      } else {
        flushList();
        para.push(line);
      }
    }

    flushPara();
    flushList();

    return out.join('').replace(
      /\u0000(\d+)\u0000/g,
      (m, i) => blocks[+i]
    );
  }

  const sameDay = (a, b) =>
    new Date(a).toDateString() === new Date(b).toDateString();

  function listTime(ts) {
    const now = Date.now();

    if (sameDay(ts, now)) {
      return new Date(ts).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit'
      });
    }

    if (sameDay(ts, now - 864e5)) return 'Yesterday';

    return new Date(ts).toLocaleDateString([], {
      month: 'short',
      day: 'numeric'
    });
  }

  function msgTime(ts) {
    const t = new Date(ts).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit'
    });

    return sameDay(ts, Date.now())
      ? t
      : new Date(ts).toLocaleDateString([], {
          month: 'short',
          day: 'numeric'
        }) + ', ' + t;
  }

  const plain = s =>
    String(s || '').replace(/[`*#>]/g, '').replace(/\s+/g, ' ').trim();

  let toastTimer;

  function toast(text) {
    const t = $('#toast');
    t.textContent = text;
    t.hidden = false;

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
      t.hidden = true;
    }, 2600);
  }

  /* ------------------------------------------------------------ state */

  const DEFAULTS = {
    provider: 'groq',
    apiKey: '',
    model: 'llama-3.3-70b-versatile',
    baseUrl: 'https://api.groq.com/openai/v1'
  };

  const SYSTEM =
    'You are URL Navigator, a helpful, concise assistant inside a Chrome extension. ' +
    'Reply in plain text with light markdown. You cannot browse the web or open links yourself. ' +
    'If the user wants to open a website or find sites by topic, tell them to ask things like ' +
    '"open youtube" or "I want to watch videos"; a separate tool handles URLs from their curl.txt file.';

  let chats = [];
  let activeId = null;
  let settings = { ...DEFAULTS };
  let entries = [];
  let customCategories = [];
  let recentUrls = [];
  let source = '';
  let busy = false;
  let abortCtl = null;
  let liveBubble = null;

  const activeChat = () => chats.find(c => c.id === activeId) || null;

  const save = () => browserStore.set({ chats, activeId });

  const sorted = () =>
    [...chats].sort((a, b) => b.updatedAt - a.updatedAt);

  function newChat() {
    const c = {
      id: uid(),
      title: 'New chat',
      autoTitle: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
      pending: null,
      lastList: null
    };

    chats.push(c);
    return c;
  }

  /* ------------------------------------------------------------ curl.txt source */

  async function loadEntries() {
    const { curlText, curlName, userCategories, recentUrls: recent } = await browserStore.get([
      'curlText',
      'curlName',
      'userCategories',
      'recentUrls'
    ]);
    customCategories = Array.isArray(userCategories) ? userCategories : [];
    recentUrls = Array.isArray(recent) ? recent : [];
    UrlEngine.setCustomCategories(customCategories);

    let text = curlText;

    if (typeof text === 'string') {
      source = curlName || 'imported file';
    } else {
      source = 'bundled curl.txt';

      try {
        text = await (
          await fetch(assetUrl('curl.txt'), {
            cache: 'no-store'
          })
        ).text();
      } catch (e) {
        text = '';
      }
    }

    entries = UrlEngine.parseCurl(text).map(entry => ({ ...entry, name: entry.title || entry.name }));
    const known = new Set(UrlEngine.getCategories().map(cat => cat.id));
    let addedCategory = false;
    entries.forEach(entry => {
      if (entry.categoryId && entry.categoryLabel && !known.has(entry.categoryId)) {
        customCategories.push({ id: entry.categoryId, label: entry.categoryLabel, key: entry.categoryLabel.toLowerCase(), triggers: [entry.categoryLabel.toLowerCase()], verbs: [], hosts: [] });
        known.add(entry.categoryId);
        addedCategory = true;
      }
    });
    if (addedCategory) {
      UrlEngine.setCustomCategories(customCategories);
      await browserStore.set({ userCategories: customCategories });
    }
    updateSubtitle();

    return entries;
  }

  async function saveUrlEntries(nextEntries) {
    const lines = [];
    nextEntries.forEach(entry => {
      if (entry.categoryId) lines.push(`# category: ${entry.categoryId}`);
      if (entry.categoryLabel) lines.push(`# category-label: ${entry.categoryLabel.replace(/[\r\n]/g, ' ')}`);
      if (entry.title) lines.push(`# name: ${entry.title.replace(/[\r\n]/g, ' ')}`);
      if (entry.tags?.length) lines.push(`# tags: ${entry.tags.join(', ').replace(/[\r\n]/g, '')}`);
      if (entry.favorite) lines.push('# favorite: true');
      lines.push(`curl "${entry.url}"`, '');
    });
    await browserStore.set({ curlText: lines.join('\n'), curlName: 'My URL list' });
    await loadEntries();
    renderAll();
    renderUrlManager();
  }

  function refreshCategoryControls() {
    const cats = UrlEngine.getCategories();
    const add = $('#addUrlCategory');
    const filter = $('#urlManagerCategory');
    const addValue = add.value;
    const filterValue = filter.value;
    add.innerHTML = '<option value="">Auto-detect category</option>';
    filter.innerHTML = '<option value="">All categories</option>';
    cats.forEach(cat => {
      for (const select of [add, filter]) {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.label;
        select.append(option);
      }
    });
    add.value = addValue;
    filter.value = filterValue;
  }

  function renderUrlManager() {
    const list = $('#urlManagerList');
    if (!list) return;
    refreshCategoryControls();
    list.innerHTML = '';
    const query = ($('#urlManagerSearch')?.value || '').trim().toLowerCase();
    const categoryId = $('#urlManagerCategory')?.value || '';
    const protocol = $('#urlManagerProtocol')?.value || '';
    const visible = entries.filter(entry =>
      (!categoryId || entry.categoryId === categoryId || UrlEngine.getCategories().find(cat => cat.id === categoryId)?.hosts?.some(host => UrlEngine.hostHas(entry, host))) &&
      (!protocol || new URL(entry.url).protocol === protocol) &&
      (!query || `${entry.name} ${entry.url} ${entry.host} ${(entry.tags || []).join(' ')}`.toLowerCase().includes(query))
    );
    if (!visible.length) {
      list.innerHTML = '<p class="muted small">No URLs match these filters.</p>';
      return;
    }
    visible.forEach(entry => {
      const row = document.createElement('div');
      row.className = 'url-manager-item';
      const category = UrlEngine.getCategories().find(cat => cat.id === (entry.categoryId || UrlEngine.suggestCategory(entry.url)));
      row.innerHTML = `<div class="url-manager-item-main"><strong>${esc(entry.name)}</strong><span>${esc(entry.url)}</span><small>${esc(category?.label || 'Uncategorized')}${entry.tags?.length ? ` · ${esc(entry.tags.join(', '))}` : ''}</small></div>`;
      const actions = document.createElement('div');
      actions.className = 'url-manager-item-actions';
      const pin = document.createElement('button');
      pin.type = 'button'; pin.className = 'btn'; pin.textContent = entry.favorite ? '★' : '☆'; pin.title = entry.favorite ? 'Unpin' : 'Pin to dashboard';
      pin.addEventListener('click', () => toggleFavorite(entry.url));
      const edit = document.createElement('button');
      edit.type = 'button'; edit.className = 'btn'; edit.textContent = 'Edit'; edit.addEventListener('click', () => editUrl(entry.url));
      const remove = document.createElement('button');
      remove.type = 'button'; remove.className = 'btn'; remove.textContent = 'Remove'; remove.addEventListener('click', () => removeUrl(entry.url));
      actions.append(pin, edit, remove);
      row.prepend(favEl(entry));
      row.append(actions);
      list.append(row);
    });
  }

  async function toggleFavorite(url) {
    const next = entries.map(entry => entry.url === url ? { ...entry, favorite: !entry.favorite } : entry);
    await saveUrlEntries(next);
    renderDashboard();
  }

  async function editUrl(url) {
    const entry = entries.find(item => item.url === url);
    if (!entry) return;
    const name = prompt('Bookmark name:', entry.title || entry.name);
    if (name === null) return;
    const currentCategory = UrlEngine.getCategories().find(cat => cat.id === (entry.categoryId || UrlEngine.suggestCategory(entry.url)))?.label || '';
    const categoryName = prompt('Category:', currentCategory);
    if (categoryName === null) return;
    let category = UrlEngine.getCategories().find(cat => cat.label.toLowerCase() === categoryName.trim().toLowerCase());
    if (categoryName.trim() && !category) category = await createCategory(categoryName.trim());
    const tags = prompt('Tags, separated by commas:', (entry.tags || []).join(', '));
    if (tags === null) return;
    const updated = entries.map(item => item.url === url ? {
      ...item,
      title: name.trim(),
      name: name.trim() || item.name,
      categoryId: category?.id || '',
      categoryLabel: category?.label || '',
      tags: tags.split(',').map(tag => tag.trim()).filter(Boolean)
    } : item);
    await saveUrlEntries(updated);
    renderDashboard();
  }

  async function removeUrl(url) {
    if (!confirm('Remove this URL from your list?')) return;
    await saveUrlEntries(entries.filter(entry => entry.url !== url));
    recentUrls = recentUrls.filter(item => item !== url);
    await browserStore.set({ recentUrls });
    renderDashboard();
  }

  async function createCategory(label) {
    const id = label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32);
    if (!id) return null;
    let category = UrlEngine.getCategories().find(item => item.id === id);
    if (category) return category;
    category = { id, label, key: label.toLowerCase(), triggers: [label.toLowerCase()], verbs: [], hosts: [] };
    customCategories.push(category);
    UrlEngine.setCustomCategories(customCategories);
    await browserStore.set({ userCategories: customCategories });
    refreshCategoryControls();
    return category;
  }

  async function addCustomCategory() {
    const input = $('#newCategoryInput');
    const label = input.value.trim();
    if (!label) return toast('Enter a category name.');
    const before = customCategories.length;
    const category = await createCategory(label);
    input.value = '';
    renderUrlManager();
    toast(customCategories.length > before ? `Added ${category.label}.` : `${category.label} already exists.`);
  }

  function renderDashboard() {
    const grid = $('#dashboardGrid');
    if (!grid) return;
    grid.innerHTML = '';
    const query = ($('#dashboardSearch')?.value || '').trim().toLowerCase();
    const byUrl = new Map(entries.map(entry => [entry.url, entry]));
    const ordered = [
      ...entries.filter(entry => entry.favorite),
      ...recentUrls.map(url => byUrl.get(url)).filter(Boolean)
    ].filter((entry, index, all) => all.findIndex(other => other.url === entry.url) === index)
      .filter(entry => !query || `${entry.name} ${entry.url} ${entry.tags.join(' ')}`.toLowerCase().includes(query));
    if (!ordered.length) {
      grid.innerHTML = '<p class="muted">Pin a site or open a URL to see it here.</p>';
      return;
    }
    ordered.forEach(entry => {
      const tile = document.createElement('button');
      tile.type = 'button'; tile.className = 'bookmark-tile';
      tile.append(favEl(entry));
      const name = document.createElement('strong'); name.textContent = entry.name;
      const host = document.createElement('span'); host.textContent = entry.host;
      const pin = document.createElement('small'); pin.textContent = entry.favorite ? 'Pinned' : 'Recently opened';
      tile.append(name, host, pin);
      tile.addEventListener('click', async () => {
        const result = await openUrls([entry.url]);
        if (result.opened.length) toast(`Opened ${entry.name}.`);
      });
      grid.append(tile);
    });
  }

  function openDashboard() {
    renderDashboard();
    $('#dashboardDlg').showModal();
  }

  function updateSubtitle() {
    $('#chatSub').textContent = entries.length
      ? `${entries.length} URLs loaded from ${source}`
      : 'No URLs found. Check curl.txt';
  }

  async function openUrls(urls) {
    await loadEntries();

    const allowed = new Set(entries.map(e => e.url));
    const opened = [];
    const blocked = [];

    if (!isExtension) {
      for (const url of urls) {
        if (!allowed.has(url)) { blocked.push(url); continue; }
        window.open(url, '_blank', 'noopener,noreferrer');
        opened.push(url);
      }
      await rememberOpened(opened);
      return { opened, blocked };
    }

    let cur = null;
    try { cur = await chrome.tabs.getCurrent(); } catch (e) { /* Ignore tab lookup errors. */ }

    let index = cur ? cur.index + 1 : undefined;

    for (const url of urls) {
      if (!allowed.has(url)) {
        blocked.push(url);
        continue;
      }

      const props = {
        url,
        active: opened.length === 0
      };

      if (cur) {
        props.openerTabId = cur.id;
        props.index = index;
      }

      const tab = await chrome.tabs.create(props);

      if (cur) index = tab.index + 1;

      opened.push(url);
    }

    await rememberOpened(opened);
    return { opened, blocked };
  }

  async function rememberOpened(urls) {
    if (!urls.length) return;
    recentUrls = [...new Set([...urls, ...recentUrls])].slice(0, 30);
    await browserStore.set({ recentUrls });
    renderDashboard();
  }

  /* ------------------------------------------------------------ rendering */

  function renderSidebar() {
    const ul = $('#chatList');
    const q = $('#chatSearch').value.trim().toLowerCase();

    ul.innerHTML = '';

    const list = sorted().filter(c =>
      !q ||
      c.title.toLowerCase().includes(q) ||
      c.messages.some(m => (m.text || '').toLowerCase().includes(q))
    );

    if (!list.length) {
      const li = document.createElement('li');
      li.className = 'empty-list';
      li.textContent = q
        ? 'No chats match your search.'
        : 'No chats yet. Start a new one.';

      ul.append(li);
      return;
    }

    for (const c of list) {
      const last = c.messages[c.messages.length - 1];
      const li = document.createElement('li');

      li.className = 'chat-item' + (c.id === activeId ? ' active' : '');
      li.dataset.id = c.id;

      li.innerHTML = `
        <div class="av">${ICONS.bot}</div>
        <div class="ci-body">
          <div class="ci-top">
            <span class="ci-title">${esc(c.title)}</span>
            <span class="ci-time">${esc(listTime(c.updatedAt))}</span>
          </div>
          <div class="ci-prev">${
            last
              ? esc((last.role === 'user' ? 'You: ' : '') + plain(last.text).slice(0, 70))
              : 'No messages yet'
          }</div>
        </div>
        <button class="icon-btn ci-more" title="More options"
          aria-label="More options for ${esc(c.title)}">${ICONS.more}</button>
      `;

      li.addEventListener('click', e => {
        if (e.target.closest('.ci-more')) return;

        selectChat(c.id);
        $('#sidebar').classList.remove('show');
      });

      li.addEventListener('contextmenu', e => {
        e.preventDefault();
        chatMenu(c, { x: e.clientX, y: e.clientY });
      });

      const more = $('.ci-more', li);

      more.addEventListener('click', e => {
        e.stopPropagation();

        const r = more.getBoundingClientRect();

        more.classList.add('open');

        chatMenu(
          c,
          { x: r.right, y: r.bottom },
          () => more.classList.remove('open')
        );
      });

      ul.append(li);
    }
  }

  function renderHeader() {
    const c = activeChat();

    $('#chatTitle').textContent = c ? c.title : 'New chat';
    $('#btnChatMenu').hidden = !c;
  }

  function welcomeEl() {
    const d = document.createElement('div');

    d.className = 'welcome';

    d.innerHTML = `
      <div class="big">${ICONS.bot}</div>
      <h2>Hi, I’m URL Navigator</h2>
      <p>I open websites from your curl.txt list, find sites by topic,
      and answer questions like a regular assistant.</p>
      <div class="chips"></div>
    `;

    const chips = $('.chips', d);

    [
      'open yt',
      'I want to watch videos',
      'List all URLs',
      'How many URLs are there?',
      'What can you do?'
    ].forEach(t => {
      const b = document.createElement('button');

      b.className = 'chip';
      b.textContent = t;
      b.addEventListener('click', () => send(t));

      chips.append(b);
    });

    return d;
  }

  function favEl(item) {
    const img = document.createElement('img');

    img.className = 'fav';
    img.alt = '';

    img.src =
      (isExtension
        ? chrome.runtime.getURL('/_favicon/') + '?pageUrl=' + encodeURIComponent(item.url) + '&size=32'
        : `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(item.url)}&sz=32`);

    img.addEventListener('error', () => {
      const s = document.createElement('span');

      s.className = 'fav fav-fallback';
      s.textContent = (item.name || '?').charAt(0).toUpperCase();

      img.replaceWith(s);
    }, { once: true });

    return img;
  }

  function itemsEl(chat, m) {
    const box = document.createElement('div');

    box.className = 'items';

    if (m.items.length > 12) {
      const f = document.createElement('input');

      f.className = 'items-filter';
      f.placeholder = `Filter ${m.items.length} URLs`;
      f.type = 'search';

      f.addEventListener('input', () => {
        const q = f.value.trim().toLowerCase();

        box.querySelectorAll('.item').forEach(r => {
          r.hidden = !!q && !r.dataset.s.includes(q);
        });
      });

      box.append(f);
    }

    const sc = document.createElement('div');
    sc.className = 'items-scroll';

    m.items.forEach((it, i) => {
      const row = document.createElement('div');

      row.className = 'item';
      row.dataset.s = (it.name + ' ' + it.host).toLowerCase();

      row.innerHTML = `
        <span class="item-n">${i + 1}</span>
        <div class="item-main">
          <div class="item-name">${esc(it.name)}</div>
          <div class="item-host">${esc(it.url)}</div>
        </div>
      `;

      row.insertBefore(favEl(it), row.children[1]);

      const b = document.createElement('button');

      b.className = 'item-open';
      b.textContent = 'Open';
      b.setAttribute('aria-label', `Open ${it.name}`);
      b.addEventListener('click', () => openFromItem(chat, it));

      const pin = document.createElement('button');
      pin.className = 'item-pin';
      pin.type = 'button';
      pin.textContent = it.favorite ? '★' : '☆';
      pin.title = it.favorite ? 'Unpin bookmark' : 'Pin bookmark';
      pin.addEventListener('click', () => toggleFavorite(it.url));

      row.append(pin, b);
      sc.append(row);
    });

    box.append(sc);

    return box;
  }

  function chipsEl(chips) {
    const w = document.createElement('div');

    w.className = 'chips';

    chips.forEach(c => {
      const b = document.createElement('button');

      b.className = 'chip';
      b.textContent = c.label;

      b.addEventListener('click', () => {
        if (c.action === 'settings') openSettings();
        else send(c.send || c.label);
      });

      w.append(b);
    });

    return w;
  }

  function msgEl(chat, m, isLast) {
    const me = m.role === 'user';
    const wrap = document.createElement('div');

    wrap.className = 'msg ' + (me ? 'me' : 'bot');

    if (!me) {
      const a = document.createElement('div');

      a.className = 'av';
      a.innerHTML = ICONS.bot;
      wrap.append(a);
    }

    const col = document.createElement('div');

    col.className = 'msg-col';

    col.innerHTML = `
      <div class="meta">
        ${me ? '' : '<b>URL Navigator</b>'}
        <span>${esc(msgTime(m.ts))}</span>
      </div>
    `;

    const bub = document.createElement('div');

    bub.className = 'bubble' + (m.error ? ' error' : '');

    if (me) {
      bub.textContent = m.text;
    } else if (m.streaming && !m.text) {
      bub.innerHTML = '<span class="dots"><i></i><i></i><i></i></span>';
    } else {
      bub.innerHTML = md(m.text, { links: !m.local });
    }

    col.append(bub);

    if (m.items && m.items.length) {
      col.append(itemsEl(chat, m));
    }

    if (m.chips && m.chips.length && isLast && !busy) {
      col.append(chipsEl(m.chips));
    }

    wrap.append(col);

    if (m.streaming) liveBubble = bub;

    return wrap;
  }

  function renderMessages(keepScroll) {
    const box = $('#messages');
    const c = activeChat();
    const prev = box.scrollTop;

    box.innerHTML = '';
    liveBubble = null;

    if (!c || !c.messages.length) {
      box.append(welcomeEl());
      return;
    }

    c.messages.forEach((m, i) => {
      box.append(msgEl(c, m, i === c.messages.length - 1));
    });

    box.scrollTop = keepScroll ? prev : box.scrollHeight;
  }

  function renderAll() {
    renderSidebar();
    renderHeader();
    renderMessages();
    setBusy(busy);
  }

  function setBusy(b) {
    busy = b;

    const btn = $('#btnSend');

    btn.innerHTML = b ? ICONS.stop : ICONS.send;
    btn.classList.toggle('stop', b);
    btn.title = btn.ariaLabel = b ? 'Stop generating' : 'Send';
  }

  /* ------------------------------------------------------------ menus & dialogs */

  function showMenu(pos, items, onClose) {
    const m = $('#menu');

    m.innerHTML = '';

    items.forEach(it => {
      const b = document.createElement('button');

      if (it.danger) b.className = 'danger';

      b.innerHTML = `${ICONS[it.icon] || ''}<span>${esc(it.label)}</span>`;
      b.addEventListener('click', () => {
        closeMenu();
        it.fn();
      });

      m.append(b);
    });

    m.hidden = false;

    const w = m.offsetWidth;
    const h = m.offsetHeight;

    m.style.left = Math.max(8, Math.min(pos.x - w, innerWidth - w - 8)) + 'px';
    m.style.top = Math.max(8, Math.min(pos.y + 4, innerHeight - h - 8)) + 'px';

    m._onClose = onClose;
  }

  function closeMenu() {
    const m = $('#menu');

    if (m.hidden) return;

    m.hidden = true;

    if (m._onClose) {
      m._onClose();
      m._onClose = null;
    }
  }

  document.addEventListener('click', e => {
    if (!e.target.closest('#menu')) closeMenu();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeMenu();
  });

  function dialog({ title, body = '', input, ok = 'OK', danger = false }) {
    return new Promise(resolve => {
      const d = $('#dlg');

      d.innerHTML = `
        <form method="dialog" class="dlg-card">
          <h3>${esc(title)}</h3>
          ${body ? `<p>${body}</p>` : ''}
          ${input !== undefined
            ? `<input id="dlgInput" class="field" value="${esc(input)}" maxlength="80" autocomplete="off">`
            : ''}
          <div class="dlg-actions">
            <button value="ok" class="btn ${danger ? 'danger' : 'primary'}">${esc(ok)}</button>
            <button value="cancel" class="btn">Cancel</button>
          </div>
        </form>
      `;

      d.returnValue = '';

      d.onclose = () => {
        resolve(
          d.returnValue === 'ok'
            ? (input !== undefined ? $('#dlgInput', d).value.trim() : true)
            : null
        );
      };

      d.showModal();

      const i = $('#dlgInput', d);

      if (i) {
        i.focus();
        i.select();
      }
    });
  }

  function chatMenu(c, pos, onClose) {
    showMenu(pos, [
      { label: 'Rename', icon: 'edit', fn: () => renameChat(c.id) },
      { label: 'Delete', icon: 'trash', danger: true, fn: () => deleteChat(c.id) }
    ], onClose);
  }

  /* ------------------------------------------------------------ chat management */

  function selectChat(id) {
    activeId = id;
    save();
    renderAll();
    $('#input').focus();
  }

  function startNewChat() {
    if (busy) return;

    activeId = null;
    save();
    renderAll();

    $('#sidebar').classList.remove('show');
    $('#input').focus();
  }

  async function renameChat(id) {
    const c = chats.find(x => x.id === id);

    if (!c) return;

    const name = await dialog({
      title: 'Rename chat',
      input: c.title,
      ok: 'Rename'
    });

    if (!name) return;

    c.title = name;
    c.autoTitle = false;

    save();
    renderSidebar();
    renderHeader();
  }

  async function deleteChat(id) {
    const c = chats.find(x => x.id === id);

    if (!c) return;

    const ok = await dialog({
      title: 'Delete this chat?',
      body: `“${esc(c.title)}” and its messages will be permanently deleted.`,
      ok: 'Delete',
      danger: true
    });

    if (!ok) return;

    if (busy && id === activeId && abortCtl) abortCtl.abort();

    chats = chats.filter(x => x.id !== id);

    if (activeId === id) activeId = null;

    save();
    renderAll();
    toast('Chat deleted');
  }

  async function deleteAll() {
    if (!chats.length) {
      toast('There are no chats to delete');
      return;
    }

    const ok = await dialog({
      title: 'Delete all chats?',
      body: `All ${chats.length} chat${chats.length === 1 ? '' : 's'} and their history will be permanently deleted. This can’t be undone.`,
      ok: 'Delete all',
      danger: true
    });

    if (!ok) return;

    if (abortCtl) abortCtl.abort();

    chats = [];
    activeId = null;

    save();
    renderAll();
    toast('All chats deleted');
  }

  /* ------------------------------------------------------------ sending */

  function pushBot(chat, fields) {
    const m = Object.assign({
      id: uid(),
      role: 'assistant',
      ts: Date.now()
    }, fields);

    chat.messages.push(m);
    chat.updatedAt = Date.now();

    return m;
  }

  async function openFromItem(chat, it) {
    const { opened } = await openUrls([it.url]);

    pushBot(chat, {
      local: true,
      text: opened.length
        ? `Opened **${it.name}** in a new tab.`
        : `**${it.name}** is no longer listed in curl.txt, so I didn’t open it.`
    });

    save();

    if (chat.id === activeId) renderMessages();

    renderSidebar();
  }

  async function send(text) {
    text = (text || '').trim();

    if (!text || busy) return;

    let chat = activeChat();

    if (!chat) {
      chat = newChat();
      activeId = chat.id;
    }

    const um = {
      id: uid(),
      role: 'user',
      text,
      ts: Date.now()
    };

    chat.messages.push(um);
    chat.updatedAt = Date.now();

    if (
      chat.autoTitle &&
      chat.messages.filter(m => m.role === 'user').length === 1
    ) {
      chat.title = text.length > 42
        ? text.slice(0, 40).trim() + '…'
        : text;
    }

    $('#input').value = '';
    autosize();

    await loadEntries();

    const res = UrlEngine.handle(
      text,
      { pending: chat.pending, lastList: chat.lastList },
      entries
    );

    if (res) {
      um.local = true;

      let body = res.text;

      if (res.open) {
        const { opened, blocked } = await openUrls(res.open);

        if (blocked.length) {
          body = opened.length
            ? body
            : 'That URL is no longer listed in curl.txt, so I didn’t open it.';
        }
      }

      chat.pending = res.pending || null;

      if (res.lastList) chat.lastList = res.lastList;

      pushBot(chat, {
        local: true,
        text: body,
        items: res.items,
        chips: res.chips
      });

      save();
      renderAll();

      return;
    }

    chat.pending = null;
    chat.lastList = null;

    if (!settings.apiKey) {
      pushBot(chat, {
        local: true,
        text: 'I can answer general questions once you add an API key in **Settings**. URL features (open a site, list, count, search by topic) already work without one.',
        chips: [{ label: 'Open settings', action: 'settings' }]
      });

      save();
      renderAll();

      return;
    }

    await askLLM(chat);
  }

  /* ------------------------------------------------------------ LLM streaming */

  async function errText(r) {
    try {
      const j = await r.json();

      return (
        (j.error && (j.error.message || j.error)) ||
        `HTTP ${r.status}`
      );
    } catch (e) {
      return `HTTP ${r.status}`;
    }
  }

  async function* sse(r) {
    const reader = r.body.getReader();
    const dec = new TextDecoder();

    let buf = '';

    for (;;) {
      const { done, value } = await reader.read();

      if (done) break;

      buf += dec.decode(value, { stream: true });

      let i;

      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim();

        buf = buf.slice(i + 1);

        if (!line.startsWith('data:')) continue;

        const p = line.slice(5).trim();

        if (!p || p === '[DONE]') continue;

        try {
          yield JSON.parse(p);
        } catch (e) {
          // Ignore incomplete or malformed SSE events.
        }
      }
    }
  }

  async function* streamChat(msgs, signal) {
    const s = settings;

    /* Anthropic API */
    if (s.provider === 'anthropic') {
      const base = (
        s.baseUrl || 'https://api.anthropic.com'
      ).replace(/\/+$/, '');

      const r = await fetch(base + '/v1/messages', {
        method: 'POST',
        signal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': s.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: s.model,
          max_tokens: 2048,
          stream: true,
          system: SYSTEM,
          messages: msgs
        })
      });

      if (!r.ok) throw new Error(await errText(r));

      for await (const d of sse(r)) {
        if (
          d.type === 'content_block_delta' &&
          d.delta &&
          d.delta.text
        ) {
          yield d.delta.text;
        } else if (d.type === 'error') {
          throw new Error(
            (d.error && d.error.message) || 'Anthropic stream error'
          );
        }
      }

      return;
    }

    /* OpenAI-compatible API: OpenAI, Groq, or compatible server */
    const defaultBase =
      PROVIDER_DEFAULT_BASE[s.provider] ||
      PROVIDER_DEFAULT_BASE.compatible;

    const base = (s.baseUrl || defaultBase).replace(/\/+$/, '');

    if (!base) {
      throw new Error('Enter a valid API Base URL in Settings.');
    }

    const r = await fetch(base + '/chat/completions', {
      method: 'POST',
      signal,
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer ' + s.apiKey
      },
      body: JSON.stringify({
        model: s.model,
        stream: true,
        messages: [
          { role: 'system', content: SYSTEM },
          ...msgs
        ]
      })
    });

    if (!r.ok) throw new Error(await errText(r));

    for await (const d of sse(r)) {
      const t =
        d.choices &&
        d.choices[0] &&
        d.choices[0].delta &&
        d.choices[0].delta.content;

      if (typeof t === 'string' && t) yield t;

      if (
        d.error &&
        d.error.message
      ) {
        throw new Error(d.error.message);
      }
    }
  }

  async function askLLM(chat) {
    let hist = chat.messages
      .filter(m => !m.local && !m.error && m.text && !m.streaming)
      .slice(-30)
      .map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.text
      }));

    while (hist.length && hist[0].role !== 'user') hist.shift();

    const bm = pushBot(chat, {
      text: '',
      streaming: true
    });

    setBusy(true);
    renderAll();

    abortCtl = new AbortController();

    const box = $('#messages');

    try {
      for await (const piece of streamChat(hist, abortCtl.signal)) {
        bm.text += piece;

        if (liveBubble && chat.id === activeId) {
          liveBubble.innerHTML = md(bm.text, { links: true });
          box.scrollTop = box.scrollHeight;
        }
      }

      if (!bm.text) {
        bm.text = '(No response)';
        bm.local = true;
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        bm.error = true;
        bm.text =
          `Couldn’t get a reply: ${e.message || e}. ` +
          'Check your API key, model and base URL in Settings.';
      } else if (!bm.text) {
        bm.text = 'Stopped.';
        bm.local = true;
      }
    } finally {
      bm.streaming = false;
      abortCtl = null;
      chat.updatedAt = Date.now();

      setBusy(false);

      if (chats.includes(chat)) {
        save();
        renderAll();
      }
    }
  }

  /* ------------------------------------------------------------ settings */

  const PROVIDER_DEFAULT_MODEL = {
    anthropic: 'claude-sonnet-5-5',
    openai: 'gpt-4o-mini',
    groq: 'llama-3.3-70b-versatile',
    compatible: 'your-model-name'
  };

  const PROVIDER_DEFAULT_BASE = {
    anthropic: 'https://api.anthropic.com',
    openai: 'https://api.openai.com/v1',
    groq: 'https://api.groq.com/openai/v1',
    compatible: ''
  };

  async function updateSrcStatus() {
    await loadEntries();

    $('#srcStatus').textContent =
      `Using ${source}: ${entries.length} URL${entries.length === 1 ? '' : 's'} loaded. Added URLs are saved in this browser. Download curl.txt to keep or share the updated list.`;
    renderUrlManager();
  }

  async function readCurlSource() {
    const saved = await browserStore.get(['curlText']);
    if (typeof saved.curlText === 'string') return saved.curlText;
    const response = await fetch(assetUrl('curl.txt'), { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load the bundled curl.txt file.');
    return response.text();
  }

  function updateCategoryHint() {
    const input = $('#addUrlInput').value.trim();
    const hint = $('#addUrlHint');
    if (!input) {
      hint.textContent = "Enter a URL and I'll suggest a category.";
      return;
    }
    const selected = UrlEngine.getCategories().find(item => item.id === $('#addUrlCategory').value);
    if (selected) {
      hint.textContent = `Selected category: ${selected.label}.`;
      return;
    }
    const detected = UrlEngine.suggestCategory(input);
    const cat = UrlEngine.getCategories().find(item => item.id === detected);
    hint.textContent = cat
      ? `Suggested category: ${cat.label}. You can change it above.`
      : 'No category detected. Choose one above or select Other.';
  }

  async function addUrl() {
    const input = $('#addUrlInput');
    let url;
    try {
      url = new URL(input.value.trim());
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
      url.hash = '';
    } catch {
      toast('Enter a valid http:// or https:// URL.');
      input.focus();
      return;
    }
    const normalized = url.href;
    await loadEntries();
    const key = value => value.replace(/\/$/, '').toLowerCase();
    if (entries.some(entry => key(entry.url) === key(normalized))) {
      toast('That URL is already in your list.');
      return;
    }

    const selected = $('#addUrlCategory').value;
    const categoryId = selected || UrlEngine.suggestCategory(normalized) || 'other';
    const category = UrlEngine.getCategories().find(item => item.id === categoryId) || UrlEngine.getCategories().find(item => item.id === 'other');
    try {
      const parsed = UrlEngine.parseCurl(`curl "${normalized}"`)[0];
      parsed.categoryId = category.id;
      parsed.categoryLabel = category.label;
      parsed.title = $('#addUrlTitle').value.trim();
      parsed.tags = $('#addUrlTags').value.split(',').map(tag => tag.trim()).filter(Boolean);
      await saveUrlEntries([...entries, parsed]);
      input.value = '';
      $('#addUrlTitle').value = '';
      $('#addUrlTags').value = '';
      $('#addUrlCategory').value = '';
      await updateSrcStatus();
      renderAll();
      updateCategoryHint();
      toast(`Added to ${category.label}.`);
    } catch (error) {
      toast(error.message || 'Could not save this URL.');
    }
  }

  async function downloadCurl() {
    try {
      const text = await readCurlSource();
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'curl.txt';
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      toast('Downloaded curl.txt');
    } catch (error) {
      toast(error.message || 'Could not download curl.txt.');
    }
  }

  function openSettings() {
    $('#setProvider').value = settings.provider;
    $('#setKey').value = settings.apiKey;
    $('#setModel').value = settings.model;
    $('#setBase').value = settings.baseUrl;

    $('#setBase').placeholder =
      PROVIDER_DEFAULT_BASE[settings.provider] || '';

    updateSrcStatus();

    $('#settingsDlg').showModal();
  }

  async function saveSettings() {
    const next = {
      provider: $('#setProvider').value,
      apiKey: $('#setKey').value.trim(),
      model: $('#setModel').value.trim(),
      baseUrl: $('#setBase').value.trim()
    };

    if (!next.model) {
      next.model = PROVIDER_DEFAULT_MODEL[next.provider];
    }

    if (
      !Object.prototype.hasOwnProperty.call(
        PROVIDER_DEFAULT_MODEL,
        next.provider
      )
    ) {
      toast('Select a supported provider.');
      return;
    }

    if (!next.baseUrl && next.provider !== 'compatible') {
      next.baseUrl = PROVIDER_DEFAULT_BASE[next.provider] || '';
    }

    if (next.baseUrl) {
      try {
        const parsed = new URL(next.baseUrl);

        if (parsed.protocol !== 'https:') {
          toast('Use an HTTPS API endpoint.');
          return;
        }

        const origin = parsed.origin + '/*';

        if (isExtension && !(await chrome.permissions.contains({ origins: [origin] }))) {
          const ok = await chrome.permissions.request({
            origins: [origin]
          });

          if (!ok) {
            toast('Permission for that endpoint was not granted.');
            return;
          }
        }
      } catch (e) {
        toast('Base URL is not valid.');
        return;
      }
    }

    settings = next;

    await browserStore.set({ settings });

    $('#settingsDlg').close();

    toast('Settings saved');
  }

  /* ------------------------------------------------------------ composer */

  function autosize() {
    const t = $('#input');

    t.style.height = 'auto';
    t.style.height = Math.min(t.scrollHeight, 160) + 'px';
  }

  /* ------------------------------------------------------------ init */

  async function init() {
    paintIcons();

    const st = await browserStore.get([
      'chats',
      'activeId',
      'settings'
    ]);

    chats = Array.isArray(st.chats) ? st.chats : [];

    chats.forEach(c => {
      c.messages.forEach(m => {
        if (m.streaming) {
          m.streaming = false;

          if (!m.text) {
            m.text = 'Stopped.';
            m.local = true;
          }
        }
      });
    });

    activeId = chats.some(c => c.id === st.activeId)
      ? st.activeId
      : null;

    settings = { ...DEFAULTS, ...(st.settings || {}) };

    await loadEntries();
    refreshCategoryControls();

    renderAll();

    $('#btnNew').addEventListener('click', startNewChat);

    $('#btnListMenu').addEventListener('click', e => {
      e.stopPropagation();

      const r = e.currentTarget.getBoundingClientRect();

      showMenu(
        { x: r.right, y: r.bottom },
        [{
          label: 'Delete all chats',
          icon: 'trash',
          danger: true,
          fn: deleteAll
        }]
      );
    });

    $('#btnChatMenu').addEventListener('click', e => {
      e.stopPropagation();

      const c = activeChat();

      if (!c) return;

      const r = e.currentTarget.getBoundingClientRect();

      chatMenu(c, { x: r.right, y: r.bottom });
    });

    $('#btnSide').addEventListener('click', e => {
      e.stopPropagation();
      $('#sidebar').classList.toggle('show');
    });

    $('#chatSearch').addEventListener('input', renderSidebar);
    $('#btnSettings').addEventListener('click', openSettings);
    $('#btnBookmarks').addEventListener('click', openDashboard);
    $('#btnDashboard').addEventListener('click', openDashboard);
    $('#btnCloseDashboard').addEventListener('click', () => $('#dashboardDlg').close());
    $('#dashboardSearch').addEventListener('input', renderDashboard);
    $('#urlManagerSearch').addEventListener('input', renderUrlManager);
    $('#urlManagerCategory').addEventListener('change', renderUrlManager);
    $('#urlManagerProtocol').addEventListener('change', renderUrlManager);
    $('#btnAddCategory').addEventListener('click', addCustomCategory);

    const input = $('#input');

    input.addEventListener('input', autosize);

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        send(input.value);
      }
    });

    $('#btnSend').addEventListener('click', () => {
      if (busy) {
        if (abortCtl) abortCtl.abort();
      } else {
        send(input.value);
      }
    });

    input.focus();

    /* Provider selection */
    $('#setProvider').addEventListener('change', e => {
      const p = e.target.value;
      const model = $('#setModel');
      const base = $('#setBase');

      const knownModels = Object.values(PROVIDER_DEFAULT_MODEL);
      const knownBases = Object.values(PROVIDER_DEFAULT_BASE);

      if (
        knownModels.includes(model.value.trim()) ||
        !model.value.trim()
      ) {
        model.value = PROVIDER_DEFAULT_MODEL[p];
      }

      if (
        !base.value.trim() ||
        knownBases.includes(base.value.trim())
      ) {
        base.value = PROVIDER_DEFAULT_BASE[p] || '';
      }

      base.placeholder =
        PROVIDER_DEFAULT_BASE[p] ||
        'https://your-compatible-endpoint/v1';
    });

    $('#btnSaveSettings').addEventListener('click', saveSettings);

    $('#btnCloseSettings').addEventListener('click', () => {
      $('#settingsDlg').close();
    });

    $('#btnImport').addEventListener('click', () => {
      $('#fileImport').click();
    });

    $('#addUrlInput').addEventListener('input', updateCategoryHint);
    $('#addUrlCategory').addEventListener('change', updateCategoryHint);
    $('#btnAddUrl').addEventListener('click', addUrl);
    $('#btnExportCurl').addEventListener('click', downloadCurl);

    $('#fileImport').addEventListener('change', async e => {
      const f = e.target.files[0];

      if (!f) return;

      const text = await f.text();

      if (!UrlEngine.parseCurl(text).length) {
        toast('No curl "https://…" lines found in that file');
        e.target.value = '';
        return;
      }

      await browserStore.set({
        curlText: text,
        curlName: f.name
      });

      e.target.value = '';

      await updateSrcStatus();

      toast('curl file imported');
    });

    $('#btnBundled').addEventListener('click', async () => {
      await browserStore.remove(['curlText', 'curlName']);
      await updateSrcStatus();
      toast('Using the bundled curl.txt');
    });

    $('#btnReload').addEventListener('click', async () => {
      await updateSrcStatus();
      toast('Reloaded');
    });
  }

  init();
})();
