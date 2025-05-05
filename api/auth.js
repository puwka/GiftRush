import express from 'express';
import { supabase } from '../supabase.js';
import crypto from 'crypto';

const router = express.Router();

// Валидация данных Telegram WebApp
function validateTelegramData(token, initData) {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  params.delete('hash');
  
  const secret = crypto.createHash('sha256')
    .update(token)
    .digest();
  
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  
  const computedHash = crypto.createHmac('sha256', secret)
    .update(dataCheckString)
    .digest('hex');
    
  return computedHash === hash;
}

// Авторизация пользователя
router.post('/login', async (req, res) => {
  const { initData } = req.body;
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

  if (!validateTelegramData(BOT_TOKEN, initData)) {
    return res.status(401).json({ error: 'Invalid Telegram data' });
  }

  const params = new URLSearchParams(initData);
  const userData = JSON.parse(params.get('user'));

  try {
    // Сохранение/обновление пользователя
    const { data: user, error } = await supabase
      .from('users')
      .upsert({
        tg_id: userData.id,
        username: [userData.first_name, userData.last_name].filter(Boolean).join(' '),
        avatar_url: userData.photo_url,
        last_login: new Date()
      }, { onConflict: 'tg_id' })
      .select()
      .single();

    if (error) throw error;

    // Получение баланса
    const { data: balance } = await supabase
      .from('balances')
      .select('amount')
      .eq('user_id', userData.id)
      .single();

    res.json({
      user: {
        ...user,
        balance: balance?.amount || 0
      },
      auth_token: generateAuthToken(userData.id)
    });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

function generateAuthToken(tgId) {
  return crypto.randomBytes(32).toString('hex');
}

export default router;