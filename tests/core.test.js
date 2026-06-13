/**
 * @fileoverview Jest tests for the core business logic of the Mental Wellness Tracker.
 */

const {
  sanitizeText,
  validateLogInput,
  analyzeMoodAndTriggers,
  calculateBurnoutIndex,
  calculateWellnessScore,
  generateCopingStrategies,
  getAdaptiveMindfulnessExercise,
  generateCompanionResponse
} = require('../src/js/core');

describe('Security & Sanitization', () => {
  test('should escape HTML tags and characters to prevent XSS', () => {
    const dangerousText = '<script>alert("hack")</script> & "hello"';
    const cleanText = sanitizeText(dangerousText);
    expect(cleanText).not.toContain('<script>');
    expect(cleanText).toContain('&lt;script&gt;');
    expect(cleanText).toContain('&amp;');
    expect(cleanText).toContain('&quot;');
  });

  test('should handle non-string inputs safely', () => {
    expect(sanitizeText(null)).toBe('');
    expect(sanitizeText(undefined)).toBe('');
    expect(sanitizeText(123)).toBe('');
  });
});

describe('Input Validation', () => {
  test('should validate correct logging inputs successfully', () => {
    const result = validateLogInput(7, 8, 4, 'I had a very productive day but feel a bit tired now.');
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should fail when mood, sleep, or stress are out of bounds', () => {
    const resultLow = validateLogInput(0, 8, 4, 'Valid journal length text here.');
    const resultHigh = validateLogInput(11, 8, 4, 'Valid journal length text here.');
    const resultFloat = validateLogInput(5, 12, -1, 'Valid journal length text here.');

    expect(resultLow.isValid).toBe(false);
    expect(resultHigh.isValid).toBe(false);
    expect(resultFloat.isValid).toBe(false);
    expect(resultLow.errors[0]).toContain('Mood score');
    expect(resultHigh.errors[0]).toContain('Mood score');
  });

  test('should fail when journal is empty or too short', () => {
    const resultEmpty = validateLogInput(5, 5, 5, '');
    const resultShort = validateLogInput(5, 5, 5, 'Short');

    expect(resultEmpty.isValid).toBe(false);
    expect(resultShort.isValid).toBe(false);
    expect(resultEmpty.errors[0]).toContain('cannot be empty');
    expect(resultShort.errors[0]).toContain('at least 10 characters');
  });
});

describe('Mood & Stress Trigger Analysis', () => {
  test('should detect emotional sentiment correctly', () => {
    const journalText = 'I feel happy, peaceful, and excited about the new project! It is a wonderful day.';
    const analysis = analyzeMoodAndTriggers(journalText);
    
    expect(analysis.sentimentScore).toBeGreaterThan(0.2);
    expect(analysis.emotionalPattern).toBe('Positive Outlook');
  });

  test('should identify stress triggers from keywords', () => {
    const journalText = 'I have a huge project deadline today. My boss called for an emergency meeting and the office commute is packed with traffic. I feel very tired and exhausted.';
    const analysis = analyzeMoodAndTriggers(journalText);

    expect(analysis.detectedTriggers).toContain('workplace');
    expect(analysis.detectedTriggers).toContain('environment');
    expect(analysis.detectedTriggers).toContain('physical health');
    expect(analysis.sentimentScore).toBeLessThan(-0.2);
    expect(analysis.emotionalPattern).toBe('Stressed or Heavy Emotions');
  });

  test('should handle neutral entries gracefully', () => {
    const journalText = 'Today I woke up at seven, read some pages, and walked outside.';
    const analysis = analyzeMoodAndTriggers(journalText);

    expect(analysis.sentimentScore).toBe(0);
    expect(analysis.emotionalPattern).toBe('Neutral');
    expect(analysis.detectedTriggers).toHaveLength(0);
  });
});

