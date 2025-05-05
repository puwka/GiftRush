import express from 'express';
import supabase from './supabase.js';
import authRouter from './auth.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Роуты
app.use('/auth', authRouter);

// Защищенный эндпоинт
app.get('/auth/me', async (req, res) => {
  const authToken = req.headers.authorization?.split(' ')[1];
  
  if (!authToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Здесь должна быть проверка токена в БД
  res.json({ user: req.user });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});