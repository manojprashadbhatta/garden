/*
  Garden Homestay & Resort — Customer Care Desk Engine
*/
(() => {
  const form = document.getElementById("chatForm");
  const input = document.getElementById("userInput");
  const sendButton = document.getElementById("sendButton");
  const messages = document.getElementById("messages");
  const welcome = document.getElementById("welcome");
  const toast = document.getElementById("toast");

  let faqs = [];
  let toastTimer;

  const normalize = (value) => String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  function tokenize(value) {
    const stopWords = new Set([
      "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
      "i", "you", "we", "they", "he", "she", "it", "to", "of", "in", "on",
      "at", "for", "and", "or", "but", "do", "does", "did", "can", "could",
      "would", "should", "what", "how", "why", "when", "where", "who", "please"
    ]);
    return normalize(value).split(" ").filter(word => word.length > 1 && !stopWords.has(word));
  }

  function scoreFaq(question, faq) {
    const q = normalize(question);
    const qTokens = new Set(tokenize(question));
    const phrases = [faq.question, ...(faq.keywords || []), ...(faq.aliases || [])]
      .map(normalize).filter(Boolean);
    let score = 0;

    for (const phrase of phrases) {
      if (q === phrase) score = Math.max(score, 100);
      else if (phrase.length > 3 && q.includes(phrase)) score = Math.max(score, 75 + Math.min(phrase.length / 20, 10));

      const phraseTokens = tokenize(phrase);
      if (phraseTokens.length) {
        const overlap = phraseTokens.filter(token => qTokens.has(token)).length;
        const coverage = overlap / phraseTokens.length;
        const queryCoverage = overlap / Math.max(qTokens.size, 1);
        const candidateScore = overlap === 0 ? 0 : 22 * coverage + 12 * queryCoverage;
        score = Math.max(score, candidateScore);
      }
    }

    const mainTokens = tokenize(faq.question || "");
    if (mainTokens.length > 1 && mainTokens.every(token => qTokens.has(token))) score += 12;
    return score;
  }

  function findAnswer(question) {
    let best = null;
    let bestScore = 0;
    for (const faq of faqs) {
      const score = scoreFaq(question, faq);
      if (score > bestScore) {
        best = faq;
        bestScore = score;
      }
    }
    return best && bestScore >= 24 ? best : null;
  }

  function showToast(message) {
    toast.textContent = message;
    toast.style.display = "block";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.style.display = "none"; }, 2400);
  }

  function addMessage(role, text) {
    const row = document.createElement("div");
    row.className = `message ${role}`;
    const avatar = document.createElement("div");
    avatar.className = role === "user" ? "avatar user-avatar" : "avatar bot";
    avatar.textContent = role === "user" ? "G" : "G";

    const bubble = document.createElement("div");
    bubble.className = "bubble";
    const content = document.createElement("div");
    content.className = role === "user" ? "" : "assistant-content";
    content.textContent = text;
    bubble.appendChild(content);

    if (role !== "user") {
      const tools = document.createElement("div");
      tools.className = "message-tools";
      const copy = document.createElement("button");
      copy.type = "button";
      copy.textContent = "📋 Copy Answer";
      copy.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(text);
          showToast("Answer copied to clipboard");
        } catch {
          showToast("Copy unavailable");
        }
      });
      tools.appendChild(copy);
      bubble.appendChild(tools);
    }

    if (role === "user") {
      row.append(bubble, avatar);
    } else {
      row.append(avatar, bubble);
    }
    messages.appendChild(row);
    scrollToBottom();
    return row;
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      const area = document.getElementById("chatArea");
      area.scrollTop = area.scrollHeight;
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    });
  }

  function addTyping() {
    const row = document.createElement("div");
    row.className = "message assistant";
    row.id = "typingIndicator";
    const avatar = document.createElement("div");
    avatar.className = "avatar bot";
    avatar.textContent = "G";
    const bubble = document.createElement("div");
    bubble.className = "bubble";
    const dots = document.createElement("div");
    dots.className = "typing";
    dots.innerHTML = "<i></i><i></i><i></i>";
    bubble.appendChild(dots);
    row.append(avatar, bubble);
    messages.appendChild(row);
    scrollToBottom();
  }

  function respond(question) {
    const faq = findAnswer(question);
    addTyping();
    window.setTimeout(() => {
      const typing = document.getElementById("typingIndicator");
      if (typing) typing.remove();
      if (faq) {
        addMessage("assistant", faq.answer);
      } else {
        const fallback = "We couldn't find a direct record for that in our desk database. Please feel free to call our direct customer helpline at +977 985-8422405 for instant human assistance!";
        addMessage("assistant", fallback);
      }
    }, 400);
  }

  function sendQuestion(question) {
    const clean = question.trim();
    if (!clean) return;
    welcome.style.display = "none";
    addMessage("user", clean);
    input.value = "";
    input.style.height = "auto";
    sendButton.disabled = true;
    respond(clean);
  }

  function resetChat() {
    messages.innerHTML = "";
    welcome.style.display = "block";
    input.value = "";
    input.style.height = "auto";
    sendButton.disabled = true;
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    sendQuestion(input.value);
  });

  input.addEventListener("input", () => {
    sendButton.disabled = !input.value.trim();
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 140) + "px";
  });

  input.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (input.value.trim()) sendQuestion(input.value);
    }
  });

  document.querySelectorAll(".suggestion").forEach(button => {
    button.addEventListener("click", () => sendQuestion(button.dataset.question || ""));
  });

  const clearBtn = document.getElementById("clearChat");
  if (clearBtn) clearBtn.addEventListener("click", resetChat);

  async function loadFaqs() {
    try {
      const response = await fetch("faqs.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      faqs = Array.isArray(data) ? data : (Array.isArray(data.faqs) ? data.faqs : []);
    } catch (error) {
      console.error("Could not load faqs.json:", error);
      faqs = [];
      showToast("Could not load faqs.json knowledge base");
    }
  }

  loadFaqs();
})();
