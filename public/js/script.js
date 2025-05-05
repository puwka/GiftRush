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

// В script.js
async function initTelegramAuth() {
    console.log('1. Auth started'); // Логирование
    
    if (!window.Telegram?.WebApp) {
      console.warn('Telegram WebApp not available');
      return;
    }
  
    const tg = window.Telegram.WebApp;
    console.log('2. TG WebApp initData:', tg.initData); // Логируем данные Telegram
  
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: tg.initData })
      });
      
      console.log('3. Server response status:', response.status); // Логируем статус
      
      const data = await response.json();
      console.log('4. Server response data:', data); // Логируем данные
      
      if (!data?.user) throw new Error('No user data in response');
      
      localStorage.setItem('user', JSON.stringify(data.user));
      console.log('5. User saved to localStorage:', data.user); // Логируем
      
      updateUI(data.user);
    } catch (error) {
      console.error('Auth error:', error);
    }
}
  
  function updateUI(user) {
    console.log('6. Updating UI with user:', user); // Логируем
    
    // Обновляем баланс
    const balanceElement = document.getElementById('user-balance');
    if (balanceElement) {
      balanceElement.textContent = user.balance || 0;
      console.log('7. Balance updated');
    }
    
    // Обновляем аватар
    const profilePic = document.querySelector('.profile-pic');
    if (profilePic) {
      profilePic.innerHTML = user.photo_url 
        ? `<img src="${user.photo_url}" alt="Profile">`
        : `<i class="fas fa-user"></i>`;
      console.log('8. Profile pic updated');
    }
  }
  
  // Запускаем при загрузке
  document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, starting auth...');
    initTelegramAuth();
});