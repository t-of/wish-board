'use strict';

// localStorage はほかのアプリと共有される（同じ t-of.github.io のため）。
// キーは必ず 'wish-board.' で始める。
const STORE = 'wish-board.';

function load(key, fallback) {
  try {
    const v = localStorage.getItem(STORE + key);
    return v == null ? fallback : JSON.parse(v);
  } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(STORE + key, JSON.stringify(value)); } catch { /* 保存できなくても遊べる */ }
}

WebAppKit.init({ title: 'wish-board', text: '付箋をドラッグして置く、ホワイトボード型のタスク整理' });

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}

// 音を使うときは、鳴らす前と音の設定を切り替えたときにこれを呼ぶ（RULES.md §5「音」）。
function setAudioSession(soundOn) {
  try { if (navigator.audioSession) navigator.audioSession.type = soundOn ? 'playback' : 'auto'; } catch { /* 対応していない */ }
}

// ---- ここからアプリ本体 ----
// 付箋: { id, x, y (ボードに対する割合 0〜1), title, due (YYYY-MM-DD か ''), memo, color, done }
const COLORS = ['yellow', 'pink', 'blue', 'green', 'orange'];

let notes = load('notes', []);
let editingId = null; // 編集シートが今どの付箋を開いているか

const board = document.getElementById('board');
const sheet = document.getElementById('noteSheet');
const form = sheet.querySelector('form');
const fTitle = document.getElementById('f-title');
const fDue = document.getElementById('f-due');
const fMemo = document.getElementById('f-memo');
const fDone = document.getElementById('f-done');
const fColors = document.getElementById('f-colors');
const fDelete = document.getElementById('f-delete');

// 色えらびのラジオボタンを一度だけ作る
for (const c of COLORS) {
  const label = document.createElement('label');
  const input = document.createElement('input');
  input.type = 'radio';
  input.name = 'color';
  input.value = c;
  const span = document.createElement('span');
  span.className = `note--${c}`;
  label.append(input, span);
  fColors.append(label);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function formatDue(due) {
  const [, m, d] = due.split('-');
  return `${Number(m)}/${Number(d)}`;
}

function render() {
  board.querySelectorAll('.note').forEach((el) => el.remove());
  for (const note of notes) {
    const el = document.createElement('div');
    el.className = `note note--${note.color}`;
    if (note.done) el.classList.add('done');
    el.style.left = `${note.x * 100}%`;
    el.style.top = `${note.y * 100}%`;
    el.dataset.id = note.id;

    const title = document.createElement('div');
    title.className = 'note__title';
    title.textContent = note.title || '(無題)';
    el.append(title);

    if (note.due) {
      const due = document.createElement('div');
      due.className = 'note__due';
      if (!note.done && note.due < todayStr()) due.classList.add('overdue');
      due.textContent = formatDue(note.due);
      el.append(due);
    }

    attachDrag(el, note);
    board.append(el);
  }
}

function attachDrag(el, note) {
  let startX = 0;
  let startY = 0;
  let moved = false;

  el.addEventListener('pointerdown', (e) => {
    el.setPointerCapture(e.pointerId);
    startX = e.clientX;
    startY = e.clientY;
    moved = false;
    el.classList.add('dragging');
  });

  el.addEventListener('pointermove', (e) => {
    if (!el.hasPointerCapture(e.pointerId)) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
    if (!moved) return;
    const rect = board.getBoundingClientRect();
    const x = clamp01((e.clientX - rect.left) / rect.width);
    const y = clamp01((e.clientY - rect.top) / rect.height);
    note.x = x;
    note.y = y;
    el.style.left = `${x * 100}%`;
    el.style.top = `${y * 100}%`;
  });

  el.addEventListener('pointerup', (e) => {
    el.classList.remove('dragging');
    if (moved) {
      save('notes', notes);
    } else {
      openSheet(note.id);
    }
  });
}

function clamp01(v) {
  return Math.min(1, Math.max(0, v));
}

function openSheet(id) {
  const note = notes.find((n) => n.id === id);
  if (!note) return;
  editingId = id;
  fTitle.value = note.title;
  fDue.value = note.due;
  fMemo.value = note.memo;
  fDone.checked = note.done;
  const radio = fColors.querySelector(`input[value="${note.color}"]`);
  if (radio) radio.checked = true;
  sheet.showModal();
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const note = notes.find((n) => n.id === editingId);
  if (note) {
    note.title = fTitle.value.trim();
    note.due = fDue.value;
    note.memo = fMemo.value.trim();
    note.done = fDone.checked;
    note.color = fColors.querySelector('input:checked')?.value || note.color;
    save('notes', notes);
    render();
  }
  sheet.close();
});

fDelete.addEventListener('click', () => {
  notes = notes.filter((n) => n.id !== editingId);
  save('notes', notes);
  render();
  sheet.close();
});

document.getElementById('addNote').addEventListener('click', () => {
  const note = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    x: 0.5,
    y: 0.5,
    title: '',
    due: '',
    memo: '',
    color: COLORS[notes.length % COLORS.length],
    done: false,
  };
  notes.push(note);
  save('notes', notes);
  render();
  openSheet(note.id);
});

render();
