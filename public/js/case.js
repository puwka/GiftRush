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
const caseImageContainer = document.getElementById('case-image-container')
const rouletteContainer = document.getElementById('roulette-container')
const wonItemContainer = document.getElementById('won-item-container')
const wonItemImage = document.getElementById('won-item-image')
const wonItemName = document.getElementById('won-item-name')

// Переменные состояния
let currentCase = null
let caseItems = []
let isSpinning = false
let currentBalance = 0
let quantity = 1
let wonItems = []
let animationId = null
let currentPosition = 0
let targetPosition = 0
let spinStartTime = 0
let spinDuration = 6000 // 6 секунд анимации
let isFirstSpin = true

// Основная функция инициализации
async function initApp() {
  if (caseImageContainer) {
    caseImageContainer.classList.remove('hidden')
  }
  
  if (rouletteContainer) {
    rouletteContainer.classList.remove('visible')
    rouletteContainer.classList.add('hidden')
  }

  if (wonItemContainer) {
    wonItemContainer.classList.add('hidden');
    wonItemContainer.style.opacity = '0';
    wonItemContainer.style.transform = 'translateY(20px)';
  }

  if (demoModeToggle) {
    if (!tg.initDataUnsafe?.user) {
      demoModeToggle.checked = true
      if (userBalance) userBalance.textContent = "∞"
    }
    
    demoModeToggle.addEventListener('change', function() {
      if (this.checked) {
        if (userBalance) userBalance.textContent = "∞"
      } else {
        if (userBalance) userBalance.textContent = currentBalance
      }
    })

    // Добавляем обработчик для кнопки пополнения в демо-режиме
    document.getElementById('deposit-btn')?.addEventListener('click', () => {
      document.getElementById('deposit-modal').classList.add('active')
    })
  }

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
  if (!tg.initDataUnsafe?.user) return

  const { data: user, error } = await supabase
    .from('users')
    .select('balance, avatar_url')
    .eq('tg_id', tg.initDataUnsafe.user.id)
    .single()
  
  if (error) throw error
  
  currentBalance = user.balance || 0
  userBalance.textContent = currentBalance

  const profilePic = document.getElementById('profile-pic')
  if (user.avatar_url) {
    profilePic.innerHTML = `<img src="${user.avatar_url}" alt="Profile" class="avatar-img-small">`
  } else {
    profilePic.innerHTML = `<i class="fas fa-user"></i>`
  }
  
  // Добавляем обработчик для кнопки пополнения
  document.getElementById('deposit-btn')?.addEventListener('click', () => {
    document.getElementById('deposit-modal').classList.add('active')
  })
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
  
  let rouletteHTML = ''
  for (let i = 0; i < 3; i++) {
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

// Загрузка возможных призов
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

// Настройка обработчиков событий
function setupEventListeners() {
  document.getElementById('increase-qty')?.addEventListener('click', () => {
    if (quantity < 3) {
      quantity++
      updateQuantity()
    }
  })

  document.getElementById('decrease-qty')?.addEventListener('click', () => {
    if (quantity > 1) {
      quantity--
      updateQuantity()
    }
  })

  if (openCaseBtn) {
    openCaseBtn.addEventListener('click', () => openCases(quantity))
  }

  document.getElementById('try-again-btn')?.addEventListener('click', tryAgain)

  document.getElementById('sell-item-btn')?.addEventListener('click', () => {
    const itemValue = parseInt(document.getElementById('won-item-value').textContent);
    if (confirm(`Продать предмет за ${itemValue} монет?`)) {
      // Логика продажи предмета
      tryAgain();
    }
  });
}

// Обновление количества
function updateQuantity() {
  document.getElementById('case-quantity').textContent = quantity
  updateTotalPrice()
}

function updateTotalPrice() {
  if (currentCase) {
    const total = currentCase.price * quantity
    document.getElementById('total-price').textContent = total
    
    const openText = document.getElementById('open-text')
    if (quantity > 1) {
      openText.textContent = `ОТКРЫТЬ ${quantity} КЕЙСА`
    } else {
      openText.textContent = 'ОТКРЫТЬ КЕЙС'
    }
  }
}

// ... (остальной код остается без изменений до функции openCases)

async function spinRoulette() {
  return new Promise(resolve => {
    const itemWidth = 150;
    const itemsCount = caseItems.length;
    const targetIndex = Math.floor(Math.random() * itemsCount);
    targetPosition = (itemsCount * 5 + targetIndex) * itemWidth;
    
    // Сохраняем выигранный предмет
    const wonItem = caseItems[targetIndex];
    wonItems = [wonItem];
    
    // Создаем расширенный список элементов для плавной анимации
    const extendedItems = Array(10).fill().flatMap(() => caseItems);
    rouletteItems.innerHTML = extendedItems.map(item => `
      <div class="roulette-item" data-item-id="${item.id}">
        <img src="${item.image_url || 'https://via.placeholder.com/150'}" alt="${item.name}">
      </div>
    `).join('');

    let startTime = null;
    
    function animate(timestamp) {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / spinDuration, 1);
      
      // Плавное замедление анимации
      let distance;
      if (elapsed < spinDuration * 0.7) {
        // Быстрая фаза
        distance = (targetPosition * 0.8) * (elapsed / (spinDuration * 0.7));
      } else {
        // Медленная фаза
        const slowProgress = (elapsed - spinDuration * 0.7) / (spinDuration * 0.3);
        distance = (targetPosition * 0.8) + (targetPosition * 0.2) * (1 - Math.pow(1 - slowProgress, 4));
      }
      
      rouletteItems.style.transform = `translateX(-${distance}px)`;
      
      if (progress < 1) {
        animationId = requestAnimationFrame(animate);
      } else {
        // Анимация завершена
        setTimeout(() => {
          resolve(wonItem); // Возвращаем выигранный предмет
        }, 500);
      }
    }
    
    animationId = requestAnimationFrame(animate);
  });
}

async function openCases(count) {
  if (isSpinning) return;
  isSpinning = true;
  
  // Скрываем элементы управления и изображение кейса
  document.querySelector('.case-controls').classList.add('hidden');
  document.querySelector('.open-case-btn').classList.add('hidden');
  document.querySelector('.demo-mode-container').classList.add('hidden');
  caseImageContainer.classList.add('hidden');
  
  // Показываем рулетку
  rouletteContainer.classList.remove('hidden');
  rouletteContainer.style.display = 'block';
  
  // Запускаем анимацию рулетки и получаем выигранный предмет
  const wonItem = await spinRoulette();
  
  // После завершения анимации рулетки, скрываем ее
  rouletteContainer.classList.add('hidden');
  
  // Показываем выигрыш с тем же предметом, что и в рулетке
  await showWonItem(wonItem);
  
  isSpinning = false;
}

// Обновляем функцию showWonItem в case.js

async function showWonItem(item) {
  return new Promise(resolve => {
    wonItemImage.src = item.image_url || 'https://via.placeholder.com/150';
    wonItemName.textContent = item.name;
    document.getElementById('won-item-value').textContent = item.value;
    
    // Сдвигаем возможные призы вниз
    const possiblePrizes = document.querySelector('.possible-prizes');
    possiblePrizes.style.marginTop = '200px';
    
    // Плавное появление
    wonItemContainer.style.opacity = '0';
    wonItemContainer.style.transform = 'translateY(20px)';
    wonItemContainer.classList.remove('hidden');
    wonItemContainer.style.display = 'flex';
    
    setTimeout(() => {
      wonItemContainer.style.opacity = '1';
      wonItemContainer.style.transform = 'translateY(0)';
      
      // Сохраняем предмет в инвентарь, если пользователь авторизован
      if (tg.initDataUnsafe?.user && !demoModeToggle.checked) {
        saveToInventory(item);
      }
      
      resolve();
    }, 50);
  });
}

// Новая функция для сохранения предмета в инвентарь
async function saveToInventory(item) {
  try {
    const { error } = await supabase
      .from('user_inventory')
      .insert({
        user_id: tg.initDataUnsafe.user.id,
        item_id: item.id,
        case_id: caseId
      });
    
    if (error) throw error;
  } catch (error) {
    console.error('Ошибка сохранения в инвентарь:', error);
  }
}

// Обновляем функцию tryAgain
function tryAgain() {
  // Возвращаем возможные призы на место
  const possiblePrizes = document.querySelector('.possible-prizes');
  possiblePrizes.style.marginTop = '20px';
  
  // Плавное скрытие выигрыша
  wonItemContainer.style.opacity = '0';
  wonItemContainer.style.transform = 'translateY(20px)';
  
  setTimeout(() => {
    wonItemContainer.style.display = 'none';
    
    // Показываем элементы управления
    document.querySelector('.case-controls').classList.remove('hidden');
    document.querySelector('.open-case-btn').classList.remove('hidden');
    document.querySelector('.demo-mode-container').classList.remove('hidden');
    
    // Показываем изображение кейса
    caseImageContainer.classList.remove('hidden');
  }, 300);
}

// ... (остальной код остается без изменений)

function hideAllElements() {
  caseImageContainer.classList.add('hidden');
  document.querySelector('.case-controls').classList.add('hidden');
  document.querySelector('.open-case-btn').classList.add('hidden');
  document.querySelector('.demo-mode-container').classList.add('hidden');
}

function showMainElements() {
  caseImageContainer.classList.remove('hidden');
  document.querySelector('.case-controls').classList.remove('hidden');
  document.querySelector('.open-case-btn').classlist.remove('hidden');
  document.querySelector('.demo-mode-container').classList.remove('hidden');
}

// ... (остальной код остается без изменений)

// Сохранение результатов
async function saveResults() {
  try {
    const newBalance = currentBalance - (currentCase.price * quantity)
    
    const { error: updateError } = await supabase
      .from('users')
      .update({ balance: newBalance })
      .eq('tg_id', tg.initDataUnsafe.user.id)
    
    if (updateError) throw updateError
    
    await supabase
      .from('transactions')
      .insert({
        user_id: tg.initDataUnsafe.user.id,
        amount: currentCase.price * quantity,
        type: 'case_open',
        description: `Открытие кейса "${currentCase.name}" (${quantity} шт)`
      })
    
    currentBalance = newBalance
    if (!demoModeToggle.checked) {
      userBalance.textContent = currentBalance
    }
    
  } catch (error) {
    console.error('Ошибка сохранения результатов:', error)
  }
}

// Отключение/включение кнопок
function disableButtons() {
  if (openCaseBtn) openCaseBtn.disabled = true
  if (demoModeToggle) demoModeToggle.disabled = true
  document.getElementById('increase-qty').disabled = true
  document.getElementById('decrease-qty').disabled = true
}

function enableButtons() {
  if (openCaseBtn) openCaseBtn.disabled = false
  if (demoModeToggle) demoModeToggle.disabled = false
  document.getElementById('increase-qty').disabled = false
  document.getElementById('decrease-qty').disabled = false
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', initApp)