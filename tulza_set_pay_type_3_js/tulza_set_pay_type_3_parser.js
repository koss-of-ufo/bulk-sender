const input = document.getElementById('inputText');
    const result = document.getElementById('result');

    // Elements for Numbers
    const output = document.getElementById('outputText');
    const sqlOutput = document.getElementById('sqlOutput');
    const numCsvOutput = document.getElementById('numCsvOutput');
    const cardNumMain = document.getElementById('cardNumMain');
    const cardNumSql = document.getElementById('cardNumSql');
    const cardNumCsv = document.getElementById('cardNumCsv');
    const mainCount = document.getElementById('mainCount');
    const sqlCount = document.getElementById('sqlCount');
    const numCsvCount = document.getElementById('numCsvCount');

    // Elements for UUIDs
    const uuidOutput = document.getElementById('uuidOutput');
    const uuidSqlOutput = document.getElementById('uuidSqlOutput');
    const uuidCsvOutput = document.getElementById('uuidCsvOutput');
    const cardUuidMain = document.getElementById('cardUuidMain');
    const cardUuidSql = document.getElementById('cardUuidSql');
    const cardUuidCsv = document.getElementById('cardUuidCsv');
    const uuidMainCount = document.getElementById('uuidMainCount');
    const uuidSqlCount = document.getElementById('uuidSqlCount');
    const uuidCsvCount = document.getElementById('uuidCsvCount');

    // Elements for GRZ (ГРНЗ)
    const grzOutput = document.getElementById('grzOutput');
    const grzSqlOutput = document.getElementById('grzSqlOutput');
    const grzCsvOutput = document.getElementById('grzCsvOutput');
    const cardGrzMain = document.getElementById('cardGrzMain');
    const cardGrzSql = document.getElementById('cardGrzSql');
    const cardGrzCsv = document.getElementById('cardGrzCsv');
    const grzMainCount = document.getElementById('grzMainCount');
    const grzSqlCount = document.getElementById('grzSqlCount');
    const grzCsvCount = document.getElementById('grzCsvCount');

    // DB Elements
    const queryDbBtn = document.getElementById('queryDbBtn');
    const dbResultsContainer = document.getElementById('dbResultsContainer');
    const dbResultsOutput = document.getElementById('dbResultsOutput');
    const btnUseParsedUuids = document.getElementById('btnUseParsedUuids');

    const status = document.getElementById('status');
    const debug = document.getElementById('debug');

    let currentNumbers = [];
    let currentUUIDs = [];
    let currentGRZ = [];

    const cyrillicToLatinMap = { 'А': 'A', 'В': 'B', 'Е': 'E', 'К': 'K', 'М': 'M', 'Н': 'H', 'О': 'O', 'Р': 'P', 'С': 'C', 'Т': 'T', 'У': 'Y', 'Х': 'X', 'а': 'A', 'в': 'B', 'е': 'E', 'к': 'K', 'м': 'M', 'н': 'H', 'о': 'O', 'р': 'P', 'с': 'C', 'т': 'T', 'у': 'Y', 'х': 'X' };

    function convertCyrillicToLatin(text) {
        let result = '';
        for (let char of text) { result += cyrillicToLatinMap[char] || char; }
        return result.toUpperCase();
    }

    function extractNumbers(text) {
        const patterns = [/(\b\d{5}\s+\d{5}\s+\d{5}\s+\d{5}\s+\d{5,}\b)/gi, /(\b\d{20,}\b)/g];
        let allMatches = [];
        patterns.forEach(p => { allMatches.push(...(text.match(p) || [])); });
        return [...new Set(allMatches)].map(n => n.replace(/\s+/g, '')).filter(n => n.length >= 20 && /^\d+$/.test(n));
    }

    function extractUUIDs(text) {
        const matches = text.match(/\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/gi) || [];
        return [...new Set(matches.map(u => u.toLowerCase()))];
    }

    function extractGRZ(text) {
        const grzPatterns = [/[АВЕКМНОРСТУХABEKMHOPCTYX]\s*\d{3}\s*[АВЕКМНОРСТУХABEKMHOPCTYX]{2}\s*\d{2,3}/gi];
        let foundGRZ = [];
        grzPatterns.forEach(p => { foundGRZ.push(...(text.match(p) || [])); });
        return [...new Set(foundGRZ.map(g => convertCyrillicToLatin(g).replace(/\s+/g, '')))];
    }

    function updateResult() {
        const text = input.value.trim();
        currentNumbers = extractNumbers(text);
        currentUUIDs = extractUUIDs(text);
        currentGRZ = extractGRZ(text);

        const hasNumbers = currentNumbers.length > 0;
        const hasUUIDs = currentUUIDs.length > 0;
        const hasGRZ = currentGRZ.length > 0;

        if (hasNumbers || hasUUIDs || hasGRZ) {
            result.style.display = 'block';
            status.className = 'status success';
            let parts = [];

            // Numbers
            cardNumMain.style.display = hasNumbers ? 'block' : 'none';
            cardNumSql.style.display = hasNumbers ? 'block' : 'none';
            cardNumCsv.style.display = hasNumbers ? 'block' : 'none';
            if(hasNumbers) {
                output.textContent = currentNumbers[0];
                sqlOutput.textContent = `in ('${currentNumbers.join("','")}')`;
                numCsvOutput.textContent = currentNumbers.join(', ');
                mainCount.textContent = `1/${currentNumbers.length}`;
                sqlCount.textContent = `${currentNumbers.length}`;
                numCsvCount.textContent = `${currentNumbers.length}`;
                parts.push(`${currentNumbers.length} постановл.`);
            }

            // UUIDs
            cardUuidMain.style.display = hasUUIDs ? 'block' : 'none';
            cardUuidSql.style.display = hasUUIDs ? 'block' : 'none';
            cardUuidCsv.style.display = hasUUIDs ? 'block' : 'none';
            if(hasUUIDs) {
                uuidOutput.textContent = currentUUIDs[0];
                uuidSqlOutput.textContent = `in ('${currentUUIDs.join("','")}')`;
                uuidCsvOutput.textContent = currentUUIDs.join(', ');
                uuidMainCount.textContent = `1/${currentUUIDs.length}`;
                uuidSqlCount.textContent = `${currentUUIDs.length}`;
                uuidCsvCount.textContent = `${currentUUIDs.length}`;
                parts.push(`${currentUUIDs.length} UUID`);
            }

            // GRZ
            cardGrzMain.style.display = hasGRZ ? 'block' : 'none';
            cardGrzSql.style.display = hasGRZ ? 'block' : 'none';
            cardGrzCsv.style.display = hasGRZ ? 'block' : 'none';
            if(hasGRZ) {
                grzOutput.textContent = currentGRZ[0];
                grzSqlOutput.textContent = `in ('${currentGRZ.join("','")}')`;
                grzCsvOutput.textContent = currentGRZ.join(', ');
                grzMainCount.textContent = `1/${currentGRZ.length}`;
                grzSqlCount.textContent = `${currentGRZ.length}`;
                grzCsvCount.textContent = `${currentGRZ.length}`;
                parts.push(`${currentGRZ.length} ГРНЗ`);
            }

            status.textContent = `✅ Найдено: ${parts.join(', ')}`;
            debug.innerHTML = `Текст: ${text.length} | Пост: ${currentNumbers.length} | UUID: ${currentUUIDs.length} | ГРНЗ: ${currentGRZ.length}`;

        } else {
            result.style.display = 'block';
            status.textContent = '❌ Данные не найдены';
            status.className = 'status error';
            document.querySelectorAll('.result-card').forEach(c => c.style.display = 'none');
            debug.textContent = '';
        }

        queryDbBtn.style.display = hasNumbers ? 'block' : 'none';
        dbResultsContainer.style.display = 'none';
    }

    async function queryDatabase() {
        if (currentNumbers.length === 0) return;
        dbResultsContainer.style.display = 'block';
        dbResultsOutput.innerHTML = '<p>Загрузка...</p>';
        const backendUrl = 'http://192.168.11.90:3003/query-violations';
        try {
            const response = await fetch(backendUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ numbers: currentNumbers }),
            });
            if (!response.ok) throw new Error(`Ошибка сети: ${response.statusText}`);
            const data = await response.json();
            displayDbResults(data);
        } catch (error) {
            dbResultsOutput.innerHTML = `<p style="color: red;">Ошибка: ${error.message}. Убедитесь, что back-end сервер запущен.</p>`;
        }
    }

    function displayDbResults(data) {
        if (data.length === 0) {
            dbResultsOutput.innerHTML = '<p>По указанным номерам в базе данных ничего не найдено.</p>';
            return;
        }
        let table = '<table class="db-results-table"><thead><tr>';
        const headers = Object.keys(data[0]);
        headers.forEach(h => { table += `<th>${h}</th>`; });
        table += '</tr></thead><tbody>';
        data.forEach(row => {
            table += '<tr>';
            headers.forEach(h => { table += `<td>${row[h] !== null ? row[h] : 'NULL'}</td>`; });
            table += '</tr>';
        });
        table += '</tbody></table>';
        dbResultsOutput.innerHTML = table;
    }

