/**
 * Minimal VAST parser: MediaFile URL + skipoffset (seconds or percent).
 */
export const parseVastXml = (xml) => {
  if (!xml || typeof xml !== 'string') {
    return null;
  }
  const mediaMatch =
    xml.match(/<MediaFile[^>]*>([\s\S]*?)<\/MediaFile>/i) ||
    xml.match(/<MediaFile[^>]*src=["']([^"']+)["']/i);
  let url = null;
  if (mediaMatch) {
    url = (mediaMatch[1] || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
  }
  if (!url) {
    return null;
  }

  const skipAttr = xml.match(/skipoffset=["']([^"']+)["']/i);
  let skip = {mode: 'never'};
  if (skipAttr) {
    const raw = skipAttr[1].trim();
    if (raw.endsWith('%')) {
      skip = {mode: 'afterPercent', value: parseFloat(raw)};
    } else if (/^\d+$/.test(raw)) {
      skip = {mode: 'afterSeconds', value: parseInt(raw, 10)};
    } else if (/^\d{2}:\d{2}:\d{2}/.test(raw)) {
      const [h, m, s] = raw.split(':').map(Number);
      skip = {mode: 'afterSeconds', value: h * 3600 + m * 60 + s};
    }
  }

  const click =
    xml.match(/<ClickThrough[^>]*>([\s\S]*?)<\/ClickThrough>/i) ||
    xml.match(/<ClickThrough[^>]*>([^<]+)/i);
  const clickThroughUrl = click
    ? click[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim()
    : undefined;

  return {url, skip, clickThroughUrl};
};

export const fetchVast = async (vastUrl) => {
  const response = await fetch(vastUrl);
  if (!response.ok) {
    throw new Error(`VAST HTTP ${response.status}`);
  }
  return parseVastXml(await response.text());
};
