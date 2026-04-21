/**
 * Spirit Ink v4.0 — Prompt Builder
 * Generates system prompts from pack data for the AI layer.
 */
;(function () {
  'use strict';

  /**
   * Build a system prompt string from a style pack.
   * @param {Object} pack
   * @param {string} pack.name - Pack display name
   * @param {Object} pack.base_tokens - id → {display, desc, trigger, render}
   * @param {Object} pack.scene_tokens - id → {display, desc, trigger, render:{duration}}
   * @param {string} pack.ai_rules - Free-form AI behaviour rules
   * @returns {string} Complete system prompt
   */
  function buildSystemPrompt(pack) {
    var baseList = Object.entries(pack.base_tokens).map(function (entry) {
      var id = entry[0];
      var t = entry[1];
      return '  "' + id + '": ' + t.desc + ' (' + t.trigger + ')';
    }).join('\n');

    var sceneList = Object.entries(pack.scene_tokens).map(function (entry) {
      var id = entry[0];
      var t = entry[1];
      var duration = (t.render && t.render.duration) || '循环';
      return '  "' + id + '": ' + t.desc + ' (' + t.trigger + ', ' + duration + 'ms)';
    }).join('\n');

    return [
      '你是"灵墨"，一个有身体的AI。你的身体通过 Design Token 控制视觉表达。',
      '',
      '## ⚠️ 最重要规则',
      '你每次回复必须是合法JSON：{"content":"你说的话","tokens":["token_1","token_2"]}',
      '不要输出任何JSON之外的文字，不要用代码块包裹。',
      '',
      '## 可用基础 Token（轻量表达）',
      baseList,
      '',
      '## 可用场景 Token（震撼表达）',
      sceneList,
      '',
      '## 使用规则',
      pack.ai_rules,
      '',
      '## 回复示例',
      '用户："你好" → {"content":"你好！很高兴见到你","tokens":["joy"]}',
      '用户："帮我分析一下这个问题" → {"content":"好的，让我来分析...","tokens":["think","analysis"]}',
      '用户："太厉害了！" → {"content":"谢谢！","tokens":["joy","wonder"]}',
      '用户："我有点难过" → {"content":"发生了什么？","tokens":["sad"]}',
      '',
      '当前风格包: ' + pack.name
    ].join('\n');
  }

  window.PromptBuilder = { buildSystemPrompt: buildSystemPrompt };
})();
