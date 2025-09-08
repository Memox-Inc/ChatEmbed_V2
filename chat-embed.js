
(function () {
    // Load marked.js library
    if (typeof marked === 'undefined') {
        var script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/marked/lib/marked.umd.js';
        script.onload = function() {
            console.log('Marked.js library loaded');
            initializeChatEmbed();
        };
        script.onerror = function() {
            console.warn('Failed to load marked.js from CDN, initializing without it');
            initializeChatEmbed();
        };
        document.head.appendChild(script);
        return;
    } else {
        initializeChatEmbed();
    }

function initializeChatEmbed() {
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
            shadow: '0 2px 8px rgba(0,0,0,0.15)',
            salesRepBubble: '#f1f5f9',
            salesRepText: '#475569',
            salesRepAvatar: '#E4E7FC',
            userAvatar: '#8349ff',
            botAvatar: '#E4E7FC',
            handoverNotificationBg: '#E4E7FC',
            handoverNotificationText: '#334155',
            handoverNotificationBorder: '#8349FF'
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
    var visitorInfo = null;
    var isHandoverActive = false;
    var isFormShowing = false;

    // Function to update button states based on form visibility
    function updateButtonStates() {
        if (isFormShowing) {
            // Disable appearance when form is showing
            refreshBtn.style.opacity = '0.5';
            refreshBtn.style.cursor = 'not-allowed';
            clearSessionBtn.style.opacity = '0.5';
            clearSessionBtn.style.cursor = 'not-allowed';
        } else {
            // Enable appearance when form is not showing
            refreshBtn.style.opacity = '1';
            refreshBtn.style.cursor = 'pointer';
            clearSessionBtn.style.opacity = '1';
            clearSessionBtn.style.cursor = 'pointer';
        }
    }

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
    headerActions.style.gap = '0.25rem';

    var refreshBtn = document.createElement('button');
    refreshBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="m21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>';
    refreshBtn.title = 'Clear chat history';
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
    refreshBtn.onmouseover = function () { 
        if (!isFormShowing) {
            refreshBtn.style.backgroundColor = 'rgba(255,255,255,0.1)'; 
        }
    };
    refreshBtn.onmouseout = function () { 
        refreshBtn.style.backgroundColor = 'transparent'; 
    };
    refreshBtn.onclick = function () {
        // Don't allow reset when form is showing
        if (isFormShowing) {
            return;
        }
        
        var msgs = JSON.parse(localStorage.getItem('simple-chat-messages') || '[]');
        var wasHandoverActive = msgs.some(function (msg) {
            return msg.isSystemNotification && msg.notificationType === 'joined';
        });

        var storedSession = localStorage.getItem('simple-chat-session');
        var sessionHandoverActive = false;
        if (storedSession) {
            try {
                var sessionData = JSON.parse(storedSession);
                sessionHandoverActive = sessionData.handoverOccurred === true;
            } catch (error) {
                console.log('Error reading session handover flag:', error);
            }
        }

        localStorage.removeItem('simple-chat-messages');

        if (!wasHandoverActive && !sessionHandoverActive) {
            isHandoverActive = false;
        } else {
            isHandoverActive = true;
        }


        setupChatInput();
        if (welcomeMessage) {
            saveMessage(welcomeMessage, 'bot', 'welcomeMessage');
        }
        loadMessages();
    };

    // Create Clear Session button
    var clearSessionBtn = document.createElement('button');
    clearSessionBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>';
    clearSessionBtn.title = 'Clear session & restart';
    clearSessionBtn.style.background = 'transparent';
    clearSessionBtn.style.color = theme.headerText;
    clearSessionBtn.style.border = 'none';
    clearSessionBtn.style.padding = '0.5rem';
    clearSessionBtn.style.cursor = 'pointer';
    clearSessionBtn.style.borderRadius = '0.375rem';
    clearSessionBtn.style.display = 'flex';
    clearSessionBtn.style.alignItems = 'center';
    clearSessionBtn.style.justifyContent = 'center';
    clearSessionBtn.style.transition = 'background-color 0.2s ease-in-out';
    clearSessionBtn.onmouseover = function () { 
        if (!isFormShowing) {
            clearSessionBtn.style.backgroundColor = 'rgba(255,255,255,0.1)'; 
        }
    };
    clearSessionBtn.onmouseout = function () { 
        clearSessionBtn.style.backgroundColor = 'transparent'; 
    };
    clearSessionBtn.onclick = function () {
        // Don't allow session clear when form is showing
        if (isFormShowing) {
            return;
        }
        
        // Clear all chat data
        localStorage.removeItem('simple-chat-messages');
        localStorage.removeItem('simple-chat-session');
        localStorage.removeItem('simple-chat-leads');
        localStorage.removeItem('simple-chat-user-guid');
        
        // Reset all flags
        isHandoverActive = false;
        isFormShowing = false;
        window.__simpleChatEmbedLeadCaptured = false;
        visitorInfo = null;
        
        // Close WebSocket connection
        if (currentSocket) {
            currentSocket.close();
            currentSocket = null;
            isWebSocketConnected = false;
        }
        
        // Show lead capture form again
        inputContainer.style.display = 'none';
        showLeadCaptureInChat(function (lead) {
            isFormShowing = false;
            updateButtonStates(); // Update button appearance
            window.__simpleChatEmbedLeadCaptured = true;
            if (lead) {
                window.SimpleChatEmbedLead = lead;
            }
            setupChatInput();

            // Show welcome message if set
            if (welcomeMessage) {
                saveMessage(welcomeMessage, 'bot', 'welcomeMessage');
            }
            loadMessages();
        });
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
    headerActions.appendChild(clearSessionBtn);
    headerActions.appendChild(closeBtn);
    header.appendChild(headerActions);

    var separator = document.createElement('div');
    separator.style.height = '1px';
    separator.style.background = '#e2e8f0';
    separator.style.marginBottom = '1rem';

    chatContainer.appendChild(header);
    chatContainer.appendChild(separator);

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
    messages.style.scrollbarWidth = 'none';
    messages.style.msOverflowStyle = 'none';
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

    var scrollToBottomBtn = document.createElement('button');
    scrollToBottomBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 13 5 5 5-5"/><path d="M12 18V6"/></svg>';
    scrollToBottomBtn.title = 'Scroll to bottom';
    scrollToBottomBtn.style.position = 'absolute';
    scrollToBottomBtn.style.right = '1rem';
    scrollToBottomBtn.style.bottom = '5rem';
    scrollToBottomBtn.style.width = '40px';
    scrollToBottomBtn.style.height = '40px';
    scrollToBottomBtn.style.borderRadius = '50%';
    scrollToBottomBtn.style.background = theme.sendBtnBg || '#3b82f6';
    scrollToBottomBtn.style.color = '#ffffff';
    scrollToBottomBtn.style.border = 'none';
    scrollToBottomBtn.style.cursor = 'pointer';
    scrollToBottomBtn.style.display = 'none';
    scrollToBottomBtn.style.alignItems = 'center';
    scrollToBottomBtn.style.justifyContent = 'center';
    scrollToBottomBtn.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    scrollToBottomBtn.style.transition = 'all 0.3s ease';
    scrollToBottomBtn.style.zIndex = '10';

    scrollToBottomBtn.addEventListener('mouseover', function () {
        scrollToBottomBtn.style.backgroundColor = theme.sendBtnHover || '#2563eb';
        scrollToBottomBtn.style.transform = 'scale(1.1)';
    });
    scrollToBottomBtn.addEventListener('mouseout', function () {
        scrollToBottomBtn.style.backgroundColor = theme.sendBtnBg || '#3b82f6';
        scrollToBottomBtn.style.transform = 'scale(1)';
    });

    scrollToBottomBtn.onclick = function () {
        messages.scrollTop = messages.scrollHeight;
        scrollToBottomBtn.style.display = 'none';
    };

    chatContainer.appendChild(scrollToBottomBtn);

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

    // Quick question buttons container
    var quickButtonsContainer = document.createElement('div');
    quickButtonsContainer.style.display = 'none'; // Initially hidden, shown when input is active
    quickButtonsContainer.style.flexDirection = 'column';
    quickButtonsContainer.style.gap = '0.5rem';
    quickButtonsContainer.style.marginBottom = '1rem';
    quickButtonsContainer.style.width = '100%';

    // Create quick question buttons if configured
    if (config.quickQuestions && config.quickQuestions.length > 0) {
        config.quickQuestions.forEach(function(question, index) {
            var quickBtn = document.createElement('button');
            quickBtn.innerText = question;
            quickBtn.style.padding = '0.75rem 1rem';
            quickBtn.style.background = '#f3f4f6';
            quickBtn.style.color = '#374151';
            quickBtn.style.border = '1px solid #d1d5db';
            quickBtn.style.borderRadius = '0.5rem';
            quickBtn.style.cursor = 'pointer';
            quickBtn.style.fontSize = '0.875rem';
            quickBtn.style.transition = 'all 0.2s ease-in-out';
            quickBtn.style.width = '100%';
            quickBtn.style.textAlign = 'left';
            quickBtn.style.boxSizing = 'border-box';

            quickBtn.addEventListener('mouseover', function() {
                quickBtn.style.background = theme.sendBtnBg || '#3b82f6';
                quickBtn.style.color = '#ffffff';
                quickBtn.style.borderColor = theme.sendBtnBg || '#3b82f6';
            });

            quickBtn.addEventListener('mouseout', function() {
                quickBtn.style.background = '#f3f4f6';
                quickBtn.style.color = '#374151';
                quickBtn.style.borderColor = '#d1d5db';
            });

            quickBtn.addEventListener('click', function() {
                input.value = question;
                sendMessage();
                // Hide quick buttons after first use if not permanent
                if (!config.quickQuestionsPermanent) {
                    quickButtonsContainer.style.display = 'none';
                }
            });

            quickButtonsContainer.appendChild(quickBtn);
        });
    }

    inputContainer.appendChild(quickButtonsContainer);

    chatContainer.appendChild(inputSeparator);
    chatContainer.appendChild(inputContainer);

    var inputForm = document.createElement('div');
    inputForm.style.display = 'grid';
    inputForm.style.gridTemplateColumns = '1fr auto';
    inputForm.style.gap = '1rem';
    inputForm.style.alignItems = 'center';
    inputForm.style.width = '100%';

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

    sendBtn.addEventListener('mouseover', function () {
        sendBtn.style.backgroundColor = theme.sendBtnHover || '#2563eb';
    });
    sendBtn.addEventListener('mouseout', function () {
        sendBtn.style.backgroundColor = theme.sendBtnBg || '#3b82f6';
    });

    inputForm.appendChild(input);
    inputForm.appendChild(sendBtn);

    inputContainer.appendChild(inputForm);
    chatContainer.appendChild(inputContainer);

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

    // Helper: convert markdown to HTML using marked.js library
    function markdownToHtml(text, isStreaming = false) {
        if (!text) return '';

        // Always use marked.js for consistent processing, whether streaming or not
        try {
            // Check if marked is available
            if (typeof marked === 'undefined') {
                throw new Error('marked.js not available');
            }
            
            // Use marked with minimal configuration first to test
            var result = marked.parse(text, {
                breaks: true, // Convert single line breaks to <br>
                gfm: true // GitHub flavored markdown
            });
            
            // Post-process to add our custom styles to links
            if (typeof result === 'string') {
                // Add custom styling to links
                result = result.replace(/<a\s+href="([^"]*)"([^>]*)>([^<]*)<\/a>/g, function(match, href, attrs, text) {
                    return '<a href="' + href + '" target="_blank" style="font-weight:bold;color:' + (theme.botText || '#4a4e69') + ';text-decoration:underline;cursor:pointer;">' + text + '</a>';
                });
                
                // Add custom styling to lists
                result = result.replace(/<ul>/g, '<ul style="margin:8px 0;padding-left:24px;">');
                result = result.replace(/<ol>/g, '<ol style="margin:8px 0;padding-left:24px;">');
                result = result.replace(/<li>/g, '<li style="margin:4px 0;">');
                
                // Add custom styling to code blocks
                result = result.replace(/<pre><code>/g, '<pre style="background:#f6f8fa;border:1px solid #e1e4e8;border-radius:6px;padding:16px;margin:8px 0;overflow-x:auto;font-family:ui-monospace,SFMono-Regular,\'SF Mono\',Consolas,\'Liberation Mono\',Menlo,monospace;font-size:13px;line-height:1.45;"><code>');
                result = result.replace(/<code>/g, '<code style="background:#f6f8fa;border-radius:3px;padding:2px 4px;font-family:ui-monospace,SFMono-Regular,\'SF Mono\',Consolas,\'Liberation Mono\',Menlo,monospace;font-size:85%;">');
                
                // Add custom styling to strong/em
                result = result.replace(/<strong>/g, '<strong style="font-weight:600;">');
                result = result.replace(/<em>/g, '<em style="font-style:italic;">');
                
                return result;
            }
            
            return String(result);
            
        } catch (error) {
            console.error('Markdown parsing error:', error);
            // Fallback to escaped text with line breaks
            return escapeHtml(text).replace(/\n/g, '<br>');
        }
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

        // Check if handover has already occurred by looking for handover messages
        var hasHandoverMessage = msgs.some(function (msg) {
            return msg.isSystemNotification && msg.notificationType === 'joined';
        });

        // Set handover flag if handover message exists in chat history
        if (hasHandoverMessage) {
            isHandoverActive = true;
        }

        for (var i = 0; i < msgs.length; i++) {
            var msg = msgs[i];

            // Handle system notifications (like handover messages) differently
            if (msg.isSystemNotification) {
                var notificationContainer = document.createElement('div');
                notificationContainer.style.display = 'flex';
                notificationContainer.style.justifyContent = 'center';
                notificationContainer.style.margin = '1rem 0';
                notificationContainer.style.animation = 'fadeInUp 0.5s ease-out';

                var notification = document.createElement('div');
                notification.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                notification.style.color = '#ffffff';
                notification.style.padding = '0.75rem 1.5rem';
                notification.style.borderRadius = '20px';
                notification.style.fontSize = '0.875rem';
                notification.style.fontWeight = '500';
                notification.style.display = 'flex';
                notification.style.alignItems = 'center';
                notification.style.gap = '0.5rem';
                notification.style.maxWidth = '80%';
                notification.style.textAlign = 'center';

                // Add icon based on notification type
                var icon = document.createElement('span');
                if (msg.notificationType === 'joined') {
                    icon.innerHTML = '👋';
                    notification.style.background = theme.handoverNotificationBg || '#E4E7FC';
                    notification.style.color = theme.handoverNotificationText || '#334155';
                    notification.style.border = '1px solid ' + (theme.handoverNotificationBorder || '#8349FF');
                } else {
                    icon.innerHTML = '💬';
                }
                icon.style.fontSize = '1rem';

                notification.appendChild(icon);
                notification.appendChild(document.createTextNode(msg.text));
                notificationContainer.appendChild(notification);

                // Add fade-in animation if not already present
                if (!document.getElementById('system-notification-style')) {
                    var style = document.createElement('style');
                    style.id = 'system-notification-style';
                    style.innerHTML = `
                        @keyframes fadeInUp {
                            0% { opacity: 0; transform: translateY(20px); }
                            100% { opacity: 1; transform: translateY(0); }
                        }
                    `;
                    document.head.appendChild(style);
                }

                messages.appendChild(notificationContainer);
                continue;
            }

            // Create message container with flex layout
            var messageContainer = document.createElement('div');
            messageContainer.style.display = 'flex';
            messageContainer.style.flexDirection = 'column';
            messageContainer.style.marginBottom = '1rem';

            // Create avatar and message wrapper
            var messageWrapper = document.createElement('div');
            messageWrapper.style.display = 'flex';
            messageWrapper.style.gap = '0.5rem';

            // Reverse layout for user messages only (bot and sales_rep start from left)
            if (msg.sender === 'user') {
                messageWrapper.style.flexDirection = 'row-reverse';
                messageWrapper.style.justifyContent = 'flex-start';
            }

            // Create avatar for user, sales_rep, and bot messages
            var avatar = null;
            if (msg.sender === 'user') {
                avatar = document.createElement('div');
                avatar.style.width = '40px';
                avatar.style.height = '40px';
                avatar.style.borderRadius = '50%';
                avatar.style.display = 'flex';
                avatar.style.alignItems = 'center';
                avatar.style.justifyContent = 'center';
                avatar.style.background = theme.userAvatar || '#8349ff';

                // Load user SVG from assets
                var userSvg = document.createElement('div');
                userSvg.innerHTML = `
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M19 21V19C19 17.9391 18.5786 16.9217 17.8284 16.1716C17.0783 15.4214 16.0609 15 15 15H9C7.93913 15 6.92172 15.4214 6.17157 16.1716C5.42143 16.9217 5 17.9391 5 19V21" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                `;
                avatar.appendChild(userSvg);
            } else if (msg.sender === 'sales_rep') {
                avatar = document.createElement('div');
                avatar.style.width = '40px';
                avatar.style.height = '40px';
                avatar.style.borderRadius = '50%';
                avatar.style.display = 'flex';
                avatar.style.alignItems = 'center';
                avatar.style.justifyContent = 'center';
                avatar.style.background = theme.salesRepAvatar || '#E4E7FC';
                var iconColor = theme.primary || '#8349FF';
                avatar.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" style="width:26px;height:26px;color:' + iconColor + ';" width="200" height="200" viewBox="0 0 24 24"><path fill="currentColor" d="M19.938 8H21a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-1.062A8.001 8.001 0 0 1 12 23v-2a6 6 0 0 0 6-6V9A6 6 0 0 0 6 9v7H3a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h1.062a8.001 8.001 0 0 1 15.876 0ZM3 10v4h1v-4H3Zm17 0v4h1v-4h-1ZM7.76 15.785l1.06-1.696A5.972 5.972 0 0 0 12 15a5.972 5.972 0 0 0 3.18-.911l1.06 1.696A7.963 7.963 0 0 1 12 17a7.962 7.962 0 0 1-4.24-1.215Z"/></svg>'; // Sales rep icon
            } else if (msg.sender === 'bot' || msg.sender === 'ai') {
                avatar = document.createElement('div');
                avatar.style.width = '40px';
                avatar.style.height = '40px';
                avatar.style.borderRadius = '50%';
                avatar.style.display = 'flex';
                avatar.style.alignItems = 'center';
                avatar.style.justifyContent = 'center';
                avatar.style.background = theme.botAvatar || '#E4E7FC';

                // Load bot SVG from assets
                var botSvg = document.createElement('div');
                var iconColor = theme.primary || '#8349ff';
                botSvg.innerHTML = `
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <g clip-path="url(#clip0_4_4929)">
                            <path d="M19 11H5C3.89543 11 3 11.8954 3 13V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V13C21 11.8954 20.1046 11 19 11Z" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M12 7C13.1046 7 14 6.10457 14 5C14 3.89543 13.1046 3 12 3C10.8954 3 10 3.89543 10 5C10 6.10457 10.8954 7 12 7Z" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M12 7V11" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </g>
                        <defs>
                            <clipPath id="clip0_4_4929">
                                <rect width="24" height="24" fill="white"/>
                            </clipPath>
                        </defs>
                    </svg>
                `;
                avatar.appendChild(botSvg);
            }

            // Create message content container
            var contentContainer = document.createElement('div');
            contentContainer.style.display = 'flex';
            contentContainer.style.flexDirection = 'column';
            contentContainer.style.gap = '0.5rem';
            contentContainer.style.maxWidth = msg.sender === 'user' ? '70%' : '70%'; // All message types now have avatars

            var msgDiv = document.createElement('div');
            msgDiv.style.padding = '0.75rem 1rem';
            msgDiv.style.wordBreak = 'break-word';
            msgDiv.style.fontSize = '0.875rem';
            msgDiv.style.lineHeight = '1.25rem';
            msgDiv.style.position = 'relative';

            if (msg.sender === 'user') {
                // User message styling
                msgDiv.style.backgroundColor = theme.userBubble || '#dbeafe';
                msgDiv.style.color = theme.userText || '#1e40af';
                msgDiv.style.alignSelf = 'flex-end';
                msgDiv.style.borderRadius = '1rem 1rem 0.25rem 1rem';
                msgDiv.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.15)';
            } else if (msg.sender === 'sales_rep') {
                msgDiv.style.background = theme.salesRepBubble || '#f1f5f9';
                msgDiv.style.color = theme.salesRepText || '#475569';
                msgDiv.style.alignSelf = 'flex-start';
                msgDiv.style.borderRadius = '1rem 1rem 1rem 0.25rem';
            } else {
                msgDiv.style.backgroundColor = theme.botBubble || '#f1f5f9';
                msgDiv.style.color = theme.botText || '#475569';
                msgDiv.style.alignSelf = 'flex-start';
                msgDiv.style.borderRadius = '1rem 1rem 1rem 0.25rem';
                msgDiv.style.boxShadow = '0 2px 8px rgba(71, 85, 105, 0.1)';
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
                // Content wrapper for all messages
                var contentWrapper = document.createElement('div');

                // Use markdown conversion for bot messages, plain text for others
                if (msg.sender === 'bot' || msg.sender === 'ai') {
                    contentWrapper.innerHTML = markdownToHtml(msg.text);
                } else if (msg.sender === 'sales_rep') {
                    // Sales rep messages with clean formatting and sender name at top
                    var messageText = escapeHtml(msg.text).replace(/\n/g, '<br>');
                    var senderName = 'Sales Representative';

                    // Safely extract sender name
                    if (msg.senderName) {
                        if (typeof msg.senderName === 'string') {
                            senderName = msg.senderName;
                        } else if (msg.senderName.name) {
                            senderName = msg.senderName.name;
                        }
                    }

                    // Create message content with sender name at the top
                    contentWrapper.innerHTML =
                        '<div style=" padding-bottom: 6px; font-size: 0.75rem; color: #6b7280; font-weight: 500;">~ ' +
                        senderName + '</div>' + messageText;

                    contentWrapper.style.fontWeight = '500';
                    contentWrapper.style.lineHeight = '1.4';
                    contentWrapper.style.display = 'block';
                    contentWrapper.style.width = '100%';
                } else {
                    // User messages
                    contentWrapper.innerHTML = escapeHtml(msg.text).replace(/\n/g, '<br>');
                }

                msgDiv.appendChild(contentWrapper);
            }

            // Assemble the message
            contentContainer.appendChild(msgDiv);

            if (!msg.isWelcomeMessage) {
                var timestamp = document.createElement('div');
                timestamp.style.fontSize = '0.75rem';
                timestamp.style.color = '#9ca3af';
                timestamp.style.alignSelf = msg.sender === 'user' ? 'flex-end' : 'flex-start';
                timestamp.innerText = msg.created_at;
                contentContainer.appendChild(timestamp);
            }
            // Only append avatar if it exists (user messages only)
            if (avatar) {
                messageWrapper.appendChild(avatar);
            }
            messageWrapper.appendChild(contentContainer);
            messageContainer.appendChild(messageWrapper);
            messages.appendChild(messageContainer);
        }

        messages.scrollTop = messages.scrollHeight;

        // Check if scroll button should be visible with a small delay to ensure proper rendering
        setTimeout(function () {
            // Force scroll to bottom again to ensure it works
            messages.scrollTop = messages.scrollHeight;
            checkScrollPosition();
        }, 100);
    }

    // Function to check scroll position and show/hide scroll button
    function checkScrollPosition() {
        // Add a small threshold to account for rounding differences
        var scrollThreshold = 100;
        var isScrolledToBottom = messages.scrollHeight - messages.scrollTop <= messages.clientHeight + scrollThreshold;

        if (isScrolledToBottom) {
            scrollToBottomBtn.style.display = 'none';
        } else {
            scrollToBottomBtn.style.display = 'flex';
        }
    }

    // Function to force scroll to bottom with retries
    function forceScrollToBottom() {
        var attempts = 0;
        var maxAttempts = 5;

        function tryScroll() {
            messages.scrollTop = messages.scrollHeight;
            attempts++;

            if (attempts < maxAttempts && messages.scrollTop < messages.scrollHeight - messages.clientHeight - 10) {
                setTimeout(tryScroll, 50);
            } else {
                checkScrollPosition();
            }
        }

        tryScroll();
    }

    // Add scroll event listener to messages container
    messages.addEventListener('scroll', function () {
        checkScrollPosition();
    });

    // Save message to localStorage
    function saveMessage(msg, sender, type = "") {
        var msgs = JSON.parse(localStorage.getItem('simple-chat-messages') || '[]');
        if (type === "welcomeMessage") {
            const getWelcomeMessageInd = msgs.findIndex(m => m.isWelcomeMessage)
            if (getWelcomeMessageInd !== -1) msgs[getWelcomeMessageInd].text = msg
            else msgs.push({ text: msg, isWelcomeMessage: true, sender: sender });

        }
        else {
            msgs.push({ text: msg, isWelcomeMessage: false, sender, created_at: formatTimeStamp(new Date().toISOString()) });
        }
        localStorage.setItem('simple-chat-messages', JSON.stringify(msgs));
    }

    async function connectWebSocket() {
        if (isWebSocketConnected || currentSocket) return;

        // Try to get stored session data first
        var storedSession = localStorage.getItem('simple-chat-session');
        var chatID, workflow_id, wsParams;

        if (storedSession) {
            try {
                var sessionData = JSON.parse(storedSession);
                // Check if session data is complete and not too old (optional: 24 hours)
                var sessionAge = new Date() - new Date(sessionData.timestamp);
                var maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

                if (sessionData.chatID && sessionData.workflowId && sessionData.hashedWorkflowId &&
                    sessionData.hash && sessionData.visitorInfo && sessionAge < maxAge) {
                    chatID = sessionData.chatID;
                    workflow_id = sessionData.workflowId;
                    wsParams = {
                        hashed_workflow_id: sessionData.hashedWorkflowId,
                        hash: sessionData.hash
                    };
                    visitorInfo = sessionData.visitorInfo;
                } else {
                    // Session is invalid or expired, generate new data
                    throw new Error('Invalid or expired session');
                }
            } catch (error) {
                console.log('Invalid session data, generating new session');
                // Clear invalid session data
                localStorage.removeItem('simple-chat-session');
                storedSession = null;
            }
        }

        if (!storedSession) {
            // Generate new session data if not stored or invalid
            chatID = generateChatId();
            workflow_id = workflowId;
            wsParams = await generateSecureWsParams(workflow_id);

            // Only store if we have visitor info (from completed form)
            if (visitorInfo) {
                var chatSessionData = {
                    chatID: chatID,
                    workflowId: workflow_id,
                    hashedWorkflowId: wsParams.hashed_workflow_id,
                    hash: wsParams.hash,
                    visitorInfo: visitorInfo,
                    timestamp: new Date().toISOString()
                };
                localStorage.setItem('simple-chat-session', JSON.stringify(chatSessionData));
            }
        }

        var wsUrl = `${socketUrl}${chatID}/?workflow_id=${wsParams.hashed_workflow_id}&hash=${wsParams.hash}&visitorInfo=${JSON.stringify(visitorInfo)}`;
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

                if (msgData?.message_type === "handover_message") {

                    // Set handover flag to stop showing typing indicators
                    isHandoverActive = true;

                    // Store handover flag in session data for persistence
                    var storedSession = localStorage.getItem('simple-chat-session');
                    if (storedSession) {
                        try {
                            var sessionData = JSON.parse(storedSession);
                            sessionData.handoverOccurred = true;
                            localStorage.setItem('simple-chat-session', JSON.stringify(sessionData));
                        } catch (error) {
                            console.log('Error updating session with handover flag:', error);
                        }
                    }

                    // Store handover message in localStorage like other messages
                    var msgs = JSON.parse(localStorage.getItem('simple-chat-messages') || '[]');
                    msgs.push({
                        text: msgData.sender + ' has entered the chat',
                        sender: 'system',
                        isWelcomeMessage: false,
                        isSystemNotification: true,
                        notificationType: 'joined',
                        created_at: formatTimeStamp(msgData.created_at || new Date().toISOString())
                    });
                    localStorage.setItem('simple-chat-messages', JSON.stringify(msgs));

                    // Reload messages to show the stored handover message
                    loadMessages();
                    return;
                }

                // Handle AI/bot messages (both streaming and regular) - only if handover is not active
                if ((msgData.sender_type === 'ai' || msgData.sender === 'ai' || msgData.sender_type === 'bot' || msgData.sender === 'bot') && !isHandoverActive) {

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
                            console.log('Stream completed');
                            lastMessage.isStreaming = false;
                            msgs[msgs.length - 1] = lastMessage;
                            localStorage.setItem('simple-chat-messages', JSON.stringify(msgs));
                            // No need to reload - already processed correctly
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
                            lastMessage.lastChunkTime = Date.now(); // Track when last chunk arrived
                            msgs[msgs.length - 1] = lastMessage;
                        } else {
                            // Create new streaming message
                            msgs.push({
                                text: content,
                                sender: 'bot',
                                isWelcomeMessage: false,
                                isStreaming: true,
                                messageId: msgData.message_id,
                                created_at: formatTimeStamp(msgData.created_at),
                                lastChunkTime: Date.now() // Track when last chunk arrived
                            });
                        }
                        localStorage.setItem('simple-chat-messages', JSON.stringify(msgs));
                        loadMessages(); // Use immediate loading for streaming
                    }
                } else if (msgData.sender_type === "sales_rep" || msgData.sender === "sales_rep") {
                    var content = msgData.content || '';

                    // Ignore empty sales_rep messages completely - these should not create typing indicators
                    if (!content || !content.trim()) {
                        return;
                    }

                    var msgs = JSON.parse(localStorage.getItem('simple-chat-messages') || '[]');
                    msgs.push({
                        text: content,
                        sender: msgData.sender_type,
                        senderName: msgData.sender || msgData.sender_name || 'Sales Representative', // Capture sender name
                        isWelcomeMessage: false,
                        created_at: formatTimeStamp(msgData.created_at)
                    });
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

    function formatTimeStamp(timestamp) {
        const createdAt = new Date(timestamp)// or your date value
        const formattedTime = createdAt.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
        });
        return formattedTime;

    }



    // --- Message sending logic update ---
    // This function now uses WebSocket instead of API calls
    function sendMessage(value) {
        var val = input.value.trim() || value
        if (!val) return;
        // Save user message immediately
        saveMessage(val, 'user');
        input.value = '';
        loadMessages();

        // Show typing indicator only if handover is not active
        if (!isHandoverActive) {
            saveMessage('', 'bot');
            loadMessages();
        }

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

    sendBtn.onclick = sendMessage;
    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') sendMessage();
    });

    function showLeadCaptureInChat(onComplete) {
        isFormShowing = true; // Set flag to prevent reset during form display
        updateButtonStates(); // Update button appearance
        messages.innerHTML = '';

        var wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.flexDirection = 'column';
        wrapper.style.alignItems = 'center';
        wrapper.style.justifyContent = 'center';
        wrapper.style.height = '100%';
        wrapper.style.width = '100%';
        wrapper.style.gap = '1.5rem';

        var formContainer = document.createElement('div');
        formContainer.style.width = '100%';
        formContainer.style.maxWidth = '300px';
        formContainer.style.display = 'flex';
        formContainer.style.flexDirection = 'column';
        formContainer.style.gap = '1.5rem';

        var nameFieldContainer = document.createElement('div');
        nameFieldContainer.style.display = 'flex';
        nameFieldContainer.style.flexDirection = 'column';
        nameFieldContainer.style.gap = '0.5rem';

        var nameInputRow = document.createElement('div');
        nameInputRow.style.display = 'flex';
        nameInputRow.style.alignItems = 'center';
        nameInputRow.style.gap = '1.5rem';

        var nameLabel = document.createElement('label');
        nameLabel.innerText = 'Full Name:*';
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

        nameInputRow.appendChild(nameLabel);
        nameInputRow.appendChild(nameInput);

        // Name error message (below the input)
        var nameError = document.createElement('div');
        nameError.style.display = 'none';
        nameError.style.color = '#ef4444';
        nameError.style.fontSize = '0.75rem';
        nameError.style.marginLeft = '27%';
        nameError.style.paddingLeft = '1.5rem';
        nameError.innerText = 'Full name is required';

        nameFieldContainer.appendChild(nameInputRow);
        nameFieldContainer.appendChild(nameError);

        // Email field
        var emailFieldContainer = document.createElement('div');
        emailFieldContainer.style.display = 'flex';
        emailFieldContainer.style.flexDirection = 'column';
        emailFieldContainer.style.gap = '0.5rem';

        var emailInputRow = document.createElement('div');
        emailInputRow.style.display = 'flex';
        emailInputRow.style.alignItems = 'center';
        emailInputRow.style.gap = '1.5rem';

        var emailLabel = document.createElement('label');
        emailLabel.innerText = 'Email:*';
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

        emailInputRow.appendChild(emailLabel);
        emailInputRow.appendChild(emailInput);

        // Email error message (below the input)
        var emailError = document.createElement('div');
        emailError.style.display = 'none';
        emailError.style.color = '#ef4444';
        emailError.style.fontSize = '0.75rem';
        emailError.style.marginLeft = '27%';
        emailError.style.paddingLeft = '1.5rem';
        emailError.innerText = 'Please enter a valid email address';

        emailFieldContainer.appendChild(emailInputRow);
        emailFieldContainer.appendChild(emailError);

        // Phone field (required)
        var phoneFieldContainer = document.createElement('div');
        phoneFieldContainer.style.display = 'flex';
        phoneFieldContainer.style.flexDirection = 'column';
        phoneFieldContainer.style.gap = '0.5rem';

        var phoneInputRow = document.createElement('div');
        phoneInputRow.style.display = 'flex';
        phoneInputRow.style.alignItems = 'center';
        phoneInputRow.style.gap = '1.5rem';

        var phoneLabel = document.createElement('label');
        phoneLabel.innerText = 'Phone:*';
        phoneLabel.style.width = '27%';
        phoneLabel.style.fontSize = '0.875rem';
        phoneLabel.style.fontWeight = '500';
        phoneLabel.style.color = '#374151';

        var phoneInput = document.createElement('input');
        phoneInput.type = 'tel';
        phoneInput.placeholder = 'Phone number';
        phoneInput.maxLength = 20;
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

        phoneInputRow.appendChild(phoneLabel);
        phoneInputRow.appendChild(phoneInput);

        // Phone error message (below the input)
        var phoneError = document.createElement('div');
        phoneError.style.display = 'none';
        phoneError.style.color = '#ef4444';
        phoneError.style.fontSize = '0.75rem';
        phoneError.style.marginLeft = '27%';
        phoneError.style.paddingLeft = '1.5rem';
        phoneError.innerText = 'Phone number is required';

        phoneFieldContainer.appendChild(phoneInputRow);
        phoneFieldContainer.appendChild(phoneError);

        // Zip Code field (required)
        var zipFieldContainer = document.createElement('div');
        zipFieldContainer.style.display = 'flex';
        zipFieldContainer.style.flexDirection = 'column';
        zipFieldContainer.style.gap = '0.5rem';

        var zipInputRow = document.createElement('div');
        zipInputRow.style.display = 'flex';
        zipInputRow.style.alignItems = 'center';
        zipInputRow.style.gap = '1.5rem';

        var zipLabel = document.createElement('label');
        zipLabel.innerText = 'Zip Code:*';
        zipLabel.style.width = '27%';
        zipLabel.style.fontSize = '0.875rem';
        zipLabel.style.fontWeight = '500';
        zipLabel.style.color = '#374151';

        var zipInput = document.createElement('input');
        zipInput.type = 'text';
        zipInput.placeholder = 'Zip code';
        zipInput.style.width = '60%';
        zipInput.style.padding = '0.75rem 1rem';
        zipInput.style.border = '1px solid #d1d5db';
        zipInput.style.borderRadius = '0.375rem';
        zipInput.style.fontSize = '0.875rem';
        zipInput.style.outline = 'none';
        zipInput.style.transition = 'border-color 0.2s ease-in-out';

        zipInput.addEventListener('focus', function () {
            zipInput.style.borderColor = '#3b82f6';
        });
        zipInput.addEventListener('blur', function () {
            zipInput.style.borderColor = '#d1d5db';
        });

        zipInputRow.appendChild(zipLabel);
        zipInputRow.appendChild(zipInput);

        // Zip error message (below the input)
        var zipError = document.createElement('div');
        zipError.style.display = 'none';
        zipError.style.color = '#ef4444';
        zipError.style.fontSize = '0.75rem';
        zipError.style.marginLeft = '27%';
        zipError.style.paddingLeft = '1.5rem';
        zipError.innerText = 'Zip code is required';

        zipFieldContainer.appendChild(zipInputRow);
        zipFieldContainer.appendChild(zipError);

        // Add all fields to form container
        formContainer.appendChild(nameFieldContainer);
        formContainer.appendChild(emailFieldContainer);
        formContainer.appendChild(phoneFieldContainer);
        formContainer.appendChild(zipFieldContainer);

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
        confirmBtn.onclick = async function () {
            var nameVal = nameInput.value.trim();
            var emailVal = emailInput.value.trim();
            var phoneVal = phoneInput.value.trim();
            var hasErrors = false;

            // Reset all error states
            nameInput.style.borderColor = '#d1d5db';
            emailInput.style.borderColor = '#d1d5db';
            phoneInput.style.borderColor = '#d1d5db';
            nameError.style.display = 'none';
            emailError.style.display = 'none';
            phoneError.style.display = 'none';

            // Validate name (required)

            var zipVal = zipInput.value.trim();
            var hasErrors = false;

            // Reset all error states
            nameInput.style.borderColor = '#d1d5db';
            emailInput.style.borderColor = '#d1d5db';
            phoneInput.style.borderColor = '#d1d5db';
            zipInput.style.borderColor = '#d1d5db';
            nameError.style.display = 'none';
            emailError.style.display = 'none';
            phoneError.style.display = 'none';
            zipError.style.display = 'none';

            // Validate name (required)
            if (!nameVal) {
                nameInput.style.borderColor = '#ef4444';
                nameError.style.display = 'block';
                hasErrors = true;
            }

            // Validate email (required and format)
            if (!emailVal) {
                emailInput.style.borderColor = '#ef4444';
                emailError.innerText = 'Email is required';
                emailError.style.display = 'block';
                hasErrors = true;
            } else if (!/^\S+@\S+\.\S+$/.test(emailVal)) {
                emailInput.style.borderColor = '#ef4444';
                emailError.innerText = 'Please enter a valid email address';
                emailError.style.display = 'block';
                hasErrors = true;
            }

            // Validate phone (required and max length 20)
            if (!phoneVal) {
                phoneInput.style.borderColor = '#ef4444';
                phoneError.innerText = 'Phone number is required';
                phoneError.style.display = 'block';
                hasErrors = true;
            } else if (phoneVal.length > 20) {
                phoneInput.style.borderColor = '#ef4444';
                phoneError.innerText = 'Phone number must be 20 characters or less';
                phoneError.style.display = 'block';
                hasErrors = true;
            } else if (!/^[\+]?[0-9\s\-\(\)\.]{1,20}$/.test(phoneVal)) {
                phoneInput.style.borderColor = '#ef4444';
                phoneError.innerText = 'Please enter a valid phone number';
                phoneError.style.display = 'block';
                hasErrors = true;
            }

            // Validate zip code (required, basic format: 3-10 alphanumeric)
            if (!zipVal) {
                zipInput.style.borderColor = '#ef4444';
                zipError.innerText = 'Zip code is required';
                zipError.style.display = 'block';
                hasErrors = true;
            } else if (!/^\w{3,10}$/.test(zipVal)) {
                zipInput.style.borderColor = '#ef4444';
                zipError.innerText = 'Please enter a valid zip code';
                zipError.style.display = 'block';
                hasErrors = true;
            }

            if (hasErrors) {
                // Focus on first error field
                if (!nameVal) nameInput.focus();
                else if (!emailVal || !/^\S+@\S+\.\S+$/.test(emailVal)) emailInput.focus();
                else if (!phoneVal || phoneVal.length > 20 || !/^[\+]?[0-9\s\-\(\)\.]{1,20}$/.test(phoneVal)) phoneInput.focus();
                else if (!zipVal || !/^\w{3,10}$/.test(zipVal)) zipInput.focus();
                return;
            }

            messages.innerHTML = '';
            await createVisitor(
                sanitize(nameInput.value),
                sanitize(emailInput.value),
                sanitize(phoneInput.value),
                sanitize(zipInput.value)
            );


            // Collect environment info
            var userAgent = navigator.userAgent;
            var platform = navigator.platform;
            var url = window.location.href;
            var timestamp = new Date().toISOString();
            var language = navigator.language;
            var referrer = document.referrer;

            var leadData = {
                name: sanitize(nameInput.value),
                email: sanitize(emailInput.value),
                phone: sanitize(phoneInput.value),
                zip: sanitize(zipInput.value),
                timestamp,
                userAgent,
                platform,
                url,
                language,
                referrer,
                ip: '' // Remove IP tracking for faster loading
            };

            // Store lead in localStorage array for later sending
            var leads = JSON.parse(localStorage.getItem('simple-chat-leads') || '[]');
            leads.push(leadData);
            localStorage.setItem('simple-chat-leads', JSON.stringify(leads));

            onComplete(leadData);
            sendMessage(`${nameInput.value} ${emailInput.value} ${phoneInput.value} ${zipInput.value}`);  

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
        zipInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') confirmBtn.click();
        });

        // Assemble the form
        wrapper.appendChild(formContainer);
        wrapper.appendChild(confirmBtn);
        messages.appendChild(wrapper);

        // Focus the first field
    nameInput.focus();
    }

    // On load, show lead capture inside chat window
    function maybeShowLeadCapture() {
        // Check if we have existing messages in localStorage - if yes, skip lead form
        var existingMessages = JSON.parse(localStorage.getItem('simple-chat-messages') || '[]');
        var storedSession = localStorage.getItem('simple-chat-session');

        // If we have messages and session data, skip the form
        if (existingMessages.length > 0 && storedSession) {
            window.__simpleChatEmbedLeadCaptured = true;

            // Load stored session data and check for handover flag
            try {
                var sessionData = JSON.parse(storedSession);
                visitorInfo = sessionData.visitorInfo;

                // Check if handover occurred in this session
                if (sessionData.handoverOccurred === true) {
                    isHandoverActive = true;
                }
            } catch (error) {
                console.log('Error parsing session data:', error);
            }

            // Show chat input immediately
            setupChatInput();
            loadMessages();

            // Ensure auto-scroll to bottom after loading existing messages with robust scroll
            setTimeout(function () {
                forceScrollToBottom();
            }, 200);

            // Automatically establish WebSocket connection with stored session data
            connectWebSocket();
            return;
        }

        // Only show lead capture form if we don't have messages or haven't captured lead yet
        if (!window.__simpleChatEmbedLeadCaptured) {
            inputContainer.style.display = 'none';
            showLeadCaptureInChat(function (lead) {
                isFormShowing = false; // Reset flag when form is completed
                updateButtonStates(); // Update button appearance
                window.__simpleChatEmbedLeadCaptured = true;
                if (lead) {
                    window.SimpleChatEmbedLead = lead;
                }
                setupChatInput();

                // Show welcome message if set and no previous messages
                var msgs = JSON.parse(localStorage.getItem('simple-chat-messages') || '[]');
                if (welcomeMessage) {
                    saveMessage(welcomeMessage, 'bot', 'welcomeMessage');
                }
                loadMessages();
            });
        } else {
            setupChatInput();
            loadMessages();
        }
    }

    // Helper function to setup chat input styling
    function setupChatInput() {
        inputContainer.style.display = 'flex';
        inputContainer.style.flexDirection = 'column';
        inputContainer.style.width = '100%';
        inputContainer.style.boxSizing = 'border-box';
        inputContainer.style.padding = '1rem';
        inputContainer.style.gap = '0';
        inputContainer.style.flex = '0 0 auto';
        inputContainer.style.borderTop = '1px solid #ececec';
        inputContainer.style.background = '#ffffff';
        
        // Show quick buttons based on configuration
        if (config.quickQuestions && config.quickQuestions.length > 0) {
            var msgs = JSON.parse(localStorage.getItem('simple-chat-messages') || '[]');
            var isFirstSession = msgs.length === 0 || (msgs.length === 1 && msgs[0].isWelcomeMessage);
            
            // Show if permanent OR if it's the first session
            if (config.quickQuestionsPermanent || isFirstSession) {
                quickButtonsContainer.style.display = 'flex';
            } else {
                quickButtonsContainer.style.display = 'none';
            }
        }
        
        // Style the input form container
        inputForm.style.display = 'grid';
        inputForm.style.gridTemplateColumns = '1fr auto';
        inputForm.style.gap = '1rem';
        inputForm.style.alignItems = 'center';
        inputForm.style.width = '100%';
        
        input.style.padding = '0.75rem 1rem';
        input.style.border = '1px solid #d1d5db';
        input.style.borderRadius = '0.375rem';
        input.style.background = theme.inputBg;
        input.style.color = theme.inputText;
        input.style.fontSize = '0.875rem';
        input.style.lineHeight = '1.25rem';
        input.style.outline = 'none';
        input.style.transition = 'border-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out';
        
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

            // Auto-scroll to bottom when chat opens with robust scroll function
            setTimeout(function () {
                forceScrollToBottom();
            }, 150);
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

    // Helper function to create visitor
    const createVisitor = async (name, email, phone, zip) => {
        try {
            var baseUrl = null
            var token = null
            if (config.socketUrl === "wss://hub.memox.io") {
                baseUrl = "https://hub.memox.io/api/v1/"
                token = "eedb5fc2b457815409e45f3b1dc023c276c9cedb"
            }
            else {
                baseUrl = "http://localhost:8000/api/v1/"
                token = "cbacbe059689c3dec8173c05d806c7266b50176e"
            }

            const getVisitor = await fetch(`${baseUrl}visitors/?email=${email}`, {
                method: "GET",
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Token ${token} `,
                }
            })

            const getVisitorJson = await getVisitor.json();

            if (getVisitorJson.detail === "Not found." || !getVisitorJson.length) {
                // If visitor does not exist, create a new one
                const visitor = await fetch(`${baseUrl}visitors/`, {
                    method: "POST",
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Token ${token} `,
                    },
                    body: JSON.stringify({
                        name,
                        email,
                        phone_number: phone,
                        zip_code: zip,
                        workflow_id: workflowId
                    })
                })

                if (!visitor.ok) {
                    throw new Error(`Failed to create visitor: ${visitor.status}`);
                }

                const visitorData = await visitor.json();
                visitorInfo = {
                    "id": visitorData.id,
                    "name": visitorData.name
                };
            }
            else {
                visitorInfo = {
                    "id": getVisitorJson[0].id,
                    "name": getVisitorJson[0].name
                };
            }
        } catch (error) {
            console.error('Error creating/fetching visitor:', error);
            // Create fallback visitor info for offline mode
            visitorInfo = {
                "id": "offline_" + Date.now(),
                "name": name
            };
        }
    }

    // Function to check and auto-connect with stored session on widget load
    function checkAndAutoConnect() {
        var storedSession = localStorage.getItem('simple-chat-session');

        if (storedSession) {
            try {
                var sessionData = JSON.parse(storedSession);
                // Check if session data is complete and not too old (24 hours)
                var sessionAge = new Date() - new Date(sessionData.timestamp);
                var maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

                if (sessionData.chatID && sessionData.workflowId && sessionData.hashedWorkflowId &&
                    sessionData.hash && sessionData.visitorInfo && sessionAge < maxAge) {

                    // Set visitor info from stored session
                    visitorInfo = sessionData.visitorInfo;

                    // Auto-connect if not already connected
                    if (!isWebSocketConnected && !currentSocket) {
                        connectWebSocket();
                    }
                }
            } catch (error) {
                console.log('Error checking stored session for auto-connect:', error);
            }
        }
    }

    // Initial load
    maybeShowLeadCapture();

    // Check for auto-connection after initial setup
    setTimeout(checkAndAutoConnect, 100);
} // End of initializeChatEmbed function

})(); // End of main IIFE
