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
const caseImage = document.getElementById('case-image')
const caseName = document.getElementById('case-name')
const caseDescription = document.getElementById('case-description')
const casePrice = document.getElementById('case-price')
const demoMode = document.getElementById('demo-mode')
const quantityMinus = document.getElementById('quantity-minus')
const quantityPlus = document.getElementById('quantity-plus')
const quantityValue = document.getElementById('quantity-value')
const openCaseBtn = document.getElementById('open-case-btn')
const openCaseText = document.getElementById('open-case-text')
const openCasePrice = document.getElementById('open-case-price')
const roulette = document.getElementById('roulette')
const resultsContainer = document.getElementById('results-container')
const resultsGrid = document.getElementById('results-grid')
const itemsGrid = document.getElementById('items-grid')
const nftModal = document.getElementById('nft-modal')
const nftModalClose = document.getElementById('nft-modal-close')
const casePreview = document.querySelector('.case-preview')
const caseInfo = document.querySelector('.case-info')
const caseHeader = document.querySelector('.case-header')

// Переменные состояния
let currentCase = null
let caseItems = []
let userData = null
let quantity = 1
let isSpinning = false
let currentCaseId = null

// Основная функция инициализации
async function initApp() {
    // Получаем ID кейса из URL
    const urlParams = new URLSearchParams(window.location.search);
    currentCaseId = urlParams.get('id');
    
    if (!currentCaseId) {
        tg.showAlert('Кейс не найден');
        window.location.href = 'index.html';
        return;
    }

    if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
        tg = window.Telegram.WebApp;
        tg.expand();
    }

    if (tg.initDataUnsafe.user) {
        userData = tg.initDataUnsafe.user;
        try {
            await loadUserData();
            await loadCaseData();
            await loadCaseItems();
            updateUI();
            setupEventListeners();
        } catch (error) {
            console.error('Ошибка инициализации:', error);
            tg.showAlert('Произошла ошибка при загрузке данных');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1500);
        }
    }
}

// ... (остальной код case.js без изменений)

// Загрузка данных пользователя
async function loadUserData() {
    const { data, error } = await supabase
        .from('users')
        .select('balance')
        .eq('tg_id', userData.id)
        .single()
    
    if (error) throw error
    userBalance.textContent = data.balance
}

// Загрузка данных кейса
async function loadCaseData() {
    const { data, error } = await supabase
        .from('cases')
        .select('*')
        .eq('id', currentCaseId)
        .single();
    
    if (error) {
        console.error('Ошибка загрузки кейса:', error);
        tg.showAlert('Не удалось загрузить данные кейса');
        window.location.href = 'index.html';
        return;
    }
    
    if (!data) {
        tg.showAlert('Кейс не найден');
        window.location.href = 'index.html';
        return;
    }
    
    currentCase = data;
    
    // Обновляем информацию о кейсе
    caseImage.src = currentCase.image_url;
    caseName.textContent = currentCase.name;
    caseDescription.textContent = currentCase.description || 'Описание отсутствует';
    casePrice.innerHTML = `<i class="fas fa-coins"></i> ${currentCase.price}`;
}

// Загрузка предметов кейса
async function loadCaseItems() {
    const { data, error } = await supabase
        .from('case_items')
        .select('*')
        .eq('case_id', currentCaseId)
        .order('value', { ascending: false })
    
    if (error) throw error
    caseItems = data
    
    // Заполняем рулетку
    fillRoulette()
    
    // Заполняем список предметов
    fillItemsGrid()
}

// Заполнение рулетки
function fillRoulette() {
    roulette.innerHTML = ''
    
    // Создаем дубликаты предметов для бесконечной рулетки
    const itemsForRoulette = [...caseItems, ...caseItems, ...caseItems]
    
    itemsForRoulette.forEach(item => {
        const itemElement = document.createElement('div')
        itemElement.className = `roulette-item ${item.rarity} ${item.is_nft ? 'nft' : ''}`
        itemElement.innerHTML = `
            <img src="${item.image_url}" alt="${item.name}">
            <span class="roulette-item-name">${item.name}</span>
            <span class="roulette-item-value"><i class="fas fa-coins"></i> ${item.value}</span>
        `
        roulette.appendChild(itemElement)
    })
}

