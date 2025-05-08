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
const inventoryItemsContainer = document.getElementById('inventory-items')
// Добавьте в начало файла
const inventoryTab = document.getElementById('inventory-tab');
const inventoryGrid = document.getElementById('inventory-items');

// Переменные состояния
let currentBalance = 0

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

    } catch (error) {
      console.error('Ошибка инициализации:', error)
    }
  } else {
    console.log('Пользователь Telegram не авторизован')
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
      currentBalance = userData.balance
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
  currentBalance = user.balance || 0
  
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

// Загрузка инвентаря
async function loadInventory() {
  if (!tg.initDataUnsafe?.user) {
    console.log('Пользователь не авторизован');
    return;
  }

  try {
    inventoryGrid.innerHTML = '<div class="loading">Загрузка...</div>';
    
    const { data: items, error } = await supabase
      .from('user_items')
      .select(`
        id,
        item_id,
        quantity,
        case_items (
          name,
          image_url,
          value,
          rarity,
          is_nft
        )
      `)
      .eq('user_id', tg.initDataUnsafe.user.id)
      .neq('quantity', 0)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    if (!items || items.length === 0) {
      inventoryGrid.innerHTML = `
        <div class="empty-inventory">
          <i class="fas fa-box-open"></i>
          <p>Ваш инвентарь пуст</p>
        </div>
      `;
      return;
    }

    renderInventory(items);
  } catch (error) {
    console.error('Ошибка загрузки инвентаря:', error);
    inventoryGrid.innerHTML = `
      <div class="error-message">
        Ошибка загрузки инвентаря. Попробуйте позже.
      </div>
    `;
  }
}

// Обновите функцию renderInventory
function renderInventory(items) {
  inventoryGrid.innerHTML = items.map(item => `
    <div class="inventory-item rarity-${item.case_items.rarity || 'common'}" 
         data-item-id="${item.id}">
      <div class="item-image-container">
        <img src="${item.case_items.image_url || 'https://via.placeholder.com/120'}" 
             alt="${item.case_items.name}" 
             class="inventory-item-image"
             onerror="this.src='https://via.placeholder.com/120'">
        ${item.quantity > 1 ? `
          <div class="item-quantity-badge">${item.quantity}</div>
        ` : ''}
      </div>
      <div class="inventory-item-info">
        <div class="item-name">${item.case_items.name}</div>
        <div class="item-value">
          <i class="fas fa-coins"></i> ${item.case_items.value}
        </div>
        <div class="item-actions">
          <button class="btn sell-btn" data-item-id="${item.id}">
            <i class="fas fa-coins"></i> Продать
          </button>
          ${item.case_items.is_nft ? `
          <button class="btn withdraw-btn" data-item-id="${item.id}">
            <i class="fas fa-external-link-alt"></i> Вывести
          </button>
          ` : ''}
        </div>
      </div>
    </div>
  `).join('');

  // Добавляем обработчики событий
  document.querySelectorAll('.sell-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const itemId = e.currentTarget.dataset.itemId;
      await sellItem(itemId);
    });
  });

  document.querySelectorAll('.withdraw-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const itemId = e.currentTarget.dataset.itemId;
      await withdrawNFT(itemId);
    });
  });
}

// Продажа предмета
async function sellItem(itemId) {
  if (!confirm('Вы уверены, что хотите продать этот предмет?')) return
  
  try {
    // Получаем информацию о предмете
    const { data: item, error: itemError } = await supabase
      .from('user_items')
      .select(`
        id,
        item_id,
        quantity,
        case_items (
          value
        )
      `)
      .eq('id', itemId)
      .single()
    
    if (itemError) throw itemError
    
    // Обновляем баланс пользователя
    const totalValue = item.case_items.value * item.quantity
    const { error: updateError } = await supabase
      .from('users')
      .update({ balance: currentBalance + totalValue })
      .eq('tg_id', tg.initDataUnsafe.user.id)
    
    if (updateError) throw updateError
    
    // Удаляем предмет из инвентаря
    const { error: deleteError } = await supabase
      .from('user_items')
      .delete()
      .eq('id', itemId)
    
    if (deleteError) throw deleteError
    
    // Записываем транзакцию
    await supabase
      .from('transactions')
      .insert({
        user_id: tg.initDataUnsafe.user.id,
        amount: totalValue,
        type: 'item_sell',
        description: `Продажа предмета ID: ${itemId}`
      })
    
    // Обновляем UI
    currentBalance += totalValue
    userBalance.textContent = currentBalance
    statBalance.textContent = currentBalance
    
    // Перезагружаем инвентарь
    await loadInventory()
    
    tg.showAlert(`Предмет успешно продан за ${totalValue} монет`)
  } catch (error) {
    console.error('Ошибка продажи предмета:', error)
    tg.showAlert('Произошла ошибка при продаже предмета')
  }
}

