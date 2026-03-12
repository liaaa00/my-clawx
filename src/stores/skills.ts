/**
 * Skills State Store
 * Manages skill/plugin state
 */
import { create } from 'zustand';
import type { Skill, MarketplaceSkill } from '../types/skill';

type GatewaySkillStatus = {
  skillKey: string;
  slug?: string;
  name?: string;
  description?: string;
  disabled?: boolean;
  emoji?: string;
  version?: string;
  author?: string;
  config?: Record<string, unknown>;
  bundled?: boolean;
  always?: boolean;
};

type GatewaySkillsStatusResult = {
  skills?: GatewaySkillStatus[];
};

type GatewayRpcResponse<T> = {
  success: boolean;
  result?: T;
  error?: string;
};

type ClawHubListResult = {
  slug: string;
  version?: string;
};

interface SkillsState {
  skills: Skill[];
  searchResults: MarketplaceSkill[];
  loading: boolean;
  searching: boolean;
  searchError: string | null;
  installing: Record<string, boolean>; // slug -> boolean
  updating: Record<string, boolean>; // slug -> boolean
  updateAvailable: Record<string, { currentVersion: string; latestVersion: string }>; // slug -> update info
  error: string | null;

  // Actions
  fetchSkills: () => Promise<void>;
  searchSkills: (query: string) => Promise<void>;
  installSkill: (slug: string, version?: string) => Promise<void>;
  uninstallSkill: (slug: string) => Promise<void>;
  enableSkill: (skillId: string) => Promise<void>;
  disableSkill: (skillId: string) => Promise<void>;
  checkUpdates: () => Promise<void>;
  updateSkillVersion: (slug: string, version?: string) => Promise<void>;
  updateAllSkills: () => Promise<void>;
  setSkills: (skills: Skill[]) => void;
  updateSkillState: (skillId: string, updates: Partial<Skill>) => void;
}

