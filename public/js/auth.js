class TelegramAuth {
    static async init() {
      try {
        if (!window.Telegram?.WebApp) {
          console.warn('Telegram WebApp not available');
          return null;
        }
  
        const tg = window.Telegram.WebApp;
        tg.expand();
  
        const response = await fetch('/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            initData: tg.initData
          })
        });
  
        if (!response.ok) {
          const error = await response.text();
          throw new Error(`HTTP error: ${response.status} - ${error}`);
        }
  
        return await response.json();
      } catch (error) {
        console.error('Auth failed:', error);
        // Fallback для разработки
        if (process.env.NODE_ENV === 'development') {
          return {
            user: {
              id: 12345,
              username: 'Test User',
              avatar: 'https://via.placeholder.com/150'
            }
          };
        }
        return null;
      }
    }
  }