// Инициализация Supabase
import { createClient } from 'https://esm.sh/@supabase/supabase-js'

const supabaseUrl = 'https://lhduaxfmgkxlukghaopy.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoZHVheGZtZ2t4bHVrZ2hhb3B5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY0ODIyMzIsImV4cCI6MjA2MjA1ODIzMn0.wjhrbM7PFLYkBb_xnPf83Tzn8dov9OYdJV5CLWSDRy4'
const supabase = createClient(supabaseUrl, supabaseKey)

// Инициализация Telegram WebApp
const tg = window.Telegram.WebApp
tg.expand()

// Элементы DOM
const userBalance = document.getElementById('user-balance')
const profileBtn = document.getElementById('profile-btn')
const profilePic = document.querySelector('.profile-pic')
const usernameElement = document.querySelector('.username')
const avatarElement = document.querySelector('.avatar')
const statBalance = document.querySelector('.stat-item:nth-child(1) .stat-value')
const statCases = document.querySelector('.stat-item:nth-child(2) .stat-value')
const statPrizes = document.querySelector('.stat-item:nth-child(3) .stat-value')

// Основная функция инициализации
async function initApp() {
  if (tg.initDataUnsafe.user) {
    const userData = tg.initDataUnsafe.user
    try {
      // Сохраняем/обновляем пользователя
      const user = await upsertUser(userData)
      
      // Обновляем UI
      updateUI(user)
      
      // Загружаем статистику
      await loadUserStats(user.tg_id)
      
      // Загружаем категории и кейсы
      await loadCategories()
      await loadCases()
    } catch (error) {
      console.error('Ошибка инициализации:', error)
    }
  } else {
    console.log('Пользователь Telegram не авторизован')
    // Загружаем категории и кейсы даже для неавторизованных
    await loadCategories()
    await loadCases()
  }

  // Настройка кнопки "Назад"
  document.getElementById('back-to-cases').addEventListener('click', function() {
    document.getElementById('case-details-tab').classList.add('hidden')
    document.getElementById('home-tab').classList.remove('hidden')
    document.querySelector('.bottom-nav').style.display = 'flex'
  })

  // Настройка сортировки
  setupSortButtons()
}

