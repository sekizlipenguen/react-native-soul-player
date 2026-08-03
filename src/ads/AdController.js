/**
 * Resolve when an ad break should fire for a given content timeline.
 */
export const resolveBreakTime = (position, duration) => {
  if (position === 'preroll') {
    return 0;
  }
  if (position === 'postroll') {
    return duration > 0 ? duration : Number.POSITIVE_INFINITY;
  }
  if (typeof position === 'string' && position.endsWith('%')) {
    const pct = parseFloat(position);
    if (!duration || Number.isNaN(pct)) {
      return null;
    }
    return (Math.min(100, Math.max(0, pct)) / 100) * duration;
  }
  if (typeof position === 'number') {
    return position;
  }
  return null;
};

export const getBreakId = (item) =>
  item.id || `${item.position}-${item.url || item.urls?.[0] || item.vast || 'ad'}`;

export const normalizeSkip = (skip) => {
  if (skip === false || skip == null) {
    return {mode: 'never'};
  }
  if (skip === true) {
    return {mode: 'afterSeconds', value: 5};
  }
  if (typeof skip === 'object' && skip.mode) {
    return skip;
  }
  return {mode: 'never'};
};

export const canSkipAd = (skip, adCurrentTime, adDuration) => {
  const rule = normalizeSkip(skip);
  if (rule.mode === 'never') {
    return false;
  }
  if (rule.mode === 'afterSeconds') {
    return adCurrentTime >= (rule.value || 0);
  }
  if (rule.mode === 'afterPercent') {
    if (!adDuration) {
      return false;
    }
    return (adCurrentTime / adDuration) * 100 >= (rule.value || 0);
  }
  return false;
};

export const skipCountdownSeconds = (skip, adCurrentTime, adDuration) => {
  const rule = normalizeSkip(skip);
  if (rule.mode === 'never') {
    return null;
  }
  if (rule.mode === 'afterSeconds') {
    return Math.max(0, Math.ceil((rule.value || 0) - adCurrentTime));
  }
  if (rule.mode === 'afterPercent' && adDuration) {
    const target = ((rule.value || 0) / 100) * adDuration;
    return Math.max(0, Math.ceil(target - adCurrentTime));
  }
  return null;
};

/**
 * Resolve creatives for a break.
 * - `creatives[]` → pod (play in sequence) when podEnabled
 * - `urls[]` → waterfall (try until one succeeds)
 * - `url` → single
 */
export const pickCreatives = (breakConfig, options = {}) => {
  const podEnabled = options.podEnabled !== false;
  const mapCreative = (item, mode) => ({
    url: typeof item === 'string' ? item : item.url,
    type: (typeof item === 'string' ? breakConfig.type : item.type) || breakConfig.type,
    skip: (typeof item === 'string' ? breakConfig.skip : item.skip) ?? breakConfig.skip,
    clickThroughUrl:
      (typeof item === 'string' ? breakConfig.clickThroughUrl : item.clickThroughUrl) ||
      breakConfig.clickThroughUrl,
    vast: typeof item === 'string' ? undefined : item.vast,
    mode,
  });

  if (Array.isArray(breakConfig.creatives) && breakConfig.creatives.length) {
    const items = breakConfig.creatives.map((c) => mapCreative(c, 'pod'));
    return {
      mode: 'pod',
      items: podEnabled ? items : items.slice(0, 1),
    };
  }

  if (Array.isArray(breakConfig.urls) && breakConfig.urls.length) {
    return {
      mode: 'waterfall',
      items: breakConfig.urls.map((url) => mapCreative(url, 'waterfall')),
    };
  }

  if (breakConfig.url) {
    return {
      mode: 'single',
      items: [mapCreative({url: breakConfig.url}, 'single')],
    };
  }

  return {mode: 'single', items: []};
};

const withResolvedCue = (item, duration) => {
  if (item.position === 'preroll' || item.position === 'postroll') {
    return null;
  }
  const at = resolveBreakTime(item.position, duration);
  if (at == null || Number.isNaN(at)) {
    return null;
  }
  return {...item, id: getBreakId(item), cueAt: at};
};

/**
 * Midrolls the playhead has just crossed during natural playback.
 * prevTime < cueAt <= nextTime
 */
export const findCrossedBreak = (breaks, prevTime, nextTime, duration, playedIds) => {
  if (!Array.isArray(breaks) || nextTime < prevTime) {
    return null;
  }
  const crossed = [];
  for (const item of breaks) {
    const resolved = withResolvedCue(item, duration);
    if (!resolved || playedIds.has(resolved.id)) {
      continue;
    }
    if (prevTime < resolved.cueAt && nextTime >= resolved.cueAt) {
      crossed.push(resolved);
    }
  }
  crossed.sort((a, b) => a.cueAt - b.cueAt);
  return crossed[0] || null;
};

/**
 * Unplayed midrolls strictly after `fromTime` and at/before `toTime` (seek forward).
 */
export const findBreaksInSeekRange = (breaks, fromTime, toTime, duration, playedIds) => {
  if (!Array.isArray(breaks) || toTime <= fromTime) {
    return [];
  }
  const hits = [];
  for (const item of breaks) {
    const resolved = withResolvedCue(item, duration);
    if (!resolved || playedIds.has(resolved.id)) {
      continue;
    }
    if (resolved.cueAt > fromTime && resolved.cueAt <= toTime) {
      hits.push(resolved);
    }
  }
  hits.sort((a, b) => a.cueAt - b.cueAt);
  return hits;
};

/** @deprecated use findCrossedBreak / findBreaksInSeekRange */
export const findDueBreak = (breaks, contentTime, duration, playedIds) => {
  return findCrossedBreak(breaks, Math.max(0, contentTime - 0.35), contentTime, duration, playedIds);
};
