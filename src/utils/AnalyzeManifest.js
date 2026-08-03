const fetchManifest = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Manifest indirilemedi: HTTP ${response.status}`);
  }
  return response.text();
};

const determineManifestType = (content) => {
  if (content.startsWith('#EXTM3U')) {
    return 'HLS';
  }
  if (content.trim().startsWith('<MPD')) {
    return 'DASH';
  }
  return 'UNKNOWN';
};

const getQualityLabel = (resolution) => {
  if (!resolution) {
    return 'Unknown';
  }
  const [, height] = resolution.split('x').map(Number);
  return `${height}p`;
};

const parseHLSStreams = (lines, baseUrl) => {
  const streams = [];
  let lastStreamAttributes = null;

  lines.forEach((line) => {
    try {
      if (line.startsWith('#EXT-X-STREAM-INF')) {
        const attributes = {};
        line.match(/([A-Z\-]+)=([^,]+)/g)?.forEach((attr) => {
          const [key, value] = attr.split('=');
          attributes[key] = value.replace(/"/g, '');
        });
        lastStreamAttributes = attributes;
      } else if (lastStreamAttributes && line.trim() && !line.startsWith('#')) {
        lastStreamAttributes.URI = new URL(line.trim(), baseUrl).href;
        if (lastStreamAttributes.RESOLUTION) {
          const [width, height] = lastStreamAttributes.RESOLUTION.split('x').map(Number);
          lastStreamAttributes.QUALITY = getQualityLabel(lastStreamAttributes.RESOLUTION);
          lastStreamAttributes.WIDTH = width;
          lastStreamAttributes.HEIGHT = height;
        } else {
          lastStreamAttributes.QUALITY = 'Audio Only';
        }
        if (lastStreamAttributes.HEIGHT) {
          streams.push(lastStreamAttributes);
        }
        lastStreamAttributes = null;
      }
    } catch (error) {
      // skip malformed stream entries
    }
  });

  return streams;
};

const parseHLSMetadata = (metadata, baseUrl) => {
  return metadata.map((line) => {
    const attributes = {};
    line.match(/([A-Z\-]+)="(.*?)"/g)?.forEach((attr) => {
      const [key, value] = attr.split('=');
      attributes[key] = value.replace(/"/g, '');
    });

    if (attributes.URI) {
      attributes.URI = new URL(attributes.URI, baseUrl).href;
    }

    return attributes;
  });
};

/**
 * Analyze a streaming manifest. Quality picker UI supports HLS only.
 */
export const analyzeManifest = async (url) => {
  const manifestContent = await fetchManifest(url);
  const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
  const manifestType = determineManifestType(manifestContent);

  if (manifestType === 'HLS') {
    // Only master playlist variant lines — ignore media-segment / blank noise.
    const lines = manifestContent.split(/\r?\n/);
    const metadataLines = lines.filter((line) => line.startsWith('#EXT-X-MEDIA:'));
    const streamLines = [];
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (line.startsWith('#EXT-X-STREAM-INF:')) {
        streamLines.push(line);
        const next = lines[i + 1];
        if (next && !next.startsWith('#')) {
          streamLines.push(next);
          i += 1;
        }
      }
    }

    return {
      type: 'HLS',
      metadata: parseHLSMetadata(metadataLines, baseUrl),
      streams: parseHLSStreams(streamLines, baseUrl),
    };
  }

  if (manifestType === 'DASH') {
    return {type: 'DASH', streams: [], metadata: []};
  }

  return {type: 'UNKNOWN', streams: [], metadata: []};
};
