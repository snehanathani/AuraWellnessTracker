/**
 * @fileoverview Pure utility functions for the Mental Wellness Tracker.
 * Handles validation, scoring, burnout prediction, trigger analysis, and recommendations.
 */

/**
 * Sanitizes input text to prevent simple cross-site scripting (XSS) attacks.
 * Converts characters like <, >, &, ", and ' into their HTML entities.
 * 
 * @param {string} text - Raw input text.
 * @returns {string} Sanitized text.
 */
function sanitizeText(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Validates the daily log inputs.
 * 
 * @param {number} mood - Mood rating (1-10).
 * @param {number} sleep - Sleep rating (1-10).
 * @param {number} stress - Stress level (1-10).
 * @param {string} journal - Daily journal entry text.
 * @returns {{isValid: boolean, errors: string[]}} Validation result.
 */
function validateLogInput(mood, sleep, stress, journal) {
  const errors = [];
  
  if (typeof mood !== 'number' || isNaN(mood) || mood < 1 || mood > 10) {
    errors.push('Mood score must be a number between 1 and 10.');
  }
  
  if (typeof sleep !== 'number' || isNaN(sleep) || sleep < 1 || sleep > 10) {
    errors.push('Sleep score must be a number between 1 and 10.');
  }
  
  if (typeof stress !== 'number' || isNaN(stress) || stress < 1 || stress > 10) {
    errors.push('Stress score must be a number between 1 and 10.');
  }
  
  if (typeof journal !== 'string' || journal.trim().length === 0) {
    errors.push('Journal entry cannot be empty.');
  } else if (journal.trim().length < 10) {
    errors.push('Journal entry should be at least 10 characters long for an effective analysis.');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Analyzes journal text for positive/negative emotional patterns and detects stress triggers.
 * 
 * @param {string} journalText - Raw journal entry text.
 * @returns {{
 *   sentimentScore: number,
 *   detectedTriggers: string[],
 *   emotionalPattern: string
 * }} Result of mood and trigger analysis.
 */
function analyzeMoodAndTriggers(journalText) {
  const cleanedText = (journalText || '').toLowerCase();
  
  // Keyword catalogs
  const positiveWords = [
    'happy', 'excited', 'glad', 'joy', 'peace', 'calm', 'grateful', 'good', 
    'great', 'content', 'satisfied', 'wonderful', 'relaxed', 'serene', 
    'proud', 'accomplished', 'optimistic', 'blessed', 'inspired', 'energetic'
  ];
  
  const negativeWords = [
    'sad', 'angry', 'stressed', 'anxious', 'worried', 'unhappy', 'depressed', 
    'frustrated', 'tired', 'exhausted', 'lonely', 'fear', 'scared', 'panicked',
    'annoyed', 'disappointed', 'hopeless', 'overwhelmed', 'hurt', 'miserable'
  ];
  
  const triggerMap = {
    'workplace': ['work', 'boss', 'office', 'deadline', 'job', 'manager', 'colleague', 'meeting', 'presentation', 'client'],
    'academics (exams)': ['exam', 'test', 'study', 'grades', 'homework', 'professor', 'class', 'school', 'university', 'college', 'neet', 'jee', 'cuet', 'cat', 'gate', 'upsc', 'board exam', 'coaching', 'mock test', 'revision', 'syllabus', 'rank', 'percentile', 'aspirant', 'preparation', 'iit', 'aiims'],
    'finances': ['money', 'bills', 'debt', 'rent', 'expenses', 'cost', 'broke', 'loan', 'credit', 'financial'],
    'relationships': ['argument', 'fight', 'partner', 'friend', 'breakup', 'family', 'parent', 'spouse', 'relationship', 'conflict'],
    'physical health': ['tired', 'insomnia', 'sick', 'ill', 'pain', 'headache', 'fatigue', 'hurt', 'exhausted', 'sleepy'],
    'environment': ['noise', 'traffic', 'crowd', 'commute', 'weather', 'construction', 'loud', 'messy', 'cluttered']
  };

  let positiveCount = 0;
  let negativeCount = 0;
  
  // Count emotional words
  positiveWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'g');
    const matches = cleanedText.match(regex);
    if (matches) positiveCount += matches.length;
  });
  
  negativeWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'g');
    const matches = cleanedText.match(regex);
    if (matches) negativeCount += matches.length;
  });

  // Detect stress triggers
  const detectedTriggers = [];
  for (const [category, keywords] of Object.entries(triggerMap)) {
    const matchFound = keywords.some(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      return regex.test(cleanedText);
    });
    if (matchFound) {
      detectedTriggers.push(category);
    }
  }

  // Calculate sentiment score (-1 to +1)
  const totalEmotionalWords = positiveCount + negativeCount;
  let sentimentScore = 0;
  if (totalEmotionalWords > 0) {
    sentimentScore = (positiveCount - negativeCount) / totalEmotionalWords;
  } else {
    // Fallback if no matching emotional keywords are present
    sentimentScore = 0;
  }

  // Determine emotional pattern
  let emotionalPattern = 'Neutral';
  if (sentimentScore > 0.2) {
    emotionalPattern = 'Positive Outlook';
  } else if (sentimentScore < -0.2) {
    emotionalPattern = 'Stressed or Heavy Emotions';
  } else if (positiveCount > 0 && negativeCount > 0) {
    emotionalPattern = 'Mixed Emotions';
  }

  return {
    sentimentScore,
    detectedTriggers,
    emotionalPattern
  };
}

