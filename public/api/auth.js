import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { initData } = req.body
  
  try {
    const tgUser = parseTelegramInitData(initData)
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

    res.status(200).json({ 
      user: {
        id: user.id,
        balance: user.balance
      }
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

function parseTelegramInitData(initData) {
  const params = new URLSearchParams(initData)
  return JSON.parse(params.get('user'))
}