import { describe, expect, it } from 'vitest';
import { getPopoverPosition } from '../../src/scripts/anchored-popover';

const viewport = { left: 0, top: 0, width: 1200, height: 800 };
const size = { width: 320, height: 280 };

describe('anchored popover placement', () => {
  it('places the bubble above the clicked sentence and points at its center', () => {
    const anchor = { left: 400, right: 600, top: 600, bottom: 660 };
    const position = getPopoverPosition(anchor, size, viewport);
    expect(position.placement).toBe('above');
    expect(position.top + size.height).toBe(anchor.top - 12);
    expect(position.left + position.arrowLeft).toBe(500);
  });

  it('flips below a sentence near the top of the screen', () => {
    const anchor = { left: 400, right: 600, top: 40, bottom: 100 };
    const position = getPopoverPosition(anchor, size, viewport);
    expect(position.placement).toBe('below');
    expect(position.top).toBe(anchor.bottom + 12);
    expect(position.top + size.height).toBeLessThan(viewport.height - 16);
  });

  it.each([
    { left: 16, right: 116, expectedLeft: 16 },
    { left: 1084, right: 1184, expectedLeft: 864 },
  ])('keeps the bubble on screen near a horizontal edge: $left', (edge) => {
    const position = getPopoverPosition(
      { ...edge, top: 600, bottom: 660 },
      size,
      viewport,
    );
    expect(position.left).toBe(edge.expectedLeft);
    expect(position.left + position.arrowLeft).toBe(
      (edge.left + edge.right) / 2,
    );
  });

  it('limits long content to the available mobile space', () => {
    const mobile = { left: 0, top: 0, width: 390, height: 500 };
    const position = getPopoverPosition(
      { left: 120, right: 260, top: 220, bottom: 280 },
      { width: 358, height: 600 },
      mobile,
    );
    expect(position.maxHeight).toBe(192);
    expect(position.top).toBe(16);
    expect(position.left).toBe(16);
  });

  it('accounts for the visible viewport offset when zoomed', () => {
    const zoomed = { left: 100, top: 200, width: 390, height: 500 };
    const position = getPopoverPosition(
      { left: 120, right: 220, top: 250, bottom: 310 },
      { width: 358, height: 200 },
      zoomed,
    );
    expect(position.placement).toBe('below');
    expect(position.left).toBe(116);
    expect(position.top).toBe(322);
  });
});
