import { useCallback, useRef, useState } from 'react';

/** JSON-document history — undo/redo with bounded depth, ref-free render surface. */
export function useUndoable<T>(present: T, apply: (next: T) => void, serialize: (d: T) => string, depth = 64) {
  const pastRef = useRef<string[]>([]);
  const futureRef = useRef<string[]>([]);
  const [depths, setDepths] = useState({ past: 0, future: 0 });

  const commit = useCallback(
    (next: T) => {
      pastRef.current.push(serialize(present));
      if (pastRef.current.length > depth) pastRef.current.shift();
      futureRef.current = [];
      setDepths({ past: pastRef.current.length, future: 0 });
      apply(next);
    },
    [present, apply, serialize, depth]
  );

  const undo = useCallback(() => {
    const past = pastRef.current;
    if (!past.length) return;
    futureRef.current.push(serialize(present));
    const prev = JSON.parse(past.pop()!) as T;
    setDepths({ past: past.length, future: futureRef.current.length });
    apply(prev);
  }, [present, apply, serialize]);

  const redo = useCallback(() => {
    const future = futureRef.current;
    if (!future.length) return;
    pastRef.current.push(serialize(present));
    const next = JSON.parse(future.pop()!) as T;
    setDepths({ past: pastRef.current.length, future: future.length });
    apply(next);
  }, [present, apply, serialize]);

  const reset = useCallback((anchor: T) => {
    pastRef.current = [];
    futureRef.current = [];
    setDepths({ past: 0, future: 0 });
    apply(anchor);
  }, [apply]);

  return {
    commit,
    undo,
    redo,
    reset,
    canUndo: depths.past > 0,
    canRedo: depths.future > 0,
  };
}
