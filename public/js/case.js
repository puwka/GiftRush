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
const casePriceValue = document.getElementById('case-price-value')
const openCaseBtn = document.getElementById('open-case')
const rouletteItems = document.getElementById('roulette-items')
const possiblePrizes = document.getElementById('possible-prizes')
const demoModeToggle = document.getElementById('demo-mode')
const userBalance = document.getElementById('user-balance')
const totalPrice = document.getElementById('total-price')

// Переменные состояния
let currentCase = null
let caseItems = []
let isSpinning = false
let currentBalance = 0
let quantity = 1

// Основная функция инициализации
async function initApp() {
  if (tg.initDataUnsafe.user) {
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
    demoModeToggle.checked = true
    await loadCaseData()
    await loadPossiblePrizes()
    setupEventListeners()
  }
}

// Загрузка данных пользователя
async function loadUserData() {
  const { data: user, error } = await supabase
    .from('users')
    .select('balance')
    .eq('tg_id', tg.initDataUnsafe.user.id)
    .single()
  
  if (error) throw error
  
  currentBalance = user.balance || 0
  userBalance.textContent = currentBalance
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
  if (openCaseBtn) {
    openCaseBtn.addEventListener('click', () => openCases(quantity))
  }

  // Обработчики изменения количества
  document.getElementById('increase-qty')?.addEventListener('click', () => {
    quantity = Math.min(quantity + 1, 10)
    updateQuantity()
  })

  document.getElementById('decrease-qty')?.addEventListener('click', () => {
    quantity = Math.max(quantity - 1, 1)
    updateQuantity()
  })
}

// Обновление количества
function updateQuantity() {
  document.getElementById('case-quantity').textContent = quantity
  updateTotalPrice()
}

// Обновление общей цены
function updateTotalPrice() {
  if (currentCase) {
    totalPrice.textContent = currentCase.price * quantity
  }
}

// Открытие кейсов
async function openCases(count) {
  if (isSpinning) return
  
  const demoMode = demoModeToggle.checked
  const price = currentCase.price * count
  
  if (!demoMode && currentBalance < price) {
    tg.showAlert('Недостаточно средств на балансе')
    return
  }
  
  isSpinning = true
  disableButtons()
  wonItems = []
  
  await spinRoulette()
  
  if (!demoMode) {
    await saveResults()
  }
  
  isSpinning = false
  enableButtons()
}

// Анимация рулетки
function spinRoulette() {
  return new Promise(resolve => {
    const itemWidth = 150
    const spinDistance = Math.floor(Math.random() * 1000) + 1000
    const spinDuration = 3000
    
    let startTime = null
    
    function animate(timestamp) {
      if (!startTime) startTime = timestamp
      const progress = timestamp - startTime
      const percentage = Math.min(progress / spinDuration, 1)
      const easing = 1 - Math.pow(1 - percentage, 3)
      
      rouletteItems.style.transform = `translateX(-${spinDistance * easing}px)`
      
      if (progress < spinDuration) {
        requestAnimationFrame(animate)
      } else {
        const centerOffset = Math.floor(spinDistance / itemWidth) * itemWidth
        rouletteItems.style.transform = `translateX(-${centerOffset}px)`
        resolve()
      }
    }
    
    requestAnimationFrame(animate)
  })
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