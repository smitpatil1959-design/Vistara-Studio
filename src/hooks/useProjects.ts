import { useCallback, useEffect, useState } from 'react';
import type { Project, ProjectEvent } from '../types';
import { deleteProject, getActivity, listProjects } from '../services';

export interface DashboardData {
  projects: Project[];
  lastActivity: Record<string, string>;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  remove: (id: string) => Promise<void>;
}

/**
 * Safely converts different API response shapes into Project[].
 *
 * Supported:
 *   Project[]
 *   { projects: Project[] }
 *   { rows: Project[] }
 *   { data: Project[] }
 *   { data: { projects: Project[] } }
 *   { data: { rows: Project[] } }
 */
function normalizeProjects(value: unknown): Project[] {
  if (Array.isArray(value)) {
    return value as Project[];
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  const obj = value as Record<string, unknown>;

  if (Array.isArray(obj.projects)) {
    return obj.projects as Project[];
  }

  if (Array.isArray(obj.rows)) {
    return obj.rows as Project[];
  }

  if (Array.isArray(obj.data)) {
    return obj.data as Project[];
  }

  if (obj.data && typeof obj.data === 'object') {
    const data = obj.data as Record<string, unknown>;

    if (Array.isArray(data.projects)) {
      return data.projects as Project[];
    }

    if (Array.isArray(data.rows)) {
      return data.rows as Project[];
    }
  }

  return [];
}

/**
 * Safely converts activity responses into ProjectEvent[].
 */
function normalizeEvents(value: unknown): ProjectEvent[] {
  if (Array.isArray(value)) {
    return value as ProjectEvent[];
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  const obj = value as Record<string, unknown>;

  if (Array.isArray(obj.events)) {
    return obj.events as ProjectEvent[];
  }

  if (Array.isArray(obj.rows)) {
    return obj.rows as ProjectEvent[];
  }

  if (Array.isArray(obj.data)) {
    return obj.data as ProjectEvent[];
  }

  if (obj.data && typeof obj.data === 'object') {
    const data = obj.data as Record<string, unknown>;

    if (Array.isArray(data.events)) {
      return data.events as ProjectEvent[];
    }

    if (Array.isArray(data.rows)) {
      return data.rows as ProjectEvent[];
    }
  }

  return [];
}

export function useProjects(): DashboardData {
  const [projects, setProjects] = useState<Project[]>([]);
  const [lastActivity, setLastActivity] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const results = await Promise.allSettled([
          listProjects(),
          getActivity(),
        ]);

        if (cancelled) return;

        /* -------------------------------- projects */

        const projectResult = results[0];

        if (projectResult.status === 'rejected') {
          throw projectResult.reason;
        }

        const projectRows = normalizeProjects(projectResult.value);

        setProjects(projectRows);

        /* -------------------------------- activity */

        const activityResult = results[1];

        let events: ProjectEvent[] = [];

        if (activityResult.status === 'fulfilled') {
          events = normalizeEvents(activityResult.value);
        }

        const activityMap: Record<string, string> = {};

        for (const event of events) {
          if (!event || !event.project_id || !event.created_at) {
            continue;
          }

          const previous = activityMap[event.project_id];

          if (!previous || event.created_at > previous) {
            activityMap[event.project_id] = event.created_at;
          }
        }

        setLastActivity(activityMap);
        setError(null);
      } catch (err) {
        if (cancelled) return;

        const message =
          err instanceof Error
            ? err.message
            : 'Could not load projects';

        console.error('[useProjects] Failed to load workspace:', err);

        setProjects([]);
        setLastActivity({});
        setError(message);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [version]);

  const refresh = useCallback(() => {
    setVersion((current) => current + 1);
  }, []);

  const remove = useCallback(
    async (id: string) => {
      try {
        await deleteProject(id);
        refresh();
      } catch (err) {
        console.error('[useProjects] Failed to delete project:', err);

        throw err;
      }
    },
    [refresh]
  );

  return {
    projects,
    lastActivity,
    loading,
    error,
    refresh,
    remove,
  };
}