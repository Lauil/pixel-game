const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

// Подключаем базу данных (создаст файл game.db)
const db = new Database('game.db');

// Инициализация таблиц
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  );
  CREATE TABLE IF NOT EXISTS pixels (
    x INTEGER,
    y INTEGER,
    color TEXT,
    PRIMARY KEY (x, y)
  );
`);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- API Авторизации ---
app.post('/api/auth', (express.json()), (req, res) => {
    const { username, password, action } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Заполните все поля' });

    if (action === 'register') {
        try {
            const hashedPassword = bcrypt.hashSync(password, 10);
            const insert = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)');
            insert.run(username, hashedPassword);
            return res.json({ success: true, message: 'Успешная регистрация!' });
        } catch (err) {
            return res.status(400).json({ error: 'Пользователь уже существует' });
        }
    }

    if (action === 'login') {
        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(400).json({ error: 'Неверное имя или пароль' });
        }
        return res.json({ success: true, username: user.username });
    }
});

// --- WebSockets (Игра в реальном времени) ---
io.on('connection', (socket) => {
    // 1. При подключении отправляем игроку текущее состояние холста
    const allPixels = db.prepare('SELECT * FROM pixels').all();
    socket.emit('init_canvas', allPixels);

    // 2. Ловим клик по пикселю
    socket.on('paint', (data) => {
        const { x, y, color, username } = data;
        if (!username) return; // Защита от неавторизованных

        // Валидация координат (сетка 50х50)
        if (x < 0 || x >= 50 || y < 0 || y >= 50) return;

        // Сохраняем в БД (если пиксель был, он обновится благодаря REPLACE)
        const upsert = db.prepare('INSERT OR REPLACE INTO pixels (x, y, color) VALUES (?, ?, ?)');
        upsert.run(x, y, color);

        // Рассылаем этот пиксель ВСЕМ игрокам
        io.emit('pixel_updated', { x, y, color });
    });
});

server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});