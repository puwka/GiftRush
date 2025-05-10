// Инициализация Supabase
import { createClient } from 'https://esm.sh/@supabase/supabase-js'

const supabaseUrl = 'https://lhduaxfmgkxlukghaopy.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoZHVheGZtZ2t4bHVrZ2hhb3B5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY0ODIyMzIsImV4cCI6MjA2MjA1ODIzMn0.wjhrbM7PFLYkBb_xnPf83Tzn8dov9OYdJV5CLWSDRy4'
const supabase = createClient(supabaseUrl, supabaseKey)

// Инициализация Telegram WebApp
const tg = window.Telegram.WebApp
tg.expand()

// Константы для пополнения баланса
const DEPOSIT_METHODS = {
  stars: {
    name: 'Telegram Stars',
    rate: 1,
    bonus: 0,
    icon: 'star',
    currency: 'USD'
  },
  ton: {
    name: 'Toncoin (TON)',
    rate: 240,
    bonus: 0.2,
    icon: 'bolt',
    currency: 'TON'
  },
  tonconnect: {
    name: 'TonConnect (TON)',
    rate: 240,
    bonus: 0.2,
    icon: 'wallet',
    currency: 'TON'
  }
}

// Инициализация TonConnect
let tonConnectUI = null;
const manifestUrl = 'https://gift-rush.vercel.app/tonconnect-manifest.json';

// Функция для конвертации в нанотоны
function toNano(amount) {
  return BigInt(amount) * BigInt(1000000000)
}

// Улучшенная функция инициализации TonConnect
async function initTonConnect() {
  return new Promise(async (resolve) => {
    // 1. Проверяем, возможно SDK уже загружен
    if (window.TonConnectUI) {
      console.log('TonConnect SDK already loaded');
      try {
        tonConnectUI = new window.TonConnectUI.TonConnectUI({
          manifestUrl: manifestUrl,
          buttonRootId: 'ton-connect-button',
          language: 'ru'
        });
        console.log('TonConnectUI initialized successfully');
        resolve(true);
      } catch (error) {
        console.error('TonConnectUI initialization error:', error);
        resolve(false);
      }
      return;
    }

    // 2. Создаем промис для ожидания загрузки SDK
    window.TonConnectSDKLoaded = new Promise(sdkResolve => {
      window.resolveTonConnectLoad = sdkResolve;
    });

    // 3. Динамически загружаем SDK
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/@tonconnect/sdk@latest/dist/tonconnect-sdk.min.js';
    script.onload = () => {
      console.log('TonConnect script loaded');
      window.resolveTonConnectLoad();
    };
    script.onerror = () => {
      console.error('Failed to load TonConnect SDK');
      resolve(false);
    };
    document.head.appendChild(script);

    // 4. Ожидаем загрузки SDK
    try {
      await window.TonConnectSDKLoaded;
      
      // Даем дополнительное время на инициализацию
      await new Promise(resolve => setTimeout(resolve, 300));
      
      if (!window.TonConnectUI) {
        console.error('TonConnectUI still not available after loading');
        resolve(false);
        return;
      }

      tonConnectUI = new window.TonConnectUI.TonConnectUI({
        manifestUrl: manifestUrl,
        buttonRootId: 'ton-connect-button',
        language: 'ru'
      });

      console.log('TonConnectUI initialized successfully');
      resolve(true);
    } catch (error) {
      console.error('Error waiting for TonConnect SDK:', error);
      resolve(false);
    }
  });
}

function initializeTonConnectUI(callback) {
  try {
    if (!window.TonConnectUI) {
      throw new Error('TonConnectUI not available');
    }

    tonConnectUI = new window.TonConnectUI.TonConnectUI({
      manifestUrl: manifestUrl,
      buttonRootId: 'ton-connect-button',
      language: 'ru'
    });

    console.log('TonConnectUI initialized successfully');
    callback(true);
  } catch (error) {
    console.error('TonConnectUI initialization failed:', error);
    callback(false);
  }
}

