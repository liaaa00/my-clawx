/**
 * Gateway process preload script.
 *
 * Patches Module._compile to catch and log which specific file triggers
 * the "Cannot convert undefined or null to object" ESM translator error.
 * Also disables ASAR interception for the gateway subprocess.
 */
'use strict';

process.noAsar = true;

const Module = require('module');

// Wrap Module.prototype._compile to catch the exact file that triggers
// the ESM translator error. This helps identify the broken package.
const origCompile = Module.prototype._compile;
Module.prototype._compile = function (content, filename) {
  try {
    return origCompile.call(this, content, filename);
  } catch (err) {
    if (err && err.message && err.message.includes('Cannot convert undefined or null to object')) {
      // Log the exact file that caused the ESM error
      process.stderr.write('[gateway-preload] ESM translator error in: ' + filename + '\n');
      // Also log the parent module that required this file
      if (this.parent && this.parent.filename) {
        process.stderr.write('[gateway-preload] Required by: ' + this.parent.filename + '\n');
      }
    }
    throw err;
  }
};

// Also wrap Module._load to prevent null returns
const origLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  const result = origLoad.apply(this, arguments);
  if (result === null || result === undefined) {
    process.stderr.write('[gateway-preload] Module._load returned null for: ' + request + '\n');
    return {};
  }
  return result;
};

// ─── Kimi For Coding: inject User-Agent header ──────────────────────
// Kimi's /coding/v1 endpoint returns 403 unless the request comes from a
// recognized Coding Agent (Kimi CLI, Claude Code, Roo Code, etc.).
// Since the gateway subprocess doesn't go through Electron's session
// interceptors, we monkey-patch multiple HTTP mechanisms to add the required
// User-Agent header for all requests to api.kimi.com.

const KIMI_USER_AGENT = 'Kimi-CLI/1.0';
const KIMI_HOST = 'api.kimi.com';

function shouldPatchKimi(url) {
  if (!url) return false;
  const urlStr = typeof url === 'string' ? url : url.toString();
  return urlStr.includes(KIMI_HOST);
}

function shouldPatchKimiByHost(host) {
  return host && host.includes(KIMI_HOST);
}

// 1. Patch globalThis.fetch (undici / Node.js built-in fetch)
const origFetch = globalThis.fetch;
if (typeof origFetch === 'function') {
  globalThis.fetch = function patchedFetch(input, init) {
    const url = typeof input === 'string' ? input
      : input instanceof URL ? input.toString()
        : (input && typeof input === 'object' && input.url) ? input.url
          : '';

    if (shouldPatchKimi(url)) {
      init = init || {};
      if (init.headers instanceof Headers) {
        init.headers.set('User-Agent', KIMI_USER_AGENT);
      } else if (Array.isArray(init.headers)) {
        init.headers = init.headers.filter(([key]) => key.toLowerCase() !== 'user-agent');
        init.headers.push(['User-Agent', KIMI_USER_AGENT]);
      } else {
        init.headers = Object.assign({}, init.headers || {}, { 'User-Agent': KIMI_USER_AGENT });
      }
    }
    return origFetch.call(this, input, init);
  };
}

// 2. Patch undici's setGlobalDispatcher if available
try {
  const undici = require('undici');
  if (undici && undici.setGlobalDispatcher) {
    const origDispatcher = undici.getGlobalDispatcher ? undici.getGlobalDispatcher() : null;
    if (origDispatcher) {
      const { Dispatcher } = undici;
      class KimiDispatcher extends Dispatcher {
        dispatch(options, handler) {
          const host = options.origin ? (typeof options.origin === 'string' ? options.origin : options.origin.toString()) : '';
          if (shouldPatchKimi(host) || shouldPatchKimiByHost(options.origin?.host)) {
            options.headers = options.headers || [];
            // Remove existing User-Agent
            const idx = options.headers.findIndex(h => h.toLowerCase().startsWith('user-agent:'));
            if (idx >= 0) options.headers.splice(idx, 1);
            options.headers.push(`User-Agent: ${KIMI_USER_AGENT}`);
          }
          return origDispatcher.dispatch.call(origDispatcher, options, handler);
        }
        close(...args) { return origDispatcher.close.apply(origDispatcher, args); }
        destroy(...args) { return origDispatcher.destroy.apply(origDispatcher, args); }
      }
      undici.setGlobalDispatcher(new KimiDispatcher());
    }
  }
} catch (e) {
  // undici not available or patching failed, continue with other patches
}

// 3. Patch https.request (fallback for older HTTP patterns)
const https = require('https');
const origHttpsRequest = https.request;
https.request = function patchedRequest(urlOrOpts, optionsOrCb, cb) {
  if (typeof urlOrOpts === 'string' || urlOrOpts instanceof URL) {
    const urlStr = typeof urlOrOpts === 'string' ? urlOrOpts : urlOrOpts.toString();
    if (shouldPatchKimi(urlStr)) {
      if (typeof optionsOrCb === 'object' && optionsOrCb !== null) {
        optionsOrCb.headers = optionsOrCb.headers || {};
        optionsOrCb.headers['User-Agent'] = KIMI_USER_AGENT;
      }
    }
    return origHttpsRequest.call(this, urlOrOpts, optionsOrCb, cb);
  }
  if (urlOrOpts && typeof urlOrOpts === 'object') {
    const host = urlOrOpts.hostname || urlOrOpts.host || '';
    if (shouldPatchKimiByHost(host)) {
      urlOrOpts.headers = urlOrOpts.headers || {};
      urlOrOpts.headers['User-Agent'] = KIMI_USER_AGENT;
    }
  }
  return origHttpsRequest.call(this, urlOrOpts, optionsOrCb, cb);
};

// Log that Kimi patching is active
process.stderr.write('[gateway-preload] Kimi Coding User-Agent patch loaded\n');
