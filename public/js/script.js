// Инициализация Supabase
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = 'https://lhduaxfmgkxlukghaopy.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoZHVheGZtZ2t4bHVrZ2hhb3B5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY0ODIyMzIsImV4cCI6MjA2MjA1ODIzMn0.wjhrbM7PFLYkBb_xnPf83Tzn8dov9OYdJV5CLWSDRy4'
const supabase = createClient(supabaseUrl, supabaseKey)

// Инициализация Telegram WebApp
const tg = window.Telegram.WebApp
tg.expand()

// Состояние приложения
let appState = {
    currentUser: null,
    demoMode: false,
    currentCase: null,
    caseItems: [],
    selectedQuantity: 1,
    inventoryItems: []
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
const demoModeToggle = document.getElementById('demo-mode-toggle')
const casesContainer = document.getElementById('cases-container')
const inventoryContainer = document.getElementById('inventory-container')
const caseRoulette = document.getElementById('case-roulette')
const prizeDisplay = document.getElementById('prize-display')
const caseItemsPreview = document.getElementById('case-items-preview')
const openCaseBtn = document.getElementById('open-case-btn')
const backToCasesBtn = document.getElementById('back-to-cases-btn')
const depositBtn = document.getElementById('deposit-btn')
const caseModal = document.getElementById('case-modal')
const confirmOpenCaseBtn = document.getElementById('confirm-open-case')
const cancelOpenCaseBtn = document.getElementById('cancel-open-case')

// Основная функция инициализации
async function initApp() {
    // Проверяем, есть ли пользователь Telegram
    if (tg.initDataUnsafe.user) {
        const userData = tg.initDataUnsafe.user
        try {
            // Сохраняем/обновляем пользователя
            const user = await upsertUser(userData)
            appState.currentUser = user
            
            // Обновляем UI
            updateUI(user)
            
            // Загружаем статистику
            await loadUserStats(user.tg_id)
            
            // Загружаем инвентарь
            await loadInventory(user.tg_id)
            
            // Загружаем кейсы
            await loadCases()
            
            // Настраиваем обработчики событий
            setupEventListeners()
            
            // Настраиваем демо-режим
            setupDemoMode()
        } catch (error) {
            console.error('Ошибка инициализации:', error)
        }
    } else {
        console.log('Пользователь Telegram не авторизован')
        // Включаем демо-режим по умолчанию, если нет пользователя
        appState.demoMode = true
        demoModeToggle.checked = true
        await loadCases()
        setupEventListeners()
        setupDemoMode()
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
            appState.currentUser.balance = userData.balance
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
async function loadInventory(userId) {
    try {
        const { data, error } = await supabase
            .from('opened_cases')
            .select(`
                id,
                prize_value,
                prize_description,
                item_id,
                is_nft,
                nft_contract_address,
                nft_token_id,
                case_items (
                    name,
                    image_url,
                    rarity
                )
            `)
            .eq('user_id', userId)
            .not('item_id', 'is', null)
            .order('opened_at', { ascending: false })

        if (error) throw error

        appState.inventoryItems = data || []
        renderInventory()
    } catch (error) {
        console.error('Ошибка загрузки инвентаря:', error)
    }
}

// Загрузка кейсов
async function loadCases() {
    try {
        const { data, error } = await supabase
            .from('cases')
            .select('*')
            .order('price', { ascending: true })

        if (error) throw error

        renderCases(data)
    } catch (error) {
        console.error('Ошибка загрузки кейсов:', error)
    }
}

// Загрузка предметов кейса
async function loadCaseItems(caseId) {
    try {
        const { data, error } = await supabase
            .from('case_items')
            .select('*')
            .eq('case_id', caseId)
            .order('probability', { ascending: false })

        if (error) throw error

        appState.caseItems = data
        renderCaseItemsPreview()
    } catch (error) {
        console.error('Ошибка загрузки предметов кейса:', error)
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

// Рендеринг кейсов
function renderCases(cases) {
    casesContainer.innerHTML = ''

    // Группируем кейсы по категориям
    const categories = {
        free: { title: 'Бесплатные кейсы', cases: [] },
        nft: { title: 'NFT кейсы', cases: [] },
        farm: { title: 'Фарм кейсы', cases: [] },
        other: { title: 'Другие кейсы', cases: [] }
    }

    cases.forEach(caseItem => {
        if (caseItem.type === 'free') {
            categories.free.cases.push(caseItem)
        } else if (caseItem.type === 'nft') {
            categories.nft.cases.push(caseItem)
        } else if (caseItem.type === 'farm') {
            categories.farm.cases.push(caseItem)
        } else {
            categories.other.cases.push(caseItem)
        }
    })

    // Рендерим кейсы по категориям
    for (const [category, data] of Object.entries(categories)) {
        if (data.cases.length > 0) {
            // Добавляем заголовок категории
            const titleElement = document.createElement('h2')
            titleElement.className = 'category-title'
            titleElement.textContent = data.title
            casesContainer.appendChild(titleElement)

            // Добавляем кейсы
            data.cases.forEach(caseItem => {
                const caseElement = document.createElement('div')
                caseElement.className = `case-item ${category}`
                caseElement.dataset.caseId = caseItem.id
                
                caseElement.innerHTML = `
                    <div class="case-preview">
                        <img src="${caseItem.image_url || 'https://images.giftsbattle.com/case/%D0%B7%D0%B0_%D0%BF%D1%80%D0%BE%D0%BC%D0%BE%D0%BA%D0%BE%D0%B4%D1%8B_2.png'}" alt="${caseItem.name}">
                    </div>
                    <div class="case-info">
                        <h3 class="case-name">${caseItem.name}</h3>
                        <div class="case-price">
                            <i class="fas fa-coins"></i> ${caseItem.price}
                        </div>
                    </div>
                `
                
                casesContainer.appendChild(caseElement)
            })
        }
    }
}

// Рендеринг предметов кейса в превью
function renderCaseItemsPreview() {
    caseItemsPreview.innerHTML = ''
    
    appState.caseItems.forEach(item => {
        const itemElement = document.createElement('div')
        itemElement.className = 'case-item-preview'
        
        // Определяем класс редкости
        let rarityClass = ''
        if (item.rarity === 'rare') rarityClass = 'rare-item'
        else if (item.rarity === 'epic') rarityClass = 'epic-item'
        else if (item.rarity === 'legendary') rarityClass = 'legendary-item'
        
        itemElement.innerHTML = `
            <div class="case-item-preview-img-container">
                <img src="${item.image_url}" alt="${item.name}" class="case-item-preview-img">
                ${item.is_nft ? '<span class="nft-badge">NFT</span>' : ''}
            </div>
            <div class="case-item-preview-name">${item.name}</div>
            <div class="case-item-preview-value">${item.value} монет</div>
            <div class="case-item-preview-probability">${(item.probability * 100).toFixed(2)}%</div>
        `
        
        if (rarityClass) {
            itemElement.classList.add(rarityClass)
        }
        
        caseItemsPreview.appendChild(itemElement)
    })
}

// Рендеринг инвентаря
function renderInventory() {
    inventoryContainer.innerHTML = ''
    
    if (appState.inventoryItems.length === 0) {
        inventoryContainer.innerHTML = '<p class="empty-inventory">Ваш инвентарь пуст</p>'
        return
    }
    
    appState.inventoryItems.forEach(item => {
        const itemElement = document.createElement('div')
        itemElement.className = 'inventory-item'
        
        // Определяем класс редкости
        let rarityClass = ''
        if (item.case_items?.rarity === 'rare') rarityClass = 'rare-item'
        else if (item.case_items?.rarity === 'epic') rarityClass = 'epic-item'
        else if (item.case_items?.rarity === 'legendary') rarityClass = 'legendary-item'
        
        itemElement.innerHTML = `
            <div class="inventory-item-img-container">
                <img src="${item.case_items?.image_url || 'https://via.placeholder.com/50'}" alt="${item.case_items?.name || 'Предмет'}" class="inventory-item-img">
                ${item.is_nft ? '<span class="nft-badge">NFT</span>' : ''}
            </div>
            <div class="inventory-item-name">${item.case_items?.name || item.prize_description || 'Предмет'}</div>
            <div class="inventory-item-value">${item.prize_value || item.case_items?.value || 0} монет</div>
        `
        
        if (rarityClass) {
            itemElement.classList.add(rarityClass)
        }
        
        inventoryContainer.appendChild(itemElement)
    })
}

// Подготовка рулетки
function prepareRoulette() {
    caseRoulette.innerHTML = ''
    
    // Создаем дубликаты предметов для бесконечной прокрутки
    const itemsForRoulette = [...appState.caseItems, ...appState.caseItems, ...appState.caseItems]
    
    itemsForRoulette.forEach((item, index) => {
        const itemElement = document.createElement('div')
        itemElement.className = 'roulette-item'
        itemElement.dataset.itemId = item.id
        
        // Определяем класс редкости
        let rarityClass = ''
        if (item.rarity === 'rare') rarityClass = 'rare-item'
        else if (item.rarity === 'epic') rarityClass = 'epic-item'
        else if (item.rarity === 'legendary') rarityClass = 'legendary-item'
        
        itemElement.innerHTML = `
            <img src="${item.image_url}" alt="${item.name}" class="roulette-item-img">
            <div class="roulette-item-name">${item.name}</div>
            <div class="roulette-item-value">${item.value} монет</div>
        `
        
        if (rarityClass) {
            itemElement.classList.add(rarityClass)
        }
        
        caseRoulette.appendChild(itemElement)
    })
}

// Анимация рулетки
async function spinRoulette(quantity = 1) {
    prizeDisplay.innerHTML = ''
    const prizes = []
    
    for (let i = 0; i < quantity; i++) {
        // Выбираем случайный предмет с учетом вероятности
        const randomItem = getRandomItemWithProbability()
        prizes.push(randomItem)
        
        // Анимируем рулетку
        const rouletteItems = Array.from(document.querySelectorAll('.roulette-item'))
        const targetIndex = rouletteItems.findIndex(item => item.dataset.itemId === randomItem.id.toString())
        
        if (targetIndex !== -1) {
            const targetPosition = targetIndex * 100
            const currentPosition = parseInt(caseRoulette.style.transform?.replace('translateX(', '').replace('px)', '') || 0)
            const distance = targetPosition - currentPosition + (i * 1000) // Добавляем смещение для каждого кейса
            
            caseRoulette.style.transition = 'transform 3s cubic-bezier(0.2, 0.8, 0.3, 1)'
            caseRoulette.style.transform = `translateX(-${distance}px)`
            
            // Ждем завершения анимации
            await new Promise(resolve => {
                caseRoulette.addEventListener('transitionend', resolve, { once: true })
                setTimeout(resolve, 3000) // На всякий случай
            })
            
            // Отображаем выигранный приз
            displayPrize(randomItem, i)
            
            // Если это не последний кейс, делаем небольшую паузу
            if (i < quantity - 1) {
                await new Promise(resolve => setTimeout(resolve, 500))
            }
        }
    }
    
    return prizes
}

// Выбор случайного предмета с учетом вероятности
function getRandomItemWithProbability() {
    const random = Math.random()
    let cumulativeProbability = 0
    
    for (const item of appState.caseItems) {
        cumulativeProbability += item.probability
        if (random <= cumulativeProbability) {
            return item
        }
    }
    
    // Если что-то пошло не так, возвращаем первый предмет
    return appState.caseItems[0]
}

// Отображение выигранного приза
function displayPrize(item, index) {
    const prizeElement = document.createElement('div')
    prizeElement.className = 'prize-item winner-animation'
    prizeElement.style.animationDelay = `${index * 0.1}s`
    
    // Определяем класс редкости
    let rarityClass = ''
    if (item.rarity === 'rare') rarityClass = 'rare-item'
    else if (item.rarity === 'epic') rarityClass = 'epic-item'
    else if (item.rarity === 'legendary') rarityClass = 'legendary-item'
    
    prizeElement.innerHTML = `
        <img src="${item.image_url}" alt="${item.name}" class="prize-item-img">
        <div class="prize-item-name">${item.name}</div>
        <div class="prize-item-value">${item.value} монет</div>
    `
    
    if (rarityClass) {
        prizeElement.classList.add(rarityClass)
    }
    
    prizeDisplay.appendChild(prizeElement)
    
    // Через 3 секунды убираем анимацию
    setTimeout(() => {
        prizeElement.classList.remove('winner-animation')
    }, 3000)
}

// Открытие кейса
async function openCase(caseId, quantity = 1) {
    if (appState.demoMode) {
        // Демо-режим - просто показываем анимацию
        try {
            // Загружаем предметы кейса
            await loadCaseItems(caseId)
            
            // Подготавливаем рулетку
            prepareRoulette()
            
            // Запускаем анимацию
            const prizes = await spinRoulette(quantity)
            
            // Показываем сообщение о выигрыше
            setTimeout(() => {
                tg.showAlert(`В демо-режиме вы выиграли: ${prizes.map(p => `${p.name} (${p.value} монет)`).join(', ')}`)
            }, 1000)
            
        } catch (error) {
            console.error('Ошибка открытия кейса в демо-режиме:', error)
            tg.showAlert('Произошла ошибка при открытии кейса')
        }
    } else {
        // Режим реального открытия
        try {
            // Проверяем баланс
            const caseData = await supabase
                .from('cases')
                .select('*')
                .eq('id', caseId)
                .single()
            
            if (caseData.error) throw caseData.error
            
            const totalCost = caseData.data.price * quantity
            
            if (appState.currentUser.balance < totalCost) {
                tg.showAlert('Недостаточно средств на балансе')
                return
            }
            
            // Загружаем предметы кейса
            await loadCaseItems(caseId)
            
            // Подготавливаем рулетку
            prepareRoulette()
            
            // Запускаем анимацию
            const demoPrizes = await spinRoulette(quantity)
            
            // На самом деле выбираем призы (может отличаться от демо)
            const realPrizes = []
            for (let i = 0; i < quantity; i++) {
                realPrizes.push(getRandomItemWithProbability())
            }
            
            // Обновляем баланс
            const totalPrizeValue = realPrizes.reduce((sum, prize) => sum + prize.value, 0)
            const newBalance = appState.currentUser.balance - totalCost + totalPrizeValue
            
            const { error: balanceError } = await supabase
                .from('users')
                .update({ balance: newBalance })
                .eq('tg_id', appState.currentUser.tg_id)
            
            if (balanceError) throw balanceError
            
            // Записываем транзакции
            await supabase
                .from('transactions')
                .insert({
                    user_id: appState.currentUser.tg_id,
                    amount: -totalCost,
                    type: 'case_open',
                    description: `Открытие ${quantity} кейсов "${caseData.data.name}"`
                })
            
            // Записываем открытые кейсы
            const openedCases = realPrizes.map(prize => ({
                user_id: appState.currentUser.tg_id,
                case_id: caseId,
                prize_value: prize.value,
                prize_description: prize.name,
                item_id: prize.id,
                is_nft: prize.is_nft,
                nft_contract_address: prize.nft_contract_address,
                nft_token_id: prize.nft_token_id
            }))
            
            await supabase
                .from('opened_cases')
                .insert(openedCases)
            
            // Обновляем UI
            appState.currentUser.balance = newBalance
            userBalance.textContent = newBalance
            statBalance.textContent = newBalance
            
            // Показываем реальные призы
            setTimeout(() => {
                prizeDisplay.innerHTML = ''
                realPrizes.forEach((prize, index) => {
                    displayPrize(prize, index)
                })
                
                tg.showAlert(`Вы открыли ${quantity} кейсов и выиграли: ${realPrizes.map(p => `${p.name} (${p.value} монет)`).join(', ')}`)
                
                // Обновляем статистику и инвентарь
                loadUserStats(appState.currentUser.tg_id)
                loadInventory(appState.currentUser.tg_id)
            }, 1000)
            
        } catch (error) {
            console.error('Ошибка открытия кейса:', error)
            tg.showAlert('Произошла ошибка при открытии кейса')
        }
    }
}

// Настройка демо-режима
function setupDemoMode() {
    demoModeToggle.addEventListener('change', function() {
        appState.demoMode = this.checked
        if (appState.demoMode) {
            tg.showAlert('Демо-режим включен. Вы можете тестировать открытие кейсов без списания средств.')
        } else {
            tg.showAlert('Демо-режим выключен. Теперь открытие кейсов будет использовать реальный баланс.')
        }
    })
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Клик по кейсу
    casesContainer.addEventListener('click', async (e) => {
        const caseItem = e.target.closest('.case-item')
        if (caseItem) {
            const caseId = caseItem.dataset.caseId
            appState.currentCase = caseId
            
            // Загружаем предметы кейса
            await loadCaseItems(caseId)
            
            // Подготавливаем рулетку
            prepareRoulette()
            
            // Показываем модальное окно для выбора количества
            showCaseModal()
        }
    })
    
    // Кнопка открытия кейса
    openCaseBtn.addEventListener('click', () => {
        if (appState.currentCase) {
            openCase(appState.currentCase, appState.selectedQuantity)
        }
    })
    
    // Кнопка назад
    backToCasesBtn.addEventListener('click', () => {
        document.querySelector('.nav-item[data-tab="home-tab"]').click()
    })
    
    // Кнопка пополнения баланса
    depositBtn.addEventListener('click', () => {
        tg.showPopup({
            title: 'Пополнение баланса',
            message: 'Выберите сумму для пополнения:',
            buttons: [
                { id: '100', type: 'default', text: '100 монет' },
                { id: '500', type: 'default', text: '500 монет' },
                { id: '1000', type: 'default', text: '1000 монет' },
                { id: 'cancel', type: 'cancel' }
            ]
        }, async (btnId) => {
            if (btnId !== 'cancel' && appState.currentUser) {
                const amount = parseInt(btnId)
                await depositBalance(amount)
            }
        })
    })
    
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
    
    // Модальное окно
    const quantityBtns = document.querySelectorAll('.quantity-btn')
    quantityBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            quantityBtns.forEach(b => b.classList.remove('active'))
            this.classList.add('active')
            appState.selectedQuantity = parseInt(this.dataset.quantity)
        })
    })
    
    confirmOpenCaseBtn.addEventListener('click', () => {
        hideCaseModal()
        // Переключаемся на вкладку открытия кейса
        document.querySelector('.nav-item[data-tab="open-case-tab"]')?.click()
    })
    
    cancelOpenCaseBtn.addEventListener('click', hideCaseModal)
    document.querySelector('.modal-close').addEventListener('click', hideCaseModal)
}

// Показать модальное окно выбора количества
function showCaseModal() {
    caseModal.classList.add('show')
    document.body.style.overflow = 'hidden'
}

// Скрыть модальное окно
function hideCaseModal() {
    caseModal.classList.remove('show')
    document.body.style.overflow = ''
}

// Пополнение баланса
async function depositBalance(amount) {
    try {
        // Обновляем баланс
        const { error: updateError } = await supabase
            .from('users')
            .update({ balance: appState.currentUser.balance + amount })
            .eq('tg_id', appState.currentUser.tg_id)
        
        if (updateError) throw updateError
        
        // Записываем транзакцию
        await supabase
            .from('transactions')
            .insert({
                user_id: appState.currentUser.tg_id,
                amount: amount,
                type: 'deposit',
                description: `Пополнение баланса на ${amount} монет`
            })
        
        // Обновляем UI
        appState.currentUser.balance += amount
        userBalance.textContent = appState.currentUser.balance
        statBalance.textContent = appState.currentUser.balance
        
        tg.showAlert(`Баланс успешно пополнен на ${amount} монет`)
    } catch (error) {
        console.error('Ошибка пополнения баланса:', error)
        tg.showAlert('Произошла ошибка при пополнении баланса')
    }
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    initApp()
    
    // Создаем псевдо-вкладку для открытия кейсов
    const openCaseTab = document.createElement('a')
    openCaseTab.href = '#'
    openCaseTab.className = 'nav-item hidden'
    openCaseTab.dataset.tab = 'open-case-tab'
    openCaseTab.innerHTML = '<i class="fas fa-box-open"></i><span>Открытие</span>'
    document.querySelector('.bottom-nav').appendChild(openCaseTab)
    
    // Создаем обработчик для псевдо-вкладки
    openCaseTab.addEventListener('click', function(e) {
        e.preventDefault()
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'))
        this.classList.add('active')
        
        document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'))
        document.getElementById('open-case-tab').classList.remove('hidden')
    })
})