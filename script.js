const chat = document.getElementById('chat');
const input = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const themeToggle = document.getElementById('themeToggle');
let HISTORY = [];
    
// Toggle between light/dark mode
themeToggle.onclick = () => {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? '' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  themeToggle.textContent = next === 'dark' ? '☀️' : '🌙';
};

// Create a chat bubble in the chat window
function addBubble(content, cls) {
  const el = document.createElement('div');
  el.className = `bubble ${cls}`;
  el.innerHTML = content;
  chat.appendChild(el);
  chat.scrollTop = chat.scrollHeight;
}

// Add typing indicator bubble
function addTyping() {
  const el = document.createElement('div');
  el.className = 'bubble bot typing';
  el.id = 'typingIndicator';
  chat.appendChild(el);
  chat.scrollTop = chat.scrollHeight;
}

// Remove typing indicator bubble
function removeTyping() {
  const el = document.getElementById('typingIndicator');
  if (el) el.remove();
}

// Send user message to Groq and stream the response
async function converse() {
  const text = input.value.trim();
  if (!text) return;

  // Show user message
  addBubble(text, 'user');
  HISTORY.push({ role: 'user', content: text });
  input.value = '';

  // Add typing indicator while waiting
  addTyping();

  // Always prepend system instruction once (or keep at front)
  if (!HISTORY.some(msg => msg.role === 'system')) {
    HISTORY.unshift({ role: 'system', content: "You are a kong helpful assistant." });
  }

  const payload = {
    model: 'llama3-8b-8192',
    messages: HISTORY,
    stream: true
  };

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}` // Replace with your actual Groq key
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error('API error: ' + res.status);

    removeTyping();
    addBubble('', 'bot');
    const botBubble = chat.querySelector('.bubble.bot:last-child');
    HISTORY.push({ role: 'assistant', content: '' });

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let partial = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      partial += decoder.decode(value, { stream: true });
      const lines = partial.split('\n');

      for (let line of lines) {
        line = line.trim();
        if (!line.startsWith('data:')) continue;

        const jsonStr = line.replace('data: ', '');
        if (jsonStr === '[DONE]') return;

        try {
          const chunk = JSON.parse(jsonStr);
          const content = chunk.choices?.[0]?.delta?.content;
          if (content) {
            botBubble.textContent += content;
            HISTORY[HISTORY.length - 1].content += content;
            chat.scrollTop = chat.scrollHeight;
          }
        } catch (err) {
          console.error('Invalid chunk:', err);
        }
      }
    }
  } catch (err) {
    removeTyping();
    addBubble('⚠️ Error: ' + err.message, 'bot');
  }
}

// Event bindings
sendBtn.onclick = converse;
input.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendBtn.click();
  }
});