describe('Burnout Prediction', () => {
  test('should calculate correct burnout risk score and level limits', () => {
    // Highly relaxed case: high mood (10), high sleep (10), low stress (1), no triggers
    const lowBurnout = calculateBurnoutIndex(10, 10, 1, []);
    expect(lowBurnout.score).toBeLessThanOrEqual(30);
    expect(lowBurnout.level).toBe('Low');

    // Moderate stress case
    const modBurnout = calculateBurnoutIndex(6, 6, 5, ['workplace']);
    expect(modBurnout.score).toBeGreaterThan(30);
    expect(modBurnout.score).toBeLessThanOrEqual(60);
    expect(modBurnout.level).toBe('Moderate');

    // High stress case: low mood (3), low sleep (4), high stress (8), multiple triggers
    const highBurnout = calculateBurnoutIndex(3, 4, 8, ['workplace', 'finances', 'relationships']);
    expect(highBurnout.score).toBeGreaterThan(60);
    expect(highBurnout.level).toBe('High');

    // Critical stress case: lowest mood (1), lowest sleep (1), highest stress (10), multiple triggers
    const criticalBurnout = calculateBurnoutIndex(1, 1, 10, ['workplace', 'finances', 'relationships', 'physical health']);
    expect(criticalBurnout.score).toBe(100);
    expect(criticalBurnout.level).toBe('Critical');
  });
});

describe('Wellness Scoring', () => {
  test('should return 100 for optimal mental states', () => {
    // Mood = 10, Sleep = 10, Stress = 1, Burnout = 0, Mindfulness = 10 minutes
    const score = calculateWellnessScore(10, 10, 1, 0, 10);
    expect(score).toBe(100);
  });

  test('should factor in mindfulness bonus and clamp to 100', () => {
    const scoreWithoutMindfulness = calculateWellnessScore(8, 8, 3, 20, 0);
    const scoreWithMindfulness = calculateWellnessScore(8, 8, 3, 20, 10);
    
    expect(scoreWithMindfulness).toBeGreaterThan(scoreWithoutMindfulness);
    expect(calculateWellnessScore(10, 10, 1, 0, 30)).toBe(100); // capped at 100
  });

  test('should handle minimal scores gracefully', () => {
    const score = calculateWellnessScore(1, 1, 10, 100, 0);
    expect(score).toBeLessThan(10);
    expect(score).toBeGreaterThanOrEqual(0);
  });
});

describe('Coping Strategies & Adaptive Mindfulness', () => {
  test('should recommend relevant strategy lists based on inputs', () => {
    const lowMoodStrategies = generateCopingStrategies(2, 80, ['workplace']);
    
    // Low mood strategy check
    expect(lowMoodStrategies.some(s => s.includes('Three-Minute Breathing Space'))).toBe(true);
    // Burnout boundary check
    expect(lowMoodStrategies.some(s => s.includes('setting clear boundaries'))).toBe(true);
    // Trigger workplace Pomodoro check
    expect(lowMoodStrategies.some(s => s.includes('Pomodoro Technique'))).toBe(true);
  });

  test('should recommend adaptive breathing exercises', () => {
    // High stress gets box breathing
    const highStressExercise = getAdaptiveMindfulnessExercise(5, 8);
    expect(highStressExercise.type).toBe('box');

    // Low mood (with lower stress) gets 4-7-8 relaxation
    const lowMoodExercise = getAdaptiveMindfulnessExercise(2, 4);
    expect(lowMoodExercise.type).toBe('relax');

    // Default gets equal breathing
    const normalExercise = getAdaptiveMindfulnessExercise(7, 3);
    expect(normalExercise.type).toBe('equal');
  });
});

describe('AI Companion Coaching Response', () => {
  test('should construct empathetic text responding to stressors and burnout', () => {
    const triggers = ['workplace', 'finances'];
    const response = generateCompanionResponse(3, 85, 'Stressed about job deadlines and unpaid rent bills.', triggers);
    
    expect(response).toContain('Aura');
    expect(response).toContain('workplace and finances');
    expect(response).toContain('critical level');
    expect(response).toContain('breathing exercise');
  });
});
