## ClawX Tool Notes

### uv (Python)

- `uv` is the default Python environment manager. It is bundled with ClawX and on PATH.
- Use `uv run python <script>` to execute Python scripts.
- Use `uv pip install <package>` to install packages.
- Do NOT use bare `python` or `pip` -- always go through `uv`.

### Browser

- The `browser` tool provides full browser automation via OpenClaw's browser control server.
- Default profile is "openclaw" (isolated managed browser using system Chrome/Brave/Edge).
- Use `action="start"` to launch the browser, then `action="snapshot"` to see the page, `action="act"` to interact.
- Use `action="open"` with `targetUrl` to open new tabs.
- Refs from snapshots (e.g. `e12`) are used in `act` actions to click/type on specific elements.
- For simple "open a URL for the user to see", use `shell:openExternal` instead.

### Provider Management (AI Model Providers)

ClawX manages AI providers through `openclaw.json`. You can help users configure providers using the `gateway` tool.

#### Auto-detect local Ollama

Before adding Ollama manually, check if it's running:

```bash
curl -s http://localhost:11434/api/tags
```

If it responds with model data, Ollama is active and you can configure it.

#### Adding a Provider via gateway config.patch

Use the `gateway` tool with `action="config.patch"` to add provider configurations.

**Ollama (local, no API key needed):**

```json
{
  "action": "config.patch",
  "patch": {
    "models": {
      "providers": {
        "ollama": {
          "baseUrl": "http://localhost:11434",
          "api": "ollama"
        }
      }
    },
    "agents": {
      "defaults": {
        "model": "ollama/<model-name>"
      }
    }
  }
}
```

Replace `<model-name>` with the actual model (e.g. `qwen3:8b`, `llama3:8b`). Get available models from `curl http://localhost:11434/api/tags`.

**OpenAI:**

```json
{
  "action": "config.patch",
  "patch": {
    "models": {
      "providers": {
        "openai": {
          "baseUrl": "https://api.openai.com/v1",
          "api": "openai",
          "apiKeyEnv": "OPENAI_API_KEY"
        }
      }
    },
    "agents": {
      "defaults": {
        "model": "openai/gpt-4o"
      }
    }
  }
}
```

**Google Gemini:**

```json
{
  "action": "config.patch",
  "patch": {
    "models": {
      "providers": {
        "google": {
          "baseUrl": "https://generativelanguage.googleapis.com/v1beta",
          "api": "google",
          "apiKeyEnv": "GOOGLE_API_KEY"
        }
      }
    },
    "agents": {
      "defaults": {
        "model": "google/gemini-2.5-flash"
      }
    }
  }
}
```

**Anthropic Claude:**

```json
{
  "action": "config.patch",
  "patch": {
    "models": {
      "providers": {
        "anthropic": {
          "baseUrl": "https://api.anthropic.com",
          "api": "anthropic",
          "apiKeyEnv": "ANTHROPIC_API_KEY"
        }
      }
    },
    "agents": {
      "defaults": {
        "model": "anthropic/claude-sonnet-4-20250514"
      }
    }
  }
}
```

**Volcengine (火山引擎):**

```json
{
  "action": "config.patch",
  "patch": {
    "models": {
      "providers": {
        "volcengine": {
          "baseUrl": "https://ark.cn-beijing.volces.com/api/v3",
          "api": "openai",
          "apiKeyEnv": "VOLCENGINE_API_KEY"
        }
      }
    },
    "agents": {
      "defaults": {
        "model": "volcengine/<endpoint-id>"
      }
    }
  }
}
```

**Aliyun (阿里云通义):**

```json
{
  "action": "config.patch",
  "patch": {
    "models": {
      "providers": {
        "aliyun": {
          "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
          "api": "openai",
          "apiKeyEnv": "ALIYUN_API_KEY"
        }
      }
    },
    "agents": {
      "defaults": {
        "model": "aliyun/qwen-plus"
      }
    }
  }
}
```

**SiliconFlow:**

```json
{
  "action": "config.patch",
  "patch": {
    "models": {
      "providers": {
        "siliconflow": {
          "baseUrl": "https://api.siliconflow.cn/v1",
          "api": "openai",
          "apiKeyEnv": "SILICONFLOW_API_KEY"
        }
      }
    },
    "agents": {
      "defaults": {
        "model": "siliconflow/deepseek-ai/DeepSeek-R1"
      }
    }
  }
}
```

#### Important Notes

1. **API Keys**: For cloud providers, ask the user for their API key. Store it using `exec` to set environment variables, or instruct the user to add it in ClawX Settings → AI Providers → Edit.
2. **After config.patch**: Always call `gateway` with `action="restart"` to apply the changes.
3. **Verification**: After restart, test by sending a simple message to confirm the model responds.
4. **ClawX GUI sync**: After using `config.patch`, the user should also add the provider in ClawX Settings for full GUI management (API key storage, model selection UI). For Ollama, this is optional since no API key is needed.
5. **Model format**: Always use `provider/model` format (e.g. `ollama/qwen3:8b`, `openai/gpt-4o`).
