import Module from 'module';
import { app } from 'electron';
import path from 'path';

// This file MUST be imported FIRST in the main process entry point.
// It patches Node's module resolver to correctly find `openclaw` when packaged.
if (app.isPackaged) {
    const originalResolveFilename = (Module as any)._resolveFilename;

    (Module as any)._resolveFilename = function (
        request: string,
        parent: any,
        isMain: boolean,
        options: any
    ) {
        if (request === 'openclaw' || request.startsWith('openclaw/')) {
            const resourcesOpenClaw = path.join(process.resourcesPath, 'openclaw', 'node_modules', request);
            return originalResolveFilename.call(this, resourcesOpenClaw, parent, isMain, options);
        }
        return originalResolveFilename.call(this, request, parent, isMain, options);
    };
}
