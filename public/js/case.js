// Инициализация Supabase
import { createClient } from 'https://esm.sh/@supabase/supabase-js'

const supabaseUrl = 'https://lhduaxfmgkxlukghaopy.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoZHVheGZtZ2t4bHVrZ2hhb3B5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY0ODIyMzIsImV4cCI6MjA2MjA1ODIzMn0.wjhrbM7PFLYkBb_xnPf83Tzn8dov9OYdJV5CLWSDRy4'
const supabase = createClient(supabaseUrl, supabaseKey)

// Инициализация Telegram WebApp
const tg = window.Telegram.WebApp
tg.expand()

// Получаем ID кейса из URL
const urlParams = new URLSearchParams(window.location.search)
const caseId = urlParams.get('id')

// Элементы DOM
const caseName = document.getElementById('case-name')
const casePriceValue = document.getElementById('total-price')
const openCaseBtn = document.getElementById('open-case')
const rouletteItems = document.getElementById('roulette-items')
const possiblePrizes = document.getElementById('possible-prizes')
const demoModeToggle = document.getElementById('demo-mode')
const userBalance = document.getElementById('user-balance')
const totalPriceElement = document.getElementById('total-price')
const totalPriceBtnElement = document.getElementById('total-price-btn')
const caseImageContainer = document.getElementById('case-image-container');
const rouletteContainer = document.getElementById('roulette-container');


// Переменные состояния
let currentCase = null
let caseItems = []
let isSpinning = false
let currentBalance = 0
let quantity = 1
let wonItems = [] // Добавьте эту строку
let animationId = null;
let currentPosition = 0;
let targetPosition = 0;
let spinStartTime = 0;
let spinDuration = 6000; // 6 секунд анимации
let isFirstSpin = true;

// Основная функция инициализации
async function initApp() {
  // Проверяем существование элементов перед работой с ними
  if (caseImageContainer) {
    caseImageContainer.classList.remove('hidden');
  }
  
  if (rouletteContainer) {
    rouletteContainer.classList.add('hidden');
  }

  // В функции initApp:
  if (demoModeToggle) {
    // Установка начального состояния
    if (!tg.initDataUnsafe?.user) {
        demoModeToggle.checked = true;
        if (userBalance) userBalance.textContent = "∞";
    }
    
    // Обработчик изменения
    demoModeToggle.addEventListener('change', function() {
        if (this.checked) {
            if (userBalance) userBalance.textContent = "∞";
            tg.showAlert("Демо-режим активирован");
        } else {
            if (userBalance) userBalance.textContent = currentBalance;
            tg.showAlert("Демо-режим деактивирован");
        }
    });
  }

  // Проверяем, есть ли пользователь Telegram
  if (tg.initDataUnsafe?.user) {
    try {
      await loadUserData()
      await loadCaseData()
      await loadPossiblePrizes()
      setupEventListeners()
    } catch (error) {
      console.error('Ошибка инициализации:', error)
      tg.showAlert('Произошла ошибка при загрузке данных')
    }
  } else {
    console.log('Пользователь Telegram не авторизован')
    if (demoModeToggle) demoModeToggle.checked = true
    await loadCaseData()
    await loadPossiblePrizes()
    setupEventListeners()
  }
}

// Загрузка данных пользователя
async function loadUserData() {
  if (!tg.initDataUnsafe?.user) return;

  const { data: user, error } = await supabase
    .from('users')
    .select('balance, avatar_url')
    .eq('tg_id', tg.initDataUnsafe.user.id)
    .single()
  
  if (error) throw error
  
  currentBalance = user.balance || 0
  userBalance.textContent = currentBalance

  // Обновляем аватар
  const profilePic = document.getElementById('profile-pic')
  if (user.avatar_url) {
    profilePic.innerHTML = `<img src="${user.avatar_url}" alt="Profile" class="avatar-img-small">`
  } else {
    profilePic.innerHTML = `<i class="fas fa-user"></i>`
  }
}

// Загрузка данных кейса
async function loadCaseData() {
  if (!caseId) {
    console.error('ID кейса не указан')
    return
  }
  
  const { data: caseData, error } = await supabase
    .from('cases')
    .select('*')
    .eq('id', caseId)
    .single()
  
  if (error) throw error
  
  currentCase = caseData
  caseName.textContent = caseData.name
  casePriceValue.textContent = caseData.price
  updateTotalPrice()
  
  await loadCaseItems()
}

