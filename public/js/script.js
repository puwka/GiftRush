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
    if (!window.Telegram?.WebApp) return
  
    const tg = window.Telegram.WebApp
    tg.expand()
  
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          initData: tg.initData 
        })
      })
  
      // Проверка статуса ответа
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
  
      // Проверка наличия данных
      const data = await response.json()
      if (!data?.user) {
        throw new Error('Invalid response data')
      }
  
      localStorage.setItem('user', JSON.stringify(data.user))
      updateUI(data.user)
      
    } catch (error) {
      console.error('Auth failed:', error)
      // Fallback для разработки
      if (process.env.NODE_ENV === 'development') {
        localStorage.setItem('user', JSON.stringify({
          id: 123,
          balance: 1000
        }))
      }
    }
}