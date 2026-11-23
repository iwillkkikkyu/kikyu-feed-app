const $ = (id) => document.getElementById(id);
chrome.storage.local.get(['token', 'repo']).then(({ token = '', repo = '' }) => {
  $('token').value = token;
  if (repo) $('repo').value = repo;
});
$('save').addEventListener('click', async () => {
  const msg = $('msg');
  const token = $('token').value.trim();
  const repo = $('repo').value.trim();
  if (!token) { msg.className = 'err'; msg.textContent = '열쇠를 먼저 붙여 넣어 줘.'; return; }
  if (!/^[\w./-]+\/[\w.-]+$/.test(repo)) { msg.className = 'err'; msg.textContent = '저장소 이름은 "아이디/저장소" 꼴이야.'; return; }
  await chrome.storage.local.set({ token, repo });
  msg.className = ''; msg.textContent = '확인 중…';
  chrome.runtime.sendMessage({ type: 'check' }, (res) => {
    if (res?.ok) { msg.className = 'ok'; msg.textContent = `연결됐어 — ${res.name}`; }
    else { msg.className = 'err'; msg.textContent = res?.error || '확인 실패'; }
  });
});