// Загрузка предметов кейса
async function loadCaseItems() {
  const { data: items, error } = await supabase
    .from('case_items')
    .select('*')
    .eq('case_id', caseId)
    .order('value', { ascending: false })
  
  if (error) throw error
  
  caseItems = items
  
  // Создаем элементы для рулетки (только изображения)
  let rouletteHTML = ''
  for (let i = 0; i < 3; i++) { // 3 копии каждого предмета
    items.forEach(item => {
      rouletteHTML += `
        <div class="roulette-item" data-item-id="${item.id}">
          <img src="${item.image_url || 'https://via.placeholder.com/150'}" alt="${item.name}">
        </div>
      `
    })
  }
  
  rouletteItems.innerHTML = rouletteHTML
}

// Загрузка возможных призов (в 2 ряда)
// Загрузка возможных призов с названием и ценой
async function loadPossiblePrizes() {
  if (!caseItems.length) await loadCaseItems()
  
  let html = ''
  caseItems.forEach(item => {
    html += `
      <div class="prize-card rarity-${item.rarity || 'common'}">
        <div class="prize-image">
          <img src="${item.image_url || 'https://via.placeholder.com/120'}" alt="${item.name}">
        </div>
        <div class="prize-info">
          <div class="prize-name">${item.name}</div>
          <div class="prize-value">${item.value} <i class="fas fa-coins"></i></div>
        </div>
      </div>
    `
  })
  
  possiblePrizes.innerHTML = html
}

// Демо-режим
demoModeToggle?.addEventListener('change', function() {
  if (this.checked) {
    userBalance.textContent = "∞"
  } else {
    userBalance.textContent = currentBalance
  }
})

// В функции initApp добавьте:
if (demoModeToggle?.checked) {
  userBalance.textContent = "∞"
}

// Настройка обработчиков событий
function setupEventListeners() {
  // Управление количеством
  document.getElementById('increase-qty')?.addEventListener('click', () => {
    if (quantity < 3) {
        quantity++;
        updateQuantity();
    }
  });

  document.getElementById('decrease-qty')?.addEventListener('click', () => {
      if (quantity > 1) {
          quantity--;
          updateQuantity();
      }
  });

  if (openCaseBtn) {
    openCaseBtn.addEventListener('click', () => openCases(quantity))
  }
}

// Обновление количества
function updateQuantity() {
  document.getElementById('case-quantity').textContent = quantity
  updateTotalPrice()
}

function updateTotalPrice() {
  if (currentCase) {
      const total = currentCase.price * quantity;
      // Обновляем оба элемента с ценой
      document.getElementById('total-price').textContent = total;
      
      // Обновляем текст кнопки в зависимости от количества
      const openText = document.getElementById('open-text');
      if (quantity > 1) {
          openText.textContent = `ОТКРЫТЬ ${quantity} КЕЙСА`;
      } else {
          openText.textContent = 'ОТКРЫТЬ КЕЙС';
      }
  }
}

