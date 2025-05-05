import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
)

export default async (req, res) => {
  // Разрешаем только POST-запросы
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }

  try {
    const { initData } = req.body
    
    // Проверка наличия данных
    if (!initData) {
      return res.status(400).json({ error: 'initData is required' })
    }

    // Парсим данные Telegram
    const params = new URLSearchParams(initData)
    const tgUser = JSON.parse(params.get('user'))

    // Сохраняем в Supabase
    const { data: user, error } = await supabase
      .from('users')
      .upsert({
        tg_id: tgUser.id,
        username: tgUser.username,
        first_name: tgUser.first_name,
        last_name: tgUser.last_name,
        last_login: new Date()
      }, { onConflict: 'tg_id' })
      .select()
      .single()

    if (error) throw error

    // Успешный ответ
    res.status(200).json({
      user: {
        id: user.id,
        balance: user.balance || 0
      }
    })

  } catch (error) {
    console.error('Auth error:', error)
    res.status(500).json({ error: error.message })
  }
}