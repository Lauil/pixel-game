let socket;
let currentUsername = '';
const CELL_SIZE = 10; // 50 пикселей * 10 = 500px размер Canvas

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const colorPicker = document.getElementById('color-picker');

// Функция авторизации
async function auth(action) {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('auth-error');

    const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, action })
    });
    const data = await res.json();

    if (!res.ok) {
        errorEl.innerText = data.error;
    } else {
        if (action === 'register') {
            alert(data.message + ' Теперь войдите.');
        } else {
            currentUsername = data.username;
            initGame();
        }
    }
}

// Запуск игры после входа
function initGame() {
    document.getElementById('auth-block').classList.add('hidden');
    document.getElementById('game-block').classList.remove('hidden');
    document.getElementById('user-display').innerText = currentUsername;

    // Подключаем WebSocket
    socket = io();

    // Получаем весь холст при входе
    socket.on('init_canvas', (pixels) => {
        // Очищаем белым цветом
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Рисуем сохраненные пиксели
        pixels.forEach(p => drawPixel(p.x, p.y, p.color));
    });

    // Слушаем обновления от других игроков
    socket.on('pixel_updated', (p) => {
        drawPixel(p.x, p.y, p.color);
    });
}

// Отрисовка пикселя на холсте
function drawPixel(x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
}

// Клик по Canvas
canvas.addEventListener('click', (e) => {
    if (!socket) return;

    // Высчитываем реальные координаты на сетке 50х50
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const x = Math.floor(clickX / CELL_SIZE);
    const y = Math.floor(clickY / CELL_SIZE);
    const color = colorPicker.value;

    // Отправляем на сервер
    socket.emit('paint', { x, y, color, username: currentUsername });
});