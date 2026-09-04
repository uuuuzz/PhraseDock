'use strict';

const COLLAPSED_SIZE = Object.freeze({ width: 72, height: 72 });

function radialLayout(count) {
  if (!Number.isInteger(count) || count < 1 || count > 12) {
    throw new Error('Radial layout supports 1 to 12 phrases.');
  }
  let width, height, radiusX, radiusY, buttonWidth;
  if (count <= 6) {
    ({ width, height, radiusX, radiusY, buttonWidth } =
      { width: 344, height: 284, radiusX: 106, radiusY: 91, buttonWidth: 120 });
  } else if (count <= 8) {
    ({ width, height, radiusX, radiusY, buttonWidth } =
      { width: 440, height: 340, radiusX: 160, radiusY: 126, buttonWidth: 110 });
  } else {
    ({ width, height, radiusX, radiusY, buttonWidth } =
      { width: 560, height: 420, radiusX: 218, radiusY: 166, buttonWidth: 104 });
  }
  const positions = Array.from({ length: count }, (_, index) => {
    const angle = -Math.PI / 2 + index * 2 * Math.PI / count;
    return { x: Math.round(Math.cos(angle) * radiusX), y: Math.round(Math.sin(angle) * radiusY) };
  });
  return { width, height, buttonWidth, buttonHeight: 40, positions };
}

function areaForPoint(point, areas) {
  return areas.find(area => point.x >= area.x && point.x < area.x + area.width &&
    point.y >= area.y && point.y < area.y + area.height) || areas[0];
}

function boundsAroundAnchor(anchor, size, areas) {
  const area = areaForPoint(anchor, areas);
  const halfWidth = size.width / 2;
  const halfHeight = size.height / 2;
  const clamped = {
    x: Math.round(Math.max(area.x + halfWidth, Math.min(anchor.x, area.x + area.width - halfWidth))),
    y: Math.round(Math.max(area.y + halfHeight, Math.min(anchor.y, area.y + area.height - halfHeight)))
  };
  return {
    anchor: clamped,
    bounds: { x: Math.round(clamped.x - halfWidth), y: Math.round(clamped.y - halfHeight),
      width: size.width, height: size.height }
  };
}

function restoreAnchor(saved, areas) {
  if (saved?.version === 2 && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
    return boundsAroundAnchor({ x: saved.x, y: saved.y }, COLLAPSED_SIZE, areas).anchor;
  }
  if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
    // Migrate the center of the previous 292px-wide rectangular palette.
    return boundsAroundAnchor({ x: saved.x + 146, y: saved.y + 162 }, COLLAPSED_SIZE, areas).anchor;
  }
  const area = areas[0];
  return { x: Math.round(area.x + area.width - 56), y: Math.round(area.y + area.height / 2) };
}

module.exports = { COLLAPSED_SIZE, radialLayout, boundsAroundAnchor, restoreAnchor };
