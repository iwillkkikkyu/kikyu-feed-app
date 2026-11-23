// 트위터 화면에 발바닥 버튼을 단다. 트윗 내용은 읽지 않고 "트윗 주소"만 집어 간다.
// 본문은 피드 저장소의 자동 작업이 주소로 따로 가져온다 (트위터 화면 구조가 바뀌어도 덜 깨지게).
(() => {
  'use strict';
  const MARK = 'data-kikyu-feed';
  const PAW = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor"><ellipse cx="12" cy="15.5" rx="4.6" ry="3.8"/><ellipse cx="5.8" cy="10.2" rx="1.7" ry="2.2"/><ellipse cx="9.8" cy="6.8" rx="1.8" ry="2.4"/><ellipse cx="14.2" cy="6.8" rx="1.8" ry="2.4"/><ellipse cx="18.2" cy="10.2" rx="1.7" ry="2.2"/></svg>';

  // 트윗의 고유 주소 = 작성 시각(time)을 감싼 링크
  function tweetUrl(article) {
    const a = article.querySelector('a[href*="/status/"] time')?.closest('a') || article.querySelector('a[href*="/status/"]');
    const m = a?.getAttribute('href')?.match(/^\/([A-Za-z0-9_]{1,15})\/status\/(\d{1,20})/);
    return m ? `https://x.com/${m[1]}/status/${m[2]}` : null;
  }

  function addButton(article) {
    if (article.hasAttribute(MARK)) return;
    const bar = article.querySelector('[role="group"]');
    if (!bar) return;
    article.setAttribute(MARK, '1');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.title = '끼뀨 피드로 보내기';
    btn.setAttribute('aria-label', '끼뀨 피드로 보내기');
    btn.innerHTML = PAW; // 고정된 우리 아이콘만 — 트윗 내용은 절대 innerHTML 로 넣지 않는다
    Object.assign(btn.style, { background: 'none', border: '0', cursor: 'pointer', color: 'rgb(113,118,123)', padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center' });
    btn.addEventListener('mouseenter', () => { btn.style.color = '#7f77dd'; btn.style.background = 'rgba(127,119,221,0.12)'; });
    btn.addEventListener('mouseleave', () => { btn.style.color = 'rgb(113,118,123)'; btn.style.background = 'none'; });
    btn.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      const url = tweetUrl(article);
      if (url) openDialog(url); else alert('이 트윗 주소를 못 찾았어.');
    });
    bar.appendChild(btn);
  }

  // 메모 창 — 확장 자기 페이지(memo.html)를 iframe 으로 띄운다.
  // 예전엔 트위터 화면 안(shadow DOM)에 그렸더니, 트위터가 "글자 칸이 아니네" 하고 ? 같은 키를
  // 단축키로 가로챘다(11/23 끼뀨: "물음표는 안 써져"). iframe 안에서 친 키는 트위터 문서로 안 넘어간다.
  function openDialog(url) {
    document.getElementById('kikyu-feed-dialog')?.remove();
    const frame = document.createElement('iframe');
    frame.id = 'kikyu-feed-dialog';
    frame.src = chrome.runtime.getURL('memo.html') + '?url=' + encodeURIComponent(url);
    Object.assign(frame.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', border: '0', zIndex: '2147483647', background: 'transparent' });
    frame.setAttribute('allowtransparency', 'true');
    document.body.appendChild(frame);
    frame.focus();
  }
  // memo.html 이 "닫아 줘" 하면 치운다 — 우리 확장 페이지에서 온 말만 듣는다
  window.addEventListener('message', (e) => {
    if (e.origin === new URL(chrome.runtime.getURL('')).origin && e.data?.kikyuFeed === 'close') {
      document.getElementById('kikyu-feed-dialog')?.remove();
    }
  });

  // ═══ 북마크 페이지: "북마크 전부 피드로" — 쭉 내려가며 주소를 모아 파일 하나로 보낸다
  // 트위터 목록은 화면 밖으로 나간 트윗을 지워 버리므로, 내려가는 동안 계속 주워 담는다.
  let bulk = null;
  function bulkPanel() {
    if (bulk) return bulk;
    const host = document.createElement('div');
    const root = host.attachShadow({ mode: 'closed' });
    root.innerHTML = `<style>
      .p{position:fixed;right:20px;bottom:20px;z-index:2147483646;background:#1f1e1c;color:#faf9f5;border-radius:16px;padding:12px 14px;font-family:"Pretendard Variable",-apple-system,"Malgun Gothic",sans-serif;font-size:14px;display:flex;flex-direction:column;gap:8px;max-width:260px;box-shadow:0 6px 24px rgba(0,0,0,.25)}
      button{font:inherit;font-weight:600;border:0;border-radius:99px;padding:8px 14px;cursor:pointer;background:#afa9ec;color:#26215c}
      button.ghost{background:transparent;color:#d3d1c7;border:1px solid #5f5e5a;font-weight:400}
      .s{font-size:12px;color:#d3d1c7;white-space:pre-wrap}</style>
      <div class="p"><button class="go"></button><div class="s"></div><button class="ghost stop" hidden>멈추고 지금까지 보내기</button></div>`;
    document.body.appendChild(host);
    bulk = { host, go: root.querySelector('.go'), stop: root.querySelector('.stop'), status: root.querySelector('.s'), running: false, halt: false };
    bulk.go.textContent = '🐾 북마크 전부 피드로';
    bulk.go.addEventListener('click', runBulk);
    bulk.stop.addEventListener('click', () => { bulk.halt = true; });
    return bulk;
  }

  async function runBulk() {
    const b = bulk;
    if (b.running) return;
    b.running = true; b.halt = false; b.go.disabled = true; b.stop.hidden = false;
    const found = new Map(); // 트윗 번호 → {url, text}
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const collect = () => {
      for (const art of document.querySelectorAll('article[data-testid="tweet"]')) {
        const url = tweetUrl(art);
        const id = url?.match(/status\/(\d+)/)?.[1];
        if (!id || found.has(id)) continue;
        // 화면 글자는 예비용 (원글을 못 가져올 때만 쓰인다)
        found.set(id, { url, text: (art.querySelector('[data-testid="tweetText"]')?.innerText || '').slice(0, 6000) });
      }
    };
    window.scrollTo(0, 0); await sleep(1200);
    let still = 0;
    while (!b.halt && still < 8 && found.size < 5000) {
      const before = found.size;
      collect();
      b.status.textContent = `모으는 중… ${found.size}개\n(창을 그대로 두면 알아서 내려가)`;
      window.scrollBy(0, Math.round(window.innerHeight * 0.85));
      await sleep(1300);
      still = found.size === before ? still + 1 : 0;
    }
    collect();
    if (!found.size) { b.status.textContent = '북마크를 못 찾았어. 북마크 페이지가 맞는지 봐 줘.'; reset(); return; }
    b.status.textContent = `${found.size}개 모았어. 보내는 중…`;
    chrome.runtime.sendMessage({ type: 'sendBatch', items: [...found.values()] }, (res) => {
      if (chrome.runtime.lastError || !res?.ok) b.status.textContent = `못 보냈어: ${res?.error || '이 탭을 새로고침하고 다시 해 줘.'}`;
      else b.status.textContent = `${found.size}개 보냈어! 피드에 다 채워지는 데 몇 분 걸려.`;
      reset();
    });
    function reset() { b.running = false; b.go.disabled = false; b.stop.hidden = true; b.go.textContent = '🐾 다시 하기'; }
  }

  function bookmarksPage() {
    // 북마크 주소가 /i/bookmarks, /i/bookmarks/폴더, /아이디/bookmarks 등으로 갈려서 넓게 잡는다 (11/23 끼뀨 화면에서 안 뜸)
    // 11/23: 트위터가 북마크를 "히스토리" 메뉴로 옮김 → history 도 잡는다
    const on = /bookmark|history/i.test(location.pathname);
    if (on) bulkPanel().host.hidden = false;
    else if (bulk && !bulk.running) bulk.host.hidden = true;
  }

  const scan = () => { document.querySelectorAll(`article[data-testid="tweet"]:not([${MARK}])`).forEach(addButton); bookmarksPage(); };
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  scan();
})();
