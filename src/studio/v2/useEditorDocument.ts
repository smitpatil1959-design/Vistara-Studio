import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PresentationSpec } from '../../deck-spec';
import { brandForLegacy, renumberSlides } from '../../deck-spec';
import { getSpec, putSpec } from '../../services';
import { DocumentSaver, type DocumentSaveState } from '../../lib/documentSaver';

export function useEditorDocument(projectId: string, projectName: string, projectUrl: string) {
  const [document, setDocument] = useState<PresentationSpec | null>(null);
  const current = useRef<PresentationSpec | null>(null);
  const past = useRef<{ document: PresentationSpec; label: string }[]>([]), future = useRef<{ document: PresentationSpec; label: string }[]>([]);
  const [history, setHistory] = useState({ past: 0, future: 0 }), [version, setVersion] = useState(0);
  const [saveState, setSaveState] = useState<DocumentSaveState>('idle'), [error, setError] = useState(''), [lastEdit, setLastEdit] = useState('');
  const saver = useMemo(() => new DocumentSaver<PresentationSpec>(async (doc, expectedVersion) => {
    const result = await putSpec(projectId, doc, expectedVersion);
    const nextVersion = result.version || expectedVersion + 1;
    setVersion(nextVersion); setError(''); return nextVersion;
  }, setSaveState), [projectId]);
  const replace = useCallback((doc: PresentationSpec) => { current.current = doc; setDocument(doc); }, []);
  const load = useCallback(async () => {
    try {
      const row = await getSpec(projectId);
      const doc = { ...row.spec, brand: row.spec.brand || brandForLegacy(projectName, projectUrl, row.spec.theme.colors.accent) };
      saver.setVersion(row.version); setVersion(row.version); past.current = []; future.current = [];
      replace(doc); setError(''); setSaveState('saved'); setHistory({ past: past.current.length, future: future.current.length });
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not open the presentation'); }
  }, [projectId, projectName, projectUrl, saver, replace]);
  useEffect(() => { let alive = true; void getSpec(projectId).then(row => {
    if (!alive) return;
    saver.setVersion(row.version); setVersion(row.version);
    replace({ ...row.spec, brand: row.spec.brand || brandForLegacy(projectName, projectUrl, row.spec.theme.colors.accent) }); setSaveState('saved');
  }).catch(failure => { if (alive) setError(failure.message); }); return () => { alive = false; }; // A project rename must not reload a document over pending edits.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, saver, replace]);
  const commit = useCallback((next: PresentationSpec, label = 'Edit') => {
    const previous = current.current;
    if (!previous || previous === next) return;
    past.current.push({ document: previous, label }); if (past.current.length > 80) past.current.shift(); future.current = [];
    const numbered = next.slides.length !== previous.slides.length || next.slides.some((slide, i) => slide.id !== previous.slides[i]?.id) ? renumberSlides(next) : next;
    const updated = { ...numbered, schemaVersion: 'presentation.v2' as const, meta: { ...next.meta, source: 'manual-edit' as const, editorVersion: 2 }, updatedAt: new Date().toISOString() };
    replace(updated); saver.note(updated); setLastEdit(label); setHistory({ past: past.current.length, future: future.current.length });
  }, [replace, saver]);
  const undo = useCallback(() => {
    const previous = past.current.pop(); if (!previous || !current.current) return;
    future.current.push({ document: current.current, label: previous.label });
    replace(previous.document); saver.note(previous.document); setLastEdit(`Undo ${previous.label}`); setHistory({ past: past.current.length, future: future.current.length });
  }, [replace, saver]);
  const redo = useCallback(() => {
    const next = future.current.pop(); if (!next || !current.current) return;
    past.current.push({ document: current.current, label: next.label });
    replace(next.document); saver.note(next.document); setLastEdit(`Redo ${next.label}`); setHistory({ past: past.current.length, future: future.current.length });
  }, [replace, saver]);
  const flush = useCallback(async () => {
    try { await saver.flush(); return true; }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not save. Your edits are kept here.'); return false; }
  }, [saver]);
  useEffect(() => {
    if (saveState !== 'dirty') return;
    const timer = setTimeout(() => { void flush(); }, 700); return () => clearTimeout(timer);
  }, [document, saveState, flush]);
  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => { if (saver.dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', protect);
    return () => { window.removeEventListener('beforeunload', protect); void saver.flush().catch(() => {}); };
  }, [saver]);
  return { document, current, commit, undo, redo, canUndo: history.past > 0, canRedo: history.future > 0, version, saveState, error, clearError: () => setError(''), lastEdit, flush, reload: load };
}
