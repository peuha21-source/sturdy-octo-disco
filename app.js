/**
 * SciMaster - 중학 과학 1~3 개념 & 과학고 면접 마스터
 * Main Application Logic (생물 검색표 가지치기 시뮬레이터 포함)
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- App State ---
  let activeGrade = 'all';
  let activeCategory = 'all';
  let searchQuery = '';
  let checkedStandards = JSON.parse(localStorage.getItem('sciMaster_standards') || '{}');
  let currentQuizIndex = 0;
  let quizDataList = [];
  let isCardFlipped = false;

  // --- Element References ---
  const navTabs = document.querySelectorAll('.nav-tab');
  const viewSections = document.querySelectorAll('.view-section');
  const gradeFilterBtns = document.querySelectorAll('.grade-btn');
  const categoryFilterSelect = document.getElementById('categorySelect');
  const searchInput = document.getElementById('searchInput');
  const conceptContainer = document.getElementById('conceptContainer');
  const themeToggleBtn = document.getElementById('themeToggle');

  // --- Tracker Elements ---
  const overallProgressBar = document.getElementById('overallProgressBar');
  const overallProgressText = document.getElementById('overallProgressText');
  const grade1Progress = document.getElementById('grade1Progress');
  const grade2Progress = document.getElementById('grade2Progress');
  const grade3Progress = document.getElementById('grade3Progress');
  const trackerListContainer = document.getElementById('trackerListContainer');

  // --- Misconceptions Elements ---
  const misconceptionContainer = document.getElementById('misconceptionContainer');

  // --- Quiz Elements ---
  const quizGradeSelect = document.getElementById('quizGradeSelect');
  const startQuizBtn = document.getElementById('startQuizBtn');
  const flashcard = document.getElementById('flashcard');
  const cardFrontQ = document.getElementById('cardFrontQ');
  const cardBackA = document.getElementById('cardBackA');
  const prevQuizBtn = document.getElementById('prevQuizBtn');
  const nextQuizBtn = document.getElementById('nextQuizBtn');
  const quizCounter = document.getElementById('quizCounter');
  const flipBtn = document.getElementById('flipBtn');

  // --- Simulators Elements ---
  // 1. Energy Sim
  const simMassInput = document.getElementById('simMass');
  const simHeightInput = document.getElementById('simHeight');
  const simVelInput = document.getElementById('simVel');
  const massValSpan = document.getElementById('massVal');
  const heightValSpan = document.getElementById('heightVal');
  const velValSpan = document.getElementById('velVal');
  const epValSpan = document.getElementById('epVal');
  const ekValSpan = document.getElementById('ekVal');
  const totalEValSpan = document.getElementById('totalEVal');
  const epBar = document.getElementById('epBar');
  const ekBar = document.getElementById('ekBar');

  // 2. Humidity Sim
  const simTempInput = document.getElementById('simTemp');
  const simVaporInput = document.getElementById('simVapor');
  const tempValSpan = document.getElementById('tempVal');
  const vaporValSpan = document.getElementById('vaporVal');
  const calcSatVaporSpan = document.getElementById('calcSatVapor');
  const calcRelHumiditySpan = document.getElementById('calcRelHumidity');
  const humidityStatusSpan = document.getElementById('humidityStatus');

  // 3. Gas Particle Canvas Sim
  const gasTempInput = document.getElementById('gasTemp');
  const gasPressureInput = document.getElementById('gasPressure');
  const gasTempDisplay = document.getElementById('gasTempDisplay');
  const gasPressureDisplay = document.getElementById('gasPressureDisplay');
  const gasVolDisplay = document.getElementById('gasVolDisplay');
  const gasCanvas = document.getElementById('gasCanvas');
  let gasCtx = null;
  let particles = [];
  let animFrameId = null;

  // 4. Biological Key Tree Sim Elements
  const keyStepBadge = document.getElementById('keyStepBadge');
  const keyQuestionText = document.getElementById('keyQuestionText');
  const keyYesBtn = document.getElementById('keyYesBtn');
  const keyNoBtn = document.getElementById('keyNoBtn');
  const keyPathText = document.getElementById('keyPathText');
  const keyResetBtn = document.getElementById('keyResetBtn');
  let currentKeyNode = 'start';
  let keyHistoryPath = ['시작'];

  // --- Initializers ---
  initTheme();
  initNavigation();
  renderCategoryFilter();
  renderConceptExplorer();
  renderTrackerView();
  renderMisconceptions();
  initQuizModule();
  initSimulators();
  initKeyTreeSimulator();

  // --- Theme Toggle ---
  function initTheme() {
    const savedTheme = localStorage.getItem('sciMaster_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    themeToggleBtn.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('sciMaster_theme', newTheme);
      updateThemeIcon(newTheme);
    });
  }

  function updateThemeIcon(theme) {
    themeToggleBtn.innerHTML = theme === 'dark' 
      ? '<i class="fas fa-sun"></i> <span>라이트 모드</span>' 
      : '<i class="fas fa-moon"></i> <span>다크 모드</span>';
  }

  // --- Navigation & Tabs ---
  function initNavigation() {
    navTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetView = tab.dataset.view;
        navTabs.forEach(t => t.classList.remove('active'));
        viewSections.forEach(s => s.classList.remove('active'));

        tab.classList.add('active');
        const activeSec = document.getElementById(targetView);
        if (activeSec) {
          activeSec.classList.add('active');
        }

        if (targetView === 'view-simulators' && gasCanvas) {
          startGasSimulation();
        } else if (animFrameId) {
          cancelAnimationFrame(animFrameId);
        }
      });
    });

    gradeFilterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        gradeFilterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeGrade = btn.dataset.grade;
        renderConceptExplorer();
      });
    });

    categoryFilterSelect.addEventListener('change', (e) => {
      activeCategory = e.target.value;
      renderConceptExplorer();
    });

    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim().toLowerCase();
      renderConceptExplorer();
    });
  }

  function renderCategoryFilter() {
    const categories = new Set();
    scienceData.forEach(g => {
      g.units.forEach(u => {
        if (u.category) categories.add(u.category);
      });
    });

    categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      categoryFilterSelect.appendChild(opt);
    });
  }

  // --- Concept Explorer Render ---
  function renderConceptExplorer() {
    conceptContainer.innerHTML = '';
    let matchedUnitsCount = 0;

    scienceData.forEach(gradeData => {
      if (activeGrade !== 'all' && String(gradeData.grade) !== activeGrade) {
        return;
      }

      const filteredUnits = gradeData.units.filter(unit => {
        if (activeCategory !== 'all' && unit.category !== activeCategory) {
          return false;
        }
        if (searchQuery) {
          const inTitle = unit.title.toLowerCase().includes(searchQuery);
          const inSummary = unit.summary.toLowerCase().includes(searchQuery);
          const inConcepts = unit.concepts.some(c => c.name.toLowerCase().includes(searchQuery) || c.desc.toLowerCase().includes(searchQuery));
          return inTitle || inSummary || inConcepts;
        }
        return true;
      });

      if (filteredUnits.length === 0) return;

      const gradeGroup = document.createElement('div');
      gradeGroup.className = 'grade-group-card';
      
      const gradeHeader = document.createElement('div');
      gradeHeader.className = 'grade-header';
      gradeHeader.innerHTML = `
        <h2>${gradeData.gradeTitle}</h2>
        <span class="unit-count-badge">${filteredUnits.length}개 단원</span>
      `;
      gradeGroup.appendChild(gradeHeader);

      const unitGrid = document.createElement('div');
      unitGrid.className = 'unit-grid';

      filteredUnits.forEach(unit => {
        matchedUnitsCount++;
        const unitCard = createUnitCard(unit);
        unitGrid.appendChild(unitCard);
      });

      gradeGroup.appendChild(unitGrid);
      conceptContainer.appendChild(gradeGroup);
    });

    if (matchedUnitsCount === 0) {
      conceptContainer.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-search"></i>
          <p>검색 조건에 해당되는 과학 개념 단원이 없습니다.</p>
        </div>
      `;
    }
  }

  function createUnitCard(unit) {
    const card = document.createElement('div');
    card.className = 'unit-card glass-panel';

    let conceptsHtml = unit.concepts.map(c => `
      <div class="concept-item">
        <span class="concept-name"><i class="fas fa-atom"></i> ${c.name}</span>
        <p class="concept-desc">${c.desc}</p>
      </div>
    `).join('');

    let tablesHtml = '';
    if (unit.tables && unit.tables.length > 0) {
      tablesHtml = unit.tables.map(tbl => `
        <div class="unit-table-box">
          <div class="table-title"><i class="fas fa-table"></i> ${tbl.title}</div>
          <table class="styled-table">
            <thead>
              <tr>${tbl.headers.map(h => `<th>${h}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${tbl.rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}
            </tbody>
          </table>
        </div>
      `).join('');
    }

    let formulasHtml = '';
    if (unit.formulas && unit.formulas.length > 0) {
      formulasHtml = `
        <div class="formula-box">
          <div class="box-label"><i class="fas fa-calculator"></i> 핵심 공식 및 정리</div>
          ${unit.formulas.map(f => `
            <div class="formula-item">
              <span class="formula-title">${f.name}:</span>
              <code class="formula-code">${f.eq}</code>
              <span class="formula-desc">(${f.desc})</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    let standardsHtml = unit.standards.map((std, idx) => {
      const stdId = `${unit.id}-std-${idx}`;
      const isChecked = checkedStandards[stdId] ? 'checked' : '';
      return `
        <label class="std-checkbox-item">
          <input type="checkbox" class="std-chk" data-id="${stdId}" ${isChecked}>
          <span class="custom-chk"></span>
          <span class="std-text">${std}</span>
        </label>
      `;
    }).join('');

    let misconceptionsHtml = unit.misconceptions.map(m => `
      <div class="misconception-card-sm">
        <div class="misc-q"><i class="fas fa-exclamation-triangle"></i> ${m.title}</div>
        <div class="misc-a">${m.detail}</div>
      </div>
    `).join('');

    let interviewHtml = unit.interviewQuestions.map(iq => `
      <div class="interview-q-card">
        <div class="iq-badge"><i class="fas fa-user-graduate"></i> 과학고 면접 예상 Q</div>
        <div class="iq-question">" ${iq.q} "</div>
        <details class="iq-answer-details">
          <summary>모범 답안 및 평가 요소 확인</summary>
          <div class="iq-answer">${iq.a}</div>
        </details>
      </div>
    `).join('');

    card.innerHTML = `
      <div class="card-top-bar">
        <span class="unit-cat-tag">${unit.category || '과학'}</span>
        <span class="unit-id-tag">${unit.id}</span>
      </div>
      <h3 class="unit-title">${unit.title}</h3>
      <p class="unit-summary">${unit.summary}</p>
      
      <div class="card-section">
        <h4 class="sec-title"><i class="fas fa-book-open"></i> 핵심 개념 정의 & 원리</h4>
        ${conceptsHtml}
      </div>

      ${tablesHtml}
      ${formulasHtml}

      <div class="card-section">
        <h4 class="sec-title"><i class="fas fa-tasks"></i> 성취기준 체크</h4>
        <div class="standards-list">${standardsHtml}</div>
      </div>

      <div class="card-section">
        <h4 class="sec-title"><i class="fas fa-lightbulb"></i> 자주 혼동하는 개념 (오개념 타파)</h4>
        ${misconceptionsHtml}
      </div>

      ${interviewHtml}
    `;

    card.querySelectorAll('.std-chk').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const id = e.target.dataset.id;
        checkedStandards[id] = e.target.checked;
        localStorage.setItem('sciMaster_standards', JSON.stringify(checkedStandards));
        renderTrackerView();
      });
    });

    return card;
  }

  // --- Tracker View ---
  function renderTrackerView() {
    let totalStandards = 0;
    let checkedTotal = 0;

    const gradeStats = {
      1: { total: 0, checked: 0 },
      2: { total: 0, checked: 0 },
      3: { total: 0, checked: 0 }
    };

    trackerListContainer.innerHTML = '';

    scienceData.forEach(g => {
      const gradeDiv = document.createElement('div');
      gradeDiv.className = 'tracker-grade-box glass-panel';
      gradeDiv.innerHTML = `<h3 class="tracker-grade-title">${g.gradeTitle} 성취기준 목록</h3>`;

      g.units.forEach(u => {
        u.standards.forEach((std, idx) => {
          totalStandards++;
          gradeStats[g.grade].total++;

          const stdId = `${u.id}-std-${idx}`;
          const isChecked = !!checkedStandards[stdId];
          if (isChecked) {
            checkedTotal++;
            gradeStats[g.grade].checked++;
          }

          const item = document.createElement('div');
          item.className = `tracker-std-row ${isChecked ? 'completed' : ''}`;
          item.innerHTML = `
            <label class="std-checkbox-item">
              <input type="checkbox" class="tracker-chk" data-id="${stdId}" ${isChecked ? 'checked' : ''}>
              <span class="custom-chk"></span>
              <span class="std-unit-badge">${u.title.split('.')[0]}</span>
              <span class="std-text">${std}</span>
            </label>
          `;

          item.querySelector('.tracker-chk').addEventListener('change', (e) => {
            checkedStandards[stdId] = e.target.checked;
            localStorage.setItem('sciMaster_standards', JSON.stringify(checkedStandards));
            renderTrackerView();
            renderConceptExplorer();
          });

          gradeDiv.appendChild(item);
        });
      });

      trackerListContainer.appendChild(gradeDiv);
    });

    const overallPct = totalStandards > 0 ? Math.round((checkedTotal / totalStandards) * 100) : 0;
    overallProgressBar.style.width = `${overallPct}%`;
    overallProgressText.textContent = `${overallPct}% (${checkedTotal}/${totalStandards} 개 달성)`;

    [1, 2, 3].forEach(gNum => {
      const gTot = gradeStats[gNum].total;
      const gChk = gradeStats[gNum].checked;
      const gPct = gTot > 0 ? Math.round((gChk / gTot) * 100) : 0;
      const elem = gNum === 1 ? grade1Progress : gNum === 2 ? grade2Progress : grade3Progress;
      if (elem) {
        elem.style.width = `${gPct}%`;
        elem.previousElementSibling.querySelector('.g-pct').textContent = `${gPct}%`;
      }
    });
  }

  // --- Misconceptions Section ---
  function renderMisconceptions() {
    misconceptionContainer.innerHTML = '';

    scienceData.forEach(g => {
      g.units.forEach(u => {
        if (u.misconceptions && u.misconceptions.length > 0) {
          u.misconceptions.forEach(m => {
            const card = document.createElement('div');
            card.className = 'misconception-card glass-panel';
            card.innerHTML = `
              <div class="misc-tag-bar">
                <span class="misc-grade-tag">${g.gradeTitle}</span>
                <span class="misc-unit-tag">${u.title}</span>
              </div>
              <h3 class="misc-question"><i class="fas fa-question-circle"></i> ${m.title}</h3>
              <div class="misc-answer">
                <div class="answer-badge"><i class="fas fa-check-circle"></i> 과학적 올바른 개념</div>
                <p>${m.detail}</p>
              </div>
            `;
            misconceptionContainer.appendChild(card);
          });
        }
      });
    });
  }

  // --- Quiz & Flashcard Module ---
  function initQuizModule() {
    buildQuizList('all');

    quizGradeSelect.addEventListener('change', (e) => {
      buildQuizList(e.target.value);
    });

    startQuizBtn.addEventListener('click', () => {
      currentQuizIndex = 0;
      isCardFlipped = false;
      renderCurrentQuiz();
    });

    flashcard.addEventListener('click', () => {
      isCardFlipped = !isCardFlipped;
      flashcard.classList.toggle('flipped', isCardFlipped);
    });

    flipBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      isCardFlipped = !isCardFlipped;
      flashcard.classList.toggle('flipped', isCardFlipped);
    });

    prevQuizBtn.addEventListener('click', () => {
      if (currentQuizIndex > 0) {
        currentQuizIndex--;
        isCardFlipped = false;
        renderCurrentQuiz();
      }
    });

    nextQuizBtn.addEventListener('click', () => {
      if (currentQuizIndex < quizDataList.length - 1) {
        currentQuizIndex++;
        isCardFlipped = false;
        renderCurrentQuiz();
      }
    });
  }

  function buildQuizList(gradeChoice) {
    quizDataList = [];

    scienceData.forEach(g => {
      if (gradeChoice !== 'all' && String(g.grade) !== gradeChoice) return;

      g.units.forEach(u => {
        if (u.interviewQuestions && u.interviewQuestions.length > 0) {
          u.interviewQuestions.forEach(iq => {
            quizDataList.push({
              gradeTitle: g.gradeTitle,
              unitTitle: u.title,
              category: u.category,
              question: iq.q,
              answer: iq.a
            });
          });
        }
      });
    });

    quizDataList.sort(() => Math.random() - 0.5);
    currentQuizIndex = 0;
    isCardFlipped = false;
    renderCurrentQuiz();
  }

  function renderCurrentQuiz() {
    if (quizDataList.length === 0) {
      cardFrontQ.textContent = '선택한 조건의 퀴즈 데이터가 없습니다.';
      cardBackA.textContent = '';
      quizCounter.textContent = '0 / 0';
      return;
    }

    flashcard.classList.remove('flipped');
    const qItem = quizDataList[currentQuizIndex];

    cardFrontQ.innerHTML = `
      <div class="card-unit-badge">${qItem.gradeTitle} | ${qItem.unitTitle}</div>
      <p class="q-text">"${qItem.question}"</p>
      <div class="flip-hint"><i class="fas fa-sync-alt"></i> 카드를 클릭하면 모범 답안을 확인할 수 있습니다</div>
    `;

    cardBackA.innerHTML = `
      <div class="card-unit-badge answer-badge">과학고 면접 모범 답안 & 개념 요약</div>
      <p class="a-text">${qItem.answer}</p>
    `;

    quizCounter.textContent = `${currentQuizIndex + 1} / ${quizDataList.length}`;
  }

  // --- 4. Dichotomous Key Simulator (생물 '예/아니요' 가지치기 검색표) ---
  const keyTreeData = {
    start: {
      step: '1단계 질문',
      q: '핵막이 존재하여 원자핵을 갖춘 진핵세포 생물입니까?',
      yes: 'step2',
      no: 'res_monera'
    },
    step2: {
      step: '2단계 질문',
      q: '엽록체에서 광합성을 하여 스스로 유기물을 합성하는 다세포 생물입니까?',
      yes: 'res_plantae',
      no: 'step3'
    },
    step3: {
      step: '3단계 질문',
      q: '세포벽이 존재하며, 외부의 유기물을 분해하여 흡수 영양을 수행합니까?',
      yes: 'res_fungi',
      no: 'step4'
    },
    step4: {
      step: '4단계 질문',
      q: '세포벽이 없고 다른 생물을 섭식하여 영양분을 얻는 다세포 생물입니까?',
      yes: 'res_animalia',
      no: 'res_protista'
    },
    // Results
    res_monera: {
      isResult: true,
      title: '🦠 원핵생물계 (Monera)',
      desc: '세포에 핵막과 세포 소기관이 없는 가장 원시적인 세포 구조입니다. 펩티도글리칸 세포벽을 가지며 주로 단세포로 존재합니다.',
      examples: '대표 생물: 대장균, 젖산균, 결핵균, 남세균 (노스톡)'
    },
    res_plantae: {
      isResult: true,
      title: '🌿 식물계 (Plantae)',
      desc: '진핵 다세포 생물로, 셀룰로스 성분의 세포벽을 가지며 엽록체에서 빛에너지를 이용해 광합성을 하여 독립 영양 작용을 합니다.',
      examples: '대표 생물: 솔이끼, 고사리, 소나무, 장미, 벼'
    },
    res_fungi: {
      isResult: true,
      title: '🍄 균계 (Fungi)',
      desc: '진핵 다세포 생물(효모는 단세포)로 키틴 성분의 세포벽을 가지며, 엽록소가 없어 광합성을 못하고 유기물을 분해 흡수하여 종속 영양을 합니다.',
      examples: '대표 생물: 버섯, 푸른곰팡이, 누룩곰팡이, 효모'
    },
    res_animalia: {
      isResult: true,
      title: '🦁 동물계 (Animalia)',
      desc: '진핵 다세포 생물로 세포벽이 없으며, 다른 생물을 섭식하여 종속 영양을 합니다. 신경계와 근육계가 발달하여 이동성이 좋습니다.',
      examples: '대표 생물: 지렁이, 오징어, 개구리, 독수리, 사람'
    },
    res_protista: {
      isResult: true,
      title: '🧫 원생생물계 (Protista)',
      desc: '진핵생물 중 식물계, 동물계, 균계에 속하지 않는 다양한 생물 집단입니다. 단세포 생물부터 관다발이 없는 다세포 해조류까지 포함합니다.',
      examples: '대표 생물: 아메바, 짚신벌레, 유글레나, 미역, 김, 다시마'
    }
  };

  function initKeyTreeSimulator() {
    if (!keyQuestionText) return;

    renderKeyNode();

    keyYesBtn.addEventListener('click', () => {
      const node = keyTreeData[currentKeyNode];
      if (node && !node.isResult) {
        keyHistoryPath.push('예');
        currentKeyNode = node.yes;
        renderKeyNode();
      }
    });

    keyNoBtn.addEventListener('click', () => {
      const node = keyTreeData[currentKeyNode];
      if (node && !node.isResult) {
        keyHistoryPath.push('아니요');
        currentKeyNode = node.no;
        renderKeyNode();
      }
    });

    keyResetBtn.addEventListener('click', () => {
      currentKeyNode = 'start';
      keyHistoryPath = ['시작'];
      renderKeyNode();
    });
  }

  function renderKeyNode() {
    const node = keyTreeData[currentKeyNode];
    if (!node) return;

    keyPathText.textContent = `선택 경로: ${keyHistoryPath.join(' ➔ ')}`;

    if (node.isResult) {
      keyStepBadge.textContent = '🎉 최종 분류 결과';
      keyStepBadge.style.background = 'var(--accent-cyan)';
      keyStepBadge.style.color = '#0f172a';

      keyQuestionText.innerHTML = `
        <div style="font-size: 1.6rem; color: var(--accent-cyan); margin-bottom: 0.8rem;">${node.title}</div>
        <p style="font-size: 1.05rem; font-weight: 500; line-height: 1.6; color: var(--text-main); margin-bottom: 0.8rem;">${node.desc}</p>
        <div style="font-size: 0.95rem; font-weight: 700; color: var(--accent-purple); background: rgba(168,85,247,0.15); padding: 0.6rem 1rem; border-radius: 10px; display: inline-block;">${node.examples}</div>
      `;

      keyYesBtn.style.display = 'none';
      keyNoBtn.style.display = 'none';
    } else {
      keyStepBadge.textContent = node.step;
      keyStepBadge.style.background = 'var(--accent-purple)';
      keyStepBadge.style.color = '#fff';

      keyQuestionText.textContent = `"${node.q}"`;

      keyYesBtn.style.display = 'inline-flex';
      keyNoBtn.style.display = 'inline-flex';
    }
  }

  // --- Interactive Simulators ---
  function initSimulators() {
    function updateEnergySim() {
      const m = parseFloat(simMassInput.value);
      const h = parseFloat(simHeightInput.value);
      const v = parseFloat(simVelInput.value);

      massValSpan.textContent = m;
      heightValSpan.textContent = h;
      velValSpan.textContent = v;

      const g = 9.8;
      const ep = Math.round(m * g * h * 10) / 10;
      const ek = Math.round(0.5 * m * v * v * 10) / 10;
      const totalE = Math.round((ep + ek) * 10) / 10;

      epValSpan.textContent = ep;
      ekValSpan.textContent = ek;
      totalEValSpan.textContent = totalE;

      const maxE = Math.max(totalE, 500);
      const epPct = Math.min((ep / maxE) * 100, 100);
      const ekPct = Math.min((ek / maxE) * 100, 100);

      epBar.style.width = `${epPct}%`;
      ekBar.style.width = `${ekPct}%`;
    }

    simMassInput.addEventListener('input', updateEnergySim);
    simHeightInput.addEventListener('input', updateEnergySim);
    simVelInput.addEventListener('input', updateEnergySim);
    updateEnergySim();

    function updateHumiditySim() {
      const t = parseFloat(simTempInput.value);
      const w = parseFloat(simVaporInput.value);

      tempValSpan.textContent = t;
      vaporValSpan.textContent = w;

      const satVapor = Math.round(4.8 * Math.exp(0.062 * t) * 10) / 10;
      calcSatVaporSpan.textContent = satVapor;

      const relHumidity = Math.min(Math.round((w / satVapor) * 100), 100);
      calcRelHumiditySpan.textContent = relHumidity;

      if (w >= satVapor) {
        humidityStatusSpan.textContent = '포화 상태 (이슬점에 도달하여 물방울 응결 발생!)';
        humidityStatusSpan.className = 'status-tag saturated';
      } else {
        humidityStatusSpan.textContent = `불포화 상태 (이슬점: 약 ${(t - (100 - relHumidity)/5).toFixed(1)} ℃)`;
        humidityStatusSpan.className = 'status-tag unsaturated';
      }
    }

    simTempInput.addEventListener('input', updateHumiditySim);
    simVaporInput.addEventListener('input', updateHumiditySim);
    updateHumiditySim();

    if (gasCanvas) {
      gasCtx = gasCanvas.getContext('2d');
      setupGasParticles();

      gasTempInput.addEventListener('input', () => {
        gasTempDisplay.textContent = gasTempInput.value;
        updateGasSim();
      });

      gasPressureInput.addEventListener('input', () => {
        gasPressureDisplay.textContent = gasPressureInput.value;
        updateGasSim();
      });

      updateGasSim();
    }
  }

  function setupGasParticles() {
    particles = [];
    const count = 40;
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * (gasCanvas.width - 20) + 10,
        y: Math.random() * (gasCanvas.height - 20) + 10,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        radius: 5
      });
    }
  }

  function updateGasSim() {
    const tempK = parseFloat(gasTempInput.value);
    const p = parseFloat(gasPressureInput.value);

    const volPct = Math.min(Math.max(Math.round((tempK / p / 300) * 100), 20), 100);
    gasVolDisplay.textContent = `${volPct}%`;

    const speedMult = Math.sqrt(tempK / 300);

    particles.forEach(pt => {
      const angle = Math.atan2(pt.vy, pt.vx);
      const currentSpeed = 3 * speedMult;
      pt.vx = Math.cos(angle) * currentSpeed;
      pt.vy = Math.sin(angle) * currentSpeed;
    });
  }

  function startGasSimulation() {
    if (animFrameId) cancelAnimationFrame(animFrameId);

    function renderFrame() {
      if (!gasCtx) return;
      const width = gasCanvas.width;
      const height = gasCanvas.height;

      const p = parseFloat(gasPressureInput.value);
      const tempK = parseFloat(gasTempInput.value);
      const volPct = Math.min(Math.max((tempK / p / 300), 0.25), 1.0);
      const boxWidth = width * volPct;

      gasCtx.clearRect(0, 0, width, height);

      gasCtx.strokeStyle = 'var(--accent-glow)';
      gasCtx.lineWidth = 4;
      gasCtx.strokeRect(0, 0, boxWidth, height);

      gasCtx.fillStyle = '#ff4757';
      gasCtx.fillRect(boxWidth, 0, 10, height);

      particles.forEach(pt => {
        pt.x += pt.vx;
        pt.y += pt.vy;

        if (pt.x - pt.radius <= 0) {
          pt.x = pt.radius;
          pt.vx *= -1;
        } else if (pt.x + pt.radius >= boxWidth) {
          pt.x = boxWidth - pt.radius;
          pt.vx *= -1;
        }

        if (pt.y - pt.radius <= 0) {
          pt.y = pt.radius;
          pt.vy *= -1;
        } else if (pt.y + pt.radius >= height) {
          pt.y = height - pt.radius;
          pt.vy *= -1;
        }

        gasCtx.beginPath();
        gasCtx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
        gasCtx.fillStyle = '#00f2fe';
        gasCtx.shadowBlur = 8;
        gasCtx.shadowColor = '#00f2fe';
        gasCtx.fill();
        gasCtx.shadowBlur = 0;
      });

      animFrameId = requestAnimationFrame(renderFrame);
    }

    renderFrame();
  }
});