function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text);
    } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.focus(); textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        return Promise.resolve();
    }
}

function showCopied(element) {
    const original = element.innerHTML;
    const originalBg = element.style.background;
    element.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%">✅ СКОПИРОВАНО!</div>';
    element.style.background = '#d4edda';
    setTimeout(() => {
        element.innerHTML = original;
        element.style.background = originalBg;
    }, 1200);
}

// --- Copy: Numbers ---
window.copyNumber = function() {
    if(currentNumbers.length) copyToClipboard(currentNumbers[0]).then(() => showCopied(output));
};
window.copySQL = function() {
    if(currentNumbers.length) {
        const text = "in (" + currentNumbers.map(num => `'${num}'`).join(',') + ")";
        copyToClipboard(text).then(() => showCopied(sqlOutput));
    }
};
window.copyNumCsv = function() {
    if(currentNumbers.length) copyToClipboard(currentNumbers.join(', ')).then(() => showCopied(numCsvOutput));
};

// --- Copy: UUID ---
window.copyUUIDMain = function() {
    if(currentUUIDs.length) copyToClipboard(currentUUIDs[0]).then(() => showCopied(uuidOutput));
};
window.copyUUIDSQL = function() {
    if(currentUUIDs.length) {
        const text = "in (" + currentUUIDs.map(uid => `'${uid}'`).join(',') + ")";
        copyToClipboard(text).then(() => showCopied(uuidSqlOutput));
    }
};
window.copyUUIDCsv = function() {
    if(currentUUIDs.length) copyToClipboard(currentUUIDs.join(', ')).then(() => showCopied(uuidCsvOutput));
};

