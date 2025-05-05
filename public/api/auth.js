import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async (req, res) => {
  console.log('API Request received'); // Логирование
  
  // Настройки CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const { initData } = req.body;
    console.log('Received initData:', initData); // Логирование

    if (!initData) {
      return res.status(400).json({ error: 'initData is required' });
    }

    const params = new URLSearchParams(initData);
    const tgUser = JSON.parse(params.get('user'));
    console.log('Telegram user:', tgUser); // Логирование

    const { data: user, error } = await supabase
      .from('users')
      .upsert({
        tg_id: tgUser.id,
        username: tgUser.username,
        first_name: tgUser.first_name,
        last_name: tgUser.last_name,
        photo_url: `https://t.me/i/userpic/160/${tgUser.username}.jpg`,
        last_login: new Date().toISOString()
      }, { onConflict: 'tg_id' })
      .select('*')
      .single();

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    console.log('User data from Supabase:', user); // Логирование
    
    res.status(200).json({
      user: {
        id: user.id,
        tg_id: user.tg_id,
        username: user.username,
        balance: user.balance || 1000,
        photo_url: user.photo_url
      }
    });
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: error.message });
  }
};