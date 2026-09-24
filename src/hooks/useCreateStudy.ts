import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { analyzeProject, createProject } from '../services';
import { getPrefs } from '../lib/prefs';
import { DEFAULT_THEME, PALETTES } from '../lib/themes';
import type { CreateStudyInput, DeckTheme } from '../types';

function applyPrefs(): DeckTheme {
  const prefs = getPrefs();
  const palette = PALETTES.find((p) => p.id === prefs.paletteId) || PALETTES[0];
  return { ...DEFAULT_THEME, accent: palette.accent, accent2: palette.accent2, motion: prefs.motion, skin: prefs.skin };
}

interface CreateStudyState {
  create: (input: CreateStudyInput) => Promise<void>;
  busy: boolean;
  error: string;
  clearError: () => void;
}

/**
 * Creates a study with workspace theme defaults + intake fields (purpose,
 * design prompt), kicks off the analysis (fire-and-forget — the crawl stage
 * tracks live progress itself), then routes to the project workspace.
 *
 * PURPOSE CONTRACT: input.purpose must always be the canonical purpose string
 * chosen by the user in CreatePage. This hook no longer accepts a bare URL
 * string — all callers must pass a full CreateStudyInput so that purpose is
 * never silently defaulted to 'general'.
 */
export function useCreateStudy(): CreateStudyState {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const create = useCallback(
    async (input: CreateStudyInput) => {
      if (!input.url.trim() || busy) return;
      setBusy(true);
      setError('');
      try {
        const project = await createProject(input, applyPrefs());
        if (!project || !project.id) {
          throw new Error('Study creation failed: server returned an invalid response.');
        }
        // Start the crawl immediately; the studio renders the live crawl log.
        void analyzeProject(project.id).catch(() => {
          /* the studio surface handles retries */
        });
        nav(`/project/${project.id}`);
      } catch (ex) {
        const msg = ex instanceof Error ? ex.message : 'Could not create the study';
        setError(msg);
        setBusy(false);
        throw ex;
      }
    },
    [busy, nav]
  );

  const clearError = useCallback(() => setError(''), []);

  return { create, busy, error, clearError };
}
