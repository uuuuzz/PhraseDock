'use strict';
const editor = document.getElementById('editor');
const metrics = document.getElementById('metrics');
function update() { metrics.textContent = `${editor.value.length} 个字符 · 光标 ${editor.selectionStart}`; }
editor.addEventListener('input', update);
editor.addEventListener('click', update);
editor.addEventListener('keyup', update);
document.getElementById('reset').addEventListener('click', () => {
  editor.value = '前面的文字。后面的文字。';
  editor.focus(); editor.setSelectionRange(6, 6); update();
});
