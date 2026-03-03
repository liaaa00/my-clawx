/**
 * OpenClaw Config Watcher
 * Monitors ~/.openclaw/openclaw.json for external changes (e.g. Agent via
 * `gateway config.patch`) and syncs them back to ClawX's internal state.
 *
 * Detects changes to:
 * - agents.defaults.model (default model)
 * - models.providers (provider configurations)
 */
import { watch, existsSync, readFileSync, type FSWatcher } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { BrowserWindow } from 'electron';
import { logger } from './logger';
import { getAllProviders, saveProvider, setDefaultProvider, getDefaultProvider } from './secure-storage';
import type { ProviderConfig } from './secure-storage';
import { BUILTIN_PROVIDER_TYPES, getProviderOpenClawName } from './provider-registry';

const OPENCLAW_CONFIG_PATH = join(homedir(), '.openclaw', 'openclaw.json');

let watcher: FSWatcher | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastContent = '';

interface OpenClawConfig {
    agents?: {
        defaults?: {
            model?: string | { primary?: string; fallbacks?: string[] };
        };
    };
    models?: {
        providers?: Record<string, {
            baseUrl?: string;
            api?: string;
            apiKey?: string;
            models?: Array<{ id: string; name: string }>;
        }>;
    };
}

/**
 * Parse the default model string from openclaw.json's agents.defaults.model
 * into { provider, modelId }
 */
function parseModelString(model: string | { primary?: string } | undefined): { provider: string; modelId: string } | null {
    if (!model) return null;

    const modelStr = typeof model === 'string' ? model : model.primary;
    if (!modelStr) return null;

    // Format: "provider/model-id" e.g. "ollama/qwen3:8b"
    const slashIdx = modelStr.indexOf('/');
    if (slashIdx <= 0) return null;

    return {
        provider: modelStr.substring(0, slashIdx),
        modelId: modelStr.substring(slashIdx + 1),
    };
}

/**
 * Read and parse openclaw.json
 */
function readOpenClawConfig(): OpenClawConfig | null {
    try {
        if (!existsSync(OPENCLAW_CONFIG_PATH)) return null;
        const raw = readFileSync(OPENCLAW_CONFIG_PATH, 'utf-8');
        return JSON.parse(raw) as OpenClawConfig;
    } catch {
        return null;
    }
}

/**
 * Sync changes from openclaw.json back to ClawX's internal provider store.
 * Called when the file watcher detects a modification.
 */
