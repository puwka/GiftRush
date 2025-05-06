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
const casesContainer = document.getElementById('cases-container')

// Основная функция инициализации
async function initApp() {
  initTelegramWebApp()
  
  if (tg.initDataUnsafe.user) {
    const userData = tg.initDataUnsafe.user
    try {
      // Сохраняем/обновляем пользователя
      const user = await upsertUser(userData)
      
      // Обновляем UI
      updateUI(user)
      
      // Загружаем статистику
      await loadUserStats(user.tg_id)
      
      // Загружаем кейсы
      await loadCases()
    } catch (error) {
      console.error('Ошибка инициализации:', error)
      showNotification('Произошла ошибка при загрузке данных')
    }
  } else {
    console.log('Пользователь Telegram не авторизован')
    // Загружаем кейсы даже для неавторизованных (но открывать нельзя)
    await loadCases()
  }
  
  setupEventListeners()
}

// Сохранение/обновление пользователя
async function upsertUser(tgUser) {
  const userData = {
    tg_id: tgUser.id,
    username: tgUser.username || `${tgUser.first_name}${tgUser.last_name ? ' ' + tgUser.last_name : ''}`,
    first_name: tgUser.first_name,
    last_name: tgUser.last_name || null,
    avatar_url: tgUser.photo_url || null,
    last_login: new Date().toISOString(),
    balance: 1000 // Начальный баланс
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
      statCases.textContent = casesCount || '0'
    }

    // Получаем количество выигранных призов
    const { count: prizesCount, error: prizesError } = await supabase
      .from('user_inventory')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
    
    if (!prizesError) {
      statPrizes.textContent = prizesCount || '0'
    }
  } catch (error) {
    console.error('Ошибка загрузки статистики:', error)
  }
}

// Функция загрузки кейсов
async function loadCases(category = 'all') {
  try {
    let query = supabase
      .from('cases')
      .select(`
        id,
        name,
        description,
        price,
        image_url,
        preview_url,
        is_premium,
        nft_items: nft_items(
          id,
          name,
          image_url,
          animation_url,
          rarity,
          value,
          probability
        )
      `)
      .order('position', { ascending: true })

    if (category === 'premium') {
      query = query.eq('is_premium', true)
    } else if (category === 'popular') {
      query = query.order('price', { ascending: false }).limit(5)
    }

    const { data: cases, error } = await query

    if (error) throw error

    renderCases(cases)
  } catch (error) {
    console.error('Ошибка загрузки кейсов:', error)
    showNotification('Не удалось загрузить кейсы')
  }
}

// Рендер кейсов
function renderCases(cases) {
  casesContainer.innerHTML = ''

  if (!cases || cases.length === 0) {
    casesContainer.innerHTML = '<p class="no-cases">Кейсы не найдены</p>'
    return
  }

  cases.forEach(caseItem => {
    const caseElement = document.createElement('div')
    caseElement.className = `case-item ${caseItem.is_premium ? 'premium' : ''}`
    caseElement.dataset.caseId = caseItem.id
    
    // Случайные NFT из кейса для превью (3-5 штук)
    const previewItems = getRandomItems(caseItem.nft_items, 3 + Math.floor(Math.random() * 3))
    
    caseElement.innerHTML = `
      <div class="case-preview">
        <img src="${caseItem.image_url}" alt="${caseItem.name}">
        <div class="nft-items">
          ${previewItems.map(item => `
            <div class="nft-item" data-rarity="${item.rarity}">
              <img src="${item.animation_url || item.image_url}" alt="${item.name}" loading="lazy">
            </div>
          `).join('')}
        </div>
      </div>
      <div class="case-info">
        <h3 class="case-name">${caseItem.name}</h3>
        <div class="case-price">
          <i class="fas fa-coins"></i> ${caseItem.price}
        </div>
        <button class="open-case-btn">
          Открыть за ${caseItem.price} <i class="fas fa-coins"></i>
        </button>
      </div>
    `
    
    casesContainer.appendChild(caseElement)
  })
}

