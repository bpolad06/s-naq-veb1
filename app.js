// Bulud Texnologiyaları Sınaq Tətbiqi (Tam Statik & Offline)

(function () {
  'use strict';

  // Mövzu adları xəritəsi
  const TOPIC_NAMES = {
    1: 'Mövzu 1: Bulud Əsasları və Konteynerlər',
    2: 'Mövzu 2: Şəbəkə, Təhlükəsizlik və Virtualizasiya',
    3: 'Mövzu 3: Bulud Xidmət Modelləri (IaaS, PaaS, SaaS)',
    4: 'Mövzu 4: Resursların İdarə Edilməsi və Ölçülməsi',
    5: 'Mövzu 5: Yüksək Əlçatanlıq və Davamlılıq',
    6: 'Mövzu 6: Buludda Məlumatların Saxlanması',
    7: 'Mövzu 7: Bulud Memarlığı və Təcrübələr'
  };

  // State obyektləri
  let allQuestions = [];
  let currentExam = null; // { questions: [], currentIndex: 0, userAnswers: {}, revealedAnswers: {}, startTime: timestamp, elapsedSeconds: 0, optionsShuffled: bool }
  let timerInterval = null;

  const STORAGE_KEY = 'bulud_exam_state_v1';
  const THEME_KEY = 'bulud_theme_preference';

  // DOM elementləri
  const appContainer = document.getElementById('app');
  const modalContainer = document.getElementById('modalContainer');
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const themeIcon = document.getElementById('themeIcon');
  const themeText = document.getElementById('themeText');

  // 1. TEMA İDARƏETMƏSİ
  function initTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY) || 
      (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    applyTheme(savedTheme);

    themeToggleBtn.addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme') || 'light';
      const next = cur === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      localStorage.setItem(THEME_KEY, next);
    });
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      themeIcon.textContent = '☀️';
      themeText.textContent = 'Açıq rejim';
    } else {
      themeIcon.textContent = '🌙';
      themeText.textContent = 'Tünd rejim';
    }
  }

  // 2. KÖMƏKÇİ FUNKSİYALAR
  function formatTime(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function saveExamState() {
    if (currentExam) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentExam));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  function loadExamState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    try {
      return JSON.parse(saved);
    } catch (e) {
      return null;
    }
  }

  // MODAL GÖSTƏRİCİSİ
  function showConfirmModal(title, message, confirmText, cancelText, onConfirm) {
    modalContainer.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-card">
          <h3 class="modal-title">${title}</h3>
          <p class="modal-body">${message}</p>
          <div class="modal-actions">
            <button class="btn-secondary" id="modalCancelBtn">${cancelText}</button>
            <button class="btn-danger" id="modalConfirmBtn">${confirmText}</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('modalCancelBtn').onclick = () => {
      modalContainer.innerHTML = '';
    };

    document.getElementById('modalConfirmBtn').onclick = () => {
      modalContainer.innerHTML = '';
      onConfirm();
    };
  }

  // 3. EKRAN 1: SINAQ QURMA EKRANI
  function renderSetupScreen(restoreState = null) {
    clearInterval(timerInterval);
    currentExam = null;
    saveExamState();

    appContainer.innerHTML = `
      <div class="card">
        <h2 class="setup-title">Sınaq İmtahanı Qurulması</h2>
        <p class="setup-subtitle">Mövzu aralığını və sual sayını seçərək fərdi sınağınızı başladın.</p>

        <div class="form-group">
          <label class="form-label">Mövzu aralığını seçin:</label>
          <div class="topic-selector">
            <select id="startTopicSelect" class="select-control"></select>
            <span>— dan</span>
            <select id="endTopicSelect" class="select-control"></select>
            <span>— ə qədər</span>
          </div>
          <div id="topicRangeBadge" class="topic-range-badge">Seçilmiş aralıq: hesablanır...</div>
        </div>

        <div class="form-group">
          <label class="form-label" for="questionCountInput">Sual sayı:</label>
          <div class="count-slider-container">
            <input type="range" id="questionCountSlider" class="slider-control" min="1" max="45" value="25" />
            <input type="number" id="questionCountInput" class="number-input" min="1" max="45" value="25" />
          </div>
        </div>

        <div class="checkbox-group">
          <label class="checkbox-item">
            <input type="checkbox" id="shuffleQuestionsCheck" checked />
            <span>Suallar təsadüfi sıra ilə göstərilsin</span>
          </label>
          <label class="checkbox-item">
            <input type="checkbox" id="shuffleOptionsCheck" />
            <span>Variantlar təsadüfi sıra ilə qarışdırılsın (A-E yenidən nömrələnir)</span>
          </label>
        </div>

        <button id="startExamBtn" class="btn-primary" style="width: 100%; padding: 0.95rem;">
          <span>Sınağı başla</span>
          <span>→</span>
        </button>
      </div>
    `;

    const startSelect = document.getElementById('startTopicSelect');
    const endSelect = document.getElementById('endTopicSelect');
    const rangeBadge = document.getElementById('topicRangeBadge');
    const countSlider = document.getElementById('questionCountSlider');
    const countInput = document.getElementById('questionCountInput');
    const shuffleQCheck = document.getElementById('shuffleQuestionsCheck');
    const shuffleOptCheck = document.getElementById('shuffleOptionsCheck');
    const startBtn = document.getElementById('startExamBtn');

    // Mövzu variantlarını doldur
    for (let i = 1; i <= 7; i++) {
      const name = `Mövzu ${i}`;
      const opt1 = document.createElement('option');
      opt1.value = i;
      opt1.textContent = name;
      startSelect.appendChild(opt1);

      const opt2 = document.createElement('option');
      opt2.value = i;
      opt2.textContent = name;
      endSelect.appendChild(opt2);
    }

    startSelect.value = '1';
    endSelect.value = '7';

    function updateAvailableCount() {
      let s = parseInt(startSelect.value, 10);
      let e = parseInt(endSelect.value, 10);
      if (s > e) {
        endSelect.value = s;
        e = s;
      }
      const pool = allQuestions.filter(q => q.topic >= s && q.topic <= e);
      const totalAvailable = pool.length;

      rangeBadge.textContent = `Seçilmiş aralıqda cəmi ${totalAvailable} sual mövcuddur.`;
      countSlider.max = totalAvailable;
      countInput.max = totalAvailable;

      if (parseInt(countInput.value, 10) > totalAvailable) {
        countInput.value = totalAvailable;
        countSlider.value = totalAvailable;
      }
      if (parseInt(countInput.value, 10) < 1) {
        countInput.value = Math.min(25, totalAvailable);
        countSlider.value = countInput.value;
      }
      startBtn.disabled = totalAvailable === 0;
    }

    startSelect.addEventListener('change', updateAvailableCount);
    endSelect.addEventListener('change', updateAvailableCount);

    countSlider.addEventListener('input', () => {
      countInput.value = countSlider.value;
    });
    countInput.addEventListener('input', () => {
      let val = parseInt(countInput.value, 10);
      const max = parseInt(countSlider.max, 10);
      if (val > max) val = max;
      if (val < 1) val = 1;
      countSlider.value = val || 1;
    });

    updateAvailableCount();

    startBtn.addEventListener('click', () => {
      const s = parseInt(startSelect.value, 10);
      const e = parseInt(endSelect.value, 10);
      const count = parseInt(countInput.value, 10);
      const shuffleQ = shuffleQCheck.checked;
      const shuffleOpt = shuffleOptCheck.checked;

      startNewExam(s, e, count, shuffleQ, shuffleOpt);
    });
  }

  // 4. YENİ SINAQ YARATMAQ
  function startNewExam(startTopic, endTopic, count, shuffleQuestions, shuffleOptions, customQuestions = null) {
    let pool;
    if (customQuestions && customQuestions.length > 0) {
      pool = customQuestions;
    } else {
      pool = allQuestions.filter(q => q.topic >= startTopic && q.topic <= endTopic);
    }

    let selected = [...pool];
    if (shuffleQuestions) {
      selected = shuffle(selected);
    }

    const actualCount = Math.min(count, selected.length);
    selected = selected.slice(0, actualCount);

    // Variantların qarışdırılması lazımdırsa
    const preparedQuestions = selected.map(q => {
      if (!shuffleOptions) {
        return {
          id: q.id,
          topic: q.topic,
          number: q.number,
          question: q.question,
          options: { ...q.options },
          correct: q.correct
        };
      } else {
        const letters = ['A', 'B', 'C', 'D', 'E'];
        const entries = Object.entries(q.options); // [['A', text], ['B', text], ...]
        const shuffledEntries = shuffle(entries);
        const newOptions = {};
        let newCorrect = 'A';

        shuffledEntries.forEach(([oldKey, text], idx) => {
          const newLetter = letters[idx];
          newOptions[newLetter] = text;
          if (oldKey === q.correct) {
            newCorrect = newLetter;
          }
        });

        return {
          id: q.id,
          topic: q.topic,
          number: q.number,
          question: q.question,
          options: newOptions,
          correct: newCorrect
        };
      }
    });

    currentExam = {
      questions: preparedQuestions,
      currentIndex: 0,
      userAnswers: {},
      revealedAnswers: {},
      elapsedSeconds: 0,
      optionsShuffled: shuffleOptions,
      isFinished: false
    };

    saveExamState();
    renderExamScreen();
  }

  // 5. EKRAN 2: SINAQ ZAMANI EKRANI
  function renderExamScreen() {
    clearInterval(timerInterval);

    // Taymeri başlat
    timerInterval = setInterval(() => {
      currentExam.elapsedSeconds++;
      saveExamState();
      const timerEl = document.getElementById('examTimer');
      if (timerEl) {
        timerEl.textContent = formatTime(currentExam.elapsedSeconds);
      }
    }, 1000);

    const q = currentExam.questions[currentExam.currentIndex];
    const total = currentExam.questions.length;
    const topicTitle = TOPIC_NAMES[q.topic] || `Mövzu ${q.topic}`;
    const userAnswer = currentExam.userAnswers[q.id];
    const isRevealed = !!currentExam.revealedAnswers[q.id];

    appContainer.innerHTML = `
      <div class="card">
        <!-- Top bar: Sayğac, Mövzu, Taymer -->
        <div class="test-topbar">
          <div class="test-progress-info">
            <span class="topic-tag">${topicTitle}</span>
            <span class="q-counter">Sual ${currentExam.currentIndex + 1} / ${total}</span>
          </div>
          <div class="timer-box" title="Keçən vaxt">
            <span>⏱️</span>
            <span id="examTimer">${formatTime(currentExam.elapsedSeconds)}</span>
          </div>
        </div>

        <!-- Sual mətni -->
        <div class="question-text-box">${escapeHtml(q.question)}</div>

        <!-- Variantlar -->
        <div class="options-list" id="optionsList"></div>

        <!-- Əməliyyat düymələri -->
        <div class="test-actions">
          <div class="nav-buttons-group">
            <button id="prevQuestionBtn" class="btn-secondary" ${currentExam.currentIndex === 0 ? 'disabled' : ''}>
              ← Əvvəlki
            </button>
            <button id="nextQuestionBtn" class="btn-secondary" ${currentExam.currentIndex === total - 1 ? 'disabled' : ''}>
              Sonrakı →
            </button>
          </div>

          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button id="revealAnswerBtn" class="btn-warning-outline" title="Düzgün cavabı göstər">
              💡 Düzgün cavabı göstər
            </button>
            <button id="finishExamBtn" class="btn-danger">
              Sınağı bitir ✓
            </button>
          </div>
        </div>

        <!-- Naviqasiya paneli (grid) -->
        <div class="nav-grid-container">
          <div class="nav-grid-header">
            <span>Sualların Naviqasiya Paneli:</span>
            <div class="nav-legend">
              <span class="legend-item"><span class="legend-dot current" style="border: 1px solid var(--primary);"></span> Cari</span>
              <span class="legend-item"><span class="legend-dot answered"></span> Cavablanıb</span>
              <span class="legend-item"><span class="legend-dot revealed"></span> Baxılıb</span>
              <span class="legend-item"><span class="legend-dot unanswered"></span> Boş</span>
            </div>
          </div>
          <div class="nav-grid" id="navGrid"></div>
        </div>
      </div>
    `;

    // Variantları göstər
    const optionsContainer = document.getElementById('optionsList');
    const letters = ['A', 'B', 'C', 'D', 'E'];

    letters.forEach(letter => {
      const optText = q.options[letter];
      if (!optText) return;

      const optDiv = document.createElement('div');
      optDiv.className = 'option-item';
      optDiv.dataset.letter = letter;

      if (userAnswer === letter) {
        optDiv.classList.add('selected');
      }

      // Əgər düzgün cavab açılıbsa
      if (isRevealed) {
        if (letter === q.correct) {
          optDiv.classList.add('correct-revealed');
        } else if (userAnswer === letter && userAnswer !== q.correct) {
          optDiv.classList.add('wrong-selected');
        }
      }

      optDiv.innerHTML = `
        <span class="opt-letter">${letter}</span>
        <span class="opt-content">${escapeHtml(optText)}</span>
      `;

      optDiv.addEventListener('click', () => {
        currentExam.userAnswers[q.id] = letter;
        saveExamState();
        renderExamScreen(); // Yenilə ki, həm variant seçilsin, həm nav panel dəyişsin
      });

      optionsContainer.appendChild(optDiv);
    });

    // Naviqasiya qəfəsi (Grid)
    const navGrid = document.getElementById('navGrid');
    currentExam.questions.forEach((item, index) => {
      const btn = document.createElement('button');
      btn.className = 'nav-q-btn';
      btn.textContent = index + 1;

      if (index === currentExam.currentIndex) {
        btn.classList.add('current');
      }
      if (currentExam.revealedAnswers[item.id]) {
        btn.classList.add('revealed');
      } else if (currentExam.userAnswers[item.id]) {
        btn.classList.add('answered');
      }

      btn.addEventListener('click', () => {
        currentExam.currentIndex = index;
        saveExamState();
        renderExamScreen();
      });

      navGrid.appendChild(btn);
    });

    // Düymə hadisələri
    document.getElementById('prevQuestionBtn').addEventListener('click', () => {
      if (currentExam.currentIndex > 0) {
        currentExam.currentIndex--;
        saveExamState();
        renderExamScreen();
      }
    });

    document.getElementById('nextQuestionBtn').addEventListener('click', () => {
      if (currentExam.currentIndex < total - 1) {
        currentExam.currentIndex++;
        saveExamState();
        renderExamScreen();
      }
    });

    document.getElementById('revealAnswerBtn').addEventListener('click', () => {
      currentExam.revealedAnswers[q.id] = true;
      saveExamState();
      renderExamScreen();
    });

    document.getElementById('finishExamBtn').addEventListener('click', () => {
      const unansweredCount = currentExam.questions.filter(item => !currentExam.userAnswers[item.id]).length;
      if (unansweredCount > 0) {
        showConfirmModal(
          'Sınağı bitirmək istəyirsiniz?',
          `Hələ ${unansweredCount} sual cavablandırılmayıb. İmtahanı indi bitirmək istədiyinizdən əminsiniz?`,
          'Bəli, bitir',
          'Davam et',
          () => {
            finishExam();
          }
        );
      } else {
        finishExam();
      }
    });
  }

  // 6. SINAĞIN BİTMƏSİ VƏ NƏTİCƏ EKRANI
  function finishExam() {
    clearInterval(timerInterval);
    currentExam.isFinished = true;
    saveExamState();
    renderResultScreen();
  }

  function renderResultScreen() {
    clearInterval(timerInterval);
    const total = currentExam.questions.length;
    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;
    let revealedCount = 0;

    currentExam.questions.forEach(q => {
      const userAns = currentExam.userAnswers[q.id];
      if (currentExam.revealedAnswers[q.id]) {
        revealedCount++;
      }
      if (!userAns) {
        unansweredCount++;
      } else if (userAns === q.correct) {
        correctCount++;
      } else {
        wrongCount++;
      }
    });

    const percent = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    const timeSpent = formatTime(currentExam.elapsedSeconds);

    appContainer.innerHTML = `
      <div class="card">
        <div class="result-hero">
          <div class="result-score-circle">
            <span class="score-percent">${percent}%</span>
            <span class="score-label">Müvəffəqiyyət</span>
          </div>
          <h2>Sınaq Nəticəsi</h2>
          <p style="color: var(--text-muted); margin-top: 0.25rem;">
            ${total} sualdan ${correctCount} suala düzgün cavab verdiniz.
          </p>
        </div>

        <div class="stats-grid">
          <div class="stat-card correct">
            <div class="stat-value" style="color: var(--success);">${correctCount}</div>
            <div class="stat-name">Düzgün Cavab</div>
          </div>
          <div class="stat-card wrong">
            <div class="stat-value" style="color: var(--danger);">${wrongCount}</div>
            <div class="stat-name">Səhv Cavab</div>
          </div>
          <div class="stat-card unanswered">
            <div class="stat-value" style="color: var(--warning);">${unansweredCount}</div>
            <div class="stat-name">Cavablandırılmamış</div>
          </div>
          <div class="stat-card revealed">
            <div class="stat-value" style="color: var(--info);">${revealedCount}</div>
            <div class="stat-name">Cavabına Baxılmış</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${timeSpent}</div>
            <div class="stat-name">Sərf Olunan Vaxt</div>
          </div>
        </div>

        <!-- Fəaliyyət düymələri -->
        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; margin: 1.5rem 0;">
          <button id="retryWrongBtn" class="btn-primary" ${wrongCount === 0 ? 'disabled' : ''}>
            <span>🔄 Yalnız səhv etdiyim suallarla (${wrongCount}) yenidən sına</span>
          </button>
          <button id="newExamBtn" class="btn-secondary">
            <span>⚙️ Yeni sınaq qur</span>
          </button>
        </div>

        <!-- Filtrlər -->
        <div class="filter-bar">
          <button class="filter-btn active" data-filter="all">Hamısı (${total})</button>
          <button class="filter-btn" data-filter="wrong">Yalnız səhvlər (${wrongCount})</button>
          <button class="filter-btn" data-filter="correct">Yalnız düzlər (${correctCount})</button>
          <button class="filter-btn" data-filter="unanswered">Cavabsızlar (${unansweredCount})</button>
        </div>

        <!-- Bütün sualların analizi siyahısı -->
        <div class="review-list" id="reviewList"></div>
      </div>
    `;

    const reviewList = document.getElementById('reviewList');

    function displayFilteredList(filterType) {
      reviewList.innerHTML = '';

      currentExam.questions.forEach((q, idx) => {
        const userAns = currentExam.userAnswers[q.id];
        const isCorrect = userAns === q.correct;
        const isRevealed = !!currentExam.revealedAnswers[q.id];

        let statusClass = 'status-unanswered';
        let badgeHtml = '<span class="badge badge-unanswered">Cavabsız</span>';

        if (userAns) {
          if (isCorrect) {
            statusClass = 'status-correct';
            badgeHtml = '<span class="badge badge-correct">Düzgün</span>';
          } else {
            statusClass = 'status-wrong';
            badgeHtml = '<span class="badge badge-wrong">Səhv</span>';
          }
        }
        if (isRevealed) {
          badgeHtml += ' <span class="badge badge-revealed">Cavaba baxılıb</span>';
        }

        // Filter şərtləri
        if (filterType === 'wrong' && (isCorrect || !userAns)) return;
        if (filterType === 'correct' && !isCorrect) return;
        if (filterType === 'unanswered' && userAns) return;

        const itemDiv = document.createElement('div');
        itemDiv.className = `review-item ${statusClass}`;

        const userText = userAns ? `${userAns}) ${q.options[userAns] || ''}` : 'Cavab verilməyib';
        const correctText = `${q.correct}) ${q.options[q.correct] || ''}`;

        itemDiv.innerHTML = `
          <div class="review-item-header">
            <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">
              Sual ${idx + 1} (${TOPIC_NAMES[q.topic] || `Mövzu ${q.topic}`}, №${q.number})
            </span>
            <div>${badgeHtml}</div>
          </div>
          <div class="review-q-title">${escapeHtml(q.question)}</div>
          <div class="review-answers-box">
            <div>
              <strong style="color: ${isCorrect ? 'var(--success)' : (userAns ? 'var(--danger)' : 'var(--warning)')};">
                Sizin cavabınız:
              </strong>
              <span>${escapeHtml(userText)}</span>
            </div>
            <div>
              <strong style="color: var(--success);">Düzgün cavab:</strong>
              <span>${escapeHtml(correctText)}</span>
            </div>
          </div>
        `;

        reviewList.appendChild(itemDiv);
      });
    }

    displayFilteredList('all');

    // Filtr düymələrinin kliklənməsi
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        displayFilteredList(btn.dataset.filter);
      });
    });

    // "Yalnız səhv etdiyim suallarla yenidən sına"
    document.getElementById('retryWrongBtn').addEventListener('click', () => {
      const wrongQuestions = currentExam.questions.filter(q => {
        const ans = currentExam.userAnswers[q.id];
        return ans && ans !== q.correct;
      });
      if (wrongQuestions.length > 0) {
        startNewExam(1, 7, wrongQuestions.length, true, currentExam.optionsShuffled, wrongQuestions);
      }
    });

    // "Yeni sınaq qur"
    document.getElementById('newExamBtn').addEventListener('click', () => {
      renderSetupScreen();
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // 7. BAŞLANĞIC (INITIALIZATION)
  function initApp() {
    initTheme();

    // Sualları window.QUESTIONS_DATA-dan götür
    if (window.QUESTIONS_DATA && Array.isArray(window.QUESTIONS_DATA) && window.QUESTIONS_DATA.length > 0) {
      allQuestions = window.QUESTIONS_DATA;
    } else {
      // Əgər nədənsə window.QUESTIONS_DATA yoxdursa, fetch ilə yoxla
      fetch('questions.json')
        .then(r => r.json())
        .then(data => {
          allQuestions = data;
          checkExistingExam();
        })
        .catch(err => {
          appContainer.innerHTML = `
            <div class="card" style="text-align: center; color: var(--danger);">
              <h3>Xəta: Suallar bazası yüklənmədi!</h3>
              <p>Zəhmət olmasa "questions.js" faylının "index.html" ilə eyni qovluqda olduğunu yoxlayın.</p>
            </div>
          `;
          console.error(err);
        });
      return;
    }

    checkExistingExam();
  }

  function checkExistingExam() {
    const saved = loadExamState();
    if (saved && saved.questions && saved.questions.length > 0) {
      if (saved.isFinished) {
        currentExam = saved;
        renderResultScreen();
      } else {
        // Yarımçıq qalmış sınaq var
        appContainer.innerHTML = `
          <div class="card" style="text-align: center; max-width: 500px; margin: 2rem auto;">
            <div style="font-size: 2.5rem; margin-bottom: 0.75rem;">📋</div>
            <h3 style="margin-bottom: 0.5rem;">Davam edən sınağınız var</h3>
            <p style="color: var(--text-muted); margin-bottom: 1.5rem;">
              Siz əvvəlki sınaqda ${saved.questions.length} sualdan ${Object.keys(saved.userAnswers).length} sualı cavablandırmısınız.
            </p>
            <div style="display: flex; gap: 0.75rem; justify-content: center;">
              <button id="resumeExamBtn" class="btn-primary">Davam etdir</button>
              <button id="discardExamBtn" class="btn-secondary">Yeni sınaq qur</button>
            </div>
          </div>
        `;

        document.getElementById('resumeExamBtn').onclick = () => {
          currentExam = saved;
          renderExamScreen();
        };

        document.getElementById('discardExamBtn').onclick = () => {
          renderSetupScreen();
        };
      }
    } else {
      renderSetupScreen();
    }
  }

  // Səhifə tam yükləndikdə işə sal
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

})();
