export class TelegramAuth {
    static async init() {
      if (!window.Telegram?.WebApp) {
        console.error('Telegram WebApp not available');
        return false;
      }
  
      const tg = window.Telegram.WebApp;
      tg.expand();
  
      if (tg.initDataUnsafe.user) {
        try {
          const response = await fetch('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData: tg.initData })
          });
  
          if (!response.ok) throw new Error('Auth failed');
  
          const { user, auth_token } = await response.json();
          localStorage.setItem('tg_auth', auth_token);
          return user;
        } catch (error) {
          console.error('Auth error:', error);
          return false;
        }
      }
      return false;
    }
  
    static async getCurrentUser() {
      const authToken = localStorage.getItem('tg_auth');
      if (!authToken) return null;
  
      try {
        const response = await fetch('/auth/me', {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        return await response.json();
      } catch (error) {
        console.error('Failed to fetch user:', error);
        return null;
      }
    }
  }