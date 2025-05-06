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

// Функция открытия страницы кейса
async function showCasePage(caseId) {
    try {
        // Получаем информацию о кейсе
        const { data: caseData, error: caseError } = await supabase
            .from('cases')
            .select('*')
            .eq('id', caseId)
            .single()
        
        if (caseError) throw caseError
        
        // Получаем предметы из кейса
        const { data: items, error: itemsError } = await supabase
            .from('nft_items')
            .select('*')
            .eq('case_id', caseId)
            .order('probability', { ascending: true })
        
        if (itemsError) throw itemsError
        
        // Заполняем данные на странице кейса
        document.getElementById('case-page-image').src = caseData.image_url
        document.getElementById('case-page-title').textContent = caseData.name
        document.getElementById('case-page-description').textContent = caseData.description
        document.getElementById('case-page-price').textContent = caseData.price
        document.getElementById('single-price').textContent = caseData.price
        document.getElementById('triple-price').textContent = caseData.price * 3
        
        // Обновляем баланс на странице кейса
        if (tg.initDataUnsafe?.user?.id) {
            const { data: userData } = await supabase
                .from('users')
                .select('balance')
                .eq('tg_id', tg.initDataUnsafe.user.id)
                .single()
            
            if (userData) {
                document.getElementById('case-page-balance').textContent = userData.balance
            }
        }
        
        // Рендерим предметы кейса
        const itemsContainer = document.getElementById('case-items-container')
        itemsContainer.innerHTML = ''
        
        items.forEach(item => {
            const itemElement = document.createElement('div')
            itemElement.className = 'item-card'
            itemElement.innerHTML = `
                <img src="${item.animation_url || item.image_url}" alt="${item.name}" class="item-image">
                <div class="item-name">${item.name}</div>
                <div class="item-rarity ${item.rarity}">${getRarityName(item.rarity)}</div>
                <div class="item-value"><i class="fas fa-coins"></i> ${item.value}</div>
            `
            itemsContainer.appendChild(itemElement)
        })
        
        // Показываем страницу кейса
        document.getElementById('main-container').classList.add('hidden')
        document.getElementById('case-page-container').classList.remove('hidden')
        
        // Обработчики для кнопок открытия
        document.getElementById('open-single-btn').onclick = () => openCase(caseId, 1)
        document.getElementById('open-triple-btn').onclick = () => openCase(caseId, 3)
        
    } catch (error) {
        console.error('Ошибка загрузки страницы кейса:', error)
        showNotification('Не удалось загрузить информацию о кейсе')
    }
}

// Функция открытия кейса
async function openCase(caseId, count = 1) {
    if (!tg.initDataUnsafe?.user?.id) {
        showNotification('Для открытия кейсов необходимо авторизоваться')
        return
    }

    try {
        const userId = tg.initDataUnsafe.user.id
        
        // 1. Проверяем баланс пользователя
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
        
        const totalPrice = caseData.price * count
        
        if (user.balance < totalPrice) {
            showNotification(`Недостаточно средств. Нужно ${totalPrice} монет.`)
            return
        }
        
        // 3. Получаем предметы из кейса
        const { data: items, error: itemsError } = await supabase
            .from('nft_items')
            .select('*')
            .eq('case_id', caseId)
        
        if (itemsError) throw itemsError
        
        if (!items.length) {
            throw new Error('В этом кейсе нет предметов')
        }
        
        // 4. Показываем рулетку
        showRoulette(items)
        
        // 5. Выбираем предметы с учетом вероятностей
        const wonItems = []
        for (let i = 0; i < count; i++) {
            const prize = selectPrizeByProbability(items)
            wonItems.push(prize)
        }
        
        // 6. Обновляем баланс пользователя
        const { error: balanceError } = await supabase
            .from('users')
            .update({ balance: user.balance - totalPrice })
            .eq('tg_id', userId)
        
        if (balanceError) throw balanceError
        
        // 7. Добавляем предметы в инвентарь пользователя
        for (const prize of wonItems) {
            const { error: inventoryError } = await supabase
                .from('user_inventory')
                .insert({
                    user_id: userId,
                    nft_item_id: prize.id,
                    acquired_at: new Date().toISOString()
                })
            
            if (inventoryError) throw inventoryError
        }
        
        // 8. Записываем транзакцию
        await supabase
            .from('transactions')
            .insert({
                user_id: userId,
                amount: -totalPrice,
                type: 'case_open',
                description: `Открытие ${count} кейса "${caseData.name}"`
            })
        
        // 9. Записываем историю открытий
        for (const prize of wonItems) {
            await supabase
                .from('opened_cases')
                .insert({
                    user_id: userId,
                    case_id: caseId,
                    item_id: prize.id,
                    case_type: caseData.name,
                    price_value: caseData.price,
                    price_description: `${caseData.price} монет`,
                    opened_at: new Date().toISOString()
                })
        }
        
        // 10. Запускаем анимацию рулетки
        animateRoulette(items, wonItems)
        
        // 11. Показываем выигранные предметы после анимации
        setTimeout(() => {
            showWonItems(wonItems)
            
            // Обновляем баланс в интерфейсе
            const newBalance = user.balance - totalPrice
            userBalance.textContent = newBalance
            document.getElementById('case-page-balance').textContent = newBalance
            statBalance.textContent = newBalance
            
            // Обновляем статистику
            loadUserStats(userId)
        }, 5000)
        
    } catch (error) {
        console.error('Ошибка открытия кейса:', error)
        showNotification('Произошла ошибка при открытии кейса')
        hideRoulette()
    }
}