// Функция открытия кейса
async function openCase(caseId) {
  if (!tg.initDataUnsafe?.user?.id) {
    showNotification('Для открытия кейсов необходимо авторизоваться')
    return
  }

  try {
    // 1. Проверяем баланс пользователя
    const userId = tg.initDataUnsafe.user.id
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('balance')
      .eq('tg_id', userId)
      .single()
    
    if (userError) throw userError
    
    // 2. Получаем информацию о кейсе
    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select('price, name, image_url')
      .eq('id', caseId)
      .single()
    
    if (caseError) throw caseError
    
    if (user.balance < caseData.price) {
      showNotification(`Недостаточно средств. Нужно ${caseData.price} монет.`)
      return
    }
    
    // 3. Показываем анимацию открытия
    showCaseOpeningAnimation(caseData)
    
    // 4. Получаем предметы из кейса
    const { data: items, error: itemsError } = await supabase
      .from('nft_items')
      .select('*')
      .eq('case_id', caseId)
    
    if (itemsError) throw itemsError
    
    if (!items.length) {
      throw new Error('В этом кейсе нет предметов')
    }
    
    // Выбираем предмет с учетом вероятностей
    const prize = selectPrizeByProbability(items)
    
    // 5. Обновляем баланс пользователя
    const { error: balanceError } = await supabase
      .from('users')
      .update({ balance: user.balance - caseData.price })
      .eq('tg_id', userId)
    
    if (balanceError) throw balanceError
    
    // 6. Добавляем предмет в инвентарь пользователя
    const { error: inventoryError } = await supabase
      .from('user_inventory')
      .insert({
        user_id: userId,
        nft_item_id: prize.id,
        acquired_at: new Date().toISOString()
      })
    
    if (inventoryError) throw inventoryError
    
    // 7. Записываем транзакцию
    await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        amount: -caseData.price,
        type: 'case_open',
        description: `Открытие кейса "${caseData.name}"`
      })
    
    // 8. Показываем выигранный предмет
    setTimeout(() => {
      showPrize(prize)
      
      // Обновляем баланс в интерфейсе
      const newBalance = user.balance - caseData.price
      userBalance.textContent = newBalance
      statBalance.textContent = newBalance
      
      // Обновляем статистику
      loadUserStats(userId)
    }, 1500)
    
  } catch (error) {
    console.error('Ошибка открытия кейса:', error)
    showNotification('Произошла ошибка при открытии кейса')
    hideCaseOpening()
  }
}

// Анимация открытия кейса
function showCaseOpeningAnimation(caseData) {
  const openingDiv = document.createElement('div')
  openingDiv.className = 'case-opening'
  openingDiv.innerHTML = `
    <img src="${caseData.image_url}" class="opening-case-image" alt="${caseData.name}">
    <div class="prize-item hidden">
      <img src="" class="prize-image" alt="Приз">
      <h3 class="prize-name"></h3>
      <span class="prize-rarity"></span>
      <div class="prize-value"></div>
      <button class="close-opening">Закрыть</button>
    </div>
  `
  
  document.body.appendChild(openingDiv)
  setTimeout(() => openingDiv.classList.add('active'), 50)
  
  // Обработчик закрытия
  openingDiv.querySelector('.close-opening')?.addEventListener('click', hideCaseOpening)
}

function showPrize(prize) {
  const openingDiv = document.querySelector('.case-opening')
  if (!openingDiv) return
  
  const prizeItem = openingDiv.querySelector('.prize-item')
  const prizeImage = openingDiv.querySelector('.prize-image')
  const prizeName = openingDiv.querySelector('.prize-name')
  const prizeRarity = openingDiv.querySelector('.prize-rarity')
  const prizeValue = openingDiv.querySelector('.prize-value')
  
  prizeImage.src = prize.animation_url || prize.image_url
  prizeImage.alt = prize.name
  prizeName.textContent = prize.name
  prizeRarity.textContent = getRarityName(prize.rarity)
  prizeRarity.className = `prize-rarity ${prize.rarity}`
  prizeValue.innerHTML = `<i class="fas fa-coins"></i> ${prize.value}`
  
  prizeItem.classList.remove('hidden')
}