/**
 * Predicts burnout index based on sleep, stress levels, mood, and stress triggers.
 * Returns a value between 0 and 100, and a categorization.
 * 
 * @param {number} mood - Mood rating (1-10).
 * @param {number} sleep - Sleep rating (1-10).
 * @param {number} stress - Stress level (1-10).
 * @param {string[]} stressTriggers - Array of detected stress triggers.
 * @returns {{score: number, level: string, desc: string}} Burnout risk details.
 */
function calculateBurnoutIndex(mood, sleep, stress, stressTriggers) {
  // Check parameter bounds
  const validMood = Math.max(1, Math.min(10, mood));
  const validSleep = Math.max(1, Math.min(10, sleep));
  const validStress = Math.max(1, Math.min(10, stress));
  const triggerCount = Array.isArray(stressTriggers) ? stressTriggers.length : 0;

  // Weighted calculation:
  // - High stress adds up to 45 pts (stress * 4.5)
  // - Poor sleep adds up to 25 pts ((10 - sleep) * 2.5)
  // - Low mood adds up to 15 pts ((10 - mood) * 1.5)
  // - Triggers count adds up to 20 pts (count * 5.0, capped at 20)
  const stressPt = validStress * 4.5;
  const sleepPt = (10 - validSleep) * 2.5;
  const moodPt = (10 - validMood) * 1.5;
  const triggerPt = Math.min(20, triggerCount * 5.0);

  let score = Math.round(stressPt + sleepPt + moodPt + triggerPt);
  score = Math.max(0, Math.min(100, score));

  let level = 'Low';
  let desc = 'Your burnout risk is low. Maintain your current work-life balance and self-care routine.';

  if (score > 30 && score <= 60) {
    level = 'Moderate';
    desc = 'Moderate burnout signals detected. Consider planning short breaks and protecting your boundaries.';
  } else if (score > 60 && score <= 85) {
    level = 'High';
    desc = 'High risk of burnout. You are dealing with significant stressors and inadequate rest. Please prioritize downtime.';
  } else if (score > 85) {
    level = 'Critical';
    desc = 'Critical burnout warning. Please stop, delegate tasks where possible, and seek professional support or immediate recovery time.';
  }

  return {
    score,
    level,
    desc
  };
}

/**
 * Calculates wellness score based on mood, sleep, stress, burnout, and mindfulness exercises.
 * Returns a value between 0 and 100.
 * 
 * @param {number} mood - Mood rating (1-10).
 * @param {number} sleep - Sleep rating (1-10).
 * @param {number} stress - Stress level (1-10).
 * @param {number} burnoutScore - Burnout score (0-100).
 * @param {number} mindfulnessMinutes - Daily mindfulness duration in minutes.
 * @returns {number} Combined wellness score (0-100).
 */
