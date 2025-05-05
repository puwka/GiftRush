import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { initData } = req.body;
    
    // Упрощенная валидация для теста
    const params = new URLSearchParams(initData);
    const userData = JSON.parse(params.get('user') || '{}');
    
    if (!userData.id) {
      return res.status(400).json({ error: 'Invalid Telegram data' });
    }

    // Сохранение/обновление пользователя
    const { data: user, error: userError } = await supabase
      .from('users')
      .upsert({
        tg_id: userData.id,
        username: [userData.first_name, userData.last_name].filter(Boolean).join(' '),
        avatar_url: userData.photo_url,
        last_login: new Date().toISOString()
      }, { onConflict: 'tg_id' })
      .select()
      .single();

    if (userError) throw userError;

    // Получение или создание баланса
    const { data: balance, error: balanceError } = await supabase
      .from('balances')
      .upsert({ 
        user_id: userData.id,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })
      .select('amount')
      .single();

    if (balanceError) throw balanceError;

    return res.status(200).json({
      user: {
        ...user,
        balance: balance?.amount || 0
      }
    });
    
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}