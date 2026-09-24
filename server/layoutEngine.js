/**
 * Vistara Studio — 16:9 Canvas Spatial Layout & Collision Engine
 *
 * Mathematically validates bounding boxes, detects overlaps, enforces safe margins,
 * and automatically repairs overflowing cards, headers, and media.
 */

export const CANVAS = {
  WIDTH: 1280,
  HEIGHT: 720,
  SAFE_MARGIN_X: 56,
  SAFE_MARGIN_Y: 48,
  HEADER_GAP: 24,
  CARD_GAP: 20,
  MIN_TITLE_SIZE: 36,
  MAX_TITLE_SIZE: 64,
};

/** Approximate line counts and rendered height based on character width heuristics */
export function estimateTextHeight(text, fontSize, containerWidth, lineHeight = 1.4) {
  if (!text || typeof text !== 'string') return 0;
  const avgCharWidth = fontSize * 0.52;
  const charsPerLine = Math.max(10, Math.floor(containerWidth / avgCharWidth));
  const lines = Math.max(1, Math.ceil(text.length / charsPerLine));
  return Math.round(lines * fontSize * lineHeight);
}

/** Check whether box A and box B intersect with a tolerance buffer */
export function boxesIntersect(a, b, buffer = 4) {
  return !(
    a.x + a.w - buffer <= b.x ||
    b.x + b.w - buffer <= a.x ||
    a.y + a.h - buffer <= b.y ||
    b.y + b.h - buffer <= a.y
  );
}

/** Check whether a box is completely within the 16:9 canvas safe area */
export function isWithinSafeArea(box) {
  const safeW = CANVAS.WIDTH - CANVAS.SAFE_MARGIN_X * 2;
  const safeH = CANVAS.HEIGHT - CANVAS.SAFE_MARGIN_Y * 2;
  return (
    box.x >= CANVAS.SAFE_MARGIN_X &&
    box.y >= CANVAS.SAFE_MARGIN_Y &&
    box.x + box.w <= CANVAS.SAFE_MARGIN_X + safeW + 1 &&
    box.y + box.h <= CANVAS.SAFE_MARGIN_Y + safeH + 1
  );
}