export const useSkillsStore = create<SkillsState>((set, get) => ({
  skills: [],
  searchResults: [],
  loading: false,
  searching: false,
  searchError: null,
  installing: {},
  updating: {},
  updateAvailable: {},
  error: null,

  fetchSkills: async () => {
    // Only show loading state if we have no skills yet (initial load)
    if (get().skills.length === 0) {
      set({ loading: true, error: null });
    }
    try {
      // 1. Fetch from Gateway (running skills)
      const gatewayResult = await window.electron.ipcRenderer.invoke(
        'gateway:rpc',
        'skills.status'
      ) as GatewayRpcResponse<GatewaySkillsStatusResult>;

      // 2. Fetch from ClawHub (installed on disk)
      const clawhubResult = await window.electron.ipcRenderer.invoke(
        'clawhub:list'
      ) as { success: boolean; results?: ClawHubListResult[]; error?: string };

      // 3. Fetch configurations directly from Electron (since Gateway doesn't return them)
      const configResult = await window.electron.ipcRenderer.invoke(
        'skill:getAllConfigs'
      ) as Record<string, { apiKey?: string; env?: Record<string, string> }>;

      let combinedSkills: Skill[] = [];
      const currentSkills = get().skills;

      // Map gateway skills info
      if (gatewayResult.success && gatewayResult.result?.skills) {
        combinedSkills = gatewayResult.result.skills.map((s: GatewaySkillStatus) => {
          // Merge with direct config if available
          const directConfig = configResult[s.skillKey] || {};

          return {
            id: s.skillKey,
            slug: s.slug || s.skillKey,
            name: s.name || s.skillKey,
            description: s.description || '',
            enabled: !s.disabled,
            icon: s.emoji || '📦',
            version: s.version || '1.0.0',
            author: s.author,
            config: {
              ...(s.config || {}),
              ...directConfig,
            },
            isCore: s.bundled && s.always,
            isBundled: s.bundled,
          };
        });
      } else if (currentSkills.length > 0) {
        // ... if gateway down ...
        combinedSkills = [...currentSkills];
      }

      // Merge with ClawHub results
      if (clawhubResult.success && clawhubResult.results) {
        clawhubResult.results.forEach((cs: ClawHubListResult) => {
          const existing = combinedSkills.find(s => s.id === cs.slug);
          if (!existing) {
            const directConfig = configResult[cs.slug] || {};
            combinedSkills.push({
              id: cs.slug,
              slug: cs.slug,
              name: cs.slug,
              description: 'Recently installed, initializing...',
              enabled: false,
              icon: '⌛',
              version: cs.version || 'unknown',
              author: undefined,
              config: directConfig,
              isCore: false,
              isBundled: false,
            });
          }
        });
      }

      set({ skills: combinedSkills, loading: false });
    } catch (error) {
      console.error('Failed to fetch skills:', error);
      set({ loading: false });
    }
  },

  searchSkills: async (query: string) => {
    set({ searching: true, searchError: null });
    try {
      const result = await window.electron.ipcRenderer.invoke('clawhub:search', { query }) as { success: boolean; results?: MarketplaceSkill[]; error?: string };
      if (result.success) {
        set({ searchResults: result.results || [] });
      } else {
        throw new Error(result.error || 'Search failed');
      }
    } catch (error) {
      set({ searchError: String(error) });
    } finally {
      set({ searching: false });
    }
  },

  installSkill: async (slug: string, version?: string) => {
    set((state) => ({ installing: { ...state.installing, [slug]: true } }));
    try {
      const result = await window.electron.ipcRenderer.invoke('clawhub:install', { slug, version }) as { success: boolean; error?: string };
      if (!result.success) {
        throw new Error(result.error || 'Install failed');
      }
      // Refresh skills after install
      await get().fetchSkills();
    } catch (error) {
      console.error('Install error:', error);
      throw error;
    } finally {
      set((state) => {
        const newInstalling = { ...state.installing };
        delete newInstalling[slug];
        return { installing: newInstalling };
      });
    }
  },

  uninstallSkill: async (slug: string) => {
    set((state) => ({ installing: { ...state.installing, [slug]: true } }));
    try {
      const result = await window.electron.ipcRenderer.invoke('clawhub:uninstall', { slug }) as { success: boolean; error?: string };
      if (!result.success) {
        throw new Error(result.error || 'Uninstall failed');
      }
      // Refresh skills after uninstall
      await get().fetchSkills();
    } catch (error) {
      console.error('Uninstall error:', error);
      throw error;
    } finally {
      set((state) => {
        const newInstalling = { ...state.installing };
        delete newInstalling[slug];
        return { installing: newInstalling };
      });
    }
  },

enableSkill: async (skillId) => {
    const { updateSkillState } = get();

    try {
      const result = await window.electron.ipcRenderer.invoke(
        'gateway:rpc',
        'skills.update',
        { skillKey: skillId, enabled: true }
      ) as GatewayRpcResponse<unknown>;

      if (result.success) {
        updateSkillState(skillId, { enabled: true });
      } else {
        throw new Error(result.error || 'Failed to enable skill');
      }
    } catch (error) {
      console.error('Failed to enable skill:', error);
      throw error;
    }
  },

  disableSkill: async (skillId) => {
    const { updateSkillState, skills } = get();

    const skill = skills.find((s) => s.id === skillId);
    if (skill?.isCore) {
      throw new Error('Cannot disable core skill');
    }

    try {
      const result = await window.electron.ipcRenderer.invoke(
        'gateway:rpc',
        'skills.update',
        { skillKey: skillId, enabled: false }
      ) as GatewayRpcResponse<unknown>;

      if (result.success) {
        updateSkillState(skillId, { enabled: false });
      } else {
        throw new Error(result.error || 'Failed to disable skill');
      }
    } catch (error) {
      console.error('Failed to disable skill:', error);
      throw error;
    }
  },

  checkUpdates: async () => {
    try {
      const result = await window.electron.ipcRenderer.invoke('clawhub:checkUpdates') as {
        success: boolean;
        results?: Array<{ slug: string; currentVersion: string; latestVersion: string; updateAvailable: boolean }>;
        error?: string;
      };

      if (result.success && result.results) {
        const updateAvailable: Record<string, { currentVersion: string; latestVersion: string }> = {};
        for (const item of result.results) {
          if (item.updateAvailable) {
            updateAvailable[item.slug] = {
              currentVersion: item.currentVersion,
              latestVersion: item.latestVersion,
            };
          }
        }
        set({ updateAvailable });
      }
    } catch (error) {
      console.error('Failed to check updates:', error);
    }
  },

  updateSkillVersion: async (slug: string, version?: string) => {
    set((state) => ({ updating: { ...state.updating, [slug]: true } }));
    try {
      const result = await window.electron.ipcRenderer.invoke('clawhub:update', slug, version) as {
        success: boolean;
        error?: string;
      };

      if (!result.success) {
        throw new Error(result.error || 'Update failed');
      }

      // Clear update available for this skill
      set((state) => {
        const newUpdateAvailable = { ...state.updateAvailable };
        delete newUpdateAvailable[slug];
        return { updateAvailable: newUpdateAvailable };
      });

      // Refresh skills list
      await get().fetchSkills();
    } catch (error) {
      console.error('Update error:', error);
      throw error;
    } finally {
      set((state) => {
        const newUpdating = { ...state.updating };
        delete newUpdating[slug];
        return { updating: newUpdating };
      });
    }
  },

  updateAllSkills: async () => {
    const { updateAvailable } = get();
    const slugs = Object.keys(updateAvailable);
    if (slugs.length === 0) return;

    set((state) => {
      const newUpdating: Record<string, boolean> = {};
      for (const slug of slugs) {
        newUpdating[slug] = true;
      }
      return { updating: { ...state.updating, ...newUpdating } };
    });

    try {
      const result = await window.electron.ipcRenderer.invoke('clawhub:updateAll') as {
        success: boolean;
        error?: string;
      };

      if (!result.success) {
        throw new Error(result.error || 'Update all failed');
      }

      // Clear all updates and refresh
      set({ updateAvailable: {} });
      await get().fetchSkills();
    } catch (error) {
      console.error('Update all error:', error);
      throw error;
    } finally {
      set({ updating: {} });
    }
  },

  setSkills: (skills) => set({ skills }),

updateSkillState: (skillId: string, updates: Partial<Skill>) => {
    set((state) => ({
      skills: state.skills.map((skill) =>
        skill.id === skillId ? { ...skill, ...updates } : skill
      ),
    }));
  },
}));
