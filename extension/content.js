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

  // 메모 창 — 트위터 스타일이 섞이지 않게 그림자 영역(shadow DOM) 안에 그린다
  function openDialog(url) {
    document.getElementById('kikyu-feed-dialog')?.remove();
    const host = document.createElement('div');
    host.id = 'kikyu-feed-dialog';
    const root = host.attachShadow({ mode: 'closed' });
    const dark = matchMedia('(prefers-color-scheme: dark)').matches || getComputedStyle(document.body).backgroundColor.match(/\d+/g)?.slice(0, 3).every((v) => +v < 60);
    const c = dark
      ? { bg: '#2a2927', text: '#f1efe8', sub: '#b4b2a9', line: 'rgba(241,239,232,.22)', btn: '#f1efe8', btnText: '#1f1e1c', err: '#f09595' }
      : { bg: '#ffffff', text: '#1f1e1c', sub: '#5f5e5a', line: 'rgba(31,30,28,.2)', btn: '#1f1e1c', btnText: '#faf9f5', err: '#a32d2d' };
    const style = document.createElement('style');
    style.textContent = `
      .wrap{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;font-family:"Pretendard Variable",-apple-system,"Malgun Gothic",sans-serif}
      .box{width:min(420px,calc(100vw - 32px));background:${c.bg};color:${c.text};border-radius:16px;padding:18px;display:flex;flex-direction:column;gap:12px}
      .head{display:flex;align-items:center;gap:8px;font-weight:600;font-size:16px}.head svg{color:#7f77dd}
      .link{font-size:12px;color:${c.sub};word-break:break-all}
      textarea{width:100%;box-sizing:border-box;min-height:96px;resize:vertical;border:1px solid ${c.line};border-radius:12px;padding:10px 12px;font:inherit;font-size:15px;background:transparent;color:${c.text}}
      textarea:focus{outline:2px solid #7f77dd;border-color:transparent}
      label{display:flex;align-items:center;gap:8px;font-size:13px;color:${c.sub}}
      .row{display:flex;gap:8px;justify-content:flex-end}
      button{font:inherit;font-size:14px;border-radius:99px;padding:8px 16px;cursor:pointer;border:1px solid ${c.line};background:transparent;color:${c.text}}
      button.go{background:${c.btn};color:${c.btnText};border-color:${c.btn};font-weight:600}
      button:disabled{opacity:.5}
      .msg{font-size:13px;color:${c.err};white-space:pre-wrap}.msg.ok{color:#639922}`;
    const wrap = document.createElement('div'); wrap.className = 'wrap';
    const box = document.createElement('div'); box.className = 'box'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', '끼뀨 피드로 보내기');
    const head = document.createElement('div'); head.className = 'head'; head.innerHTML = PAW; head.append('끼뀨 피드로 보내기');
    const link = document.createElement('div'); link.className = 'link'; link.textContent = url;
    const memo = document.createElement('textarea'); memo.placeholder = '왜 저장했어? (안 써도 돼)';
    const lab = document.createElement('label'); const chk = document.createElement('input'); chk.type = 'checkbox'; chk.checked = true; lab.append(chk, '에이전트들이 답 달아도 돼');
    const msg = document.createElement('div'); msg.className = 'msg';
    const row = document.createElement('div'); row.className = 'row';
    const cancel = document.createElement('button'); cancel.textContent = '닫기';
    const go = document.createElement('button'); go.className = 'go'; go.textContent = '보내기';
    row.append(cancel, go);
    box.append(head, link, memo, lab, msg, row); wrap.append(box); root.append(style, wrap);
    document.body.appendChild(host);
    setTimeout(() => memo.focus(), 30);

    const close = () => host.remove();
    cancel.addEventListener('click', close);
    wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
    // 트위터 단축키(j·k·l 등)가 메모 칸 입력을 가로채지 않게 막는다
    box.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') close(); if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) go.click(); });
    go.addEventListener('click', () => {
      go.disabled = true; go.textContent = '보내는 중…'; msg.textContent = ''; msg.className = 'msg';
      chrome.runtime.sendMessage({ type: 'send', payload: { url, memo: memo.value.trim(), allow_replies: chk.checked } }, (res) => {
        if (chrome.runtime.lastError || !res?.ok) {
          msg.textContent = res?.error || '확장이 새로 깔렸으면 이 탭을 새로고침해 줘.';
          go.disabled = false; go.textContent = '다시 보내기';
          return;
        }
        msg.className = 'msg ok'; msg.textContent = '보냈어!';
        setTimeout(close, 700);
      });
    });
  }

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
    const on = /bookmark/i.test(location.pathname);
    if (on) bulkPanel().host.hidden = false;
    else if (bulk && !bulk.running) bulk.host.hidden = true;
  }

  const scan = () => { document.querySelectorAll(`article[data-testid="tweet"]:not([${MARK}])`).forEach(addButton); bookmarksPage(); };
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  scan();
})();
