import { WebSocketService } from './websocket.js';

document.addEventListener('DOMContentLoaded', () => {
  // Views
  const loginView = document.getElementById('login-view');
  const appView = document.getElementById('app-view');
  
  // Forms & Inputs
  const loginForm = document.getElementById('login-form');
  const usernameInput = document.getElementById('username');
  const ideaForm = document.getElementById('idea-form');
  const ideaTitle = document.getElementById('idea-title');
  const ideaDesc = document.getElementById('idea-description');
  
  // UI Elements
  const displayUsername = document.getElementById('display-username');
  const logoutBtn = document.getElementById('logout-btn');
  const ideasList = document.getElementById('ideas-list');

  // State
  let currentUser = localStorage.getItem('notetaker_user');
  const wsService = new WebSocketService();
  const statusIndicator = document.getElementById('connection-status');

  // Initialization
  if (currentUser) {
    showAppView(currentUser);
  } else {
    showLoginView();
  }

  // Event Listeners
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = usernameInput.value.trim();
    if (name) {
      currentUser = name;
      localStorage.setItem('notetaker_user', currentUser);
      showAppView(currentUser);
    }
  });

  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('notetaker_user');
    currentUser = null;
    showLoginView();
  });

  ideaForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = ideaTitle.value.trim();
    const desc = ideaDesc.value.trim();
    
    if (title && desc) {
      wsService.sendIdea(title, desc, currentUser);
      ideaTitle.value = '';
      ideaDesc.value = '';
      ideaTitle.focus();
    }
  });

  // Callbacks
  wsService.onIdeaReceived((idea) => {
    appendIdeaToDOM(idea, true);
  });

  wsService.onStatusChange((status) => {
    statusIndicator.className = 'status-indicator ' + status;
    statusIndicator.title = 'Status: ' + status.charAt(0).toUpperCase() + status.slice(1);
    
    // If we reconnect, refresh the list to make sure we didn't miss anything
    if (status === 'connected') {
        fetchExistingIdeas();
    }
  });

  // Functions
  function showLoginView() {
    appView.classList.remove('active');
    loginView.classList.add('active');
  }

  function showAppView(username) {
    displayUsername.textContent = username;
    loginView.classList.remove('active');
    appView.classList.add('active');
    
    // Connect websocket logic if not already connected
    if (wsService.status === 'disconnected') {
      wsService.connect();
    }
  }

  function fetchExistingIdeas() {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8085';
    fetch(`${apiBaseUrl}/api/ideas`)
      .then(res => res.json())
      .then(ideas => {
        ideasList.innerHTML = ''; // clear loading state
        if (ideas.length === 0) {
          ideasList.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--color-text-muted)">No startup ideas yet. Be the first!</p>';
        } else {
          ideas.forEach(idea => appendIdeaToDOM(idea, false));
        }
      })
      .catch(err => {
        console.error("Failed to fetch ideas", err);
      });
  }

  function appendIdeaToDOM(idea, isNew) {
    // remove the "no ideas" message if present
    if (ideasList.querySelector('p')) {
        ideasList.innerHTML = '';
    }

    // Check if item already exists in the list (to avoid duplicates or update content)
    let item = document.querySelector(`.idea-item[data-id="${idea.id}"]`);
    const dateStr = new Date(idea.timestamp).toLocaleString();
    const innerHTML = `
      <div class="idea-header">${idea.title}</div>
      <div class="idea-body">${idea.description}</div>
      <div class="idea-meta">${dateStr}</div>
    `;

    if (item) {
        // Update existing item
        item.innerHTML = innerHTML;
        if (isNew) {
            item.classList.add('new-idea');
            setTimeout(() => item.classList.remove('new-idea'), 2000);
        }
        return;
    }

    // Create new item
    item = document.createElement('div');
    item.className = 'idea-item';
    item.setAttribute('data-id', idea.id);
    
    if (isNew) {
        item.classList.add('new-idea');
        setTimeout(() => item.classList.remove('new-idea'), 2000);
    }

    item.innerHTML = innerHTML;

    // Prepend to show newest first!
    ideasList.prepend(item);
  }
});