// Сохранение/обновление пользователя
async function upsertUser(tgUser) {
  const userData = {
    tg_id: tgUser.id,
    username: tgUser.username || `${tgUser.first_name}${tgUser.last_name ? ' ' + tgUser.last_name : ''}`,
    first_name: tgUser.first_name,
    last_name: tgUser.last_name || null,
    avatar_url: tgUser.photo_url || null,
    last_login: new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('users')
    .upsert(userData, { onConflict: 'tg_id' })
    .select()
    .single()

  if (error) throw error
  return data
}

// Загрузка статистики пользователя
async function loadUserStats(userId) {
  try {
    // Получаем баланс
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('balance')
      .eq('tg_id', userId)
      .single()
    
    if (!userError) {
      statBalance.textContent = userData.balance
      userBalance.textContent = userData.balance
    }

    // Получаем количество открытых кейсов
    const { count: casesCount, error: casesError } = await supabase
      .from('opened_cases')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
    
    if (!casesError) {
      statCases.textContent = casesCount
    }

    // Получаем количество выигранных призов
    const { count: prizesCount, error: prizesError } = await supabase
      .from('opened_cases')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .gt('prize_value', 0)
    
    if (!prizesError) {
      statPrizes.textContent = prizesCount
    }
  } catch (error) {
    console.error('Ошибка загрузки статистики:', error)
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
  } else {
    avatarElement.innerHTML = `<i class="fas fa-user-circle"></i>`
    profilePic.innerHTML = `<i class="fas fa-user"></i>`
  }
}

// Загрузка категорий
async function loadCategories() {
  try {
    const { data: categories, error } = await supabase
      .from('case_categories')
      .select('*')
      .order('display_order', { ascending: true })
    
    if (error) throw error
    
    const container = document.querySelector('.categories-container')
    container.innerHTML = ''
    
    // Добавляем "Все" категорию
    const allCategory = document.createElement('div')
    allCategory.className = 'category-card active'
    allCategory.textContent = 'Все'
    allCategory.addEventListener('click', () => {
      document.querySelectorAll('.category-card').forEach(card => card.classList.remove('active'))
      allCategory.classList.add('active')
      loadCases()
    })
    container.appendChild(allCategory)
    
    // Добавляем остальные категории
    categories.forEach(category => {
      const categoryCard = document.createElement('div')
      categoryCard.className = 'category-card'
      categoryCard.textContent = category.name
      categoryCard.addEventListener('click', () => {
        document.querySelectorAll('.category-card').forEach(card => card.classList.remove('active'))
        categoryCard.classList.add('active')
        loadCases(category.id)
      })
      container.appendChild(categoryCard)
    })
  } catch (error) {
    console.error('Ошибка загрузки категорий:', error)
  }
}

// Загрузка кейсов
async function loadCases(categoryId = null, sortBy = 'popular') {
  try {
    let query = supabase
      .from('cases')
      .select('*')
    
    // Фильтрация по категории
    if (categoryId) {
      query = query.eq('category_id', categoryId)
    }
    
    // Сортировка
    switch (sortBy) {
      case 'new':
        query = query.order('created_at', { ascending: false })
        break
      case 'price':
        query = query.order('price', { ascending: true })
        break
      default: // popular
        query = query.order('display_order', { ascending: true })
    }
    
    const { data: cases, error } = await query
    
    if (error) throw error
    
    const container = document.querySelector('.cases-grid')
    container.innerHTML = ''
    
    cases.forEach(caseItem => {
      const caseCard = document.createElement('div')
      caseCard.className = 'case-card'
      if (caseItem.is_premium) caseCard.classList.add('premium')
      
      caseCard.innerHTML = `
        <div class="case-image">
          <img src="${caseItem.image_url || 'https://via.placeholder.com/150'}" alt="${caseItem.name}">
          ${caseItem.is_premium ? '<div class="premium-badge"><i class="fas fa-crown"></i></div>' : ''}
        </div>
        <div class="case-info">
          <div class="case-name">${caseItem.name}</div>
          <div class="case-price">
            ${caseItem.price} <i class="fas fa-coins"></i>
          </div>
        </div>
      `
      
      caseCard.addEventListener('click', () => openCaseDetails(caseItem.id))
      container.appendChild(caseCard)
    })
  } catch (error) {
    console.error('Ошибка загрузки кейсов:', error)
  }
}

// Настройка кнопок сортировки
function setupSortButtons() {
  document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'))
      this.classList.add('active')
      const sortBy = this.dataset.sort
      const activeCategory = document.querySelector('.category-card.active')
      
      if (activeCategory.textContent === 'Все') {
        loadCases(null, sortBy)
      } else {
        // Находим ID категории (кроме "Все")
        const categoryId = Array.from(document.querySelectorAll('.category-card'))
          .find(card => card.textContent === activeCategory.textContent)
          ?.dataset.id
        
        if (categoryId) loadCases(categoryId, sortBy)
      }
    })
  })
}

