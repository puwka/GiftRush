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
const openSingleBtn = document.getElementById('open-case')
const rouletteItems = document.getElementById('roulette-items')
const wonPrizes = document.getElementById('won-prizes')
const possiblePrizes = document.getElementById('possible-prizes')
const demoModeToggle = document.getElementById('demo-mode')
const userBalance = document.getElementById('user-balance')

// Проверяем, существуют ли элементы в case.html
if (!openSingleBtn || !openThreeBtn) {
  console.log('Элементы для открытия кейсов не найдены, возможно, это не страница case.html')
}

// Переменные состояния
let currentCase = null
let caseItems = []
let wonItems = []
let isSpinning = false
let currentBalance = 0

// Основная функция инициализации
async function initApp() {
  if (tg.initDataUnsafe.user) {
    try {
      // Загружаем данные пользователя
      await loadUserData()
      
      // Загружаем данные кейса
      await loadCaseData()
      
      // Загружаем возможные призы
      await loadPossiblePrizes()
      
      // Настраиваем обработчики событий
      setupEventListeners()
    } catch (error) {
      console.error('Ошибка инициализации:', error)
      tg.showAlert('Произошла ошибка при загрузке данных')
    }
  } else {
    console.log('Пользователь Telegram не авторизован')
    // Режим демонстрации по умолчанию
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
  
  // Загружаем предметы для этого кейса
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
  
  // Создаем элементы для рулетки (несколько копий каждого предмета)
  let rouletteHTML = ''
  for (let i = 0; i < 3; i++) { // 3 копии каждого предмета для плавности
    items.forEach(item => {
      rouletteHTML += `
        <div class="roulette-item" data-item-id="${item.id}">
          <img src="${item.image_url || 'https://via.placeholder.com/80'}" alt="${item.name}">
          <div class="roulette-item-name">${item.name}</div>
          <div class="roulette-item-value">${item.value}</div>
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
      <div class="prize-item rarity-${item.rarity || 'common'}">
        <img src="${item.image_url || 'https://via.placeholder.com/60'}" alt="${item.name}">
        <div class="prize-item-name">${item.name}</div>
        <div class="prize-item-value">${item.value}</div>
      </div>
    `
  })
  
  possiblePrizes.innerHTML = html
}

// Настройка обработчиков событий
// Настройка обработчиков событий
function setupEventListeners() {
  // Проверяем существование элементов перед добавлением обработчиков
  if (openSingleBtn) {
    openSingleBtn.addEventListener('click', () => openCases(1))
  }

  // Добавляем обработчик для кнопки "Назад"
  const backBtn = document.getElementById('back-btn')
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      window.location.href = 'index.html'
    })
  }
}

// Открытие кейсов
async function openCases(count) {
  if (isSpinning) return
  
  const demoMode = demoModeToggle.checked
  const price = currentCase.price * count
  
  if (!demoMode) {
    if (currentBalance < price) {
      tg.showAlert('Недостаточно средств на балансе')
      return
    }
  }
  
  isSpinning = true
  disableButtons()
  
  // Очищаем предыдущие выигрыши
  wonItems = []
  wonPrizes.innerHTML = ''
  
  // Запускаем анимацию рулетки
  for (let i = 0; i < count; i++) {
    await spinRoulette(i === count - 1)
    
    // Выбираем случайный предмет с учетом вероятности
    const wonItem = selectRandomItem()
    wonItems.push(wonItem)
    
    // Добавляем выигранный предмет
    addWonPrize(wonItem)
  }
  
  if (!demoMode) {
    // Обновляем баланс и сохраняем результаты
    await saveResults()
  }
  
  isSpinning = false
  enableButtons()
}

