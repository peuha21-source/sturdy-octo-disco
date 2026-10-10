/**
 * SciMaster - 대한민국 중학 과학 1~3학년 통합 개념 & 과학고 면접 마스터
 * Main Application Logic
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

  // --- Hero Stat Elements ---
  const statUnitCount = document.getElementById('statUnitCount');
  const statConceptCount = document.getElementById('statConceptCount');
  const statQuizCount = document.getElementById('statQuizCount');

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
  const keyModeSelect = document.getElementById('keyModeSelect');
  const keyStepBadge = document.getElementById('keyStepBadge');
  const keyQuestionText = document.getElementById('keyQuestionText');
  const keyYesBtn = document.getElementById('keyYesBtn');
  const keyNoBtn = document.getElementById('keyNoBtn');
  const keyPathText = document.getElementById('keyPathText');
  const keyResetBtn = document.getElementById('keyResetBtn');
  let currentKeyMode = 'kingdom';
  let currentKeyNode = 'start';
  let keyHistoryPath = ['시작'];

  // --- Initializers ---
  initTheme();
  initStats();
  initNavigation();
  renderConceptExplorer();
  renderTrackerView();
  renderMisconceptions();
  initQuizModule();
  initSimulators();
  initKeyTreeSimulator();
  renderMath();

  // --- Stats in Hero ---
  function initStats() {
    let totalUnits = 0;
    let totalConcepts = 0;
    let totalQuizzes = 0;

    scienceData.forEach(g => {
      totalUnits += g.units.length;
      g.units.forEach(u => {
        totalConcepts += u.concepts.length;
        if (u.interviewQuestions) totalQuizzes += u.interviewQuestions.length;
      });
    });

    if (statUnitCount) statUnitCount.textContent = `${totalUnits}개`;
    if (statConceptCount) statConceptCount.textContent = `${totalConcepts}개`;
    if (statQuizCount) statQuizCount.textContent = `${totalQuizzes}문항`;
  }

  // --- KaTeX Math Rendering Utility ---
  function renderMath(targetElement) {
    if (window.renderMathInElement) {
      try {
        renderMathInElement(targetElement || document.body, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false }
          ],
          throwOnError: false
        });
      } catch (err) {
        console.warn('KaTeX render warning:', err);
      }
    }
  }

  // Make sure KaTeX renders after scripts finish loading
  window.addEventListener('load', () => {
    renderMath();
  });

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
      if (gasCanvas) resizeGasCanvas();
    });
  }

  function updateThemeIcon(theme) {
    themeToggleBtn.innerHTML = theme === 'dark' 
      ? '<i class="fas fa-sun"></i> <span>라이트 모드</span>' 
      : '<i class="fas fa-moon"></i> <span>다크 모드</span>';
  }

  // --- Navigation & View Tabs ---
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
          resizeGasCanvas();
          startGasSimulation();
        } else if (animFrameId) {
          cancelAnimationFrame(animFrameId);
        }

        // Trigger math rendering on view switch
        setTimeout(() => renderMath(activeSec), 50);
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

    window.addEventListener('resize', () => {
      if (gasCanvas) resizeGasCanvas();
    });
  }

  // --- Concept Explorer View Render ---
  function renderConceptExplorer() {
    conceptContainer.innerHTML = '';
    let matchedUnitsCount = 0;

    scienceData.forEach(gradeData => {
      if (activeGrade !== 'all' && String(gradeData.grade) !== activeGrade) {
        return;
      }

      const filteredUnits = gradeData.units.filter(unit => {
        if (activeCategory !== 'all') {
          const matchCat = unit.category === activeCategory;
          const matchSub = unit.subCategory && unit.subCategory.includes(activeCategory);
          if (!matchCat && !matchSub) return false;
        }

        if (searchQuery) {
          const inTitle = unit.title.toLowerCase().includes(searchQuery);
          const inSummary = unit.summary.toLowerCase().includes(searchQuery);
          const inCategory = (unit.category || '').toLowerCase().includes(searchQuery);
          const inSubCategory = (unit.subCategory || '').toLowerCase().includes(searchQuery);
          const inConcepts = unit.concepts.some(c => 
            c.name.toLowerCase().includes(searchQuery) || 
            c.desc.toLowerCase().includes(searchQuery)
          );
          const inStandards = unit.standards.some(s => s.toLowerCase().includes(searchQuery));
          return inTitle || inSummary || inCategory || inSubCategory || inConcepts || inStandards;
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
          <p style="font-weight: 700; font-size: 1.05rem;">검색 조건에 일치하는 과학 단원이 없습니다.</p>
          <span style="font-size: 0.85rem;">검색어를 확인하거나 전체 학년/분야 필터를 선택해 보세요.</span>
        </div>
      `;
    }

    renderMath(conceptContainer);
  }

  function createUnitCard(unit) {
    const card = document.createElement('div');
    card.className = 'unit-card glass-panel';

    const catClass = `cat-${unit.category || '기타'}`;

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
              <code class="formula-code">$${f.eq}$</code>
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

    let misconceptionsHtml = '';
    if (unit.misconceptions && unit.misconceptions.length > 0) {
      misconceptionsHtml = `
        <div class="card-section">
          <h4 class="sec-title"><i class="fas fa-lightbulb"></i> 자주 혼동하는 오개념 바로잡기</h4>
          ${unit.misconceptions.map(m => `
            <div class="misconception-card-sm">
              <div class="misc-q"><i class="fas fa-exclamation-triangle"></i> ${m.title}</div>
              <div class="misc-a">${m.detail}</div>
            </div>
          `).join('')}
        </div>
      `;
    }

    let interviewHtml = '';
    if (unit.interviewQuestions && unit.interviewQuestions.length > 0) {
      interviewHtml = unit.interviewQuestions.map(iq => `
        <div class="interview-q-card">
          <div class="iq-badge"><i class="fas fa-user-graduate"></i> 과학고 심층 면접 예상 Q</div>
          <div class="iq-question">" ${iq.q} "</div>
          <details class="iq-answer-details">
            <summary><i class="fas fa-chevron-down"></i> 모범 답안 및 핵심 평가 요소</summary>
            <div class="iq-answer">${iq.a}</div>
          </details>
        </div>
      `).join('');
    }

    card.innerHTML = `
      <div class="card-top-bar">
        <span class="unit-cat-tag ${catClass}">${unit.category || '과학'} · ${unit.subCategory || ''}</span>
        <span class="unit-id-tag">단원 ${unit.id}</span>
      </div>
      <h3 class="unit-title">${unit.title}</h3>
      <p class="unit-summary">${unit.summary}</p>
      
      <div class="card-section">
        <h4 class="sec-title"><i class="fas fa-book-open"></i> 핵심 과학 개념 정의</h4>
        ${conceptsHtml}
      </div>

      ${tablesHtml}
      ${formulasHtml}

      <div class="card-section">
        <h4 class="sec-title"><i class="fas fa-tasks"></i> 핵심 성취기준 점검</h4>
        <div class="standards-list">${standardsHtml}</div>
      </div>

      ${misconceptionsHtml}
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

  // --- Section 2: Standards Tracker View ---
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
        const pctSpan = elem.closest('.g-stat-card').querySelector('.g-pct');
        if (pctSpan) pctSpan.textContent = `${gPct}%`;
      }
    });
  }

  // --- Section 4: Misconceptions View ---
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
                <span class="misc-grade-tag">${g.gradeTitle.split(' ')[1]}</span>
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

    renderMath(misconceptionContainer);
  }

  // --- Section 3: Flashcard Quiz Module ---
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

    // Keyboard navigation for flashcards
    window.addEventListener('keydown', (e) => {
      const quizSection = document.getElementById('view-quiz');
      if (!quizSection.classList.contains('active')) return;

      if (e.code === 'Space') {
        e.preventDefault();
        isCardFlipped = !isCardFlipped;
        flashcard.classList.toggle('flipped', isCardFlipped);
      } else if (e.code === 'ArrowLeft' && currentQuizIndex > 0) {
        currentQuizIndex--;
        isCardFlipped = false;
        renderCurrentQuiz();
      } else if (e.code === 'ArrowRight' && currentQuizIndex < quizDataList.length - 1) {
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
      <div class="flip-hint"><i class="fas fa-sync-alt"></i> 카드를 클릭하거나 스페이스바를 누르면 모범 답안을 확인할 수 있습니다</div>
    `;

    cardBackA.innerHTML = `
      <div class="card-unit-badge answer-badge"><i class="fas fa-check-circle"></i> 과학고 심층 면접 모범 답안 & 핵심 포인트</div>
      <p class="a-text">${qItem.answer}</p>
    `;

    quizCounter.textContent = `${currentQuizIndex + 1} / ${quizDataList.length}`;
    renderMath(flashcard);
  }

  // --- Section 5: Dichotomous Key Branching Tree Simulator ---
  const keyTreeModes = {
    kingdom: {
      title: "생물 5계 '예/아니요' 가지치기 검색표",
      nodes: {
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
          q: '키틴 세포벽이 있으며, 외부 유기물을 분해하여 흡수 영양을 수행합니까?',
          yes: 'res_fungi',
          no: 'step4'
        },
        step4: {
          step: '4단계 질문',
          q: '세포벽이 없고 다른 생물을 섭식하여 영양분을 얻는 다세포 생물입니까?',
          yes: 'res_animalia',
          no: 'res_protista'
        },
        res_monera: {
          isResult: true,
          title: '🦠 원핵생물계 (Monera)',
          desc: '세포에 핵막과 막성 세포 소기관이 없는 원시적 세포 구조. 펩티도글리칸 세포벽을 가지며 주로 단세포로 존재함.',
          examples: '대표 생물: 대장균, 젖산균, 헬리코박터균, 남세균 (노스톡)'
        },
        res_plantae: {
          isResult: true,
          title: '🌿 식물계 (Plantae)',
          desc: '진핵 다세포 생물로, 셀룰로스 세포벽을 가지며 엽록체에서 광합성을 하여 독립 영양을 하는 생산자.',
          examples: '대표 생물: 솔이끼, 고사리, 소나무, 장미, 벼'
        },
        res_fungi: {
          isResult: true,
          title: '🍄 균계 (Fungi)',
          desc: '진핵생물로 키틴 성분의 세포벽을 가지며, 엽록소가 없어 광합성을 못하고 유기물을 분해 흡수하는 종속 영양(분해자) 생물.',
          examples: '대표 생물: 표고버섯, 푸른곰팡이, 누룩곰팡이, 효모(단세포)'
        },
        res_animalia: {
          isResult: true,
          title: '🦁 동물계 (Animalia)',
          desc: '진핵 다세포 생물로 세포벽이 없으며, 다른 생물을 섭식하여 종속 영양을 하는 소비자. 운동 기관과 감각 신경계 발달.',
          examples: '대표 생물: 지렁이, 오징어, 개구리, 독수리, 사람'
        },
        res_protista: {
          isResult: true,
          title: '🧫 원생생물계 (Protista)',
          desc: '진핵생물 중 식물계, 동물계, 균계에 속하지 않는 다양한 생물 집단. 단세포 생물부터 조직 분화가 없는 다세포 해조류까지 포함.',
          examples: '대표 생물: 아메바, 짚신벌레, 유글레나, 미역, 김, 다시마'
        }
      }
    },
    vertebrate: {
      title: "척추동물 5대 강 '예/아니요' 가지치기 검색표",
      nodes: {
        start: {
          step: '1단계 질문',
          q: '체온을 주변 환경과 무관하게 일정하게 유지하는 정온(항온) 동물입니까?',
          yes: 'v_step2',
          no: 'v_step3'
        },
        v_step2: {
          step: '2단계 질문',
          q: '몸이 깃털로 덮여 있고 단단한 부리가 있으며 알(난생)을 낳습니까?',
          yes: 'res_aves',
          no: 'res_mammalia'
        },
        v_step3: {
          step: '3단계 질문',
          q: '평생 지느러미와 아가미를 이용하여 물속에서만 호흡하고 생활합니까?',
          yes: 'res_pisces',
          no: 'v_step4'
        },
        v_step4: {
          step: '4단계 질문',
          q: '어릴 때는 물속에서 아가미로, 성체는 육상에서 허파와 축축한 피부로 호흡합니까?',
          yes: 'res_amphibia',
          no: 'res_reptilia'
        },
        res_aves: {
          isResult: true,
          title: '🦅 조류 (Aves)',
          desc: '정온 동물, 몸이 깃털로 덮여 있고 앞다리가 날개로 변형됨. 기낭이 있어 비행 시 효율적 호흡. 단단한 껍데기(난각) 알.',
          examples: '대표 생물: 참새, 독수리, 펭귄, 타조'
        },
        res_mammalia: {
          isResult: true,
          title: '🐕 포유류 (Mammalia)',
          desc: '정온 동물, 몸이 털로 덮여 있으며 젖을 먹여 새끼를 양육함. 태생(새끼를 낳음, 오리너구리 제외). 귓바퀴 발달.',
          examples: '대표 생물: 사람, 호랑이, 고래, 박쥐'
        },
        res_pisces: {
          isResult: true,
          title: '🐟 어류 (Pisces)',
          desc: '변온 동물, 몸이 비늘로 덮여 있고 지느러미로 헤엄치며 평생 아가미 호흡. 물속 산란(연질 알).',
          examples: '대표 생물: 붕어, 상어, 고등어, 미꾸라지'
        },
        res_amphibia: {
          isResult: true,
          title: '🐸 양서류 (Amphibia)',
          desc: '변온 동물, 변태를 거침. 유생(올챙이)은 꼬리와 아가미로 수중 호흡, 성체는 다리가 나오고 허파와 축축한 피부로 호흡.',
          examples: '대표 생물: 참개구리, 도롱뇽, 맹꽁이, 무당개구리'
        },
        res_reptilia: {
          isResult: true,
          title: '🦎 파충류 (Reptilia)',
          desc: '변온 동물, 몸 표면이 수분 증발을 막는 케라틴 각질 비늘이나 골판으로 덮임. 평생 허파 호흡, 육상에 단단한 가죽질 알 산란.',
          examples: '대표 생물: 뱀, 거북, 카멜레온, 악어'
        }
      }
    }
  };

  function initKeyTreeSimulator() {
    if (!keyQuestionText) return;

    if (keyModeSelect) {
      keyModeSelect.addEventListener('change', (e) => {
        currentKeyMode = e.target.value;
        currentKeyNode = 'start';
        keyHistoryPath = ['시작'];
        renderKeyNode();
      });
    }

    renderKeyNode();

    keyYesBtn.addEventListener('click', () => {
      const modeData = keyTreeModes[currentKeyMode].nodes;
      const node = modeData[currentKeyNode];
      if (node && !node.isResult) {
        keyHistoryPath.push('예');
        currentKeyNode = node.yes;
        renderKeyNode();
      }
    });

    keyNoBtn.addEventListener('click', () => {
      const modeData = keyTreeModes[currentKeyMode].nodes;
      const node = modeData[currentKeyNode];
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
    const modeData = keyTreeModes[currentKeyMode].nodes;
    const node = modeData[currentKeyNode];
    if (!node) return;

    keyPathText.textContent = `선택 경로: ${keyHistoryPath.join(' ➔ ')}`;

    if (node.isResult) {
      keyStepBadge.textContent = '🎉 최종 분류 도출';
      keyStepBadge.style.background = 'var(--accent-emerald)';
      keyStepBadge.style.color = '#ffffff';

      keyQuestionText.innerHTML = `
        <div style="font-size: 1.45rem; color: var(--accent-primary); margin-bottom: 0.6rem; font-weight: 800;">${node.title}</div>
        <p style="font-size: 0.95rem; font-weight: 500; line-height: 1.6; color: var(--text-secondary); margin-bottom: 0.8rem;">${node.desc}</p>
        <div style="font-size: 0.9rem; font-weight: 700; color: var(--accent-primary); background: var(--cat-physics-bg); padding: 0.55rem 0.95rem; border-radius: 10px; display: inline-block;">${node.examples}</div>
      `;

      keyYesBtn.style.display = 'none';
      keyNoBtn.style.display = 'none';
    } else {
      keyStepBadge.textContent = node.step;
      keyStepBadge.style.background = 'var(--accent-primary)';
      keyStepBadge.style.color = '#ffffff';

      keyQuestionText.textContent = `"${node.q}"`;

      keyYesBtn.style.display = 'inline-flex';
      keyNoBtn.style.display = 'inline-flex';
    }
  }

  // --- Section 5: Interactive Physics/Chemistry Simulators ---
  function initSimulators() {
    // 1. Energy Conservation Simulator
    function updateEnergySim() {
      const m = parseFloat(simMassInput.value);
      const h = parseFloat(simHeightInput.value);
      const v = parseFloat(simVelInput.value);

      if (massValSpan) massValSpan.textContent = m;
      if (heightValSpan) heightValSpan.textContent = h;
      if (velValSpan) velValSpan.textContent = v;

      const g = 9.8;
      const ep = Math.round(m * g * h * 10) / 10;
      const ek = Math.round(0.5 * m * v * v * 10) / 10;
      const totalE = Math.round((ep + ek) * 10) / 10;

      if (epValSpan) epValSpan.textContent = ep;
      if (ekValSpan) ekValSpan.textContent = ek;
      if (totalEValSpan) totalEValSpan.textContent = totalE;

      const maxE = Math.max(totalE, 400);
      const epPct = Math.min((ep / maxE) * 100, 100);
      const ekPct = Math.min((ek / maxE) * 100, 100);

      if (epBar) epBar.style.width = `${epPct}%`;
      if (ekBar) ekBar.style.width = `${ekPct}%`;
    }

    if (simMassInput) simMassInput.addEventListener('input', updateEnergySim);
    if (simHeightInput) simHeightInput.addEventListener('input', updateEnergySim);
    if (simVelInput) simVelInput.addEventListener('input', updateEnergySim);
    updateEnergySim();

    // 2. Humidity & Saturation Calculator
    function updateHumiditySim() {
      const t = parseFloat(simTempInput.value);
      const w = parseFloat(simVaporInput.value);

      if (tempValSpan) tempValSpan.textContent = t;
      if (vaporValSpan) vaporValSpan.textContent = w;

      // Tetens empirical equation for saturation vapor pressure / capacity
      const satVapor = Math.round(4.8 * Math.exp(0.062 * t) * 10) / 10;
      if (calcSatVaporSpan) calcSatVaporSpan.textContent = satVapor;

      const relHumidity = Math.min(Math.round((w / satVapor) * 100), 100);
      if (calcRelHumiditySpan) calcRelHumiditySpan.textContent = relHumidity;

      if (w >= satVapor) {
        humidityStatusSpan.textContent = '포화 상태 (이슬점에 도달하여 물방울 응결 발생!)';
        humidityStatusSpan.className = 'status-tag saturated';
      } else {
        const estDewPoint = Math.max((t - (100 - relHumidity) / 5), 0).toFixed(1);
        humidityStatusSpan.textContent = `불포화 상태 (이슬점: 약 ${estDewPoint} ℃)`;
        humidityStatusSpan.className = 'status-tag unsaturated';
      }
    }

    if (simTempInput) simTempInput.addEventListener('input', updateHumiditySim);
    if (simVaporInput) simVaporInput.addEventListener('input', updateHumiditySim);
    updateHumiditySim();

    // 3. Boyle & Charles Law Gas Particle Canvas
    if (gasCanvas) {
      gasCtx = gasCanvas.getContext('2d');
      resizeGasCanvas();
      setupGasParticles();

      if (gasTempInput) {
        gasTempInput.addEventListener('input', () => {
          if (gasTempDisplay) gasTempDisplay.textContent = gasTempInput.value;
          updateGasSim();
        });
      }

      if (gasPressureInput) {
        gasPressureInput.addEventListener('input', () => {
          if (gasPressureDisplay) gasPressureDisplay.textContent = gasPressureInput.value;
          updateGasSim();
        });
      }

      updateGasSim();
    }
  }

  function resizeGasCanvas() {
    if (!gasCanvas || !gasCanvas.parentElement) return;
    const parentWidth = gasCanvas.parentElement.clientWidth;
    if (parentWidth > 0) {
      gasCanvas.width = Math.min(parentWidth, 480);
    }
  }

  function setupGasParticles() {
    particles = [];
    const count = 38;
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * (gasCanvas.width - 30) + 15,
        y: Math.random() * (gasCanvas.height - 30) + 15,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        radius: 4
      });
    }
  }

  function updateGasSim() {
    const tempK = parseFloat(gasTempInput.value);
    const p = parseFloat(gasPressureInput.value);

    // V proportional to T / P
    const volPct = Math.min(Math.max(Math.round((tempK / p / 300) * 100), 20), 100);
    if (gasVolDisplay) gasVolDisplay.textContent = `${volPct}%`;

    const speedMult = Math.sqrt(tempK / 300);

    particles.forEach(pt => {
      const angle = Math.atan2(pt.vy, pt.vx);
      const currentSpeed = 3.2 * speedMult;
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
      const volPct = Math.min(Math.max((tempK / p / 300), 0.22), 1.0);
      const boxWidth = width * volPct;

      gasCtx.clearRect(0, 0, width, height);

      // Container bounding box
      gasCtx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
      gasCtx.lineWidth = 3;
      gasCtx.strokeRect(0, 0, boxWidth, height);

      // Moving Piston
      gasCtx.fillStyle = '#6366f1';
      gasCtx.fillRect(boxWidth - 4, 0, 8, height);

      // Render moving particles
      particles.forEach(pt => {
        pt.x += pt.vx;
        pt.y += pt.vy;

        // Bounce from walls
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
        gasCtx.fillStyle = '#38bdf8';
        gasCtx.shadowBlur = 6;
        gasCtx.shadowColor = '#38bdf8';
        gasCtx.fill();
        gasCtx.shadowBlur = 0;
      });

      animFrameId = requestAnimationFrame(renderFrame);
    }

    renderFrame();
  }
});
