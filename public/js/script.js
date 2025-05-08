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
  if (tg.initDataUnsafe.user) {
    const userData = tg.initDataUnsafe.user
    try {
      // Сохраняем/обновляем пользователя
      const user = await upsertUser(userData)
      
      // Обновляем UI
      updateUI(user)
      
      // Загружаем статистику и инвентарь
      await loadUserStats(user.tg_id)
      await loadUserInventory(user.tg_id)

    } catch (error) {
      console.error('Ошибка инициализации:', error)
    }
  } else {
    console.log('Пользователь Telegram не авторизован')
    // В демо-режиме добавляем обработчик для кнопки пополнения
    document.getElementById('deposit-btn')?.addEventListener('click', () => {
      document.getElementById('deposit-modal').classList.add('active')
    })
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

// Загрузка инвентаря пользователя
async function loadUserInventory(userId) {
  try {
    const { data: inventory, error } = await supabase
      .from('user_inventory')
      .select('*, case_items(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error

    renderInventory(inventory)
  } catch (error) {
    console.error('Ошибка загрузки инвентаря:', error)
  }
}

// Отображение инвентаря
function renderInventory(items) {
  const inventoryContainer = document.getElementById('inventory-items')
  if (!inventoryContainer) return

  if (items.length === 0) {
    inventoryContainer.innerHTML = '<div class="empty-inventory">Ваш инвентарь пуст</div>'
    return
  }

  let html = ''
  items.forEach(item => {
    html += `
      <div class="inventory-item rarity-${item.case_items.rarity || 'common'}" data-item-id="${item.id}">
        <div class="inventory-image">
          <img src="${item.case_items.image_url || 'https://via.placeholder.com/120'}" alt="${item.case_items.name}">
        </div>
        <div class="inventory-info">
          <div class="inventory-name">${item.case_items.name}</div>
          <div class="inventory-value">${item.case_items.value} <i class="fas fa-coins"></i></div>
        </div>
        <div class="inventory-actions">
          <button class="inventory-btn sell-btn" data-item-id="${item.id}" data-value="${item.case_items.value}">
            <i class="fas fa-coins"></i> Продать
          </button>
          <button class="inventory-btn withdraw-btn" data-item-id="${item.id}">
            <i class="fas fa-external-link-alt"></i> Вывести
          </button>
        </div>
      </div>
    `
  })

  inventoryContainer.innerHTML = html
  setupInventoryEventListeners()
}

// Обработчики событий для инвентаря
function setupInventoryEventListeners() {
  // Продажа предмета
  document.querySelectorAll('.sell-btn').forEach(btn => {
    btn.addEventListener('click', async function() {
      const itemId = this.dataset.itemId
      const itemValue = parseInt(this.dataset.value)
      
      if (confirm(`Продать предмет за ${itemValue} монет?`)) {
        await sellInventoryItem(itemId, itemValue)
      }
    })
  })

  // Продажа всех предметов
  document.getElementById('sell-all-btn')?.addEventListener('click', async function() {
    const items = document.querySelectorAll('.inventory-item')
    if (items.length === 0) return
    
    const totalValue = Array.from(items).reduce((sum, item) => {
      return sum + parseInt(item.querySelector('.inventory-value').textContent)
    }, 0)
    
    if (confirm(`Продать все предметы за ${totalValue} монет?`)) {
      await sellAllInventoryItems()
    }
  })

  // Вывод предмета
  document.querySelectorAll('.withdraw-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const itemId = this.dataset.itemId
      tg.showAlert('Функция вывода предмета будет реализована в будущем')
    })
  })
}

// Продажа предмета из инвентаря
async function sellInventoryItem(itemId, itemValue) {
  try {
    // Удаляем предмет из инвентаря
    const { error: deleteError } = await supabase
      .from('user_inventory')
      .delete()
      .eq('id', itemId)
    
    if (deleteError) throw deleteError
    
    // Обновляем баланс пользователя
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('balance')
      .eq('tg_id', tg.initDataUnsafe.user.id)
      .single()
    
    if (userError) throw userError
    
    const { error: updateError } = await supabase
      .from('users')
      .update({ balance: user.balance + itemValue })
      .eq('tg_id', tg.initDataUnsafe.user.id)
    
    if (updateError) throw updateError
    
    // Записываем транзакцию
    await supabase
      .from('transactions')
      .insert({
        user_id: tg.initDataUnsafe.user.id,
        amount: itemValue,
        type: 'item_sell',
        description: 'Продажа предмета из инвентаря'
      })
    
    // Обновляем UI
    await loadUserStats(tg.initDataUnsafe.user.id)
    await loadUserInventory(tg.initDataUnsafe.user.id)
    
    tg.showAlert(`Предмет успешно продан за ${itemValue} монет`)
  } catch (error) {
    console.error('Ошибка продажи предмета:', error)
    tg.showAlert('Произошла ошибка при продаже предмета')
  }
}

