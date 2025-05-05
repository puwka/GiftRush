import { TelegramAuth } from 'js/auth.js';

document.addEventListener('DOMContentLoaded', async () => {
  const user = await TelegramAuth.init();
  
  if (user) {
    updateUI(user);
    initApp();
  } else {
    showAuthError();
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
});

function updateUI(user) {
  // Обновление шапки
  document.getElementById('user-balance').textContent = user.balance;
  
  // Обновление профиля
  if (user.avatar_url) {
    document.querySelector('.avatar').innerHTML = `
      <img src="${user.avatar_url}" alt="Profile" class="avatar-img">
    `;
  }
  
  document.querySelector('.username').textContent = user.username || `ID: ${user.tg_id}`;
}

function showAuthError() {
  alert('Для использования приложения требуется авторизация через Telegram');
}