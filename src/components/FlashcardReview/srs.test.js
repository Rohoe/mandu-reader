import { describe, it, expect, beforeEach, vi } from 'vitest';
import { calculateSRS, getNextReviewDate, sortCardsBySRS, getMasteryLevel, buildDailySession, isLeech, countDueCards } from './srs';

describe('calculateSRS', () => {
  it('should advance interval on "got" from 0 to 1', () => {
    const result = calculateSRS('got', {});
    expect(result.interval).toBe(1);
    expect(result.ease).toBeCloseTo(2.6);
    expect(result.reviewCount).toBe(1);
    expect(result.lapses).toBe(0);
    expect(result.nextReview).toBeTruthy();
  });

  it('should advance interval from 1 to 3 on "got"', () => {
    const result = calculateSRS('got', { interval: 1, ease: 2.5, reviewCount: 1 });
    expect(result.interval).toBe(3);
  });

  it('should multiply interval by ease on "got" for interval > 1', () => {
    const result = calculateSRS('got', { interval: 3, ease: 2.5, reviewCount: 2 });
    expect(result.interval).toBe(8); // Math.round(3 * 2.5) = 8
  });

  it('should cap ease at 3.0', () => {
    const result = calculateSRS('got', { interval: 1, ease: 2.95, reviewCount: 1 });
    expect(result.ease).toBe(3.0);
  });

  it('should reset interval to 2 on "almost" with slight ease penalty', () => {
    const result = calculateSRS('almost', { interval: 10, ease: 2.5, reviewCount: 5 });
    expect(result.interval).toBe(2);
    expect(result.ease).toBe(2.45); // slight penalty
    expect(result.lapses).toBe(0); // unchanged
    expect(result.reviewCount).toBe(6);
  });

  it('should reset interval to 0 on "missed" and decrease ease', () => {
    const result = calculateSRS('missed', { interval: 10, ease: 2.5, reviewCount: 5, lapses: 1 });
    expect(result.interval).toBe(0);
    expect(result.ease).toBeCloseTo(2.3);
    expect(result.lapses).toBe(2);
    expect(result.reviewCount).toBe(6);
  });

  it('should not decrease ease below 1.3 on "missed"', () => {
    const result = calculateSRS('missed', { ease: 1.3 });
    expect(result.ease).toBe(1.3);
  });

  it('should return unchanged fields for unknown judgment', () => {
    const result = calculateSRS('invalid', { interval: 5, ease: 2.5, reviewCount: 3, lapses: 1 });
    expect(result.interval).toBe(5);
    expect(result.ease).toBe(2.5);
    expect(result.reviewCount).toBe(3);
    expect(result.lapses).toBe(1);
  });

  it('should use reverse prefix when direction is "reverse"', () => {
    const result = calculateSRS('got', { reverseInterval: 0, reverseEase: 2.5 }, 'reverse');
    expect(result.reverseInterval).toBe(1);
    expect(result.reverseEase).toBeCloseTo(2.6);
    expect(result.reverseReviewCount).toBe(1);
    expect(result.reverseLapses).toBe(0);
    expect(result.reverseNextReview).toBeTruthy();
  });

  it('should read existing reverse fields', () => {
    const result = calculateSRS('got', { reverseInterval: 1, reverseEase: 2.5, reverseReviewCount: 1 }, 'reverse');
    expect(result.reverseInterval).toBe(3);
  });

  it('should default missing fields to initial values', () => {
    const result = calculateSRS('got', {});
    expect(result.interval).toBe(1);
    expect(result.ease).toBeCloseTo(2.6);
    expect(result.reviewCount).toBe(1);
    expect(result.lapses).toBe(0);
  });
});

describe('getMasteryLevel', () => {
  it('should return "new" for unreviewed cards', () => {
    expect(getMasteryLevel({})).toBe('new');
    expect(getMasteryLevel({ reviewCount: 0 })).toBe('new');
  });

  it('should return "mastered" for interval >= 21', () => {
    expect(getMasteryLevel({ reviewCount: 5, interval: 21 })).toBe('mastered');
    expect(getMasteryLevel({ reviewCount: 10, interval: 30 })).toBe('mastered');
  });

  it('should return "learning" for reviewed but interval < 21', () => {
    expect(getMasteryLevel({ reviewCount: 3, interval: 7 })).toBe('learning');
  });

  it('should work with reverse direction', () => {
    expect(getMasteryLevel({ reverseReviewCount: 0 }, 'reverse')).toBe('new');
    expect(getMasteryLevel({ reverseReviewCount: 5, reverseInterval: 25 }, 'reverse')).toBe('mastered');
    expect(getMasteryLevel({ reverseReviewCount: 2, reverseInterval: 3 }, 'reverse')).toBe('learning');
  });
});

