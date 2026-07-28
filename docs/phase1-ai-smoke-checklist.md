# Phase 1: AI Provider Smoke Test Checklist

Use this checklist to manually verify that each provider key works end-to-end
through the Settings → AI Providers flow and the editor AI actions.

CI always runs with mocked provider calls. Run this checklist manually before
each release or when changing provider adapters.

---

## Pre-requisites

- Backend running locally (`uvicorn app.main:app --reload` from `backend/`)
- Frontend running locally (`npm run dev` from `frontend/`)
- Real API keys for whichever provider(s) you want to smoke-test

---

## Steps (repeat for each provider)

### 1. Open Settings → AI Providers

Navigate to **Settings → AI Providers** in the running app.

### 2. Add provider key

| Provider | Where to get a key | Key format hint |
|---|---|---|
| **Anthropic** | https://console.anthropic.com/settings/keys | `sk-ant-...` |
| **Google AI Studio** | https://aistudio.google.com/app/apikey | `AIza...` |
| **OpenCode Go** | https://opencode.ai/dashboard | `oc-...` |

- Paste the key into the appropriate provider field.
- Select a model from the list (the list should auto-populate after validation).
- Click **Save**. Expect a success toast. If you see an error, check the key.

### 3. Verify the provider becomes Active

- The saved provider should show an **Active** badge.
- If another provider was previously active, it should lose the Active badge.

### 4. Verify model auto-load

- After saving, the model dropdown should populate with models returned by the
  provider's API (Anthropic, Google) or from the curated OpenCode Go list.

### 5. Open a Project and run an editor AI action

Navigate to any Project → Document → Section.

Run each of the following actions and confirm a response appears within ~30 s:

- [ ] **Generate section** (click the Generate button for an empty section)
- [ ] **Refine section** (type an instruction in the AI panel and submit)
- [ ] **Phrasing suggestions** (select text → Phrasing options)
- [ ] **Chat** (open the AI assistant panel and send a message)
- [ ] **Generate outline** (from a project without sections, trigger outline generation)

### 6. Verify error messages for bad keys

- Set an intentionally invalid key (e.g., `bad-key-12345`) and click Save.
- Expect a clear error such as:
  - Anthropic: `"API key validation failed"` or similar
  - Google: `"API key not valid"` or similar
  - OpenCode Go: `"OpenCode Go request failed: 401"` or similar
- Verify the error is surfaced in the UI and does not show a raw stack trace.

### 7. Verify quota / rate-limit error categories

- If you intentionally exhaust a free-tier key, confirm the error mentions
  `"quota"` or `"rate limit"` rather than a generic `"unknown error"`.

---

## Provider-Specific Notes

### Anthropic

- Chat streaming uses the Anthropic SDK's native `async with client.messages.stream(...)`.
- Generation, refine, outline, and phrasing use the synchronous `complete_text` adapter.
- Both paths should work with any Claude model listed in Settings.

### Google AI Studio

- All operations (chat, generate, refine, outline, phrasing) use `complete_text`.
- Chat delivers a single response chunk rather than token-by-token streaming.
- Validated models: `gemini-2.0-flash`, `gemini-1.5-flash`.

### OpenCode Go

- All operations use `complete_text` via the OpenAI-compatible `/v1/chat/completions`
  endpoint at `https://opencode.ai/zen/go/v1/chat/completions`.
- Chat delivers a single response chunk.
- Validated models: `deepseek-v4-flash`, `deepseek-v4-pro`, `kimi-k2.6`, `kimi-k2.5`,
  `glm-5.1`, `glm-5`, `mimo-v2.5`, `mimo-v2.5-pro`.

---

## Expected error message catalogue

| Situation | Expected message fragment |
|---|---|
| No active credential | `"No active AI credential found. Add an AI provider in Settings."` |
| Invalid provider name | `"Unsupported provider: <name>"` |
| Invalid model for provider | `"Unsupported model '<model>' for <provider>"` |
| API key too short | `"API key is too short or empty"` |
| Anthropic 401 | `"Could not validate anthropic key: …"` |
| Google 400 | `"Could not validate google key: …"` |
| OpenCode Go 401 | `"OpenCode Go request failed: …"` |
| Quota exhausted (generation) | Run pauses, `failover_state = NEEDS_CONFIRMATION` |

---

*Last updated: Phase 1 execution — AI Integration Completion*
