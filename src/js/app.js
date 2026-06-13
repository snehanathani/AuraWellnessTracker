/**
 * @fileoverview Main frontend application logic.
 * Encapsulated within DOMContentLoaded to protect the global scope.
 * Uses zero-trust DOM updates, localStorage settings, and handles offline fallbacks.
 */

document.addEventListener('DOMContentLoaded', () => {
  // App state
  let logsState = [];
  let apiKey = localStorage.getItem('aura_api_key') || '';
  let openRouterKey = localStorage.getItem('aura_openrouter_api_key') || '';
  let openRouterModel = localStorage.getItem('aura_openrouter_model') || 'google/gemini-2.5-flash';
  let conversationHistory = [];
  let supabaseUrl = localStorage.getItem('aura_supabase_url') || '';
  let supabaseKey = localStorage.getItem('aura_supabase_key') || '';
  let supabaseClient = null;
  let currentUser = null;
  
  // Breathing coach states
  let breathingInterval = null;
  let breathingActive = false;
  let breathCycleIndex = 0;
  let breathSecondsRemaining = 0;
  let breathPhase = ''; // 'inhale', 'hold1', 'exhale', 'hold2'
  let breathCycleCount = 0;

  // DOM Elements - Navigation & Actions
  const btnQuickDemo = document.getElementById('btn-quick-demo');
  const btnOpenSettings = document.getElementById('btn-open-settings');
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const settingsModal = document.getElementById('settings-modal');
  const settingsForm = document.getElementById('settings-form');
  const apiKeyInput = document.getElementById('api-key-input');
  const openRouterKeyInput = document.getElementById('openrouter-key-input');
  const openRouterModelSelect = document.getElementById('openrouter-model-select');
  const btnClearSettings = document.getElementById('btn-clear-settings');
  
  // DOM Elements - Daily Logger
  const wellnessForm = document.getElementById('wellness-form');
  const moodSlider = document.getElementById('mood-slider');
  const moodValue = document.getElementById('mood-value');
  const sleepSlider = document.getElementById('sleep-slider');
  const sleepValue = document.getElementById('sleep-value');
  const stressSlider = document.getElementById('stress-slider');
  const stressValue = document.getElementById('stress-value');
  const journalInput = document.getElementById('journal-input');
  const btnAutofill = document.getElementById('btn-autofill');
  const validationAlerts = document.getElementById('validation-alerts');

  // DOM Elements - Dashboard States
  const dashboardEmpty = document.getElementById('dashboard-empty');
  const dashboardLoading = document.getElementById('dashboard-loading');
  const dashboardError = document.getElementById('dashboard-error');
  const errorMessageText = document.getElementById('error-message-text');
  const btnRetryAnalysis = document.getElementById('btn-retry-analysis');
  const dashboardActive = document.getElementById('dashboard-active');
  
  // DOM Elements - Metrics & Analytics
  const metricWellness = document.getElementById('metric-wellness');
  const badgeWellness = document.getElementById('badge-wellness');
  const metricBurnout = document.getElementById('metric-burnout');
  const badgeBurnout = document.getElementById('badge-burnout');
  const analysisPattern = document.getElementById('analysis-pattern');
  const triggersList = document.getElementById('triggers-list');
  const strategiesList = document.getElementById('strategies-list');
  
  // DOM Elements - Companion Chat
  const chatHistory = document.getElementById('chat-history');
  const chatInput = document.getElementById('chat-input');
  const btnChatSend = document.getElementById('btn-chat-send');

  // DOM Elements - Weekly Report
  const reportEmpty = document.getElementById('report-empty');
  const reportActive = document.getElementById('report-active');
  const reportChartContainer = document.getElementById('report-chart-container');
  const avgMoodText = document.getElementById('avg-mood');
  const avgSleepText = document.getElementById('avg-sleep');
  const avgBurnoutText = document.getElementById('avg-burnout');
  const btnPrintReport = document.getElementById('btn-print-report');
  const printDateSpan = document.getElementById('print-date');

  // DOM Elements - Breathing Coach
  const exerciseSelect = document.getElementById('exercise-select');
  const breathingCircle = document.getElementById('breathing-circle');
  const breathInstruction = document.getElementById('breath-instruction');
  const breathTimer = document.getElementById('breath-timer');
  const btnBreathControl = document.getElementById('btn-breath-control');

  // DOM Elements - Supabase & Authentication
  const supabaseUrlInput = document.getElementById('supabase-url-input');
  const supabaseKeyInput = document.getElementById('supabase-key-input');
  const authOverlay = document.getElementById('auth-overlay');
  const authForm = document.getElementById('auth-form');
  const authEmail = document.getElementById('auth-email');
  const authPassword = document.getElementById('auth-password');
  const btnAuthLogin = document.getElementById('btn-auth-login');
  const btnAuthSignup = document.getElementById('btn-auth-signup');
  const authAlerts = document.getElementById('auth-alerts');

  // Load existing logs from local storage on startup
  try {
    const savedLogs = localStorage.getItem('aura_wellness_logs');
    if (savedLogs) {
      logsState = JSON.parse(savedLogs);
    }
  } catch (err) {
    console.error('Failed to load logs from localStorage:', err);
    logsState = [];
  }

  // Pre-populate settings panel values
  if (apiKey) {
    apiKeyInput.value = apiKey;
  }
  if (openRouterKey) {
    openRouterKeyInput.value = openRouterKey;
  }
  if (openRouterModel) {
    openRouterModelSelect.value = openRouterModel;
  }
  if (supabaseUrl) {
    supabaseUrlInput.value = supabaseUrl;
  }
  if (supabaseKey) {
    supabaseKeyInput.value = supabaseKey;
  }

  // Initialize Supabase Client if credentials are provided
  if (supabaseUrl && supabaseKey) {
    try {
      if (typeof supabase !== 'undefined') {
        supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);
        setupSupabaseAuth();
      } else {
        console.error("Supabase script was not loaded from CDN.");
        authOverlay.style.display = 'none';
      }
    } catch (initErr) {
      console.error("Supabase initialization failed:", initErr);
      authOverlay.style.display = 'none';
    }
  } else {
    authOverlay.style.display = 'none';
  }

  // Initialize display
  updateDashboardAndReportUI();

  // --- Dynamic Slider Value Synchronizers ---
  moodSlider.addEventListener('input', (e) => {
    moodValue.textContent = e.target.value;
    moodSlider.setAttribute('aria-valuenow', e.target.value);
  });
  sleepSlider.addEventListener('input', (e) => {
    sleepValue.textContent = e.target.value;
    sleepSlider.setAttribute('aria-valuenow', e.target.value);
  });
  stressSlider.addEventListener('input', (e) => {
    stressValue.textContent = e.target.value;
    stressSlider.setAttribute('aria-valuenow', e.target.value);
  });

  // --- Settings Panel Drawer (Modal) Handling ---
  /**
   * Opens the settings modal and handles focus trap initialization.
   */
  function openSettings() {
    settingsModal.style.display = 'flex';
    btnOpenSettings.setAttribute('aria-expanded', 'true');
    apiKeyInput.focus();
    
    // Listen for Escape key to close modal
    document.addEventListener('keydown', handleEscapeKey);
  }

  /**
   * Closes the settings modal.
   */
  function closeSettings() {
    settingsModal.style.display = 'none';
    btnOpenSettings.setAttribute('aria-expanded', 'false');
    btnOpenSettings.focus();
    document.removeEventListener('keydown', handleEscapeKey);
  }

  /**
   * Closes settings on Escape key press.
   * @param {KeyboardEvent} e - The key event.
   */
  function handleEscapeKey(e) {
    if (e.key === 'Escape') {
      closeSettings();
    }
  }

  btnOpenSettings.addEventListener('click', openSettings);
  btnCloseSettings.addEventListener('click', closeSettings);
  
  // Close modal when clicking background overlay
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
      closeSettings();
    }
  });

  // Save Settings Form
  settingsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const cleanKey = apiKeyInput.value.trim();
    const cleanORKey = openRouterKeyInput.value.trim();
    const cleanORModel = openRouterModelSelect.value;
    const cleanSubURL = supabaseUrlInput.value.trim();
    const cleanSubKey = supabaseKeyInput.value.trim();

    localStorage.setItem('aura_api_key', cleanKey);
    localStorage.setItem('aura_openrouter_api_key', cleanORKey);
    localStorage.setItem('aura_openrouter_model', cleanORModel);
    localStorage.setItem('aura_supabase_url', cleanSubURL);
    localStorage.setItem('aura_supabase_key', cleanSubKey);

    apiKey = cleanKey;
    openRouterKey = cleanORKey;
    openRouterModel = cleanORModel;
    supabaseUrl = cleanSubURL;
    supabaseKey = cleanSubKey;

    closeSettings();
    alert('Settings saved successfully!');
    window.location.reload(); // Reload to re-initialize cloud auth state
  });

  // Clear API Keys
  btnClearSettings.addEventListener('click', () => {
    apiKeyInput.value = '';
    openRouterKeyInput.value = '';
    openRouterModelSelect.value = 'google/gemini-2.5-flash';
    supabaseUrlInput.value = '';
    supabaseKeyInput.value = '';

    localStorage.removeItem('aura_api_key');
    localStorage.removeItem('aura_openrouter_api_key');
    localStorage.removeItem('aura_openrouter_model');
    localStorage.removeItem('aura_supabase_url');
    localStorage.removeItem('aura_supabase_key');

    apiKey = '';
    openRouterKey = '';
    openRouterModel = 'google/gemini-2.5-flash';
    supabaseUrl = '';
    supabaseKey = '';
    alert('API keys cleared.');
    window.location.reload(); // Reload to clear cloud auth state
  });

  // --- Sample Journal Autofill ---
  btnAutofill.addEventListener('click', () => {
    const samples = [
      "I spent 10 hours at the coaching center today revising physics for the upcoming JEE mock test. Feeling okay but a bit anxious about the math percentile calculations.",
      "Woke up feeling extremely exhausted. I've been studying biology syllabus for NEET until 2 AM every night. I feel so much pressure from my parents regarding grades and rank.",
      "Today was a wonderful, relaxed day. I finished my revision schedule early, did a quick mock test, and took a walk. I feel calm and optimistic about the board exams."
    ];
    // Select sample randomly
    const randomSample = samples[Math.floor(Math.random() * samples.length)];
    
    // Clear validation alerts
    validationAlerts.style.display = 'none';
    validationAlerts.textContent = '';

    // Populate values based on text content
    journalInput.value = randomSample;
    
    if (randomSample.includes('wonderful') || randomSample.includes('relaxed')) {
      updateSliders(8, 8, 2);
    } else if (randomSample.includes('exhausted') || randomSample.includes('NEET')) {
      updateSliders(3, 4, 9);
    } else {
      updateSliders(6, 7, 5);
    }
  });

  /**
   * Helper to batch update sliders
   * @param {number} mood - Mood value.
   * @param {number} sleep - Sleep value.
   * @param {number} stress - Stress value.
   */
  function updateSliders(mood, sleep, stress) {
    moodSlider.value = mood;
    moodValue.textContent = mood;
    moodSlider.setAttribute('aria-valuenow', mood);

    sleepSlider.value = sleep;
    sleepValue.textContent = sleep;
    sleepSlider.setAttribute('aria-valuenow', sleep);

    stressSlider.value = stress;
    stressValue.textContent = stress;
    stressSlider.setAttribute('aria-valuenow', stress);
  }

  // --- Quick Start Demo Generator ---
  btnQuickDemo.addEventListener('click', () => {
    // Generate a 5-day historical mock dataset to showcase the Weekly Report chart
    const historicalMockData = [
      {
        date: getPastDateISO(4),
        mood: 7,
        sleep: 8,
        stress: 3,
        journal: "Woke up feeling positive. Did a light revision of biology syllabus for my board exams and went for a run.",
        wellnessScore: 78,
        burnoutIndex: 22,
        sentimentScore: 0.5,
        emotionalPattern: "Positive Outlook",
        detectedTriggers: ["academics (exams)"]
      },
      {
        date: getPastDateISO(3),
        mood: 6,
        sleep: 5,
        stress: 6,
        journal: "Finished a difficult mock test at the coaching institute. Got a lower percentile than expected. Commute back was crowded and loud.",
        wellnessScore: 58,
        burnoutIndex: 48,
        sentimentScore: -0.1,
        emotionalPattern: "Neutral",
        detectedTriggers: ["academics (exams)", "environment", "physical health"]
      },
      {
        date: getPastDateISO(2),
        mood: 3,
        sleep: 3,
        stress: 9,
        journal: "Very high stress today. Had a tough talk with my parents about my rank in the JEE mock test. I feel like I'm failing them and won't get into IIT. Insomnia kept me awake.",
        wellnessScore: 32,
        burnoutIndex: 88,
        sentimentScore: -0.5,
        emotionalPattern: "Stressed or Heavy Emotions",
        detectedTriggers: ["academics (exams)", "relationships", "physical health"]
      },
      {
        date: getPastDateISO(1),
        mood: 5,
        sleep: 7,
        stress: 4,
        journal: "Took a half-day break from studies. Did the box breathing mindfulness exercises. Felt better, though I still have minor anxiety about rent money bills.",
        wellnessScore: 61,
        burnoutIndex: 42,
        sentimentScore: 0.1,
        emotionalPattern: "Neutral",
        detectedTriggers: ["finances"]
      },
      {
        date: getPastDateISO(0), // Today
        mood: 7,
        sleep: 8,
        stress: 3,
        journal: "Feeling much more calm today. Wrote a gratitude list and drank water. Walked through the park.",
        wellnessScore: 79,
        burnoutIndex: 22,
        sentimentScore: 0.6,
        emotionalPattern: "Positive Outlook",
        detectedTriggers: []
      }
    ];

    logsState = historicalMockData;
    localStorage.setItem('aura_wellness_logs', JSON.stringify(logsState));
    
    // Also populate form with the hackathon challenge sample query
    const hackathonQuery = "I have been studying late every night to cover the vast UPSC syllabus. The IAS mock test is next Monday and my coaching percentiles are dropping. I haven't slept more than 4 hours a night. I'm feeling extremely exhausted, stressed, and full of self-doubt.";
    journalInput.value = hackathonQuery;
    updateSliders(3, 3, 9);
    
    updateDashboardAndReportUI();
    alert('Demo dataset generated! Review the Weekly Report chart, then click "Analyze & Save Entry" to run analysis on the pre-filled challenge statement.');
  });

  /**
   * Helper to format past ISO dates.
   * @param {number} daysAgo - Number of days in the past.
   * @returns {string} ISO date string (YYYY-MM-DD).
   */
  function getPastDateISO(daysAgo) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split('T')[0];
  }

  // --- Daily Log Form Submission ---
  wellnessForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const mood = parseInt(moodSlider.value, 10);
    const sleep = parseInt(sleepSlider.value, 10);
    const stress = parseInt(stressSlider.value, 10);
    const rawJournal = journalInput.value;
    
    const sanitizedJournal = sanitizeText(rawJournal);

    // Validate inputs
    const validation = validateLogInput(mood, sleep, stress, rawJournal);
    if (!validation.isValid) {
      displayValidationErrors(validation.errors);
      return;
    }
    
    // Clear validation alerts
    validationAlerts.style.display = 'none';
    validationAlerts.textContent = '';

    // Show loading state
    setDashboardState('loading');

    try {
      // Step 1: Run local analyzer logic
      const analysis = analyzeMoodAndTriggers(sanitizedJournal);
      const burnoutResult = calculateBurnoutIndex(mood, sleep, stress, analysis.detectedTriggers);
      // Let's assume 5 minutes of baseline mindfulness (or check if they did any today)
      const wellnessScore = calculateWellnessScore(mood, sleep, stress, burnoutResult.score, 5);
      const copingStrategies = generateCopingStrategies(mood, burnoutResult.score, analysis.detectedTriggers);

      // Initialize conversation history
      conversationHistory = [
        {
          role: "system",
          content: `You are "Aura", an empathetic mental wellness companion for competitive exams aspirants (JEE, NEET, UPSC, board exams). 
          Respond to their journal entries with warm, supportive, and practical emotional coaching (max 4 sentences). 
          Do NOT offer medical advice. Give constructive support.
          Current user state: Mood ${mood}/10, Burnout Index ${burnoutResult.score}/100, Triggers: ${analysis.detectedTriggers.join(', ') || 'None'}.`
        }
      ];

      // Step 2: Get companion chat response
      let companionResponseText = '';
      if (openRouterKey) {
        const userPrompt = `Here is my daily journal entry: "${sanitizedJournal}". My mood rating is ${mood}/10, sleep quality is ${sleep}/10, and stress is ${stress}/10. Please respond as my wellness companion.`;
        conversationHistory.push({ role: 'user', content: userPrompt });
        companionResponseText = await fetchOpenRouterResponse(conversationHistory);
        conversationHistory.push({ role: 'assistant', content: companionResponseText });
      } else if (apiKey) {
        companionResponseText = await fetchLiveGeminiResponse(apiKey, mood, burnoutResult.score, sanitizedJournal, analysis.detectedTriggers);
        conversationHistory.push({ role: 'user', content: `Here is my daily journal entry: "${sanitizedJournal}"` });
        conversationHistory.push({ role: 'assistant', content: companionResponseText });
      } else {
        // Fallback to offline rule-based response
        companionResponseText = generateCompanionResponse(mood, burnoutResult.score, sanitizedJournal, analysis.detectedTriggers);
        conversationHistory.push({ role: 'user', content: `Here is my daily journal entry: "${sanitizedJournal}"` });
        conversationHistory.push({ role: 'assistant', content: companionResponseText });
      }

      // Step 3: Save entry to state and persist
      const newEntry = {
        date: new Date().toISOString().split('T')[0],
        mood,
        sleep,
        stress,
        journal: sanitizedJournal,
        wellnessScore,
        burnoutIndex: burnoutResult.score,
        sentimentScore: analysis.sentimentScore,
        emotionalPattern: analysis.emotionalPattern,
        detectedTriggers: analysis.detectedTriggers,
        copingStrategies,
        companionResponse: companionResponseText
      };

      if (supabaseClient && currentUser) {
        newEntry.user_id = currentUser.id;
        try {
          // Remove old logs for today from database (to avoid duplicates)
          await supabaseClient
            .from('wellness_logs')
            .delete()
            .eq('user_id', currentUser.id)
            .eq('date', newEntry.date);

          const { error } = await supabaseClient
            .from('wellness_logs')
            .insert([newEntry]);
          
          if (error) throw error;
        } catch (dbErr) {
          console.warn("Failed syncing log to Supabase Cloud Database:", dbErr);
        }
      }

      // Prevent duplicate logs for the same day in our simple demo
      logsState = logsState.filter(item => item.date !== newEntry.date);
      logsState.push(newEntry);
      localStorage.setItem('aura_wellness_logs', JSON.stringify(logsState));

      // Step 4: Render active state dashboard & update charts
      renderActiveDashboard(newEntry);
      updateDashboardAndReportUI();

    } catch (err) {
      console.error('Analysis error:', err);
      setDashboardState('error', err.message || 'An unexpected error occurred during processing.');
    }
  });

  /**
   * Displays validation errors safely without using innerHTML.
   * @param {string[]} errors - List of error messages.
   */
  function displayValidationErrors(errors) {
    validationAlerts.textContent = '';
    
    const fragment = document.createDocumentFragment();
    const title = document.createElement('strong');
    title.textContent = 'Please correct the following fields:';
    fragment.appendChild(title);
    
    const list = document.createElement('ul');
    list.style.paddingLeft = '1.2rem';
    list.style.marginTop = '0.25rem';
    
    errors.forEach(err => {
      const item = document.createElement('li');
      item.textContent = err;
      list.appendChild(item);
    });
    
    fragment.appendChild(list);
    validationAlerts.appendChild(fragment);
    validationAlerts.style.display = 'flex';
    validationAlerts.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /**
   * Controls dashboard visibility states.
   * @param {'empty' | 'loading' | 'error' | 'active'} state - Selected view state.
   * @param {string} [errorMessage] - Optional message for error state.
   */
  function setDashboardState(state, errorMessage) {
    dashboardEmpty.style.display = 'none';
    dashboardLoading.style.display = 'none';
    dashboardError.style.display = 'none';
    dashboardActive.style.display = 'none';

    if (state === 'empty') {
      dashboardEmpty.style.display = 'flex';
    } else if (state === 'loading') {
      dashboardLoading.style.display = 'flex';
    } else if (state === 'error') {
      dashboardError.style.display = 'flex';
      if (errorMessage) {
        errorMessageText.textContent = errorMessage;
      }
    } else if (state === 'active') {
      dashboardActive.style.display = 'flex';
    }
  }

  btnRetryAnalysis.addEventListener('click', () => {
    setDashboardState('empty');
  });

  // --- Fetch Live Generative AI Response from Gemini ---
  /**
   * Connects to the live Google Gemini API to retrieve dynamic coaching suggestions.
   * Wraps requests in robust try/catch blocks with offline fallbacks.
   * 
   * @param {string} key - Gemini API key.
   * @param {number} mood - Mood score.
   * @param {number} burnout - Burnout score.
   * @param {string} journal - Journal entry text.
   * @param {string[]} triggers - List of triggers.
   * @returns {Promise<string>} Empathetic response text.
   */
  async function fetchLiveGeminiResponse(key, mood, burnout, journal, triggers) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
    const systemPrompt = `You are "Aura", a warm and professional mental wellness companion. 
    Analyze the user's current wellness parameters and write a concise, empathetic paragraph (max 4 sentences) of emotional coaching. 
    Do NOT offer diagnosing medical advice. Give constructive support.
    
    User Parameters:
    - Daily Mood Rating: ${mood}/10
    - Burnout Risk Index: ${burnout}/100
    - Logged Stress Triggers: ${triggers.join(', ') || 'None detected'}
    
    User Daily Journal Entry:
    "${journal}"`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: systemPrompt
            }]
          }]
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP Error status ${response.status}`);
      }

      const responseData = await response.json();
      
      if (
        responseData.candidates &&
        responseData.candidates[0] &&
        responseData.candidates[0].content &&
        responseData.candidates[0].content.parts &&
        responseData.candidates[0].content.parts[0]
      ) {
        return responseData.candidates[0].content.parts[0].text.trim();
      } else {
        throw new Error('Unexpected API response payload structure.');
      }
      
    } catch (apiError) {
      console.warn('Live API request failed. Reverting safely to offline companion algorithm:', apiError);
      // Notify the user via a console notification or small alert fallback
      return `[Offline fallback active] ${generateCompanionResponse(mood, burnout, journal, triggers)}`;
    }
  }

  /**
   * Connects to the OpenRouter completions API to get dynamic chatbot replies.
   * 
   * @param {object[]} messages - Conversational messages history state.
   * @returns {Promise<string>} OpenRouter completion response text.
   */
  async function fetchOpenRouterResponse(messages) {
    const endpoint = 'https://openrouter.ai/api/v1/chat/completions';
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openRouterKey}`
        },
        body: JSON.stringify({
          model: openRouterModel,
          messages: messages
        })
      });

      if (!response.ok) {
        throw new Error(`OpenRouter Error: status ${response.status}`);
      }

      const responseData = await response.json();
      
      if (
        responseData.choices &&
        responseData.choices[0] &&
        responseData.choices[0].message &&
        responseData.choices[0].message.content
      ) {
        return responseData.choices[0].message.content.trim();
      } else {
        throw new Error('Unexpected OpenRouter payload format.');
      }
    } catch (err) {
      console.warn('OpenRouter request failed, reverting to local companion response:', err);
      // fallback to offline message generator
      const lastEntry = logsState[logsState.length - 1];
      const mood = lastEntry ? lastEntry.mood : 6;
      const burnout = lastEntry ? lastEntry.burnoutIndex : 30;
      const triggers = lastEntry ? lastEntry.detectedTriggers : [];
      return `[Offline fallback active] ${generateCompanionResponse(mood, burnout, '', triggers)}`;
    }
  }

  // --- Dynamic DOM Renderer (Active Dashboard State) ---
  /**
   * Programmatically creates DOM elements for the analysis screen to prevent XSS (zero innerHTML).
   * @param {object} entry - The newly computed wellness entry.
   */
  function renderActiveDashboard(entry) {
    setDashboardState('active');

    // Set Scores
    metricWellness.textContent = entry.wellnessScore;
    metricBurnout.textContent = entry.burnoutIndex;
    analysisPattern.textContent = entry.emotionalPattern;

    // Apply status color classes to badges
    badgeWellness.className = 'metric-status';
    if (entry.wellnessScore >= 70) {
      badgeWellness.classList.add('status-good');
      badgeWellness.textContent = 'Thriving';
    } else if (entry.wellnessScore >= 45) {
      badgeWellness.classList.add('status-warning');
      badgeWellness.textContent = 'Balanced';
    } else {
      badgeWellness.classList.add('status-alert');
      badgeWellness.textContent = 'Struggling';
    }

    badgeBurnout.className = 'metric-status';
    if (entry.burnoutIndex >= 75) {
      badgeBurnout.classList.add('status-alert');
      badgeBurnout.textContent = 'Critical';
    } else if (entry.burnoutIndex >= 40) {
      badgeBurnout.classList.add('status-warning');
      badgeBurnout.textContent = 'Elevated';
    } else {
      badgeBurnout.classList.add('status-good');
      badgeBurnout.textContent = 'Optimal';
    }

    // Render Stress Triggers List
    triggersList.textContent = '';
    if (entry.detectedTriggers.length === 0) {
      const emptyTag = document.createElement('span');
      emptyTag.className = 'tag';
      emptyTag.textContent = 'No critical triggers detected';
      triggersList.appendChild(emptyTag);
    } else {
      const tagFragment = document.createDocumentFragment();
      entry.detectedTriggers.forEach(trig => {
        const tag = document.createElement('span');
        tag.className = 'tag tag-alert';
        
        const dot = document.createElement('span');
        dot.textContent = '• ';
        dot.style.color = 'var(--accent-rose)';
        
        tag.appendChild(dot);
        
        const textSpan = document.createElement('span');
        textSpan.textContent = trig;
        tag.appendChild(textSpan);
        
        tagFragment.appendChild(tag);
      });
      triggersList.appendChild(tagFragment);
    }

    // Render Coping Recommendations
    strategiesList.textContent = '';
    const strategyFragment = document.createDocumentFragment();
    entry.copingStrategies.forEach(strat => {
      const item = document.createElement('div');
      item.className = 'strategy-item';
      item.textContent = strat;
      strategyFragment.appendChild(item);
    });
    strategiesList.appendChild(strategyFragment);

    // Populate Companion Chat with dynamic feedback
    chatHistory.textContent = '';
    appendChatBubble('companion', entry.companionResponse);
  }

  /**
   * Safely adds a text chat bubble to the UI.
   * @param {'user' | 'companion'} sender - Who sent the message.
   * @param {string} text - Message body.
   */
  function appendChatBubble(sender, text) {
    const bubble = document.createElement('div');
    bubble.className = sender === 'user' ? 'chat-bubble bubble-user' : 'chat-bubble bubble-companion';
    bubble.textContent = text;
    chatHistory.appendChild(bubble);
    chatHistory.scrollTop = chatHistory.scrollHeight;
  }

  // --- Interactive Chat Messaging With Companion ---
  btnChatSend.addEventListener('click', () => {
    executeChatMessage();
  });

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      executeChatMessage();
    }
  });

  async function executeChatMessage() {
    const rawMsg = chatInput.value.trim();
    if (!rawMsg) return;

    const sanitizedMsg = sanitizeText(rawMsg);
    chatInput.value = '';

    // Append user message
    appendChatBubble('user', sanitizedMsg);

    // Show companion is thinking
    const thinkingBubble = document.createElement('div');
    thinkingBubble.className = 'chat-bubble bubble-companion';
    thinkingBubble.textContent = 'Typing...';
    thinkingBubble.style.opacity = '0.6';
    chatHistory.appendChild(thinkingBubble);
    chatHistory.scrollTop = chatHistory.scrollHeight;

    // Ensure conversation history has system prompt if not yet initialized
    if (conversationHistory.length === 0) {
      const lastEntry = logsState[logsState.length - 1];
      const mood = lastEntry ? lastEntry.mood : 6;
      const burnout = lastEntry ? lastEntry.burnoutIndex : 30;
      const triggers = lastEntry ? lastEntry.detectedTriggers : [];
      conversationHistory = [
        {
          role: "system",
          content: `You are "Aura", an empathetic mental wellness companion for competitive exams aspirants (JEE, NEET, UPSC, board exams). 
          Help them navigate academic stress, self-doubt, and burnout. Provide warm support and practical tips (max 4 sentences). 
          Do NOT offer medical advice.
          Current user state: Mood ${mood}/10, Burnout Index ${burnout}/100, Triggers: ${triggers.join(', ') || 'None'}.`
        }
      ];
    }

    // Append user prompt to history
    conversationHistory.push({ role: 'user', content: sanitizedMsg });

    if (openRouterKey) {
      try {
        const responseText = await fetchOpenRouterResponse(conversationHistory);
        thinkingBubble.remove();
        appendChatBubble('companion', responseText);
        conversationHistory.push({ role: 'assistant', content: responseText });
      } catch (err) {
        thinkingBubble.remove();
        const fallbackText = "I encountered an error connecting to my server. Let's take a deep breath together. Tell me, how can I support you right now?";
        appendChatBubble('companion', fallbackText);
        conversationHistory.push({ role: 'assistant', content: fallbackText });
      }
    } else {
      // Simulate reply after 1s (Offline fallback mode)
      setTimeout(() => {
        thinkingBubble.remove();
        
        const lastEntry = logsState[logsState.length - 1];
        const currentMood = lastEntry ? lastEntry.mood : 6;
        const currentBurnout = lastEntry ? lastEntry.burnoutIndex : 30;
        const currentTrigs = lastEntry ? lastEntry.detectedTriggers : [];

        let companionResponse = '';
        if (sanitizedMsg.toLowerCase().includes('help') || sanitizedMsg.toLowerCase().includes('coping')) {
          companionResponse = "I recommend focusing on your breathing. We can start a mindfulness session in the coach panel to help ease the tension.";
        } else if (sanitizedMsg.toLowerCase().includes('tired') || sanitizedMsg.toLowerCase().includes('sleep')) {
          companionResponse = "Rest is incredibly important. Please consider taking a short break away from screens and stretching.";
        } else {
          companionResponse = generateCompanionResponse(currentMood, currentBurnout, sanitizedMsg, currentTrigs);
        }

        appendChatBubble('companion', companionResponse);
        conversationHistory.push({ role: 'assistant', content: companionResponse });
      }, 1000);
    }
  }

  // --- Dashboards & Reports Core Synchronizer ---
  function updateDashboardAndReportUI() {
    if (logsState.length === 0) {
      setDashboardState('empty');
      reportEmpty.style.display = 'flex';
      reportActive.style.display = 'none';
      return;
    }

    // Sort logs by date to keep them linear
    logsState.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Update daily active dashboard with the most recent entry
    const lastEntry = logsState[logsState.length - 1];
    renderActiveDashboard(lastEntry);

    // Calculate Weekly Report Averages
    let moodSum = 0;
    let sleepSum = 0;
    let burnoutSum = 0;

    logsState.forEach(item => {
      moodSum += item.mood;
      sleepSum += item.sleep;
      burnoutSum += item.burnoutIndex;
    });

    const total = logsState.length;
    avgMoodText.textContent = (moodSum / total).toFixed(1) + '/10';
    avgSleepText.textContent = (sleepSum / total).toFixed(1) + '/10';
    avgBurnoutText.textContent = Math.round(burnoutSum / total) + '/100';

    // Toggle states
    reportEmpty.style.display = 'none';
    reportActive.style.display = 'flex';

    // Redraw SVG Chart safely (Prevent reflows, zero innerHTML)
    drawWeeklySVGChart();
  }

  // --- SVG Charting Module (Performance Optimized, No layout thrashing) ---
  /**
   * Programmatically draws a lightweight vector graphic of historical trends using standard SVG nodes.
   */
  function drawWeeklySVGChart() {
    reportChartContainer.textContent = '';
    
    // Create elements via SVG Namespace
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("viewBox", "0 0 500 150");
    svg.style.overflow = 'visible';

    // Chart margins and mapping coordinates
    const width = 450;
    const height = 110;
    const paddingLeft = 35;
    const paddingTop = 15;
    
    // Limit data points to last 7 entries for layout legibility
    const displayData = logsState.slice(-7);
    const numPoints = displayData.length;
    
    // Draw Y Axis reference lines
    for (let i = 0; i <= 4; i++) {
      const val = i * 25; // Score 0 to 100 scale
      const y = paddingTop + height - (val / 100) * height;
      
      const gridLine = document.createElementNS(svgNS, "line");
      gridLine.setAttribute("x1", paddingLeft);
      gridLine.setAttribute("y1", y);
      gridLine.setAttribute("x2", paddingLeft + width);
      gridLine.setAttribute("y2", y);
      gridLine.setAttribute("stroke", "rgba(255, 255, 255, 0.05)");
      gridLine.setAttribute("stroke-width", "1");
      svg.appendChild(gridLine);

      // Y Label
      const labelText = document.createElementNS(svgNS, "text");
      labelText.setAttribute("x", paddingLeft - 8);
      labelText.setAttribute("y", y + 4);
      labelText.setAttribute("fill", "var(--text-secondary)");
      labelText.setAttribute("font-size", "8");
      labelText.setAttribute("text-anchor", "end");
      labelText.textContent = val;
      svg.appendChild(labelText);
    }

    // Map point coordinates
    const points = [];
    const stepX = numPoints > 1 ? width / (numPoints - 1) : width;

    displayData.forEach((item, index) => {
      const x = paddingLeft + (index * stepX);
      // Map wellness score (0-100)
      const y = paddingTop + height - (item.wellnessScore / 100) * height;
      points.push({ x, y, score: item.wellnessScore, date: item.date });
    });

    // Draw lines connecting points
    if (points.length > 1) {
      let pathString = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        pathString += ` L ${points[i].x} ${points[i].y}`;
      }

      const trendLine = document.createElementNS(svgNS, "path");
      trendLine.setAttribute("d", pathString);
      trendLine.setAttribute("fill", "none");
      trendLine.setAttribute("stroke", "var(--accent)");
      trendLine.setAttribute("stroke-width", "2.5");
      trendLine.setAttribute("stroke-linecap", "round");
      trendLine.setAttribute("stroke-linejoin", "round");
      svg.appendChild(trendLine);
    }

    // Draw markers and bottom dates
    points.forEach(pt => {
      const circle = document.createElementNS(svgNS, "circle");
      circle.setAttribute("cx", pt.x);
      circle.setAttribute("cy", pt.y);
      circle.setAttribute("r", "4");
      circle.setAttribute("fill", "var(--bg-primary)");
      circle.setAttribute("stroke", "var(--accent)");
      circle.setAttribute("stroke-width", "2.5");
      
      // Accessibility tooltip alternative title
      const tooltip = document.createElementNS(svgNS, "title");
      tooltip.textContent = `Date: ${pt.date}, Wellness Score: ${pt.score}`;
      circle.appendChild(tooltip);
      
      svg.appendChild(circle);

      // X Label date (last 5 chars representing MM-DD)
      const dateText = document.createElementNS(svgNS, "text");
      dateText.setAttribute("x", pt.x);
      dateText.setAttribute("y", paddingTop + height + 16);
      dateText.setAttribute("fill", "var(--text-secondary)");
      dateText.setAttribute("font-size", "7");
      dateText.setAttribute("text-anchor", "middle");
      dateText.textContent = pt.date.slice(5);
      svg.appendChild(dateText);
    });

    // Draw Chart Title
    const chartTitle = document.createElementNS(svgNS, "text");
    chartTitle.setAttribute("x", paddingLeft);
    chartTitle.setAttribute("y", paddingTop - 4);
    chartTitle.setAttribute("fill", "var(--text-primary)");
    chartTitle.setAttribute("font-size", "9");
    chartTitle.setAttribute("font-weight", "600");
    chartTitle.textContent = "Wellness Score Progress Trends";
    svg.appendChild(chartTitle);

    reportChartContainer.appendChild(svg);
  }

  // --- Print Handler ---
  btnPrintReport.addEventListener('click', () => {
    printDateSpan.textContent = new Date().toLocaleString();
    window.print();
  });

  // --- Interactive Breathing Coach Module ---
  let breathCycleTimer = null;
  
  btnBreathControl.addEventListener('click', () => {
    if (breathingActive) {
      stopBreathingCoach();
    } else {
      startBreathingCoach();
    }
  });

  /**
   * Initializes the breathing exercise cycle based on configuration.
   */
  function startBreathingCoach() {
    breathingActive = true;
    btnBreathControl.textContent = 'Stop Breathing Session';
    btnBreathControl.className = 'btn btn-primary';
    
    // Determine exercise configuration
    const val = exerciseSelect.value;
    let exercise = null;
    
    if (val === 'adaptive') {
      const lastLog = logsState[logsState.length - 1];
      const mood = lastLog ? lastLog.mood : 6;
      const stress = lastLog ? lastLog.stress : 5;
      exercise = getAdaptiveMindfulnessExercise(mood, stress);
    } else if (val === 'box') {
      exercise = getAdaptiveMindfulnessExercise(5, 8); // Forces box breathing
    } else if (val === 'relax') {
      exercise = getAdaptiveMindfulnessExercise(2, 4); // Forces 4-7-8 relaxation
    } else {
      exercise = getAdaptiveMindfulnessExercise(7, 3); // Forces equal breathing
    }

    // Set Up Coach State Machine
    breathCycleCount = exercise.cycles;
    breathCycleIndex = 1;
    
    runBreathCyclePhase(exercise);
  }

  /**
   * Stops the breathing coach.
   */
  function stopBreathingCoach() {
    breathingActive = false;
    btnBreathControl.textContent = 'Start Breathing Session';
    btnBreathControl.className = 'btn btn-accent';
    
    if (breathingInterval) clearInterval(breathingInterval);
    if (breathCycleTimer) clearTimeout(breathCycleTimer);
    
    // Reset visuals
    breathingCircle.className = 'breathing-circle';
    breathInstruction.textContent = 'Breathing paused';
    breathTimer.textContent = 'Ready to start when you are';
  }

  /**
   * Loops through phase timings of the breathing routine.
   * @param {object} ex - Breathing routine parameters.
   */
  function runBreathCyclePhase(ex) {
    if (!breathingActive) return;

    if (breathCycleIndex > breathCycleCount) {
      stopBreathingCoach();
      breathInstruction.textContent = 'Session complete!';
      breathTimer.textContent = 'Wonderful job. You completed your mindfulness practice.';
      return;
    }

    // Sequence of phases: inhale -> hold1 -> exhale -> hold2
    const phases = [];
    if (ex.inhale > 0) phases.push({ name: 'inhale', duration: ex.inhale, label: 'Inhale...', class: 'breath-inhale' });
    if (ex.hold1 > 0) phases.push({ name: 'hold1', duration: ex.hold1, label: 'Hold breath...', class: 'breath-hold' });
    if (ex.exhale > 0) phases.push({ name: 'exhale', duration: ex.exhale, label: 'Exhale...', class: 'breath-exhale' });
    if (ex.hold2 > 0) phases.push({ name: 'hold2', duration: ex.hold2, label: 'Hold breath...', class: 'breath-hold' });

    let phaseIndex = 0;

    function executeNextPhase() {
      if (!breathingActive) return;

      if (phaseIndex >= phases.length) {
        // Complete current cycle and start next
        breathCycleIndex++;
        runBreathCyclePhase(ex);
        return;
      }

      const current = phases[phaseIndex];
      breathPhase = current.name;
      breathSecondsRemaining = current.duration;

      // Update UI classes and text
      breathingCircle.className = 'breathing-circle ' + current.class;
      // Add transitions overrides dynamically based on phase length to make it super smooth
      breathingCircle.style.transition = `transform ${current.duration}s cubic-bezier(0.4, 0, 0.2, 1), background-color 1s ease`;
      
      breathInstruction.textContent = current.label;
      breathTimer.textContent = `Cycle ${breathCycleIndex} of ${breathCycleCount} | ${breathSecondsRemaining}s left`;

      // Tick counter interval
      if (breathingInterval) clearInterval(breathingInterval);
      breathingInterval = setInterval(() => {
        breathSecondsRemaining--;
        if (breathSecondsRemaining > 0) {
          breathTimer.textContent = `Cycle ${breathCycleIndex} of ${breathCycleCount} | ${breathSecondsRemaining}s left`;
        } else {
          clearInterval(breathingInterval);
        }
      }, 1000);

      // Schedule next phase transition
      if (breathCycleTimer) clearTimeout(breathCycleTimer);
      breathCycleTimer = setTimeout(() => {
        phaseIndex++;
        executeNextPhase();
      }, current.duration * 1000);
    }

    executeNextPhase();
  }

  // --- Supabase Cloud Auth Methods ---
  function setupSupabaseAuth() {
    if (!supabaseClient) return;
    
    // Check initial session
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      handleUserSession(session);
    }).catch(err => {
      console.warn("Supabase session fetching error:", err);
    });

    // Listen for session changes
    supabaseClient.auth.onAuthStateChange((_event, session) => {
      handleUserSession(session);
    });

    // Login Submission
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      authAlerts.style.display = 'none';
      authAlerts.textContent = '';

      const email = authEmail.value.trim();
      const password = authPassword.value;

      try {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } catch (err) {
        displayAuthError(err.message || "Login failed.");
      }
    });

    // Signup Click
    btnAuthSignup.addEventListener('click', async () => {
      authAlerts.style.display = 'none';
      authAlerts.textContent = '';

      const email = authEmail.value.trim();
      const password = authPassword.value;

      if (!email || !password) {
        displayAuthError("Email and Password are required to sign up.");
        return;
      }

      try {
        const { error } = await supabaseClient.auth.signUp({ email, password });
        if (error) throw error;
        alert("Sign-up request received! If email confirmation is enabled, check your inbox; otherwise you can log in immediately.");
      } catch (err) {
        displayAuthError(err.message || "Signup failed.");
      }
    });
  }

  function handleUserSession(session) {
    if (session && session.user) {
      currentUser = session.user;
      authOverlay.style.display = 'none';
      loadCloudLogs();
    } else {
      currentUser = null;
      authOverlay.style.display = 'flex';
      logsState = [];
      updateDashboardAndReportUI();
    }
  }

  async function loadCloudLogs() {
    if (!supabaseClient || !currentUser) return;
    try {
      const { data, error } = await supabaseClient
        .from('wellness_logs')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('date', { ascending: true });

      if (error) throw error;
      if (data) {
        logsState = data;
        updateDashboardAndReportUI();
      }
    } catch (err) {
      console.warn("Could not load logs from Supabase Cloud Database:", err);
    }
  }

  function displayAuthError(msg) {
    authAlerts.textContent = msg;
    authAlerts.style.display = 'block';
  }
});
