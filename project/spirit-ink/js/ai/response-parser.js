/**
 * Spirit Ink v4.0 — Response Parser
 * Parses raw AI response strings with a 3-layer fallback strategy.
 * No external dependencies.
 */
;(function () {
  'use strict';

  /**
   * Parse a raw AI response into {content, tokens}.
   *
   * Fallback layers:
   *   1. Strip ```json fences → JSON.parse
   *   2. Extract first {…} via depth counter → JSON.parse
   *   3. Fix trailing commas → JSON.parse
   *   4. Last resort: plain text + ['idle']
   *
   * @param {string} raw - Raw response text from the AI
   * @returns {{content: string, tokens: string[]}}
   */
  function parse(raw) {
    if (!raw) return { content: '', tokens: ['idle'] };

    var parsed;

    // Layer 1 — Strip fenced code blocks
    var cleaned = raw
      .replace(/^```(?:json)?\s*/, '')
      .replace(/\s*```$/, '')
      .trim();

    try {
      parsed = JSON.parse(cleaned);
    } catch (e1) {
      // Layer 2 — Find first { to matching } using depth counter
      try {
        var first = raw.indexOf('{');
        if (first >= 0) {
          var depth = 0, last = -1;
          for (var i = first; i < raw.length; i++) {
            if (raw[i] === '{') depth++;
            if (raw[i] === '}') depth--;
            if (depth === 0) { last = i; break; }
          }
          if (last > 0) {
            parsed = JSON.parse(raw.slice(first, last + 1));
          }
        }
      } catch (e2) {
        // Layer 3 — Fix trailing commas before } and ]
        try {
          var fixed = cleaned
            .replace(/,\s*}/g, '}')
            .replace(/,\s*]/g, ']');
          parsed = JSON.parse(fixed);
        } catch (e3) {
          // Layer 4 — Plain-text fallback
          parsed = {
            content: cleaned.replace(/[{}[\]"]/g, '').trim(),
            tokens: ['idle']
          };
        }
      }
    }

    // Normalise output
    return {
      content: (parsed && parsed.content) || '',
      tokens: Array.isArray(parsed && parsed.tokens) ? parsed.tokens : ['idle']
    };
  }

  window.ResponseParser = { parse: parse };
})();
