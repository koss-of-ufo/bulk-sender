const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const port = 3003; // Порт, на котором будет работать этот сервер

app.use(cors());
app.use(express.json());

// --- Конфигурация подключения к вашей БД (из скриншота) ---
const pool = new Pool({
    user: 'lvl3user',
    host: '10.2.201.114',
    database: 'lvl3db',
    password: 'ATomfrGqhhVvTqbLRy8ANuYoyLq5BU',
    port: 5000,
});

// Endpoint для запроса данных
app.post('/query-violations', async (req, res) => {
    const { numbers } = req.body;

    if (!Array.isArray(numbers) || numbers.length === 0) {
        return res.status(400).json({ error: 'Не переданы номера для поиска.' });
    }

    const queryText = `
        SELECT transaction_uuid, payment_dt, end_payment_date 
        FROM l3core_penalties.t_violations 
        WHERE post_n IN (${numbers.map((_, i) => `$${i + 1}`).join(',')})
    `;

    try {
        console.log('Выполняю запрос с номерами:', numbers);
        const result = await pool.query(queryText, numbers);
        console.log(`Найдено ${result.rows.length} записей.`);
        res.json(result.rows);
    } catch (err) {
        console.error('Ошибка выполнения запроса:', err);
        res.status(500).json({ error: 'Ошибка на сервере при выполнении запроса к БД.' });
    }
});

app.listen(port, () => {
    console.log(`Back-end сервер запущен на http://localhost:${port}`);
    console.log('Это окно НЕЛЬЗЯ закрывать, пока вы работаете со страницей.');
});