// Открытие страницы кейса
async function openCaseDetails(caseId) {
  try {
    // Загружаем данные кейса
    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select('*')
      .eq('id', caseId)
      .single()
    
    if (caseError) throw caseError
    
    // Загружаем предметы кейса
    const { data: items, error: itemsError } = await supabase
      .from('case_items')
      .select('*')
      .eq('case_id', caseId)
      .order('probability', { ascending: false })
    
    if (itemsError) throw itemsError
    
    // Заполняем данные
    document.getElementById('case-detail-name').textContent = caseData.name
    document.getElementById('case-detail-description').textContent = caseData.description || 'Откройте и получите случайный приз'
    document.getElementById('case-detail-price').textContent = caseData.price
    document.getElementById('case-open-price').textContent = caseData.price
    document.getElementById('case-detail-image').src = caseData.image_url || 'https://via.placeholder.com/300'
    document.getElementById('case-detail-image').alt = caseData.name
    
    // Заполняем предметы
    const itemsGrid = document.getElementById('case-items-grid')
    itemsGrid.innerHTML = ''
    
    items.forEach(item => {
      const itemCard = document.createElement('div')
      itemCard.className = 'item-card'
      itemCard.innerHTML = `
        <div class="item-image">
          <img src="${item.image_url || 'https://via.placeholder.com/60'}" alt="${item.name}">
        </div>
        <div class="item-name">${item.name}</div>
        <div class="item-value">${item.value} <i class="fas fa-coins"></i></div>
        <div class="item-rarity rarity-${item.rarity}">${item.rarity}</div>
      `
      itemsGrid.appendChild(itemCard)
    })
    
    // Настройка кнопки открытия
    const openBtn = document.getElementById('open-case-btn')
    openBtn.onclick = () => openCase(caseData.id, caseData.price)
    
    // Переключаем вкладку
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'))
    document.getElementById('case-details-tab').classList.remove('hidden')
    document.querySelector('.bottom-nav').style.display = 'none'
  } catch (error) {
    console.error('Ошибка загрузки кейса:', error)
    tg.showAlert('Произошла ошибка при загрузке кейса')
  }
}

// Обновите функцию openCase в script.js
async function openCase(caseId, price) {
  try {
    // Проверяем авторизацию
    if (!tg.initDataUnsafe.user?.id) {
      tg.showAlert('Для открытия кейсов нужно авторизоваться')
      return
    }

    // Проверяем баланс
    const userId = tg.initDataUnsafe.user.id
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('balance')
      .eq('tg_id', userId)
      .single()
    
    if (userError) throw userError
    if (user.balance < price) {
      tg.showAlert('Недостаточно средств на балансе')
      return
    }
    
    // Получаем предметы кейса
    const { data: items, error: itemsError } = await supabase
      .from('case_items')
      .select('*')
      .eq('case_id', caseId)
    
    if (itemsError) throw itemsError
    
    // Показываем рулетку
    showRoulette(items)
    
    // Выбираем случайный предмет (после остановки рулетки)
    const selectedItem = await waitForRouletteStop(items)
    
    // Обновляем баланс
    const newBalance = user.balance - price + selectedItem.value
    const { error: updateError } = await supabase
      .from('users')
      .update({ balance: newBalance })
      .eq('tg_id', userId)
    
    if (updateError) throw updateError
    
    // Записываем транзакции
    await supabase
      .from('transactions')
      .insert([
        {
          user_id: userId,
          amount: -price,
          type: 'case_open',
          description: `Открытие кейса "${caseId}"`
        },
        {
          user_id: userId,
          amount: selectedItem.value,
          type: 'prize',
          description: `Выигрыш: ${selectedItem.name} (${selectedItem.rarity})`
        }
      ])
    
    // Записываем открытие кейса
    await supabase
      .from('opened_cases')
      .insert({
        user_id: userId,
        case_id: caseId,
        prize_value: selectedItem.value,
        prize_description: selectedItem.name,
        prize_rarity: selectedItem.rarity
      })
    
    // Обновляем UI
    userBalance.textContent = newBalance
    statBalance.textContent = newBalance
    
    // Показываем модальное окно с выигрышем
    showPrizeModal(selectedItem)
  } catch (error) {
    console.error('Ошибка открытия кейса:', error)
    tg.showAlert('Произошла ошибка при открытии кейса')
  }
}

