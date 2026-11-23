// 끼뀨 피드 — 보내기 · 피드 · 설정
// ⚠️ 보안 규칙: 화면에 넣는 글(트윗 본문·작성자·메모·답글·공유로 들어온 값)은 전부 textContent 로만 넣는다.
//    innerHTML 을 쓰면 트윗 한 줄로 이 페이지에 저장된 열쇠가 샐 수 있다.
(() => {
  'use strict';

  const DEFAULT_REPO = 'iwillkkikkyu/kikyu-feed';
  const API = 'https://api.github.com';
  const $view = document.getElementById('view');

  // ── 저장소(브라우저) — 사생활 창 등에서 막힐 수 있어 전부 감싼다
  const store = {
    get(k, d = '') { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
  };
  const cfg = () => ({ token: store.get('kf.token').trim(), repo: store.get('kf.repo', DEFAULT_REPO).trim() || DEFAULT_REPO });

  // ── 작은 DOM 도우미 (글자는 항상 textContent)
  function el(tag, props = {}, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : String(v));
    }
    for (const c of kids.flat()) if (c != null && c !== false) n.append(c instanceof Node ? c : document.createTextNode(String(c)));
    return n;
  }
  const safeHttp = (u) => (typeof u === 'string' && /^https:\/\//i.test(u)) ? u : null;
  const safeImg = (u) => (typeof u === 'string' && /^https:\/\/pbs\.twimg\.com\//.test(u)) ? u : null;

  // ── 사람마다 동그라미 색
  const PEOPLE = {
    '끼뀨': ['#eeedfe', '#3c3489'], '클로': ['#e1f5ee', '#085041'], '혜윰': ['#faeeda', '#633806'],
    '도란': ['#e6f1fb', '#0c447c'], '뇨끼': ['#fbeaf0', '#72243e'], '루미': ['#faece7', '#712b13'],
    '무하': ['#eaf3de', '#27500a'], '에단': ['#f1efe8', '#444441'], '징검': ['#e1f5ee', '#04342c'],
  };
  function avatar(name, small) {
    const [bg, fg] = PEOPLE[name] || ['#f1efe8', '#444441'];
    return el('div', { class: 'av' + (small ? ' small' : ''), style: `background:${bg};color:${fg}`, 'aria-hidden': 'true', text: (name || '?').slice(0, 1) });
  }

  // ── 시각 표시
  function when(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const now = new Date();
    const hm = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
    const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((day(now) - day(d)) / 86400000);
    if (diff === 0) return `오늘 ${hm}`;
    if (diff === 1) return `어제 ${hm}`;
    if (d.getFullYear() === now.getFullYear()) return `${d.getMonth() + 1}월 ${d.getDate()}일`;
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
  }

  // ── 깃허브 통신. 오류는 끼뀨가 알아들을 말로 바꾼다
  class GhError extends Error {}
  async function gh(path, opts = {}) {
    const { token, repo } = cfg();
    if (!token) throw new GhError('열쇠가 아직 없어. 오른쪽 위 설정에서 넣어 줘.');
    let r;
    try {
      r = await fetch(`${API}/repos/${repo}${path}`, {
        ...opts, cache: 'no-store',
        headers: { Authorization: `Bearer ${token}`, Accept: opts.raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(opts.body ? { 'Content-Type': 'application/json' } : {}) },
      });
    } catch {
      throw new GhError('인터넷 연결이 안 돼. 잠깐 뒤에 다시 해 줘.');
    }
    if (r.status === 401) throw new GhError('열쇠가 안 맞거나 기한이 지났어. 설정에서 새 열쇠를 넣어 줘.');
    if (r.status === 403) throw new GhError('열쇠에 이 저장소 쓰기 권한이 없어. 열쇠 만들 때 Contents 를 "Read and write" 로 했는지 봐 줘.');
    if (r.status === 404) { const e = new GhError('저장소나 파일을 못 찾았어. 저장소 이름이나 열쇠 범위를 봐 줘.'); e.notFound = true; throw e; }
    if (r.status === 409) { const e = new GhError('다른 기록과 순간 겹쳤어. 잠깐 뒤에 다시 해 줘.'); e.busy = true; throw e; }
    if (!r.ok) throw new GhError(`깃허브가 거절했어 (${r.status}). 잠깐 뒤에 다시 해 줘.`);
    return opts.raw ? r.text() : r.json();
  }
  // 한글이 깨지지 않게 UTF-8 로 바꿔서 base64
  function b64(s) {
    const bytes = new TextEncoder().encode(s);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function unb64(s) {
    const bin = atob(String(s).replace(/\s/g, ''));
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  }
  const stamp = () => new Date().toISOString().replace(/[-:.]/g, '');
  const rand = () => Math.random().toString(36).slice(2, 8);
  // 기기는 언제나 "새 파일"만 만든다. 합치는 건 저장소의 자동 작업이 한다.
  // 파일이 달라도 같은 순간에 두 기록이 들어오면 깃허브가 하나를 409 로 튕긴다(2026-11-23 실측) → 잠깐 쉬고 다시
  async function putNew(dir, obj, message) {
    const name = `${stamp()}-${rand()}.json`;
    const body = JSON.stringify({ message, content: b64(JSON.stringify(obj, null, 2)) });
    for (let i = 0; ; i++) {
      try {
        await gh(`/contents/${dir}/${name}`, { method: 'PUT', body });
        return name;
      } catch (e) {
        if (!e.busy || i >= 5) throw e;
        await new Promise((r) => setTimeout(r, 600 + Math.random() * 900 * (i + 1)));
      }
    }
  }

  // ── 공유로 들어온 값 읽기
  const TWEET_RE = /https?:\/\/(?:[a-z0-9-]+\.)*(?:x|twitter|fxtwitter|vxtwitter|fixupx)\.com\/(?:i\/web|[A-Za-z0-9_]{1,15})\/status(?:es)?\/\d{1,20}[^\s]*/i;
  const ANY_URL_RE = /https?:\/\/[^\s<>"']+/i;
  function sharedParams() {
    const q = new URLSearchParams(location.search);
    const v = { title: q.get('title') || '', text: q.get('text') || '', url: q.get('url') || '' };
    const any = v.title || v.text || v.url;
    return { ...v, any, send: any || q.has('send') };
  }
  function findLink(v) {
    const joined = [v.url, v.text, v.title].join(' ');
    return (joined.match(TWEET_RE) || joined.match(ANY_URL_RE) || [''])[0];
  }

  // ── 상단 막대
  const $title = document.getElementById('title');
  const $back = document.getElementById('back');
  const $search = document.getElementById('search-btn');
  const $refresh = document.getElementById('refresh-btn');
  const $settings = document.getElementById('settings-btn');
  function chrome(title, { back = false, feedTools = false } = {}) {
    $title.textContent = title;
    $back.hidden = !back;
    $search.hidden = $refresh.hidden = !feedTools;
    $settings.hidden = !feedTools;
  }
  $back.addEventListener('click', () => go('feed'));
  $settings.addEventListener('click', () => go('settings'));

  function go(view) {
    const base = location.pathname;
    history.replaceState(null, '', view === 'feed' ? base : `${base}?${view}`);
    route();
  }

  // ═════════ 보내기 화면
  function renderSend(shared) {
    chrome('피드에 보내기', { back: true });
    const link = findLink(shared);
    const memo = el('textarea', { id: 'memo', placeholder: '왜 저장했어?', 'aria-label': '메모' });
    const allow = el('input', { type: 'checkbox', checked: true });
    const err = el('div', { class: 'err', hidden: true });
    const manual = el('input', { type: 'text', placeholder: 'https://x.com/…/status/…', 'aria-label': '링크' });
    const sendBtn = el('button', { class: 'btn primary block', text: '보내기' });

    const linkBox = link
      ? el('div', { class: 'linkbox' }, link, el('div', { class: 'hint', text: '본문은 보내고 나면 자동으로 채워져' }))
      : el('div', {}, el('span', { class: 'label', text: '링크' }), manual);

    sendBtn.addEventListener('click', async () => {
      err.hidden = true;
      const url = link || manual.value.trim();
      if (!ANY_URL_RE.test(url)) { err.textContent = '링크가 없어. 트윗 주소를 넣어 줘.'; err.hidden = false; manual.focus(); return; }
      sendBtn.disabled = true; sendBtn.textContent = '보내는 중…';
      try {
        await putNew('inbox/posts', {
          url, text: shared.text.slice(0, 2000), title: shared.title.slice(0, 500),
          memo: memo.value.trim(), from: /Android|iPhone|Mobile/i.test(navigator.userAgent) ? 'phone' : 'pc',
          allow_replies: allow.checked, sent_at: new Date().toISOString(),
        }, '보내기');
        renderDone();
      } catch (e) {
        err.textContent = e.message; err.hidden = false;
        sendBtn.disabled = false; sendBtn.textContent = '다시 보내기';
      }
    });

    // 공유로 무엇이 들어왔는지 그대로 보여 주는 진단 줄 (폰마다 링크가 다른 칸으로 올 수 있어서)
    const diag = el('details', { class: 'diag' }, el('summary', { text: '받은 값 보기' }),
      el('pre', { text: `title: ${shared.title}\ntext: ${shared.text}\nurl: ${shared.url}` }));

    $view.replaceChildren(el('div', { class: 'pane' },
      linkBox,
      el('div', {}, el('label', { class: 'label', for: 'memo', text: '왜 저장했어?' }), memo),
      el('label', { class: 'check' }, allow, '에이전트들이 답 달아도 돼'),
      err, sendBtn,
      el('div', { class: 'hint', style: 'text-align:center', text: '메모 없이 보내도 돼' }),
      shared.any ? diag : null,
    ));
    setTimeout(() => memo.focus(), 50);
  }

  function renderDone() {
    chrome('보냈어', { back: true });
    $view.replaceChildren(el('div', { class: 'done' },
      el('span', { class: 'paw' }, document.querySelector('.top .paw svg').cloneNode(true)),
      el('h2', { text: '피드에 넣었어' }),
      el('p', { class: 'hint', text: '본문은 1분쯤 뒤에 채워져' }),
      el('div', { style: 'display:flex;gap:8px;justify-content:center;margin-top:16px' },
        el('button', { class: 'btn primary', text: '피드 보기', onclick: () => go('feed') })),
    ));
  }

  // ═════════ 피드 화면
  const state = { filter: 'all', q: '', searching: false, data: null, pending: [], pendingReplies: [], openReply: null };

  async function loadFeed() {
    const [feedTxt, posts, replies] = await Promise.all([
      gh('/contents/feed.json', { raw: true }).catch((e) => { if (e.notFound) return '{"items":[]}'; throw e; }),
      gh('/contents/inbox/posts').catch(() => []),
      gh('/contents/inbox/replies').catch(() => []),
    ]);
    let data;
    try { data = JSON.parse(feedTxt); } catch { data = { items: [] }; }
    if (!Array.isArray(data.items)) data.items = [];
    // 아직 안 채워진 것(액션 대기)도 보여 준다 — 너무 많으면 앞 10개만
    const readFile = async (f) => { try { const j = await gh(`/contents/${f.path}`); return JSON.parse(unb64(j.content)); } catch { return null; } };
    const pick = (arr) => (Array.isArray(arr) ? arr : []).filter((f) => f.name.endsWith('.json')).slice(0, 10);
    const pend = (await Promise.all(pick(posts).map(readFile))).filter(Boolean);
    const pendR = (await Promise.all(pick(replies).map(readFile))).filter(Boolean);
    state.data = data; state.pending = pend; state.pendingReplies = pendR;
  }

  function matches(it) {
    if (state.filter === 'replied' && !(it.replies || []).some((r) => r.author !== '끼뀨')) return false;
    if (state.filter.startsWith('#') && !(it.tags || []).includes(state.filter.slice(1))) return false;
    if (state.q) {
      const hay = [it.memo, it.tweet?.text, it.tweet?.author_name, it.tweet?.author_handle, ...(it.tags || []), ...(it.replies || []).map((r) => r.text)].join(' ').toLowerCase();
      if (!hay.includes(state.q.toLowerCase())) return false;
    }
    return true;
  }

  function tweetBlock(it) {
    const t = it.tweet || {};
    const href = safeHttp(it.url);
    if (t.status === 'ok') {
      const photos = (t.photos || []).map((p) => safeImg(p.url)).filter(Boolean).slice(0, 4);
      return el('a', { class: 'tweet', href, target: '_blank', rel: 'noopener noreferrer' },
        el('div', { class: 'tweet-head' },
          safeImg(t.avatar) ? el('img', { src: safeImg(t.avatar), alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }) : null,
          el('b', { text: t.author_name || t.author_handle || '알 수 없음' }),
          t.author_handle ? el('span', { text: `@${t.author_handle}` }) : null,
          t.created_at ? el('span', { text: `· ${when(t.created_at)}` }) : null),
        t.text ? el('p', { class: 'tweet-text clamp', text: t.text }) : null,
        photos.length ? el('div', { class: `photos n${photos.length}` }, photos.map((u) => el('img', { src: u, alt: '트윗 사진', loading: 'lazy', referrerpolicy: 'no-referrer' }))) : null,
        t.quoted?.text ? el('div', { class: 'quoted', text: `${t.quoted.author_handle ? '@' + t.quoted.author_handle + ' ' : ''}${t.quoted.text}` }) : null,
      );
    }
    const msg = { pending: '본문 채우는 중…', missing: '원글이 지워졌거나 잠긴 계정이야', link: '트윗이 아닌 링크야', error: '본문을 못 가져왔어' }[t.status] || '본문 채우는 중…';
    return el('a', { class: 'tweet', href, target: '_blank', rel: 'noopener noreferrer' },
      el('div', { class: 'tweet-head' }, el('span', { text: href || '(링크 없음)' })),
      el('div', { class: 'notice', text: msg }));
  }

  function replyBox(it) {
    const ta = el('textarea', { rows: 1, placeholder: '답글 달기', 'aria-label': '답글' });
    const btn = el('button', { class: 'btn small primary', text: '달기' });
    const err = el('div', { class: 'err', hidden: true });
    ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'; err.hidden = true; });
    btn.addEventListener('click', async () => {
      const text = ta.value.trim();
      if (!text) { err.textContent = '내용을 먼저 써 줘.'; err.hidden = false; ta.focus(); return; }
      btn.disabled = true;
      try {
        const r = { item: it.id, author: '끼뀨', text, sent_at: new Date().toISOString() };
        await putNew('inbox/replies', r, '답글');
        state.pendingReplies.push(r);
        renderFeedList();
        pollSoon();
      } catch (e) { err.textContent = e.message; err.hidden = false; btn.disabled = false; }
    });
    return el('div', {}, el('div', { class: 'reply-box' }, avatar('끼뀨', true), ta, btn), err);
  }

  function card(it, { pending = false } = {}) {
    const replies = [...(it.replies || []).map((r) => ({ ...r })), ...state.pendingReplies.filter((r) => r.item === it.id).map((r) => ({ ...r, at: r.sent_at, pending: true }))];
    const from = it.from === 'pc' ? 'PC에서' : it.from === 'agent' ? '에이전트가' : '폰에서';
    return el('article', { class: 'card' },
      avatar('끼뀨'),
      el('div', { class: 'body' },
        el('div', { class: 'meta' }, el('b', { text: '끼뀨' }), ` · ${when(it.sent_at)} · ${from}`,
          it.allow_replies === false ? el('span', { class: 'badge', text: '· 혼자 보기' }) : null),
        it.memo ? el('p', { class: 'memo', text: it.memo }) : el('p', { class: 'memo empty', text: '메모 없음' }),
        tweetBlock(it),
        (it.tags || []).length ? el('div', { class: 'tags' }, it.tags.map((t) => el('span', { class: 'tag', text: `#${t}` }))) : null,
        el('div', { class: 'thread' },
          replies.map((r) => el('div', { class: 'reply' + (r.pending ? ' pending' : '') }, avatar(r.author, true),
            el('div', {}, el('div', { class: 'meta' }, el('b', { text: r.author }), ` · ${r.pending ? '보내는 중' : when(r.at)}`),
              el('div', { class: 'txt', text: r.text })))),
          pending ? el('div', { class: 'hint', style: 'padding-top:6px', text: '채워지면 답글 달 수 있어' }) : replyBox(it)),
      ),
    );
  }

  function renderFeedList() {
    const list = document.getElementById('list');
    if (!list || !state.data) return;
    const items = state.data.items.filter(matches);
    const pend = state.filter === 'all' && !state.q
      ? state.pending.map((p, i) => ({ id: `pending-${i}`, url: p.url || '', memo: p.memo || '', from: p.from, sent_at: p.sent_at, allow_replies: p.allow_replies, tweet: { status: 'pending' }, replies: [], tags: [] }))
      : [];
    const all = [...pend.map((p) => card(p, { pending: true })), ...items.map((it) => card(it))];
    if (!all.length) {
      list.replaceChildren(state.data.items.length
        ? el('div', { class: 'empty-state' }, el('h2', { text: '맞는 게 없어' }), el('p', { text: '다른 필터를 골라 봐' }))
        : el('div', { class: 'empty-state' }, el('h2', { text: '첫 트윗을 보내 봐' }), el('p', { text: '트위터에서 공유하기를 누르고 끼뀨 피드를 고르면 여기 쌓여' })));
    } else list.replaceChildren(...all);
  }

  function renderFilters() {
    const box = document.getElementById('filters');
    if (!box || !state.data) return;
    const tags = [...new Set(state.data.items.flatMap((i) => i.tags || []))].slice(0, 20);
    const replied = state.data.items.filter((i) => (i.replies || []).some((r) => r.author !== '끼뀨')).length;
    const chip = (key, label) => el('button', { class: 'chip' + (state.filter === key ? ' on' : ''), text: label, onclick: () => { state.filter = key; renderFilters(); renderFeedList(); } });
    box.replaceChildren(chip('all', '전체'), chip('replied', `답 달림 ${replied}`), ...tags.map((t) => chip('#' + t, '#' + t)));
  }

  let pollTimer = null;
  function pollSoon() {
    clearTimeout(pollTimer);
    let n = 0;
    const tick = async () => {
      n += 1;
      try { await loadFeed(); renderFilters(); renderFeedList(); } catch { /* 다음 회차에 */ }
      if ((state.pending.length || state.pendingReplies.length) && n < 12) pollTimer = setTimeout(tick, 10000);
    };
    pollTimer = setTimeout(tick, 8000);
  }

  async function renderFeed() {
    chrome('끼뀨 피드', { feedTools: true });
    const search = el('div', { class: 'searchbar', hidden: !state.searching },
      el('input', { type: 'text', class: 'field', placeholder: '메모·본문·답글에서 찾기', value: state.q, 'aria-label': '찾기',
        oninput: (e) => { state.q = e.target.value; renderFeedList(); } }));
    $view.replaceChildren(search, el('div', { class: 'filters', id: 'filters' }), el('div', { id: 'list' }, el('div', { class: 'loading', text: '불러오는 중…' })));
    $search.onclick = () => { state.searching = !state.searching; search.hidden = !state.searching; if (state.searching) search.querySelector('input').focus(); else { state.q = ''; renderFeedList(); } };
    $refresh.onclick = refresh;
    await refresh();
  }

  async function refresh() {
    $refresh.classList.add('spin');
    try {
      await loadFeed();
      renderFilters(); renderFeedList();
      if (state.pending.length || state.pendingReplies.length) pollSoon();
    } catch (e) {
      const list = document.getElementById('list');
      if (list) list.replaceChildren(el('div', { class: 'pane' }, el('div', { class: 'err', text: e.message }),
        el('button', { class: 'btn', text: '설정 열기', onclick: () => go('settings') })));
    } finally { $refresh.classList.remove('spin'); }
  }

  // ═════════ 설정 화면
  function renderSettings() {
    chrome('설정', { back: !!cfg().token });
    const { token, repo } = cfg();
    const tokIn = el('input', { type: 'password', id: 'tok', placeholder: 'github_pat_…', value: token, autocomplete: 'off', spellcheck: 'false' });
    const repoIn = el('input', { type: 'text', id: 'repo', value: repo, spellcheck: 'false' });
    const msg = el('div', { hidden: true });
    const save = el('button', { class: 'btn primary block', text: '저장하고 연결 확인' });
    save.addEventListener('click', async () => {
      msg.hidden = true;
      const t = tokIn.value.trim();
      if (!t) { msg.className = 'err'; msg.textContent = '열쇠를 먼저 붙여 넣어 줘.'; msg.hidden = false; return; }
      if (!/^[\w./-]+\/[\w.-]+$/.test(repoIn.value.trim())) { msg.className = 'err'; msg.textContent = '저장소 이름은 "아이디/저장소" 꼴이야.'; msg.hidden = false; return; }
      if (!store.set('kf.token', t) || !store.set('kf.repo', repoIn.value.trim())) { msg.className = 'err'; msg.textContent = '이 브라우저가 저장을 막고 있어 (사생활 창이면 일반 창으로 열어 줘).'; msg.hidden = false; return; }
      save.disabled = true; save.textContent = '확인 중…';
      try {
        const info = await gh('');
        if (!info.permissions?.push) throw new GhError('읽기는 되는데 쓰기 권한이 없어. 열쇠의 Contents 를 "Read and write" 로 바꿔 줘.');
        msg.className = 'okmsg'; msg.textContent = `연결됐어 — ${info.full_name}`; msg.hidden = false;
        setTimeout(() => (sharedParams().send ? route() : go('feed')), 700);
      } catch (e) { msg.className = 'err'; msg.textContent = e.message; msg.hidden = false; }
      finally { save.disabled = false; save.textContent = '저장하고 연결 확인'; }
    });

    $view.replaceChildren(el('div', { class: 'pane' },
      el('div', {}, el('label', { class: 'label', for: 'tok', text: '열쇠 (이 저장소에만 쓰는 토큰)' }), tokIn,
        el('div', { class: 'hint', style: 'margin-top:6px', text: '이 기기에만 저장돼. 다른 데로 안 보내.' })),
      el('div', {}, el('label', { class: 'label', for: 'repo', text: '피드 저장소' }), repoIn),
      msg, save,
      el('details', { open: !token },
        el('summary', { class: 'label', text: '열쇠 만드는 법' }),
        el('ol', { class: 'steps' },
          el('li', {}, el('a', { href: 'https://github.com/settings/personal-access-tokens/new', target: '_blank', rel: 'noopener noreferrer', text: '깃허브 새 열쇠 만들기' }), ' 를 연다'),
          el('li', { text: '이름: 끼뀨 피드 (폰 / PC 따로 하나씩 만들면 잃어버렸을 때 하나만 끄면 돼)' }),
          el('li', { text: 'Repository access → Only select repositories → kikyu-feed 하나만' }),
          el('li', { text: 'Permissions → Contents → Read and write (다른 건 건드리지 않기)' }),
          el('li', { text: '만들기 → 나온 열쇠를 복사해서 위 칸에 붙여 넣기' }))),
    ));
  }

  // ═════════ 길 고르기
  function route() {
    const shared = sharedParams();
    const q = new URLSearchParams(location.search);
    if (!cfg().token || q.has('settings')) return renderSettings();
    if (shared.send) return renderSend(shared);
    return renderFeed();
  }

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  route();
})();
