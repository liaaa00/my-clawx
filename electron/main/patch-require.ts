import Module from 'module';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';

// Lazy-load typescript only when needed for runtime .ts transpilation.
// In packaged builds, typescript may not be available; that's OK because
// Vite bundles all known openclaw extension imports at build time.
let _ts: any = null;
function getTS(): any {
    if (!_ts) {
        const req = createRequire(import.meta.url);
        _ts = req('typescript');
    }
    return _ts;
}

function transpileTSFile(filePath: string): string {
    const ts = getTS();
    const code = fs.readFileSync(filePath, 'utf-8');
    return ts.transpileModule(code, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    }).outputText;
}

function isBareSpecifier(request: string): boolean {
    return !request.startsWith('.') && !path.isAbsolute(request) && !request.includes(':');
}

// Skip patching when running the gateway process (which loads openclaw.mjs with ESM).
// The gateway is spawned with 'gateway' in argv, and patching would interfere with ESM loading.
// Main process (without 'gateway' arg) still needs patching to resolve openclaw/ imports.
const isGatewayProcess = process.argv.some(arg => arg.includes('gateway'));

if (app.isPackaged && !isGatewayProcess) {
    const originalResolveFilename = (Module as any)._resolveFilename;
    const originalLoad = (Module as any)._load;
    const resourcesOpenClaw = path.join(process.resourcesPath, 'openclaw');
    const resourcesOpenClawNodeModules = path.join(resourcesOpenClaw, 'node_modules');

    (Module as any)._resolveFilename = function (
        request: string,
        parent: any,
        isMain: boolean,
        options: any
    ) {
        if (request === 'openclaw') {
            return originalResolveFilename.call(this, resourcesOpenClaw, parent, isMain, options);
        }
        if (request.startsWith('openclaw/')) {
            const subPath = request.slice('openclaw/'.length);
            // Prepend "dist/" because openclaw package's exports map subpaths to dist/
            const basePath = path.join(resourcesOpenClaw, 'dist', subPath);

            // Check if it's a directory first
            try {
                const stat = fs.statSync(basePath);
                if (stat.isDirectory()) {
                    // Try index.js/index.ts inside the directory
                    if (fs.existsSync(path.join(basePath, 'index.js'))) {
                        return path.join(basePath, 'index.js');
                    }
                    if (fs.existsSync(path.join(basePath, 'index.ts'))) {
                        return path.join(basePath, 'index.ts');
                    }
                }
            } catch {
                // Not a directory or doesn't exist, continue with other checks
            }

            // Try exact path first (request may already include extension, e.g. 'openclaw/dist/plugin-sdk/index.js')
            if (fs.existsSync(basePath)) {
                return basePath;
            }
            // Try .ts first (source)
            if (fs.existsSync(basePath + '.ts')) {
                return basePath + '.ts';
            }
            // Try .js (compiled)
            if (fs.existsSync(basePath + '.js')) {
                return basePath + '.js';
            }
            // Try as directory with index.js
            if (fs.existsSync(path.join(basePath, 'index.js'))) {
                return path.join(basePath, 'index.js');
            }
            if (fs.existsSync(path.join(basePath, 'index.ts'))) {
                return path.join(basePath, 'index.ts');
            }

            // Fall back to Node's default resolution (respects package.json exports)
            return originalResolveFilename.call(this, request, parent, isMain, options);
        }

        const parentFilename = typeof parent?.filename === 'string' ? parent.filename : '';
        if (isBareSpecifier(request) && parentFilename.startsWith(resourcesOpenClaw)) {
            try {
                return originalResolveFilename.call(
                    this,
                    path.join(resourcesOpenClawNodeModules, request),
                    parent,
                    isMain,
                    options
                );
            } catch {
                // Fall through to Node's default resolution.
            }
        }

        // Fallback: catch absolute dev-machine paths baked into the bundle by Vite
        // (e.g. E:/my_ai_project/.../node_modules/.pnpm/openclaw@.../node_modules/openclaw/...)
        if (path.isAbsolute(request) && !fs.existsSync(request)) {
            const norm = request.replace(/\\/g, '/');

            // Absolute path referencing openclaw subpath → resolve from resources
            const ocMatch = norm.match(/\/node_modules\/openclaw\/(.+)/);
            if (ocMatch) {
                const basePath = path.join(resourcesOpenClaw, ocMatch[1]);
                for (const ext of ['', '.ts', '.js']) {
                    if (fs.existsSync(basePath + ext)) return basePath + ext;
                }
                for (const idx of ['index.js', 'index.ts']) {
                    if (fs.existsSync(path.join(basePath, idx))) return path.join(basePath, idx);
                }
            }

            // Absolute path referencing a dependency → resolve from openclaw's node_modules
            const nmIdx = norm.lastIndexOf('/node_modules/');
            if (nmIdx >= 0) {
                const depPath = norm.slice(nmIdx + '/node_modules/'.length);
                try {
                    return originalResolveFilename.call(
                        this,
                        path.join(resourcesOpenClawNodeModules, depPath),
                        parent, isMain, options
                    );
                } catch { /* fall through */ }
            }
        }

        return originalResolveFilename.call(this, request, parent, isMain, options);
    };

    const tsCache: Record<string, any> = {};

    (Module as any)._load = function (request: string, parent: any, isMain: boolean) {
        if (request.endsWith('.ts') || request.endsWith('.tsx')) {
            if (tsCache[request]) {
                return tsCache[request];
            }
            try {
                const transpiled = transpileTSFile(request);
                const module = new Module(request);
                (module as any)._compile(transpiled, request);
                tsCache[request] = module.exports;
                return module.exports;
            } catch {
                // typescript not available in packaged build; fall through
                // (all known .ts imports should be bundled by Vite)
            }
        }
        return originalLoad.call(this, request, parent, isMain);
    };
}