// Продажа всех предметов из инвентаря
async function sellAllInventoryItems() {
  try {
    // Получаем все предметы пользователя
    const { data: inventory, error: inventoryError } = await supabase
      .from('user_inventory')
      .select('*, case_items(value)')
      .eq('user_id', tg.initDataUnsafe.user.id)
    
    if (inventoryError) throw inventoryError
    
    if (inventory.length === 0) {
      tg.showAlert('В инвентаре нет предметов для продажи')
      return
    }
    
    // Считаем общую стоимость
    const totalValue = inventory.reduce((sum, item) => sum + item.case_items.value, 0)
    const itemIds = inventory.map(item => item.id)
    
    // Удаляем все предметы
    const { error: deleteError } = await supabase
      .from('user_inventory')
      .delete()
      .in('id', itemIds)
    
    if (deleteError) throw deleteError
    
    // Обновляем баланс
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('balance')
      .eq('tg_id', tg.initDataUnsafe.user.id)
      .single()
    
    if (userError) throw userError
    
    const { error: updateError } = await supabase
      .from('users')
      .update({ balance: user.balance + totalValue })
      .eq('tg_id', tg.initDataUnsafe.user.id)
    
    if (updateError) throw updateError
    
    // Записываем транзакцию
    await supabase
      .from('transactions')
      .insert({
        user_id: tg.initDataUnsafe.user.id,
        amount: totalValue,
        type: 'item_sell_all',
        description: 'Продажа всех предметов из инвентаря'
      })
    
    // Обновляем UI
    await loadUserStats(tg.initDataUnsafe.user.id)
    await loadUserInventory(tg.initDataUnsafe.user.id)
    
    tg.showAlert(`Все предметы проданы за ${totalValue} монет`)
  } catch (error) {
    console.error('Ошибка продажи всех предметов:', error)
    tg.showAlert('Произошла ошибка при продаже предметов')
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
  document.addEventListener('click', function(e) {
    const caseItem = e.target.closest('.case-item')
    if (caseItem) {
      const caseId = caseItem.dataset.caseId
      if (caseId) {
        // Проверяем, существует ли элемент перед обращением к нему
        const profileTab = document.querySelector('.nav-item[data-tab="profile-tab"]')
        if (profileTab) {
          profileTab.classList.remove('active')
        }
        
        // Используем относительный путь
        window.location.href = `case.html?id=${caseId}`
      }
    }
  })
  
  // Обработчики для пополнения баланса
  document.getElementById('deposit-btn')?.addEventListener('click', () => {
    document.getElementById('deposit-modal').classList.add('active')
  })
  
  document.getElementById('deposit-modal-close')?.addEventListener('click', () => {
    document.getElementById('deposit-modal').classList.remove('active')
  })
  
  // Выбор метода пополнения
  document.querySelectorAll('.deposit-method').forEach(method => {
    method.addEventListener('click', () => {
      document.querySelectorAll('.deposit-method').forEach(m => m.classList.remove('active'))
      method.classList.add('active')
      updateDepositCalculation()
    })
  })
  
  // Ввод суммы пополнения
  document.getElementById('deposit-amount')?.addEventListener('input', () => {
    updateDepositCalculation()
  })
  
  // Кнопка пополнения
  document.getElementById('deposit-submit')?.addEventListener('click', async () => {
    await processDeposit()
  })
}

// Обновление расчета суммы пополнения
function updateDepositCalculation() {
  const method = document.querySelector('.deposit-method.active').dataset.method
  const amountInput = document.getElementById('deposit-amount')
  const amount = parseInt(amountInput.value) || 0
  const submitBtn = document.getElementById('deposit-submit')
  
  let rateText = ''
  let bonus = 0
  let total = 0
  
  if (method === 'stars') {
    rateText = '1 звезда = 1 монета'
    total = amount
  } else if (method === 'ton') {
    rateText = '1 TON = 200 монет (+20%)'
    bonus = Math.floor(amount * 40) // 20% от 200 = 40
    total = amount * 200 + bonus
  }
  
  document.getElementById('deposit-rate').textContent = rateText
  document.getElementById('deposit-bonus').textContent = `${bonus} монет`
  document.getElementById('deposit-total').textContent = `${total} монет`
  
  submitBtn.disabled = amount <= 0
}

// Обработка пополнения баланса
async function processDeposit() {
  const method = document.querySelector('.deposit-method.active').dataset.method
  const amount = parseInt(document.getElementById('deposit-amount').value)
  const tg = window.Telegram.WebApp
  
  if (!amount || amount <= 0) {
    tg.showAlert('Введите корректную сумму')
    return
  }
  
  try {
    // В демо-режиме просто увеличиваем баланс
    if (!tg.initDataUnsafe?.user) {
      const currentBalance = parseInt(document.getElementById('user-balance').textContent) || 0
      let total = method === 'stars' ? amount : amount * 240
      document.getElementById('user-balance').textContent = currentBalance + total
      tg.showAlert(`Баланс пополнен на ${total} монет (демо-режим)`)
      document.getElementById('deposit-modal').classList.remove('active')
      document.getElementById('deposit-amount').value = ''
      document.getElementById('deposit-submit').disabled = true
      return
    }
    
    // В реальном режиме сохраняем в базу данных
    let total = method === 'stars' ? amount : amount * 240
    let bonus = method === 'stars' ? 0 : amount * 40
    
    // Обновляем баланс в базе данных
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('balance')
      .eq('tg_id', tg.initDataUnsafe.user.id)
      .single()
    
    if (userError) throw userError
    
    const { error: updateError } = await supabase
      .from('users')
      .update({ balance: user.balance + total })
      .eq('tg_id', tg.initDataUnsafe.user.id)
    
    if (updateError) throw updateError
    
    // Записываем транзакцию
    await supabase
      .from('transactions')
      .insert({
        user_id: tg.initDataUnsafe.user.id,
        amount: total,
        type: 'deposit',
        description: `Пополнение баланса через ${method === 'stars' ? 'Telegram Stars' : 'TON'} (+${bonus} бонус)`
      })
    
    // Обновляем UI
    userBalance.textContent = user.balance + total
    statBalance.textContent = user.balance + total
    
    tg.showAlert(`Баланс успешно пополнен на ${total} монет`)
    document.getElementById('deposit-modal').classList.remove('active')
    document.getElementById('deposit-amount').value = ''
    document.getElementById('deposit-submit').disabled = true
    
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