// Заполнение списка предметов
function fillItemsGrid(filter = 'all') {
    itemsGrid.innerHTML = ''
    
    const filteredItems = caseItems.filter(item => {
        if (filter === 'all') return true
        if (filter === 'nft') return item.is_nft
        return item.rarity === filter
    })
    
    filteredItems.forEach(item => {
        const itemElement = document.createElement('div')
        itemElement.className = `item-card ${item.rarity} ${item.is_nft ? 'nft' : ''}`
        itemElement.innerHTML = `
            <img src="${item.image_url}" alt="${item.name}">
            <span class="item-name">${item.name}</span>
            <span class="item-value"><i class="fas fa-coins"></i> ${item.value}</span>
            <span class="item-probability">${Math.round(item.probability * 100)}%</span>
        `
        
        if (item.is_nft) {
            itemElement.addEventListener('click', () => showNftModal(item))
        }
        
        itemsGrid.appendChild(itemElement)
    })
}

// Обновление UI
function updateUI() {
    // Обновляем стоимость открытия
    const totalPrice = currentCase.price * quantity
    openCasePrice.textContent = `(${totalPrice} монет)`
    
    // Если демо-режим, меняем текст кнопки
    if (demoMode.checked) {
        openCaseText.textContent = 'Демо-режим'
    } else {
        openCaseText.textContent = quantity > 1 ? `Открыть ${quantity} кейса` : 'Открыть кейс'
    }
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Переключатель демо-режима
    demoMode.addEventListener('change', updateUI)
    
    // Кнопки изменения количества
    quantityMinus.addEventListener('click', () => {
        if (quantity > 1) {
            quantity--
            quantityValue.textContent = quantity
            updateUI()
        }
    })
    
    quantityPlus.addEventListener('click', () => {
        if (quantity < 3) {
            quantity++
            quantityValue.textContent = quantity
            updateUI()
        }
    })
    
    // Кнопка открытия кейса
    openCaseBtn.addEventListener('click', openCase)
    
    // Закрытие модального окна NFT
    nftModalClose.addEventListener('click', () => {
        nftModal.classList.remove('active')
    })
    
    // Фильтрация предметов
    document.querySelectorAll('.items-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.items-tab').forEach(t => t.classList.remove('active'))
            this.classList.add('active')
            fillItemsGrid(this.dataset.filter)
        })
    })
}

// Функция открытия кейса
async function openCase() {
    if (isSpinning) return
    isSpinning = true
    
    // Скрываем превью кейса и показываем рулетку
    casePreview.style.display = 'none'
    caseInfo.style.display = 'none'
    roulette.style.display = 'flex'
    roulette.style.opacity = '1'
    
    // Очищаем предыдущие результаты
    resultsContainer.classList.add('hidden')
    resultsGrid.innerHTML = ''
    
    // Проверяем демо-режим
    const isDemo = demoMode.checked
    
    if (!isDemo) {
        // Проверяем баланс
        const totalPrice = currentCase.price * quantity
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('balance')
            .eq('tg_id', userData.id)
            .single()
        
        if (userError) {
            console.error('Ошибка проверки баланса:', userError)
            tg.showAlert('Ошибка проверки баланса')
            resetCaseView()
            isSpinning = false
            return
        }
        
        if (user.balance < totalPrice) {
            tg.showAlert('Недостаточно средств на балансе')
            resetCaseView()
            isSpinning = false
            return
        }
    }
    
    // Запускаем анимацию рулетки
    startRouletteAnimation(quantity, isDemo)
}

