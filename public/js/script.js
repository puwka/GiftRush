document.addEventListener('DOMContentLoaded', async () => {
    try {
      if (!window.Telegram?.WebApp) {
        console.warn('Not in Telegram context');
        return;
      }
  
      const tg = window.Telegram.WebApp;
      tg.expand();
  
      // Авторизация
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          initData: tg.initData
        })
      });
  
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Auth failed');
      }

      const tabLinks = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Удаляем active у всех кнопок
            tabLinks.forEach(item => item.classList.remove('active'));
            
            // Добавляем active текущей кнопке
            this.classList.add('active');
            
            // Скрываем все вкладки
            tabContents.forEach(content => content.classList.add('hidden'));
            
            // Показываем нужную вкладку
            const tabId = this.getAttribute('data-tab');
            document.getElementById(tabId).classList.remove('hidden');
        });
    });
    
    // Кнопка профиля в хедере
    document.getElementById('profile-btn').addEventListener('click', function() {
        // Переключаем на вкладку профиля
        tabLinks.forEach(item => item.classList.remove('active'));
        document.querySelector('.nav-item[data-tab="profile-tab"]').classList.add('active');
        
        tabContents.forEach(content => content.classList.add('hidden'));
        document.getElementById('profile-tab').classList.remove('hidden');
    });
  
      const { user } = await response.json();
      updateUI(user);
      initTabs();
  
    } catch (error) {
      console.error('Initialization error:', error);
      // Fallback для разработки
      if (window.location.hostname === 'localhost') {
        updateUI({
          tg_id: 12345,
          username: 'Test User',
          balance: 1000,
          avatar_url: 'https://via.placeholder.com/150'
        });
      }
    }
  });
  
  function updateUI(user) {
    document.getElementById('user-balance').textContent = user.balance;
    document.querySelector('.username').textContent = user.username;
    
    if (user.avatar_url) {
      document.querySelector('.avatar').innerHTML = `
        <img src="${user.avatar_url}" alt="Profile" class="avatar-img">
      `;
    }
  }