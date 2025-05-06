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
  // Инициализация Telegram пользователя
  if (tg.initDataUnsafe.user) {
    const userData = tg.initDataUnsafe.user
    try {
      // Сохраняем/обновляем пользователя
      const user = await upsertUser(userData)
      
      // Обновляем UI
      updateUI(user)
      
      // Загружаем статистику
      await loadUserStats(user.tg_id)
    } catch (error) {
      console.error('Ошибка инициализации:', error)
    }
  } else {
    console.log('Пользователь Telegram не авторизован')
  }

  // Инициализация кейсов
  await loadCases()
  initCategoryFilters()
  
  // Настройка обработчиков событий
  setupEventListeners()
  setupCaseOpenHandlers()
  
  // Переключение вкладок
  setupTabSwitchers()
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

// Загрузка кейсов из Supabase
async function loadCases(categorySlug = null) {
  try {
    let query = supabase
      .from('cases')
      .select(`
        id,
        name,
        description,
        price,
        image_url,
        animation_url,
        is_premium,
        items_count,
        category:case_categories(name, slug)
      `)
      .eq('is_active', true)
      .order('position', { ascending: true })

    if (categorySlug && categorySlug !== 'all') {
      query = query.eq('case_categories.slug', categorySlug)
    }

    const { data: cases, error } = await query

    if (error) throw error

    renderCases(cases)
  } catch (error) {
    console.error('Ошибка загрузки кейсов:', error)
  }
}

// Отображение кейсов
function renderCases(cases) {
  const casesGrid = document.querySelector('.cases-grid')
  casesGrid.innerHTML = ''

  cases.forEach(caseItem => {
    const caseElement = document.createElement('div')
    caseElement.className = `case-item ${caseItem.is_premium ? 'premium' : ''}`
    caseElement.innerHTML = `
      <div class="case-image-container">
        <img src="${caseItem.image_url || 'https://via.placeholder.com/300x300/25253a/ffffff?text=Case'}" class="case-image">
        <div class="case-items-preview" id="preview-${caseItem.id}"></div>
      </div>
      <div class="case-info">
        <div class="case-name">${caseItem.name}</div>
        <div class="case-price">
          <span class="price-amount">${caseItem.price} <i class="fas fa-coins"></i></span>
          <button class="open-case-btn" data-case-id="${caseItem.id}">Открыть</button>
        </div>
      </div>
    `
    casesGrid.appendChild(caseElement)

    // Загружаем предметы для этого кейса
    loadCaseItems(caseItem.id)
  })
}

// Загрузка предметов для кейса
async function loadCaseItems(caseId) {
  try {
    const { data: items, error } = await supabase
      .from('case_items')
      .select('*')
      .eq('case_id', caseId)
      .eq('is_active', true)
      .order('weight', { ascending: false })
      .limit(9)

    if (error) throw error

    renderCaseItems(caseId, items)
  } catch (error) {
    console.error(`Ошибка загрузки предметов для кейса ${caseId}:`, error)
  }
}

// Отображение предметов в превью кейса
function renderCaseItems(caseId, items) {
  const previewContainer = document.getElementById(`preview-${caseId}`)
  if (!previewContainer) return

  previewContainer.innerHTML = ''

  items.forEach(item => {
    const itemElement = document.createElement('div')
    itemElement.className = 'preview-item'
    itemElement.innerHTML = `
      <img src="${item.image_url}" class="item-${item.rarity}" alt="${item.name}">
    `
    previewContainer.appendChild(itemElement)
  })
}

// Инициализация фильтров категорий
function initCategoryFilters() {
  const categoryItems = document.querySelectorAll('.category-item')
  
  categoryItems.forEach(item => {
    item.addEventListener('click', function() {
      categoryItems.forEach(i => i.classList.remove('active'))
      this.classList.add('active')
      
      const category = this.textContent === 'Все кейсы' ? 'all' : this.textContent.toLowerCase()
      loadCases(category)
    })
  })
}

// Обработчик открытия кейса
function setupCaseOpenHandlers() {
  document.addEventListener('click', async function(e) {
    if (e.target.classList.contains('open-case-btn')) {
      const caseId = e.target.getAttribute('data-case-id')
      await openCase(caseId)
    }
  })
}