// Показ рулетки
function showRoulette(items) {
  const rouletteOverlay = document.getElementById('roulette-overlay')
  const rouletteTrack = document.getElementById('roulette-track')
  const rouletteStopBtn = document.getElementById('roulette-stop-btn')
  
  // Очищаем рулетку
  rouletteTrack.innerHTML = ''
  
  // Добавляем элементы в рулетку (повторяем для бесконечного эффекта)
  for (let i = 0; i < 3; i++) {
    items.forEach(item => {
      const rouletteItem = document.createElement('div')
      rouletteItem.className = 'roulette-item'
      rouletteItem.innerHTML = `
        <img src="${item.image_url || 'https://via.placeholder.com/60'}" alt="${item.name}">
        <div class="roulette-item-name">${item.name}</div>
        <div class="roulette-item-value">${item.value} <i class="fas fa-coins"></i></div>
      `
      rouletteTrack.appendChild(rouletteItem)
    })
  }
  
  // Показываем рулетку
  rouletteOverlay.classList.remove('hidden')
  rouletteTrack.classList.add('roulette-scrolling')
  
  // Показываем кнопку остановки через 2 секунды
  setTimeout(() => {
    rouletteStopBtn.classList.remove('hidden')
  }, 2000)
}

// Ожидание остановки рулетки
function waitForRouletteStop(items) {
  return new Promise((resolve) => {
    const rouletteStopBtn = document.getElementById('roulette-stop-btn')
    const rouletteTrack = document.getElementById('roulette-track')
    const rouletteOverlay = document.getElementById('roulette-overlay')
    
    let stopHandler = () => {
      // Удаляем обработчик, чтобы нельзя было нажать несколько раз
      rouletteStopBtn.removeEventListener('click', stopHandler)
      
      // Останавливаем анимацию
      rouletteTrack.classList.remove('roulette-scrolling')
      
      // Вычисляем выигранный предмет (случайный, но можно и по позиции)
      const totalProbability = items.reduce((sum, item) => sum + item.probability, 0)
      let random = Math.random() * totalProbability
      let selectedItem = null
      
      for (const item of items) {
        if (random < item.probability) {
          selectedItem = item
          break
        }
        random -= item.probability
      }
      
      if (!selectedItem) selectedItem = items[0]
      
      // Через небольшую задержку скрываем рулетку
      setTimeout(() => {
        rouletteOverlay.classList.add('hidden')
        rouletteStopBtn.classList.add('hidden')
        resolve(selectedItem)
      }, 1000)
    }
    
    rouletteStopBtn.addEventListener('click', stopHandler)
  })
}

// Показ модального окна с призом
function showPrizeModal(item) {
  const prizeModal = document.getElementById('prize-modal')
  const prizeImage = document.getElementById('prize-modal-image')
  const prizeName = document.getElementById('prize-modal-name')
  const prizeValue = document.getElementById('prize-modal-value')
  const prizeRarity = document.getElementById('prize-modal-rarity')
  const prizeBtn = document.getElementById('prize-modal-btn')
  
  // Заполняем данные
  prizeImage.src = item.image_url || 'https://via.placeholder.com/150'
  prizeImage.alt = item.name
  prizeName.textContent = item.name
  prizeValue.innerHTML = `${item.value} <i class="fas fa-coins"></i>`
  prizeRarity.textContent = item.rarity
  prizeRarity.className = `prize-rarity rarity-${item.rarity}`
  
  // Показываем модальное окно
  prizeModal.classList.remove('hidden')
  
  // Обработчик закрытия
  const closeModal = () => {
    prizeModal.classList.add('hidden')
    // Возвращаемся к списку кейсов
    document.getElementById('case-details-tab').classList.add('hidden')
    document.getElementById('home-tab').classList.remove('hidden')
    document.querySelector('.bottom-nav').style.display = 'flex'
  }
  
  document.getElementById('prize-modal-close').onclick = closeModal
  prizeBtn.onclick = closeModal
}

document.getElementById('roulette-close').addEventListener('click', function() {
    document.getElementById('roulette-overlay').classList.add('hidden')
    document.getElementById('roulette-track').classList.remove('roulette-scrolling')
    document.getElementById('roulette-stop-btn').classList.add('hidden')
})

