(function () {
  'use strict';

  // Dynamic Chat Embed: Backend-driven config support with full chat functionality
  function initChatEmbed(config) {
    console.log('Initializing dynamic chat embed with config:', config);

    // Default theme
    var defaultTheme = {
      primary: '#8349ff',
      headerBg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      userBubble: '#8349ff',
      botBubble: '#f8f9fa',
      userText: '#fff',
      botText: '#2d3748',
      background: '#fff',
      border: '#e2e8f0',
      text: '#2d3748',
      headerText: '#fff',
      inputBg: '#fff',
      inputText: '#2d3748',
      sendBtnBg: '#8349ff',
      sendBtnText: '#fff',
      sendBtnHover: '#6b2fff'
    };

    var theme = Object.assign({}, defaultTheme, config.theme || {});

    // State management
    var isFormShowing = false;
    var isHandoverActive = false;
    var leadCaptured = false;
    var currentScreen = null;
    var navigationStack = []; // Track navigation history for proper back functionality
    var messagesContainer;
    var inputContainer;

    // Add CSS animations
    var style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes typingBounce {
        0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
        40% { transform: translateY(-6px); }
        60% { transform: translateY(-3px); }
      }
      #simple-chat-embed #chat-messages::-webkit-scrollbar {
        width: 6px;
      }
      #simple-chat-embed #chat-messages::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 3px;
      }
      #simple-chat-embed #chat-messages::-webkit-scrollbar-thumb {
        background: #c1c1c1;
        border-radius: 3px;
      }
      #simple-chat-embed #chat-messages::-webkit-scrollbar-thumb:hover {
        background: #a8a8a8;
      }
    `;
    document.head.appendChild(style);

    // Create chat container
    var chatContainer = document.createElement('div');
    chatContainer.id = 'simple-chat-embed';
    chatContainer.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 384px;
      height: 80vh;
      max-height: 600px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 0.75rem;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      font-family: Inter, system-ui, sans-serif;
      z-index: 9999;
      color: ${theme.text};
      transition: transform 0.3s ease-in-out;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    `;

    // Create header
    var header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: ${theme.headerBg};
      color: ${theme.headerText};
      padding: 1rem;
      border-top-left-radius: 0.75rem;
      border-top-right-radius: 0.75rem;
      font-weight: 600;
      font-size: 1rem;
    `;

    // Back button (appears when forms are showing) - create first
    var backBtn = document.createElement('button');
    backBtn.innerText = 'Back';
    backBtn.title = 'Back to options';
    backBtn.style.cssText = `
      background: transparent;
      color: ${theme.headerText};
      border: 1px solid ${theme.headerText};
      padding: 0.5rem 1rem;
      font-size: 0.875rem;
      cursor: pointer;
      border-radius: 0.375rem;
      display: none;
      align-items: center;
      justify-content: center;
      transition: background-color 0.2s ease-in-out;
    `;
    backBtn.onmouseover = function() {
      backBtn.style.backgroundColor = 'rgba(255,255,255,0.1)';
    };
    backBtn.onmouseout = function() {
      backBtn.style.backgroundColor = 'transparent';
    };
    backBtn.onclick = function() {
      goBackToOptions();
    };

    var headerTitle = document.createElement('div');
    headerTitle.id = 'header-title';
    headerTitle.style.cssText = `
      flex: 1;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    `;
    
    // Add back button to the left side of header title
    headerTitle.appendChild(backBtn);
    
    var titleText = document.createElement('div');
    titleText.innerText = config.title || 'Chat';
    headerTitle.appendChild(titleText);
    
    header.appendChild(headerTitle);

    var headerActions = document.createElement('div');
    headerActions.style.cssText = `
      display: flex;
      gap: 0.25rem;
    `;

    // Clear session button
    var clearSessionBtn = document.createElement('button');
    clearSessionBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 6h18"></path>
        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
        <path d="M10 11v6"></path>
        <path d="M14 11v6"></path>
      </svg>
    `;
    clearSessionBtn.title = 'Clear session & restart';
    clearSessionBtn.style.cssText = `
      background: transparent;
      color: ${theme.headerText};
      border: none;
      padding: 0.5rem;
      cursor: pointer;
      border-radius: 0.375rem;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background-color 0.2s ease-in-out;
    `;
    clearSessionBtn.onmouseover = function() {
      if (!isFormShowing) {
        clearSessionBtn.style.backgroundColor = 'rgba(255,255,255,0.1)';
      }
    };
    clearSessionBtn.onmouseout = function() {
      clearSessionBtn.style.backgroundColor = 'transparent';
    };
    clearSessionBtn.onclick = function() {
      if (isFormShowing) return;
      
      // Clear all data
      localStorage.removeItem('simple-chat-messages');
      localStorage.removeItem('simple-chat-lead');
      
      // Reset all state
      leadCaptured = false;
      isFormShowing = false;
      currentScreen = null;
      updateButtonStates();
      inputContainer.style.display = 'none';
      
      // Start fresh
      showLeadCapture();
    };

    var closeBtn = document.createElement('button');
    closeBtn.innerHTML = '×';
    closeBtn.style.cssText = `
      background: transparent;
      color: ${theme.headerText};
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 0.375rem;
    `;
    closeBtn.onclick = function() {
      chatContainer.style.display = 'none';
      if (chatToggle) chatToggle.style.display = 'flex';
    };

    headerActions.appendChild(clearSessionBtn);
    headerActions.appendChild(closeBtn);
    header.appendChild(headerActions);

    // Create messages container
    messagesContainer = document.createElement('div');
    messagesContainer.id = 'chat-messages';
    messagesContainer.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 1rem;
      background: #ffffff;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    `;

    // Create input container (initially hidden)
    inputContainer = document.createElement('div');
    inputContainer.style.cssText = `
      display: none;
      flex-direction: column;
      border-top: 1px solid ${theme.border};
      background: ${theme.inputBg};
      border-bottom-left-radius: 0.75rem;
      border-bottom-right-radius: 0.75rem;
    `;

    // Quick question buttons container
    var quickButtonsContainer = document.createElement('div');
    quickButtonsContainer.id = 'quick-buttons-container';
    quickButtonsContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 1rem 1rem 0.5rem 1rem;
    `;

    // Create quick question buttons if configured (limit to 3)
    if (config.quickQuestions && config.quickQuestions.length > 0) {
      var questionsToShow = config.quickQuestions.slice(0, 3); // Limit to first 3
      questionsToShow.forEach(function(question) {
        var quickBtn = document.createElement('button');
        quickBtn.innerText = question;
        quickBtn.style.cssText = `
          width: 100%;
          padding: 0.75rem 1rem;
          background: transparent;
          color: ${theme.primary};
          border: 1px solid ${theme.primary};
          border-radius: 0.5rem;
          cursor: pointer;
          font-size: 0.875rem;
          text-align: center;
          transition: all 0.2s ease-in-out;
          font-weight: 500;
        `;
        
        quickBtn.onmouseover = function() {
          quickBtn.style.backgroundColor = theme.primary;
          quickBtn.style.color = '#fff';
        };
        
        quickBtn.onmouseout = function() {
          quickBtn.style.backgroundColor = 'transparent';
          quickBtn.style.color = theme.primary;
        };
        
        quickBtn.onclick = function() {
          messageInput.value = question;
          sendMessage();
        };
        
        quickButtonsContainer.appendChild(quickBtn);
      });
    }

    var inputWrapper = document.createElement('div');
    inputWrapper.style.cssText = `
      display: flex;
      gap: 0.5rem;
      align-items: flex-end;
      padding: 0 1rem 1rem 1rem;
    `;

    var messageInput = document.createElement('textarea');
    messageInput.id = 'message-input';
    messageInput.placeholder = 'Type your message...';
    messageInput.rows = 1;
    messageInput.style.cssText = `
      flex: 1;
      padding: 0.75rem;
      border: 1px solid ${theme.border};
      border-radius: 0.5rem;
      resize: none;
      font-family: inherit;
      font-size: 0.875rem;
      line-height: 1.25rem;
      background: ${theme.inputBg};
      color: ${theme.inputText};
      height: 2.5rem;
      min-height: 2.5rem;
      max-height: 6rem;
      outline: none;
      transition: border-color 0.2s ease-in-out;
      overflow-y: hidden;
    `;

    messageInput.addEventListener('focus', function() {
      messageInput.style.borderColor = theme.primary;
    });

    messageInput.addEventListener('blur', function() {
      messageInput.style.borderColor = theme.border;
    });

    messageInput.addEventListener('input', function() {
      // Reset height to measure scroll height
      messageInput.style.height = '2.5rem';
      
      // Calculate new height based on content, with min/max constraints
      var newHeight = Math.max(40, Math.min(messageInput.scrollHeight, 96));
      messageInput.style.height = newHeight + 'px';
      
      // Show scrollbar only when at max height
      if (messageInput.scrollHeight > 96) {
        messageInput.style.overflowY = 'auto';
      } else {
        messageInput.style.overflowY = 'hidden';
      }
    });

    messageInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    var sendBtn = document.createElement('button');
    sendBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 2L11 13"></path>
        <path d="M22 2L15 22L11 13L2 9L22 2z"></path>
      </svg>
    `;
    sendBtn.style.cssText = `
      background: ${theme.sendBtnBg};
      color: ${theme.sendBtnText};
      border: none;
      border-radius: 0.5rem;
      width: 2.5rem;
      height: 2.5rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background-color 0.2s ease-in-out;
    `;

    sendBtn.addEventListener('mouseover', function() {
      sendBtn.style.backgroundColor = theme.sendBtnHover;
    });

    sendBtn.addEventListener('mouseout', function() {
      sendBtn.style.backgroundColor = theme.sendBtnBg;
    });

    sendBtn.onclick = sendMessage;

    inputWrapper.appendChild(messageInput);
    inputWrapper.appendChild(sendBtn);
    
    inputContainer.appendChild(quickButtonsContainer);
    inputContainer.appendChild(inputWrapper);

    chatContainer.appendChild(header);
    chatContainer.appendChild(messagesContainer);
    chatContainer.appendChild(inputContainer);

    // Message handling functions
    function saveMessage(msg, sender, type) {
      var messages = JSON.parse(localStorage.getItem('simple-chat-messages') || '[]');
      var messageObj = {
        text: msg,
        sender: sender,
        timestamp: new Date().toISOString(),
        type: type || 'message'
      };
      messages.push(messageObj);
      localStorage.setItem('simple-chat-messages', JSON.stringify(messages));
      loadMessages();
    }

    function loadMessages() {
      var messages = JSON.parse(localStorage.getItem('simple-chat-messages') || '[]');
      messagesContainer.innerHTML = '';

      messages.forEach(function(msg) {
        addMessageToUI(msg.text, msg.sender, msg.type);
      });

      // Scroll to bottom
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function addMessageToUI(text, sender, type) {
      var messageDiv = document.createElement('div');
      messageDiv.style.cssText = `
        display: flex;
        justify-content: ${sender === 'user' ? 'flex-end' : 'flex-start'};
        margin-bottom: 1rem;
        animation: slideIn 0.3s ease-out;
      `;

      var bubbleDiv = document.createElement('div');
      bubbleDiv.style.cssText = `
        max-width: 70%;
        padding: 0.75rem 1rem;
        border-radius: ${sender === 'user' ? '1rem 1rem 0.25rem 1rem' : '1rem 1rem 1rem 0.25rem'};
        background: ${sender === 'user' ? theme.userBubble : theme.botBubble};
        color: ${sender === 'user' ? theme.userText : theme.botText};
        word-wrap: break-word;
        position: relative;
        font-size: 0.875rem;
        line-height: 1.4;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        border: ${sender === 'bot' ? '1px solid #e2e8f0' : 'none'};
      `;

      if (type === 'typing') {
        bubbleDiv.innerHTML = `
          <div style="display: flex; gap: 4px; align-items: center;">
            <div class="typing-dot" style="width: 8px; height: 8px; background: ${theme.botText}; border-radius: 50%; animation: typingBounce 1.4s infinite ease-in-out;"></div>
            <div class="typing-dot" style="width: 8px; height: 8px; background: ${theme.botText}; border-radius: 50%; animation: typingBounce 1.4s infinite ease-in-out 0.2s;"></div>
            <div class="typing-dot" style="width: 8px; height: 8px; background: ${theme.botText}; border-radius: 50%; animation: typingBounce 1.4s infinite ease-in-out 0.4s;"></div>
          </div>
        `;
        bubbleDiv.classList.add('typing-indicator');
      } else {
        bubbleDiv.innerText = text;
      }

      messageDiv.appendChild(bubbleDiv);
      messagesContainer.appendChild(messageDiv);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function sendMessage() {
      var input = messageInput;
      var message = input.value.trim();
      if (!message) return;

      // Add user message
      saveMessage(message, 'user');
      input.value = '';
      input.style.height = 'auto';

      // Show typing indicator
      addMessageToUI('', 'bot', 'typing');

      // Simulate bot response after delay
      setTimeout(function() {
        // Remove typing indicator
        var typingIndicator = messagesContainer.querySelector('.typing-indicator');
        if (typingIndicator) {
          typingIndicator.parentElement.remove();
        }

        // Trigger action based on message content or current context
        var response = generateBotResponse(message);
        saveMessage(response, 'bot');
      }, 1500);
    }

    function generateBotResponse(userMessage) {
      // More contextual bot responses based on keywords
      var message = userMessage.toLowerCase();
      
      if (message.includes('price') || message.includes('cost') || message.includes('how much')) {
        return "Our container prices vary based on size and condition. 20ft containers start around $3,100 for economy grade, while 40ft high cube containers are around $8,750. Would you like me to show you our current inventory with pricing?";
      } else if (message.includes('size') || message.includes('dimensions') || message.includes('20ft') || message.includes('40ft')) {
        return "We have both 20ft and 40ft containers available. 20ft containers are great for smaller storage needs, while 40ft containers offer more space. We also have high cube options for extra height. What size are you considering?";
      } else if (message.includes('shipping') || message.includes('delivery') || message.includes('transport')) {
        return "We can arrange delivery to most locations. Shipping costs depend on your location and the size of the container. Our team can provide you with a detailed quote including delivery. Where would you need the container delivered?";
      } else if (message.includes('modification') || message.includes('custom') || message.includes('door') || message.includes('window')) {
        return "We offer various container modifications including additional doors, windows, ventilation, insulation, and electrical setups. Our modification services can transform a standard container into a perfect solution for your specific needs. What type of modifications are you interested in?";
      } else if (message.includes('condition') || message.includes('new') || message.includes('used')) {
        return "We offer containers in different conditions: 1-trip (like new), cargo worthy (good for shipping), wind & water tight (great for storage), and economy grade (budget-friendly). Each serves different purposes and budgets. What will you be using the container for?";
      } else if (message.includes('hello') || message.includes('hi') || message.includes('hey')) {
        return "Hello! Great to hear from you. I'm here to help you find the perfect container solution. Are you looking for storage, shipping, or perhaps a custom modification project?";
      } else if (message.includes('thank') || message.includes('thanks')) {
        return "You're very welcome! I'm happy to help. Do you have any other questions about our containers or services?";
      } else {
        var responses = [
          "That's a great question! Our container specialists can provide detailed information about that. Would you like me to connect you with someone who can give you specific details?",
          "I'd be happy to help you with that. Let me get you connected with one of our container experts who can provide you with the most accurate information.",
          "Thank you for asking! Our team has extensive experience with container solutions. Would you like to browse our current inventory or speak with a specialist?",
          "That's definitely something we can help with. Our container solutions are quite versatile. Would you like to schedule a call to discuss your specific needs?",
          "Great question! We have a lot of experience with various container applications. Let me connect you with someone who can provide detailed answers."
        ];
        return responses[Math.floor(Math.random() * responses.length)];
      }
    }

    function updateButtonStates() {
      // Use direct reference to backBtn instead of querySelector
      console.log('updateButtonStates called:', { 
        isFormShowing, 
        navigationStackLength: navigationStack.length, 
        currentScreen,
        navigationStack: navigationStack.slice() 
      });
      
      if (backBtn) {
        // Show back button when forms are showing OR when there's navigation history
        var shouldShow = (isFormShowing || navigationStack.length > 0);
        backBtn.style.display = shouldShow ? 'flex' : 'none';
        console.log('Back button updated:', { shouldShow, display: backBtn.style.display });
      } else {
        console.log('backBtn variable is null or undefined');
      }
      
      var clearSessionButton = header.querySelector('button[title="Clear session & restart"]');
      
      if (isFormShowing) {
        if (clearSessionButton) {
          clearSessionButton.style.opacity = '0.5';
          clearSessionButton.style.cursor = 'not-allowed';
        }
      } else {
        if (clearSessionButton) {
          clearSessionButton.style.opacity = '1';
          clearSessionButton.style.cursor = 'pointer';
        }
      }
    }

    function updateHeaderTitle(screenKey, screenConfig) {
      var headerTitle = document.getElementById('header-title');
      if (!headerTitle) return;
      
      // Find the title text div (second child after back button)
      var titleTextDiv = headerTitle.children[1];
      if (!titleTextDiv) return;

      if (!screenKey || screenKey === 'entry_points') {
        // Home screen - show company name
        titleTextDiv.innerText = config.title || 'Chat';
      } else {
        // Other screens - show breadcrumb
        var screenTitle = '';
        
        // Get screen title from config
        if (screenConfig && screenConfig.title) {
          screenTitle = screenConfig.title;
        } else {
          // Fallback titles for different screen types
          switch (screenKey) {
            case 'info_screen':
              screenTitle = 'Information';
              break;
            case 'category_select':
              screenTitle = 'Categories';
              break;
            case 'lead_form':
              screenTitle = 'Contact Information';
              break;
            case 'call_booking_form':
              screenTitle = 'Schedule a Call';
              break;
            case 'support_form':
              screenTitle = 'Technical Support';
              break;
            case 'product_list_20ft':
              screenTitle = '20ft Containers';
              break;
            case 'product_list_40ft':
              screenTitle = '40ft Containers';
              break;
            case 'product_list_accessories':
              screenTitle = 'Accessories';
              break;
            default:
              screenTitle = 'Details';
          }
        }

        // Update just the title text
        titleTextDiv.innerText = screenTitle;
      }
    }

    function goBackToOptions() {
      isFormShowing = false;
      updateButtonStates();
      inputContainer.style.display = 'none';
      
      // Check if we have navigation history
      if (navigationStack.length > 0) {
        var previousScreen = navigationStack.pop();
        currentScreen = previousScreen;
        
        // If the previous screen was entry_points, show entry points
        if (previousScreen === 'entry_points') {
          renderEntryPoints();
        } else {
          // Render the previous screen without adding to navigation stack
          var screen = config.screens && config.screens[previousScreen];
          if (screen) {
            updateHeaderTitle(previousScreen, screen);
            if (screen.type === 'category_list') {
              renderCategoryList(screen);
            } else if (screen.type === 'product_list') {
              renderProductList(screen);
            } else if (screen.type === 'form') {
              renderForm(screen);
            } else if (screen.type === 'info') {
              renderInfoScreen(screen);
            } else {
              renderScreen(previousScreen);
            }
          } else {
            renderEntryPoints();
          }
        }
      } else {
        // No history, go back to appropriate starting point
        currentScreen = null;
        if (!leadCaptured) {
          showLeadCapture();
        } else {
          renderEntryPoints();
        }
      }
    }

    // Helper function to render category list without navigation tracking
    function renderCategoryList(screen) {
      messagesContainer.innerHTML = '';
      
      var wrapper = document.createElement('div');
      wrapper.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 1rem;
        padding: 1rem;
        align-items: center;
      `;

      (screen.categories || []).forEach(function(cat) {
        var btn = document.createElement('button');
        btn.innerText = cat.name;
        btn.style.cssText = `
          width: 100%;
          max-width: 300px;
          padding: 0.75rem 1.5rem;
          background: ${theme.primary};
          color: #fff;
          border: none;
          border-radius: 0.375rem;
          cursor: pointer;
          font-weight: 600;
          font-size: 0.875rem;
        `;
        btn.onclick = function() {
          renderScreen('product_list_' + cat.id);
        };
        wrapper.appendChild(btn);
      });

      messagesContainer.appendChild(wrapper);
    }

    // Helper function to render info screen without navigation tracking
    function renderInfoScreen(screen) {
      messagesContainer.innerHTML = '';
      
      var infoDiv = document.createElement('div');
      infoDiv.innerText = screen.content;
      infoDiv.style.cssText = `
        padding: 2rem;
        text-align: center;
        color: ${theme.text};
      `;
      messagesContainer.appendChild(infoDiv);
    }

    function resetToEntryPoints() {
      isFormShowing = false;
      currentScreen = null;
      navigationStack = []; // Clear navigation history on reset
      updateButtonStates();
      inputContainer.style.display = 'none';
      renderEntryPoints();
    }

    // Make resetToEntryPoints globally accessible for breadcrumb
    window.resetToEntryPoints = resetToEntryPoints;
    
    // Make goBackToOptions globally accessible for back button
    window.goBackToOptions = goBackToOptions;

    // Lead capture form
    function showLeadCapture() {
      // Update header title to show just "Home" for lead capture
      var headerTitle = document.getElementById('header-title');
      if (headerTitle) {
        headerTitle.innerHTML = config.title || 'Chat';
      }
      
      isFormShowing = true;
      updateButtonStates();
      messagesContainer.innerHTML = '';

      var wrapper = document.createElement('div');
      wrapper.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        gap: 1.2rem;
        padding: 1.5rem;
      `;

      var formContainer = document.createElement('div');
      formContainer.style.cssText = `
        width: 100%;
        max-width: 300px;
        display: flex;
        flex-direction: column;
        gap: 0.8rem;
      `;

      var formData = {};

      var leadFields = [
        { name: "name", label: "Full Name", type: "text", required: true, placeholder: "Enter your full name" },
        { name: "email", label: "Email", type: "email", required: true, placeholder: "Enter your email" },
        { name: "phone", label: "Phone", type: "tel", required: false, placeholder: "Enter your phone number" },
        { name: "zipcode", label: "Zip Code", type: "text", required: true, placeholder: "Enter your zip code" }
      ];

      leadFields.forEach(function(field) {
        var fieldContainer = document.createElement('div');
        fieldContainer.style.cssText = `
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        `;

        var label = document.createElement('label');
        label.innerText = field.label + (field.required ? '*' : '');
        label.style.cssText = `
          font-size: 0.875rem;
          font-weight: 500;
          color: ${theme.text};
        `;

        var input = document.createElement('input');
        input.type = field.type;
        input.placeholder = field.placeholder;
        input.required = field.required;
        input.style.cssText = `
          padding: 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          outline: none;
          transition: border-color 0.2s ease-in-out;
          background: #fff;
        `;

        input.addEventListener('focus', function() {
          input.style.borderColor = theme.primary;
        });

        input.addEventListener('blur', function() {
          input.style.borderColor = '#d1d5db';
        });

        input.addEventListener('input', function() {
          formData[field.name] = input.value;
        });

        fieldContainer.appendChild(label);
        fieldContainer.appendChild(input);
        formContainer.appendChild(fieldContainer);
      });

      var submitBtn = document.createElement('button');
      submitBtn.innerText = 'Start Chat';
      submitBtn.style.cssText = `
        width: 100%;
        padding: 0.875rem 1.5rem;
        background: ${theme.primary};
        color: #fff;
        border: none;
        border-radius: 0.5rem;
        cursor: pointer;
        font-weight: 600;
        font-size: 0.875rem;
        margin-top: 0.5rem;
        transition: background-color 0.2s ease-in-out;
      `;

      submitBtn.addEventListener('mouseover', function() {
        submitBtn.style.backgroundColor = theme.sendBtnHover;
      });

      submitBtn.addEventListener('mouseout', function() {
        submitBtn.style.backgroundColor = theme.primary;
      });

      submitBtn.onclick = function() {
        // Basic validation
        var nameInput = formContainer.querySelector('input[type="text"]');
        var emailInput = formContainer.querySelector('input[type="email"]');
        var zipcodeInput = formContainer.querySelector('input[placeholder*="zip"]');
        
        if (!formData.name || !formData.email || !formData.zipcode) {
          // Highlight required fields
          if (!formData.name && nameInput) {
            nameInput.style.borderColor = '#ef4444';
            nameInput.style.backgroundColor = '#fef2f2';
          }
          if (!formData.email && emailInput) {
            emailInput.style.borderColor = '#ef4444';
            emailInput.style.backgroundColor = '#fef2f2';
          }
          if (!formData.zipcode && zipcodeInput) {
            zipcodeInput.style.borderColor = '#ef4444';
            zipcodeInput.style.backgroundColor = '#fef2f2';
          }
          
          // Show error message instead of alert
          var errorMsg = document.createElement('div');
          errorMsg.innerText = 'Please fill in all required fields';
          errorMsg.style.cssText = `
            color: #ef4444;
            font-size: 0.75rem;
            margin-top: 0.5rem;
            text-align: center;
          `;
          
          // Remove any existing error message
          var existingError = formContainer.querySelector('.error-message');
          if (existingError) {
            existingError.remove();
          }
          
          errorMsg.className = 'error-message';
          formContainer.appendChild(errorMsg);
          return;
        }

        // Save lead data
        localStorage.setItem('simple-chat-lead', JSON.stringify(formData));
        leadCaptured = true;

        // Trigger lead submission action
        triggerAction('submit_lead', formData);

        // Show entry points
        isFormShowing = false;
        updateButtonStates();
        renderEntryPoints();
      };

      wrapper.appendChild(formContainer);
      wrapper.appendChild(submitBtn);
      messagesContainer.appendChild(wrapper);
    }

    function triggerAction(actionName, payload) {
      var action = config.actions && config.actions[actionName];
      if (!action) {
        console.error('Unknown action:', actionName);
        return;
      }
      
      // Handle special case for category-based product display
      if (actionName === 'show_products' && payload.categoryId) {
        var screenName = 'product_list_' + payload.categoryId;
        if (config.screens[screenName]) {
          renderScreen(screenName);
          return;
        }
      }
      
      // For testing, just log the action - in production this would make API calls
      console.log('Triggering action:', actionName, 'with payload:', payload);
      
      // Simulate successful lead submission
      if (actionName === 'submit_lead') {
        console.log('Lead submitted successfully:', payload);
      }
      
      // In production, this would make an actual API call:
      // fetch(action.endpoint, {
      //   method: action.method || 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(payload)
      // }).then(response => response.json()).then(data => {
      //   // Handle response
      // });
    }

    // Render entry points
    function renderEntryPoints() {
      // Track navigation history
      if (currentScreen && currentScreen !== 'entry_points') {
        navigationStack.push(currentScreen);
      }
      currentScreen = 'entry_points';
      
      // Update header title for home screen
      updateHeaderTitle('entry_points', null);
      
      messagesContainer.innerHTML = '';
      
      var wrapper = document.createElement('div');
      wrapper.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        gap: 1.2rem;
        padding: 1rem;
      `;

      var title = document.createElement('h2');
      title.innerText = config.entryPointsTitle || 'How can we help you?';
      title.style.cssText = `
        font-size: 1.25rem;
        font-weight: 600;
        text-align: center;
        margin: 0;
        color: ${theme.text};
      `;
      wrapper.appendChild(title);

      var optionsContainer = document.createElement('div');
      optionsContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        width: 100%;
        max-width: 320px;
        align-items: center;
      `;

      (config.entryPoints || []).forEach(function(option) {
        var btn = document.createElement('button');
        btn.innerText = option.label;
        btn.style.cssText = `
          width: 100%;
          padding: 0.75rem 1.5rem;
          background: ${theme.primary};
          color: #fff;
          border: none;
          border-radius: 0.375rem;
          cursor: pointer;
          font-weight: 600;
          font-size: 0.875rem;
          transition: background-color 0.2s ease-in-out;
        `;
        btn.onmouseover = function() {
          btn.style.backgroundColor = theme.sendBtnHover || theme.primary;
        };
        btn.onmouseout = function() {
          btn.style.backgroundColor = theme.primary;
        };
        btn.onclick = function() {
          if (option.id === 'get_info') {
            // "Get Information" goes directly to chat
            // Track that we came from entry points so back button works
            if (currentScreen !== 'chat') {
              navigationStack.push('entry_points');
            }
            isFormShowing = false;
            currentScreen = 'chat';
            updateButtonStates();
            inputContainer.style.display = 'flex';
            
            // Add welcome message
            messagesContainer.innerHTML = '';
            var welcomeMsg = config.welcomeMessage || "Hi! I'm here to help you with any questions about our container solutions. What would you like to know?";
            addMessageToUI(welcomeMsg, 'bot');
            
          } else if (option.next) {
            renderScreen(option.next);
          } else {
            triggerAction(option.action || option.id, { entryPoint: option.id });
          }
        };
        optionsContainer.appendChild(btn);
      });

      wrapper.appendChild(optionsContainer);
      messagesContainer.appendChild(wrapper);
      
      // Update button states since we've changed screens
      updateButtonStates();
    }

    // Render a screen by ID
    function renderScreen(screenId) {
      var screen = config.screens && config.screens[screenId];
      if (!screen) {
        messagesContainer.innerHTML = '<div style="color:red;padding:2rem;text-align:center;">Screen not found: ' + screenId + '</div>';
        updateHeaderTitle(screenId, null);
        return;
      }

      // Track navigation history (don't push if we're going back)
      if (currentScreen && currentScreen !== screenId) {
        navigationStack.push(currentScreen);
      }
      currentScreen = screenId;

      // Update header title for this screen
      updateHeaderTitle(screenId, screen);
      
      // Update button states since navigation changed
      updateButtonStates();

      messagesContainer.innerHTML = '';

      if (screen.type === 'info') {
        var wrapper = document.createElement('div');
        wrapper.style.cssText = `
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          padding: 2rem;
          align-items: center;
        `;

        var infoDiv = document.createElement('div');
        infoDiv.innerText = screen.content;
        infoDiv.style.cssText = `
          text-align: center;
          color: ${theme.text};
          line-height: 1.6;
          font-size: 1.125rem;
          max-width: 400px;
          margin: 0 auto;
        `;
        wrapper.appendChild(infoDiv);

        // Add buttons if they exist
        if (screen.buttons && screen.buttons.length > 0) {
          var buttonsContainer = document.createElement('div');
          buttonsContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 1rem;
            width: 100%;
            max-width: 350px;
          `;

          screen.buttons.forEach(function(button) {
            var btn = document.createElement('button');
            btn.innerText = button.label;
            btn.style.cssText = `
              padding: 1.25rem 2rem;
              background: ${theme.primary};
              color: white;
              border: none;
              border-radius: 0.75rem;
              cursor: pointer;
              font-size: 1.125rem;
              font-weight: 600;
              transition: all 0.2s ease-in-out;
              width: 100%;
              min-height: 60px;
              line-height: 1.4;
              text-align: center;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            `;
            
            btn.onmouseover = function() {
              btn.style.transform = 'translateY(-1px)';
              btn.style.boxShadow = '0 4px 12px rgba(131, 73, 255, 0.4)';
            };
            btn.onmouseout = function() {
              btn.style.transform = 'translateY(0)';
              btn.style.boxShadow = 'none';
            };

            btn.onclick = function() {
              if (button.action) {
                console.log('Info screen button clicked:', {
                  buttonAction: button.action,
                  currentScreen: currentScreen,
                  navigationStackBefore: navigationStack.slice()
                });
                
                // Check if it's a screen navigation or an action trigger
                if (config.screens[button.action]) {
                  renderScreen(button.action);
                  
                  console.log('After renderScreen:', {
                    newCurrentScreen: currentScreen,
                    navigationStackAfter: navigationStack.slice()
                  });
                } else {
                  triggerAction(button.action, { source: 'info_screen' });
                }
              }
            };

            buttonsContainer.appendChild(btn);
          });

          wrapper.appendChild(buttonsContainer);
        }

        messagesContainer.appendChild(wrapper);

      } else if (screen.type === 'category_list') {
        var wrapper = document.createElement('div');
        wrapper.style.cssText = `
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding: 1rem;
          align-items: center;
        `;

        (screen.categories || []).forEach(function(cat) {
          var btn = document.createElement('button');
          btn.innerText = cat.name;
          btn.style.cssText = `
            width: 100%;
            max-width: 300px;
            padding: 0.75rem 1.5rem;
            background: ${theme.primary};
            color: #fff;
            border: none;
            border-radius: 0.375rem;
            cursor: pointer;
            font-weight: 600;
            font-size: 0.875rem;
          `;
          btn.onclick = function() {
            if (screen.onSelect && screen.onSelect.action) {
              triggerAction(screen.onSelect.action, { categoryId: cat.id });
            }
          };
          wrapper.appendChild(btn);
        });

        messagesContainer.appendChild(wrapper);

      } else if (screen.type === 'form') {
        renderForm(screen);

      } else if (screen.type === 'product_list') {
        renderProductList(screen);

      } else {
        messagesContainer.innerHTML = '<div style="color:red;padding:2rem;text-align:center;">Unknown screen type: ' + screen.type + '</div>';
      }
    }

    // Create chat toggle button
    var chatToggle = document.createElement('button');
    chatToggle.innerHTML = '💬';
    chatToggle.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: ${theme.sendBtnBg};
      color: #fff;
      border: none;
      cursor: pointer;
      font-size: 1.5rem;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
      z-index: 9998;
    `;

    chatToggle.onclick = function() {
      chatContainer.style.display = 'flex';
      chatToggle.style.display = 'none';
    };

    // Initially hide chat container, show toggle
    chatContainer.style.display = 'none';

    // Append to DOM
    document.body.appendChild(chatContainer);
    document.body.appendChild(chatToggle);

    // Initialize chat state
    var savedLead = localStorage.getItem('simple-chat-lead');
    if (savedLead) {
      leadCaptured = true;
    }

    // Start with lead capture if not captured, otherwise entry points
    if (!leadCaptured) {
      showLeadCapture();
    } else {
      renderEntryPoints();
    }

    // Render form screen
    function renderForm(screen) {
      var wrapper = document.createElement('div');
      wrapper.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        gap: 1.2rem;
        padding: 1rem;
      `;

      if (screen.description) {
        var description = document.createElement('p');
        description.innerText = screen.description;
        description.style.cssText = `
          font-size: 0.875rem;
          color: #6b7280;
          text-align: center;
          margin: 0.5rem 0 0 0;
          line-height: 1.4;
        `;
        wrapper.appendChild(description);
      }

      var formContainer = document.createElement('div');
      formContainer.style.cssText = `
        width: 100%;
        max-width: 300px;
        display: flex;
        flex-direction: column;
        gap: 0.8rem;
      `;

      var formData = {};

      (screen.fields || []).forEach(function(field) {
        var fieldContainer = document.createElement('div');
        fieldContainer.style.cssText = `
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        `;

        var label = document.createElement('label');
        label.innerText = field.label + (field.required ? '*' : '');
        label.style.cssText = `
          font-size: 0.875rem;
          font-weight: 500;
          color: ${theme.text};
        `;

        var input;
        var isCheckboxField = false;
        
        if (field.type === 'textarea') {
          input = document.createElement('textarea');
          input.rows = 3;
        } else if (field.type === 'select') {
          input = document.createElement('select');
          (field.options || []).forEach(function(option) {
            var optEl = document.createElement('option');
            optEl.value = option.value;
            optEl.innerText = option.label;
            input.appendChild(optEl);
          });
        } else if (field.type === 'checkbox') {
          // Handle checkbox group
          isCheckboxField = true;
          var checkboxContainer = document.createElement('div');
          checkboxContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
          `;
          
          var selectedValues = [];
          (field.options || []).forEach(function(option) {
            var checkboxWrapper = document.createElement('label');
            checkboxWrapper.style.cssText = `
              display: flex;
              align-items: center;
              gap: 0.5rem;
              cursor: pointer;
              font-size: 0.875rem;
            `;
            
            var checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = option.value;
            checkbox.style.cssText = `
              margin: 0;
              cursor: pointer;
            `;
            
            checkbox.onchange = function() {
              if (checkbox.checked) {
                selectedValues.push(option.value);
              } else {
                var index = selectedValues.indexOf(option.value);
                if (index > -1) {
                  selectedValues.splice(index, 1);
                }
              }
              formData[field.name] = selectedValues.slice(); // Copy array
            };
            
            var labelSpan = document.createElement('span');
            labelSpan.innerText = option.label;
            
            checkboxWrapper.appendChild(checkbox);
            checkboxWrapper.appendChild(labelSpan);
            checkboxContainer.appendChild(checkboxWrapper);
          });
          
          fieldContainer.appendChild(label);
          fieldContainer.appendChild(checkboxContainer);
          formContainer.appendChild(fieldContainer);
          
          // Initialize empty array for this field
          formData[field.name] = [];
        } else {
          input = document.createElement('input');
          input.type = field.type || 'text';
          if (field.min) {
            input.min = field.min;
          }
        }

        // Only process regular input fields (not checkboxes)
        if (!isCheckboxField) {

        input.placeholder = field.placeholder || '';
        input.style.cssText = `
          padding: 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          font-size: 0.875rem;
          outline: none;
          transition: border-color 0.2s ease-in-out;
        `;

        input.addEventListener('focus', function() {
          input.style.borderColor = theme.primary;
        });

        input.addEventListener('blur', function() {
          input.style.borderColor = '#d1d5db';
        });

        input.addEventListener('input', function() {
          formData[field.name] = input.value;
        });

        fieldContainer.appendChild(label);
        fieldContainer.appendChild(input);
        formContainer.appendChild(fieldContainer);
        } // Close the if (!isCheckboxField) block
      });

      var submitBtn = document.createElement('button');
      submitBtn.innerText = screen.submitLabel || 'Submit';
      submitBtn.style.cssText = `
        width: 100%;
        padding: 0.75rem 1.5rem;
        background: ${theme.primary};
        color: #fff;
        border: none;
        border-radius: 0.375rem;
        cursor: pointer;
        font-weight: 600;
        font-size: 0.875rem;
        margin-top: 1rem;
      `;

      submitBtn.onclick = function() {
        if (screen.onSubmit && screen.onSubmit.action) {
          triggerAction(screen.onSubmit.action, formData);
        }
      };

      wrapper.appendChild(formContainer);
      wrapper.appendChild(submitBtn);
      messagesContainer.appendChild(wrapper);
    }

    // Image fetching functionality
    function fetchProductImage(url, fallbackImage) {
      return new Promise(function(resolve) {
        // Try to use a CORS proxy to fetch the page
        var proxyUrl = 'https://api.allorigins.win/get?url=' + encodeURIComponent(url);
        
        fetch(proxyUrl)
          .then(function(response) {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
          })
          .then(function(data) {
            var parser = new DOMParser();
            var doc = parser.parseFromString(data.contents, 'text/html');
            
            // Try to find OG image first
            var ogImage = doc.querySelector('meta[property="og:image"]');
            if (ogImage && ogImage.content) {
              resolve(ogImage.content);
              return;
            }
            
            // Try other meta images
            var twitterImage = doc.querySelector('meta[name="twitter:image"]');
            if (twitterImage && twitterImage.content) {
              resolve(twitterImage.content);
              return;
            }
            
            var metaImage = doc.querySelector('meta[name="image"]');
            if (metaImage && metaImage.content) {
              resolve(metaImage.content);
              return;
            }
            
            // Try to find the first reasonable image in the content
            var images = doc.querySelectorAll('img[src]');
            for (var i = 0; i < images.length; i++) {
              var img = images[i];
              var src = img.src;
              
              // Skip small images, icons, and logos
              if (src && !src.includes('icon') && !src.includes('logo') && 
                  !src.includes('avatar') && !src.includes('badge')) {
                // Make sure it's an absolute URL
                if (src.startsWith('//')) {
                  src = 'https:' + src;
                } else if (src.startsWith('/')) {
                  var urlObj = new URL(url);
                  src = urlObj.origin + src;
                }
                resolve(src);
                return;
              }
            }
            
            // If no image found, use fallback
            resolve(fallbackImage);
          })
          .catch(function(error) {
            console.log('Error fetching image for', url, ':', error);
            resolve(fallbackImage);
          });
      });
    }

    // Enhanced product list rendering with dynamic image fetching
    function renderProductList(screen) {
      var wrapper = document.createElement('div');
      wrapper.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 1rem;
        padding: 1rem;
        height: 100%;
        overflow-y: auto;
      `;

      var productsContainer = document.createElement('div');
      productsContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 1rem;
        flex: 1;
      `;

      (screen.products || []).forEach(function(product) {
        var productCard = document.createElement('div');
        productCard.style.cssText = `
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 0.75rem;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.2s ease-in-out;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          margin-bottom: 1rem;
        `;

        productCard.addEventListener('mouseover', function() {
          productCard.style.transform = 'translateY(-2px)';
          productCard.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
        });

        productCard.addEventListener('mouseout', function() {
          productCard.style.transform = 'translateY(0)';
          productCard.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
        });

        // Product image container
        var imageContainer = document.createElement('div');
        imageContainer.style.cssText = `
          width: 100%;
          height: 150px;
          background: #f8f9fa;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
        `;

        // Create placeholder while loading
        var placeholder = document.createElement('div');
        placeholder.style.cssText = `
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #6c757d;
          font-size: 0.875rem;
          transition: opacity 0.3s ease-in-out;
        `;
        placeholder.innerHTML = `
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21,15 16,10 5,21"></polyline>
          </svg>
        `;

        var productImage = document.createElement('img');
        productImage.style.cssText = `
          width: 100%;
          height: 100%;
          object-fit: cover;
          position: absolute;
          top: 0;
          left: 0;
          opacity: 0;
          transition: opacity 0.3s ease-in-out;
        `;

        // Default fallback image - a nice container illustration
        var fallbackImage = 'data:image/svg+xml;base64,' + btoa(`
          <svg width="300" height="150" viewBox="0 0 300 150" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#8349ff;stop-opacity:0.1" />
                <stop offset="100%" style="stop-color:#8349ff;stop-opacity:0.3" />
              </linearGradient>
            </defs>
            <rect width="300" height="150" fill="url(#grad1)"/>
            <rect x="50" y="40" width="200" height="70" fill="none" stroke="#8349ff" stroke-width="2" rx="4"/>
            <rect x="55" y="45" width="190" height="60" fill="none" stroke="#8349ff" stroke-width="1" stroke-dasharray="5,5" opacity="0.5"/>
            <text x="150" y="80" text-anchor="middle" fill="#8349ff" font-family="Arial, sans-serif" font-size="14" font-weight="600">Container</text>
            <text x="150" y="95" text-anchor="middle" fill="#8349ff" font-family="Arial, sans-serif" font-size="12">${product.category}</text>
          </svg>
        `);

        imageContainer.appendChild(placeholder);
        imageContainer.appendChild(productImage);

        // Try to fetch actual image
        if (product.url) {
          fetchProductImage(product.url, product.image || fallbackImage).then(function(imageUrl) {
            if (imageUrl) {
              productImage.src = imageUrl;
              productImage.onload = function() {
                productImage.style.opacity = '1';
                placeholder.style.opacity = '0';
              };
              productImage.onerror = function() {
                // If the fetched image fails, try the fallback
                if (imageUrl !== fallbackImage) {
                  productImage.src = fallbackImage;
                }
              };
            }
          });
        } else if (product.image) {
          productImage.src = product.image;
          productImage.onload = function() {
            productImage.style.opacity = '1';
            placeholder.style.opacity = '0';
          };
          productImage.onerror = function() {
            productImage.src = fallbackImage;
          };
        } else {
          productImage.src = fallbackImage;
          productImage.onload = function() {
            productImage.style.opacity = '1';
            placeholder.style.opacity = '0';
          };
        }

        productCard.appendChild(imageContainer);

        var contentDiv = document.createElement('div');
        contentDiv.style.cssText = `
          padding: 1rem;
        `;

        var productTitle = document.createElement('h4');
        productTitle.innerText = product.title;
        productTitle.style.cssText = `
          font-size: 0.875rem;
          font-weight: 600;
          color: ${theme.text};
          margin: 0 0 0.5rem 0;
          line-height: 1.3;
        `;

        var priceContainer = document.createElement('div');
        priceContainer.style.cssText = `
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
        `;

        var productPrice = document.createElement('div');
        productPrice.innerText = '$' + product.price.toLocaleString();
        productPrice.style.cssText = `
          font-size: 1.125rem;
          font-weight: 700;
          color: #059669;
        `;

        priceContainer.appendChild(productPrice);

        if (product.originalPrice && product.originalPrice > product.price) {
          var originalPrice = document.createElement('div');
          originalPrice.innerText = '$' + product.originalPrice.toLocaleString();
          originalPrice.style.cssText = `
            font-size: 0.875rem;
            color: #9ca3af;
            text-decoration: line-through;
          `;
          priceContainer.appendChild(originalPrice);

          var savings = document.createElement('div');
          savings.innerText = 'Save $' + (product.originalPrice - product.price).toLocaleString();
          savings.style.cssText = `
            font-size: 0.75rem;
            color: #dc2626;
            font-weight: 600;
            background: #fef2f2;
            padding: 0.25rem 0.5rem;
            border-radius: 0.25rem;
          `;
          priceContainer.appendChild(savings);
        }

        if (product.description) {
          var productDescription = document.createElement('p');
          productDescription.innerText = product.description;
          productDescription.style.cssText = `
            font-size: 0.75rem;
            color: #6b7280;
            margin: 0.5rem 0;
            line-height: 1.4;
          `;
          contentDiv.appendChild(productDescription);
        }

        if (product.features && product.features.length > 0) {
          var featuresContainer = document.createElement('div');
          featuresContainer.style.cssText = `
            display: flex;
            flex-wrap: wrap;
            gap: 0.25rem;
            margin: 0.5rem 0;
          `;

          product.features.forEach(function(feature) {
            var featureTag = document.createElement('span');
            featureTag.innerText = feature;
            featureTag.style.cssText = `
              font-size: 0.625rem;
              background: ${theme.primary}20;
              color: ${theme.primary};
              padding: 0.25rem 0.5rem;
              border-radius: 0.25rem;
              font-weight: 500;
            `;
            featuresContainer.appendChild(featureTag);
          });

          contentDiv.appendChild(featuresContainer);
        }

        if (product.deliveryTime) {
          var deliveryTime = document.createElement('div');
          deliveryTime.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline; margin-right: 4px;">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12,6 12,12 16,14"></polyline>
            </svg>
            Delivery: ${product.deliveryTime}
          `;
          deliveryTime.style.cssText = `
            font-size: 0.75rem;
            color: #059669;
            margin-top: 0.5rem;
            display: flex;
            align-items: center;
          `;
          contentDiv.appendChild(deliveryTime);
        }

        contentDiv.appendChild(productTitle);
        contentDiv.appendChild(priceContainer);
        productCard.appendChild(contentDiv);

        productCard.onclick = function() {
          if (product.url) {
            window.open(product.url, '_blank');
          }
        };

        productsContainer.appendChild(productCard);
      });


      wrapper.appendChild(productsContainer);
      messagesContainer.appendChild(wrapper);
    }

    // Expose API
    return {
      triggerAction: triggerAction,
      renderScreen: renderScreen,
      renderEntryPoints: renderEntryPoints
    };
  }

  // Auto-init if config is present
  if (window.SimpleChatEmbedConfig) {
    window.SimpleChatEmbedInstance = initChatEmbed(window.SimpleChatEmbedConfig);
  }

  // Expose for manual init
  window.SimpleChatEmbed = { 
    init: initChatEmbed,
    version: '2.0.0-dynamic'
  };

})();
