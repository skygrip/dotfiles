# Pi Extension Development & Introspection Playbook

Pi’s managed runtime dependencies (`@earendil-works/pi-coding-agent`, `@earendil-works/pi-ai`, `@earendil-works/pi-tui`, and `jiti`) are installed in the managed release sandbox at `~/.pi/agent/install/releases/<version>/node_modules`.

You can use fast Node.js CLI one-liners to inspect exports, read ground-truth TypeScript definitions (`.d.ts`), and test TUI components headlessly in milliseconds without launching a full Pi session.

> [!TIP]
> The dynamic path resolver snippet below resolves the active managed release across all platforms:
> ```javascript
> const os = require('os'), path = require('path'), fs = require('fs');
> const ver = fs.readFileSync(path.join(os.homedir(), '.pi/agent/install/current-version'), 'utf8').trim();
> const piDir = path.join(os.homedir(), '.pi/agent/install/releases', ver, 'node_modules');
> ```

---

## 1. Live Runtime API & Export Inspection
Discover what methods, classes, and utilities are available at runtime:
```bash
# Inspect TUI components and helper exports (@earendil-works/pi-tui)
node -e "const os = require('os'), path = require('path'), fs = require('fs'); const ver = fs.readFileSync(path.join(os.homedir(), '.pi/agent/install/current-version'), 'utf8').trim(); const tui = require(path.join(os.homedir(), '.pi/agent/install/releases', ver, 'node_modules/@earendil-works/pi-tui')); console.log(Object.keys(tui));"

# Inspect AI model registry, streaming, and auth methods (@earendil-works/pi-ai)
node -e "const os = require('os'), path = require('path'), fs = require('fs'); const ver = fs.readFileSync(path.join(os.homedir(), '.pi/agent/install/current-version'), 'utf8').trim(); const ai = require(path.join(os.homedir(), '.pi/agent/install/releases', ver, 'node_modules/@earendil-works/pi-ai')); console.log(Object.keys(ai));"

# Inspect core Coding Agent exports (@earendil-works/pi-coding-agent)
node -e "const os = require('os'), path = require('path'), fs = require('fs'); const ver = fs.readFileSync(path.join(os.homedir(), '.pi/agent/install/current-version'), 'utf8').trim(); const pi = require(path.join(os.homedir(), '.pi/agent/install/releases', ver, 'node_modules/@earendil-works/pi-coding-agent')); console.log(Object.keys(pi));"
```

---

## 2. Reading Ground-Truth TypeScript Definitions (`.d.ts`)
When writing extensions, inspect the exact TypeScript types and interfaces directly from the source:
```bash
# Check exact props and methods for SelectList or any TUI component
node -e "const os = require('os'), path = require('path'), fs = require('fs'); const ver = fs.readFileSync(path.join(os.homedir(), '.pi/agent/install/current-version'), 'utf8').trim(); const p = path.join(os.homedir(), '.pi/agent/install/releases', ver, 'node_modules/@earendil-works/pi-tui/dist/components/select-list.d.ts'); console.log(fs.readFileSync(p, 'utf8'));"

# Check Models interface, streamSimple, and createModels options
node -e "const os = require('os'), path = require('path'), fs = require('fs'); const ver = fs.readFileSync(path.join(os.homedir(), '.pi/agent/install/current-version'), 'utf8').trim(); const p = path.join(os.homedir(), '.pi/agent/install/releases', ver, 'node_modules/@earendil-works/pi-ai/dist/models.d.ts'); console.log(fs.readFileSync(p, 'utf8'));"

# Check Usage, Message, and AssistantMessageEvent types
node -e "const os = require('os'), path = require('path'), fs = require('fs'); const ver = fs.readFileSync(path.join(os.homedir(), '.pi/agent/install/current-version'), 'utf8').trim(); const p = path.join(os.homedir(), '.pi/agent/install/releases', ver, 'node_modules/@earendil-works/pi-ai/dist/types.d.ts'); console.log(fs.readFileSync(p, 'utf8'));"
```

---

## 3. Dry-Run Extension Compilation with JITI
Verify TypeScript syntax and imports from the command line in 0.2s without starting a full agent session:
```bash
node -e "const os = require('os'), path = require('path'), fs = require('fs'); const ver = fs.readFileSync(path.join(os.homedir(), '.pi/agent/install/current-version'), 'utf8').trim(); const jiti = require(path.join(os.homedir(), '.pi/agent/install/releases', ver, 'node_modules/jiti')); const load = jiti(__dirname); load('./my-extension.ts'); console.log('✓ Extension syntax & imports OK');"
```

