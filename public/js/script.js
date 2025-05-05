document.addEventListener('DOMContentLoaded', function() {
    // Переключение вкладок
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
});

async function initTelegramAuth() {
    if (window.Telegram && window.Telegram.WebApp) {
      const tg = window.Telegram.WebApp
      
      // Расширяем приложение на весь экран
      tg.expand()
      
      // Отправляем данные на сервер
      try {
        const response = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData: tg.initData })
        })
        
        const { user } = await response.json()
        localStorage.setItem('user', JSON.stringify(user))
        updateUI(user)
      } catch (error) {
        console.error('Auth error:', error)
      }
    }
  }
  
  function updateUI(user) {
    document.getElementById('user-balance').textContent = user.balance
    const profilePic = document.querySelector('.profile-pic')
    profilePic.innerHTML = `<img src="https://i.pravatar.cc/150?u=${user.id}" alt="Profile">`
  }
  
  // Запускаем при загрузке
  document.addEventListener('DOMContentLoaded', initTelegramAuth)