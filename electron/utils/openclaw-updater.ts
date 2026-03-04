/**
 * OpenClaw Updater
 * Check for and install OpenClaw package updates from npm.
 */
import { execFile } from 'child_process';
import { join } from 'path';
import { readFileSync, existsSync } from 'fs';
import { app } from 'electron';
import { logger } from './logger';

/**
 * Get the currently installed OpenClaw version from node_modules.
 */
export function getInstalledOpenClawVersion(): string | null {
    try {
        const pkgPath = app.isPackaged
            ? join(process.resourcesPath, 'openclaw', 'package.json')
            : join(__dirname, '../../node_modules/openclaw/package.json');

        if (!existsSync(pkgPath)) return null;
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        return pkg.version || null;
    } catch (err) {
        logger.warn('[OpenClawUpdater] Failed to read installed version:', err);
        return null;
    }
}

/**
 * Fetch the latest OpenClaw version from the npm registry.
 */
export async function getLatestOpenClawVersion(): Promise<string | null> {
    try {
        const https = await import('https');
        return new Promise((resolve) => {
            const req = https.get('https://registry.npmjs.org/openclaw/latest', {
                headers: { 'Accept': 'application/json' },
                timeout: 10000,
            }, (res) => {
                let data = '';
                res.on('data', (chunk: string) => { data += chunk; });
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        resolve(json.version || null);
                    } catch {
                        resolve(null);
                    }
                });
            });
            req.on('error', () => resolve(null));
            req.on('timeout', () => { req.destroy(); resolve(null); });
        });
    } catch {
        return null;
    }
}

/**
 * Check if an OpenClaw update is available.
 * Returns { current, latest, updateAvailable }.
 */
export async function checkOpenClawUpdate(): Promise<{
    current: string | null;
    latest: string | null;
    updateAvailable: boolean;
}> {
    const current = getInstalledOpenClawVersion();
    const latest = await getLatestOpenClawVersion();

    const updateAvailable = !!(current && latest && current !== latest);
    logger.info(`[OpenClawUpdater] Check: current=${current}, latest=${latest}, updateAvailable=${updateAvailable}`);

    return { current, latest, updateAvailable };
}

/**
 * Perform the OpenClaw update via pnpm/npm.
 * Only works in development mode; packaged apps should update ClawX itself.
 */
export function performOpenClawUpdate(): Promise<{
    success: boolean;
    version?: string;
    error?: string;
}> {
    return new Promise((resolve) => {
        if (app.isPackaged) {
            resolve({
                success: false,
                error: 'Cannot update OpenClaw in packaged mode. Please update ClawX to get the latest OpenClaw version.',
            });
            return;
        }

        const projectRoot = join(__dirname, '../..');

        // Detect package manager: check for pnpm-lock.yaml first
        const hasPnpmLock = existsSync(join(projectRoot, 'pnpm-lock.yaml'));
        const command = hasPnpmLock ? 'pnpm' : 'npm';
        const args = ['update', 'openclaw@latest'];

        logger.info(`[OpenClawUpdater] Running: ${command} ${args.join(' ')} in ${projectRoot}`);

        const child = execFile(command, args, {
            cwd: projectRoot,
            timeout: 300000, // 5 min timeout
            shell: true,
            env: { ...process.env },
        }, (error, stdout, stderr) => {
            if (error) {
                logger.error('[OpenClawUpdater] Update failed:', error.message);
                logger.error('[OpenClawUpdater] stderr:', stderr);
                resolve({ success: false, error: error.message });
                return;
            }

            // Read the new version after update
            const newVersion = getInstalledOpenClawVersion();
            logger.info(`[OpenClawUpdater] Update complete. New version: ${newVersion}`);
            logger.debug('[OpenClawUpdater] stdout:', stdout);

            resolve({ success: true, version: newVersion || undefined });
        });

        child.on('error', (err) => {
            resolve({ success: false, error: err.message });
        });
    });
}
