import { createClient } from 'https://esm.sh/@supabase/supabase-js'

const supabaseUrl = 'YOUR_SUPABASE_URL'
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY'
const supabase = createClient(supabaseUrl, supabaseKey)

const tg = window.Telegram.WebApp
const openCaseBtn = document.getElementById('open-case-btn')

// Инициализация
document.addEventListener('DOMContentLoaded', async () => {
    if (!tg.initDataUnsafe.user) {
        openCaseBtn.disabled = true
        openCaseBtn.textContent = 'Требуется авторизация'
        return
    }

    openCaseBtn.addEventListener('click', openCase)
})

async function openCase() {
    try {
        // 1. Проверяем баланс пользователя
        const userId = tg.initDataUnsafe.user.id
        const casePrice = 100 // Здесь должна быть цена текущего кейса
        
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('balance')
            .eq('tg_id', userId)
            .single()
        
        if (userError) throw userError
        
        if (user.balance < casePrice) {
            tg.showAlert('Недостаточно средств на балансе')
            return
        }
        
        // 2. Выбираем случайный приз (в реальном приложении это должно быть из БД)
        const prize = selectRandomPrize()
        
        // 3. Обновляем баланс пользователя
        const { error: balanceError } = await supabase
            .from('users')
            .update({ balance: user.balance - casePrice + prize.value })
            .eq('tg_id', userId)
        
        if (balanceError) throw balanceError
        
        // 4. Записываем транзакцию
        const { error: transactionError } = await supabase
            .from('transactions')
            .insert({
                user_id: userId,
                amount: -casePrice,
                type: 'case_open',
                description: `Открытие кейса "Игровой кейс #1"`
            })
        
        if (transactionError) throw transactionError
        
        // 5. Если выигрыш > 0, добавляем запись о выигрыше
        if (prize.value > 0) {
            const { error: prizeError } = await supabase
                .from('transactions')
                .insert({
                    user_id: userId,
                    amount: prize.value,
                    type: 'prize',
                    description: `Выигрыш: ${prize.name}`
                })
            
            if (prizeError) throw prizeError
        }
        
        // 6. Записываем открытие кейса
        const { error: caseError } = await supabase
            .from('opened_cases')
            .insert({
                user_id: userId,
                case_id: 1, // ID кейса из БД
                case_type: 'regular',
                prize_value: prize.value,
                prize_description: prize.name,
                item_id: prize.id // если есть в БД
            })
        
        if (caseError) throw caseError
        
        // 7. Показываем результат пользователю
        showPrizeModal(prize)
        
    } catch (error) {
        console.error('Ошибка открытия кейса:', error)
        tg.showAlert('Произошла ошибка при открытии кейса')
    }
}

function selectRandomPrize() {
    // В реальном приложении это должно браться из БД
    const prizes = [
        { id: 1, name: 'AWP | Красный линий', value: 500, rarity: 'rare' },
        { id: 2, name: 'AK-47 | Красный', value: 200, rarity: 'uncommon' },
        { id: 3, name: 'Нож | Фиолетовый', value: 1000, rarity: 'epic' },
        { id: 4, name: 'Перчатки | Золотые', value: 1500, rarity: 'legendary' },
        { id: 5, name: 'Ключ от кейса', value: 100, rarity: 'common' },
        { id: 6, name: '50 монет', value: 50, rarity: 'common' }
    ]
    
    // Простые вероятности (в реальном приложении должно быть сложнее)
    const rand = Math.random()
    if (rand < 0.5) return prizes[5] // 50% - 50 монет
    if (rand < 0.75) return prizes[4] // 25% - ключ
    if (rand < 0.9) return prizes[1] // 15% - AK-47
    if (rand < 0.98) return prizes[0] // 8% - AWP
    if (rand < 0.995) return prizes[2] // 1.5% - нож
    return prizes[3] // 0.5% - перчатки
}

function showPrizeModal(prize) {
    tg.showPopup({
        title: 'Поздравляем!',
        message: `Вы выиграли: ${prize.name} (${prize.value} монет)`,
        buttons: [
            { id: 'ok', type: 'default', text: 'Отлично!' }
        ]
    }, function(btnId) {
        // Обновляем интерфейс после закрытия попапа
        window.location.reload()
    })
}