// Обработка платежа через TonConnect
async function processTonConnectPayment(amount, totalAmount) {
  try {
    // Проверяем инициализацию TonConnect
    if (!tonConnectUI) {
      const loaded = await initTonConnect();
      if (!loaded) {
        throw new Error('TonConnect не удалось инициализировать');
      }
    }

    const userId = tg.initDataUnsafe.user.id;
    const transactionId = `deposit_${userId}_${Date.now()}`;

    const transaction = {
      validUntil: Math.floor(Date.now() / 1000) + 300, // 5 минут
      messages: [
        {
          address: 'UQAthLzScLE9Ks-MhL1oZk2AnMqcs02JEdDTGypNnt-GH6jD',
          amount: toNano(amount).toString(),
          payload: JSON.stringify({
            type: 'deposit',
            userId: userId,
            transactionId: transactionId,
            amount: amount,
            totalAmount: totalAmount
          })
        }
      ]
    };

    // Отправляем транзакцию
    const result = await tonConnectUI.sendTransaction(transaction);

    // Сохраняем информацию о транзакции
    const { error } = await supabase
      .from('ton_transactions')
      .insert({
        transaction_id: transactionId,
        user_id: userId,
        amount: amount,
        total_amount: totalAmount,
        status: 'pending'
      });

    if (error) throw error;

    return true;
  } catch (error) {
    console.error('Ошибка TonConnect платежа:', error);
    throw error;
  }
}

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

async function initApp() {
  try {
    // 1. Инициализация Telegram WebApp
    tg.expand();
    tg.enableClosingConfirmation();
    tg.setHeaderColor('#181818');
    tg.setBackgroundColor('#121212');

    // 2. Загрузка пользователя
    const user = await loadUserData();
    if (user) {
      updateUI(user);
      await loadUserStats(user.tg_id);
      await loadUserInventory(user.tg_id);
    } else {
      console.log('Running in demo mode');
      userBalance.textContent = "∞";
      statBalance.textContent = "0";
      statCases.textContent = "0";
      statPrizes.textContent = "0";
    }

    // 3. Инициализация TonConnect в фоновом режиме
    initTonConnect().then(success => {
      if (success) {
        console.log('TonConnect ready for use');
        tonConnectUI.onStatusChange(wallet => {
          console.log('Wallet status:', wallet ? 'connected' : 'disconnected');
        });
      } else {
        console.warn('TonConnect initialization failed - payment features disabled');
        // Скрываем кнопку TonConnect если инициализация не удалась
        document.querySelector('.deposit-method[data-method="tonconnect"]').style.display = 'none';
      }
    });

    // 4. Показываем интерфейс
    setupEventListeners();
    document.body.style.opacity = '1';

  } catch (error) {
    console.error('App initialization error:', error);
    setTimeout(() => {
      tg.showAlert('Ошибка инициализации приложения');
    }, 300);
  }
}

async function loadUserData() {
  if (!tg.initDataUnsafe?.user) return null;
  
  try {
    const userData = tg.initDataUnsafe.user;
    const { data: user, error } = await supabase
      .from('users')
      .upsert({
        tg_id: userData.id,
        username: userData.username || `${userData.first_name}${userData.last_name ? ' ' + userData.last_name : ''}`,
        first_name: userData.first_name,
        last_name: userData.last_name || null,
        avatar_url: userData.photo_url || null,
        last_login: new Date().toISOString()
      }, { onConflict: 'tg_id' })
      .select()
      .single();

    if (error) throw error;
    return user;
  } catch (error) {
    console.error('User data loading error:', error);
    return null;
  }
}

