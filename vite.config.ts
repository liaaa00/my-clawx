import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        // Main process entry file
        entry: 'electron/main/index.ts',
        onstart(options) {
          options.startup();
        },
        vite: {
          build: {
            outDir: 'dist-electron/main',
            rollupOptions: {
              // Externalize ALL node_modules for electron main process.
              // The main process runs in Node.js; packages are available at runtime.
              external: (id) => {
                // Bundle openclaw extension .ts source files — typescript is not
                // available at runtime in packaged builds so they must be transpiled here.
                if (id.startsWith('openclaw/extensions/')) return false;
                if (id.includes('/openclaw/extensions/') || id.includes('\\openclaw\\extensions\\')) return false;

                // Externalize all other openclaw paths (main entry, dist/*, plugin-sdk, etc.).
                // Resolved at runtime by the banner patch + patch-require.ts.
                if (id === 'openclaw' || id.startsWith('openclaw/')) return true;
                if (id.includes('/node_modules/openclaw/') || id.includes('\\node_modules\\openclaw\\')) return true;

                if (id.startsWith('electron')) return true;
                if (id.startsWith('node:')) return true;
                if (id.includes('/node_modules/') || id.includes('\\node_modules\\')) return true;
                if (!id.startsWith('.') && !id.startsWith('/') && !id.includes(':')) return true;
                return false;
              },
              output: {
                // Inject a Module._resolveFilename patch BEFORE Rollup's hoisted require() calls.
                // Without this, require("openclaw/...") at the top of the bundle would fail
                // because patch-require.ts hasn't executed yet at that point.
                banner: [
                  ';(function(){',
                  'var M=require("module"),E=require("electron"),P=require("path"),F=require("fs");',
                  'var isPackaged=E.app.isPackaged,hasGateway=process.argv.some(function(a){return a.includes("gateway")});',
                  'var shouldPatch=!isPackaged||hasGateway;',
                  'if(shouldPatch){return;}var _r=M._resolveFilename,_d=P.join(process.resourcesPath,"openclaw"),_nm=P.join(_d,"node_modules");',
                  'M._resolveFilename=function(q,p,m,o){',
                  '  if(q==="openclaw")return _r.call(this,_d,p,m,o);',
                  '  if(q.startsWith("openclaw/")){',
                  '    var subPath=q.slice(9);',
                  '    var b=P.join(_d,"dist",subPath);',
                  '    var st=null;',
                  '    try{st=F.existsSync(b)?F.statSync(b):null;}catch(e){}',
                  '    if(st&&st.isDirectory()){',
                  '      if(F.existsSync(P.join(b,"index.js")))return P.join(b,"index.js");',
                  '      if(F.existsSync(P.join(b,"index.ts")))return P.join(b,"index.ts");',
                  '    }',
                  '    if(F.existsSync(b+".ts"))return b+".ts";',
                  '    if(F.existsSync(b+".js"))return b+".js";',
                  '    if(F.existsSync(P.join(b,"index.js")))return P.join(b,"index.js");',
                  '    if(F.existsSync(P.join(b,"index.ts")))return P.join(b,"index.ts");',
                  '  }',
                  '  var pf=typeof(p&&p.filename)==="string"?p.filename:"";',
                  '  if(q[0]!=="."&&!P.isAbsolute(q)&&!q.includes(":")&&pf.startsWith(_d)){',
                  '    try{return _r.call(this,P.join(_nm,q),p,m,o)}catch(e){}',
                  '  }',
                  '  return _r.call(this,q,p,m,o);',
                  '};',
                  '})();',
                ].join('\n'),
                // Rewrite externalized absolute paths (e.g. pnpm virtual-store paths)
                // back to bare specifiers so the bundle never contains dev-machine paths.
                paths: (id) => {
                  const norm = id.replace(/\\/g, '/');
                  const idx = norm.lastIndexOf('/node_modules/');
                  if (idx >= 0) {
                    return norm.slice(idx + '/node_modules/'.length);
                  }
                  return id;
                },
              },
            },
          },
        },
      },
      {
        // Preload scripts entry file
        entry: 'electron/preload/index.ts',
        onstart(options) {
          options.reload();
        },
        vite: {
          build: {
            outDir: 'dist-electron/preload',
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@electron': resolve(__dirname, 'electron'),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
