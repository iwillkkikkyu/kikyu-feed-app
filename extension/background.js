// 깃허브로 보내는 건 여기(확장 뒤편)에서만 한다.
// 트위터 페이지 안에서 직접 보내지 않는 이유: 열쇠가 트위터 페이지 쪽 코드에 닿지 않게 하려고.
const DEFAULT_REPO = 'iwillkkikkyu/kikyu-feed';

function b64(s) {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function gh(path, opts = {}) {
  const { token = '', repo = DEFAULT_REPO } = await chrome.storage.local.get(['token', 'repo']);
  if (!token) throw new Error('열쇠가 없어. 확장 아이콘을 눌러 설정에서 넣어 줘.');
  let r;
  try {
    r = await fetch(`https://api.github.com/repos/${repo || DEFAULT_REPO}${path}`, {
      ...opts,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
    });
  } catch {
    throw new Error('인터넷 연결이 안 돼.');
  }
  if (r.status === 401) throw new Error('열쇠가 안 맞거나 기한이 지났어. 설정에서 새 열쇠를 넣어 줘.');
  if (r.status === 403) throw new Error('열쇠에 쓰기 권한이 없어 (Contents → Read and write).');
  if (r.status === 404) throw new Error('저장소를 못 찾았어. 저장소 이름이나 열쇠 범위를 봐 줘.');
  if (r.status === 409) { const e = new Error('다른 기록과 순간 겹쳤어. 다시 눌러 줘.'); e.busy = true; throw e; }
  if (!r.ok) throw new Error(`깃허브가 거절했어 (${r.status}).`);
  return r.json();
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  (async () => {
    if (msg?.type === 'send') {
      const p = msg.payload || {};
      const url = typeof p.url === 'string' && /^https:\/\/(x|twitter)\.com\//.test(p.url) ? p.url : '';
      if (!url) throw new Error('트윗 주소를 못 찾았어.');
      const body = {
        url, text: '', title: '',
        memo: String(p.memo || '').slice(0, 4000),
        from: 'pc', allow_replies: p.allow_replies !== false, sent_at: new Date().toISOString(),
      };
      const name = `${new Date().toISOString().replace(/[-:.]/g, '')}-${Math.random().toString(36).slice(2, 8)}.json`;
      const put = JSON.stringify({ message: '보내기', content: b64(JSON.stringify(body, null, 2)) });
      // 같은 순간 다른 기록과 겹치면 409 — 잠깐 쉬고 다시 (폰 앱과 같은 규칙)
      for (let i = 0; ; i++) {
        try { await gh(`/contents/inbox/posts/${name}`, { method: 'PUT', body: put }); return { ok: true }; }
        catch (e) { if (!e.busy || i >= 5) throw e; await new Promise((r) => setTimeout(r, 600 + Math.random() * 900 * (i + 1))); }
      }
    }
    if (msg?.type === 'sendBatch') {
      // 옛 북마크 묶음 — 파일 하나로 보낸다 (수백 번 따로 보내면 기록이 수백 줄이 된다)
      const items = (Array.isArray(msg.items) ? msg.items : [])
        .filter((e) => typeof e?.url === 'string' && /^https:\/\/x\.com\/[A-Za-z0-9_]{1,15}\/status\/\d{1,20}$/.test(e.url))
        .slice(0, 5000)
        .map((e) => ({ url: e.url, text: String(e.text || '').slice(0, 6000) }));
      if (!items.length) throw new Error('보낼 북마크가 없어.');
      const body = { batch: items, from: 'bookmark', allow_replies: true, sent_at: new Date().toISOString() };
      const name = `${new Date().toISOString().replace(/[-:.]/g, '')}-bookmarks.json`;
      const put = JSON.stringify({ message: `옛 북마크 ${items.length}개`, content: b64(JSON.stringify(body)) });
      for (let i = 0; ; i++) {
        try { await gh(`/contents/inbox/posts/${name}`, { method: 'PUT', body: put }); return { ok: true, count: items.length }; }
        catch (e) { if (!e.busy || i >= 5) throw e; await new Promise((r) => setTimeout(r, 1000 * (i + 1))); }
      }
    }
    if (msg?.type === 'check') {
      const info = await gh('');
      if (!info.permissions?.push) throw new Error('읽기는 되는데 쓰기 권한이 없어 (Contents → Read and write).');
      return { ok: true, name: info.full_name };
    }
    throw new Error('모르는 요청');
  })().then(reply, (e) => reply({ ok: false, error: e.message }));
  return true; // 답을 나중에 보낸다
});

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