// Функция сброса вида кейса
function resetCaseView() {
    casePreview.style.display = ''
    caseInfo.style.display = ''
    roulette.style.display = 'none'
}

// Запуск анимации рулетки
async function startRouletteAnimation(count, isDemo) {
    // Скрываем кнопку открытия
    openCaseBtn.disabled = true
    
    // Получаем случайные предметы для выигрыша
    const winners = getRandomItems(count)
    
    // Рассчитываем позицию для остановки
    const itemWidth = 160 // Ширина элемента рулетки
    const centerOffset = Math.floor(roulette.children.length / 3) * itemWidth
    const winnerIndex = caseItems.findIndex(item => item.id === winners[0].id)
    const stopPosition = -(winnerIndex * itemWidth + centerOffset + Math.random() * itemWidth * 0.8)
    
    // Начальные параметры анимации
    let startTime = null
    const duration = 5000 // 5 секунд
    const startPosition = 0
    let lastPosition = 0
    
    // Функция анимации
    const animate = (timestamp) => {
        if (!startTime) startTime = timestamp
        const progress = Math.min((timestamp - startTime) / duration, 1)
        
        // Эффект замедления (easing)
        let easing
        if (progress < 0.7) {
            // Первая фаза - быстрое вращение
            easing = progress / 0.7
            easing = Math.pow(easing, 3) // Кубическое ускорение
        } else {
            // Вторая фаза - замедление
            easing = 0.7 + (progress - 0.7) / 0.3 * 0.3
            easing = 1 - Math.pow(1 - (easing - 0.7) / 0.3, 3) // Кубическое замедление
        }
        
        // Позиция рулетки
        const distance = stopPosition - startPosition
        const position = startPosition + distance * easing
        
        // Плавное обновление позиции
        roulette.style.transform = `translateX(${position}px)`
        lastPosition = position
        
        if (progress < 1) {
            requestAnimationFrame(animate)
        } else {
            // Анимация завершена
            finishRouletteSpin(winners, isDemo)
        }
    }
    
    // Запускаем анимацию
    requestAnimationFrame(animate)
    
    // Добавляем эффект "покачивания" рулетки перед остановкой
    setTimeout(() => {
        const wobble = () => {
            const wobbleAmount = 5 * Math.sin(Date.now() / 100)
            roulette.style.transform = `translateX(${lastPosition + wobbleAmount}px)`
            if (isSpinning) requestAnimationFrame(wobble)
        }
        wobble()
    }, duration * 0.8)
}

// Получение случайных предметов с учетом вероятности
function getRandomItems(count) {
    const results = []
    
    for (let i = 0; i < count; i++) {
        // Создаем массив с учетом вероятности
        const weightedItems = []
        caseItems.forEach(item => {
            const probability = Math.floor(item.probability * 100)
            for (let j = 0; j < probability; j++) {
                weightedItems.push(item)
            }
        })
        
        // Выбираем случайный предмет
        const randomIndex = Math.floor(Math.random() * weightedItems.length)
        results.push(weightedItems[randomIndex])
    }
    
    return results
}

// Завершение вращения рулетки
async function finishRouletteSpin(winners, isDemo) {
    // Показываем результаты
    showResults(winners)
    
    // Показываем обратно информацию о кейсе
    caseInfo.style.display = ''
    casePreview.style.display = ''
    roulette.style.display = 'none'
    
    if (!isDemo) {
        // Обновляем баланс и записываем транзакции
        await processRealCaseOpening(winners)
    }
    
    // Включаем кнопку
    openCaseBtn.disabled = false
    isSpinning = false
}

