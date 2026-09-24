import { useCallback, useEffect, useState } from 'react';
import type { Project, Slide } from '../types';
import { getProject, getSlides } from '../services';

interface ProjectDetailState {
  project: Project | null;
  slides: Slide[];
  loading: boolean;
  error: string | null;
  setProject: (p: Project) => void;
  setSlides: (s: Slide[]) => void;
  refresh: () => void;
}

/** Loads a project and (when generated) its slides — shared by Studio and Present. */
export function useProjectDetail(id: string): ProjectDetailState {
  const [project, setProject] = useState<Project | null>(null);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await getProject(id);
        if (cancelled) return;
        setProject(p);
        if (p.status === 'generated') {
          const s = await getSlides(p.id);
          if (!cancelled) setSlides(s);
        }
        if (!cancelled) setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Study not found');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, version]);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  return { project, slides, loading, error, setProject, setSlides, refresh };
}