function spinRoulette() {
  return new Promise(resolve => {
      const itemWidth = 150;
      const itemsCount = caseItems.length;
      const targetIndex = Math.floor(Math.random() * itemsCount);
      
      // Создаем 10 копий предметов для бесконечного вращения
      const extendedItems = Array(10).fill().flatMap(() => caseItems);
      rouletteItems.innerHTML = extendedItems.map(item => `
          <div class="roulette-item" data-item-id="${item.id}">
              <img src="${item.image_url || 'https://via.placeholder.com/150'}" alt="${item.name}">
          </div>
      `).join('');

      // Настройки анимации
      const totalDuration = 6000; // 6 секунд общее время
      const fastDuration = 4000;  // 4 секунды быстрого вращения
      const slowDuration = 2000;  // 2 секунды замедления
      const targetPosition = (itemsCount * 5 + targetIndex) * itemWidth;
      
      let startTime = null;
      let distanceCovered = 0;

      // Плавное появление рулетки
      rouletteContainer.style.opacity = '0';
      rouletteContainer.style.transition = 'opacity 0.3s ease-out';
      setTimeout(() => {
          rouletteContainer.style.opacity = '1';
      }, 10);

      function animate(timestamp) {
          if (!startTime) startTime = timestamp;
          const elapsed = timestamp - startTime;
          const progress = Math.min(elapsed / totalDuration, 1);

          // Фаза быстрого вращения (первые 4 секунды)
          if (elapsed < fastDuration) {
              distanceCovered = (targetPosition * 0.8) * (elapsed / fastDuration);
          } 
          // Фаза замедления (последние 2 секунды)
          else {
              const slowProgress = (elapsed - fastDuration) / slowDuration;
              const slowEasing = 1 - Math.pow(1 - slowProgress, 4); // Сильное замедление
              distanceCovered = (targetPosition * 0.8) + (targetPosition * 0.2) * slowEasing;
          }

          rouletteItems.style.transform = `translateX(-${distanceCovered}px)`;

          if (progress < 1) {
              requestAnimationFrame(animate);
          } else {
              // Плавное исчезновение рулетки
              rouletteContainer.style.transition = 'opacity 0.5s ease-in';
              rouletteContainer.style.opacity = '0';
              
              // После анимации возвращаем оригинальные предметы
              setTimeout(() => {
                  rouletteItems.innerHTML = caseItems.map(item => `
                      <div class="roulette-item" data-item-id="${item.id}">
                          <img src="${item.image_url || 'https://via.placeholder.com/150'}" alt="${item.name}">
                      </div>
                  `).join('');
                  
                  // Точная остановка на выигранном предмете
                  const finalPosition = targetIndex * itemWidth;
                  rouletteItems.style.transform = `translateX(-${finalPosition}px)`;
                  
                  // Запоминаем выигрыш
                  wonItems.push(caseItems[targetIndex]);
                  
                  // Возвращаем видимость контейнерам
                  setTimeout(() => {
                      caseImageContainer.style.transition = 'opacity 0.5s ease-out';
                      caseImageContainer.style.opacity = '1';
                      resolve();
                  }, 100);
              }, 500); // Задержка перед сбросом
          }
      }

      requestAnimationFrame(animate);
  });
}

// Обновляем функцию openCases для использования новой анимации
async function openCases(count) {
  if (isSpinning) return;
  
  const demoMode = demoModeToggle?.checked;
  const price = currentCase.price * count;
  
  if (!demoMode && currentBalance < price) {
      tg.showAlert('Недостаточно средств на балансе');
      return;
  }
  
  isSpinning = true;
  disableButtons();
  wonItems = [];
  
  // Показываем рулетку и скрываем изображение кейса
  if (caseImageContainer) caseImageContainer.classList.add('hidden');
  if (rouletteContainer) rouletteContainer.classList.remove('hidden');
  
  try {
      await spinRoulette();
      
      if (!demoMode) {
          currentBalance -= price;
          if (userBalance) userBalance.textContent = currentBalance;
          await saveResults();
      }
      
      // После завершения анимации показываем изображение кейса снова
      setTimeout(() => {
          if (caseImageContainer) caseImageContainer.classList.remove('hidden');
          if (rouletteContainer) rouletteContainer.classList.add('hidden');
          
          if (wonItems.length > 0) {
              tg.showAlert(`Вы выиграли: ${wonItems[0].name} (${wonItems[0].value} монет)`);
          }
          
          isSpinning = false;
          enableButtons();
      }, 1000);
  } catch (error) {
      console.error('Ошибка при открытии кейса:', error);
      tg.showAlert('Произошла ошибка при открытии кейса');
      isSpinning = false;
      enableButtons();
  }
}

async function saveResults() {
  try {
    // Обновляем баланс пользователя
    const newBalance = currentBalance - (currentCase.price * quantity)
    
    const { error: updateError } = await supabase
      .from('users')
      .update({ balance: newBalance })
      .eq('tg_id', tg.initDataUnsafe.user.id)
    
    if (updateError) throw updateError
    
    // Записываем транзакцию
    await supabase
      .from('transactions')
      .insert({
        user_id: tg.initDataUnsafe.user.id,
        amount: currentCase.price * quantity,
        type: 'case_open',
        description: `Открытие кейса "${currentCase.name}" (${quantity} шт)`
      })
    
    // Обновляем UI
    currentBalance = newBalance
    if (!demoModeToggle.checked) {
      userBalance.textContent = currentBalance
    }
    
    tg.showAlert(`Вы успешно открыли ${quantity} кейс(а)`)
  } catch (error) {
    console.error('Ошибка сохранения результатов:', error)
    tg.showAlert('Произошла ошибка при сохранении результатов')
  }
}

// Отключение/включение кнопок
function disableButtons() {
  openCaseBtn.disabled = true
  demoModeToggle.disabled = true
}

function enableButtons() {
  openCaseBtn.disabled = false
  demoModeToggle.disabled = false
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', initApp)