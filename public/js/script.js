import { supabase } from './supabase'

// Инициализация Telegram WebApp
const tg = window.Telegram.WebApp
tg.expand()

// Элементы DOM
const userBalance = document.getElementById('user-balance')
const profileBtn = document.getElementById('profile-btn')
const profilePic = document.querySelector('.profile-pic')
const usernameElement = document.querySelector('.username')
const avatarElement = document.querySelector('.avatar')

// Авторизация и загрузка данных
async function initApp() {
  if (tg.initDataUnsafe.user) {
    const { id, first_name, last_name, photo_url } = tg.initDataUnsafe.user
    const username = first_name + (last_name ? ` ${last_name}` : '')
    
    // Сохраняем или обновляем пользователя
    const { data: user, error } = await supabase
      .from('users')
      .upsert(
        { 
          tg_id: id,
          username,
          avatar_url: photo_url,
          last_login: new Date()
        },
        { onConflict: 'tg_id' }
      )
      .select()
    
    if (!error && user) {
      updateUI(user[0])
      updateBalance(user[0].tg_id)
    }
  }
}

// Обновление интерфейса
function updateUI(user) {
  // Шапка
  userBalance.textContent = user.balance || '0'
  
  // Профиль
  usernameElement.textContent = user.username || `ID: ${user.tg_id}`
  
  if (user.avatar_url) {
    avatarElement.innerHTML = `<img src="${user.avatar_url}" alt="Profile" class="avatar-img">`
    profilePic.innerHTML = `<img src="${user.avatar_url}" alt="Profile" class="avatar-img-small">`
  }
}

// Получение баланса
async function updateBalance(userId) {
  const { data, error } = await supabase
    .from('balances')
    .select('amount')
    .eq('user_id', userId)
    .single()
  
  if (!error && data) {
    userBalance.textContent = data.amount
  }
}

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

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', initApp)