// --- Copy: GRZ ---
window.copyGrzMain = function() {
    if(currentGRZ.length) copyToClipboard(currentGRZ[0]).then(() => showCopied(grzOutput));
};
window.copyGrzSQL = function() {
    if(currentGRZ.length) {
        const text = "in (" + currentGRZ.map(g => `'${g}'`).join(',') + ")";
        copyToClipboard(text).then(() => showCopied(grzSqlOutput));
    }
};
window.copyGrzCsv = function() {
    if(currentGRZ.length) copyToClipboard(currentGRZ.join(', ')).then(() => showCopied(grzCsvOutput));
};

input.addEventListener('paste', updateResult);
input.addEventListener('keypress', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        // Приоритет копирования по Enter: Постановления -> UUID -> ГРНЗ
        if (currentNumbers.length > 0) copyNumber();
        else if (currentUUIDs.length > 0) copyUUIDMain();
        else if (currentGRZ.length > 0) copyGrzMain();
    }
});

    btnUseParsedUuids.addEventListener('click', () => {
        if (!currentUUIDs.length) return;
        window.dispatchEvent(new CustomEvent('parsed-uuids-ready', { detail: { uuids: currentUUIDs } }));
    });

    input.addEventListener('input', updateResult);
    queryDbBtn.addEventListener('click', queryDatabase);
    updateResult();