// Показ результатов
function showResults(winners) {
    resultsContainer.classList.remove('hidden')
    resultsGrid.innerHTML = ''
    
    winners.forEach((winner, index) => {
        const resultItem = document.createElement('div')
        resultItem.className = `result-item ${winner.rarity} ${winner.is_nft ? 'nft' : ''}`
        resultItem.innerHTML = `
            <img src="${winner.image_url}" alt="${winner.name}">
            <span class="result-item-name">${winner.name}</span>
            <span class="result-item-value"><i class="fas fa-coins"></i> ${winner.value}</span>
        `
        
        if (winner.is_nft) {
            resultItem.addEventListener('click', () => showNftModal(winner))
        }
        
        // Анимация появления с задержкой
        resultItem.style.opacity = 0
        resultItem.style.transform = 'translateY(20px)'
        resultItem.style.transition = `all 0.3s ${index * 0.1}s`
        
        setTimeout(() => {
            resultItem.style.opacity = 1
            resultItem.style.transform = 'translateY(0)'
        }, 100)
        
        resultsGrid.appendChild(resultItem)
    })
}

// Обработка реального открытия кейса
async function processRealCaseOpening(winners) {
    const totalPrice = currentCase.price * quantity
    
    try {
        // Обновляем баланс
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('balance')
            .eq('tg_id', userData.id)
            .single()
        
        if (userError) throw userError
        
        // Вычисляем общий выигрыш
        const totalWin = winners.reduce((sum, item) => sum + item.value, 0)
        const newBalance = user.balance - totalPrice + totalWin
        
        // Обновляем баланс
        const { error: updateError } = await supabase
            .from('users')
            .update({ balance: newBalance })
            .eq('tg_id', userData.id)
        
        if (updateError) throw updateError
        
        // Обновляем отображение баланса
        userBalance.textContent = newBalance
        
        // Записываем транзакции
        await supabase
            .from('transactions')
            .insert({
                user_id: userData.id,
                amount: -totalPrice,
                type: 'case_open',
                description: `Открытие ${quantity} кейсов "${currentCase.name}"`
            })
        
        // Если есть выигрыш, записываем его
        if (totalWin > 0) {
            await supabase
                .from('transactions')
                .insert({
                    user_id: userData.id,
                    amount: totalWin,
                    type: 'prize',
                    description: `Выигрыш из кейса "${currentCase.name}"`
                })
        }
        
        // Записываем открытые кейсы
        for (const winner of winners) {
            await supabase
                .from('opened_cases')
                .insert({
                    user_id: userData.id,
                    case_type: currentCase.type,
                    case_id: currentCase.id,
                    prize_value: winner.value,
                    prize_description: winner.name,
                    item_id: winner.id,
                    is_nft: winner.is_nft,
                    nft_contract_address: winner.nft_contract_address,
                    nft_token_id: winner.nft_token_id
                })
        }
        
    } catch (error) {
        console.error('Ошибка обработки открытия кейса:', error)
        tg.showAlert('Произошла ошибка при обработке открытия кейса')
    }
}

// Показ модального окна NFT
function showNftModal(nftItem) {
    document.getElementById('nft-image').src = nftItem.image_url
    document.getElementById('nft-name').textContent = nftItem.name
    document.getElementById('nft-description').textContent = nftItem.description || 'Описание отсутствует'
    document.getElementById('nft-contract').textContent = nftItem.nft_contract_address || 'Не указан'
    document.getElementById('nft-token-id').textContent = nftItem.nft_token_id || 'Не указан'
    document.getElementById('nft-value').innerHTML = `<i class="fas fa-coins"></i> ${nftItem.value}`
    
    // Устанавливаем класс редкости
    const rarityElement = document.getElementById('nft-rarity')
    rarityElement.className = `rarity-${nftItem.rarity}`
    rarityElement.textContent = getRarityName(nftItem.rarity)
    
    nftModal.classList.add('active')
}

// Получение названия редкости
function getRarityName(rarity) {
    const names = {
        common: 'Обычный',
        uncommon: 'Необычный',
        rare: 'Редкий',
        epic: 'Эпический',
        legendary: 'Легендарный'
    }
    return names[rarity] || rarity
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', initApp)