// Продажа всех предметов
async function sellAllItems() {
  if (!confirm('Вы уверены, что хотите продать все предметы?')) return
  
  try {
    // Получаем все предметы пользователя
    const { data: items, error: itemsError } = await supabase
      .from('user_items')
      .select(`
        id,
        item_id,
        quantity,
        case_items (
          value
        )
      `)
      .eq('user_id', tg.initDataUnsafe.user.id)
      .neq('quantity', 0)
    
    if (itemsError) throw itemsError
    
    if (!items || !items.length) {
      tg.showAlert('В вашем инвентаре нет предметов для продажи')
      return
    }
    
    // Считаем общую стоимость
    let totalValue = 0
    const itemIds = []
    
    items.forEach(item => {
      totalValue += item.case_items.value * item.quantity
      itemIds.push(item.id)
    })
    
    // Обновляем баланс пользователя
    const { error: updateError } = await supabase
      .from('users')
      .update({ balance: currentBalance + totalValue })
      .eq('tg_id', tg.initDataUnsafe.user.id)
    
    if (updateError) throw updateError
    
    // Удаляем все предметы из инвентаря
    const { error: deleteError } = await supabase
      .from('user_items')
      .delete()
      .in('id', itemIds)
    
    if (deleteError) throw deleteError
    
    // Записываем транзакцию
    await supabase
      .from('transactions')
      .insert({
        user_id: tg.initDataUnsafe.user.id,
        amount: totalValue,
        type: 'items_sell_all',
        description: `Продажа всех предметов (${items.length} шт)`
      })
    
    // Обновляем UI
    currentBalance += totalValue
    userBalance.textContent = currentBalance
    statBalance.textContent = currentBalance
    
    // Перезагружаем инвентарь
    await loadInventory()
    
    tg.showAlert(`Все предметы успешно проданы за ${totalValue} монет`)
  } catch (error) {
    console.error('Ошибка продажи всех предметов:', error)
    tg.showAlert('Произошла ошибка при продаже предметов')
  }
}

// Вывод NFT (заглушка)
async function withdrawNFT(itemId) {
  tg.showAlert('Функция вывода NFT будет реализована в будущем')
  // Здесь будет логика вывода NFT на внешний кошелек
}

// Пополнение баланса
async function depositBalance(amount) {
  try {
    // Обновляем баланс
    const { error: updateError } = await supabase
      .from('users')
      .update({ balance: currentBalance + amount })
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
    currentBalance += amount
    userBalance.textContent = currentBalance
    statBalance.textContent = currentBalance
    
    tg.showAlert(`Баланс успешно пополнен на ${amount} монет`)
  } catch (error) {
    console.error('Ошибка пополнения баланса:', error)
    tg.showAlert('Произошла ошибка при пополнении баланса')
  }
}

// Настройка обработчиков событий
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
      
      // При переключении на вкладку инвентаря загружаем данные
      if (this.getAttribute('data-tab') === 'inventory-tab') {
        loadInventory()
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

  // Обработчики кликов по карточкам кейсов
  document.addEventListener('click', function(e) {
    const caseItem = e.target.closest('.case-item')
    if (caseItem) {
      const caseId = caseItem.dataset.caseId
      if (caseId) {
        const profileTab = document.querySelector('.nav-item[data-tab="profile-tab"]')
        if (profileTab) {
          profileTab.classList.remove('active')
        }
        
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
  
  // Кнопка "Продать всё"
  document.getElementById('sell-all-btn')?.addEventListener('click', sellAllItems)
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
  initApp()
  setupEventListeners()
})