function hideCaseOpening() {
  const openingDiv = document.querySelector('.case-opening')
  if (openingDiv) {
    openingDiv.classList.remove('active')
    setTimeout(() => openingDiv.remove(), 300)
  }
}

// Вспомогательные функции
function getRandomItems(items, count) {
  if (!items || items.length === 0) return []
  const shuffled = [...items].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, Math.min(count, items.length))
}

function selectPrizeByProbability(items) {
  if (!items || items.length === 0) return null
  
  const random = Math.random()
  let cumulativeProbability = 0
  
  // Сортируем по возрастанию вероятности (редкие предметы имеют меньшую вероятность)
  const sortedItems = [...items].sort((a, b) => a.probability - b.probability)
  
  for (const item of sortedItems) {
    cumulativeProbability += item.probability
    if (random <= cumulativeProbability) {
      return item
    }
  }
  
  // Если что-то пошло не так, возвращаем первый предмет
  return items[0]
}

function getRarityName(rarity) {
  const names = {
    common: 'Обычный',
    rare: 'Редкий',
    epic: 'Эпический',
    legendary: 'Легендарный'
  }
  return names[rarity] || rarity
}

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

function showNotification(message) {
  if (window.Telegram && Telegram.WebApp) {
    Telegram.WebApp.showAlert(message)
  } else {
    alert(message)
  }
}

function initTelegramWebApp() {
  if (window.Telegram && Telegram.WebApp) {
    Telegram.WebApp.expand()
    Telegram.WebApp.enableClosingConfirmation()
    
    // Настройка кнопки меню
    if (Telegram.WebApp.MainButton) {
      Telegram.WebApp.MainButton.setText('Мой инвентарь')
      Telegram.WebApp.MainButton.onClick(() => {
        document.querySelector('.nav-item[data-tab="profile-tab"]').click()
      })
      Telegram.WebApp.MainButton.show()
    }
  }
}

function setupEventListeners() {
  // Обработчики кнопок открытия кейсов
  document.addEventListener('click', function(e) {
    if (e.target.closest('.open-case-btn')) {
      const caseId = e.target.closest('.case-item').dataset.caseId
      openCase(caseId)
    }
  })
  
  // Обработчики переключения категорий
  document.querySelectorAll('.category-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'))
      this.classList.add('active')
      loadCases(this.dataset.category)
    })
  })
  
  // Кнопка пополнения баланса
  const depositBtn = document.querySelector('.action-btn.purple')
  if (depositBtn) {
    depositBtn.addEventListener('click', function() {
      if (!tg.initDataUnsafe?.user?.id) {
        showNotification('Для пополнения баланса необходимо авторизоваться')
        return
      }
      
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
  
  // Кнопка профиля в хедере
  profileBtn.addEventListener('click', function() {
    const profileTab = document.querySelector('.nav-item[data-tab="profile-tab"]')
    if (profileTab) {
      document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'))
      profileTab.classList.add('active')
      
      document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'))
      document.getElementById('profile-tab').classList.remove('hidden')
    }
  })
}

// Функция пополнения баланса
async function depositBalance(amount) {
  try {
    const userId = tg.initDataUnsafe.user.id
    
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
    const newBalance = user.balance + amount
    userBalance.textContent = newBalance
    statBalance.textContent = newBalance
    
    showNotification(`Баланс успешно пополнен на ${amount} монет`)
  } catch (error) {
    console.error('Ошибка пополнения баланса:', error)
    showNotification('Произошла ошибка при пополнении баланса')
  }
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', initApp)