function calculateWellnessScore(mood, sleep, stress, burnoutScore, mindfulnessMinutes) {
  const validMood = Math.max(1, Math.min(10, mood));
  const validSleep = Math.max(1, Math.min(10, sleep));
  const validStress = Math.max(1, Math.min(10, stress));
  const validBurnout = Math.max(0, Math.min(100, burnoutScore));
  const validMindfulness = Math.max(0, mindfulnessMinutes);

  // Wellness weights:
  // - Mood: 25% (mood * 2.5)
  // - Sleep: 25% (sleep * 2.5)
  // - Stress Management (inverse of stress): 20% ((11 - stress) * 2.0)
  // - Burnout Resilience (inverse of burnout): 20% ((100 - burnout) * 0.2)
  // - Mindfulness Bonus: 10% (mindfulness minutes * 1.0, capped at 10)
  const moodVal = validMood * 2.5;
  const sleepVal = validSleep * 2.5;
  const stressVal = (11 - validStress) * 2.0;
  const burnoutVal = (100 - validBurnout) * 0.2;
  const mindfulnessVal = Math.min(10, validMindfulness * 1.0);

  let score = Math.round(moodVal + sleepVal + stressVal + burnoutVal + mindfulnessVal);
  return Math.max(0, Math.min(100, score));
}

/**
 * Generates personalized coping strategies based on mood, burnout, and stress triggers.
 * 
 * @param {number} mood - Mood rating (1-10).
 * @param {number} burnoutScore - Burnout rating (0-100).
 * @param {string[]} triggers - Array of detected stress triggers.
 * @returns {string[]} List of actionable coping strategies.
 */
function generateCopingStrategies(mood, burnoutScore, triggers) {
  const strategies = [];

  // Low mood strategy
  if (mood <= 4) {
    strategies.push('Practice the "Three-Minute Breathing Space" exercise to center your thoughts and ease emotional pressure.');
    strategies.push('Write down 3 tiny things that you appreciate or feel neutral about to counter the negativity bias.');
  } else if (mood <= 6) {
    strategies.push('Incorporate a moderate physical activity (like a 15-minute walk) to boost your endorphins naturally.');
  } else {
    strategies.push('Document this positive mood state in detail so you can recall it as an emotional anchor in harder times.');
  }

  // Burnout level strategy
  if (burnoutScore > 75) {
    strategies.push('A "No-Screen" wind-down routine is highly recommended. Disconnect from devices 2 hours before bed.');
    strategies.push('Practice setting clear boundaries today. Say "no" or request extensions on non-critical tasks.');
  } else if (burnoutScore > 40) {
    strategies.push('Schedule a 10-minute "worry time" block, then consciously pivot to an activity that brings you joy.');
  }

  // Trigger-based strategies
  if (triggers.includes('workplace')) {
    strategies.push('Try the Pomodoro Technique (25m work, 5m break) to reduce workplace pressure and mental fatigue.');
  }
  if (triggers.includes('academics (exams)')) {
    strategies.push('Break down your study topics and syllabus into tiny micro-goals. Complete one simple concept first to rebuild confidence without stress about your final rank.');
  }
  if (triggers.includes('finances')) {
    strategies.push('Focus on what is within your control today. Set aside 10 minutes to review a simplified budget template without judgment.');
  }
  if (triggers.includes('relationships')) {
    strategies.push('Use "I feel" statements in communication to express boundaries without raising defensive reactions.');
  }
  if (triggers.includes('physical health')) {
    strategies.push('Prioritize a warm bath or a gentle stretch session. Treat your body with kindness and rest.');
  }
  if (triggers.includes('environment')) {
    strategies.push('Utilize noise-canceling headphones, change your workspace, or declutter your immediate desk for 5 minutes.');
  }

  // Default fallback if no flags triggered
  if (strategies.length < 3) {
    strategies.push('Commit to 5 minutes of mindful reflection or journaling at the same time tomorrow to build a baseline.');
    strategies.push('Ensure you drink at least 8 glasses of water today, as mild dehydration directly affects mood stability.');
  }

  return strategies;
}

