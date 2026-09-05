import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type {
  KitchenProjectModel,
  AppScreen,
  CabinetModule,
  Opening,
  EvidenceItem,
  RuleParameters,
  Wall,
  MeasurementHistoryEntry,
} from './types';
import { DEMO_PROJECT, createNewProject } from '../data/demoData';
import { DEFAULT_RULE_PARAMS } from '../rules/defaultConfig';
import { computeGeometry } from '../rules/ruleEngine';
import type { ComputedGeometry } from './types';

// Safe fallback — never uninitialized even if all computeGeometry calls throw
const SAFE_GEO: ComputedGeometry = (() => {
  try { return computeGeometry(DEMO_PROJECT, DEFAULT_RULE_PARAMS); } catch { /* noop */ }
  return {
    kitchenType: 'l-shape',
    walls: [{ id: 'A', label: 'A', length: 3085 }, { id: 'B', label: 'B', length: 2560 }],
    ceilingHeight: 2750,
    kadappaHeight: 100, skirtingHeight: 100,
    baseHeight: 750, baseDepth: 600,
    wallCabHeight: 720, wallCabDepth: 350, wallCabBottom: 1350,
    loftHeight: 400, loftBottom: 2300, counterHeight: 850,
    baseModules: [], wallModules: [], loftModules: [], openings: [],
    availableWidth: {}, usedWidth: {},
    validationIssues: [], completionPercent: 0,
  };
})();

// ─── Context shape ─────────────────────────────────────────────────────────────

interface AppContextValue {
  model: KitchenProjectModel;
  geo: ComputedGeometry;
  rules: RuleParameters;
  screen: AppScreen;
  selectedModuleId: string | null;

  setScreen: (s: AppScreen) => void;
  setSelectedModuleId: (id: string | null) => void;

  // Project
  updateProject: (patch: Partial<KitchenProjectModel['project']>) => void;

  // Kitchen config
  setKitchenType: (type: KitchenProjectModel['kitchen']['type']) => void;
  updateKitchenConfig: (patch: Partial<KitchenProjectModel['kitchen']>) => void;
  updateWall: (id: string, length: number) => void;
  setCeilingHeight: (h: number) => void;

  // Openings
  addOpening: (o: Opening) => void;
  updateOpening: (id: string, patch: Partial<Opening>) => void;
  removeOpening: (id: string) => void;

  // Modules
  addModule: (m: CabinetModule) => void;
  updateModule: (id: string, patch: Partial<CabinetModule>) => void;
  removeModule: (id: string) => void;

  // Evidence
  addEvidence: (e: EvidenceItem) => void;
  /** Upserts the ONE persistent Evidence Note for a given product/measurement
   * (measurementId) — stored as a single EvidenceItem of type 'note', keyed
   * by measurementId, so exactly one note exists per product at a time
   * (never a growing list). Passing an empty/whitespace-only text removes
   * the note entirely rather than leaving a blank record around. Reuses the
   * existing evidence[] array (already localStorage-persisted) instead of
   * introducing a separate storage path. */
  setEvidenceNote: (measurementId: string, text: string) => void;

  // Rules
  updateRule: (key: keyof RuleParameters, value: number | number[]) => void;

  // Steps
  setStep: (step: number) => void;
  completeStep: (step: number) => void;

  // Version
  saveVersion: (name: string, notes: string) => void;

  // Employee + site workflow — loginEmployee is called AFTER a successful
  // /api/auth/employee-login response (see LoginScreen in App.tsx), never
  // used to authenticate on its own; it just records the already-verified
  // identity into local model state.
  loginEmployee: (employeeId: string, employeeName: string) => void;
  logoutEmployee: () => void;
  saveMeasurementSnapshot: (snapshot: Omit<MeasurementHistoryEntry, 'id' | 'timestamp'> & { id?: string }) => void;

  // Load demo/new
  loadDemo: () => void;
  newProject: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const STORAGE_KEY = 'smartmeasure-project';
const RULES_KEY = 'smartmeasure-rules';
const VERSION_KEY = 'smartmeasure-version';
const STORAGE_VERSION = '3';

function clearStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(RULES_KEY);
    localStorage.setItem(VERSION_KEY, STORAGE_VERSION);
  } catch { /* ignore */ }
}

