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

// Обработчики кнопок
function setupEventListeners() {
  // Кнопки открытия кейсов
  document.querySelectorAll('.open-btn').forEach(btn => {
	btn.addEventListener('click', async function() {
	  const caseType = this.closest('.case-item').classList.contains('premium') ? 'premium' : 'regular'
	  const cost = caseType === 'premium' ? 500 : 100
	  
	  try {
		// Проверяем баланс
		const { data: user, error: userError } = await supabase
		  .from('users')
		  .select('balance')
		  .eq('tg_id', tg.initDataUnsafe.user.id)
		  .single()
		
		if (userError) throw userError
		
		if (user.balance < cost) {
		  alert('Недостаточно средств на балансе')
		  return
		}
		
		// Открываем кейс (симуляция)
		const prizeValue = calculatePrize(caseType)
		const prizeDescription = getPrizeDescription(prizeValue, caseType)
		
		// Обновляем баланс
		const { error: balanceError } = await supabase
		  .from('users')
		  .update({ balance: user.balance - cost + prizeValue })
		  .eq('tg_id', tg.initDataUnsafe.user.id)
		
		if (balanceError) throw balanceError
		
		// Записываем транзакцию
		await supabase
		  .from('transactions')
		  .insert({
			user_id: tg.initDataUnsafe.user.id,
			amount: -cost,
			type: 'case_open',
			description: `Открытие ${caseType === 'premium' ? 'премиум' : 'обычного'} кейса`
		  })
		
		// Если выигрыш > 0, добавляем запись о выигрыше
		if (prizeValue > 0) {
		  await supabase
			.from('transactions')
			.insert({
			  user_id: tg.initDataUnsafe.user.id,
			  amount: prizeValue,
			  type: 'prize',
			  description: prizeDescription
			})
		}
		
		// Записываем открытие кейса
		await supabase
		  .from('opened_cases')
		  .insert({
			user_id: tg.initDataUnsafe.user.id,
			case_type: caseType,
			prize_value: prizeValue,
			prize_description: prizeDescription
		  })
		
		// Обновляем UI
		userBalance.textContent = user.balance - cost + prizeValue
		statBalance.textContent = user.balance - cost + prizeValue
		
		// Показываем результат
		alert(`Вы открыли кейс и получили: ${prizeDescription}`)
		
		// Перезагружаем статистику
		await loadUserStats(tg.initDataUnsafe.user.id)
	  } catch (error) {
		console.error('Ошибка открытия кейса:', error)
		alert('Произошла ошибка при открытии кейса')
	  }
	})
  })
  
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

// Вспомогательные функции для кейсов
function calculatePrize(caseType) {
  // Логика расчета приза
  if (caseType === 'premium') {
	const rand = Math.random()
	if (rand < 0.6) return 200 // 60% chance
	if (rand < 0.85) return 500 // 25% chance
	if (rand < 0.95) return 1000 // 10% chance
	return 5000 // 5% chance
  } else {
	const rand = Math.random()
	if (rand < 0.7) return 50 // 70% chance
	if (rand < 0.9) return 100 // 20% chance
	return 500 // 10% chance
  }
}

function getPrizeDescription(value, caseType) {
  if (value <= 100) return `${value} монет`
  if (value <= 500) return `Хороший приз: ${value} монет`
  if (value <= 1000) return `Отличный приз: ${value} монет`
  return `Джекпот! ${value} монет`
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
  initApp()
  setupEventListeners()
  
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
	if (e.target.closest('.case-item')) {
		const caseId = e.target.closest('.case-item').dataset.caseId;
		if (caseId) {
			openCase(caseId);
		}
	}
});
})