async function syncFromOpenClaw(mainWindow: BrowserWindow | null): Promise<void> {
    const config = readOpenClawConfig();
    if (!config) return;

    let changed = false;

    // 1. Sync default model change
    const parsedModel = parseModelString(config.agents?.defaults?.model);
    if (parsedModel) {
        const existingProviders = await getAllProviders();
        const matchingProvider = existingProviders.find(
            (p) => p.type === parsedModel.provider ||
                getProviderOpenClawName(p.type) === parsedModel.provider
        );

        if (matchingProvider) {
            // Update the model ID if it changed
            if (matchingProvider.model !== parsedModel.modelId) {
                await saveProvider({
                    ...matchingProvider,
                    model: parsedModel.modelId,
                    updatedAt: new Date().toISOString(),
                });
                changed = true;
                logger.info(`[ConfigWatcher] Synced model change: ${matchingProvider.type}/${parsedModel.modelId}`);
            }

            // Ensure this provider is set as default
            const currentDefault = await getDefaultProvider();
            if (currentDefault !== matchingProvider.id) {
                await setDefaultProvider(matchingProvider.id);
                changed = true;
                logger.info(`[ConfigWatcher] Synced default provider: ${matchingProvider.id}`);
            }
        } else {
            // Provider not in ClawX yet — auto-register it
            const providerType = parsedModel.provider;
            const isBuiltin = (BUILTIN_PROVIDER_TYPES as readonly string[]).includes(providerType);

            if (isBuiltin || config.models?.providers?.[providerType]) {
                const providerCfg = config.models?.providers?.[providerType];
                const newId = `${providerType}-${Date.now()}`;

                await saveProvider({
                    id: newId,
                    name: providerType.charAt(0).toUpperCase() + providerType.slice(1),
                    type: providerType as ProviderConfig['type'],
                    baseUrl: providerCfg?.baseUrl || '',
                    model: parsedModel.modelId,
                    enabled: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                });

                await setDefaultProvider(newId);
                changed = true;
                logger.info(`[ConfigWatcher] Auto-registered new provider: ${providerType} (model=${parsedModel.modelId})`);
            }
        }
    }

    // 2. Sync new providers from openclaw.json that aren't in ClawX yet
    const openclawProviders = config.models?.providers;
    if (openclawProviders) {
        const existingProviders = await getAllProviders();
        const existingTypes = new Set<string>(existingProviders.map((p) => p.type));

        // Build a set of OpenClaw-facing names for existing providers
        // so we don't duplicate e.g. 'bailian' when 'aliyun-coding' already exists
        const existingOpenClawNames = new Set<string>(
            existingProviders.map((p) => getProviderOpenClawName(p.type))
        );

        for (const [type, providerCfg] of Object.entries(openclawProviders)) {
            if (!existingTypes.has(type) && !existingOpenClawNames.has(type)) {
                const newId = `${type}-${Date.now()}`;
                const models = providerCfg.models || [];
                const firstModel = models.length > 0 ? models[0].id : '';

                await saveProvider({
                    id: newId,
                    name: type.charAt(0).toUpperCase() + type.slice(1),
                    type: type as ProviderConfig['type'],
                    baseUrl: providerCfg.baseUrl || '',
                    model: firstModel,
                    enabled: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                });

                changed = true;
                logger.info(`[ConfigWatcher] Synced new provider from openclaw.json: ${type}`);
            }
        }
    }

    // 3. Notify frontend if anything changed
    if (changed) {
        mainWindow?.webContents.send('providers:changed');
        logger.info('[ConfigWatcher] Notified frontend of provider changes');
    }
}

/**
 * Start watching ~/.openclaw/openclaw.json for external changes.
 * Uses debouncing (500ms) to avoid duplicate events.
 */
export function startOpenClawConfigWatcher(mainWindow: BrowserWindow | null): void {
    if (watcher) return; // Already watching

    const configDir = join(homedir(), '.openclaw');
    if (!existsSync(configDir)) return;

    // Cache initial content for change detection
    try {
        if (existsSync(OPENCLAW_CONFIG_PATH)) {
            lastContent = readFileSync(OPENCLAW_CONFIG_PATH, 'utf-8');
        }
    } catch {
        // ignore
    }

    try {
        watcher = watch(OPENCLAW_CONFIG_PATH, { persistent: false }, (eventType) => {
            if (eventType !== 'change') return;

            // Debounce: wait 500ms after last change event
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(async () => {
                try {
                    // Check if content actually changed (avoid duplicate events)
                    const currentContent = existsSync(OPENCLAW_CONFIG_PATH)
                        ? readFileSync(OPENCLAW_CONFIG_PATH, 'utf-8')
                        : '';

                    if (currentContent === lastContent) return;
                    lastContent = currentContent;

                    logger.debug('[ConfigWatcher] openclaw.json changed, syncing...');
                    await syncFromOpenClaw(mainWindow);
                } catch (err) {
                    logger.warn('[ConfigWatcher] Sync failed:', err);
                }
            }, 500);
        });

        logger.info('[ConfigWatcher] Watching openclaw.json for external changes');
    } catch (err) {
        logger.warn('[ConfigWatcher] Failed to start watching:', err);
    }
}

/**
 * Stop watching openclaw.json.
 */
export function stopOpenClawConfigWatcher(): void {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
    }
    if (watcher) {
        watcher.close();
        watcher = null;
        logger.debug('[ConfigWatcher] Stopped watching openclaw.json');
    }
}