// Функция открытия кейса
async function openCase(caseId) {
  if (!tg.initDataUnsafe.user?.id) {
    tg.showAlert('Необходимо авторизоваться через Telegram')
    return
  }

  try {
    // 1. Получаем данные о кейсе
    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select('price')
      .eq('id', caseId)
      .single()

    if (caseError || !caseData) throw caseError || new Error('Кейс не найден')

    // 2. Проверяем баланс пользователя
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('balance')
      .eq('tg_id', tg.initDataUnsafe.user.id)
      .single()

    if (userError || !userData) throw userError || new Error('Пользователь не найден')

    if (userData.balance < caseData.price) {
      tg.showAlert(`Недостаточно средств. Нужно ${caseData.price} монет.`)
      return
    }

    // 3. Выбираем случайный предмет из кейса (с учетом весов)
    const { data: items, error: itemsError } = await supabase
      .from('case_items')
      .select('*')
      .eq('case_id', caseId)
      .eq('is_active', true)

    if (itemsError || !items?.length) throw itemsError || new Error('В кейсе нет предметов')

    const totalWeight = items.reduce((sum, item) => sum + (item.weight || 1), 0)
    let random = Math.random() * totalWeight
    let selectedItem = null

    for (const item of items) {
      random -= item.weight || 1
      if (random <= 0) {
        selectedItem = item
        break
      }
    }

    // 4. Обновляем баланс пользователя
    const newBalance = userData.balance - caseData.price
    const { error: updateError } = await supabase
      .from('users')
      .update({ balance: newBalance })
      .eq('tg_id', tg.initDataUnsafe.user.id)

    if (updateError) throw updateError

    // 5. Записываем транзакцию
    const { error: transactionError } = await supabase
      .from('transactions')
      .insert({
        user_id: tg.initDataUnsafe.user.id,
        amount: -caseData.price,
        type: 'case_open',
        description: `Открытие кейса ${caseId}`
      })

    if (transactionError) throw transactionError

    // 6. Сохраняем результат открытия
    const { error: openedCaseError } = await supabase
      .from('opened_cases')
      .insert({
        user_id: tg.initDataUnsafe.user.id,
        case_id: caseId,
        item_id: selectedItem.id,
        item_name: selectedItem.name,
        item_type: selectedItem.type,
        item_value: selectedItem.value,
        item_image_url: selectedItem.image_url
      })

    if (openedCaseError) throw openedCaseError

    // 7. Если предмет имеет ценность (монеты), добавляем их на баланс
    if (selectedItem.type === 'coin' && selectedItem.value > 0) {
      const finalBalance = newBalance + selectedItem.value
      await supabase
        .from('users')
        .update({ balance: finalBalance })
        .eq('tg_id', tg.initDataUnsafe.user.id)

      await supabase
        .from('transactions')
        .insert({
          user_id: tg.initDataUnsafe.user.id,
          amount: selectedItem.value,
          type: 'prize',
          description: `Выигрыш из кейса: ${selectedItem.name}`
        })
    }

    // 8. Показываем результат
    showCaseResult(selectedItem, caseData.price)

    // 9. Обновляем UI
    userBalance.textContent = selectedItem.type === 'coin' ? newBalance + selectedItem.value : newBalance
    statBalance.textContent = selectedItem.type === 'coin' ? newBalance + selectedItem.value : newBalance
    
    // 10. Обновляем статистику
    await loadUserStats(tg.initDataUnsafe.user.id)
  } catch (error) {
    console.error('Ошибка открытия кейса:', error)
    tg.showAlert('Произошла ошибка при открытии кейса')
  }
}

// Показ результата открытия кейса
function showCaseResult(item, casePrice) {
  let message = `Вы открыли кейс за ${casePrice} монет и получили:\n`
  message += `🎁 ${item.name}\n`
  
  if (item.type === 'coin') {
    message += `💰 +${item.value} монет`
  } else if (item.type === 'nft') {
    message += `🖼️ NFT коллекция`
  } else if (item.type === 'subscription') {
    message += `🌟 Премиум подписка`
  }
  
  tg.showPopup({
    title: 'Поздравляем!',
    message: message,
    buttons: [{
      id: 'ok',
      type: 'default',
      text: 'Отлично!'
    }]
  })
}

// Обработчики кнопок
function setupEventListeners() {
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
}

// Функция пополнения баланса
async function depositBalance(amount) {
  try {
    // Получаем текущий баланс
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('balance')
      .eq('tg_id', tg.initDataUnsafe.user.id)
      .single()
    
    if (userError) throw userError
    
    // Обновляем баланс
    const { error: updateError } = await supabase
      .from('users')
      .update({ balance: user.balance + amount })
      .eq('tg_id', tg.initDataUnsafe.user.id)
    
    if (updateError) throw updateError
    
    // Записываем транзакцию
    await supabase
      .from('transactions')
      .insert({
        user_id: tg.initDataUnsafe.user.id,
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

// Переключение вкладок
function setupTabSwitchers() {
  const tabLinks = document.querySelectorAll('.nav-item')
  const tabContents = document.querySelectorAll('.tab-content')
  
  tabLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault()
      
      tabLinks.forEach(item => item.classList.remove('active'))
      this.classList.add('active')
      
      tabContents.forEach(content => content.classList.add('hidden'))
      document.getElementById(this.getAttribute('data-tab')).classList.remove('hidden')
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
document.addEventListener('DOMContentLoaded', initApp)