async function checkPendingTransactions(userId) {
  const { data: transactions, error } = await supabase
    .from('ton_transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending');
    
  if (transactions?.length > 0) {
    tg.showPopup({
      title: 'Ожидающие транзакции',
      message: `У вас есть ${transactions.length} неподтверждённых пополнений`,
      buttons: [{ type: 'ok' }]
    });
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
        const profileTab = document.querySelector('.nav-item[data-tab="profile-tab"]')
        if (profileTab) {
          profileTab.classList.remove('active')
        }
        window.location.href = `case.html?id=${caseId}`
      }
    }
  })
  
  // Обработчики для пополнения баланса
  document.getElementById('deposit-btn')?.addEventListener('click', () => {
    document.getElementById('deposit-modal').classList.add('active')
  })
  
  document.getElementById('deposit-modal-close')?.addEventListener('click', () => {
    closeDepositModal()
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
  const amount = parseInt(document.getElementById('deposit-amount').value) || 0
  const submitBtn = document.getElementById('deposit-submit')
  
  const methodData = DEPOSIT_METHODS[method]
  const total = Math.floor(amount * methodData.rate)
  const bonus = method === 'ton' || method === 'tonconnect' ? Math.floor(amount * methodData.rate * methodData.bonus) : 0
  
  document.getElementById('deposit-rate').textContent = 
    method === 'stars' ? '1 звезда = 1 монета' : '1 TON = 240 монет (+20%)'
  document.getElementById('deposit-bonus').textContent = `${bonus} монет`
  document.getElementById('deposit-total').textContent = `${total} монет`
  
  submitBtn.disabled = amount <= 0
}

// Обработка пополнения баланса
async function processDeposit() {
  const method = document.querySelector('.deposit-method.active').dataset.method;
  const amountInput = document.getElementById('deposit-amount');
  const amount = parseInt(amountInput.value);
  
  // Проверка введенной суммы
  if (!amount || amount <= 0) {
    await showSafeAlert('Введите корректную сумму');
    return;
  }

  try {
    const methodData = DEPOSIT_METHODS[method];
    const totalAmount = Math.floor(amount * methodData.rate);
    const bonusAmount = method === 'ton' || method === 'tonconnect' 
      ? Math.floor(totalAmount * methodData.bonus) 
      : 0;
    const finalAmount = totalAmount + bonusAmount;

    // В демо-режиме просто увеличиваем баланс
    if (!tg.initDataUnsafe?.user) {
      const currentBalance = parseInt(userBalance.textContent) || 0;
      userBalance.textContent = currentBalance + finalAmount;
      await showSafeAlert(`Баланс пополнен на ${finalAmount} монет (демо-режим)`);
      closeDepositModal();
      return;
    }

    // Обработка разных методов оплаты
    if (method === 'tonconnect') {
      closeDepositModal();
      
      // Показываем уведомление о начале процесса
      await showSafePopup({
        title: 'Пополнение через TonConnect',
        message: `Подготовка транзакции на ${amount} TON...`
      });

      try {
        const success = await processTonConnectPayment(amount, finalAmount);
        if (success) {
          await showSafeAlert(`Транзакция на ${amount} TON отправлена. Вы получите ${finalAmount} монет после подтверждения.`);
        }
      } catch (error) {
        console.error('TonConnect payment error:', error);
        await showSafeAlert(error.message || 'Ошибка при обработке платежа через TonConnect');
      }
      return;
    }

    // Обработка Telegram Stars и других методов
    const invoiceParams = {
      title: `Пополнение баланса на ${finalAmount} монет`,
      description: `Вы получите ${amount} ${method === 'stars' ? 'звезд' : 'TON'}${bonusAmount > 0 ? ` (+${bonusAmount} бонус)` : ''}`,
      currency: methodData.currency,
      payload: JSON.stringify({
        type: 'deposit',
        method: method,
        amount: amount,
        userId: tg.initDataUnsafe.user.id,
        totalAmount: finalAmount
      })
    };

    // Настройки для разных методов
    if (method === 'stars') {
      invoiceParams.prices = [{ label: `${amount} звезд`, amount: amount * 100 }];
      invoiceParams.provider_token = 'Stripe TEST MODE';
    } else if (method === 'ton') {
      invoiceParams.prices = [{ label: `${amount} TON`, amount: toNano(amount).toString() }];
      invoiceParams.provider_token = 'Stripe TEST MODE';
    }

    // Открываем платежное окно Telegram
    tg.openInvoice(invoiceParams, async (status) => {
      if (status === 'paid') {
        try {
          await completeDeposit(tg.initDataUnsafe.user.id, finalAmount, method);
          await showSafeAlert(`Баланс успешно пополнен на ${finalAmount} монет!`);
        } catch (error) {
          console.error('Deposit completion error:', error);
          await showSafeAlert('Платеж получен, но возникла ошибка при зачислении. Обратитесь в поддержку.');
        }
      } else {
        await showSafeAlert('Платеж не был завершен');
      }
    });

  } catch (error) {
    console.error('Deposit processing error:', error);
    await showSafeAlert(error.message || 'Произошла ошибка при обработке платежа');
  }
}

// Вспомогательные функции для безопасного показа уведомлений
async function showSafeAlert(message) {
  return new Promise(resolve => {
    if (!tg.isPopupOpen()) {
      tg.showAlert(message, resolve);
    } else {
      setTimeout(() => {
        tg.showAlert(message, resolve);
      }, 300);
    }
  });
}

async function showSafePopup(params) {
  return new Promise(resolve => {
    if (!tg.isPopupOpen()) {
      tg.showPopup(params, resolve);
    } else {
      setTimeout(() => {
        tg.showPopup(params, resolve);
      }, 300);
    }
  });
}

// Завершение пополнения баланса
async function completeDeposit(userId, amount, method) {
  try {
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
        description: `Пополнение через ${DEPOSIT_METHODS[method].name}`
      })
    
    // Обновляем UI
    userBalance.textContent = user.balance + amount
    statBalance.textContent = user.balance + amount
    
    closeDepositModal()
    
  } catch (error) {
    console.error('Ошибка завершения пополнения:', error)
  }
}

// Закрытие модального окна пополнения
function closeDepositModal() {
  document.getElementById('deposit-modal').classList.remove('active')
  document.getElementById('deposit-amount').value = ''
  document.getElementById('deposit-submit').disabled = true
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
  initApp()
  setupEventListeners()
})