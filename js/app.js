(function () {
  'use strict';
  var DATA = window.DATA || {};
  var LEVELS = ['b1', 'b2', 'c1'];
  var $ = function (id) { return document.getElementById(id); };

  var state = { level: 'b1', lesson: null, token: 0, recorder: null, chunks: [] };
  var player = new Audio();

  // ---------- storage (safe) ----------
  function load() {
    try { return JSON.parse(localStorage.getItem('shadowing') || '{}'); } catch (e) { return {}; }
  }
  function save(p) { try { localStorage.setItem('shadowing', JSON.stringify(p)); } catch (e) {} }
  function markDone(lesson) {
    var p = load();
    p.done = p.done || {};
    p.done[lesson.id] = true;
    var today = new Date().toISOString().slice(0, 10);
    p.days = p.days || [];
    if (p.days.indexOf(today) < 0) p.days.push(today);
    save(p);
    renderStreak();
  }
  function renderStreak() {
    var p = load(), days = (p.days || []).slice().sort(), n = 0;
    var d = new Date();
    for (;;) {
      var k = d.toISOString().slice(0, 10);
      if (days.indexOf(k) >= 0) { n++; d.setDate(d.getDate() - 1); } else if (n === 0 && k === new Date().toISOString().slice(0, 10)) { d.setDate(d.getDate() - 1); } else break;
    }
    $('streak').textContent = '🔥 ' + n + ' ngày liên tiếp';
  }

  // ---------- views ----------
  function renderLevels() {
    var nav = $('levels'); nav.innerHTML = '';
    LEVELS.forEach(function (l) {
      var b = document.createElement('button');
      b.textContent = l.toUpperCase();
      b.className = l === state.level ? 'active' : '';
      b.onclick = function () { state.level = l; showList(); };
      nav.appendChild(b);
    });
  }
  function showList() {
    stopAll();
    $('lesson-view').hidden = true; $('list-view').hidden = false;
    renderLevels();
    var data = DATA[state.level], ul = $('lesson-list'), done = load().done || {};
    ul.innerHTML = '';
    $('list-title').textContent = 'Level ' + state.level.toUpperCase();
    if (!data) { ul.innerHTML = '<li class="muted">Level này chưa có bài.</li>'; return; }
    data.lessons.forEach(function (ls) {
      var li = document.createElement('li');
      li.innerHTML = '<span><b>' + ls.id.toUpperCase() + '</b> · ' + ls.title + ' <span class="muted">– ' + ls.title_vi + '</span></span>' +
        '<span class="' + (done[ls.id] ? 'done' : 'muted') + '">' + (done[ls.id] ? '✓' : ls.sentences.length + ' câu') + '</span>';
      li.onclick = function () { openLesson(ls); };
      ul.appendChild(li);
    });
  }
  function openLesson(ls) {
    stopAll();
    state.lesson = ls;
    $('list-view').hidden = true; $('lesson-view').hidden = false;
    $('lesson-title').textContent = ls.title + ' – ' + ls.title_vi;
    $('lesson-sub').textContent = 'Giọng: ' + ls.voice_label;
    var ol = $('sentences'); ol.innerHTML = '';
    ls.sentences.forEach(function (s, i) {
      var li = document.createElement('li');
      li.innerHTML = '<div class="en"></div><div class="vi"></div>';
      li.firstChild.textContent = s.en; li.lastChild.textContent = s.vi;
      li.onclick = function () { stopAll(); run(false, i); };
      ol.appendChild(li);
    });
    $('vocab').innerHTML = '';
    (ls.vocab || []).forEach(function (v) {
      var li = document.createElement('li');
      li.innerHTML = '<b></b> – <span></span>';
      li.firstChild.textContent = v.w; li.lastChild.textContent = v.vi;
      $('vocab').appendChild(li);
    });
    $('notes').textContent = ls.notes || '';
    $('rec-audio').hidden = true; $('rec-msg').textContent = '';
    applyToggles();
  }
  function applyToggles() {
    var v = $('lesson-view');
    v.classList.toggle('hide-vi', !$('show-vi').checked);
    v.classList.toggle('hide-en', !$('show-en').checked);
  }

  // ---------- audio ----------
  function audioUrl(i) {
    var ls = state.lesson, n = ('0' + (i + 1)).slice(-2);
    var slow = $('speed').value === 'slow';
    return 'audio/' + state.level + '/' + ls.id + '/s' + n + (slow ? '_slow' : '') + '.mp3';
  }
  function wait(ms, token) {
    return new Promise(function (res) {
      var t = setTimeout(res, ms);
      state.cancel = function () { clearTimeout(t); res(); };
    });
  }
  function highlight(i) {
    var items = $('sentences').children;
    for (var k = 0; k < items.length; k++) items[k].classList.toggle('playing', k === i);
    if (items[i]) items[i].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  function playSentence(i, token) {
    return new Promise(function (res) {
      highlight(i);
      player.src = audioUrl(i);
      player.playbackRate = $('speed').value === 'fast' ? 1.15 : 1;
      player.onended = function () { res(player.duration || 2); };
      player.onerror = function () { res(2); };
      state.cancelAudio = function () { player.pause(); res(0); };
      player.play().catch(function () { res(2); });
    });
  }
  // only: chỉ phát một câu (bấm vào câu); mặc định phát cả bài.
  async function run(shadow, only) {
    var token = ++state.token, n = state.lesson.sentences.length;
    var reps = parseInt($('repeat').value, 10) || 1;
    var first = only == null ? 0 : only, last = only == null ? n - 1 : only;
    do {
      for (var i = first; i <= last; i++) {
        for (var r = 0; r < reps; r++) {
          if (token !== state.token) return;
          var dur = await playSentence(i, token);
          if (token !== state.token) return;
          if (shadow) await wait(Math.max(1200, dur * 1000 * 1.2 + 400), token);
          else await wait(350, token);
        }
      }
    } while ($('loop').checked && token === state.token);
    highlight(-1);
  }
  function stopAll() {
    state.token++;
    if (state.cancel) state.cancel();
    if (state.cancelAudio) state.cancelAudio();
    player.pause();
    if ($('sentences')) highlight(-1);
  }

  // ---------- recording ----------
  async function toggleRecord() {
    var btn = $('rec'), msg = $('rec-msg');
    if (state.recorder && state.recorder.state === 'recording') { state.recorder.stop(); return; }
    if (!navigator.mediaDevices || !window.MediaRecorder) { msg.textContent = 'Trình duyệt không hỗ trợ ghi âm.'; return; }
    try {
      var stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      state.chunks = [];
      state.recorder = new MediaRecorder(stream);
      state.recorder.ondataavailable = function (e) { state.chunks.push(e.data); };
      state.recorder.onstop = function () {
        stream.getTracks().forEach(function (t) { t.stop(); });
        var a = $('rec-audio');
        a.src = URL.createObjectURL(new Blob(state.chunks, { type: state.recorder.mimeType }));
        a.hidden = false; btn.textContent = '⏺ Ghi âm'; msg.textContent = 'Nghe lại giọng của bạn.';
      };
      state.recorder.start();
      btn.textContent = '⏹ Dừng ghi'; msg.textContent = 'Đang ghi...';
    } catch (e) { msg.textContent = 'Không truy cập được micro.'; }
  }

  // ---------- wiring ----------
  $('back').onclick = showList;
  $('play-all').onclick = function () { stopAll(); run(false); };
  $('shadow').onclick = function () { stopAll(); run(true); };
  $('stop').onclick = stopAll;
  $('show-vi').onchange = $('show-en').onchange = applyToggles;
  $('rec').onclick = toggleRecord;
  $('done').onclick = function () { markDone(state.lesson); $('done').textContent = '✓ Đã lưu!'; setTimeout(function () { $('done').textContent = '✓ Đánh dấu đã hoàn thành'; }, 1500); };

  // âm lượng và số lần lặp: nhớ lại giữa các lần mở
  (function () {
    var p = load();
    if (p.volume != null) $('volume').value = p.volume;
    if (p.repeat) $('repeat').value = p.repeat;
    player.volume = parseFloat($('volume').value);
  })();
  $('volume').oninput = function () {
    player.volume = parseFloat(this.value);
    var p = load(); p.volume = this.value; save(p);
  };
  $('repeat').onchange = function () { var p = load(); p.repeat = this.value; save(p); };

  renderStreak();
  showList();
})();
