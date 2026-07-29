/* 亲情翻译官 · 网页版前端逻辑 */
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

  // API 基地址：前端托管在 OSS，后端 API 在 FC，不同源，用绝对地址。
  // 若将来把前端也放到 FC 自定义域名（同源），可改回相对路径 "/api"。
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

  // ---- 渲染 ----
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

  function addTyping() {
    var t = document.createElement("div");
    t.className = "typing";
    t.id = "typing";
    t.innerHTML = "<span></span><span></span><span></span>";
    chatEl.appendChild(t);
    scrollBottom();
    return t;
  }

  function addAssistant(text) {
    var typing = document.getElementById("typing");
    if (typing) typing.remove();
    var card = document.createElement("div");
    card.className = "ai-card";
    var blocks = parseReply(text);
    blocks.forEach(function (b) {
      var tag = document.createElement("div");
      tag.className = "tag " + tagClass(b.tag);
      tag.textContent = b.tag;
      var c = document.createElement("div");
      c.className = "content";
      c.textContent = b.content;
      card.appendChild(tag);
      card.appendChild(c);
    });
    chatEl.appendChild(card);
    scrollBottom();
  }

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
    statusEl.textContent = "翻译中…";
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
