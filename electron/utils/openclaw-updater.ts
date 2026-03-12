/**
 * OpenClaw Updater
 * Check for and install OpenClaw package updates from npm.
 */
import { execFile } from 'child_process';
import { join } from 'path';
import {
    readFileSync, existsSync, mkdirSync, rmSync,
    cpSync, readdirSync, createWriteStream,
} from 'fs';
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

/* ------------------------------------------------------------------ */
/*  Helper: fetch full npm package metadata (includes tarball URL)    */
/* ------------------------------------------------------------------ */
async function fetchNpmPackageInfo(): Promise<{
    version: string;
    dist: { tarball: string };
} | null> {
    const https = await import('https');
    return new Promise((resolve) => {
        const req = https.get('https://registry.npmjs.org/openclaw/latest', {
            headers: { Accept: 'application/json' },
            timeout: 15000,
        }, (res) => {
            let data = '';
            res.on('data', (chunk: string) => { data += chunk; });
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch { resolve(null); }
            });
        });
        req.on('error', () => resolve(null));
        req.on('timeout', () => { req.destroy(); resolve(null); });
    });
}

/* ------------------------------------------------------------------ */
/*  Helper: download a file over HTTPS, following redirects           */
/* ------------------------------------------------------------------ */
function downloadFile(url: string, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const doRequest = async (reqUrl: string, redirects = 0) => {
            if (redirects > 5) { reject(new Error('Too many redirects')); return; }

            // Choose http or https based on protocol
            const mod = reqUrl.startsWith('https')
                ? await import('https')
                : await import('http');

            const file = createWriteStream(destPath);
            const req = mod.get(reqUrl, (res) => {
                if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
                    file.close();
                    doRequest(res.headers.location, redirects + 1);
                    return;
                }
                if (res.statusCode !== 200) {
                    file.close();
                    reject(new Error(`HTTP ${res.statusCode}`));
                    return;
                }
                res.pipe(file);
                file.on('finish', () => { file.close(); resolve(); });
                file.on('error', reject);
            });
            req.on('error', (err: Error) => { file.close(); reject(err); });
            req.setTimeout(120_000, () => { req.destroy(); reject(new Error('Download timeout')); });
        };
        doRequest(url);
    });
}

