import React from 'react';
import { createRoot } from 'react-dom/client';

/**
 * Mounts a batch of React elements into a real, attached-to-document (but
 * visually hidden) container and returns each one's live <svg> element —
 * svg2pdf.js requires an actual mounted DOM node (it explicitly does not
 * work against a detached/JSDOM tree or a plain HTML string), which is why
 * this exists instead of reusing the old renderToStaticMarkup-based
 * svgHtmlOf() helper.
 *
 * Returns a cleanup function the caller MUST invoke once done reading the
 * SVGs (after svg2pdf.js has finished drawing them into the PDF) to
 * unmount and remove the off-screen container.
 */
export async function mountOffscreenSvgs(
  // Accepts null entries so a caller can map a "no product / no view"
  // slot straight through (e.g. renderMainDrawing() returning null when
  // there's genuinely nothing to render) without a separate filter pass
  // first — this function renders <>{null}</> as an empty fragment for
  // those and simply returns a null svg for that index.
  elements: (React.ReactElement | null)[],
): Promise<{ svgs: (SVGSVGElement | null)[]; cleanup: () => void }> {
  const container = document.createElement('div');
  // Off-screen, not display:none — some browsers skip layout/measurement
  // for display:none subtrees, which could make getBBox()/getAttribute
  // reads on the mounted SVGs unreliable. Positioned far outside the
  // viewport instead, so it never becomes visible or affects page flow.
  container.style.position = 'fixed';
  container.style.left = '-99999px';
  container.style.top = '0';
  container.style.width = '2000px';
  container.style.pointerEvents = 'none';
  document.body.appendChild(container);

  const itemRoots = elements.map((_, i) => {
    const holder = document.createElement('div');
    holder.dataset.pdfMountIndex = String(i);
    container.appendChild(holder);
    return { holder, root: createRoot(holder) };
  });

  await new Promise<void>((resolve) => {
    itemRoots.forEach(({ root }, i) => {
      root.render(elements[i]);
    });
    // React 19's createRoot render is synchronous for a simple tree on the
    // next microtask/paint — a double rAF plus a microtask flush reliably
    // waits past commit before reading the resulting DOM, without pulling
    // in a testing-only flushSync dependency.
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

  const svgs = itemRoots.map(({ holder }) => holder.querySelector('svg') as SVGSVGElement | null);

  const cleanup = () => {
    itemRoots.forEach(({ root }) => root.unmount());
    container.remove();
  };

  return { svgs, cleanup };
}
