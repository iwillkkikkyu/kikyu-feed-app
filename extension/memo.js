// 메모 창 (확장 자기 페이지). 트윗 주소는 ?url= 로 받는다 — 트위터 주소 꼴만 받아들인다.
const $ = (id) => document.getElementById(id);
const url = new URLSearchParams(location.search).get('url') || '';
const okUrl = /^https:\/\/x\.com\/[A-Za-z0-9_]{1,15}\/status\/\d{1,20}$/.test(url);
$('link').textContent = okUrl ? url : '트윗 주소를 못 받았어';
setTimeout(() => $('memo').focus(), 30);

// 닫기 = 바깥(트위터 화면 쪽 content.js)에 알려서 iframe 을 치우게 한다
const close = () => parent.postMessage({ kikyuFeed: 'close' }, '*');
$('cancel').addEventListener('click', close);
$('wrap').addEventListener('click', (e) => { if (e.target.id === 'wrap') close(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') close();
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) $('go').click();
});

$('go').addEventListener('click', () => {
  const msg = $('msg');
  if (!okUrl) { msg.textContent = '트윗 주소가 없어서 못 보내.'; return; }
  const go = $('go');
  go.disabled = true; go.textContent = '보내는 중…'; msg.className = 'msg'; msg.textContent = '';
  chrome.runtime.sendMessage({ type: 'send', payload: { url, memo: $('memo').value.trim(), allow_replies: $('allow').checked } }, (res) => {
    if (chrome.runtime.lastError || !res?.ok) {
      msg.textContent = res?.error || '보내기 실패 — 확장을 새로고침하고 다시 해 줘.';
      go.disabled = false; go.textContent = '다시 보내기';
      return;
    }
    msg.className = 'msg ok'; msg.textContent = '보냈어!';
    setTimeout(close, 700);
  });
});
