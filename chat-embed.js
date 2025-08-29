
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
        },

        // API configuration
        api: {
            baseUrl: 'https://hub.memox.io/api/v1',
            token: 'eedb5fc2b457815409e45f3b1dc023c276c9cedb',
            endpoints: {
                products: '/products/',
                categories: '/categories/',
                visitors: '/visitors/'
            }
        },

        // Products configuration
        products: {
            endpoint: null,
            data: [],
            useEmbeddedFallback: true,
            displayFields: {
                showPrice: true,
                showOriginalPrice: true,
                showSavings: true,
                showDelivery: true,
                showPickup: true,
                showCategory: true,
                showType: true
            },
            sorting: {
                enabled: true,
                defaultSort: 'price-low',
                options: [
                    { id: 'price-low', label: 'Price: Low to High' },
                    { id: 'price-high', label: 'Price: High to Low' },
                    { id: 'size-20ft', label: 'Size: 20ft First' },
                    { id: 'size-40ft', label: 'Size: 40ft First' },
                    { id: 'name-asc', label: 'Name A-Z' },
                    { id: 'delivery', label: 'Delivery Time' }
                ]
            }
        },

        // Categories configuration
        categories: {
            endpoint: null,
            data: [],
            displayOptions: {
                showIcons: true,
                showDescriptions: true,
                maxColumns: 1
            }
        },

        // Entry points configuration
        entryPoints: {
            enabled: true,
            title: "How may we help you today?",
            options: [
                {
                    id: "book_call",
                    label: "Book a Call",
                    description: "Schedule a consultation with our team",
                    requiresForm: true,
                    formFields: ["name", "email", "phone", "date", "time"]
                },
                {
                    id: "get_info",
                    label: "Get Information",
                    description: "Learn about our services and pricing",
                    requiresForm: false
                },
                {
                    id: "support",
                    label: "Receive Support",
                    description: "Get help with your account or issues",
                    requiresForm: true,
                    formFields: ["support_type"]
                },
                {
                    id: "browse_products",
                    label: "Browse Products",
                    description: "Explore our shipping container inventory",
                    requiresForm: false
                }
            ]
        }
    };

    var config = window.SimpleChatEmbedConfig ? {
        ...defaultConfig,
        ...window.SimpleChatEmbedConfig,
        theme: { ...defaultConfig.theme, ...(window.SimpleChatEmbedConfig.theme || {}) },
        api: { ...defaultConfig.api, ...(window.SimpleChatEmbedConfig.api || {}) },
        products: { ...defaultConfig.products, ...(window.SimpleChatEmbedConfig.products || {}) },
        categories: { ...defaultConfig.categories, ...(window.SimpleChatEmbedConfig.categories || {}) }
    } : defaultConfig;

    var theme = config.theme;
    // normalized values
    var welcomeMessage = config.welcomeMessage || null;
    var workflowId = config.workflowId;
    // normalize socketUrl: guard against missing config and strip trailing slashes
    var socketBase = config.socketUrl ? String(config.socketUrl).replace(/\/+$/g, '') : '';
    var socketUrl = socketBase + "/ws/chat/";
    var entryPoints = config.entryPoints;
    var apiConfig = config.api;
    var productsConfig = config.products;
    var categoriesConfig = config.categories;

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
            backBtn.style.display = 'flex'; // Show back button when forms are showing
        } else {
            // Enable appearance when form is not showing
            refreshBtn.style.opacity = '1';
            refreshBtn.style.cursor = 'pointer';
            clearSessionBtn.style.opacity = '1';
            clearSessionBtn.style.cursor = 'pointer';
            backBtn.style.display = 'none'; // Hide back button when not on forms
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

    // Back button (appears when forms are showing)
    var backBtn = document.createElement('button');
    backBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>';
    backBtn.title = 'Back to options';
    backBtn.style.background = 'transparent';
    backBtn.style.color = theme.headerText;
    backBtn.style.border = 'none';
    backBtn.style.padding = '0.5rem';
    backBtn.style.cursor = 'pointer';
    backBtn.style.borderRadius = '0.375rem';
    backBtn.style.display = 'none'; // Hidden by default
    backBtn.style.alignItems = 'center';
    backBtn.style.justifyContent = 'center';
    backBtn.style.transition = 'background-color 0.2s ease-in-out';
    backBtn.onmouseover = function () {
        backBtn.style.backgroundColor = 'rgba(255,255,255,0.1)';
    };
    backBtn.onmouseout = function () {
        backBtn.style.backgroundColor = 'transparent';
    };
    backBtn.onclick = function () {
        // Go back to entry points
        showEntryPoints(function(result) {
            isFormShowing = false;
            updateButtonStates();

            if (result.entryPoint === 'get_info') {
                window.__simpleChatEmbedLeadCaptured = true;
                setupChatInput();
                if (welcomeMessage) {
                    saveMessage(welcomeMessage, 'bot', 'welcomeMessage');
                }
                loadMessages();
            } else {
                showLeadCaptureInChat(function (lead) {
                    isFormShowing = false;
                    updateButtonStates();
                    window.__simpleChatEmbedLeadCaptured = true;
                    if (lead) {
                        window.SimpleChatEmbedLead = lead;
                        lead.entryPoint = result.entryPoint;
                        if (result.formData) {
                            lead.entryPointData = result.formData;
                        }
                    }
                    setupChatInput();
                    var msgs = JSON.parse(localStorage.getItem('simple-chat-messages') || '[]');
                    if (welcomeMessage) {
                        saveMessage(welcomeMessage, 'bot', 'welcomeMessage');
                    }
                    loadMessages();
                });
            }
        });
    };

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
        
        // Show entry points instead of lead capture form
        inputContainer.style.display = 'none';
        showEntryPoints(function(result) {
            isFormShowing = false;
            updateButtonStates();

            if (result.entryPoint === 'get_info') {
                // Go directly to chat for "Get Information"
                window.__simpleChatEmbedLeadCaptured = true;
                setupChatInput();

                // Show welcome message if set
                if (welcomeMessage) {
                    saveMessage(welcomeMessage, 'bot', 'welcomeMessage');
                }
                loadMessages();
            } else {
                // For other entry points, show lead capture first
                showLeadCaptureInChat(function (lead) {
                    isFormShowing = false;
                    updateButtonStates();
                    window.__simpleChatEmbedLeadCaptured = true;
                    if (lead) {
                        window.SimpleChatEmbedLead = lead;
                        // Add entry point info to lead data
                        lead.entryPoint = result.entryPoint;
                        if (result.formData) {
                            lead.entryPointData = result.formData;
                        }
                    }
                    setupChatInput();

                    // Show welcome message if set and no previous messages
                    var msgs = JSON.parse(localStorage.getItem('simple-chat-messages') || '[]');
                    if (welcomeMessage) {
                        saveMessage(welcomeMessage, 'bot', 'welcomeMessage');
                    }
                    loadMessages();
                });
            }
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

    headerActions.appendChild(backBtn);
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

    // Ensure visitorInfo is safely URL-encoded when appended to query string
    var encodedVisitorInfo = visitorInfo ? encodeURIComponent(JSON.stringify(visitorInfo)) : 'null';
    var wsUrl = `${socketUrl}${chatID}/?workflow_id=${wsParams.hashed_workflow_id}&hash=${wsParams.hash}&visitorInfo=${encodedVisitorInfo}`;
        // Debug logging for connection params
        console.log('[DEBUG] WebSocket URL:', wsUrl);
        console.log('[DEBUG] visitorInfo:', visitorInfo);
        console.log('[DEBUG] chatID:', chatID, 'workflow_id:', workflow_id, 'wsParams:', wsParams);
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

    // Entry points selection UI
    function showEntryPoints(onComplete) {
        isFormShowing = false; // Not showing a form, showing entry points
        updateButtonStates();
        messages.innerHTML = '';

        var wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.flexDirection = 'column';
        wrapper.style.alignItems = 'center';
        wrapper.style.justifyContent = 'center';
        wrapper.style.height = '100%';
        wrapper.style.width = '100%';
        wrapper.style.gap = '1.5rem';
        wrapper.style.padding = '1rem';

        // Title
        var title = document.createElement('h2');
        title.innerText = entryPoints.title;
        title.style.fontSize = '1.25rem';
        title.style.fontWeight = '600';
        title.style.color = theme.text;
        title.style.textAlign = 'center';
        title.style.margin = '0';
        wrapper.appendChild(title);

        // Options container
        var optionsContainer = document.createElement('div');
        optionsContainer.style.display = 'flex';
        optionsContainer.style.flexDirection = 'column';
        optionsContainer.style.gap = '0.75rem';
        optionsContainer.style.width = '100%';
        optionsContainer.style.maxWidth = '320px';
        optionsContainer.style.alignItems = 'center'; // Center the buttons

        // Create option buttons
        entryPoints.options.forEach(function(option) {
            var button = document.createElement('button');
            button.innerHTML = `
                <div style="font-weight: 600; font-size: 0.875rem; margin-bottom: 0.25rem; text-align: center;">${option.label}</div>
                <div style="font-size: 0.75rem; color: #6b7280; text-align: center;">${option.description}</div>
            `;
            button.style.width = '100%';
            button.style.maxWidth = '280px'; // Slightly smaller for better centering
            button.style.padding = '1rem';
            button.style.background = '#ffffff';
            button.style.border = '1px solid #d1d5db';
            button.style.borderRadius = '0.5rem';
            button.style.cursor = 'pointer';
            button.style.textAlign = 'center'; // Center text inside buttons
            button.style.transition = 'all 0.2s ease-in-out';
            button.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';

            button.addEventListener('mouseover', function() {
                button.style.background = '#f8f9fa';
                button.style.borderColor = theme.primary;
                button.style.transform = 'translateY(-1px)';
                button.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
            });

            button.addEventListener('mouseout', function() {
                button.style.background = '#ffffff';
                button.style.borderColor = '#d1d5db';
                button.style.transform = 'translateY(0)';
                button.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
            });

            button.addEventListener('click', function() {
                if (option.requiresForm) {
                    showCustomForm(option, onComplete);
                } else if (option.id === 'browse_products') {
                    showProductCategories(onComplete);
                } else {
                    // Go directly to chat
                    onComplete({ entryPoint: option.id });
                }
            });

            optionsContainer.appendChild(button);
        });

        wrapper.appendChild(optionsContainer);
        messages.appendChild(wrapper);
    }

    // Custom form for entry points that require additional info
    function showCustomForm(entryPointOption, onComplete) {
        messages.innerHTML = '';

        var wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.flexDirection = 'column';
        wrapper.style.alignItems = 'center';
        wrapper.style.justifyContent = 'center';
        wrapper.style.height = '100%';
        wrapper.style.width = '100%';
        wrapper.style.gap = '1.5rem';
        wrapper.style.padding = '1rem';

        // Title
        var title = document.createElement('h2');
        title.innerText = entryPointOption.label;
        title.style.fontSize = '1.25rem';
        title.style.fontWeight = '600';
        title.style.color = theme.text;
        title.style.textAlign = 'center';
        title.style.margin = '0';
        wrapper.appendChild(title);

        var formContainer = document.createElement('div');
        formContainer.style.width = '100%';
        formContainer.style.maxWidth = '300px';
        formContainer.style.display = 'flex';
        formContainer.style.flexDirection = 'column';
        formContainer.style.gap = '1rem';

        var formData = {};

        // Create form fields based on entryPointOption.formFields
        entryPointOption.formFields.forEach(function(field) {
            var fieldContainer = document.createElement('div');
            fieldContainer.style.display = 'flex';
            fieldContainer.style.flexDirection = 'column';
            fieldContainer.style.gap = '0.5rem';

            var label = document.createElement('label');
            label.style.fontSize = '0.875rem';
            label.style.fontWeight = '500';
            label.style.color = theme.text;

            var input;
            if (field === 'name') {
                label.innerText = 'Full Name*';
                input = document.createElement('input');
                input.type = 'text';
                input.placeholder = 'Enter your full name';
            } else if (field === 'email') {
                label.innerText = 'Email*';
                input = document.createElement('input');
                input.type = 'email';
                input.placeholder = 'Enter your email';
            } else if (field === 'phone') {
                label.innerText = 'Phone*';
                input = document.createElement('input');
                input.type = 'tel';
                input.placeholder = 'Enter your phone number';
            } else if (field === 'preferred_date') {
                label.innerText = 'Preferred Date*';
                input = document.createElement('input');
                input.type = 'date';
                input.min = new Date().toISOString().split('T')[0];
            } else if (field === 'preferred_time') {
                label.innerText = 'Preferred Time*';
                input = document.createElement('input');
                input.type = 'time';
                input.min = '09:00';
                input.max = '17:00';
            } else if (field === 'support_type') {
                label.innerText = 'Support Issue*';
                input = document.createElement('select');
                var options = [
                    { value: '', text: 'Select an issue' },
                    { value: 'technical', text: 'Technical Issue' },
                    { value: 'billing', text: 'Billing Question' },
                    { value: 'account', text: 'Account Access' },
                    { value: 'other', text: 'Other' }
                ];
                options.forEach(function(opt) {
                    var optionEl = document.createElement('option');
                    optionEl.value = opt.value;
                    optionEl.text = opt.text;
                    input.appendChild(optionEl);
                });
            }

            if (input) {
                input.style.padding = '0.75rem';
                input.style.border = '1px solid #d1d5db';
                input.style.borderRadius = '0.375rem';
                input.style.fontSize = '0.875rem';
                input.style.outline = 'none';
                input.style.transition = 'border-color 0.2s ease-in-out';

                input.addEventListener('focus', function() {
                    input.style.borderColor = theme.primary;
                });
                input.addEventListener('blur', function() {
                    input.style.borderColor = '#d1d5db';
                });
                input.addEventListener('input', function() {
                    formData[field] = input.value;
                });

                fieldContainer.appendChild(label);
                fieldContainer.appendChild(input);
                formContainer.appendChild(fieldContainer);
            }
        });

        // Add support-specific textarea when needed
        if (entryPointOption.id === 'support') {
            var issueContainer = document.createElement('div');
            issueContainer.style.display = 'flex';
            issueContainer.style.flexDirection = 'column';
            issueContainer.style.gap = '0.5rem';

            var issueLabel = document.createElement('label');
            issueLabel.innerText = 'Describe your problem please*';
            issueLabel.style.fontSize = '0.875rem';
            issueLabel.style.fontWeight = '500';
            issueLabel.style.color = theme.text;

            var issueInput = document.createElement('textarea');
            issueInput.placeholder = 'Describe your problem please';
            issueInput.rows = 4;
            issueInput.style.padding = '0.75rem';
            issueInput.style.border = '1px solid #d1d5db';
            issueInput.style.borderRadius = '0.375rem';
            issueInput.style.fontSize = '0.875rem';
            issueInput.style.outline = 'none';
            issueInput.style.transition = 'border-color 0.2s ease-in-out';
            issueInput.addEventListener('focus', function() { issueInput.style.borderColor = theme.primary; });
            issueInput.addEventListener('blur', function() { issueInput.style.borderColor = '#d1d5db'; });
            issueInput.addEventListener('input', function() { formData['issue'] = issueInput.value; });

            issueContainer.appendChild(issueLabel);
            issueContainer.appendChild(issueInput);
            formContainer.appendChild(issueContainer);
        }

        // Submit button
        var submitBtn = document.createElement('button');
        submitBtn.innerText = entryPointOption.id === 'support' ? 'Talk to Support' : 'Continue to Chat';
        submitBtn.style.width = '100%';
        submitBtn.style.padding = '0.75rem 1.5rem';
        submitBtn.style.background = theme.sendBtnBg || '#16a34a';
        submitBtn.style.color = '#ffffff';
        submitBtn.style.border = 'none';
        submitBtn.style.borderRadius = '0.375rem';
        submitBtn.style.cursor = 'pointer';
        submitBtn.style.fontWeight = '600';
        submitBtn.style.fontSize = '0.875rem';
        submitBtn.style.transition = 'background-color 0.2s ease-in-out';

        submitBtn.addEventListener('mouseover', function() {
            submitBtn.style.backgroundColor = theme.sendBtnHover || '#15803d';
        });
        submitBtn.addEventListener('mouseout', function() {
            submitBtn.style.backgroundColor = theme.sendBtnBg || '#16a34a';
        });

        submitBtn.addEventListener('click', function() {
            // Validate required fields
            var hasErrors = false;
            entryPointOption.formFields.forEach(function(field) {
                if (!formData[field] || formData[field].trim() === '') {
                    hasErrors = true;
                }
            });

            // Support-specific required issue textarea
            if (entryPointOption.id === 'support') {
                if (!formData['issue'] || formData['issue'].trim() === '') {
                    hasErrors = true;
                }
            }

            if (hasErrors) {
                alert('Please fill in all required fields.');
                return;
            }

            // Complete with form data
            onComplete({
                entryPoint: entryPointOption.id,
                formData: formData
            });
        });

        // Back button
        var backBtn = document.createElement('button');
        backBtn.innerText = '← Back';
        backBtn.style.width = '100%';
        backBtn.style.padding = '0.5rem 1rem';
        backBtn.style.background = 'transparent';
        backBtn.style.color = theme.primary;
        backBtn.style.border = '1px solid ' + theme.primary;
        backBtn.style.borderRadius = '0.375rem';
        backBtn.style.cursor = 'pointer';
        backBtn.style.fontSize = '0.875rem';
        backBtn.style.transition = 'all 0.2s ease-in-out';

        backBtn.addEventListener('mouseover', function() {
            backBtn.style.background = theme.primary;
            backBtn.style.color = '#ffffff';
        });
        backBtn.addEventListener('mouseout', function() {
            backBtn.style.background = 'transparent';
            backBtn.style.color = theme.primary;
        });

        backBtn.addEventListener('click', function() {
            showEntryPoints(onComplete);
        });

        formContainer.appendChild(submitBtn);
        formContainer.appendChild(backBtn);
        wrapper.appendChild(formContainer);
        messages.appendChild(wrapper);
    }

    // Product catalog display function
    function showProductCategories(onComplete) {
        messages.innerHTML = '';

        var wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.flexDirection = 'column';
        wrapper.style.alignItems = 'center';
        wrapper.style.justifyContent = 'flex-start';
        wrapper.style.height = '100%';
        wrapper.style.width = '100%';
        wrapper.style.gap = '1rem';
        wrapper.style.padding = '1rem';
        wrapper.style.overflowY = 'auto';

        // Title
        var title = document.createElement('h2');
        title.innerText = 'Choose a Category';
        title.style.fontSize = '1.25rem';
        title.style.fontWeight = '600';
        title.style.color = theme.text;
        title.style.textAlign = 'center';
        title.style.margin = '0';
        wrapper.appendChild(title);

        // Categories container
        var categoriesContainer = document.createElement('div');
        categoriesContainer.style.display = 'flex';
        categoriesContainer.style.flexDirection = 'column';
        categoriesContainer.style.gap = '1rem';
        categoriesContainer.style.width = '100%';
        categoriesContainer.style.maxWidth = '400px';

        // Load categories from configuration
        async function loadCategories() {
            var categories = [];

            try {
                // Check if we're running from file:// protocol
                var isFileProtocol = window.location.protocol === 'file:';

                // Try to fetch from backend endpoint first (only if not file protocol)
                if (categoriesConfig.endpoint && !isFileProtocol) {
                    console.log('Fetching categories from:', categoriesConfig.endpoint);
                    var response = await fetch(categoriesConfig.endpoint, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                        }
                    });

                    if (response.ok) {
                        var data = await response.json();
                        categories = Array.isArray(data) ? data : data.categories || [];
                        console.log('Loaded', categories.length, 'categories from backend');
                    } else {
                        console.warn('Failed to fetch categories from backend:', response.status);
                        throw new Error('Backend fetch failed');
                    }
                } else {
                    // Use inline category data from config
                    categories = categoriesConfig.data || [];
                    console.log('Using configured category data:', categories.length, 'categories');
                }
            } catch (error) {
                console.log('Error loading categories, using fallback:', error.message);
                // Fallback to embedded categories if config fails
                categories = [
                    {
                        id: '1_trip',
                        name: '1 Trip Containers',
                        description: 'Single-use shipping containers',
                        icon: '🚚',
                        filter: { type: '1 trip' }
                    },
                    {
                        id: 'cargo_worthy',
                        name: 'Cargo Worthy',
                        description: 'High-quality containers for cargo transport',
                        icon: '📦',
                        filter: { type: 'cargo worthy' }
                    },
                    {
                        id: 'wind_water_tight',
                        name: 'Wind & Water Tight',
                        description: 'Weather-resistant containers',
                        icon: '🛡️',
                        filter: { type: 'wind & water tight' }
                    },
                    {
                        id: 'economy_grade',
                        name: 'Economy Grade',
                        description: 'Budget-friendly container options',
                        icon: '💰',
                        filter: { type: 'economy' }
                    },
                    {
                        id: 'multi_trip',
                        name: 'Multi-Trip',
                        description: 'Reusable containers for multiple shipments',
                        icon: '🔄',
                        filter: { type: 'multi-trip' }
                    },
                    {
                        id: 'office_containers',
                        name: 'Office Containers',
                        description: 'Containers modified for office use',
                        icon: '🏢',
                        filter: { type: 'office' }
                    },
                    {
                        id: 'accessories',
                        name: 'Accessories',
                        description: 'Container accessories and modifications',
                        icon: '🔧',
                        filter: { type: 'accessory' }
                    }
                ];
            }

            return categories;
        }

        function createCategoryCard(category) {
            var categoryCard = document.createElement('div');
            categoryCard.style.background = '#ffffff';
            categoryCard.style.border = '1px solid #e2e8f0';
            categoryCard.style.borderRadius = '0.5rem';
            categoryCard.style.padding = '1.5rem';
            categoryCard.style.cursor = 'pointer';
            categoryCard.style.transition = 'all 0.2s ease-in-out';
            categoryCard.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
            categoryCard.style.display = 'flex';
            categoryCard.style.alignItems = 'center';
            categoryCard.style.gap = '1rem';

            categoryCard.addEventListener('mouseover', function() {
                categoryCard.style.transform = 'translateY(-2px)';
                categoryCard.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                categoryCard.style.borderColor = theme.primary;
            });

            categoryCard.addEventListener('mouseout', function() {
                categoryCard.style.transform = 'translateY(0)';
                categoryCard.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                categoryCard.style.borderColor = '#e2e8f0';
            });

            categoryCard.addEventListener('click', function() {
                showProductCatalog(onComplete, category.id);
            });

            // Icon (only if enabled in config)
            if (categoriesConfig.displayOptions.showIcons && category.icon) {
                var iconDiv = document.createElement('div');
                iconDiv.innerText = category.icon;
                iconDiv.style.fontSize = '2rem';
                iconDiv.style.flexShrink = '0';
                categoryCard.appendChild(iconDiv);
            }

            // Content
            var contentDiv = document.createElement('div');
            contentDiv.style.flex = '1';

            var categoryName = document.createElement('h3');
            categoryName.innerText = category.name;
            categoryName.style.fontSize = '1rem';
            categoryName.style.fontWeight = '600';
            categoryName.style.color = theme.text;
            categoryName.style.margin = '0 0 0.25rem 0';

            var categoryDesc = document.createElement('p');
            categoryDesc.innerText = category.description;
            categoryDesc.style.fontSize = '0.875rem';
            categoryDesc.style.color = '#6b7280';
            categoryDesc.style.margin = '0';

            contentDiv.appendChild(categoryName);
            if (categoriesConfig.displayOptions.showDescriptions) {
                contentDiv.appendChild(categoryDesc);
            }

            // Arrow
            var arrowDiv = document.createElement('div');
            arrowDiv.innerText = '→';
            arrowDiv.style.fontSize = '1.25rem';
            arrowDiv.style.color = theme.primary;
            arrowDiv.style.fontWeight = '600';
            arrowDiv.style.flexShrink = '0';

            categoryCard.appendChild(contentDiv);
            categoryCard.appendChild(arrowDiv);

            return categoryCard;
        }

        // Load categories and display them
        loadCategories().then(function(categories) {
            // Add all category cards
            categories.forEach(function(category) {
                var categoryCard = createCategoryCard(category);
                categoriesContainer.appendChild(categoryCard);
            });

            // Back button
            var backBtn = document.createElement('button');
            backBtn.innerText = '← Back to Options';
            backBtn.style.width = '100%';
            backBtn.style.maxWidth = '300px';
            backBtn.style.padding = '0.75rem 1rem';
            backBtn.style.background = 'transparent';
            backBtn.style.color = theme.primary;
            backBtn.style.border = '1px solid ' + theme.primary;
            backBtn.style.borderRadius = '0.375rem';
            backBtn.style.cursor = 'pointer';
            backBtn.style.fontSize = '0.875rem';
            backBtn.style.transition = 'all 0.2s ease-in-out';
            backBtn.style.marginTop = '1rem';

            backBtn.addEventListener('mouseover', function() {
                backBtn.style.background = theme.primary;
                backBtn.style.color = '#ffffff';
            });

            backBtn.addEventListener('mouseout', function() {
                backBtn.style.background = 'transparent';
                backBtn.style.color = theme.primary;
            });

            backBtn.addEventListener('click', function() {
                showEntryPoints(onComplete);
            });

            wrapper.appendChild(categoriesContainer);
            wrapper.appendChild(backBtn);
            messages.appendChild(wrapper);
        });
    }

    // Helper function to get category display name
    function getCategoryDisplayName(categoryId) {
        var categoryNames = {
            '1_trip': '1 Trip',
            'cargo_worthy': 'Cargo Worthy',
            'wind_water_tight': 'Wind & Water Tight',
            'economy_grade': 'Economy Grade',
            'multi_trip': 'Multi-Trip',
            'office_containers': 'Office Containers',
            'accessories': 'Accessories'
        };
        return categoryNames[categoryId] || 'Products';
    }

    function showProductCatalog(onComplete, selectedCategory) {
        messages.innerHTML = '';

        var wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.flexDirection = 'column';
        wrapper.style.alignItems = 'center';
        wrapper.style.justifyContent = 'flex-start';
        wrapper.style.height = '100%';
        wrapper.style.width = '100%';
        wrapper.style.gap = '1rem';
        wrapper.style.padding = '1rem';
        wrapper.style.overflowY = 'auto';

        // Title
        var title = document.createElement('h2');
        title.innerText = getCategoryDisplayName(selectedCategory) + ' Products';
        title.style.fontSize = '1.25rem';
        title.style.fontWeight = '600';
        title.style.color = theme.text;
        title.style.textAlign = 'center';
        title.style.margin = '0';
        wrapper.appendChild(title);

        // Category breadcrumb
        var breadcrumb = document.createElement('div');
        breadcrumb.innerText = '← Back to Categories';
        breadcrumb.style.fontSize = '0.875rem';
        breadcrumb.style.color = theme.primary;
        breadcrumb.style.cursor = 'pointer';
        breadcrumb.style.textDecoration = 'underline';
        breadcrumb.style.marginBottom = '0.5rem';
        breadcrumb.style.textAlign = 'center';

        breadcrumb.addEventListener('click', function() {
            showProductCategories(onComplete);
        });
        wrapper.appendChild(breadcrumb);

        // Declare variables at function scope level
        var currentSort = 'price-low';
        var sortControls = null;
        var filteredProducts = [];
        var productsContainer = null;

        // Load products from backend or use fallback data
        async function loadProducts() {
            var products = [];

            // Show loading state
            var loadingDiv = document.createElement('div');
            loadingDiv.innerText = 'Loading products...';
            loadingDiv.style.textAlign = 'center';
            loadingDiv.style.padding = '2rem';
            loadingDiv.style.color = theme.text;
            wrapper.appendChild(loadingDiv);

            try {
                // Check if we're running from file:// protocol
                var isFileProtocol = window.location.protocol === 'file:';

                // Try to fetch from backend endpoint first (only if not file protocol)
                if (productsConfig.endpoint && !isFileProtocol) {
                    console.log('Fetching products from:', productsConfig.endpoint);
                    var response = await fetch(productsConfig.endpoint, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': apiConfig.token ? `Token ${apiConfig.token}` : undefined
                        }
                    });

                    if (response.ok) {
                        var data = await response.json();
                        products = Array.isArray(data) ? data : data.products || [];
                        console.log('Loaded', products.length, 'products from backend');
                    } else {
                        console.warn('Failed to fetch products from backend:', response.status);
                        throw new Error('Backend fetch failed');
                    }
                } else if (productsConfig.data && productsConfig.data.length > 0) {
                    // Use inline product data from config
                    products = productsConfig.data;
                    console.log('Using configured product data:', products.length, 'products');
                } else {
                    // Load from local JSON file (skip if file protocol to avoid CORS)
                    if (!isFileProtocol) {
                        console.log('Loading products from local JSON file');
                        try {
                            var response = await fetch('./products.json');
                            if (response.ok) {
                                var data = await response.json();
                                products = data.products || [];
                                console.log('Loaded', products.length, 'products from local JSON');
                            } else {
                                throw new Error('Local JSON fetch failed');
                            }
                        } catch (fetchError) {
                            console.log('Local JSON fetch failed, will use fallback data:', fetchError.message);
                            throw new Error('Local JSON fetch failed');
                        }
                    } else {
                        console.log('Running from file:// protocol, skipping local JSON fetch to avoid CORS');
                        throw new Error('File protocol - use fallback data');
                    }
                }
            } catch (error) {
                console.log('Using fallback product data:', error.message);
                // Use embedded fallback data only if enabled in config
                if (productsConfig.useEmbeddedFallback) {
                    products = [
                        {
                            "title": "20ft Shipping Container Standard 1 Trip with Doors at Both Ends",
                            "price": 5462,
                            "url": "https://containerone.net/products/20ft-shipping-container-standard-1-trip-with-doors-at-both-ends-20stdd1trip?zip_code=13082",
                            "deliveryTimeline": "Check",
                            "url_label": "View details here",
                            "salePrice": 5356,
                            "pickupPrice": 3816,
                            "category": "20ft",
                            "type": "Standard 1 Trip",
                            "condition": "New",
                            "features": ["Wind Tight", "Water Tight", "Cargo Worthy"]
                        },
                        {
                            "title": "20ft Standard 1 Trip Modified Shipping Container With Man Door",
                            "price": 7851,
                            "url": "https://containerone.net/products/20ft-standard-1-trip-modified-shipping-container-with-man-door-20mod1trip?zip_code=13082",
                            "deliveryTimeline": "Contact a product specialist for a delivery timeline for this item",
                            "url_label": "View details here",
                            "salePrice": 7745,
                            "pickupPrice": 6205,
                            "category": "20ft",
                            "type": "Modified 1 Trip",
                            "condition": "Modified",
                            "features": ["Man Door", "Wind Tight", "Water Tight"]
                        },
                        {
                            "title": "20ft Standard 1 Trip Shipping Container",
                            "price": 4561,
                            "url": "https://containerone.net/products/20ft-standard-1-trip-shipping-container-20st1trip?zip_code=13082",
                            "deliveryTimeline": "Tan 5-10",
                            "url_label": "View details here",
                            "salePrice": 4455,
                            "pickupPrice": 2915,
                            "category": "20ft",
                            "type": "Standard 1 Trip",
                            "condition": "New",
                            "features": ["Wind Tight", "Water Tight", "Cargo Worthy"]
                        },
                        {
                            "title": "40ft High Cube Shipping Container - Wind & Water Tight",
                            "price": 8950,
                            "url": "https://containerone.net/products/40ft-high-cube-wind-water-tight?zip_code=13082",
                            "deliveryTimeline": "5-10",
                            "url_label": "View details here",
                            "salePrice": 8750,
                            "pickupPrice": 7200,
                            "category": "40ft",
                            "type": "Wind & Water Tight",
                            "condition": "Used",
                            "features": ["Wind Tight", "Water Tight", "High Cube"]
                        },
                        {
                            "title": "40ft Cargo Worthy Shipping Container",
                            "price": 7200,
                            "url": "https://containerone.net/products/40ft-cargo-worthy-container?zip_code=13082",
                            "deliveryTimeline": "5-10",
                            "url_label": "View details here",
                            "salePrice": 6950,
                            "pickupPrice": 5800,
                            "category": "40ft",
                            "type": "Cargo Worthy",
                            "condition": "Used",
                            "features": ["Cargo Worthy", "Wind Tight", "Water Tight"]
                        },
                        {
                            "title": "20ft Economy Grade Container",
                            "price": 3200,
                            "url": "https://containerone.net/products/20ft-economy-container?zip_code=13082",
                            "deliveryTimeline": "Check",
                            "url_label": "View details here",
                            "salePrice": 3100,
                            "pickupPrice": 2200,
                            "category": "20ft",
                            "type": "Economy Grade",
                            "condition": "Used",
                            "features": ["Basic Condition"]
                        },
                        {
                            "title": "40ft Multi-Trip Shipping Container",
                            "price": 6500,
                            "url": "https://containerone.net/products/40ft-multi-trip-container?zip_code=13082",
                            "deliveryTimeline": "5-10",
                            "url_label": "View details here",
                            "salePrice": 6300,
                            "pickupPrice": 5200,
                            "category": "40ft",
                            "type": "Multi-Trip",
                            "condition": "Used",
                            "features": ["Multi-Trip", "Wind Tight", "Water Tight"]
                        },
                        {
                            "title": "20ft Office Container with Windows and Door",
                            "price": 12500,
                            "url": "https://containerone.net/products/20ft-office-container?zip_code=13082",
                            "deliveryTimeline": "Contact",
                            "url_label": "View details here",
                            "salePrice": 12200,
                            "pickupPrice": 9800,
                            "category": "20ft",
                            "type": "Office Container",
                            "condition": "Modified",
                            "features": ["Office Setup", "Windows", "Insulation", "Electrical"]
                        },
                        {
                            "title": "Container Lock Box Security System",
                            "price": 450,
                            "url": "https://containerone.net/products/container-lock-box?zip_code=13082",
                            "deliveryTimeline": "5-10",
                            "url_label": "View details here",
                            "salePrice": 425,
                            "pickupPrice": 400,
                            "category": "Accessories",
                            "type": "Security Accessory",
                            "condition": "New",
                            "features": ["Security", "Lock System"]
                        },
                        {
                            "title": "Container Ventilation System",
                            "price": 280,
                            "url": "https://containerone.net/products/container-ventilation?zip_code=13082",
                            "deliveryTimeline": "5-10",
                            "url_label": "View details here",
                            "salePrice": 260,
                            "pickupPrice": 240,
                            "category": "Accessories",
                            "type": "Ventilation Accessory",
                            "condition": "New",
                            "features": ["Ventilation", "Air Flow"]
                        },
                        {
                            "title": "20ft Cargo Worthy Container - Single Trip",
                            "price": 4200,
                            "url": "https://containerone.net/products/20ft-cargo-worthy-single-trip?zip_code=13082",
                            "deliveryTimeline": "5-10",
                            "url_label": "View details here",
                            "salePrice": 4100,
                            "pickupPrice": 3500,
                            "category": "20ft",
                            "type": "Cargo Worthy",
                            "condition": "Used",
                            "features": ["Cargo Worthy", "Wind Tight", "Water Tight"]
                        },
                        {
                            "title": "40ft Economy Grade Container",
                            "price": 4800,
                            "url": "https://containerone.net/products/40ft-economy-container?zip_code=13082",
                            "deliveryTimeline": "Check",
                            "url_label": "View details here",
                            "salePrice": 4650,
                            "pickupPrice": 3800,
                            "category": "40ft",
                            "type": "Economy Grade",
                            "condition": "Used",
                            "features": ["Basic Condition"]
                        },
                        {
                            "title": "20ft Multi-Trip Container",
                            "price": 5800,
                            "url": "https://containerone.net/products/20ft-multi-trip-container?zip_code=13082",
                            "deliveryTimeline": "5-10",
                            "url_label": "View details here",
                            "salePrice": 5650,
                            "pickupPrice": 4800,
                            "category": "20ft",
                            "type": "Multi-Trip",
                            "condition": "Used",
                            "features": ["Multi-Trip", "Wind Tight", "Water Tight"]
                        },
                        {
                            "title": "40ft Office Container with Full Setup",
                            "price": 18500,
                            "url": "https://containerone.net/products/40ft-office-container-full?zip_code=13082",
                            "deliveryTimeline": "Contact",
                            "url_label": "View details here",
                            "salePrice": 18200,
                            "pickupPrice": 16500,
                            "category": "40ft",
                            "type": "Office Container",
                            "condition": "Modified",
                            "features": ["Office Setup", "Windows", "Insulation", "Electrical", "HVAC"]
                        },
                        {
                            "title": "Container Door Hardware Kit",
                            "price": 180,
                            "url": "https://containerone.net/products/container-door-hardware?zip_code=13082",
                            "deliveryTimeline": "5-10",
                            "url_label": "View details here",
                            "salePrice": 165,
                            "pickupPrice": 150,
                            "category": "Accessories",
                            "type": "Hardware Accessory",
                            "condition": "New",
                            "features": ["Hardware", "Door Components"]
                        },
                        {
                            "title": "Container Insulation Kit",
                            "price": 320,
                            "url": "https://containerone.net/products/container-insulation-kit?zip_code=13082",
                            "deliveryTimeline": "5-10",
                            "url_label": "View details here",
                            "salePrice": 300,
                            "pickupPrice": 280,
                            "category": "Accessories",
                            "type": "Insulation Accessory",
                            "condition": "New",
                            "features": ["Insulation", "Temperature Control"]
                        }
                    ];
                } else {
                    console.log('Embedded fallback disabled in config');
                }
            }

            // Remove loading state
            if (loadingDiv.parentNode) {
                loadingDiv.parentNode.removeChild(loadingDiv);
            }

            return products;
        }

        // Filter products by category
        function filterProductsByCategory(products, categoryId) {
            if (!categoryId || categoryId === 'all') {
                return products;
            }

            // Load categories to get filter configuration
            var categories = categoriesConfig.data || [];

            // Find the category configuration
            var categoryConfig = categories.find(function(cat) {
                return cat.id === categoryId;
            });

            if (!categoryConfig || !categoryConfig.filter) {
                // Fallback to legacy filtering if no config found
                return products.filter(function(product) {
                    // Map category IDs to product properties (legacy logic)
                    var categoryMappings = {
                        '1_trip': function(p) { return p.type && p.type.toLowerCase().includes('1 trip'); },
                        'cargo_worthy': function(p) { return p.type && p.type.toLowerCase().includes('cargo worthy'); },
                        'wind_water_tight': function(p) { return p.type && p.type.toLowerCase().includes('wind') && p.type.toLowerCase().includes('water'); },
                        'economy_grade': function(p) { return p.type && p.type.toLowerCase().includes('economy'); },
                        'multi_trip': function(p) { return p.type && p.type.toLowerCase().includes('multi-trip'); },
                        'office_containers': function(p) { return p.type && p.type.toLowerCase().includes('office'); },
                        'accessories': function(p) { return p.type && p.type.toLowerCase().includes('accessory'); }
                    };

                    var filterFn = categoryMappings[categoryId];
                    return filterFn ? filterFn(product) : true;
                });
            }

            // Use configurable filter
            return products.filter(function(product) {
                var filter = categoryConfig.filter;

                // Apply filter based on filter type
                if (filter.type) {
                    // Filter by product type
                    if (!product.type || !product.type.toLowerCase().includes(filter.type.toLowerCase())) {
                        return false;
                    }
                }

                if (filter.category) {
                    // Filter by product category
                    if (!product.category || !product.category.toLowerCase().includes(filter.category.toLowerCase())) {
                        return false;
                    }
                }

                if (filter.condition) {
                    // Filter by product condition
                    if (!product.condition || !product.condition.toLowerCase().includes(filter.condition.toLowerCase())) {
                        return false;
                    }
                }

                if (filter.features && filter.features.length > 0) {
                    // Filter by required features
                    if (!product.features || !Array.isArray(product.features)) {
                        return false;
                    }

                    // Check if product has all required features
                    for (var i = 0; i < filter.features.length; i++) {
                        var requiredFeature = filter.features[i].toLowerCase();
                        var hasFeature = product.features.some(function(feature) {
                            return feature.toLowerCase().includes(requiredFeature);
                        });

                        if (!hasFeature) {
                            return false;
                        }
                    }
                }

                return true;
            });
        }

        // Load products and then set up the catalog
        loadProducts().then(function(products) {
            // Filter products by selected category
            filteredProducts = filterProductsByCategory(products, selectedCategory);

            // Set default sort from config
            currentSort = productsConfig.sorting ? productsConfig.sorting.defaultSort : 'price-low';

            // Sort controls container (only if sorting is enabled)
            if (productsConfig.sorting && productsConfig.sorting.enabled) {
                sortControls = document.createElement('div');
                sortControls.style.display = 'flex';
                sortControls.style.flexWrap = 'wrap';
                sortControls.style.gap = '0.5rem';
                sortControls.style.marginBottom = '1rem';
                sortControls.style.padding = '0.5rem';
                sortControls.style.background = '#f9fafb';
                sortControls.style.borderRadius = '0.5rem';
                sortControls.style.border = '1px solid #e5e7eb';

                function createSortButton(label, sortType) {
                    var button = document.createElement('button');
                    button.innerText = label;
                    button.style.padding = '0.5rem 1rem';
                    button.style.background = currentSort === sortType ? theme.primary : '#f3f4f6';
                    button.style.color = currentSort === sortType ? '#ffffff' : '#374151';
                    button.style.border = '1px solid #d1d5db';
                    button.style.borderRadius = '0.375rem';
                    button.style.cursor = 'pointer';
                    button.style.fontSize = '0.75rem';
                    button.style.fontWeight = '500';
                    button.style.transition = 'all 0.2s ease-in-out';

                    button.addEventListener('mouseover', function() {
                        if (currentSort !== sortType) {
                            button.style.background = '#e5e7eb';
                        }
                    });

                    button.addEventListener('mouseout', function() {
                        if (currentSort !== sortType) {
                            button.style.background = '#f3f4f6';
                        }
                    });

                    button.addEventListener('click', function() {
                        currentSort = sortType;
                        updateSortButtons();
                        sortAndDisplayProducts();
                    });

                    return button;
                }

                var sortButtons = [];
                var sortOptions = productsConfig.sorting.options || [
                    { id: 'price-low', label: 'Price: Low to High' },
                    { id: 'price-high', label: 'Price: High to Low' },
                    { id: 'size-20ft', label: 'Size: 20ft First' },
                    { id: 'size-40ft', label: 'Size: 40ft First' },
                    { id: 'name-asc', label: 'Name A-Z' },
                    { id: 'delivery', label: 'Delivery Time' }
                ];

                sortOptions.forEach(function(option) {
                    sortButtons.push(createSortButton(option.label, option.id));
                });

                sortButtons.forEach(function(button) {
                    sortControls.appendChild(button);
                });

                function updateSortButtons() {
                    sortButtons.forEach(function(button, index) {
                        var sortType = sortOptions[index].id;
                        if (currentSort === sortType) {
                            button.style.background = theme.primary;
                            button.style.color = '#ffffff';
                        } else {
                            button.style.background = '#f3f4f6';
                            button.style.color = '#374151';
                        }
                    });
                }
            }

        // Products container
        productsContainer = document.createElement('div');
        productsContainer.style.display = 'flex';
        productsContainer.style.flexDirection = 'column';
        productsContainer.style.gap = '1rem';
        productsContainer.style.width = '100%';
        productsContainer.style.maxWidth = '400px';

        function sortProducts(productsArray, sortType) {
            var sorted = [...productsArray];

            switch (sortType) {
                case 'price-low':
                    return sorted.sort((a, b) => a.salePrice - b.salePrice);
                case 'price-high':
                    return sorted.sort((a, b) => b.salePrice - a.salePrice);
                case 'size-20ft':
                    return sorted.sort((a, b) => {
                        if (a.category === '20ft' && b.category !== '20ft') return -1;
                        if (a.category !== '20ft' && b.category === '20ft') return 1;
                        return a.salePrice - b.salePrice;
                    });
                case 'size-40ft':
                    return sorted.sort((a, b) => {
                        if (a.category === '40ft' && b.category !== '40ft') return -1;
                        if (a.category !== '40ft' && b.category === '40ft') return 1;
                        return a.salePrice - b.salePrice;
                    });
                case 'name-asc':
                    return sorted.sort((a, b) => a.title.localeCompare(b.title));
                case 'delivery':
                    return sorted.sort((a, b) => {
                        var deliveryOrder = {
                            '5-10': 1,
                            'Tan 5-10': 2,
                            'Check': 3
                        };
                        var aOrder = deliveryOrder[a.deliveryTimeline] || 4;
                        var bOrder = deliveryOrder[b.deliveryTimeline] || 4;
                        if (aOrder !== bOrder) return aOrder - bOrder;
                        return a.salePrice - b.salePrice;
                    });
                default:
                    return sorted;
            }
        }

        function createProductCard(product) {
            var productCard = document.createElement('div');
            productCard.style.background = '#ffffff';
            productCard.style.border = '1px solid #e2e8f0';
            productCard.style.borderRadius = '0.5rem';
            productCard.style.padding = '1rem';
            productCard.style.cursor = 'pointer';
            productCard.style.transition = 'all 0.2s ease-in-out';
            productCard.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';

            productCard.addEventListener('mouseover', function() {
                productCard.style.transform = 'translateY(-2px)';
                productCard.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
            });

            productCard.addEventListener('mouseout', function() {
                productCard.style.transform = 'translateY(0)';
                productCard.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
            });

            productCard.addEventListener('click', function() {
                window.open(product.url, '_blank');
            });

            var productTitle = document.createElement('h3');
            productTitle.innerText = product.title;
            productTitle.style.fontSize = '0.875rem';
            productTitle.style.fontWeight = '600';
            productTitle.style.color = theme.text;
            productTitle.style.margin = '0 0 0.5rem 0';
            productTitle.style.lineHeight = '1.3';

            productCard.appendChild(productTitle);

            // Category and Type badge (configurable)
            if (productsConfig.displayFields.showCategory || productsConfig.displayFields.showType) {
                var categoryBadge = document.createElement('div');
                var badgeText = '';
                if (productsConfig.displayFields.showCategory && product.category) {
                    badgeText += product.category;
                }
                if (productsConfig.displayFields.showType && product.type) {
                    if (badgeText) badgeText += ' • ';
                    badgeText += product.type;
                }

                if (badgeText) {
                    categoryBadge.innerText = badgeText;
                    categoryBadge.style.fontSize = '0.75rem';
                    categoryBadge.style.color = theme.primary;
                    categoryBadge.style.fontWeight = '500';
                    categoryBadge.style.marginBottom = '0.5rem';
                    productCard.appendChild(categoryBadge);
                }
            }

            // Price container (configurable)
            if (productsConfig.displayFields.showPrice) {
                var priceContainer = document.createElement('div');
                priceContainer.style.display = 'flex';
                priceContainer.style.alignItems = 'center';
                priceContainer.style.gap = '0.5rem';
                priceContainer.style.marginBottom = '0.5rem';

                var salePrice = document.createElement('span');
                salePrice.innerText = '$' + product.salePrice.toLocaleString();
                salePrice.style.fontSize = '1.125rem';
                salePrice.style.fontWeight = '700';
                salePrice.style.color = '#059669';

                priceContainer.appendChild(salePrice);

                // Original price and savings (configurable)
                if (productsConfig.displayFields.showOriginalPrice && product.price && product.price > product.salePrice) {
                    var originalPrice = document.createElement('span');
                    originalPrice.innerText = '$' + product.price.toLocaleString();
                    originalPrice.style.fontSize = '0.875rem';
                    originalPrice.style.textDecoration = 'line-through';
                    originalPrice.style.color = '#9ca3af';
                    priceContainer.appendChild(originalPrice);
                }

                if (productsConfig.displayFields.showSavings && product.price && product.price > product.salePrice) {
                    var savings = document.createElement('span');
                    savings.innerText = 'Save $' + (product.price - product.salePrice).toLocaleString();
                    savings.style.fontSize = '0.75rem';
                    savings.style.color = '#059669';
                    savings.style.fontWeight = '500';
                    priceContainer.appendChild(savings);
                }

                productCard.appendChild(priceContainer);
            }

            // Delivery info (configurable)
            if (productsConfig.displayFields.showDelivery && product.deliveryTimeline) {
                var deliveryInfo = document.createElement('div');
                deliveryInfo.style.fontSize = '0.75rem';
                deliveryInfo.style.color = '#6b7280';
                deliveryInfo.style.marginBottom = '0.5rem';

                if (product.deliveryTimeline === '5-10' || product.deliveryTimeline === 'Tan 5-10') {
                    deliveryInfo.innerHTML = '🚚 <strong>Delivery:</strong> 5-10 days';
                } else if (product.deliveryTimeline.includes('Contact')) {
                    deliveryInfo.innerHTML = '📞 <strong>Delivery:</strong> Contact for timeline';
                } else if (product.deliveryTimeline === 'Check') {
                    deliveryInfo.innerHTML = '🔍 <strong>Delivery:</strong> Check availability';
                } else {
                    deliveryInfo.innerHTML = '🚚 <strong>Delivery:</strong> ' + product.deliveryTimeline;
                }

                productCard.appendChild(deliveryInfo);
            }

            // Pickup info (configurable)
            if (productsConfig.displayFields.showPickup && product.pickupPrice) {
                var pickupInfo = document.createElement('div');
                pickupInfo.innerHTML = '🏢 <strong>Pickup Price:</strong> $' + product.pickupPrice.toLocaleString();
                pickupInfo.style.fontSize = '0.75rem';
                pickupInfo.style.color = '#6b7280';
                pickupInfo.style.marginBottom = '0.5rem';
                productCard.appendChild(pickupInfo);
            }

            // View details link
            var viewButton = document.createElement('div');
            viewButton.innerHTML = '🔗 ' + (product.url_label || 'View details');
            viewButton.style.fontSize = '0.75rem';
            viewButton.style.color = theme.primary || '#3b82f6';
            viewButton.style.fontWeight = '500';
            viewButton.style.textDecoration = 'underline';

            productCard.appendChild(viewButton);

            return productCard;
        }

        function sortAndDisplayProducts() {
            var sortedProducts = sortProducts(filteredProducts, currentSort);
            productsContainer.innerHTML = '';

            sortedProducts.forEach(function(product) {
                var productCard = createProductCard(product);
                productsContainer.appendChild(productCard);
            });
        }

        // Initial display
        sortAndDisplayProducts();

        // Back button
        var backBtn = document.createElement('button');
        backBtn.innerText = '← Back to Options';
        backBtn.style.width = '100%';
        backBtn.style.maxWidth = '300px';
        backBtn.style.padding = '0.75rem 1rem';
        backBtn.style.background = 'transparent';
        backBtn.style.color = theme.primary;
        backBtn.style.border = '1px solid ' + theme.primary;
        backBtn.style.borderRadius = '0.375rem';
        backBtn.style.cursor = 'pointer';
        backBtn.style.fontSize = '0.875rem';
        backBtn.style.transition = 'all 0.2s ease-in-out';
        backBtn.style.marginTop = '1rem';

        backBtn.addEventListener('mouseover', function() {
            backBtn.style.background = theme.primary;
            backBtn.style.color = '#ffffff';
        });

        backBtn.addEventListener('mouseout', function() {
            backBtn.style.background = 'transparent';
            backBtn.style.color = theme.primary;
        });

        backBtn.addEventListener('click', function() {
            showEntryPoints(onComplete);
        });

        // Add sort controls to wrapper if they exist
        if (sortControls) {
            wrapper.appendChild(sortControls);
        }
        wrapper.appendChild(productsContainer);
        wrapper.appendChild(backBtn);
        messages.appendChild(wrapper);
        });
    }

    // Custom form for lead capture
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

    // Submit button (previously Start Chat)
    var confirmBtn = document.createElement('button');
    confirmBtn.innerText = 'Submit';
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

            // Generate and store chat session data
            var chatID = generateChatId();
            var workflow_id = workflowId;
            var wsParams = await generateSecureWsParams(workflow_id);

            // Store chat session data in localStorage
            var chatSessionData = {
                chatID: chatID,
                workflowId: workflow_id,
                hashedWorkflowId: wsParams.hashed_workflow_id,
                hash: wsParams.hash,
                visitorInfo: visitorInfo,
                timestamp: new Date().toISOString()
            };
            localStorage.setItem('simple-chat-session', JSON.stringify(chatSessionData));

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

            // After lead submission, hide chat input and quick buttons and show only the entry points/options menu
            // User must choose what to do next; we'll only show chat or products after they pick an option
            try {
                inputContainer.style.display = 'none';
                quickButtonsContainer.style.display = 'none';
            } catch (e) {
                // ignore
            }

            showEntryPoints(function(result) {
                isFormShowing = false;
                updateButtonStates();
                window.__simpleChatEmbedLeadCaptured = true;

                // Attach entry point info to the saved lead for later use
                if (leadData) {
                    window.SimpleChatEmbedLead = leadData;
                    if (result && result.entryPoint) {
                        window.SimpleChatEmbedLead.entryPoint = result.entryPoint;
                    }
                    if (result && result.formData) {
                        window.SimpleChatEmbedLead.entryPointData = result.formData;
                    }
                }

                // Only show chat input if the user explicitly selected a chat/info entry
                if (result && result.entryPoint === 'get_info') {
                    setupChatInput();
                    if (welcomeMessage) {
                        saveMessage(welcomeMessage, 'bot', 'welcomeMessage');
                    }
                    loadMessages();
                } else if (result && result.entryPoint === 'browse_products') {
                    // Show product categories/catalog
                    showProductCategories(function() {
                        // Once product browsing is done, you may choose to open chat input explicitly
                    });
                } else {
                    // For other entry points (book_call, support, etc.) we keep the menu-focused UX and
                    // only open the chat if a follow-up action requires it.
                }
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

        // Always show lead capture form first if not already captured
        if (!window.__simpleChatEmbedLeadCaptured) {
            inputContainer.style.display = 'none';
            showLeadCaptureInChat(function (lead) {
                isFormShowing = false;
                updateButtonStates();
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
                // After lead capture, ensure session is set and visitorInfo is present before connecting
                setTimeout(function() {
                    var storedSession = localStorage.getItem('simple-chat-session');
                    if (storedSession) {
                        try {
                            var sessionData = JSON.parse(storedSession);
                            if (sessionData.chatID && sessionData.workflowId && sessionData.hashedWorkflowId && sessionData.hash && sessionData.visitorInfo && sessionData.visitorInfo.id) {
                                connectWebSocket();
                            }
                        } catch (e) {}
                    }
                }, 200);
            });
            return;
        }

        // If we have messages and session data, skip the form
        if (existingMessages.length > 0 && storedSession) {
            window.__simpleChatEmbedLeadCaptured = true;
            let validSession = false;
            try {
                var sessionData = JSON.parse(storedSession);
                visitorInfo = sessionData.visitorInfo;
                if (sessionData.handoverOccurred === true) {
                    isHandoverActive = true;
                }
                if (sessionData.chatID && sessionData.workflowId && sessionData.hashedWorkflowId && sessionData.hash && sessionData.visitorInfo) {
                    validSession = true;
                }
            } catch (error) {
                console.log('Error parsing session data:', error);
            }
            setupChatInput();
            loadMessages();
            setTimeout(function () {
                forceScrollToBottom();
            }, 200);
            if (validSession && visitorInfo && visitorInfo.id) {
                connectWebSocket();
            }
            return;
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

    // Create chat toggle button (safe: wrapped with try/catch and normalized zIndex)
    var chatToggle;
    try {
        chatToggle = document.createElement('button');
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

        // Normalize zIndex: ensure it's a number and fallback to a safe default
        var safeZ = Number(theme && theme.zIndex);
        if (!isFinite(safeZ)) safeZ = 9999;
        chatToggle.style.zIndex = String(safeZ - 1);
    } catch (err) {
        console.error('Failed to create chat toggle button:', err);
        // Fallback: create a minimal placeholder so rest of script can proceed
        try {
            chatToggle = document.createElement('button');
            chatToggle.innerText = 'Chat';
            chatToggle.style.position = 'fixed';
            chatToggle.style.bottom = '20px';
            chatToggle.style.right = '20px';
            chatToggle.style.zIndex = '9998';
        } catch (err2) {
            console.error('Failed to create fallback chat toggle:', err2);
            chatToggle = null;
        }
    }

    // Responsive positioning and toggle wiring for chat toggle button
    function setToggleResponsive() {
        try {
            if (!chatToggle) return;
            // both branches same but kept for future customization
            chatToggle.style.bottom = '20px';
            chatToggle.style.right = '20px';
        } catch (e) {
            console.error('Error in setToggleResponsive:', e);
        }
    }

    // Initially hide the chat container
    chatContainer.style.display = 'none';

    // Toggle functionality
    var chatOpen = false;

    if (chatToggle) {
        try {
            setToggleResponsive();
            window.addEventListener('resize', setToggleResponsive);

            chatToggle.addEventListener('click', function () {
                try {
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
                } catch (err) {
                    console.error('Error handling chatToggle click:', err);
                }
            });

            // Close button functionality from header
            chatCloseBtn.onclick = function () {
                try {
                    chatOpen = false;
                    chatContainer.style.display = 'none';
                    if (chatToggle) chatToggle.style.display = 'flex';
                } catch (err) {
                    console.error('Error in chatCloseBtn.onclick:', err);
                }
            };

            // Add the toggle button to body
            try {
                document.body.appendChild(chatToggle);
            } catch (err) {
                console.error('Failed to append chatToggle to body:', err);
            }
        } catch (outerErr) {
            console.error('Failed to initialize chat toggle:', outerErr);
        }
    } else {
        // If chatToggle could not be created, still wire close button safely
        chatCloseBtn.onclick = function () {
            chatOpen = false;
            chatContainer.style.display = 'none';
        };
    }

    // Expose functions globally for testing
    window.saveMessage = saveMessage;
    window.loadMessages = loadMessages;
    window.generateChatId = generateChatId;
    window.generateSecureWsParams = generateSecureWsParams;
    window.connectWebSocket = connectWebSocket;

    // Helper function to create visitor
    const createVisitor = async (name, email, phone, zip) => {
        try {
            var baseUrl = apiConfig.baseUrl;
            var token = apiConfig.token;
            var visitorsEndpoint = apiConfig.endpoints.visitors;

        // Normalize base and endpoint to avoid accidental double-slashes
        var base = String(baseUrl || '').replace(/\/+$/g, '');
        var endpoint = String(visitorsEndpoint || '').replace(/^\/+|\/+$/g, '');

        const getVisitor = await fetch(`${base}/${endpoint}/?email=${encodeURIComponent(email)}`, {
                method: "GET",
                headers: {
                    'Content-Type': 'application/json',
            'Authorization': `Token ${token}`,
                }
            })

            const getVisitorJson = await getVisitor.json();

            if (getVisitorJson.detail === "Not found." || !getVisitorJson.length) {
                // If visitor does not exist, create a new one
        const visitor = await fetch(`${base}/${endpoint}/`, {
                    method: "POST",
                    headers: {
                        'Content-Type': 'application/json',
            'Authorization': `Token ${token}`,
                    },
                    body: JSON.stringify({
                        name,
                        email,
                        phone_number: phone,
                        zip_code: zip
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