---

## 4. Inspecting Configured Models from `models.json` & Providers
Check what models Pi resolves from `models.json` and active environment keys headlessly:
```bash
node -e "
const os = require('os'), path = require('path'), fs = require('fs');
const ver = fs.readFileSync(path.join(os.homedir(), '.pi/agent/install/current-version'), 'utf8').trim();
const { createModels } = require(path.join(os.homedir(), '.pi/agent/install/releases', ver, 'node_modules/@earendil-works/pi-ai'));
const models = createModels();
console.log(models.getModels().map(m => m.provider + '/' + m.id));
"
```

---

## 5. Headless TUI Component Testing
Test how your custom UI components, search filters, or selectors render in a simulated terminal width before running them in Pi:
```bash
node -e "
const os = require('os'), path = require('path'), fs = require('fs');
const ver = fs.readFileSync(path.join(os.homedir(), '.pi/agent/install/current-version'), 'utf8').trim();
const { SelectList } = require(path.join(os.homedir(), '.pi/agent/install/releases', ver, 'node_modules/@earendil-works/pi-tui'));

const items = [
  { value: 'item-1', label: 'First Item', description: 'Description 1' },
  { value: 'item-2', label: 'Second Item', description: 'Description 2' }
];

const mockTheme = {
  selectedPrefix: t => '> ' + t,
  selectedText: t => t,
  description: t => ' - ' + t,
  scrollInfo: t => '[' + t + ']',
  noMatch: t => 'No match: ' + t
};

const list = new SelectList(items, 5, mockTheme);
console.log(list.render(80).join('\n'));
"
```

---

## 6. Fast Security Pattern & Regex Benchmark Runner
When writing security rules (e.g. in `permissions-gate.ts`), test evasive command strings in bulk instantly:
```bash
node -e "
const regex = /git\s+clean\s+-[a-zA-Z]*f/i;
const tests = ['git clean -f', 'git clean -fdx', 'git clean -xdf', 'git clean -n'];
tests.forEach(cmd => console.log(cmd.padEnd(20), '->', regex.test(cmd) ? 'BLOCKED 🚨' : 'ALLOWED ✅'));
"
```

---

## 7. Direct Isolated Sub-Call Execution (`complete` & `streamSimple`)
Test how a specific local or cloud model responds to an isolated system prompt without running the main agent loop:
```bash
node -e "
const os = require('os'), path = require('path'), fs = require('fs');
const ver = fs.readFileSync(path.join(os.homedir(), '.pi/agent/install/current-version'), 'utf8').trim();
const { createModels, complete } = require(path.join(os.homedir(), '.pi/agent/install/releases', ver, 'node_modules/@earendil-works/pi-ai'));
const models = createModels();
const model = models.getModel('google', 'gemini-flash-latest');
complete(model, { messages: [{ role: 'user', content: [{ type: 'text', text: 'ping' }], timestamp: Date.now() }] })
  .then(res => console.log('Response:', res.content[0].text))
  .catch(console.error);
"
```

---

## 8. Reverse-Engineering Pi’s Internal UI Implementations
Learn exact UI patterns by inspecting how Pi’s built-in selectors and components are implemented:
```bash
# Check how Pi's official /model search and selector component works
node -e "const os = require('os'), path = require('path'), fs = require('fs'); const ver = fs.readFileSync(path.join(os.homedir(), '.pi/agent/install/current-version'), 'utf8').trim(); const p = path.join(os.homedir(), '.pi/agent/install/releases', ver, 'node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/components/model-selector.js'); console.log(fs.readFileSync(p, 'utf8'));"

# Check how Pi's tool execution wrapper and renderResult handler works
node -e "const os = require('os'), path = require('path'), fs = require('fs'); const ver = fs.readFileSync(path.join(os.homedir(), '.pi/agent/install/current-version'), 'utf8').trim(); const p = path.join(os.homedir(), '.pi/agent/install/releases', ver, 'node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/components/tool-execution.js'); console.log(fs.readFileSync(p, 'utf8'));"
```
