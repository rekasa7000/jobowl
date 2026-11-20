import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { DraftProfile, ImportDraft } from '@shared/schemas/profile';

/** A profile being edited or reviewed, kept here so leaving the screen doesn't lose it. */
export interface Working {
  profile: DraftProfile;
  /** JSON of where editing started; an import draft has none, so it always counts as unsaved. */
  baseline: string;
  lowConfidence: string[];
  warnings: string[];
  importId?: string;
  fileName?: string;
}

interface Workspace {
  working: Working | null;
  setWorking: (next: Working | null | ((current: Working | null) => Working | null)) => void;
}

const Context = createContext<Workspace | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [working, setWorking] = useState<Working | null>(null);
  const value = useMemo(() => ({ working, setWorking }), [working]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useWorkspace(): Workspace {
  const value = useContext(Context);
  if (!value) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return value;
}

export function workingFromImport(draft: ImportDraft): Working {
  return {
    profile: draft.profile,
    baseline: '',
    lowConfidence: draft.lowConfidence,
    warnings: draft.warnings,
    importId: draft.importId,
    fileName: draft.fileName,
  };
}

export function isDirty(working: Working | null): boolean {
  return working !== null && JSON.stringify(working.profile) !== working.baseline;
}