// Анимация рулетки
function spinRoulette(isLastSpin) {
  return new Promise(resolve => {
    const itemsCount = caseItems.length * 3
    const spinDuration = isLastSpin ? 3000 : 2000
    const spinDistance = Math.floor(Math.random() * 1000) + 1000
    
    let startTime = null
    let currentPosition = 0
    
    function animate(timestamp) {
      if (!startTime) startTime = timestamp
      const progress = timestamp - startTime
      const percentage = Math.min(progress / spinDuration, 1)
      
      // Замедление в конце
      const easing = 1 - Math.pow(1 - percentage, 3)
      
      // Перемещаем рулетку
      currentPosition = spinDistance * easing
      rouletteItems.style.transform = `translateX(-${currentPosition}px)`
      
      if (progress < spinDuration) {
        requestAnimationFrame(animate)
      } else {
        // Выравниваем по центру после остановки
        const itemWidth = 150 // Ширина элемента рулетки
        const centerOffset = Math.floor(currentPosition / itemWidth) * itemWidth
        rouletteItems.style.transform = `translateX(-${centerOffset}px)`
        resolve()
      }
    }
    
    requestAnimationFrame(animate)
  })
}

// Выбор случайного предмета с учетом вероятности
function selectRandomItem() {
  const random = Math.random()
  let cumulativeProbability = 0
  
  for (const item of caseItems) {
    cumulativeProbability += item.probability || (1 / caseItems.length)
    if (random <= cumulativeProbability) {
      return item
    }
  }
  
  return caseItems[caseItems.length - 1]
}

// Добавление выигранного предмета
function addWonPrize(item) {
  const prizeElement = document.createElement('div')
  prizeElement.className = `prize-item rarity-${item.rarity || 'common'} won-prize`
  prizeElement.innerHTML = `
    <img src="${item.image_url || 'https://via.placeholder.com/60'}" alt="${item.name}">
    <div class="prize-item-name">${item.name}</div>
    <div class="prize-item-value">${item.value}</div>
  `
  
  wonPrizes.appendChild(prizeElement)
  
  // Анимация появления
  setTimeout(() => {
    prizeElement.classList.remove('won-prize')
  }, 1000)
}

// Сохранение результатов
async function saveResults() {
  try {
    const totalValue = wonItems.reduce((sum, item) => sum + item.value, 0)
    const price = currentCase.price * wonItems.length
    
    // Обновляем баланс
    const newBalance = currentBalance - price + totalValue
    const { error: balanceError } = await supabase
      .from('users')
      .update({ balance: newBalance })
      .eq('tg_id', tg.initDataUnsafe.user.id)
    
    if (balanceError) throw balanceError
    
    // Записываем транзакции
    await supabase
      .from('transactions')
      .insert({
        user_id: tg.initDataUnsafe.user.id,
        amount: -price,
        type: 'case_open',
        description: `Открытие кейса "${currentCase.name}"`
      })
    
    if (totalValue > 0) {
      await supabase
        .from('transactions')
        .insert({
          user_id: tg.initDataUnsafe.user.id,
          amount: totalValue,
          type: 'prize',
          description: `Выигрыш из кейса "${currentCase.name}"`
        })
    }
    
    // Записываем открытые кейсы
    const openedCases = wonItems.map(item => ({
      user_id: tg.initDataUnsafe.user.id,
      case_type: currentCase.type,
      prize_value: item.value,
      prize_description: item.name,
      item_id: item.id,
      is_nft: item.is_nft || false,
      nft_contract_address: item.nft_contract_address || null,
      nft_token_id: item.nft_token_id || null
    }))
    
    await supabase
      .from('opened_cases')
      .insert(openedCases)
    
    // Обновляем UI
    currentBalance = newBalance
    userBalance.textContent = newBalance
    
  } catch (error) {
    console.error('Ошибка сохранения результатов:', error)
    tg.showAlert('Произошла ошибка при сохранении результатов')
  }
}

// Отключение кнопок во время анимации
function disableButtons() {
  openSingleBtn.disabled = true
  openThreeBtn.disabled = true
  demoModeToggle.disabled = true
}

// Включение кнопок после анимации
function enableButtons() {
  openSingleBtn.disabled = false
  openThreeBtn.disabled = false
  demoModeToggle.disabled = false
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', initApp)