describe('sortCardsBySRS', () => {
  it('should categorize cards correctly', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const cards = [
      { target: 'new1', reviewCount: 0 },
      { target: 'due1', reviewCount: 3, nextReview: yesterday.toISOString() },
      { target: 'notDue1', reviewCount: 2, nextReview: tomorrow.toISOString() },
    ];

    const result = sortCardsBySRS(cards);
    expect(result.newCards.map(c => c.target)).toEqual(['new1']);
    expect(result.due.map(c => c.target)).toEqual(['due1']);
    expect(result.notDue.map(c => c.target)).toEqual(['notDue1']);
  });

  it('should sort due cards by most overdue first', () => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    threeDaysAgo.setHours(0, 0, 0, 0);

    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    oneDayAgo.setHours(0, 0, 0, 0);

    const cards = [
      { target: 'less_overdue', reviewCount: 2, nextReview: oneDayAgo.toISOString() },
      { target: 'more_overdue', reviewCount: 2, nextReview: threeDaysAgo.toISOString() },
    ];

    const result = sortCardsBySRS(cards);
    expect(result.due[0].target).toBe('more_overdue');
    expect(result.due[1].target).toBe('less_overdue');
  });

  it('should handle empty array', () => {
    const result = sortCardsBySRS([]);
    expect(result.due).toEqual([]);
    expect(result.newCards).toEqual([]);
    expect(result.notDue).toEqual([]);
    expect(result.sorted).toEqual([]);
  });
});

describe('buildDailySession', () => {
  const makeCard = (target, overrides = {}) => ({
    target,
    langId: 'zh',
    reviewCount: 0,
    nextReview: null,
    reverseReviewCount: 0,
    reverseNextReview: null,
    ...overrides,
  });

  it('should build a new session with new cards up to budget', () => {
    const cards = [makeCard('a'), makeCard('b'), makeCard('c')];
    const session = buildDailySession(cards, 2, null, 'zh');
    expect(session.cardKeys.length).toBeLessThanOrEqual(2);
    expect(session.index).toBe(0);
    expect(session.results).toEqual({ got: 0, almost: 0, missed: 0 });
  });

  it('should resume existing session for same day and language', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateStr = today.toISOString().slice(0, 10);

    const cards = [makeCard('a'), makeCard('b')];
    const existing = {
      date: dateStr,
      langId: 'zh',
      cardKeys: ['a'],
      cardDirections: ['forward'],
      index: 0,
      results: { got: 1, almost: 0, missed: 0 },
      newCardsUsed: 1,
    };
    const session = buildDailySession(cards, 5, existing, 'zh');
    expect(session).toBe(existing); // same reference, resumed
  });

  it('should not resume session from different language', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateStr = today.toISOString().slice(0, 10);

    const cards = [makeCard('a')];
    const existing = {
      date: dateStr,
      langId: 'ko',
      cardKeys: ['a'],
      cardDirections: ['forward'],
      index: 0,
      results: { got: 0, almost: 0, missed: 0 },
      newCardsUsed: 1,
    };
    const session = buildDailySession(cards, 5, existing, 'zh');
    expect(session).not.toBe(existing);
  });

  it('should include due forward cards before new cards', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const cards = [
      makeCard('due_card', { reviewCount: 3, nextReview: yesterday.toISOString() }),
      makeCard('new_card'),
    ];
    const session = buildDailySession(cards, 5, null, 'zh');
    const dueIdx = session.cardKeys.indexOf('due_card');
    const newIdx = session.cardKeys.indexOf('new_card');
    expect(dueIdx).toBeLessThan(newIdx);
  });

  it('should respect newOnly option', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const cards = [
      makeCard('due_card', { reviewCount: 3, nextReview: yesterday.toISOString(), reverseReviewCount: 1 }),
      makeCard('new_card'),
    ];
    const session = buildDailySession(cards, 5, null, 'zh', { newOnly: true });
    // due_card is reviewed (not new) for both directions, so should not appear
    const dueIdx = session.cardKeys.indexOf('due_card');
    expect(dueIdx).toBe(-1);
    expect(session.cardKeys).toContain('new_card');
  });

  it('should interleave forward and reverse new cards', () => {
    const cards = [
      makeCard('a', { reviewCount: 1 }), // eligible for reverse
      makeCard('b', { reviewCount: 1 }), // eligible for reverse
    ];
    const session = buildDailySession(cards, 10, null, 'zh');
    // Both forward due + reverse new should be present
    expect(session.cardDirections.filter(d => d === 'reverse').length).toBeGreaterThan(0);
  });
});

