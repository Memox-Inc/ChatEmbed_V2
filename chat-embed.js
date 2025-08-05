(function () {
    var defaultConfig = {
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
    
    var config = window.SimpleChatEmbedConfig ? {
        ...defaultConfig,
        ...window.SimpleChatEmbedConfig,
        theme: { ...defaultConfig.theme, ...(window.SimpleChatEmbedConfig.theme || {}) }
    } : defaultConfig;

    var theme = config.theme;
    var apiUrl = config.apiUrl;
    var welcomeMessage = config.welcomeMessage || null;
    var workflowId = config.workflowId;
    var socketUrl = config.socketUrl + "/ws/chat/";

    var currentSocket = null;
    var isWebSocketConnected = false;
    var humanSocket = null;
    var isHumanAgentActive = false;

    function generateSecureWsParams(workflow_id) {
        const secret = '4f3c9a1d8e5b6c2f719a0e3d5a8b7c4d9e6f1a0b3d7c8e2f6a9d0e1b4c5f7a6d';
        const hashedWorkflowId = btoa(String(workflow_id));
        const encoder = new TextEncoder();
        const keyData = encoder.encode(secret);
        const data = encoder.encode(hashedWorkflowId);
        return window.crypto.subtle.importKey(
            'raw',
            keyData,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        ).then(key =>
            window.crypto.subtle.sign('HMAC', key, data)
        ).then(signature => {
            const hashArray = Array.from(new Uint8Array(signature));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            return {
                hashed_workflow_id: hashedWorkflowId,
                hash: hashHex
            };
        });
    }

    function generateChatId() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    var chatContainer = document.createElement('div');
    chatContainer.id = 'simple-chat-embed';
    chatContainer.style.position = 'fixed';
    chatContainer.style.bottom = '20px';
    chatContainer.style.right = '20px';
    chatContainer.style.width = '384px';
    chatContainer.style.height = '80vh';
    chatContainer.style.maxHeight = '600px';
    chatContainer.style.background = '#ffffff';
    chatContainer.style.border = '1px solid #e2e8f0';
    chatContainer.style.borderRadius = '0.75rem';
    chatContainer.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
    chatContainer.style.fontFamily = theme.fontFamily + ', Inter, system-ui, sans-serif';
    chatContainer.style.zIndex = theme.zIndex;
    chatContainer.style.color = theme.text;
    chatContainer.style.transition = 'transform 0.3s ease-in-out';
    chatContainer.style.display = 'flex';
    chatContainer.style.flexDirection = 'column';
    chatContainer.style.overflow = 'hidden';

    function setResponsive() {
        if (window.innerWidth < 768) {
            chatContainer.style.position = 'fixed';
            chatContainer.style.top = '0';
            chatContainer.style.left = '0';
            chatContainer.style.right = '0';
            chatContainer.style.bottom = '0';
            chatContainer.style.width = '100%';
            chatContainer.style.height = '100vh';
            chatContainer.style.borderRadius = '0';
            chatContainer.style.maxHeight = '100vh';
        } else {
            chatContainer.style.position = 'fixed';
            chatContainer.style.top = 'auto';
            chatContainer.style.left = 'auto';
            chatContainer.style.right = '20px';
            chatContainer.style.bottom = '20px';
            chatContainer.style.width = '384px';
            chatContainer.style.height = '80vh';
            chatContainer.style.borderRadius = '0.75rem';
            chatContainer.style.maxHeight = '600px';
        }
    }
    setResponsive();
    window.addEventListener('resize', setResponsive);

    var header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.background = theme.headerBg || '#16a34a';
    header.style.color = theme.headerText;
    header.style.padding = '2rem';
    header.style.borderTopLeftRadius = '0.75rem';
    header.style.borderTopRightRadius = '0.75rem';
    header.style.fontWeight = '600';
    header.style.fontSize = '1.125rem';
    header.style.lineHeight = '1.75rem';

    var headerTitle = document.createElement('div');
    headerTitle.innerText = config.title;
    header.appendChild(headerTitle);

    var headerActions = document.createElement('div');
    headerActions.style.display = 'flex';

    var refreshBtn = document.createElement('button');
    refreshBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="m21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>';
    refreshBtn.title = 'Reset chat';
    refreshBtn.style.background = 'transparent';
    refreshBtn.style.color = theme.headerText;
    refreshBtn.style.border = 'none';
    refreshBtn.style.padding = '0.5rem';
    refreshBtn.style.cursor = 'pointer';
    refreshBtn.style.borderRadius = '0.375rem';
    refreshBtn.style.display = 'flex';
    refreshBtn.style.alignItems = 'center';
    refreshBtn.style.justifyContent = 'center';
    refreshBtn.style.transition = 'background-color 0.2s ease-in-out';
    refreshBtn.onmouseover = function () { refreshBtn.style.backgroundColor = 'rgba(255,255,255,0.1)'; };
    refreshBtn.onmouseout = function () { refreshBtn.style.backgroundColor = 'transparent'; };
    refreshBtn.onclick = function () {
        localStorage.removeItem('simple-chat-messages');
        loadMessages();
    };

    var closeBtn = document.createElement('button');
    closeBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
    closeBtn.title = 'Close chat';
    closeBtn.style.background = 'transparent';
    closeBtn.style.color = theme.headerText;
    closeBtn.style.border = 'none';
    closeBtn.style.padding = '0.5rem';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.borderRadius = '0.375rem';
    closeBtn.style.display = 'flex';
    closeBtn.style.alignItems = 'center';
    closeBtn.style.justifyContent = 'center';
    closeBtn.style.transition = 'background-color 0.2s ease-in-out';
    closeBtn.onmouseover = function () { closeBtn.style.backgroundColor = 'rgba(255,255,255,0.1)'; };
    closeBtn.onmouseout = function () { closeBtn.style.backgroundColor = 'transparent'; };

    var chatCloseBtn = closeBtn;

    headerActions.appendChild(refreshBtn);
    headerActions.appendChild(closeBtn);
    header.appendChild(headerActions);

    var separator = document.createElement('div');
    separator.style.height = '1px';
    separator.style.background = '#e2e8f0';
    separator.style.marginBottom = '1rem';

    chatContainer.appendChild(header);
    chatContainer.appendChild(separator);

    // Chat messages area - Card Content design
    var messages = document.createElement('div');
    messages.style.flex = '1 1 0%';
    messages.style.overflowY = 'auto';
    messages.style.overflowX = 'hidden';
    messages.style.padding = '1rem';
    messages.style.background = '#ffffff';
    messages.id = 'chat-messages';
    messages.style.display = 'flex';
    messages.style.flexDirection = 'column';
    messages.style.gap = '1rem';
    messages.style.scrollBehavior = 'smooth';
    // Hide scrollbar but keep functionality
    messages.style.scrollbarWidth = 'none'; // Firefox
    messages.style.msOverflowStyle = 'none'; // IE and Edge
    // WebKit browsers and additional markdown styling
    var style = document.createElement('style');
    style.textContent = `
        #chat-messages::-webkit-scrollbar { display: none; }
        #simple-chat-embed ul { list-style-type: disc !important; }
        #simple-chat-embed ol { list-style-type: decimal !important; }
        #simple-chat-embed ul li::marker { color: #6b7280; }
        #simple-chat-embed ol li::marker { color: #6b7280; font-weight: 600; }
        #simple-chat-embed pre { white-space: pre-wrap; word-wrap: break-word; }
        #simple-chat-embed code { word-wrap: break-word; }
        #simple-chat-embed blockquote { 
            border-left: 4px solid #e5e7eb; 
            padding-left: 1rem; 
            margin: 1rem 0; 
            color: #6b7280; 
            font-style: italic; 
        }
    `;
    document.head.appendChild(style);

    chatContainer.appendChild(messages);

    // Chat input area - Card Footer design with separator
    var inputSeparator = document.createElement('div');
    inputSeparator.style.height = '1px';
    inputSeparator.style.background = '#e2e8f0';
    inputSeparator.style.marginTop = '1rem';

    var inputContainer = document.createElement('div');
    inputContainer.style.padding = '1rem';
    inputContainer.style.background = '#ffffff';
    inputContainer.style.display = 'flex';
    inputContainer.style.flexDirection = 'column';
    inputContainer.style.borderBottomLeftRadius = '0.75rem';
    inputContainer.style.borderBottomRightRadius = '0.75rem';

    chatContainer.appendChild(inputSeparator);
    chatContainer.appendChild(inputContainer);

    // Create input form container
    var inputForm = document.createElement('div');
    inputForm.style.display = 'grid';
    inputForm.style.gridTemplateColumns = '1fr auto';
    inputForm.style.gap = '1rem';
    inputForm.style.alignItems = 'center';
    inputForm.style.width = '100%';

    // Create the <input> field with modern styling
    var input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Type your message...';
    input.style.padding = '0.75rem 1rem';
    input.style.border = '1px solid #d1d5db';
    input.style.borderRadius = '0.375rem';
    input.style.background = '#ffffff';
    input.style.color = '#374151';
    input.style.fontSize = '0.875rem';
    input.style.lineHeight = '1.25rem';
    input.style.outline = 'none';
    input.style.transition = 'border-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out';

    // Focus and blur states with modern styling
    input.addEventListener('focus', function () {
        input.style.borderColor = '#3b82f6';
        input.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
    });
    input.addEventListener('blur', function () {
        input.style.borderColor = '#d1d5db';
        input.style.boxShadow = 'none';
    });

    // Create the “Send” <button> field
    var sendBtn = document.createElement('button');
    sendBtn.title = 'Send';
    sendBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>';
    sendBtn.style.padding = '0.75rem';
    sendBtn.style.background = theme.sendBtnBg || '#3b82f6';
    sendBtn.style.color = '#ffffff';
    sendBtn.style.border = 'none';
    sendBtn.style.borderRadius = '0.375rem';
    sendBtn.style.cursor = 'pointer';
    sendBtn.style.display = 'flex';
    sendBtn.style.alignItems = 'center';
    sendBtn.style.justifyContent = 'center';
    sendBtn.style.transition = 'background-color 0.2s ease-in-out';

    // Hover state for send button
    sendBtn.addEventListener('mouseover', function () {
        sendBtn.style.backgroundColor = theme.sendBtnHover || '#2563eb';
    });
    sendBtn.addEventListener('mouseout', function () {
        sendBtn.style.backgroundColor = theme.sendBtnBg || '#3b82f6';
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
    imageBtn.onmouseover = function () { imageBtn.style.background = '#ececec'; };
    imageBtn.onmouseout = function () { imageBtn.style.background = 'transparent'; };
    imageBtn.onclick = function () { imageInput.click(); };
    inputContainer.appendChild(imageBtn);
    inputContainer.appendChild(imageInput);

    // Adjust input padding to make space for the icon
    input.style.paddingLeft = '2.5rem';
    // Add left padding to placeholder text for visual alignment
    input.style.setProperty('text-indent', '1.5rem');

    // Handle image selection
    imageInput.addEventListener('change', function (e) {
        var file = imageInput.files[0];
        if (!file) return;
        // Only allow images up to 5MB
        if (file.size > 5 * 1024 * 1024) {
            saveMessage('Image too large (max 5MB).', 'bot');
            loadMessages();
            return;
        }
        var reader = new FileReader();
        reader.onload = function (evt) {
            var dataUrl = evt.target.result;
            // Save image as a user message (base64 data URL)
            saveMessage('[Image]', 'user');
            loadMessages();
            // Send to AI or human agent
            if (isHumanAgentActive && humanSocket && humanSocket.readyState === 1) {
                // Send as base64 or as a special message type (your backend should handle this securely)
                humanSocket.send(JSON.stringify({ type: 'image', data: dataUrl, filename: file.name }));
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

    // Add input and button to form
    inputForm.appendChild(input);
    inputForm.appendChild(sendBtn);

    // Add form to input container
    inputContainer.appendChild(inputForm);
    chatContainer.appendChild(inputContainer);

    // Add chat to body
    document.body.appendChild(chatContainer);

    // Helper function to check if string is image data URL
    function isImageDataUrl(str) {
        return typeof str === 'string' && str.startsWith('data:image/');
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

    // Helper: convert markdown to HTML with proper styling
    function markdownToHtml(text, isStreaming = false) {
        if (!text) return '';
        
        var html = text;
        
        // For streaming, only do basic processing to avoid performance issues
        if (isStreaming) {
            // Only handle basic formatting during streaming
            html = html.replace(/\*\*([^*]+)\*\*/g, '<strong style="font-weight:600;">$1</strong>');
            html = html.replace(/\*([^*]+)\*/g, '<em style="font-style:italic;">$1</em>');
            html = html.replace(/`([^`]+)`/g, '<code style="background:#f6f8fa;border-radius:3px;padding:2px 4px;font-family:ui-monospace,SFMono-Regular,\'SF Mono\',Consolas,\'Liberation Mono\',Menlo,monospace;font-size:85%;">$1</code>');
            html = html.replace(/\n/g, '<br>');
            return html;
        }
        
        // Full markdown processing for completed messages
        // Handle code blocks (```code```)
        html = html.replace(/```([^`]+)```/g, function(match, code) {
            return '<pre style="background:#f6f8fa;border:1px solid #e1e4e8;border-radius:6px;padding:16px;margin:8px 0;overflow-x:auto;font-family:ui-monospace,SFMono-Regular,\'SF Mono\',Consolas,\'Liberation Mono\',Menlo,monospace;font-size:13px;line-height:1.45;"><code>' + escapeHtml(code.trim()) + '</code></pre>';
        });
        
        // Handle inline code (`code`)
        html = html.replace(/`([^`]+)`/g, function(match, code) {
            return '<code style="background:#f6f8fa;border-radius:3px;padding:2px 4px;font-family:ui-monospace,SFMono-Regular,\'SF Mono\',Consolas,\'Liberation Mono\',Menlo,monospace;font-size:85%;">' + escapeHtml(code) + '</code>';
        });
        
        // Handle bold text (**text** or __text__)
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong style="font-weight:600;">$1</strong>');
        html = html.replace(/__([^_]+)__/g, '<strong style="font-weight:600;">$1</strong>');
        
        // Handle italic text (*text* or _text_)
        html = html.replace(/\*([^*]+)\*/g, '<em style="font-style:italic;">$1</em>');
        html = html.replace(/_([^_]+)_/g, '<em style="font-style:italic;">$1</em>');
        
        // Handle markdown links [text](url)
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (_, label, url) {
            return '<a href="' + url + '" target="_blank" style="font-weight:bold;color:' + (theme.botText || '#4a4e69') + ';text-decoration:underline;cursor:pointer;">' + label + '</a>';
        });
        
        // Handle bullet points and numbered lists
        if (html.includes('\n')) {
            // Split into lines for list processing
            var lines = html.split('\n');
            var inUnorderedList = false;
            var inOrderedList = false;
            var processedLines = [];
            
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i];
                var trimmedLine = line.trim();
                
                // Check for blockquotes (> text)
                var blockquoteMatch = trimmedLine.match(/^>\s+(.+)$/);
                if (blockquoteMatch) {
                    // Close any open lists
                    if (inUnorderedList) {
                        processedLines.push('</ul>');
                        inUnorderedList = false;
                    }
                    if (inOrderedList) {
                        processedLines.push('</ol>');
                        inOrderedList = false;
                    }
                    processedLines.push('<blockquote style="border-left:4px solid #e5e7eb;padding-left:1rem;margin:1rem 0;color:#6b7280;font-style:italic;">' + blockquoteMatch[1] + '</blockquote>');
                    continue;
                }
                
                // Check for unordered list items (-, *, +)
                var unorderedMatch = trimmedLine.match(/^[-*+]\s+(.+)$/);
                if (unorderedMatch) {
                    if (!inUnorderedList) {
                        if (inOrderedList) {
                            processedLines.push('</ol>');
                            inOrderedList = false;
                        }
                        processedLines.push('<ul style="margin:8px 0;padding-left:24px;list-style-type:disc;">');
                        inUnorderedList = true;
                    }
                    processedLines.push('<li style="margin:4px 0;">' + unorderedMatch[1] + '</li>');
                    continue;
                }
                
                // Check for ordered list items (1. 2. etc.)
                var orderedMatch = trimmedLine.match(/^(\d+)\.\s+(.+)$/);
                if (orderedMatch) {
                    if (!inOrderedList) {
                        if (inUnorderedList) {
                            processedLines.push('</ul>');
                            inUnorderedList = false;
                        }
                        processedLines.push('<ol style="margin:8px 0;padding-left:24px;">');
                        inOrderedList = true;
                    }
                    processedLines.push('<li style="margin:4px 0;">' + orderedMatch[2] + '</li>');
                    continue;
                }
                
                // Not a list item, close any open lists
                if (inUnorderedList) {
                    processedLines.push('</ul>');
                    inUnorderedList = false;
                }
                if (inOrderedList) {
                    processedLines.push('</ol>');
                    inOrderedList = false;
                }
                
                // Handle headers
                if (trimmedLine.match(/^#{1,6}\s+/)) {
                    var headerMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
                    if (headerMatch) {
                        var level = headerMatch[1].length;
                        var headerText = headerMatch[2];
                        var fontSize = ['1.5em', '1.3em', '1.1em', '1em', '0.9em', '0.8em'][level - 1];
                        processedLines.push('<h' + level + ' style="font-size:' + fontSize + ';font-weight:600;margin:12px 0 8px 0;color:' + (theme.botText || '#4a4e69') + ';">' + headerText + '</h' + level + '>');
                        continue;
                    }
                }
                
                // Regular line
                if (trimmedLine) {
                    processedLines.push(line);
                } else {
                    processedLines.push('<br>');
                }
            }
            
            // Close any remaining open lists
            if (inUnorderedList) {
                processedLines.push('</ul>');
            }
            if (inOrderedList) {
                processedLines.push('</ol>');
            }
            
            html = processedLines.join('\n');
        }
        
        // Handle line breaks
        html = html.replace(/\n/g, '<br>');
        
        return html;
    }
    
    // Helper function to escape HTML
    function escapeHtml(text) {
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Load messages from localStorage
    // Load messages with modern avatar design like ChatWindowComponent
    function loadMessages() {
        var msgs = JSON.parse(localStorage.getItem('simple-chat-messages') || '[]');
        messages.innerHTML = '';

        for (var i = 0; i < msgs.length; i++) {
            var msg = msgs[i];

            // Create message container with flex layout
            var messageContainer = document.createElement('div');
            messageContainer.style.display = 'flex';
            messageContainer.style.flexDirection = 'column';
            messageContainer.style.marginBottom = '1rem';

            // Create avatar and message wrapper
            var messageWrapper = document.createElement('div');
            messageWrapper.style.display = 'flex';
            messageWrapper.style.gap = '0.5rem';

            // Reverse layout for user messages
            if (msg.sender === 'user') {
                messageWrapper.style.flexDirection = 'row-reverse';
                messageWrapper.style.justifyContent = 'flex-start';
            }

            // Create avatar
            var avatar = document.createElement('div');
            avatar.style.width = '40px';
            avatar.style.height = '40px';
            avatar.style.borderRadius = '50%';
            avatar.style.backgroundColor = msg.sender === 'user' ? '#e5e7eb' : '#f3f4f6';
            avatar.style.display = 'flex';
            avatar.style.alignItems = 'center';
            avatar.style.justifyContent = 'center';
            avatar.style.fontSize = '14px';
            avatar.style.fontWeight = '500';
            avatar.style.color = '#6b7280';
            avatar.style.flexShrink = '0';
            avatar.innerText = msg.sender === 'user' ? 'U' : 'A';

            // Create message content container
            var contentContainer = document.createElement('div');
            contentContainer.style.display = 'flex';
            contentContainer.style.flexDirection = 'column';
            contentContainer.style.gap = '0.5rem';
            contentContainer.style.maxWidth = '70%';

            // Create message bubble
            var msgDiv = document.createElement('div');
            msgDiv.style.padding = '0.75rem 1rem';
            msgDiv.style.borderRadius = '0.75rem';
            msgDiv.style.wordBreak = 'break-word';
            msgDiv.style.fontSize = '0.875rem';
            msgDiv.style.lineHeight = '1.25rem';

            if (msg.sender === 'user') {
                msgDiv.style.backgroundColor = theme.userBubble || '#dbeafe';
                msgDiv.style.color = theme.userText || '#1e40af';
                msgDiv.style.alignSelf = 'flex-end';
            } else {
                msgDiv.style.backgroundColor = theme.botBubble || '#f1f5f9';
                msgDiv.style.color = theme.botText || '#475569';
                msgDiv.style.alignSelf = 'flex-start';
            }

            // Handle different message types
            if (msg.text === '' && i === msgs.length - 1) {
                // Empty message - show typing indicator
                msgDiv.appendChild(createBouncingDots());
            } else if (msg.text === '[Image]' && i > 0 && isImageDataUrl(msgs[i - 1].text)) {
                var img = document.createElement('img');
                img.src = msgs[i - 1].text;
                img.style.maxWidth = '200px';
                img.style.maxHeight = '150px';
                img.style.borderRadius = '0.5rem';
                img.style.display = 'block';
                msgDiv.appendChild(img);
            } else {
                // Use markdown conversion for bot messages, check if it's streaming
                var isStreaming = msg.isStreaming === true;
                if (msg.sender === 'bot' || msg.sender === 'ai') {
                    msgDiv.innerHTML = markdownToHtml(msg.text, isStreaming);
                } else {
                    // For user messages, just escape HTML and handle basic formatting
                    msgDiv.innerHTML = escapeHtml(msg.text).replace(/\n/g, '<br>');
                }
            }

            // Create timestamp
            var timestamp = document.createElement('div');
            timestamp.style.fontSize = '0.75rem';
            timestamp.style.color = '#9ca3af';
            timestamp.style.alignSelf = msg.sender === 'user' ? 'flex-end' : 'flex-start';
            var now = new Date();
            timestamp.innerText = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

            // Assemble the message
            contentContainer.appendChild(msgDiv);
            contentContainer.appendChild(timestamp);
            messageWrapper.appendChild(avatar);
            messageWrapper.appendChild(contentContainer);
            messageContainer.appendChild(messageWrapper);
            messages.appendChild(messageContainer);
        }

        messages.scrollTop = messages.scrollHeight;
    }

    // Save message to localStorage
    function saveMessage(msg, sender, type = "") {
        var msgs = JSON.parse(localStorage.getItem('simple-chat-messages') || '[]');
        if (type === "welcomeMessage") {
            const getWelcomeMessageInd = msgs.findIndex(m => m.isWelcomeMessage)
            if (getWelcomeMessageInd !== -1) msgs[getWelcomeMessageInd].text = msg
            else msgs.push({ text: msg, isWelcomeMessage: true, sender: sender });

        }
        else {
            msgs.push({ text: msg, isWelcomeMessage: false, sender: sender });
        }
        localStorage.setItem('simple-chat-messages', JSON.stringify(msgs));
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
        humanSocket.onopen = function () {
            // Optionally notify the backend of the chat history or user info here
            // humanSocket.send(JSON.stringify({type: 'init', history: ...}));
        };
        humanSocket.onmessage = function (event) {
            // Expect messages from the agent as plain text or JSON
            var data = event.data;
            try {
                var parsed = JSON.parse(data);
                if (parsed.text) data = parsed.text;
            } catch (e) { }
            saveMessage(data, 'bot');
            loadMessages();
        };
        humanSocket.onclose = function () {
            // Optionally notify the user
            saveMessage('The human agent has left the chat.', 'bot');
            loadMessages();
            isHumanAgentActive = false;
            humanSocket = null;
        };
        humanSocket.onerror = function (err) {
            saveMessage('Connection error with human agent.', 'bot');
            loadMessages();
        };
    }

    // --- WebSocket connection management ---
    async function connectWebSocket() {
        if (isWebSocketConnected || currentSocket) return;
        var chatID = generateChatId();
        var workflow_id = workflowId;
        var wsParams = await generateSecureWsParams(workflow_id);
        var wsUrl = socketUrl + chatID + '/?workflow_id=' + wsParams.hashed_workflow_id + '&hash=' + wsParams.hash;
        try {
            currentSocket = new WebSocket(wsUrl);
            currentSocket.onopen = function () {
                isWebSocketConnected = true;
            };
            currentSocket.onmessage = function (event) {
                var msgData = JSON.parse(event.data);
                
                // Skip unread messages but allow broadcast messages
                if (msgData?.message_type === "unread_message") {
                    return;
                }
                
                // Handle AI/bot messages (both streaming and regular)
                if (msgData.sender_type === 'ai' || msgData.sender === 'ai' || msgData.sender_type === 'bot' || msgData.sender === 'bot') {
                    var msgs = JSON.parse(localStorage.getItem('simple-chat-messages') || '[]');
                    var lastMessage = msgs[msgs.length - 1];
                    
                    // Remove typing indicator if present
                    if (lastMessage && lastMessage.text === '' && (lastMessage.sender === 'bot' || lastMessage.sender === 'ai')) {
                        msgs.pop();
                        lastMessage = msgs[msgs.length - 1] || null;
                    }
                    
                    var content = msgData.content || msgData.message || '';
                    
                    // Handle completion signal (empty content with is_complete flag)
                    if (msgData.is_complete === true && content === '') {
                        if (lastMessage && lastMessage.isStreaming) {
                            lastMessage.isStreaming = false;
                            msgs[msgs.length - 1] = lastMessage;
                            localStorage.setItem('simple-chat-messages', JSON.stringify(msgs));
                            loadMessages(); // Use immediate loading for completion
                        }
                        return;
                    }
                    
                    // Handle any content from AI (treat all as streaming chunks)
                    if (content) {
                        // Check if we should append to existing message or create new one
                        if (lastMessage && 
                            (lastMessage.sender === 'bot' || lastMessage.sender === 'ai') && 
                            lastMessage.isStreaming === true) {
                            // Append to existing streaming message
                            lastMessage.text += content;
                            msgs[msgs.length - 1] = lastMessage;
                        } else {
                            // Create new streaming message
                            msgs.push({
                                text: content,
                                sender: 'bot',
                                isWelcomeMessage: false,
                                isStreaming: true,
                                messageId: msgData.message_id
                            });
                        }
                        localStorage.setItem('simple-chat-messages', JSON.stringify(msgs));
                        loadMessages(); // Use immediate loading for streaming
                    }
                } else if (msgData.sender_type === "sales_rep" || msgData.sender === "sales_rep") {
                    var msgs = JSON.parse(localStorage.getItem('simple-chat-messages') || '[]');
                    msgs.push({
                        text: msgData.content || '',
                        sender: msgData.sender_type,
                        isWelcomeMessage: false
                    })
                    localStorage.setItem('simple-chat-messages', JSON.stringify(msgs));
                    loadMessages();
                }
            };
            currentSocket.onclose = function () {
                console.error('WebSocket connection closed unexpectedly...');
                isWebSocketConnected = false;
                currentSocket = null;
            };
            currentSocket.onerror = function (error) {
                console.error('WebSocket error:', error);
                isWebSocketConnected = false;
                currentSocket = null;
            };
        } catch (error) {
            console.error('Failed to create WebSocket connection:', error);
            isWebSocketConnected = false;
            currentSocket = null;
        }
    }

    // --- Message sending logic update ---
    // This function now uses WebSocket instead of API calls
    function sendMessage() {
        var val = input.value.trim();
        if (!val) return;
        // Save user message immediately
        saveMessage(val, 'user');
        input.value = '';
        loadMessages();
        
        // Show typing indicator
        saveMessage('', 'bot');
        loadMessages();
        
        // Check for human agent handover first
        if (isHumanAgentActive && humanSocket && humanSocket.readyState === 1) {
            humanSocket.send(val);
            return;
        }
        // Ensure WebSocket connection is established
        if (!isWebSocketConnected || !currentSocket || currentSocket.readyState !== WebSocket.OPEN) {
            connectWebSocket();
            // Wait for connection and then send message
            var checkConnection = function () {
                if (currentSocket && currentSocket.readyState === WebSocket.OPEN) {
                    currentSocket.send(JSON.stringify({
                        'message': val,
                        'message_type': "text"
                    }));
                } else if (currentSocket && currentSocket.readyState === WebSocket.CONNECTING) {
                    // Still connecting, wait a bit more
                    setTimeout(checkConnection, 100);
                } else {
                    // Connection failed - remove typing indicator and show error
                    var msgs = JSON.parse(localStorage.getItem('simple-chat-messages') || '[]');
                    if (msgs.length > 0 && msgs[msgs.length - 1].text === '') {
                        msgs.pop(); // Remove typing indicator
                    }
                    msgs.push({
                        text: 'Error: Could not connect to chat service.',
                        sender: 'bot',
                        isWelcomeMessage: false
                    });
                    localStorage.setItem('simple-chat-messages', JSON.stringify(msgs));
                    loadMessages();
                }
            };
            // Give some time for connection to establish
            setTimeout(checkConnection, 500);
        } else {
            // Connection is ready, send message immediately
            try {
                currentSocket.send(JSON.stringify({
                    'message': val,
                    'message_type': "text"
                }));
            } catch (error) {
                console.error('Error sending message:', error);
                // Remove typing indicator and show error
                var msgs = JSON.parse(localStorage.getItem('simple-chat-messages') || '[]');
                if (msgs.length > 0 && msgs[msgs.length - 1].text === '') {
                    msgs.pop(); // Remove typing indicator
                }
                msgs.push({
                    text: 'Error sending message. Please try again.',
                    sender: 'bot',
                    isWelcomeMessage: false
                });
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

    // Lead capture form with ChatWindowComponent styling
    function showLeadCaptureInChat(onComplete) {
        messages.innerHTML = '';

        // Create main container matching ChatWindowComponent layout
        var wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.flexDirection = 'column';
        wrapper.style.alignItems = 'center';
        wrapper.style.justifyContent = 'center';
        wrapper.style.height = '100%';
        wrapper.style.width = '100%';
        // wrapper.style.padding = '2rem';
        wrapper.style.gap = '1.5rem';

        // Form fields container
        var formContainer = document.createElement('div');
        formContainer.style.width = '100%';
        formContainer.style.maxWidth = '300px';
        formContainer.style.display = 'flex';
        formContainer.style.flexDirection = 'column';
        formContainer.style.gap = '1.5rem';

        // Full Name field
        var nameFieldContainer = document.createElement('div');
        nameFieldContainer.style.display = 'flex';
        nameFieldContainer.style.alignItems = 'center';
        nameFieldContainer.style.gap = '1.5rem';

        var nameLabel = document.createElement('label');
        nameLabel.innerText = 'Full Name:';
        nameLabel.style.width = '27%';
        nameLabel.style.fontSize = '0.875rem';
        nameLabel.style.fontWeight = '500';
        nameLabel.style.color = '#374151';

        var nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.placeholder = 'Full name';
        nameInput.style.width = '60%';
        nameInput.style.padding = '0.75rem 1rem';
        nameInput.style.border = '1px solid #d1d5db';
        nameInput.style.borderRadius = '0.375rem';
        nameInput.style.fontSize = '0.875rem';
        nameInput.style.outline = 'none';
        nameInput.style.transition = 'border-color 0.2s ease-in-out';

        nameInput.addEventListener('focus', function () {
            nameInput.style.borderColor = '#3b82f6';
        });
        nameInput.addEventListener('blur', function () {
            nameInput.style.borderColor = '#d1d5db';
        });

        nameFieldContainer.appendChild(nameLabel);
        nameFieldContainer.appendChild(nameInput);

        // Email field
        var emailFieldContainer = document.createElement('div');
        emailFieldContainer.style.display = 'flex';
        emailFieldContainer.style.alignItems = 'center';
        emailFieldContainer.style.gap = '1.5rem';

        var emailLabel = document.createElement('label');
        emailLabel.innerText = 'Email:';
        emailLabel.style.width = '27%';
        emailLabel.style.fontSize = '0.875rem';
        emailLabel.style.fontWeight = '500';
        emailLabel.style.color = '#374151';

        var emailInput = document.createElement('input');
        emailInput.type = 'email';
        emailInput.placeholder = 'Email';
        emailInput.style.width = '60%';
        emailInput.style.padding = '0.75rem 1rem';
        emailInput.style.border = '1px solid #d1d5db';
        emailInput.style.borderRadius = '0.375rem';
        emailInput.style.fontSize = '0.875rem';
        emailInput.style.outline = 'none';
        emailInput.style.transition = 'border-color 0.2s ease-in-out';

        emailInput.addEventListener('focus', function () {
            emailInput.style.borderColor = '#3b82f6';
        });
        emailInput.addEventListener('blur', function () {
            emailInput.style.borderColor = '#d1d5db';
        });

        emailFieldContainer.appendChild(emailLabel);
        emailFieldContainer.appendChild(emailInput);

        // Phone field (optional)
        var phoneFieldContainer = document.createElement('div');
        phoneFieldContainer.style.display = 'flex';
        phoneFieldContainer.style.alignItems = 'center';
        phoneFieldContainer.style.gap = '1.5rem';

        var phoneLabel = document.createElement('label');
        phoneLabel.innerText = 'Phone:';
        phoneLabel.style.width = '27%';
        phoneLabel.style.fontSize = '0.875rem';
        phoneLabel.style.fontWeight = '500';
        phoneLabel.style.color = '#374151';

        var phoneInput = document.createElement('input');
        phoneInput.type = 'tel';
        phoneInput.placeholder = 'Phone';
        phoneInput.style.width = '60%';
        phoneInput.style.padding = '0.75rem 1rem';
        phoneInput.style.border = '1px solid #d1d5db';
        phoneInput.style.borderRadius = '0.375rem';
        phoneInput.style.fontSize = '0.875rem';
        phoneInput.style.outline = 'none';
        phoneInput.style.transition = 'border-color 0.2s ease-in-out';

        phoneInput.addEventListener('focus', function () {
            phoneInput.style.borderColor = '#3b82f6';
        });
        phoneInput.addEventListener('blur', function () {
            phoneInput.style.borderColor = '#d1d5db';
        });

        phoneFieldContainer.appendChild(phoneLabel);
        phoneFieldContainer.appendChild(phoneInput);

        // Add all fields to form container
        formContainer.appendChild(nameFieldContainer);
        formContainer.appendChild(emailFieldContainer);
        formContainer.appendChild(phoneFieldContainer);

        // Error message
        var emailError = document.createElement('div');
        emailError.style.display = 'none';
        emailError.style.color = '#ef4444';
        emailError.style.fontSize = '0.875rem';
        emailError.style.textAlign = 'center';
        emailError.innerText = 'Please enter a valid email address';

        // Start Chat button
        var confirmBtn = document.createElement('button');
        confirmBtn.innerText = 'Start Chat';
        confirmBtn.style.width = '100%';
        confirmBtn.style.maxWidth = '300px';
        confirmBtn.style.padding = '0.75rem 1.5rem';
        confirmBtn.style.background = theme.sendBtnBg || '#16a34a';
        confirmBtn.style.color = '#ffffff';
        confirmBtn.style.border = 'none';
        confirmBtn.style.borderRadius = '0.375rem';
        confirmBtn.style.cursor = 'pointer';
        confirmBtn.style.fontWeight = '600';
        confirmBtn.style.fontSize = '0.875rem';
        confirmBtn.style.transition = 'background-color 0.2s ease-in-out';

        confirmBtn.addEventListener('mouseover', function () {
            confirmBtn.style.backgroundColor = theme.sendBtnHover || '#15803d';
        });
        confirmBtn.addEventListener('mouseout', function () {
            confirmBtn.style.backgroundColor = theme.sendBtnBg || '#16a34a';
        });

        // Confirmation button click handler
        confirmBtn.onclick = function () {
            var emailVal = emailInput.value.trim();
            if (emailVal && !/^\S+@\S+\.\S+$/.test(emailVal)) {
                emailInput.style.borderColor = '#ef4444';
                emailError.style.display = 'block';
                emailInput.focus();
                return;
            } else {
                emailInput.style.borderColor = '#d1d5db';
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
                .then(function (res) { return res.json(); })
                .then(function (ipData) {
                    var ip = ipData.ip || '';

                    // Generate a GUID for the user (if not already present)
                    var guid = localStorage.getItem('simple-chat-user-guid');
                    if (!guid) {
                        guid = ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
                            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
                        );
                        localStorage.setItem('simple-chat-user-guid', guid);
                    }

                    var leadData = {
                        name: sanitize(nameInput.value),
                        email: sanitize(emailInput.value),
                        phone: sanitize(phoneInput.value),
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

                    onComplete(leadData);
                })
                .catch(function () {
                    // Fallback if IP fetch fails
                    var leadData = {
                        name: sanitize(nameInput.value),
                        email: sanitize(emailInput.value),
                        phone: sanitize(phoneInput.value),
                        timestamp: new Date().toISOString(),
                        userAgent: navigator.userAgent,
                        platform: navigator.platform,
                        url: window.location.href,
                        language: navigator.language,
                        referrer: document.referrer,
                        guid: localStorage.getItem('simple-chat-user-guid') || 'unknown',
                        ip: ''
                    };

                    var leads = JSON.parse(localStorage.getItem('simple-chat-leads') || '[]');
                    leads.push(leadData);
                    localStorage.setItem('simple-chat-leads', JSON.stringify(leads));
                    onComplete(leadData);
                });
        };

        // Allow pressing Enter to submit the form
        nameInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') confirmBtn.click();
        });
        emailInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') confirmBtn.click();
        });
        phoneInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') confirmBtn.click();
        });

        // Assemble the form
        wrapper.appendChild(formContainer);
        wrapper.appendChild(emailError);
        wrapper.appendChild(confirmBtn);
        messages.appendChild(wrapper);

        // Focus the first field
        nameInput.focus();
    }

    // On load, show lead capture inside chat window
    function maybeShowLeadCapture() {
        if (!window.__simpleChatEmbedLeadCaptured) {
            inputContainer.style.display = 'none';
            showLeadCaptureInChat(function (lead) {
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

                // Show welcome message if set and no previous messages
                var msgs = JSON.parse(localStorage.getItem('simple-chat-messages') || '[]');
                if (welcomeMessage) {
                    saveMessage(welcomeMessage, 'bot', 'welcomeMessage');
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

            loadMessages();
        }
    }

    // Sanitize input to prevent XSS
    function sanitize(str) {
        return String(str).replace(/[&<>"']/g, function (c) {
            return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]);
        });
    }

    // Create chat toggle button
    var chatToggle = document.createElement('button');
    chatToggle.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-circle-icon lucide-message-circle"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>';
    chatToggle.style.position = 'fixed';
    chatToggle.style.bottom = '20px';
    chatToggle.style.right = '20px';
    chatToggle.style.width = '80px';
    chatToggle.style.height = '80px';
    chatToggle.style.borderRadius = '50%';
    chatToggle.style.backgroundColor = theme.sendBtnBg || '#16a34a';
    chatToggle.style.color = '#ffffff';
    chatToggle.style.border = 'none';
    chatToggle.style.cursor = 'pointer';
    chatToggle.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    chatToggle.style.display = 'flex';
    chatToggle.style.alignItems = 'center';
    chatToggle.style.justifyContent = 'center';
    chatToggle.style.transition = 'all 0.3s ease';
    chatToggle.style.zIndex = theme.zIndex - 1;

    // Responsive positioning for mobile
    function setToggleResponsive() {
        if (window.innerWidth < 768) {
            chatToggle.style.bottom = '20px';
            chatToggle.style.right = '20px';
        } else {
            chatToggle.style.bottom = '20px';
            chatToggle.style.right = '20px';
        }
    }
    setToggleResponsive();
    window.addEventListener('resize', setToggleResponsive);

    // Initially hide the chat container
    chatContainer.style.display = 'none';

    // Toggle functionality
    var chatOpen = false;
    chatToggle.addEventListener('click', function () {
        chatOpen = !chatOpen;
        if (chatOpen) {
            chatContainer.style.display = 'flex';
            chatToggle.style.display = 'none';
        } else {
            chatContainer.style.display = 'none';
            chatToggle.style.display = 'flex';
        }
    });

    // Close button functionality from header
    chatCloseBtn.onclick = function () {
        chatOpen = false;
        chatContainer.style.display = 'none';
        chatToggle.style.display = 'flex';
    };

    // Add both toggle button and chat container to body
    document.body.appendChild(chatToggle);

    // Expose functions globally for testing
    window.saveMessage = saveMessage;
    window.loadMessages = loadMessages;
    window.generateChatId = generateChatId;
    window.generateSecureWsParams = generateSecureWsParams;
    window.connectWebSocket = connectWebSocket;

    // Initial load
    maybeShowLeadCapture();
})();
