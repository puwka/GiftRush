import express from 'express';
import { supabase } from '../supabase.js';
import crypto from 'crypto';

const router = express.Router();

// Middleware для логирования
router.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Упрощенная валидация данных Telegram (для теста)
function validateTelegramData(initData) {
  try {
    return !!new URLSearchParams(initData).get('user');
  } catch {
    return false;
  }
}

router.post('/login', async (req, res) => {
  try {
    const { initData } = req.body;
    
    if (!initData || !validateTelegramData(initData)) {
      console.error('Invalid initData:', initData);
      return res.status(400).json({ error: 'Invalid Telegram data' });
    }

    const params = new URLSearchParams(initData);
    const userData = JSON.parse(params.get('user'));

    // Упрощенное сохранение пользователя
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

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    res.json({ 
      success: true,
      user: {
        id: user.tg_id,
        username: user.username,
        avatar: user.avatar_url
      }
    });
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

export default router;