// Показ выигрыша
function showPrize(item) {
  const prizeHtml = `
    <div class="prize-card rarity-${item.rarity}">
      <div class="prize-image">
        <img src="${item.image_url || 'https://via.placeholder.com/150'}" alt="${item.name}">
      </div>
      <div class="prize-name">${item.name}</div>
      <div class="prize-value">${item.value} <i class="fas fa-coins"></i></div>
      <div class="prize-rarity">${item.rarity}</div>
    </div>
  `
  
  tg.showPopup({
    title: 'Поздравляем!',
    message: `Вы выиграли: ${item.name}`,
    buttons: [
      { id: 'ok', type: 'default', text: 'Отлично!' }
    ]
  }, function(btnId) {
    // После закрытия попапа возвращаемся к списку кейсов
    document.getElementById('case-details-tab').classList.add('hidden')
    document.getElementById('home-tab').classList.remove('hidden')
    document.querySelector('.bottom-nav').style.display = 'flex'
  })
}

// Переключение вкладок
function setupTabSwitching() {
  const tabLinks = document.querySelectorAll('.nav-item')
  const tabContents = document.querySelectorAll('.tab-content')
  
  tabLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault()
      
      tabLinks.forEach(item => item.classList.remove('active'))
      this.classList.add('active')
      
      tabContents.forEach(content => content.classList.add('hidden'))
      document.getElementById(this.getAttribute('data-tab')).classList.remove('hidden')
      
      // Показываем/скрываем нижнее меню
      if (this.getAttribute('data-tab') === 'case-details-tab') {
        document.querySelector('.bottom-nav').style.display = 'none'
      } else {
        document.querySelector('.bottom-nav').style.display = 'flex'
      }
    })
  })
  
  // Кнопка профиля в хедере
  profileBtn.addEventListener('click', function() {
    tabLinks.forEach(item => item.classList.remove('active'))
    document.querySelector('.nav-item[data-tab="profile-tab"]').classList.add('active')
    
    tabContents.forEach(content => content.classList.add('hidden'))
    document.getElementById('profile-tab').classList.remove('hidden')
  })
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
  initApp()
  setupTabSwitching()
  
  // Кнопка пополнения баланса
  document.querySelector('.action-btn.purple').addEventListener('click', function() {
    tg.showPopup({
      title: 'Пополнение баланса',
      message: 'Выберите сумму для пополнения:',
      buttons: [
        { id: '100', type: 'default', text: '100 монет' },
        { id: '500', type: 'default', text: '500 монет' },
        { id: '1000', type: 'default', text: '1000 монет' },
        { id: 'cancel', type: 'cancel' }
      ]
    }, function(btnId) {
      if (btnId !== 'cancel') {
        const amount = parseInt(btnId)
        depositBalance(amount)
      }
    })
  })
})

// Функция пополнения баланса
async function depositBalance(amount) {
  try {
    const userId = tg.initDataUnsafe.user?.id
    if (!userId) {
      tg.showAlert('Для пополнения баланса нужно авторизоваться')
      return
    }

    // Получаем текущий баланс
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('balance')
      .eq('tg_id', userId)
      .single()
    
    if (userError) throw userError
    
    // Обновляем баланс
    const { error: updateError } = await supabase
      .from('users')
      .update({ balance: user.balance + amount })
      .eq('tg_id', userId)
    
    if (updateError) throw updateError
    
    // Записываем транзакцию
    await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        amount: amount,
        type: 'deposit',
        description: `Пополнение баланса на ${amount} монет`
      })
    
    // Обновляем UI
    userBalance.textContent = user.balance + amount
    statBalance.textContent = user.balance + amount
    
    tg.showAlert(`Баланс успешно пополнен на ${amount} монет`)
  } catch (error) {
    console.error('Ошибка пополнения баланса:', error)
    tg.showAlert('Произошла ошибка при пополнении баланса')
  }
}