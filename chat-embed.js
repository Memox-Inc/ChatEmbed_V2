// Simple Chat Embed Widget
(function () {
  // Unified config object
  var defaultConfig = {
    apiUrl: "https://builder.memox.io/api/v1/prediction/832807e0-6eb1-45ae-ab90-1bc0a18e8487",
    title: 'Chat',
    theme: {
      primary: '#0078d4',
      userBubble: '#e6f0fa',
      botBubble: '#f1f1f1',
      userText: '#22223b',
      botText: '#4a4e69',
      background: '#fff',
      border: '#ccc',
      text: '#222',
      width: '100%',
      maxWidth: '350px',
      minWidth: '220px',
      borderRadius: '8px',
      fontFamily: 'sans-serif',
      zIndex: 9999,
      headerText: '#fff',
      headerBg: 'rgba(34, 34, 59, 0.95)',
      inputBg: '#fff',
      inputText: '#222',
      sendBtnBg: '#0078d4',
      sendBtnText: '#fff',
      sendBtnHover: '#005fa3',
      shadow: '0 2px 8px rgba(0,0,0,0.15)'
    }
  };
  // Allow global override
  var config = window.SimpleChatEmbedConfig ? {
    ...defaultConfig,
    ...window.SimpleChatEmbedConfig,
    theme: { ...defaultConfig.theme, ...(window.SimpleChatEmbedConfig.theme || {}) }
  } : defaultConfig;

  var theme = config.theme;
  var apiUrl = config.apiUrl;
  var welcomeMessage = config.welcomeMessage || null;

  // Create chat container
  var chatContainer = document.createElement('div');
  chatContainer.id = 'simple-chat-embed';
  chatContainer.style.position = 'fixed';
  chatContainer.style.bottom = '24px';
  chatContainer.style.right = '24px';
  chatContainer.style.width = theme.width;
  chatContainer.style.maxWidth = theme.maxWidth;
  chatContainer.style.minWidth = theme.minWidth;
  chatContainer.style.background = theme.background;
  chatContainer.style.border = '1px solid ' + theme.border;
  chatContainer.style.borderRadius = '1rem';
  chatContainer.style.boxShadow = '0 8px 32px 0 rgba(31, 38, 135, 0.15)';
  chatContainer.style.fontFamily = theme.fontFamily + ', Inter, system-ui, sans-serif';
  chatContainer.style.zIndex = theme.zIndex;
  chatContainer.style.color = theme.text;
  chatContainer.style.transition = 'width 0.2s, box-shadow 0.2s';
  chatContainer.style.display = 'flex';
  chatContainer.style.flexDirection = 'column';
  chatContainer.style.height = '60vh';
  chatContainer.style.maxHeight = '80vh';
  chatContainer.style.overflow = 'hidden';

  // Responsive
  function setResponsive() {
    if (window.innerWidth < 500) {
      chatContainer.style.width = '98vw';
      chatContainer.style.right = '1vw';
      chatContainer.style.left = '1vw';
      chatContainer.style.bottom = '0';
      chatContainer.style.borderRadius = '8px 8px 0 0';
      chatContainer.style.minWidth = '0';
    } else {
      chatContainer.style.width = theme.width;
      chatContainer.style.right = '20px';
      chatContainer.style.left = '';
      chatContainer.style.bottom = '20px';
      chatContainer.style.borderRadius = theme.borderRadius;
      chatContainer.style.minWidth = theme.minWidth;
    }
  }
  setResponsive();
  window.addEventListener('resize', setResponsive);

  // Chat header
  var header = document.createElement('div');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  header.style.background = theme.headerBg || 'rgba(34, 34, 59, 0.95)';
  header.style.color = theme.headerText;
  header.style.padding = '0.75rem 1.25rem';
  header.style.borderTopLeftRadius = '1rem';
  header.style.borderTopRightRadius = '1rem';
  header.style.fontWeight = '600';
  header.style.letterSpacing = '0.01em';
  header.style.fontSize = '1.1rem';
  header.style.boxShadow = '0 1px 0 0 #ececec';

  var headerTitle = document.createElement('span');
  headerTitle.innerText = config.title;
  header.appendChild(headerTitle);

  var refreshBtn = document.createElement('button');
  refreshBtn.innerText = '⟳';
  refreshBtn.title = 'Clear chat';
  refreshBtn.style.background = 'transparent';
  refreshBtn.style.color = theme.headerText;
  refreshBtn.style.border = 'none';
  refreshBtn.style.fontSize = '1.2rem';
  refreshBtn.style.cursor = 'pointer';
  refreshBtn.style.marginLeft = '10px';
  refreshBtn.style.transition = 'color 0.15s';
  refreshBtn.onmouseover = function() { refreshBtn.style.color = '#a3a3a3'; };
  refreshBtn.onmouseout = function() { refreshBtn.style.color = theme.headerText; };
  refreshBtn.onclick = function() {
    localStorage.removeItem('simple-chat-messages');
    loadMessages();
  };
  header.appendChild(refreshBtn);
  chatContainer.appendChild(header);

  // Chat messages area
  var messages = document.createElement('div');
  messages.style.flex = '1';
  messages.style.overflowY = 'auto';
  messages.style.padding = '1.25rem 1rem';
  messages.style.background = '#f8fafc';
  messages.id = 'chat-messages';
  messages.style.display = 'flex';
  messages.style.flexDirection = 'column';
  messages.style.gap = '0.5rem';
  chatContainer.appendChild(messages);

  // Chat input area
  var inputContainer = document.createElement('div');
  inputContainer.style.display     = 'flex';
  inputContainer.style.flexDirection = 'row';
  inputContainer.style.alignItems  = 'stretch';
  inputContainer.style.borderTop   = '1px solid #ececec';
  inputContainer.style.background  = '#ffffff';
  inputContainer.style.padding     = '0.5rem';
  inputContainer.style.boxSizing   = 'border-box';
  inputContainer.style.gap         = '0';
  inputContainer.style.width       = '100%';
  inputContainer.style.flex        = '0 0 auto';

  // Create the <input> field
  var input = document.createElement('input');
  input.type        = 'text';
  input.placeholder = 'Type a message…';
  input.style.flex        = '1 1 0%';
  input.style.minWidth    = '0';
  input.style.width       = '100%';
  input.style.margin      = '0';
  input.style.height      = '2.5rem';
  input.style.padding     = '0 2.2rem 0 1rem'; // right padding for icon
  input.style.border      = '1px solid #ececec';
  input.style.borderRight = 'none';
  input.style.borderRadius= '0.75rem 0 0 0.75rem';
  input.style.background  = theme.inputBg;
  input.style.color       = theme.inputText;
  input.style.fontSize    = '1rem';
  input.style.boxSizing   = 'border-box';
  input.style.outline     = 'none';
  input.style.transition  = 'border 0.15s ease-in-out';

  // on-focus / on-blur adjustments:
  input.addEventListener('focus', function() {
    input.style.border = '1.5px solid #a3a3a3';
    input.style.borderRight = 'none';
  });
  input.addEventListener('blur', function() {
    input.style.border = '1px solid #ececec';
    input.style.borderRight = 'none';
  });

  // Create the “Send” <button> field
  var sendBtn = document.createElement('button');
  sendBtn.title     = 'Send';
  sendBtn.innerHTML = 
    '<svg width="18" height="18" viewBox="0 0 20 20" fill="none" ' +
    ' xmlns="http://www.w3.org/2000/svg">' +
    '  <path d="M2.5 17.5L17.5 10L2.5 2.5V8.33333L13.3333 10L2.5 11.6667V17.5Z" ' +
    '        fill="currentColor"/>' +
    '</svg>';
  sendBtn.style.flex            = '0 0 auto';
  sendBtn.style.margin          = '0';
  sendBtn.style.height          = '2.5rem';
  sendBtn.style.padding         = '0 1.25rem';
  sendBtn.style.background      = theme.sendBtnBg;
  sendBtn.style.color           = theme.sendBtnText;
  sendBtn.style.border          = '1px solid #ececec';
  sendBtn.style.borderLeft      = 'none';
  sendBtn.style.borderRadius    = '0 0.75rem 0.75rem 0';
  sendBtn.style.cursor          = 'pointer';
  sendBtn.style.fontWeight      = '600';
  sendBtn.style.fontSize        = '1rem';
  sendBtn.style.transition      = 'background 0.15s ease-in-out, color 0.15s ease-in-out';
  sendBtn.style.boxSizing       = 'border-box';
  sendBtn.style.display         = 'flex';
  sendBtn.style.justifyContent  = 'center';
  sendBtn.style.alignItems      = 'center';

  // hover state
  sendBtn.addEventListener('mouseover', function() {
    sendBtn.style.background = theme.sendBtnHover;
  });
  sendBtn.addEventListener('mouseout', function() {
    sendBtn.style.background = theme.sendBtnBg;
  });

  // --- Image upload groundwork ---
  // Place the image upload (clip) button inside the input field, left-aligned
  inputContainer.style.position = 'relative';

  var imageInput = document.createElement('input');
  imageInput.type = 'file';
  imageInput.accept = 'image/*';
  imageInput.style.display = 'none';

  var imageBtn = document.createElement('button');
  imageBtn.title = 'Send image';
  // Paperclip SVG icon
  imageBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.5 10.5L13.5 4.5C14.3284 3.67157 15.6716 3.67157 16.5 4.5C17.3284 5.32843 17.3284 6.67157 16.5 7.5L8.5 15.5C6.84315 17.1569 4.15685 17.1569 2.5 15.5C0.843146 13.8431 0.843146 11.1569 2.5 9.5L10.5 1.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  imageBtn.style.position = 'absolute';
  imageBtn.style.left = '8px';
  imageBtn.style.top = '50%';
  imageBtn.style.transform = 'translateY(-50%)';
  imageBtn.style.height = '2rem';
  imageBtn.style.width = '2rem';
  imageBtn.style.background = 'transparent';
  imageBtn.style.color = theme.inputText;
  imageBtn.style.border = 'none';
  imageBtn.style.borderRadius = '0.5rem';
  imageBtn.style.cursor = 'pointer';
  imageBtn.style.display = 'flex';
  imageBtn.style.justifyContent = 'center';
  imageBtn.style.alignItems = 'center';
  imageBtn.style.transition = 'background 0.15s, color 0.15s';
  imageBtn.onmouseover = function() { imageBtn.style.background = '#ececec'; };
  imageBtn.onmouseout = function() { imageBtn.style.background = 'transparent'; };
  imageBtn.onclick = function() { imageInput.click(); };
  inputContainer.appendChild(imageBtn);
  inputContainer.appendChild(imageInput);

  // Adjust input padding to make space for the icon
  input.style.paddingLeft = '2.5rem';
  // Add left padding to placeholder text for visual alignment
  input.style.setProperty('text-indent', '1.5rem');

  // Handle image selection
  imageInput.addEventListener('change', function(e) {
    var file = imageInput.files[0];
    if (!file) return;
    // Only allow images up to 5MB
    if (file.size > 5 * 1024 * 1024) {
      saveMessage('Image too large (max 5MB).', 'bot');
      loadMessages();
      return;
    }
    var reader = new FileReader();
    reader.onload = function(evt) {
      var dataUrl = evt.target.result;
      // Save image as a user message (base64 data URL)
      saveMessage('[Image]', 'user');
      loadMessages();
      // Send to AI or human agent
      if (isHumanAgentActive && humanSocket && humanSocket.readyState === 1) {
        // Send as base64 or as a special message type (your backend should handle this securely)
        humanSocket.send(JSON.stringify({type: 'image', data: dataUrl, filename: file.name}));
      } else {
        // For AI, send as base64 or as a special message type if your API supports it
        fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: dataUrl, filename: file.name })
        })
        .then(res => res.json())
        .then(result => {
          let botMsg = result.text || result.answer || '[Image received]';
          saveMessage(botMsg, 'bot');
          loadMessages();
        })
        .catch(() => {
          saveMessage('Error sending image.', 'bot');
          loadMessages();
        });
      }
    };
    reader.readAsDataURL(file);
    imageInput.value = '';
  });

  // Chat input area (continued)
  inputContainer.appendChild(input);
  inputContainer.appendChild(sendBtn);
  chatContainer.appendChild(inputContainer);

  // Powered by memox footer
  var footer = document.createElement('div');
  footer.style.textAlign = 'center';
  footer.style.fontSize = '0.85rem';
  footer.style.color = '#a3a3a3';
  footer.style.padding = '0.25rem 0 0.75rem 0';
  footer.innerHTML = 'Powered by <a href="https://memox.com" target="_blank" style="color:#4a4e69;text-decoration:none;font-weight:600;">memox</a>';
  chatContainer.appendChild(footer);

  // Add chat to body
  document.body.appendChild(chatContainer);


  // Make request to Flowise API with streaming support
  async function queryStream(data, onChunk) {
    const response = await fetch(
      apiUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      }
    );
    if (!response.body || !window.ReadableStream) {
      const result = await response.json();
      onChunk(result.text || result.answer || JSON.stringify(result), true);
      return;
    }
    const reader = response.body.getReader();
    let decoder = new TextDecoder();
    let done = false;
    let fullText = '';
    let lastText = '';
    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      if (value) {
        const chunk = decoder.decode(value, { stream: !done });
        fullText += chunk;
        // Try to parse JSON and extract .text if possible
        let displayText = fullText;
        try {
          const parsed = JSON.parse(fullText);
          if (parsed && typeof parsed.text === 'string') {
            displayText = parsed.text;
          }
        } catch (e) {
          // Not JSON, use as is
        }
        // Only stream new words
        if (displayText !== lastText) {
          onChunk(displayText, false);
          lastText = displayText;
        }
      }
    }
    onChunk(lastText, true);
  }

  function createBouncingDots() {
    var loader = document.createElement('span');
    loader.style.display = 'inline-flex';
    loader.style.alignItems = 'center';
    loader.style.height = '1.5em';
    var dotColor = theme.botText || '#4a4e69';
    loader.innerHTML = `
      <span style="display:inline-block;width:8px;height:8px;margin:0 2px;background:${dotColor};border-radius:50%;animation:bounce 1s infinite alternate;"></span>
      <span style="display:inline-block;width:8px;height:8px;margin:0 2px;background:${dotColor};border-radius:50%;animation:bounce 1s 0.2s infinite alternate;"></span>
      <span style="display:inline-block;width:8px;height:8px;margin:0 2px;background:${dotColor};border-radius:50%;animation:bounce 1s 0.4s infinite alternate;"></span>
    `;
    // Add keyframes if not already present
    if (!document.getElementById('simple-chat-bounce-style')) {
      var style = document.createElement('style');
      style.id = 'simple-chat-bounce-style';
      style.innerHTML = `@keyframes bounce { 0% { transform: translateY(0); } 100% { transform: translateY(-7px); } }`;
      document.head.appendChild(style);
    }
    return loader;
  }

  // Helper: linkify and style links in bot messages
  function linkifyAndStyle(text) {
    // Replace markdown links [text](url) with styled <a>
    return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function(_, label, url) {
      return '<a href="' + url + '" target="_blank" style="font-weight:bold;color:' + (theme.botText || '#4a4e69') + ';text-decoration:underline;cursor:pointer;">' + label + '</a>';
    });
  }

  // Load messages from localStorage
  function loadMessages() {
    var msgs = JSON.parse(localStorage.getItem('simple-chat-messages') || '[]');
    messages.innerHTML = '';
    for (var i = 0; i < msgs.length; i++) {
      var msg = msgs[i];
      var msgDiv = document.createElement('div');
      msgDiv.style.margin = '0';
      msgDiv.style.padding = '0.75rem 1rem';
      msgDiv.style.borderRadius = '1rem';
      msgDiv.style.maxWidth = '66%';
      msgDiv.style.wordBreak = 'break-word';
      msgDiv.style.display = 'block';
      msgDiv.style.minWidth = 'fit-content';
      msgDiv.style.boxSizing = 'border-box';
      msgDiv.style.fontSize = '0.97rem';
      msgDiv.style.lineHeight = '1.7';
      msgDiv.style.boxShadow = '0 1px 2px 0 #ececec';
      var wrapper = document.createElement('div');
      wrapper.style.display = 'flex';
      wrapper.style.width = '100%';
      if (msg.sender === 'user') {
        msgDiv.style.background = theme.userBubble;
        msgDiv.style.color = theme.userText || '#22223b';
        wrapper.style.justifyContent = 'flex-end';
        msgDiv.innerText = msg.text;
      } else {
        msgDiv.style.background = theme.botBubble;
        msgDiv.style.color = theme.botText || '#4a4e69';
        wrapper.style.justifyContent = 'flex-start';
        if (msg.text === '' && i === msgs.length - 1) {
          msgDiv.appendChild(createBouncingDots());
        } else if (msg.text === '[Image]' && i > 0 && isImageDataUrl(msgs[i-1].text)) {
          var img = document.createElement('img');
          img.src = msgs[i-1].text;
          img.style.maxWidth = '180px';
          img.style.maxHeight = '120px';
          img.style.borderRadius = '0.75rem';
          img.style.display = 'block';
          img.style.margin = '0.25rem 0';
          msgDiv.appendChild(img);
        } else {
          msgDiv.innerHTML = linkifyAndStyle(msg.text);
        }
      }
      wrapper.appendChild(msgDiv);
      messages.appendChild(wrapper);
    }
    messages.scrollTop = messages.scrollHeight;
  }

  // Save message to localStorage
  function saveMessage(msg, sender) {
    var msgs = JSON.parse(localStorage.getItem('simple-chat-messages') || '[]');
    msgs.push({ text: msg, sender: sender });
    localStorage.setItem('simple-chat-messages', JSON.stringify(msgs));
  }

  // Animate text streaming in word by word
  function animateTextStream(msgIdx, fullText) {
    var words = fullText.split(/(\s+)/g); // keep spaces
    var current = '';
    var i = 0;
    function step() {
      if (i <= words.length) {
        current = words.slice(0, i).join('');
        // Update last bot message in localStorage
        var msgs = JSON.parse(localStorage.getItem('simple-chat-messages') || '[]');
        if (msgs[msgIdx] && msgs[msgIdx].sender === 'bot') {
          msgs[msgIdx].text = current;
          localStorage.setItem('simple-chat-messages', JSON.stringify(msgs));
          loadMessages();
        }
        i++;
        setTimeout(step, 60); // adjust speed here
      }
    }
    step();
  }

  // --- Human takeover groundwork ---
  // This flag determines if the chat is currently handled by a human agent (via WebSocket/Django backend)
  var isHumanAgentActive = false;
  // This will hold the WebSocket connection if/when a human agent takes over
  var humanSocket = null;

  /**
   * Call this function to switch the chat from AI to human agent mode.
   * It will close any existing AI session and establish a secure WebSocket connection to your backend.
   *
   * @param {string} wsUrl - The WebSocket URL for your Django backend (e.g. wss://yourdomain.com/ws/support/room_id/)
   * @param {string} authToken - (Optional) A secure token for authenticating the user/session with your backend.
   */
  function switchToHumanAgent(wsUrl, authToken) {
    if (isHumanAgentActive) return; // Already in human mode
    isHumanAgentActive = true;
    // Optionally, show a UI message: "You are now chatting with a human agent."
    saveMessage('You are now chatting with a human agent.', 'bot');
    loadMessages();
    // Close any previous socket
    if (humanSocket) humanSocket.close();
    // --- SECURITY NOTE ---
    // Always use wss:// (secure WebSocket) in production.
    // Pass a secure, short-lived auth token (JWT or similar) to authenticate the user/session.
    // Never expose sensitive credentials in the client code.
    var wsFullUrl = wsUrl;
    if (authToken) {
      // Example: append token as query param (your backend should validate it!)
      wsFullUrl += (wsUrl.indexOf('?') === -1 ? '?' : '&') + 'token=' + encodeURIComponent(authToken);
    }
    humanSocket = new WebSocket(wsFullUrl);
    humanSocket.onopen = function() {
      // Optionally notify the backend of the chat history or user info here
      // humanSocket.send(JSON.stringify({type: 'init', history: ...}));
    };
    humanSocket.onmessage = function(event) {
      // Expect messages from the agent as plain text or JSON
      var data = event.data;
      try {
        var parsed = JSON.parse(data);
        if (parsed.text) data = parsed.text;
      } catch (e) {}
      saveMessage(data, 'bot');
      loadMessages();
    };
    humanSocket.onclose = function() {
      // Optionally notify the user
      saveMessage('The human agent has left the chat.', 'bot');
      loadMessages();
      isHumanAgentActive = false;
      humanSocket = null;
    };
    humanSocket.onerror = function(err) {
      saveMessage('Connection error with human agent.', 'bot');
      loadMessages();
    };
  }

  // --- Message sending logic update ---
  // This function now routes messages to either the AI or the human agent
  async function sendMessage() {
    var val = input.value.trim();
    if (!val) return;
    saveMessage(val, 'user');
    input.value = '';
    loadMessages();
    if (isHumanAgentActive && humanSocket && humanSocket.readyState === 1) {
      // Send message to human agent via WebSocket
      humanSocket.send(val);
      return;
    }
    // Show loading message
    saveMessage('', 'bot');
    loadMessages();
    // Query Flowise
    try {
      const response = await fetch(
        apiUrl,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ question: val })
        }
      );
      const result = await response.json();
      let botMsg = result.text || result.answer || JSON.stringify(result);
      // Animate the bot message in
      var msgs = JSON.parse(localStorage.getItem('simple-chat-messages') || '[]');
      var botIdx = msgs.length - 1;
      animateTextStream(botIdx, botMsg);
    } catch (e) {
      // Remove loading message and show error
      var msgs = JSON.parse(localStorage.getItem('simple-chat-messages') || '[]');
      if (msgs.length && msgs[msgs.length - 1].sender === 'bot') {
        msgs[msgs.length - 1].text = 'Error contacting bot.';
        localStorage.setItem('simple-chat-messages', JSON.stringify(msgs));
        loadMessages();
      }
    }
  }

  // --- Example usage ---
  // To trigger human takeover from outside (e.g. by a button or backend event), call:
  // switchToHumanAgent('wss://yourdomain.com/ws/support/room_id/', 'secure-auth-token');
  //
  // You can expose this function globally if needed:
  window.SimpleChatEmbedSwitchToHuman = switchToHumanAgent;

  sendBtn.onclick = sendMessage;
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') sendMessage();
  });

  // Lead capture inside chat window
  function showLeadCaptureInChat(onComplete) {
    messages.innerHTML = '';
    var wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.alignItems = 'center';
    wrapper.style.justifyContent = 'center';
    wrapper.style.height = '100%';
    wrapper.style.width = '100%';
    wrapper.style.gap = '1.2rem';

    var title = document.createElement('div');
    title.innerText = 'Enter to Chat';
    title.style.fontWeight = '600';
    title.style.fontSize = '1.2rem';
    title.style.marginBottom = '0.5rem';
    wrapper.appendChild(title);

    var nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'Your name';
    nameInput.style.padding = '0.75rem 1rem';
    nameInput.style.border = '1px solid #ececec';
    nameInput.style.borderRadius = '0.75rem';
    nameInput.style.fontSize = '1rem';
    nameInput.style.width = '100%';
    nameInput.style.maxWidth = '260px';
    wrapper.appendChild(nameInput);

    var emailInput = document.createElement('input');
    emailInput.type = 'email';
    emailInput.placeholder = 'Email address';
    emailInput.style.padding = '0.75rem 1rem';
    emailInput.style.border = '1px solid #ececec';
    emailInput.style.borderRadius = '0.75rem';
    emailInput.style.fontSize = '1rem';
    emailInput.style.width = '100%';
    emailInput.style.maxWidth = '260px';
    wrapper.appendChild(emailInput);

    var emailError = document.createElement('div');
    emailError.style.display = 'none';
    emailError.style.color = '#e57373';
    emailError.style.fontSize = '0.95rem';
    emailError.style.fontStyle = 'italic';
    emailError.style.marginTop = '0.25rem';
    emailError.style.marginBottom = '-0.5rem';
    emailError.innerText = 'please enter a valid email address';
    wrapper.appendChild(emailError);

    var btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.gap = '0.5rem';
    btnRow.style.width = '100%';
    btnRow.style.justifyContent = 'space-between';
    btnRow.style.maxWidth = '260px';

    var confirmBtn = document.createElement('button');
    confirmBtn.innerText = 'Enter Chat';
    confirmBtn.style.background = theme.primary;
    confirmBtn.style.color = '#fff';
    confirmBtn.style.border = 'none';
    confirmBtn.style.borderRadius = '0.75rem';
    confirmBtn.style.padding = '0.75rem 1.25rem';
    confirmBtn.style.cursor = 'pointer';
    confirmBtn.style.fontWeight = '600';
    confirmBtn.style.fontSize = '1rem';
    confirmBtn.style.transition = 'background 0.15s, color 0.15s';
    confirmBtn.onmouseover = function() { confirmBtn.style.background = theme.sendBtnHover; };
    confirmBtn.onmouseout = function() { confirmBtn.style.background = theme.primary; };
    confirmBtn.onclick = function() {
      var emailVal = emailInput.value.trim();
      if (emailVal && !/^\S+@\S+\.\S+$/.test(emailVal)) {
        emailInput.style.border = '1.5px solid #e57373';
        emailError.style.display = 'block';
        emailInput.focus();
        return;
      } else {
        emailInput.style.border = '1px solid #ececec';
        emailError.style.display = 'none';
      }
      messages.innerHTML = '';
      // Collect environment info
      var userAgent = navigator.userAgent;
      var platform = navigator.platform;
      var url = window.location.href;
      var timestamp = new Date().toISOString();
      var language = navigator.language;
      var referrer = document.referrer;
      // Fetch public IP address
      fetch('https://api.ipify.org?format=json')
        .then(function(res) { return res.json(); })
        .then(function(ipData) {
          var ip = ipData.ip || '';
          // Generate a GUID for the user (if not already present)
          var guid = localStorage.getItem('simple-chat-user-guid');
          if (!guid) {
            guid = ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
              (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
            );
            localStorage.setItem('simple-chat-user-guid', guid);
          }
          var leadData = {
            name: sanitize(nameInput.value),
            email: sanitize(emailInput.value),
            timestamp,
            userAgent,
            platform,
            url,
            language,
            referrer,
            guid,
            ip
          };
          // Store lead in localStorage array for later sending
          var leads = JSON.parse(localStorage.getItem('simple-chat-leads') || '[]');
          leads.push(leadData);
          localStorage.setItem('simple-chat-leads', JSON.stringify(leads));
          // Log to console for now
          console.log('Lead captured:', leadData);
          onComplete(leadData);
        });
    };
    // Allow pressing Enter to submit the form
    nameInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') confirmBtn.click();
    });
    emailInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') confirmBtn.click();
    });
    btnRow.appendChild(confirmBtn);

    var skipBtn = document.createElement('button');
    skipBtn.innerText = 'Skip';
    skipBtn.style.background = '#222';
    skipBtn.style.color = '#fff';
    skipBtn.style.border = 'none';
    skipBtn.style.borderRadius = '0.75rem';
    skipBtn.style.padding = '0.75rem 1.25rem';
    skipBtn.style.cursor = 'pointer';
    skipBtn.style.fontWeight = '600';
    skipBtn.style.fontSize = '1rem';
    skipBtn.style.transition = 'background 0.15s, color 0.15s';
    skipBtn.onmouseover = function() { skipBtn.style.background = '#444'; };
    skipBtn.onmouseout = function() { skipBtn.style.background = '#222'; };
    skipBtn.onclick = function() {
      messages.innerHTML = '';
      // Optionally log skipped lead
      var leadData = { name: '', email: '', skipped: true, timestamp: new Date().toISOString() };
      var leads = JSON.parse(localStorage.getItem('simple-chat-leads') || '[]');
      leads.push(leadData);
      localStorage.setItem('simple-chat-leads', JSON.stringify(leads));
      console.log('Lead skipped:', leadData);
      onComplete(null);
    };
    btnRow.appendChild(skipBtn);

    wrapper.appendChild(btnRow);
    messages.appendChild(wrapper);
    nameInput.focus();

    // Add privacy notice
    var privacy = document.createElement('div');
    privacy.style.fontSize = '0.85rem';
    privacy.style.color = '#888';
    privacy.style.textAlign = 'center';
    privacy.style.maxWidth = '260px';
    privacy.style.marginTop = '0.5rem';
    privacy.innerHTML = 'By continuing, you agree to our <a href="https://memox.com/privacy" target="_blank" style="color:#4a4e69;text-decoration:underline;">Privacy Policy</a>.';
    wrapper.appendChild(privacy);
  }

  // On load, show lead capture inside chat window
  function maybeShowLeadCapture() {
    if (!window.__simpleChatEmbedLeadCaptured) {
      inputContainer.style.display = 'none';
      footer.style.display = 'none';
      showLeadCaptureInChat(function(lead) {
        window.__simpleChatEmbedLeadCaptured = true;
        if (lead) {
          window.SimpleChatEmbedLead = lead;
        }
        // Restore chat input flex layout after lead form
        inputContainer.style.display = 'flex';
        inputContainer.style.flexDirection = 'row';
        inputContainer.style.width = '100%';
        inputContainer.style.boxSizing = 'border-box';
        inputContainer.style.padding = '0.5rem';
        inputContainer.style.gap = '0';
        inputContainer.style.alignItems = 'stretch';
        inputContainer.style.flex = '0 0 auto';
        inputContainer.style.borderTop = '1px solid #ececec';
        inputContainer.style.background = '#ffffff';
        input.style.flex = '1 1 0%';
        input.style.minWidth = '0';
        input.style.width = 'auto';
        input.style.margin = '0';
        input.style.height = '2.5rem';
        input.style.padding = '0 1rem';
        input.style.border = '1px solid #ececec';
        input.style.borderRight = 'none';
        input.style.borderRadius = '0.75rem 0 0 0.75rem';
        input.style.background = theme.inputBg;
        input.style.color = theme.inputText;
        input.style.fontSize = '1rem';
        input.style.boxSizing = 'border-box';
        input.style.outline = 'none';
        input.style.transition = 'border 0.15s ease-in-out';
        sendBtn.style.flex = '0 0 auto';
        sendBtn.style.margin = '0';
        sendBtn.style.height = '2.5rem';
        sendBtn.style.padding = '0 1.25rem';
        sendBtn.style.background = theme.sendBtnBg;
        sendBtn.style.color = theme.sendBtnText;
        sendBtn.style.border = '1px solid #ececec';
        sendBtn.style.borderLeft = 'none';
        sendBtn.style.borderRadius = '0 0.75rem 0.75rem 0';
        sendBtn.style.cursor = 'pointer';
        sendBtn.style.fontWeight = '600';
        sendBtn.style.fontSize = '1rem';
        sendBtn.style.transition = 'background 0.15s ease-in-out, color 0.15s ease-in-out';
        sendBtn.style.boxSizing = 'border-box';
        sendBtn.style.display = 'flex';
        sendBtn.style.justifyContent = 'center';
        sendBtn.style.alignItems = 'center';
        footer.style.display = '';
        // Show welcome message if set and no previous messages
        var msgs = JSON.parse(localStorage.getItem('simple-chat-messages') || '[]');
        if (welcomeMessage && msgs.length === 0) {
          saveMessage(welcomeMessage, 'bot');
        }
        loadMessages();
      });
    } else {
      // Already captured, show chat input
      inputContainer.style.display = 'flex';
      inputContainer.style.flexDirection = 'row';
      inputContainer.style.width = '100%';
      inputContainer.style.boxSizing = 'border-box';
      inputContainer.style.padding = '0.5rem';
      inputContainer.style.gap = '0';
      inputContainer.style.alignItems = 'stretch';
      inputContainer.style.flex = '0 0 auto';
      inputContainer.style.borderTop = '1px solid #ececec';
      inputContainer.style.background = '#ffffff';
      input.style.flex = '1 1 0%';
      input.style.minWidth = '0';
      input.style.width = 'auto';
      input.style.margin = '0';
      input.style.height = '2.5rem';
      input.style.padding = '0 1rem';
      input.style.border = '1px solid #ececec';
      input.style.borderRight = 'none';
      input.style.borderRadius = '0.75rem 0 0 0.75rem';
      input.style.background = theme.inputBg;
      input.style.color = theme.inputText;
      input.style.fontSize = '1rem';
      input.style.boxSizing = 'border-box';
      input.style.outline = 'none';
      input.style.transition = 'border 0.15s ease-in-out';
      sendBtn.style.flex = '0 0 auto';
      sendBtn.style.margin = '0';
      sendBtn.style.height = '2.5rem';
      sendBtn.style.padding = '0 1.25rem';
      sendBtn.style.background = theme.sendBtnBg;
      sendBtn.style.color = theme.sendBtnText;
      sendBtn.style.border = '1px solid #ececec';
      sendBtn.style.borderLeft = 'none';
      sendBtn.style.borderRadius = '0 0.75rem 0.75rem 0';
      sendBtn.style.cursor = 'pointer';
      sendBtn.style.fontWeight = '600';
      sendBtn.style.fontSize = '1rem';
      sendBtn.style.transition = 'background 0.15s ease-in-out, color 0.15s ease-in-out';
      sendBtn.style.boxSizing = 'border-box';
      sendBtn.style.display = 'flex';
      sendBtn.style.justifyContent = 'center';
      sendBtn.style.alignItems = 'center';
      footer.style.display = '';
      loadMessages();
    }
  }

  // Sanitize input to prevent XSS
  function sanitize(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]);
    });
  }
  // Initial load
  maybeShowLeadCapture();
})();