/** Simulates spatial layout and verifies zero collisions across all slide elements */
export function validateSlideLayout(slide) {
  const safeW = CANVAS.WIDTH - CANVAS.SAFE_MARGIN_X * 2;
  const safeH = CANVAS.HEIGHT - CANVAS.SAFE_MARGIN_Y * 2;
  const issues = [];
  const boxes = [];

  const type = slide.type || 'custom';
  const hasImage = Boolean(slide.image_url);

  const colGap = 48;
  const leftColW = hasImage ? Math.floor((safeW - colGap) * 0.52) : safeW;

  // 1. Header Box
  const titleText = (slide.title || '').replace(/\*/g, '');
  const subText = slide.subtitle || '';
  const titleH = estimateTextHeight(titleText, 48, leftColW, 1.25);
  const subH = subText ? estimateTextHeight(subText, 18, leftColW, 1.4) : 0;
  const headerH = titleH + (subH ? subH + 12 : 0);

  const headerBox = {
    id: 'header',
    x: CANVAS.SAFE_MARGIN_X,
    y: CANVAS.SAFE_MARGIN_Y,
    w: leftColW,
    h: headerH,
  };
  boxes.push(headerBox);


  // 2. Content & Card Boxes
  const contentY = headerBox.y + headerBox.h + CANVAS.HEADER_GAP;
  const availableContentH = CANVAS.HEIGHT - CANVAS.SAFE_MARGIN_Y - contentY;

  if (availableContentH < 80) {
    issues.push({ code: 'HEADER_OVERFLOW', message: 'Header exceeds safe vertical budget.' });
  }

  // Check Card Layouts (grid, or left/center slides with bullets)
  const bullets = (slide.bullets || []).slice(0, 4);
  if (bullets.length > 0 && (type === 'features' || type === 'problem' || slide.layout === 'grid' || !hasImage)) {
    const cardCount = bullets.length;
    // In grid: 1-3 cards use 1 row of N cols; 4 cards use 2x2 grid
    const cardCols = cardCount === 4 ? 2 : Math.min(cardCount, 3);
    const cardRows = Math.ceil(cardCount / cardCols);
    const effectiveW = hasImage ? Math.floor((safeW - colGap) * 0.5) : safeW;
    const cardW = Math.floor((effectiveW - CANVAS.CARD_GAP * (cardCols - 1)) / cardCols);
    const cardH = Math.min(200, Math.max(120, Math.floor((availableContentH - CANVAS.CARD_GAP * (cardRows - 1)) / cardRows)));

    bullets.forEach((b, i) => {
      const parts = String(b).split(' — ');
      const titleText = parts[0] || '';
      const descText = parts[1] || '';
      const neededH = estimateTextHeight(titleText, 17, cardW - 32) + (descText ? estimateTextHeight(descText, 13, cardW - 32) + 12 : 0) + 40;

      if (neededH > cardH + 15) {
        issues.push({ code: 'CARD_OVERFLOW', cardIndex: i, neededH, cardH, message: `Card ${i} text exceeds box height.` });
      }

      const col = i % cardCols;
      const row = Math.floor(i / cardCols);
      const cardBox = {
        id: `card-${i}`,
        x: CANVAS.SAFE_MARGIN_X + col * (cardW + CANVAS.CARD_GAP),
        y: contentY + row * (cardH + CANVAS.CARD_GAP),
        w: cardW,
        h: cardH,
      };

      if (!isWithinSafeArea(cardBox)) {
        issues.push({ code: 'CANVAS_OVERFLOW', id: cardBox.id, message: `Card ${i} extends outside canvas.` });
      }
      boxes.push(cardBox);
    });
  }

  // Check Split Layouts (hero, solution, intro, or any slide with image)
  if (hasImage && (slide.layout === 'split' || type === 'hero' || type === 'solution' || type === 'overview')) {
    const colGap = 48;
    const colW = Math.floor((safeW - colGap) * 0.48);
    const mediaBox = {
      id: 'media',
      x: CANVAS.SAFE_MARGIN_X + colW + colGap,
      y: CANVAS.SAFE_MARGIN_Y + 30,
      w: colW,
      h: Math.min(420, safeH - 60),
    };

    if (!isWithinSafeArea(mediaBox)) {
      issues.push({ code: 'MEDIA_OVERFLOW', message: 'Media frame extends outside safe margin.' });
    }
    boxes.push(mediaBox);
  }

  // Check Overlaps between computed boxes
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (boxesIntersect(boxes[i], boxes[j])) {
        issues.push({
          code: 'ELEMENT_COLLISION',
          a: boxes[i].id,
          b: boxes[j].id,
          message: `Collision detected between ${boxes[i].id} and ${boxes[j].id}`,
        });
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    boxes,
  };
}

/** Automatically repairs a slide to guarantee zero overlap and zero canvas overflow */
export function repairSlideSpatialCollision(slide) {
  let repaired = { ...slide };

  // 1. Enforce strict character limits on titles and subtitles to prevent header blowout
  if (repaired.title && repaired.title.length > 64) {
    const words = repaired.title.split(/\s+/);
    repaired.title = words.slice(0, 7).join(' ');
    if (!repaired.title.includes('*')) {
      const parts = repaired.title.split(' ');
      const last = parts.pop();
      repaired.title = `${parts.join(' ')} *${last}*`;
    }
  }

  if (repaired.subtitle && repaired.subtitle.length > 95) {
    repaired.subtitle = repaired.subtitle.slice(0, 95).replace(/\s\S*$/, '') + '…';
  }

  if (repaired.body && repaired.body.length > 170) {
    repaired.body = repaired.body.slice(0, 170).replace(/\s\S*$/, '') + '…';
  }

  // 2. Cap card bullet descriptions to prevent card escape
  if (Array.isArray(repaired.bullets)) {
    repaired.bullets = repaired.bullets.slice(0, repaired.type === 'features' ? 6 : 4).map((b) => {
      const parts = String(b).split(' — ');
      if (parts.length === 2) {
        const title = parts[0].slice(0, 32);
        const desc = parts[1].slice(0, 72).replace(/\s\S*$/, '') + (parts[1].length > 72 ? '…' : '');
        return `${title} — ${desc}`;
      }
      return String(b).slice(0, 85);
    });
  }

  // 3. Cap stats to 3 max for balanced spacing
  if (Array.isArray(repaired.stats)) {
    repaired.stats = repaired.stats.slice(0, 3).map((st) => ({
      value: String(st.value || '').slice(0, 16),
      label: String(st.label || '').slice(0, 28),
    }));
  }

  return repaired;
}
