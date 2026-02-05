(function () {
            // DOM
            const csvFile = document.getElementById('csvFile');
            const textArea = document.getElementById('textArea');
            const sourceEl = document.getElementById('source');
            const btnPreview = document.getElementById('btnPreview');
            const btnSendOne = document.getElementById('btnSendOne');
            const btnSendAll = document.getElementById('btnSendAll');
            const btnStop = document.getElementById('btnStop');
            const btnDownloadErrors = document.getElementById('btnDownloadErrors');
            const btnDownloadReport = document.getElementById('btnDownloadReport');
            const previewBox = document.getElementById('previewBox');
            const logBox = document.getElementById('logBox');
            const totalEl = document.getElementById('total');
            const successEl = document.getElementById('success');
            const failEl = document.getElementById('fail');
            const progressEl = document.getElementById('progress');

            const urlEl = document.getElementById('url');
            const authEl = document.getElementById('auth');
            const methodEl = document.getElementById('method');
            const modeEl = document.getElementById('mode');
            const payTypeEl = document.getElementById('payType');
            const delayEl = document.getElementById('delay');
            const grnEl = document.getElementById('grn');
            const commentEl = document.getElementById('comment');
            const uuidColEl = document.getElementById('uuidCol');
            const fastExtractEl = document.getElementById('fastExtract');
            const autoDownloadErrorsEl = document.getElementById('autoDownloadErrors');
            const skipPreviewEl = document.getElementById('skipPreview');
            const useFirstColIfHeaderEl = document.getElementById('useFirstColIfHeader');

            const btnPause = document.getElementById('btnPause');

            function updateUrlByMode() {
                if (modeEl.value === 'pay_type') {
                    urlEl.value = 'http://10.2.201.200/api/ui/find-transactions/set_pay_type';
                } else {
                    urlEl.value = 'http://10.2.201.200/api/ui/find-transactions/set_grnz';
                }
            }

            modeEl.addEventListener('change', updateUrlByMode);
            updateUrlByMode();

            btnPause.addEventListener('click', () => {
                paused = !paused;
                btnPause.textContent = paused ? 'Resume' : 'Pause';
                appendLog(paused ? 'Пауза включена' : 'Пауза снята', 'info');
            });


            // State
            let parsedRows = []; // array of objects or simple {transaction_uuid: ...}
            let errors = [];
            let report = [];
            let running = false;
            let abortController = null;

            let paused = false;

            function sleep(ms) {
                return new Promise(res => setTimeout(res, ms));
            }

            async function waitWhilePaused() {
                while (paused && running) {
                    await sleep(200);
                }
            }

            // Logging
            function appendLog(text, type = 'info') {
                const el = document.createElement('div');
                el.className = 'line ' + (type === 'ok' ? 'ok' : type === 'err' ? 'err' : 'info');
                el.textContent = (new Date()).toLocaleTimeString() + ' → ' + text;
                logBox.prepend(el); // newest first
            }

            function setCounters() {
                totalEl.textContent = parsedRows.length;
                const succ = report.filter(r => r.ok).length;
                const fails = report.filter(r => !r.ok).length;
                successEl.textContent = succ;
                failEl.textContent = fails;
                progressEl.textContent = `${report.length}/${parsedRows.length}`;
            }

            // Utilities
            const uuidRegex = /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\b/;

            function extractUUIDsFromString(s) {
                // Find all UUID-like substrings
                const matches = s.match(new RegExp(uuidRegex, 'g'));
                if (matches && matches.length) return matches;
                // Otherwise, try to find tokens that look like single values (fallback)
                const tokens = s.split(/[\s,;]+/).map(t => t.trim()).filter(Boolean);
                // Filter tokens that look like uuid-ish (length 8+ but may be not full uuid)
                return tokens;
            }

            function parsePanText(text) {
                const lines = text.split(/\r?\n/);

                let currentPan = '';
                const rows = [];

                // UUID — как у тебя
                const uuidRe = new RegExp(uuidRegex, 'g');

                // Ловим PAN в формулировке: "Просьба сменить PAN на XXX UID" (UID может быть с двоеточием/без)
                // PAN допускаем латиницу/цифры и кириллицу/цифры
                const panLineRe = /(?:сменить|скорректировать)\s*PAN\s*на\s*([A-Z0-9А-ЯЁ]+)\b/i;

                for (const rawLine of lines) {
                    const line = rawLine.trim();
                    if (!line) continue;

                    // 1) Если строка объявляет новый PAN — переключаем currentPan
                    const panMatch = line.match(panLineRe);
                    if (panMatch) {
                        currentPan = cyrToLatPan(panMatch[1] || '');

                        // ✅ ВАЖНО: если UUID есть на этой же строке — тоже забираем
                        const uuidsSameLine = line.match(uuidRe) || [];
                        uuidsSameLine.forEach(u => {
                            if (currentPan) rows.push({ transaction_uuid: u, pan: currentPan });
                        });

                        continue;
                    }



                    // 2) Достаём UUID из текущей строки (может быть несколько)
                    const uuids = line.match(uuidRe) || [];
                    if (!uuids.length) continue;

                    // 3) Привязываем UUID к последнему найденному PAN
                    uuids.forEach(u => {
                        if (currentPan) {
                            rows.push({ transaction_uuid: u, pan: currentPan });
                        }
                    });
                }

                return rows;
            }


            function parseCSVTextGeneric(text) {
                // Split into lines, trim
                const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                if (lines.length === 0) return [];
                // Detect separators in header line
                const sep = detectSeparator(lines[0]);
                const headerCells = lines[0].split(sep).map(c => c.trim());
                const maybeHeader = headerCells.some(cell => /[A-Za-z_]/.test(cell) && !uuidRegex.test(cell));
                const result = [];
                if (maybeHeader) {
                    // parse as CSV with header
                    for (let i = 1; i < lines.length; i++) {
                        const cells = lines[i].split(sep).map(c => c.trim());
                        const obj = {};
                        headerCells.forEach((h, idx) => obj[h || `col${idx + 1}`] = (cells[idx] || '').trim());
                        result.push(obj);
                    }
                    return { rows: result, header: headerCells };
                } else {
                    // not header — treat as list of values or multi-column without header
                    // try to extract UUIDs per line
                    for (const ln of lines) {
                        const sep2 = detectSeparator(ln);
                        const parts = ln.split(sep2).map(p => p.trim()).filter(Boolean);
                        // if single token and it's a UUID or token, add object
                        if (parts.length === 1) {
                            result.push({ transaction_uuid: parts[0] });
                        } else {
                            // multiple columns — try to find UUID in row
                            let found = false;
                            for (const p of parts) {
                                if (uuidRegex.test(p)) {
                                    result.push({ transaction_uuid: p });
                                    found = true; break;
                                }
                            }
                            if (!found) {
                                // fallback: pick first column or join all
                                if (useFirstColIfHeaderEl.checked) result.push({ transaction_uuid: parts[0] });
                                else result.push({ transaction_uuid: parts.join(',') });
                            }
                        }
                    }
                    return { rows: result, header: null };
                }
            }

            function cyrToLatPan(pan) {
                if (!pan) return pan;

                const map = {
                    'А': 'A', 'В': 'B', 'С': 'C', 'Е': 'E', 'Н': 'H', 'К': 'K', 'М': 'M',
                    'О': 'O', 'Р': 'P', 'Т': 'T', 'Х': 'X', 'У': 'Y'
                };

                return pan
                    .toUpperCase()
                    .split('')
                    .map(ch => map[ch] || ch)
                    .join('');
            }


            function detectSeparator(line) {
                // Check for common separators
                if (line.indexOf(';') !== -1) return ';';
                if (line.indexOf(',') !== -1) return ',';
                if (line.indexOf('\t') !== -1) return '\t';
                return / +/; // fallback to whitespace regexp used in split
            }

            // Parse from selected source
            async function parseSource() {
                parsedRows = [];
                const src = sourceEl.value;
                if (src === 'file') {
                    const f = csvFile.files[0];
                    if (!f) { appendLog('Нет выбранного файла', 'err'); return; }
                    const text = await f.text();
                    if (modeEl.value === 'pan_change') {
                        parsedRows = parsePanText(text);
                    } else if (fastExtractEl.checked) {
                        const uuids = extractUUIDsFromString(text);
                        parsedRows = Array.from(new Set(uuids)).map(uuid => ({ transaction_uuid: uuid }));
                    } else {
                        const parsed = parseCSVTextGeneric(text);
                        parsedRows = parsed.rows;
                        // If header exists and user provided uuidCol, remap rows to ensure uuid in transaction_uuid
                        if (parsed.header && uuidColEl.value.trim()) {
                            const col = uuidColEl.value.trim();
                            parsedRows = parsedRows.map(r => ({ transaction_uuid: r[col] || r[Object.keys(r)[0]] || '' }));
                        } else if (parsed.header && !uuidColEl.value.trim()) {
                            // attempt auto-detect column with UUIDs
                            const colWithUuid = parsed.header.find(h => parsed.rows.some(r => uuidRegex.test(r[h])));
                            if (colWithUuid) {
                                parsedRows = parsedRows.map(r => ({ transaction_uuid: r[colWithUuid] || '' }));
                            } else {
                                // take first column
                                parsedRows = parsedRows.map(r => ({ transaction_uuid: r[Object.keys(r)[0]] || '' }));
                            }
                        }
                    }
                } else {
                    // textarea
                    const text = textArea.value.trim();
                    if (!text) { appendLog('Textarea пуст', 'err'); return; }
                    if (modeEl.value === 'pan_change') {
                        parsedRows = parsePanText(text);
                    } else if (fastExtractEl.checked) {
                        const uuids = extractUUIDsFromString(text);
                        parsedRows = Array.from(new Set(uuids)).map(uuid => ({ transaction_uuid: uuid }));
                    } else {
                        const parsed = parseCSVTextGeneric(text);
                        parsedRows = parsed.rows;
                        if (parsed.header && uuidColEl.value.trim()) {
                            const col = uuidColEl.value.trim();
                            parsedRows = parsedRows.map(r => ({ transaction_uuid: r[col] || r[Object.keys(r)[0]] || '' }));
                        } else if (parsed.header) {
                            const colWithUuid = parsed.header.find(h => parsed.rows.some(r => uuidRegex.test(r[h])));
                            if (colWithUuid) {
                                parsedRows = parsed.rows.map(r => ({ transaction_uuid: r[colWithUuid] || '' }));
                            } else {
                                parsedRows = parsed.rows.map(r => ({ transaction_uuid: r[Object.keys(r)[0]] || '' }));
                            }
                        }
                    }
                }

                // final cleaning: if rows contain objects with non-uuid values, try to extract uuid via regex
                parsedRows = parsedRows.map(r => {
                    const val = String(r.transaction_uuid || '').trim();
                    const found = val.match(uuidRegex);
                    if (found) return { transaction_uuid: found[0], pan: r.pan || '' };
                    // if not found but token-like (no spaces and not too long) keep as-is
                    const tokens = val.split(/[\s,;]+/).filter(Boolean);
                    if (tokens.length === 1) return { transaction_uuid: tokens[0], pan: r.pan || '' };
                    // fallback: try extract first token
                    return { transaction_uuid: tokens[0] || val, pan: r.pan || '' };
                });

                // remove empty
                parsedRows = parsedRows.filter(r => r.transaction_uuid && (modeEl.value !== 'pan_change' || r.pan));
                appendLog(`Парсинг завершён: ${parsedRows.length} UUID`, 'info');
                report = []; errors = [];
                setCounters();
            }

            // Build payload
            function buildPayloadForRow(row) {
                const uuid = row.transaction_uuid;
                if (modeEl.value === 'pay_type') {
                    return { transaction_uuid: uuid, pay_type: Number(payTypeEl.value) };
                } else if (modeEl.value === 'pan_change') {
                    return { transaction_uuid: uuid, grn: row.pan || '', comment: commentEl.value.trim() };
                } else {
                    return { transaction_uuid: uuid, grn: grnEl.value.trim(), comment: commentEl.value.trim() };
                }
            }

            // Preview first up to 10
            btnPreview.addEventListener('click', async () => {
                await parseSource();
                if (!parsedRows.length) return alert('Нет UUID после парсинга');
                const n = Math.min(10, parsedRows.length);
                const list = [];
                for (let i = 0; i < n; i++) list.push(buildPayloadForRow(parsedRows[i]));
                previewBox.textContent = JSON.stringify(list, null, 2);
                appendLog(`PREVIEW: показано ${n} записей`, 'info');
            });

            // low-level fetch with AbortController support
            async function doFetch(payload) {
                const endpoint = urlEl.value.trim();
                const method = methodEl.value || 'POST';
                const headers = { 'Content-Type': 'application/json;charset=UTF-8' };
                const token = authEl.value.trim();
                if (token) headers['Authorization'] = token;
                try {
                    const resp = await fetch(endpoint, {
                        method,
                        headers,
                        body: JSON.stringify(payload),
                        signal: abortController ? abortController.signal : undefined,
                        credentials: 'include'
                    });
                    let body;
                    try { body = await resp.clone().json(); } catch (e) { body = await resp.text(); }
                    return { ok: resp.ok, status: resp.status, body };
                } catch (err) {
                    if (err.name === 'AbortError') throw err;
                    return { ok: false, status: 'network', body: String(err) };
                }
            }

            // Send 1 (test)
            btnSendOne.addEventListener('click', async () => {
                await parseSource();
                if (!parsedRows.length) return alert('Нет UUID для отправки');
                const payload = buildPayloadForRow(parsedRows[0]);
                appendLog(`Отправляю тестовую: ${JSON.stringify(payload)}`, 'info');
                abortController = new AbortController();
                try {
                    const res = await doFetch(payload);
                    report.push({ index: 1, uuid: payload.transaction_uuid, ok: res.ok, status: res.status, body: res.body });
                    if (res.ok) appendLog(`OK ${res.status} ${payload.transaction_uuid} → ${typeof res.body === 'object' ? JSON.stringify(res.body) : res.body}`, 'ok');
                    else {
                        appendLog(`ERR ${res.status} ${payload.transaction_uuid} → ${typeof res.body === 'object' ? JSON.stringify(res.body) : res.body}`, 'err');
                        errors.push({ index: 1, uuid: payload.transaction_uuid, status: res.status, body: typeof res.body === 'object' ? JSON.stringify(res.body) : res.body });
                    }
                    setCounters();
                } catch (e) {
                    if (e.name === 'AbortError') appendLog('Тестовая отправка отменена', 'err');
                    else appendLog('Ошибка тестовой отправки: ' + e, 'err');
                } finally { abortController = null; }
            });

            // Stop
            btnStop.addEventListener('click', () => {
                running = false; // гарантированно остановить цикл

                if (abortController) abortController.abort();
                abortController = null; // <-- ДОБАВИЛИ

                appendLog('Процесс остановлен пользователем', 'err');

                btnStop.disabled = true;

                paused = false;
                btnPause.disabled = true;
                btnPause.textContent = 'Pause';
            });



            // Send All
            btnSendAll.addEventListener('click', async () => {
                await parseSource();
                if (!parsedRows.length) return alert('Нет UUID для отправки');
                if (running) return alert('Уже выполняется отправка');

                if (!skipPreviewEl.checked) {
                    const proceed = confirm('Сделать Preview (первые 10)? Нажмите Отмена чтобы продолжить без Preview.');
                    if (proceed) {
                        const list = parsedRows.slice(0, Math.min(10, parsedRows.length)).map(r => buildPayloadForRow(r));
                        previewBox.textContent = JSON.stringify(list, null, 2);
                        const ok = confirm('Просмотрен PREVIEW. Нажмите ОК для продолжения массовой отправки.');
                        if (!ok) { appendLog('Массовая отправка отменена после Preview', 'err'); return; }
                    }
                }

                running = true;
                abortController = new AbortController();

                btnPause.disabled = false;
                btnPause.textContent = 'Pause';
                paused = false;

                btnStop.disabled = false;

                errors = [];
                report = [];

                appendLog(`Начинаю массовую отправку ${parsedRows.length} записей, delay=${delayEl.value} ms`, 'info');

                const delayMs = Math.max(0, Number(delayEl.value) || 200);

                for (let i = 0; i < parsedRows.length; i++) {
                    if (!running) break;

                    // ✅ уважать ручную паузу
                    await waitWhilePaused();
                    if (!running) break;

                    const payload = buildPayloadForRow(parsedRows[i]);
                    appendLog(`#${i + 1} ${payload.transaction_uuid} → ${JSON.stringify(payload)}`, 'info');

                    try {
                        let res = await doFetch(payload);

                        // ✅ авто-пауза при throttling
                        if (res.status === 429) {
                            appendLog(`429 Too Many Requests. Автопауза на 90с...`, 'err');

                            // во время авто-паузы тоже уважаем ручной Pause
                            for (let t = 0; t < 90; t++) {
                                if (!running) break;
                                await waitWhilePaused();
                                await sleep(1000);
                            }
                            if (!running) break;

                            appendLog(`Повтор запроса после автопаузы: ${payload.transaction_uuid}`, 'info');
                            res = await doFetch(payload);
                        }

                        report.push({
                            index: i + 1,
                            uuid: payload.transaction_uuid,
                            ok: res.ok,
                            status: res.status,
                            body: typeof res.body === 'object' ? JSON.stringify(res.body) : res.body
                        });

                        if (res.ok) {
                            appendLog(`OK ${res.status} ${payload.transaction_uuid}`, 'ok');
                        } else {
                            appendLog(`ERR ${res.status} ${payload.transaction_uuid} → ${typeof res.body === 'object' ? JSON.stringify(res.body) : res.body}`, 'err');
                            errors.push({
                                index: i + 1,
                                uuid: payload.transaction_uuid,
                                status: res.status,
                                body: typeof res.body === 'object' ? JSON.stringify(res.body) : res.body
                            });
                        }
                    } catch (e) {
                        if (e.name === 'AbortError') {
                            appendLog(`Отмена (Abort) на ${payload.transaction_uuid}`, 'err');
                            report.push({ index: i + 1, uuid: payload.transaction_uuid, ok: false, status: 'aborted', body: 'aborted' });
                            errors.push({ index: i + 1, uuid: payload.transaction_uuid, status: 'aborted', body: 'aborted' });
                            break;
                        } else {
                            appendLog(`NETWORK ERROR ${payload.transaction_uuid} → ${e}`, 'err');
                            report.push({ index: i + 1, uuid: payload.transaction_uuid, ok: false, status: 'network', body: String(e) });
                            errors.push({ index: i + 1, uuid: payload.transaction_uuid, status: 'network', body: String(e) });
                        }
                    }

                    setCounters();

                    // ✅ задержка между запросами (и тут тоже уважаем Pause)
                    if (i < parsedRows.length - 1) {
                        let left = delayMs;
                        while (left > 0 && running) {
                            await waitWhilePaused();
                            const step = Math.min(200, left);
                            await sleep(step);
                            left -= step;
                        }
                    }

                }

                running = false;
                abortController = null;

                btnStop.disabled = true;

                btnPause.disabled = true;
                btnPause.textContent = 'Pause';
                paused = false;

                appendLog(`Массовая отправка завершена. Ошибок: ${errors.length}`, 'info');

                if (autoDownloadErrorsEl.checked && errors.length) downloadErrors();
            });


            // Download errors
            function downloadErrors() {
                if (!errors.length) { appendLog('Нет ошибок для скачивания', 'info'); return; }
                const header = ['index', 'uuid', 'status', 'body'];
                const rowsCsv = [header.join(',')];
                errors.forEach(e => {
                    const safe = v => `"${String(v || '').replace(/"/g, '""')}"`;
                    rowsCsv.push([e.index, safe(e.uuid), safe(e.status), safe(e.body)].join(','));
                });
                const blob = new Blob([rowsCsv.join('\n')], { type: 'text/csv;charset=utf-8;' });
                const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'errors.csv'; document.body.appendChild(a); a.click(); a.remove();
                appendLog('errors.csv скачан', 'info');
            }
            btnDownloadErrors.addEventListener('click', downloadErrors);

            // Download report
            function downloadReport() {
                if (!report.length) { appendLog('Нет отчёта для скачивания', 'info'); return; }
                const header = ['index', 'uuid', 'ok', 'status', 'body'];
                const rowsCsv = [header.join(',')];
                report.forEach(r => {
                    const safe = v => `"${String(v || '').replace(/"/g, '""')}"`;
                    rowsCsv.push([r.index, safe(r.uuid), r.ok ? '1' : '0', safe(r.status), safe(r.body)].join(','));
                });
                const blob = new Blob([rowsCsv.join('\n')], { type: 'text/csv;charset=utf-8;' });
                const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'report.csv'; document.body.appendChild(a); a.click(); a.remove();
                appendLog('report.csv скачан', 'info');
            }
            btnDownloadReport.addEventListener('click', downloadReport);

            // Parse file on change (quick parse for count)
            csvFile.addEventListener('change', async () => {
                // Quick parse just to show count without full parsing
                const f = csvFile.files[0];
                if (!f) return;
                const text = await f.text();
                let count = 0;
                if (modeEl.value === 'pan_change') {
                    count = parsePanText(text).length;
                } else if (fastExtractEl.checked) {
                    count = extractUUIDsFromString(text).length;
                } else {
                    const parsed = parseCSVTextGeneric(text);
                    // attempt to count extracted uuids
                    if (parsed.rows) count = parsed.rows.length;
                }
                appendLog(`Файл выбран. Примерно строк: ${count}`, 'info');
                // reset counters etc.
                parsedRows = []; report = []; errors = [];
                setCounters();
            });

            window.addEventListener('parsed-uuids-ready', (event) => {
                const uuids = Array.isArray(event.detail?.uuids) ? event.detail.uuids : [];
                if (!uuids.length) {
                    appendLog('Из парсера не пришли UUID', 'err');
                    return;
                }
                sourceEl.value = 'textarea';
                textArea.value = uuids.join('\n');
                appendLog(`UUID из парсера подставлены в textarea: ${uuids.length}`, 'ok');
            });

            // Initial hint
            appendLog('Инструмент готов. Выберите источник UUID (файл или поле), нажмите Preview, затем Send 1 и потом Send All.', 'info');
        })();

        