function loadFromStorage(): { model: KitchenProjectModel | null; rules: RuleParameters | null } {
  try {
    const version = localStorage.getItem(VERSION_KEY);
    if (version !== STORAGE_VERSION) {
      clearStorage();
      return { model: null, rules: null };
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    const rulesRaw = localStorage.getItem(RULES_KEY);
    const model: KitchenProjectModel | null = raw ? JSON.parse(raw) : null;
    // Validate minimum required shape before returning
    if (model && (!model.kitchen || !Array.isArray(model.kitchen.walls) || !Array.isArray(model.modules))) {
      clearStorage();
      return { model: null, rules: null };
    }
    return {
      model,
      rules: rulesRaw ? JSON.parse(rulesRaw) : null,
    };
  } catch {
    clearStorage();
    return { model: null, rules: null };
  }
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Lazy initializers so storage reads run only once (StrictMode-safe)
  const [model, setModel] = useState<KitchenProjectModel>(() => {
    const { model: m } = loadFromStorage();
    return m ?? DEMO_PROJECT;
  });
  const [rules, setRules] = useState<RuleParameters>(() => {
    const { rules: r } = loadFromStorage();
    return r ?? DEFAULT_RULE_PARAMS;
  });
  const [screen, setScreen] = useState<AppScreen>('products');
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);

  // Persist on every change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(model));
    } catch { /* ignore quota errors */ }
  }, [model]);

  useEffect(() => {
    try {
      localStorage.setItem(RULES_KEY, JSON.stringify(rules));
    } catch { /* ignore */ }
  }, [rules]);

  // Compute geometry — three-layer fallback so `geo` is always initialised
  let geo: ComputedGeometry = SAFE_GEO;
  try { geo = computeGeometry(model, rules); } catch {
    try { geo = computeGeometry(DEMO_PROJECT, DEFAULT_RULE_PARAMS); } catch { /* use SAFE_GEO */ }
  }

  // patchModel reserved for future bulk updates

  const updateProject = useCallback((patch: Partial<KitchenProjectModel['project']>) => {
    setModel((prev) => ({ ...prev, project: { ...prev.project, ...patch } }));
  }, []);

  const setKitchenType = useCallback((type: KitchenProjectModel['kitchen']['type']) => {
    setModel((prev) => {
      const walls: Wall[] = type === 'straight'
        ? [{ id: 'A', label: 'A', length: prev.kitchen.walls[0]?.length ?? 0 }]
        : type === 'l-shape'
          ? [
              { id: 'A', label: 'A', length: prev.kitchen.walls.find((w) => w.id === 'A')?.length ?? 0 },
              { id: 'B', label: 'B', length: prev.kitchen.walls.find((w) => w.id === 'B')?.length ?? 0 },
            ]
          : prev.kitchen.walls;
      return { ...prev, kitchen: { ...prev.kitchen, type, walls } };
    });
  }, []);

  const updateKitchenConfig = useCallback((patch: Partial<KitchenProjectModel['kitchen']>) => {
    setModel((prev) => ({ ...prev, kitchen: { ...prev.kitchen, ...patch } }));
  }, []);

  const updateWall = useCallback((id: string, length: number) => {
    setModel((prev) => ({
      ...prev,
      kitchen: {
        ...prev.kitchen,
        walls: prev.kitchen.walls.map((w) => (w.id === id ? { ...w, length } : w)),
      },
    }));
  }, []);

  const setCeilingHeight = useCallback((h: number) => {
    setModel((prev) => ({ ...prev, kitchen: { ...prev.kitchen, ceilingHeight: h } }));
  }, []);

  const addOpening = useCallback((o: Opening) => {
    setModel((prev) => ({ ...prev, openings: [...prev.openings, o] }));
  }, []);

  const updateOpening = useCallback((id: string, patch: Partial<Opening>) => {
    setModel((prev) => ({
      ...prev,
      openings: prev.openings.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    }));
  }, []);

  const removeOpening = useCallback((id: string) => {
    setModel((prev) => ({ ...prev, openings: prev.openings.filter((o) => o.id !== id) }));
  }, []);

  const addModule = useCallback((m: CabinetModule) => {
    setModel((prev) => ({ ...prev, modules: [...prev.modules, m] }));
  }, []);

  const updateModule = useCallback((id: string, patch: Partial<CabinetModule>) => {
    setModel((prev) => ({
      ...prev,
      modules: prev.modules.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }));
  }, []);

  const removeModule = useCallback((id: string) => {
    setModel((prev) => ({ ...prev, modules: prev.modules.filter((m) => m.id !== id) }));
  }, []);

  const addEvidence = useCallback((e: EvidenceItem) => {
    setModel((prev) => ({ ...prev, evidence: [...prev.evidence, e] }));
  }, []);

  const setEvidenceNote = useCallback((measurementId: string, text: string) => {
    setModel((prev) => {
      const withoutOldNote = prev.evidence.filter((item) => !(item.measurementId === measurementId && item.type === 'note'));
      if (!text.trim()) return { ...prev, evidence: withoutOldNote };
      const noteItem: EvidenceItem = {
        id: `EVNOTE-${measurementId}`,
        measurementId,
        label: 'Evidence Note',
        type: 'note',
        caption: text,
        timestamp: new Date().toISOString(),
      };
      return { ...prev, evidence: [...withoutOldNote, noteItem] };
    });
  }, []);

  const updateRule = useCallback((key: keyof RuleParameters, value: number | number[]) => {
    setRules((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setStep = useCallback((step: number) => {
    setModel((prev) => ({ ...prev, currentStep: step }));
  }, []);

  const completeStep = useCallback((step: number) => {
    setModel((prev) => ({
      ...prev,
      currentStep: Math.max(prev.currentStep, step + 1),
      completedSteps: prev.completedSteps.includes(step)
        ? prev.completedSteps
        : [...prev.completedSteps, step],
    }));
  }, []);

  const saveVersion = useCallback((name: string, notes: string) => {
    setModel((prev) => ({
      ...prev,
      versions: [
        ...prev.versions,
        {
          id: `V${prev.versions.length + 1}`,
          name,
          timestamp: new Date().toISOString(),
          notes,
        },
      ],
    }));
  }, []);

  const loginEmployee = useCallback((employeeId: string, employeeName: string) => {
    const id = employeeId.trim();
    const name = employeeName.trim();
    if (!id || !name) return;
    setModel((prev) => {
      // A real employee's session starting is the actual moment "demo" ends
      // — the illustrative sample project (DEMO_PROJECT's clientName/
      // projectId, e.g. "Arc. Rutuja Joshi" / "XXXXX-9038") must never
      // silently carry into a real employee's PDF/measurement work. Only
      // clears when the project is still exactly the untouched demo
      // values — if a real project was already being edited this session
      // (isDemoData already false, or the identity fields were already
      // changed), logging back in never wipes real entered data.
      const isUntouchedDemo = prev.isDemoData && prev.project.clientName === DEMO_PROJECT.project.clientName && prev.project.projectId === DEMO_PROJECT.project.projectId;
      return {
        ...prev,
        employeeId: id,
        employeeName: name,
        isLoggedIn: true,
        lastSavedAt: new Date().toISOString(),
        ...(isUntouchedDemo ? { isDemoData: false, project: { ...prev.project, clientName: '', projectId: '' } } : {}),
      };
    });
  }, []);

  const logoutEmployee = useCallback(() => {
    setModel((prev) => ({
      ...prev,
      employeeId: '',
      employeeName: '',
      isLoggedIn: false,
      lastSavedAt: new Date().toISOString(),
    }));
  }, []);

  const saveMeasurementSnapshot = useCallback((snapshot: Omit<MeasurementHistoryEntry, 'id' | 'timestamp'> & { id?: string }) => {
    setModel((prev) => {
      const entry: MeasurementHistoryEntry = {
        id: snapshot.id ?? `snapshot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        productId: snapshot.productId,
        productName: snapshot.productName,
        projectId: snapshot.projectId || prev.project.projectId,
        employeeName: snapshot.employeeName || prev.employeeName || 'Employee',
        timestamp: new Date().toISOString(),
        dims: snapshot.dims,
        notes: snapshot.notes,
      };

      const history = [entry, ...(prev.measurementHistory ?? [])]
        .filter((item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index)
        .slice(0, 10);

      return {
        ...prev,
        measurementHistory: history,
        lastSavedAt: entry.timestamp,
      };
    });
  }, []);

  const loadDemo = useCallback(() => {
    setModel(DEMO_PROJECT);
    setRules(DEFAULT_RULE_PARAMS);
    setScreen('drawing');
  }, []);

  const newProject = useCallback(() => {
    setModel(createNewProject());
    setScreen('project');
  }, []);

  return (
    <AppContext.Provider
      value={{
        model, geo, rules, screen, selectedModuleId,
        setScreen, setSelectedModuleId,
        updateProject, setKitchenType, updateKitchenConfig, updateWall, setCeilingHeight,
        addOpening, updateOpening, removeOpening,
        addModule, updateModule, removeModule,
        addEvidence,
        setEvidenceNote,
        updateRule,
        setStep, completeStep,
        saveVersion,
        loginEmployee, logoutEmployee,
        saveMeasurementSnapshot,
        loadDemo, newProject,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
