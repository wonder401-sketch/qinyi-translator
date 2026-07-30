/* 亲情翻译官 · 网页版前端逻辑 v2 */
(function () {
  "use strict";

  var chatEl = document.getElementById("chat");
  var welcomeEl = document.getElementById("welcome");
  var inputEl = document.getElementById("input");
  var sendBtn = document.getElementById("sendBtn");
  var voiceBtn = document.getElementById("voiceBtn");
  var statusEl = document.getElementById("status");
  var modeSwitch = document.getElementById("modeSwitch");
  var addressEl = document.getElementById("address");

  // API 基地址
  var API_BASE = "https://qinyi-tlator-fn-qinyi-tator-svc-ecgmkqnays.cn-hangzhou.fcapp.run";

  var mode = "auto";
  var busy = false;

  // ---- 模式切换 ----
  modeSwitch.addEventListener("click", function (e) {
    var btn = e.target.closest(".mode-btn");
    if (!btn) return;
    mode = btn.dataset.mode;
    Array.prototype.forEach.call(modeSwitch.children, function (b) {
      b.classList.toggle("active", b === btn);
    });
  });

  // ---- 工具 ----
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function scrollBottom() {
    chatEl.scrollTop = chatEl.scrollHeight;
  }

  // 轻量 toast 提示
  function showToast(msg) {
    var existing = document.getElementById("toast");
    if (existing) existing.remove();
    var t = document.createElement("div");
    t.id = "toast";
    t.textContent = msg;
    t.style.cssText =
      "position:fixed;bottom:80px;left:50%;transform:translateX(-50%);" +
      "background:rgba(26,26,46,0.85);color:#fff;padding:8px 20px;border-radius:20px;" +
      "font-size:13px;z-index:999;pointer-events:none;animation:fadeInUp 0.2s ease;" +
      "white-space:nowrap;";
    document.body.appendChild(t);
    setTimeout(function () {
      t.style.opacity = "0";
      t.style.transition = "opacity 0.25s";
      setTimeout(function () { t.remove(); }, 260);
    }, 1400);
  }
  // 注入 toast 动画样式（仅一次）
  var toastStyle = document.createElement("style");
  toastStyle.textContent = "@keyframes fadeInUp{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) none}}";
  document.head.appendChild(toastStyle);

  // ---- 解析 AI 回复，按 【标签】 拆块 ----
  function parseReply(text) {
    var re = /【([^】]+)】([\s\S]*?)(?=【|$)/g;
    var m, blocks = [], last = 0;
    while ((m = re.exec(text)) !== null) {
      blocks.push({ tag: m[1].trim(), content: m[2].trim() });
      last = re.lastIndex;
    }
    if (blocks.length === 0) {
      return [{ tag: "亲情翻译", content: text.trim() }];
    }
    return blocks;
  }

  function tagClass(tag) {
    if (/原文|原话|原语音/.test(tag)) return "tag-original";
    if (/亲情翻译|摘要|转化/.test(tag)) return "tag-summary";
    if (/情绪/.test(tag)) return "tag-emotion";
    if (/潜台词|意图|潜台/.test(tag)) return "tag-intent";
    if (/紧急|告警|预警|警报/.test(tag)) return "tag-alert";
    return "tag-summary";
  }

  // 从回复内容中提取建议的快捷短语（用于生成芯片）
  function extractQuickReplies(text) {
    var replies = [];
    // 匹配「建议：xxx」或「推荐：xxx」或直接引号中的短句
    var suggestRe = /(?:建议|推荐)[：:]\s*([^。\n]{2,16})/g;
    var m;
    while ((m = suggestRe.exec(text)) !== null) {
      replies.push(m[1].trim());
    }
    // 如果没提取到，从内容中找引号短句
    if (replies.length === 0) {
      var quoteRe / [\"""]([^"""]{2,14})["""]/g;
      while ((m = quoteRe.exec(text)) !== null) {
        var q = m[1].trim();
        if (q.length >= 2 && q.length <= 14 && !/^[。！？]/.test(q)) {
          replies.push(q);
        }
      }
    }
    // 去重+上限4个
    var seen = {};
    return replies.filter(function (r) {
      if (seen[r] || replies.length > 4) return false;
      seen[r] = true;
      return true;
    }).slice(0, 4);
  }

  // ---- 渲染：用户消息 ----
  function addUser(text) {
    if (welcomeEl) { welcomeEl.remove(); welcomeEl = null; }
    var row = document.createElement("div");
    row.className = "user-row";
    var b = document.createElement("div");
    b.className = "user-bubble";
    b.textContent = text;
    row.appendChild(b);
    chatEl.appendChild(row);
    scrollBottom();
  }

  // ---- 渲染：加载中 ----
  function addTyping() {
    var t = document.createElement("div");
    t.className = "typing";
    t.id = "typing";
    t.innerHTML = "<span></span><span></span><span></span>";
    chatEl.appendChild(t);
    scrollBottom();
    return t;
  }

  // ---- 渲染：AI 回复卡片（升级版） ----
  function addAssistant(text) {
    var typing = document.getElementById("typing");
    if (typing) typing.remove();

    var card = document.createElement("div");
    card.className = "ai-card";
    var blocks = parseReply(text);

    // 渲染标签块
    blocks.forEach(function (b) {
      var tag = document.createElement("div");
      tag.className = "tag " + tagClass(b.tag);
      // 给标签加 emoji 前缀
      var prefix = "";
      if (/原文|原话/.test(b.tag)) prefix = "📜 ";
      else if (/亲情翻译|摘要|转化/.test(b.tag)) prefix = "📝 ";
      else if (/情绪/.test(b.tag)) prefix = "💗 ";
      else if (/潜台词|意图/.test(b.tag)) prefix = "💡 ";
      else if (/紧急|告警/.test(b.tag)) prefix = "🚨 ";
      tag.textContent = prefix + b.tag;

      var c = document.createElement("div");
      c.className = "content";
      c.textContent = b.content;
      card.appendChild(tag);
      card.appendChild(c);
    });

    // 提取翻译正文（用于复制和快捷回复）
    var translationText = "";
    var summaryBlock = blocks.find(function (b) { return /亲情翻译|摘要|转化/.test(b.tag); });
    if (summaryBlock) translationText = summaryBlock.content;

    // 快捷回复芯片
    var quickReplies = extractQuickReplies(text);
    if (quickReplies.length > 0 || translationText) {
      var hint = document.createElement("div");
      hint.className = "chip-hint";
      hint.textContent = "💡 推荐回复（点击复制）:";
      card.appendChild(hint);

      var chipRow = document.createElement("div");
      chipRow.className = "chip-row";

      // 用提取到的短语做芯片；没有就用翻译的前两句拆分
      var chips = quickReplies.length > 0 ? quickReplies : [];
      if (chips.length === 0 && translationText) {
        // 把翻译内容按句号/逗号拆成短句
        var sentences = translationText.split(/[。！？\n]/).filter(function (s) { return s.trim().length >= 4 && s.trim().length <= 16; });
        chips = sentences.slice(0, 3);
      }

      chips.forEach(function (chipText) {
        var chip = document.createElement("span");
        chip.className = "chip";
        chip.textContent = chipText;
        chip.addEventListener("click", function () {
          copyToClipboard(chipText);
          chip.classList.add("copied");
          setTimeout(function () { chip.classList.remove("copied"); }, 800);
        });
        chipRow.appendChild(chip);
      });

      card.appendChild(chipRow);
    }

    // 一键复制按钮
    if (translationText) {
      var copyBtn = document.createElement("button");
      copyBtn.className = "copy-btn";
      copyBtn.innerHTML = "📋 复制翻译结果";
      copyBtn.addEventListener("click", function () {
        copyToClipboard(translationText);
        copyBtn.classList.add("copied");
        copyBtn.innerHTML = "✅ 已复制";
        setTimeout(function () {
          copyBtn.classList.remove("copied");
          copyBtn.innerHTML = "📋 复制翻译结果";
        }, 1500);
      });
      card.appendChild(copyBtn);
    }

    chatEl.appendChild(card);
    scrollBottom();
  }

  // 复制到剪贴板
  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        showToast("已复制到剪贴板 ✓");
      })["catch"](fallbackCopy);
    } else {
      fallbackCopy();
    }
    function fallbackCopy() {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;left:-9999px;top:-9999px;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); showToast("已复制到剪贴板 ✓"); } catch (_) { showToast("复制失败，请手动选择复制"); }
      document.body.removeChild(ta);
    }
  }

  // ---- 渲染：错误 ----
  function addError(msg) {
    var typing = document.getElementById("typing");
    if (typing) typing.remove();
    var e = document.createElement("div");
    e.className = "err-card";
    e.textContent = "⚠️ " + msg;
    chatEl.appendChild(e);
    scrollBottom();
  }

  // ---- 发送 ----
  function send() {
    var text = inputEl.value.trim();
    if (!text || busy) return;
    addUser(text);
    inputEl.value = "";
    autoGrow();
    busy = true;
    sendBtn.disabled = true;
    statusEl.textContent = "AI 翻译中…";
    var typing = addTyping();

    fetch(API_BASE + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, direction: mode, address: addressEl.value.trim() })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (res.ok && res.d.reply) {
          addAssistant(res.d.reply);
          statusEl.textContent = "";
        } else {
          addError((res.d && res.d.error) || "请求失败，请稍后再试。");
          statusEl.textContent = "";
        }
      })
      .catch(function (err) {
        addError("网络异常：" + err.message);
        statusEl.textContent = "";
      })
      .finally(function () {
        busy = false;
        sendBtn.disabled = false;
      });
  }

  sendBtn.addEventListener("click", send);
  inputEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  function autoGrow() {
    inputEl.style.height = "auto";
    inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + "px";
  }
  inputEl.addEventListener("input", autoGrow);

  // ---- 语音输入（Web Speech API，浏览器支持时可用）----
  var recognition = null;
  var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = "zh-CN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = function (e) {
      var txt = e.results[0][0].transcript;
      inputEl.value = (inputEl.value ? inputEl.value + " " : "") + txt;
      autoGrow();
    };
    recognition.onend = function () {
      voiceBtn.classList.remove("recording");
      voiceBtn.textContent = "🎙️";
    };
    recognition.onerror = function () {
      voiceBtn.classList.remove("recording");
      voiceBtn.textContent = "🎙️";
      statusEl.textContent = "语音识别不可用，请直接输入文字";
    };
    voiceBtn.addEventListener("click", function () {
      if (voiceBtn.classList.contains("recording")) {
        recognition.stop();
        return;
      }
      try {
        recognition.start();
        voiceBtn.classList.add("recording");
        voiceBtn.textContent = "⏹️";
        statusEl.textContent = "正在听…请说普通话";
      } catch (e) { /* ignore */ }
    });
  } else {
    voiceBtn.style.display = "none";
    statusEl.textContent = "当前浏览器不支持语音输入，可直接打字";
  }

  // ---- 启动自检 ----
  fetch(API_BASE + "/api/health")
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (!d.app_id_set || !d.api_key_set) {
        statusEl.textContent = "提示：服务端尚未配置密钥，发送会报错（见 README）";
      }
    })
    .catch(function () { /* ignore */ });
})();