describe('adaptive SRS: leech factor', () => {
  it('should not reduce interval for 0 lapses', () => {
    const result = calculateSRS('got', { interval: 3, ease: 2.5, reviewCount: 5, lapses: 0 });
    expect(result.interval).toBe(8); // 3 * 2.5 = 7.5 → 8
  });

  it('should reduce interval at 3 lapses (factor 0.7)', () => {
    const result = calculateSRS('got', { interval: 3, ease: 2.5, reviewCount: 5, lapses: 3 });
    // rawInterval = round(3 * 2.5) = 8, factor = 0.7, result = round(8 * 0.7) = 6
    expect(result.interval).toBe(6);
  });

  it('should floor at factor 0.5 for 5+ lapses', () => {
    const result = calculateSRS('got', { interval: 3, ease: 2.5, reviewCount: 5, lapses: 5 });
    // rawInterval = 8, factor = 0.5, result = round(8 * 0.5) = 4
    expect(result.interval).toBe(4);
  });

  it('should floor at factor 0.5 for 10 lapses', () => {
    const result = calculateSRS('got', { interval: 3, ease: 2.5, reviewCount: 5, lapses: 10 });
    expect(result.interval).toBe(4); // same floor
  });

  it('should handle missing lapses field (backward compat)', () => {
    const result = calculateSRS('got', { interval: 3, ease: 2.5, reviewCount: 5 });
    // lapses defaults to 0 → factor 1.0
    expect(result.interval).toBe(8);
  });
});

describe('adaptive SRS: almost changes', () => {
  it('should set interval to 2 on almost', () => {
    const result = calculateSRS('almost', { interval: 10, ease: 2.5, reviewCount: 5, lapses: 0 });
    expect(result.interval).toBe(2);
  });

  it('should slightly decrease ease on almost', () => {
    const result = calculateSRS('almost', { interval: 10, ease: 2.5, reviewCount: 5, lapses: 0 });
    expect(result.ease).toBe(2.45);
  });

  it('should not decrease ease below 1.3 on almost', () => {
    const result = calculateSRS('almost', { interval: 10, ease: 1.3, reviewCount: 5, lapses: 0 });
    expect(result.ease).toBe(1.3);
  });
});

describe('isLeech', () => {
  it('should return true for 3+ lapses', () => {
    expect(isLeech({ lapses: 3 })).toBe(true);
    expect(isLeech({ lapses: 5 })).toBe(true);
  });

  it('should return false for <3 lapses', () => {
    expect(isLeech({ lapses: 0 })).toBe(false);
    expect(isLeech({ lapses: 2 })).toBe(false);
  });

  it('should check reverse direction', () => {
    expect(isLeech({ reverseLapses: 4 }, 'reverse')).toBe(true);
    expect(isLeech({ reverseLapses: 1 }, 'reverse')).toBe(false);
  });

  it('should default missing lapses to 0', () => {
    expect(isLeech({})).toBe(false);
  });
});

describe('countDueCards', () => {
  it('should count forward and reverse due cards', () => {
    const vocab = {
      hello: { reviewCount: 3, nextReview: '2020-01-01', reverseReviewCount: 1, reverseNextReview: '2020-01-01', langId: 'zh' },
      world: { reviewCount: 1, nextReview: '2099-01-01', langId: 'zh' },
    };
    expect(countDueCards(vocab, 'zh')).toBe(2); // hello forward + hello reverse
  });

  it('should filter by langId', () => {
    const vocab = {
      hello: { reviewCount: 3, nextReview: '2020-01-01', langId: 'zh' },
      bonjour: { reviewCount: 3, nextReview: '2020-01-01', langId: 'fr' },
    };
    expect(countDueCards(vocab, 'zh')).toBe(1);
  });

  it('should return 0 for empty vocab', () => {
    expect(countDueCards({}, 'zh')).toBe(0);
    expect(countDueCards(null, 'zh')).toBe(0);
  });
});