// Показать рулетку
function showRoulette(items) {
    const openingSection = document.getElementById('opening-section')
    const rouletteTrack = document.getElementById('roulette-track')
    
    // Очищаем предыдущие элементы
    rouletteTrack.innerHTML = ''
    
    // Создаем много копий предметов для плавной анимации
    const itemsToShow = []
    for (let i = 0; i < 20; i++) {
        itemsToShow.push(...items)
    }
    
    // Добавляем элементы в рулетку
    itemsToShow.forEach(item => {
        const itemElement = document.createElement('div')
        itemElement.className = 'roulette-item'
        itemElement.innerHTML = `
            <img src="${item.animation_url || item.image_url}" alt="${item.name}">
            <div class="item-rarity ${item.rarity}">${getRarityName(item.rarity)}</div>
        `
        rouletteTrack.appendChild(itemElement)
    })
    
    // Показываем секцию с рулеткой
    openingSection.classList.remove('hidden')
    document.getElementById('opening-result').classList.add('hidden')
}

// Анимация рулетки
function animateRoulette(items, wonItems) {
    const rouletteTrack = document.getElementById('roulette-track')
    const itemWidth = 140 // Ширина одного элемента рулетки
    const totalItems = rouletteTrack.children.length
    const totalWidth = totalItems * itemWidth
    
    // Начальное положение - в середине
    let currentPosition = -totalWidth / 2
    rouletteTrack.style.transform = `translateX(${currentPosition}px)`
    
    // Скорость анимации
    let speed = 50
    let deceleration = 0.02
    let targetPosition = 0
    
    // Вычисляем позицию, где должен остановиться первый выигранный предмет
    const wonItemIndex = items.findIndex(item => item.id === wonItems[0].id)
    if (wonItemIndex !== -1) {
        // Позиция так, чтобы выигранный предмет оказался по центру
        targetPosition = -wonItemIndex * itemWidth - (20 * items.length * itemWidth) + (window.innerWidth / 2 - itemWidth / 2)
    }
    
    const animate = () => {
        // Замедляем
        if (speed > 1) {
            speed -= deceleration
            deceleration *= 1.02 // Увеличиваем замедление со временем
        } else {
            // Точная остановка на выигранном предмете
            const distance = targetPosition - currentPosition
            currentPosition += distance * 0.1
            
            if (Math.abs(distance) < 1) {
                currentPosition = targetPosition
                rouletteTrack.style.transform = `translateX(${currentPosition}px)`
                
                // Помечаем выигранные предметы
                wonItems.forEach((wonItem, index) => {
                    const wonIndex = (wonItemIndex + index * 3) % items.length
                    const elements = rouletteTrack.querySelectorAll('.roulette-item')
                    elements[wonIndex].classList.add('winner')
                })
                
                return
            }
        }
        
        currentPosition -= speed
        rouletteTrack.style.transform = `translateX(${currentPosition}px)`
        
        // Бесконечная прокрутка
        if (-currentPosition > totalWidth / 2) {
            currentPosition += totalWidth / 2
        }
        
        requestAnimationFrame(animate)
    }
    
    animate()
}

// Показать выигранные предметы
function showWonItems(wonItems) {
    const wonItemsContainer = document.getElementById('won-items')
    wonItemsContainer.innerHTML = ''
    
    wonItems.forEach(item => {
        const itemElement = document.createElement('div')
        itemElement.className = 'won-item'
        itemElement.innerHTML = `
            <img src="${item.animation_url || item.image_url}" alt="${item.name}">
            <div class="won-item-name">${item.name}</div>
            <div class="won-item-rarity ${item.rarity}">${getRarityName(item.rarity)}</div>
            <div class="won-item-value"><i class="fas fa-coins"></i> ${item.value}</div>
        `
        wonItemsContainer.appendChild(itemElement)
    })
    
    document.getElementById('opening-result').classList.remove('hidden')
}

// Скрыть рулетку
function hideRoulette() {
    document.getElementById('opening-section').classList.add('hidden')
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
  // Обработчики кнопок открытия страниц кейсов
  document.addEventListener('click', function(e) {
    if (e.target.closest('.case-item')) {
      const caseId = e.target.closest('.case-item').dataset.caseId
      showCasePage(caseId)
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
  
  // Обработчик кнопки "Назад"
  document.getElementById('back-to-main')?.addEventListener('click', () => {
    document.getElementById('main-container').classList.remove('hidden')
    document.getElementById('case-page-container').classList.add('hidden')
    hideRoulette()
  })
  
  // Обработчик кнопки "Забрать призы"
  document.getElementById('close-opening-btn')?.addEventListener('click', hideRoulette)
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