/**
 * Returns a list of adaptive mindfulness exercises tailored to mood and stress levels.
 * 
 * @param {number} mood - Mood rating (1-10).
 * @param {number} stress - Stress level (1-10).
 * @returns {{
 *   name: string,
 *   type: string,
 *   duration: string,
 *   instructions: string,
 *   cycles: number,
 *   inhale: number,
 *   hold1: number,
 *   exhale: number,
 *   hold2: number
 * }} Tailored breathing exercise config.
 */
function getAdaptiveMindfulnessExercise(mood, stress) {
  if (stress >= 7) {
    return {
      name: 'Box Breathing (Calm Alertness)',
      type: 'box',
      duration: '4 minutes',
      instructions: 'Ideal for acute stress and sensory overload. Resets the nervous system by balancing CO2 levels.',
      cycles: 4,
      inhale: 4,
      hold1: 4,
      exhale: 4,
      hold2: 4
    };
  } else if (mood <= 4) {
    return {
      name: '4-7-8 Breathing (Deep Relaxation)',
      type: 'relax',
      duration: '5 minutes',
      instructions: 'A natural tranquilizer for the nervous system. Helps quiet racing thoughts and assists sleep.',
      cycles: 4,
      inhale: 4,
      hold1: 7,
      exhale: 8,
      hold2: 0
    };
  } else {
    return {
      name: 'Equal Breathing (Resonant Balance)',
      type: 'equal',
      duration: '3 minutes',
      instructions: 'Balances energetic flows and increases concentration. Great for daily maintenance.',
      cycles: 5,
      inhale: 5,
      hold1: 0,
      exhale: 5,
      hold2: 0
    };
  }
}

/**
 * Generates an empathetic offline AI companion coaching response based on wellness logs.
 * 
 * @param {number} mood - Mood rating (1-10).
 * @param {number} burnout - Burnout score (0-100).
 * @param {string} journalText - Daily journal text.
 * @param {string[]} triggers - Detected stress triggers.
 * @returns {string} Empathetic companion response.
 */
function generateCompanionResponse(mood, burnout, journalText, triggers) {
  const name = 'Aura';
  let greeting = 'Hello there. I\'m ' + name + ', your wellness companion. ';
  
  if (mood >= 8) {
    greeting += 'It is wonderful to read about your positive energy today! ';
  } else if (mood >= 5) {
    greeting += 'I hear you, and I am glad you took a moment to check in with yourself. ';
  } else {
    greeting += 'I am so sorry things feel heavy right now. I am here with you, and it\'s completely okay to feel this way. ';
  }

  let triggerNotice = '';
  if (triggers.length > 0) {
    const triggerWord = triggers.length === 1 ? 'trigger' : 'triggers';
    triggerNotice = `I noticed that ${triggers.join(' and ')} might be acting as stress ${triggerWord} for you today. Remember that acknowledging these sources is the first step toward releasing their control. `;
  }

  let body = '';
  if (burnout > 75) {
    body = 'Your burnout risk is currently sitting at a critical level. Please give yourself permission to step back and rest. You do not have to carry all of this on your own. ';
  } else if (burnout > 40) {
    body = 'You are carrying a moderate amount of tension. Try to establish a clear finish line for your duties today so your mind can fully step away. ';
  } else {
    body = 'Your overall energy indicators look stable. This is a great time to practice preventive care—perhaps doing a quick stretch or enjoying a quiet cup of tea. ';
  }

  let closing = 'Remember: taking care of yourself is not a luxury, it is a necessity. How does doing a brief breathing exercise sound right now?';
  
  return greeting + triggerNotice + body + closing;
}

// Export module for Node/Jest environment, keep functional for vanilla browser imports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    sanitizeText,
    validateLogInput,
    analyzeMoodAndTriggers,
    calculateBurnoutIndex,
    calculateWellnessScore,
    generateCopingStrategies,
    getAdaptiveMindfulnessExercise,
    generateCompanionResponse
  };
}
