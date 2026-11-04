/* urlengine.js
 * Local, deterministic URL retrieval. It ONLY ever returns URLs parsed from curl.txt.
 * handle(text, state, entries) -> response object, or null when the message is not about URLs
 * (the app then forwards it to the LLM).
 */
(function (root) {
  'use strict';

  /* ---------- parsing ---------- */
  const DISPLAY = {
    youtube: 'YouTube', github: 'GitHub', gitlab: 'GitLab', linkedin: 'LinkedIn', duckduckgo: 'DuckDuckGo',
    stackoverflow: 'Stack Overflow', whatsapp: 'WhatsApp', openai: 'OpenAI', chatgpt: 'ChatGPT', paypal: 'PayPal',
    tiktok: 'TikTok', ebay: 'eBay', imdb: 'IMDb', soundcloud: 'SoundCloud', huggingface: 'Hugging Face',
    leetcode: 'LeetCode', codepen: 'CodePen', aliexpress: 'AliExpress', primevideo: 'Prime Video',
    disneyplus: 'Disney+', jiosaavn: 'JioSaavn', coinmarketcap: 'CoinMarketCap', tradingview: 'TradingView',
    geeksforgeeks: 'GeeksforGeeks', espncricinfo: 'ESPNcricinfo', makemytrip: 'MakeMyTrip', nytimes: 'NY Times',
    bbc: 'BBC', cnn: 'CNN', ndtv: 'NDTV', espn: 'ESPN', ign: 'IGN', npmjs: 'npm', pypi: 'PyPI', x: 'X',
    steampowered: 'Steam', w3schools: 'W3Schools', khanacademy: 'Khan Academy', accuweather: 'AccuWeather',
    perplexity: 'Perplexity', moneycontrol: 'Moneycontrol', thehindu: 'The Hindu', hotstar: 'Hotstar'
  };
  const GENERIC_SUB = new Set(['open', 'web', 'app', 'm', 'mobile']);
  const SLD = new Set(['co', 'com', 'org', 'net', 'gov', 'edu', 'ac', 'ne', 'or']);
  const capital = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

  function splitHost(host) {
    const p = host.split('.');
    if (p.length === 1 || /^\d+(\.\d+){3}$/.test(host)) return { main: host, sub: '' };
    let tld = 1;
    if (p.length >= 3 && p[p.length - 1].length === 2 && SLD.has(p[p.length - 2])) tld = 2;
    const idx = Math.max(p.length - 1 - tld, 0);
    return { main: p[idx], sub: p.slice(0, idx).join('.') };
  }

  function parseCurl(text) {
    const out = [], seen = new Set();
    for (const raw of String(text || '').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const m = line.match(/https?:\/\/[^\s"'<>]+/i);
      if (!m) continue;
      const url = m[0].replace(/[),;]+$/, '');
      let u;
      try { u = new URL(url); } catch (e) { continue; }
      const key = u.href.replace(/\/$/, '').toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const host = u.hostname.toLowerCase().replace(/^www\./, '');
      let { main, sub } = splitHost(host);
      if (GENERIC_SUB.has(sub)) sub = '';
      let name = DISPLAY[main] || capital(main);
      if (sub) name += ' ' + sub.split('.').map(capital).join(' ');
      out.push({ url, host, main, sub, name, nameKey: name.toLowerCase().replace(/[^a-z0-9]/g, '') });
    }
    return out;
  }

  /* ---------- knowledge: aliases & categories ---------- */
  const ALIASES = {
    yt: ['youtube'], ytube: ['youtube'], utube: ['youtube'], youtub: ['youtube'], fb: ['facebook'], insta: ['instagram'],
    ig: ['instagram'], gh: ['github'], gl: ['gitlab'], so: ['stackoverflow'], ddg: ['duckduckgo'], wiki: ['wikipedia'],
    gmail: ['mail.google', 'gmail'], gdrive: ['drive.google'], gdocs: ['docs.google'], gsheets: ['sheets.google'],
    gmaps: ['maps.google'], twitter: ['twitter', 'x.com'], tweet: ['twitter', 'x.com'], x: ['x.com'], li: ['linkedin'],
    amz: ['amazon'], gpt: ['chatgpt', 'openai'], openai: ['openai', 'chatgpt'], wa: ['whatsapp'], tg: ['telegram'],
    prime: ['primevideo'], hn: ['news.ycombinator'], teams: ['teams.microsoft'], ms: ['microsoft'], yahoo: ['yahoo'],
    ytmusic: ['music.youtube'], spotify: ['spotify'], hotmail: ['outlook', 'live.com'], bard: ['gemini'], steam: ['steam']
  };

  const CATS = [
    { id: 'video', label: 'Video', key: 'video', triggers: ['video', 'movie', 'film', 'tv', 'series', 'stream', 'streaming', 'clip', 'anime', 'cinema', 'trailer'], verbs: ['watch', 'watching'],
      hosts: ['youtube', 'vimeo', 'dailymotion', 'twitch', 'netflix', 'primevideo', 'hotstar', 'disneyplus', 'hulu', 'hbomax', 'max.com', 'tiktok', 'peacocktv', 'crunchyroll', 'bilibili', 'rumble', 'ted.com', 'jiocinema', 'zee5', 'sonyliv', 'mxplayer', 'paramountplus', 'appletv', 'imdb', 'vevo'] },
    { id: 'search', label: 'Search engines', key: 'search engine', triggers: ['search engine', 'web search', 'browse', 'internet'], verbs: [],
      hosts: ['google.com', 'google.co.in', 'bing', 'duckduckgo', 'yahoo.com', 'brave', 'ecosia', 'startpage', 'yandex', 'baidu', 'qwant', 'searx', 'ask.com', 'aol.com', 'kagi', 'you.com', 'dogpile', 'mojeek', 'metager'] },
    { id: 'social', label: 'Social media', key: 'social', triggers: ['social', 'social media', 'networking'], verbs: [],
      hosts: ['facebook', 'instagram', 'twitter', 'x.com', 'linkedin', 'reddit', 'pinterest', 'snapchat', 'tiktok', 'tumblr', 'threads', 'mastodon', 'discord', 'telegram', 'whatsapp', 'quora', 'weibo', 'bluesky'] },
    { id: 'music', label: 'Music', key: 'music', triggers: ['music', 'song', 'podcast', 'radio', 'playlist', 'album'], verbs: ['listen', 'listening'],
      hosts: ['spotify', 'soundcloud', 'music.youtube', 'music.apple', 'pandora', 'deezer', 'tidal', 'gaana', 'jiosaavn', 'wynk', 'bandcamp', 'last.fm', 'audiomack', 'amazonmusic'] },
    { id: 'shopping', label: 'Shopping', key: 'shopping', triggers: ['shopping', 'online store', 'store', 'deal', 'ecommerce', 'e-commerce'], verbs: ['buy', 'shop', 'purchase'],
      hosts: ['amazon', 'ebay', 'flipkart', 'walmart', 'etsy', 'aliexpress', 'alibaba', 'myntra', 'target.com', 'bestbuy', 'shopify', 'meesho', 'snapdeal', 'temu', 'shein', 'costco', 'ikea', 'zalando', 'nykaa', 'ajio'] },
    { id: 'news', label: 'News', key: 'news', triggers: ['newspaper', 'current affair'], verbs: ['news', 'headline'],
      hosts: ['bbc', 'cnn', 'nytimes', 'theguardian', 'reuters', 'aljazeera', 'ndtv', 'thehindu', 'timesofindia', 'hindustantimes', 'indiatoday', 'foxnews', 'washingtonpost', 'bloomberg', 'forbes', 'apnews', 'news.google', 'wsj', 'techcrunch', 'theverge', 'news.'] },
    { id: 'mail', label: 'Email', key: 'email', triggers: ['mail', 'email', 'inbox'], verbs: [],
      hosts: ['gmail', 'mail.', 'outlook', 'proton', 'zoho', 'icloud', 'tutanota', 'fastmail'] },
    { id: 'dev', label: 'Developer', key: 'developer', triggers: ['coding', 'code', 'programming', 'developer', 'dev', 'repo', 'repository', 'algorithm'], verbs: [],
      hosts: ['github', 'gitlab', 'stackoverflow', 'bitbucket', 'npmjs', 'pypi', 'codepen', 'replit', 'leetcode', 'hackerrank', 'w3schools', 'mozilla', 'developer.', 'geeksforgeeks', 'dev.to', 'kaggle', 'huggingface', 'codeforces', 'codechef'] },
    { id: 'ai', label: 'AI tools', key: 'ai', triggers: ['ai', 'artificial intelligence', 'llm', 'chatbot'], verbs: [],
      hosts: ['openai', 'chatgpt', 'claude', 'anthropic', 'gemini', 'perplexity', 'copilot', 'huggingface', 'midjourney', 'poe.com', 'character.ai', 'deepseek', 'mistral', 'grok'] },
    { id: 'travel', label: 'Maps & travel', key: 'travel', triggers: ['map', 'travel', 'trip', 'flight', 'hotel', 'ticket', 'navigation', 'direction', 'cab', 'taxi', 'ride'], verbs: [],
      hosts: ['maps.', 'openstreetmap', 'booking', 'airbnb', 'tripadvisor', 'expedia', 'makemytrip', 'skyscanner', 'kayak', 'uber', 'olacabs', 'goibibo', 'irctc', 'cleartrip', 'yatra'] },
    { id: 'education', label: 'Learning', key: 'education', triggers: ['learn', 'learning', 'course', 'tutorial', 'education', 'study', 'school', 'college', 'lecture'], verbs: ['learn', 'study'],
      hosts: ['coursera', 'udemy', 'edx', 'khanacademy', 'byjus', 'unacademy', 'nptel', 'duolingo', 'brilliant', 'quizlet', 'udacity', 'skillshare', 'w3schools', 'geeksforgeeks'] },
    { id: 'work', label: 'Productivity', key: 'productivity', triggers: ['productivity', 'office', 'document', 'spreadsheet', 'meeting', 'collaboration', 'design', 'notes'], verbs: [],
      hosts: ['docs.google', 'drive.google', 'sheets.google', 'slides.google', 'calendar.google', 'notion', 'trello', 'slack', 'zoom', 'teams.microsoft', 'office', 'dropbox', 'asana', 'atlassian', 'jira', 'figma', 'canva', 'miro', 'airtable', 'evernote'] },
    { id: 'finance', label: 'Finance', key: 'finance', triggers: ['finance', 'money', 'stock', 'crypto', 'bank', 'banking', 'payment', 'invest', 'investing', 'trading', 'market'], verbs: [],
      hosts: ['paypal', 'zerodha', 'moneycontrol', 'bloomberg', 'coinmarketcap', 'binance', 'coinbase', 'tradingview', 'finance.yahoo', 'investing.com', 'nasdaq', 'phonepe', 'paytm', 'groww', 'nseindia', 'bseindia'] },
    { id: 'gaming', label: 'Gaming', key: 'game', triggers: ['game', 'gaming', 'gamer'], verbs: [],
      hosts: ['steam', 'epicgames', 'twitch', 'roblox', 'ign', 'gamespot', 'itch.io', 'xbox', 'playstation', 'miniclip', 'poki', 'crazygames'] },
    { id: 'sports', label: 'Sports', key: 'sport', triggers: ['sport', 'score', 'cricket', 'football', 'soccer', 'basketball', 'tennis', 'ipl', 'nba'], verbs: [],
      hosts: ['espn', 'cricbuzz', 'espncricinfo', 'nba.com', 'fifa', 'bleacherreport', 'skysports', 'goal.com', 'icc-cricket', 'bcci', 'premierleague'] },
    { id: 'food', label: 'Food', key: 'food', triggers: ['food', 'recipe', 'restaurant', 'delivery', 'cooking', 'dining'], verbs: [],
      hosts: ['zomato', 'swiggy', 'ubereats', 'doordash', 'allrecipes', 'tasty', 'yummly', 'dominos', 'pizzahut', 'mcdonalds', 'eatsure'] },
    { id: 'reference', label: 'Reference', key: 'reference', triggers: ['wiki', 'encyclopedia', 'dictionary', 'reference', 'definition'], verbs: [],
      hosts: ['wikipedia', 'britannica', 'dictionary', 'merriam', 'thesaurus', 'wolframalpha', 'wikimedia'] },
    { id: 'weather', label: 'Weather', key: 'weather', triggers: ['forecast', 'temperature', 'rain'], verbs: ['weather'],
      hosts: ['weather', 'accuweather', 'wunderground', 'windy.com', 'imd.gov'] },
    { id: 'health', label: 'Health', key: 'health', triggers: ['health', 'medical', 'doctor', 'medicine', 'symptom', 'fitness'], verbs: [],
      hosts: ['webmd', 'mayoclinic', 'nih.gov', 'who.int', 'healthline', 'practo', '1mg', 'cdc.gov'] }
  ];

  function hostHas(e, f) {
    const h = e.host;
    if (f.endsWith('.')) return h.startsWith(f) || h.includes('.' + f);
    if (f.includes('.')) return h === f || h.endsWith('.' + f) || h.startsWith(f);
    if (f.length <= 4) return e.main === f;
    return h.includes(f);
  }
  const inCat = (e, cat) => cat.hosts.some(f => hostHas(e, f));

  /* ---------- text helpers ---------- */
  const NOSTEM = new Set(['news', 'this', 'chess', 'tennis', 'focus', 'bus', 'plus', 'gas']);
  const stem = t => (t.length > 3 && t.endsWith('s') && !/(ss|us|is)$/.test(t) && !NOSTEM.has(t)) ? t.slice(0, -1) : t;
  const stemPhrase = p => p.split(' ').map(stem).join(' ');
  const normalize = s => String(s).toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9.#\s-]/g, ' ').replace(/\s+/g, ' ').trim();

  const STOP = new Set(('i me my to the a an please pls plz can could would you want wanna need like take show site sites website websites url urls link links page pages of for on in up let lets us now kindly and or it this that tab new next browser open visit launch go goto navigate load bring pull head do have is there any available list curl txt file from are be if all every display give view see print get total count many number how some few which first top last').split(' '));

  const YES = /^(y|yes|yeah|yep|yup|ya|yea|sure|ok|okay|haan|please do|do it|go ahead|open it|open|yes please|yes open|yes open it|confirm|proceed|go)$/;
  const NO = /^(n|no|nope|nah|cancel|stop|dont|do not|never mind|nevermind|not now|no thanks|no thank you)$/;
  const NUMPICK = /^(?:(?:open|select|choose|pick|number|num|option|go to|visit)\s+)?#?\d+(?:\s*(?:,|&|and|\s)\s*#?\d+)*\s*[.!]?$/i;
  const OPEN_VERB = /\b(open|visit|launch|goto|go to|take me to|navigate( to)?|load|bring up|pull up|head to)\b/;
  const LOOKUP = /\b(do you have|is there|have you got|are there|got any)\b|\bis .+ (available|in the (list|file))\b/;
  const INTENT = /\b(want|wanna|need|looking|look|find|show|list|give|suggest|recommend|any|which|where|best|good|sites?|websites?|urls?|links?|pages?|open|visit|browse|let me|like to|help me|get me|related)\b/;

  function lev(a, b) {
    if (a === b) return 0;
    const m = a.length, n = b.length;
    if (!m || !n) return Math.max(m, n);
    let prev = Array.from({ length: n + 1 }, (_, i) => i);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }

  /* ---------- matching ---------- */
  function resolve(tokens, entries, allowFuzzy) {
    const toks = tokens.map(t => t.replace(/^[.\-#]+|[.\-#]+$/g, '')).filter(Boolean);
    if (!toks.length) return [];
    const cand = new Set(toks);
    if (toks.length > 1 && toks.length <= 4) {
      cand.add(toks.join(''));
      for (let i = 0; i < toks.length - 1; i++) cand.add(toks[i] + toks[i + 1]);
    }
    const out = [];
    for (const e of entries) {
      const pen = e.sub ? 10 : 0;
      let best = 0, fuzzy = false;
      for (const t of cand) {
        let s = 0, f = false;
        if (t.includes('.') && (e.host === t || e.host.endsWith('.' + t))) s = 100;
        else if (e.nameKey === t) s = 100;
        else if (e.main === t) s = 100 - pen;
        else if ((ALIASES[t] || []).some(a => hostHas(e, a))) s = 90 - pen;
        else if (t.length >= 3 && e.main.startsWith(t)) s = 70 - pen;
        else if (t.length >= 4 && e.host.includes(t)) s = 50 - pen;
        else if (allowFuzzy && t.length >= 4 && lev(e.main, t) <= (t.length >= 7 ? 2 : 1)) { s = 30; f = true; }
        if (s > best) { best = s; fuzzy = f; }
      }
      if (best) out.push({ e, score: best, fuzzy });
    }
    return out.sort((a, b) => b.score - a.score || a.e.host.length - b.e.host.length);
  }

  function matchCategories(norm, force) {
    const padded = ' ' + norm.split(' ').map(stem).join(' ') + ' ';
    const hasIntent = INTENT.test(norm);
    const found = [];
    for (const cat of CATS) {
      let hits = 0, self = false;
      for (const t of cat.triggers) if (padded.includes(' ' + stemPhrase(t) + ' ')) hits++;
      for (const v of cat.verbs) if (padded.includes(' ' + stemPhrase(v) + ' ')) { hits++; self = true; }
      if (hits && (force || self || hasIntent)) found.push({ cat, hits });
    }
    if (!found.length) return [];
    const max = Math.max(...found.map(f => f.hits));
    return found.filter(f => f.hits === max).map(f => f.cat);
  }

  /* ---------- responses ---------- */
  const toItem = e => ({ name: e.name, url: e.url, host: e.host });
  const listResp = (text, es, extra) => Object.assign({ text, items: es.map(toItem), lastList: es.map(e => e.url), pending: null }, extra || {});
  const nameOf = (entries, url) => (entries.find(e => e.url === url) || {}).name || url;
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

  const HELP = [
    'I can open websites **only from your curl.txt list**, and chat like a normal assistant for everything else. Try:',
    '',
    '- **open yt** or **open github**: I’ll ask before opening it in a new tab',
    '- **I want to watch videos**, **music sites**, **where can I shop**: I’ll list matching URLs to choose from',
    '- **list all URLs** / **list first 10 URLs**',
    '- **how many URLs?** / **how many video URLs?**',
    '- **show categories**',
    '- **URLs ending with .org** / **URLs containing google** / **URLs starting with y**',
    '- **do you have reddit?**',
    '',
    'After I show a list, type a number (or several, like **2 5**) to open those.'
  ].join('\n');

  function categoryList(cats, entries) {
    const set = new Set(), es = [];
    for (const c of cats) for (const e of entries) if (!set.has(e.url) && inCat(e, c)) { set.add(e.url); es.push(e); }
    const label = cats.map(c => c.label.toLowerCase()).join(' / ');
    if (!es.length) return { text: `I couldn’t find any **${label}** URLs in curl.txt.`, pending: null, chips: [{ label: 'Show categories', send: 'show categories' }, { label: 'List all URLs', send: 'list all URLs' }] };
    return listResp(`I found **${plural(es.length, 'URL')}** for **${label}** in curl.txt. Click **Open**, or type a number to choose:`, es);
  }

  function entityResp(res, q, lookup, entries) {
    const top = res[0], second = res[1];
    const single = (top.score >= 70 && (!second || top.score - second.score >= 10)) || (res.length === 1 && top.score >= 30);
    if (single) {
      const e = top.e;
      const pending = { type: 'open', url: e.url, name: e.name };
      const chips = [{ label: 'Yes, open it', send: 'yes' }, { label: 'No', send: 'no' }];
      if (top.fuzzy) return { text: `I couldn’t find an exact match for **“${q}”**. Did you mean **${e.name}** (\`${e.url}\`)? Should I open it?`, pending, chips };
      if (lookup) return { text: `Yes, **${e.name}** (\`${e.url}\`) is in curl.txt. Should I open it?`, pending, chips };
      return { text: `Should I open **${e.name}** (\`${e.url}\`)?`, pending, chips };
    }
    const list = res.filter(r => r.score >= top.score - 30).slice(0, 10).map(r => r.e);
    return listResp(`I found **${list.length} match${list.length === 1 ? '' : 'es'}** for **“${q}”**. Click **Open**, or type a number to choose:`, list);
  }

  /* ---------- main entry ---------- */
  function handle(input, state, entries) {
    const raw = String(input || '').trim();
    if (!raw) return null;
    const norm = normalize(raw);
    const bare = norm.replace(/[.!]+$/, '');
    state = state || {};
    const pending = state.pending;

    // 1. yes / no to a pending "should I open X?"
    if (pending && pending.type === 'open') {
      if (YES.test(bare)) return { text: `Opening **${pending.name}** in a new tab…`, open: [pending.url], pending: null };
      if (NO.test(bare)) return { text: 'Okay, I won’t open it. Anything else?', pending: null };
    }

    // 2. choosing from the last list by number
    if (state.lastList && state.lastList.length && NUMPICK.test(raw)) {
      const nums = (bare.match(/\d+/g) || []).map(Number);
      if (nums.some(n => n < 1 || n > state.lastList.length)) return { text: `Please choose a number between 1 and ${state.lastList.length}.` };
      const urls = [...new Set(nums.map(n => state.lastList[n - 1]))].slice(0, 10);
      return { text: `Opening ${urls.map(u => '**' + nameOf(entries, u) + '**').join(', ')} in a new tab…`, open: urls, pending: null };
    }

    // 3. help
    if (/^\/?(help|commands)$/.test(bare) || /\bwhat can you do\b|\bhow (do|to) (i )?use (you|this)\b/.test(norm)) return { text: HELP, pending: null };

    // 4. count
    if (/^\/count\b/.test(raw) || (/\b(how many|count|total|number of|no of)\b/.test(norm) && /\b(urls?|links?|sites?|websites?|entries|curl|domains?|available)\b/.test(norm))) {
      const cats = matchCategories(norm, true);
      if (cats.length) {
        const n = new Set(entries.filter(e => cats.some(c => inCat(e, c))).map(e => e.url)).size;
        return { text: `There ${n === 1 ? 'is' : 'are'} **${n}** ${cats.map(c => c.label.toLowerCase()).join(' / ')} URL${n === 1 ? '' : 's'} in curl.txt (out of ${entries.length} total).`, pending: null, chips: [{ label: 'List them', send: `list ${cats[0].key} urls` }] };
      }
      const by = CATS.map(c => [c.label, entries.filter(e => inCat(e, c)).length]).filter(x => x[1]).sort((a, b) => b[1] - a[1]).slice(0, 6);
      return { text: `curl.txt contains **${entries.length}** URL${entries.length === 1 ? '' : 's'}.` + (by.length ? `\n\nLargest categories: ${by.map(x => `${x[0]} (${x[1]})`).join(', ')}.` : ''), pending: null, chips: [{ label: 'List all URLs', send: 'list all urls' }, { label: 'Show categories', send: 'show categories' }] };
    }

    // 5. categories overview
    if (/\bcategor(y|ies)\b/.test(norm) || /\bwhat (kind|type)s? of (sites?|urls?|links?|websites?)\b/.test(norm)) {
      const rows = CATS.map(c => ({ c, n: entries.filter(e => inCat(e, c)).length })).filter(r => r.n);
      if (!rows.length) return { text: 'I couldn’t group any of the URLs in curl.txt into categories yet. Try **list all URLs**.', pending: null };
      return { text: 'Here’s what curl.txt covers:\n\n' + rows.map(r => `- **${r.c.label}**: ${r.n}`).join('\n') + '\n\nPick one, or just tell me what you want to do.', pending: null, chips: rows.slice(0, 8).map(r => ({ label: r.c.label, send: `list ${r.c.key} urls` })) };
    }

    // 6. filters: starts with / ends with / contains
    const urlWord = /\b(urls?|links?|sites?|websites?|domains?)\b/.test(norm);
    if (urlWord) {
      let m, es, label;
      if ((m = norm.match(/\b(?:start(?:s|ing)?|begin(?:s|ning)?) with ([a-z0-9.\-]+)/))) {
        es = entries.filter(e => e.host.startsWith(m[1]) || e.name.toLowerCase().startsWith(m[1])); label = `starting with “${m[1]}”`;
      } else if ((m = norm.match(/\b(?:end(?:s|ing)?(?: with)?|extension|tld) (\.?[a-z0-9.\-]+)/))) {
        const suf = m[1].startsWith('.') ? m[1] : '.' + m[1];
        es = entries.filter(e => e.host.endsWith(suf)); label = `ending with “${suf}”`;
      } else if ((m = norm.match(/\b(?:contain(?:s|ing)?|includ(?:e|es|ing)|having|has|matching|with) ([a-z0-9.\-]+)/)) && !STOP.has(m[1])) {
        es = entries.filter(e => e.host.includes(m[1]) || e.nameKey.includes(m[1].replace(/[^a-z0-9]/g, ''))); label = `containing “${m[1]}”`;
      }
      if (es) {
        if (!es.length) return { text: `No URLs ${label} were found in curl.txt.`, pending: null };
        return listResp(`**${plural(es.length, 'URL')}** ${label}. Click **Open**, or type a number to choose:`, es);
      }
    }

    // 7. list all / first N
    const listVerb = /^\/list\b/.test(raw) || (/\b(list|show|display|give|view|see|print|get)\b/.test(norm) && /\b(all|every|available|urls?|links?|sites?|websites?|domains?|entries)\b/.test(norm)) || /^(all )?(urls?|links?|sites?|websites?)$/.test(bare);
    const tokens = norm.split(' ').filter(t => t && !STOP.has(t) && !/^\d+$/.test(t));
    if (listVerb && tokens.length === 0) {
      if (!entries.length) return { text: 'curl.txt has no URLs yet. Add lines like `curl "https://example.com"` to the file, or import one in Settings.', pending: null };
      const n = norm.match(/\b(?:first|top)\s+(\d+)/);
      const es = n ? entries.slice(0, Math.max(1, +n[1])) : entries;
      return listResp(n ? `Here are the first **${es.length}** of **${entries.length}** URLs in curl.txt:` : `curl.txt has **${entries.length}** URL${entries.length === 1 ? '' : 's'}:`, es);
    }

    // 8. entity / category lookup
    const openVerb = OPEN_VERB.test(norm), lookup = LOOKUP.test(norm);
    const shortMsg = tokens.length <= 2 && raw.split(/\s+/).length <= 4;
    const wanted = openVerb || lookup || listVerb;
    const q = tokens.join(' ');
    const cats = matchCategories(norm, false);

    if (!tokens.length) {
      if (openVerb) return { text: 'Which site should I open? Give me a name (like **youtube**) or a topic (like **videos**).', pending: null };
      return null;
    }
    const strong = (wanted || shortMsg) ? resolve(tokens, entries, false) : [];
    const strongOk = strong.length && (wanted || strong[0].score >= 70);
    if (strongOk && strong[0].score >= 90) return entityResp(strong, q, lookup, entries);
    if (cats.length) return categoryList(cats, entries);
    if (strongOk) return entityResp(strong, q, lookup, entries);
    if (wanted) {
      const fz = resolve(tokens, entries, true).filter(r => r.fuzzy);
      if (fz.length) return entityResp(fz.slice(0, 1), q, lookup, entries);
      return { text: `I couldn’t find anything matching **“${q}”** in curl.txt, and I only open URLs from that file.`, pending: null, chips: [{ label: 'Show categories', send: 'show categories' }, { label: 'List all URLs', send: 'list all urls' }] };
    }
    return null; // not URL-related, so let the LLM answer
  }

  const api = { parseCurl, handle, CATS, hostHas };
  root.UrlEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
