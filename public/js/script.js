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
const caseModal = document.getElementById('case-modal')
const modalBody = document.getElementById('modal-body')
const closeModal = document.querySelector('.close-modal')

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
      
      // Загружаем кейсы
      await loadCases()

    } catch (error) {
      console.error('Ошибка инициализации:', error)
    }
  } else {
    console.log('Пользователь Telegram не авторизован')
    // Загружаем кейсы в демо-режиме
    await loadCases()
  }
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

// Загрузка кейсов
async function loadCases() {
  try {
    const { data: cases, error } = await supabase
      .from('cases')
      .select('*')
      .order('price', { ascending: true })
    
    if (error) throw error
    
    renderCases(cases)
  } catch (error) {
    console.error('Ошибка загрузки кейсов:', error)
  }
}

// Отображение кейсов
function renderCases(cases) {
  casesContainer.innerHTML = ''
  
  // Группируем кейсы по категориям
  const categories = {
    free: cases.filter(c => c.type === 'free'),
    nft: cases.filter(c => c.type === 'nft'),
    farm: cases.filter(c => c.type === 'farm'),
    other: cases.filter(c => !['free', 'nft', 'farm'].includes(c.type))
  }
  
  // Рендерим каждую категорию
  for (const [category, items] of Object.entries(categories)) {
    if (items.length === 0) continue
    
    // Добавляем заголовок категории
    const categoryTitle = document.createElement('h2')
    categoryTitle.className = 'category-title'
    categoryTitle.textContent = getCategoryName(category)
    casesContainer.appendChild(categoryTitle)
    
    // Создаем контейнер для кейсов категории
    const categoryContainer = document.createElement('div')
    categoryContainer.className = 'category-cases'
    
    // Добавляем кейсы
    items.forEach(caseItem => {
      const caseElement = createCaseElement(caseItem)
      categoryContainer.appendChild(caseElement)
    })
    
    casesContainer.appendChild(categoryContainer)
  }
}

// Создание элемента кейса
function createCaseElement(caseData) {
  const caseElement = document.createElement('div')
  caseElement.className = `case-item ${caseData.type}`
  caseElement.dataset.caseId = caseData.id
  
  caseElement.innerHTML = `
    <div class="case-preview">
      <img src="${caseData.image_url || 'https://via.placeholder.com/150'}" alt="${caseData.name}">
    </div>
    <div class="case-info">
      <h3 class="case-name">${caseData.name}</h3>
      <div class="case-price">
        <i class="fas fa-coins"></i> ${caseData.price}
      </div>
    </div>
  `
  
  return caseElement
}

// Получение названия категории
function getCategoryName(category) {
  const names = {
    free: 'Бесплатные кейсы',
    nft: 'NFT кейсы',
    farm: 'Фарм кейсы',
    other: 'Другие кейсы'
  }
  return names[category] || category
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

// Обработчики кнопок
function setupEventListeners() {
  // Переключение вкладок
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

  // Обработчики кликов по карточкам кейсов
  casesContainer.addEventListener('click', function(e) {
    const caseItem = e.target.closest('.case-item')
    if (caseItem) {
      const caseId = caseItem.dataset.caseId
      if (caseId) {
        window.location.href = `case.html?id=${caseId}`
      }
    }
  })
  
  // Кнопка пополнения баланса
  document.querySelector('.action-btn.purple')?.addEventListener('click', function() {
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
  
  // Закрытие модального окна
  closeModal.addEventListener('click', () => {
    caseModal.style.display = 'none'
  })
  
  // Закрытие при клике вне модального окна
  window.addEventListener('click', (e) => {
    if (e.target === caseModal) {
      caseModal.style.display = 'none'
    }
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

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
  initApp()
  setupEventListeners()
})