type Listener = (state: { id: string; tab: string }) => void;
const listeners: Set<Listener> = new Set();

export function openProductViewer(id: string, tab = 'measurements') {
  listeners.forEach((fn) => fn({ id, tab }));
}

export function subscribeViewer(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