/* ------------------------------------------------------------------ */
/*  Helper: extract .tgz using system tar                             */
/* ------------------------------------------------------------------ */
function extractTarball(tarball: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
        // On Windows, use built-in tar or Git's tar
        const isWindows = process.platform === 'win32';
        const tarCmd = isWindows ? 'tar' : 'tar';
        
        logger.info(`[OpenClawUpdater] Extracting ${tarball} to ${dest}`);
        
        execFile(tarCmd, ['-xzf', tarball, '-C', dest], {
            timeout: 60_000,
            shell: isWindows,
            windowsHide: true,
        }, (err, _stdout, stderr) => {
            if (err) {
                logger.error('[OpenClawUpdater] Extract failed:', err.message);
                if (stderr) logger.error('[OpenClawUpdater] tar stderr:', stderr);
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

/* ------------------------------------------------------------------ */
/*  Packaged-mode update: download tarball → extract → replace files  */
/* ------------------------------------------------------------------ */
async function performPackagedUpdate(): Promise<{
    success: boolean; version?: string; error?: string;
}> {
    const openclawDir = join(process.resourcesPath, 'openclaw');

    // 1. Fetch package metadata from npm registry
    logger.info('[OpenClawUpdater] Fetching package info from npm …');
    const pkgInfo = await fetchNpmPackageInfo();
    if (!pkgInfo?.dist?.tarball) {
        return { success: false, error: 'Failed to fetch OpenClaw package info from npm registry.' };
    }

    const { version: latestVersion, dist: { tarball: tarballUrl } } = pkgInfo;
    logger.info(`[OpenClawUpdater] Latest: ${latestVersion}, tarball: ${tarballUrl}`);

    // 2. Prepare temp directory
    const tmpDir = join(app.getPath('temp'), `openclaw-update-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });

    try {
        // 3. Download tarball
        const tarballPath = join(tmpDir, 'openclaw.tgz');
        logger.info(`[OpenClawUpdater] Downloading to ${tarballPath} …`);
        await downloadFile(tarballUrl, tarballPath);

        // 4. Extract (npm tarballs always unpack into a `package/` subdirectory)
        logger.info('[OpenClawUpdater] Extracting …');
        await extractTarball(tarballPath, tmpDir);

        const extractedDir = join(tmpDir, 'package');
        if (!existsSync(extractedDir)) {
            return { success: false, error: 'Extraction failed: package/ directory not found.' };
        }

        // 5. Copy updated files into the resource directory
        //    Preserve node_modules (dependencies) and gateway-preload.cjs (ClawX-specific)
        logger.info(`[OpenClawUpdater] Copying updated files to ${openclawDir} …`);
        const preserve = new Set(['node_modules', 'gateway-preload.cjs']);
        for (const entry of readdirSync(extractedDir, { withFileTypes: true })) {
            if (preserve.has(entry.name)) continue;
            const src = join(extractedDir, entry.name);
            const dst = join(openclawDir, entry.name);
            cpSync(src, dst, { recursive: true, force: true });
        }

        // 6. Verify new version
        const newVersion = getInstalledOpenClawVersion();
        logger.info(`[OpenClawUpdater] Update complete. New version: ${newVersion}`);
        return { success: true, version: newVersion || latestVersion };
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error('[OpenClawUpdater] Packaged update failed:', msg);
        return { success: false, error: msg };
    } finally {
        try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
}

/* ------------------------------------------------------------------ */
/*  Dev-mode update: download tarball directly to node_modules        */
/* ------------------------------------------------------------------ */
async function performDevUpdate(): Promise<{
    success: boolean; version?: string; error?: string;
}> {
    const projectRoot = join(__dirname, '../..');
    const openclawDir = join(projectRoot, 'node_modules', 'openclaw');

    try {
        // 1. Fetch package metadata from npm registry
        logger.info('[OpenClawUpdater] Fetching package info from npm …');
        const pkgInfo = await fetchNpmPackageInfo();
        if (!pkgInfo?.dist?.tarball) {
            return { success: false, error: 'Failed to fetch OpenClaw package info from npm registry.' };
        }

        const { version: latestVersion, dist: { tarball: tarballUrl } } = pkgInfo;
        logger.info(`[OpenClawUpdater] Latest: ${latestVersion}, tarball: ${tarballUrl}`);

        // 2. Prepare temp directory
        const tmpDir = join(app.getPath('temp'), `openclaw-dev-update-${Date.now()}`);
        mkdirSync(tmpDir, { recursive: true });

        try {
            // 3. Download tarball
            const tarballPath = join(tmpDir, 'openclaw.tgz');
            logger.info(`[OpenClawUpdater] Downloading to ${tarballPath} …`);
            await downloadFile(tarballUrl, tarballPath);

            // 4. Extract
            logger.info('[OpenClawUpdater] Extracting …');
            await extractTarball(tarballPath, tmpDir);

            const extractedDir = join(tmpDir, 'package');
            if (!existsSync(extractedDir)) {
                return { success: false, error: 'Extraction failed: package/ directory not found.' };
            }

            // 5. Copy updated files to node_modules/openclaw
            logger.info(`[OpenClawUpdater] Copying updated files to ${openclawDir} …`);
            const preserve = new Set(['node_modules']);
            for (const entry of readdirSync(extractedDir, { withFileTypes: true })) {
                if (preserve.has(entry.name)) continue;
                const src = join(extractedDir, entry.name);
                const dst = join(openclawDir, entry.name);
                cpSync(src, dst, { recursive: true, force: true });
            }

            // 6. Verify new version
            const newVersion = getInstalledOpenClawVersion();
            logger.info(`[OpenClawUpdater] Update complete. New version: ${newVersion}`);
            return { success: true, version: newVersion || latestVersion };
        } finally {
            try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
        }
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error('[OpenClawUpdater] Dev update failed:', msg);
        return { success: false, error: msg };
    }
}

/**
 * Perform the OpenClaw update.
 * - Dev mode: runs pnpm/npm update
 * - Packaged mode: downloads tarball from npm and replaces files in-place
 */
export function performOpenClawUpdate(): Promise<{
    success: boolean;
    version?: string;
    error?: string;
}> {
    if (app.isPackaged) {
        return performPackagedUpdate();
    }
    return performDevUpdate();
}
