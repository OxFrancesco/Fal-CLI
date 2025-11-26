import {
    createCliRenderer,
    SelectRenderable,
    InputRenderable,
    TextRenderable,
    BoxRenderable,
    SelectRenderableEvents,
    InputRenderableEvents,
    type CliRenderer,
    type SelectOption,
    t,
    bold,
    fg,
} from "@opentui/core";
import { generateMedia, downloadMedia } from "./fal";
import { appendFileSync, writeFileSync } from "fs";
import { join } from "path";

// Log file for debugging
import { mkdirSync, existsSync } from "fs";

const LOG_DIR = join(process.cwd(), "logs");
if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
}
const LOG_FILE = join(LOG_DIR, `${new Date().toISOString().replace(/[:.]/g, "-")}.log`);
writeFileSync(LOG_FILE, `=== FAL CLI Log Started ${new Date().toISOString()} ===\n`);

function logToFile(msg: string) {
    try {
        appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${msg}\n`);
    } catch {}
}

// Color scheme
const colors = {
    background: "#0f172a",
    surface: "#1e293b",
    border: "#475569",
    borderFocus: "#3b82f6",
    text: "#e2e8f0",
    textMuted: "#94a3b8",
    selection: "#3b82f6",
    success: "#059669",
    error: "#dc2626",
    warning: "#d97706",
};

const aspectRatios: SelectOption[] = [
    { name: "Square (1:1)", value: "1:1", description: "1024x1024 - Social media" },
    { name: "Landscape (16:9)", value: "16:9", description: "1920x1080 - Widescreen" },
    { name: "Portrait (9:16)", value: "9:16", description: "1080x1920 - Mobile" },
    { name: "Wide (21:9)", value: "21:9", description: "Ultrawide cinematic" },
    { name: "Photo (4:3)", value: "4:3", description: "Classic photo" },
];

interface FalModel {
    id: string;
    title: string;
    category: string;
    description: string;
    tags: string[];
}

let renderer: CliRenderer;
let allModels: FalModel[] = [];
let filteredModels: SelectOption[] = [];

// UI Elements
let searchInput: InputRenderable;
let searchBox: BoxRenderable;
let modelSelect: SelectRenderable;
let modelBox: BoxRenderable;
let ratioSelect: SelectRenderable;
let ratioBox: BoxRenderable;
let promptInput: InputRenderable;
let promptBox: BoxRenderable;
let generateBtn: BoxRenderable;
let btnText: TextRenderable;
let logText: TextRenderable;
let statusText: TextRenderable;
let footerText: TextRenderable;

let logs: string[] = [];
let isGenerating = false;

// Focus management
let focusableElements: (SelectRenderable | InputRenderable)[] = [];
let focusableBoxes: BoxRenderable[] = [];
let focusIndex = 0;

// Fuzzy search with scoring
function fuzzyScore(query: string, target: string): number {
    const q = query.toLowerCase();
    const t = target.toLowerCase();
    
    if (t === q) return 1000;
    if (t.startsWith(q)) return 500 + (q.length / t.length) * 100;
    if (t.includes(` ${q}`) || t.includes(`-${q}`)) return 300 + (q.length / t.length) * 50;
    if (t.includes(q)) return 200 + (q.length / t.length) * 50;
    
    // Character-by-character fuzzy match
    let score = 0, qi = 0, consecutive = 0, lastMatch = -2;
    
    for (let i = 0; i < t.length && qi < q.length; i++) {
        if (t[i] === q[qi]) {
            score += (i === lastMatch + 1) ? 10 + (++consecutive * 5) : 5;
            if (i === 0 || " -/".includes(t[i - 1] ?? "")) score += 15;
            lastMatch = i;
            qi++;
            consecutive = i === lastMatch + 1 ? consecutive : 0;
        }
    }
    
    return qi === q.length ? score : 0;
}

function scoreModel(model: FalModel, query: string): number {
    const q = query.toLowerCase().trim();
    if (!q) return 0;
    
    return (
        fuzzyScore(q, model.title) * 3 +
        fuzzyScore(q, model.id) * 2 +
        fuzzyScore(q, model.category) * 1.5 +
        fuzzyScore(q, model.description) * 0.5 +
        Math.max(...model.tags.map(tag => fuzzyScore(q, tag)), 0) * 1.2
    );
}

async function fetchModels(): Promise<FalModel[]> {
    try {
        const response = await fetch("https://fal.ai/api/models?limit=1000");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json() as { items?: any[] };
        // Only include text-to-image and text-to-video models (not image-to-image, image-to-video, etc.)
        const supportedCategories = ["text-to-image", "text-to-video"];
        // Exclude models that require image input despite being categorized as text-to-*
        const excludePatterns = ["/edit", "/lora", "/img2img", "/inpaint", "/outpaint", "/upscale", "/controlnet", "/ip-adapter", "/redux", "/canny", "/depth"];
        
        return (data.items ?? [])
            .filter((m: any) => {
                if (m.deprecated || m.removed || m.unlisted) return false;
                if (m.kind !== "inference") return false;
                if (!supportedCategories.includes(m.category)) return false;
                // Exclude models that need image input
                const id = m.id.toLowerCase();
                if (excludePatterns.some(p => id.includes(p))) return false;
                return true;
            })
            .map((m: any) => ({
                id: m.id,
                title: m.title || m.id.split('/').pop(),
                category: m.category || "other",
                description: m.shortDescription || "",
                tags: m.tags || [],
            }));
    } catch (e: any) {
        addLog(`Fetch failed: ${e.message}, using defaults`);
        return [
            { id: "fal-ai/flux-2", title: "Flux 2", category: "text-to-image", description: "Latest Flux", tags: [] },
            { id: "fal-ai/flux/dev", title: "FLUX.1 [dev]", category: "text-to-image", description: "High quality", tags: [] },
            { id: "fal-ai/flux/schnell", title: "FLUX.1 [schnell]", category: "text-to-image", description: "Fast", tags: [] },
            { id: "fal-ai/recraft-v3", title: "Recraft V3", category: "text-to-image", description: "Vector art", tags: [] },
            { id: "fal-ai/kling-video/v1.6/pro/text-to-video", title: "Kling 1.6", category: "text-to-video", description: "Video", tags: [] },
            { id: "fal-ai/veo2", title: "Veo 2", category: "text-to-video", description: "Google video", tags: [] },
            { id: "fal-ai/luma-dream-machine", title: "Luma", category: "text-to-video", description: "Video", tags: [] },
        ];
    }
}

function filterModels(query: string) {
    const q = query.trim();
    
    let results: { model: FalModel; score: number }[];
    
    if (!q) {
        // Default: prioritize popular models
        results = allModels.map(m => ({
            model: m,
            score: /flux|veo|kling|wan|stable/i.test(m.title) ? 100 : 0
        }));
    } else {
        results = allModels.map(m => ({ model: m, score: scoreModel(m, q) })).filter(r => r.score > 0);
    }
    
    results.sort((a, b) => b.score - a.score);
    
    filteredModels = results.slice(0, 100).map(r => ({
        name: r.model.title,
        value: r.model.id,
        description: `[${r.model.category}] ${r.model.description}`.slice(0, 50),
    }));
    
    if (modelSelect) {
        modelSelect.options = filteredModels.length > 0
            ? filteredModels
            : [{ name: "No matches", value: "", description: "Try different terms" }];
        modelSelect.selectedIndex = 0;
    }
    
    updateStatus();
}

function addLog(msg: string) {
    logToFile(msg);
    logs.push(msg);
    if (logs.length > 50) logs.shift();
    if (logText) logText.content = logs.slice(-5).join("\n");
}

function updateStatus() {
    if (!statusText) return;
    const sel = modelSelect?.getSelectedOption();
    statusText.content = sel?.value
        ? `${sel.name} | ${filteredModels.length}/${allModels.length}`
        : `${filteredModels.length}/${allModels.length} models`;
}

function updateFocus() {
    focusableElements.forEach((el, i) => i === focusIndex ? el.focus() : el.blur());
    focusableBoxes.forEach((b, i) => i === focusIndex ? b.focus() : b.blur());
    
    const hints = [
        "Type to fuzzy search | TAB: next | ENTER: go to models",
        "↑↓/jk: browse | ENTER: select | /: search | TAB: next",
        "↑↓/jk: browse | ENTER: select | TAB: next",
        "Type prompt | ENTER: generate | TAB: cycle",
    ] as const;
    if (footerText) footerText.content = t`${fg(colors.textMuted)((hints[focusIndex] ?? hints[0]) + " | CTRL+C: quit")}`;
}

async function handleGenerate() {
    if (isGenerating) return;
    
    const model = modelSelect.getSelectedOption()?.value;
    const prompt = promptInput.value;
    
    if (!model) { addLog("Error: Select a model"); return; }
    if (!prompt) { addLog("Error: Enter a prompt"); return; }
    
    isGenerating = true;
    btnText.content = " GENERATING... ";
    generateBtn.backgroundColor = colors.warning;
    generateBtn.borderColor = colors.warning;
    addLog(`Starting: ${modelSelect.getSelectedOption()?.name}`);
    
    const ratio = ratioSelect.getSelectedOption()?.value || "1:1";
    const ratioMap: Record<string, string> = {
        "1:1": "square_hd", "16:9": "landscape_16_9", "9:16": "portrait_16_9",
        "21:9": "landscape_16_9", "4:3": "landscape_4_3"
    };
    const mappedRatio = model.includes("flux") || model.includes("recraft") ? ratioMap[ratio] || "square_hd" : ratio;
    
    try {
        const result = await generateMedia(model, prompt, mappedRatio, addLog);
        
        if (result) {
            btnText.content = " SUCCESS! ";
            generateBtn.backgroundColor = colors.success;
            generateBtn.borderColor = colors.success;
            const ext = result.contentType.split("/")[1] || "bin";
            addLog(`Saved: ${await downloadMedia(result.url, ext, model)}`);
        } else {
            btnText.content = " FAILED ";
            generateBtn.backgroundColor = colors.error;
            generateBtn.borderColor = colors.error;
        }
    } catch (e: any) {
        addLog(`Error: ${e.message}`);
        btnText.content = " ERROR ";
        generateBtn.backgroundColor = colors.error;
        generateBtn.borderColor = colors.error;
    } finally {
        isGenerating = false;
        setTimeout(() => {
            btnText.content = " GENERATE ";
            generateBtn.backgroundColor = colors.success;
            generateBtn.borderColor = colors.success;
        }, 2000);
    }
}

async function main() {
    logToFile("Starting CLI...");
    
    try {
        renderer = await createCliRenderer({ exitOnCtrlC: true });
        logToFile("Renderer created");
    } catch (e: any) {
        logToFile(`Failed to create renderer: ${e.message}\n${e.stack}`);
        throw e;
    }
    
    renderer.start();
    renderer.setBackgroundColor(colors.background);
    logToFile("Renderer started");

    // Header
    const header = new BoxRenderable(renderer, { id: "header", height: 3, flexShrink: 0, backgroundColor: colors.selection, border: true, borderColor: colors.borderFocus });
    header.add(new TextRenderable(renderer, { id: "header-text", content: t`${bold(fg("#fff")("  FAL.AI MEDIA GENERATOR"))}`, flexGrow: 1 }));

    // Main layout
    const main = new BoxRenderable(renderer, { id: "main", flexDirection: "row", flexGrow: 1, gap: 1, paddingLeft: 1, paddingRight: 1, paddingTop: 1 });

    // Left: Search + Models
    const left = new BoxRenderable(renderer, { id: "left", flexDirection: "column", flexGrow: 1, minWidth: 40, maxWidth: "55%" });
    
    searchBox = new BoxRenderable(renderer, { id: "search-box", border: true, borderColor: colors.border, focusedBorderColor: colors.borderFocus, title: " Search ", height: 3, flexShrink: 0 });
    searchInput = new InputRenderable(renderer, { id: "search", width: "auto", height: 1, backgroundColor: colors.surface, textColor: colors.text, placeholder: "flux, video, kling...", placeholderColor: colors.textMuted, cursorColor: colors.borderFocus, flexGrow: 1 });
    searchBox.add(searchInput);
    
    const statusBar = new BoxRenderable(renderer, { id: "status", height: 1, flexShrink: 0, backgroundColor: colors.surface, paddingLeft: 1 });
    statusText = new TextRenderable(renderer, { id: "status-text", content: "Loading...", fg: colors.textMuted, flexGrow: 1 });
    statusBar.add(statusText);
    
    modelBox = new BoxRenderable(renderer, { id: "model-box", border: true, borderColor: colors.border, focusedBorderColor: colors.borderFocus, title: " Models ", flexGrow: 1, minHeight: 10 });
    modelSelect = new SelectRenderable(renderer, { id: "models", width: "auto", height: "auto", options: [{ name: "Loading...", value: "", description: "Fetching..." }], backgroundColor: colors.surface, textColor: colors.text, selectedBackgroundColor: colors.selection, selectedTextColor: "#fff", descriptionColor: colors.textMuted, showDescription: true, showScrollIndicator: true, wrapSelection: true, flexGrow: 1 });
    modelBox.add(modelSelect);
    
    left.add(searchBox);
    left.add(statusBar);
    left.add(modelBox);

    // Right: Ratio + Prompt + Generate
    const right = new BoxRenderable(renderer, { id: "right", flexDirection: "column", flexGrow: 1, minWidth: 35, gap: 1 });
    
    ratioBox = new BoxRenderable(renderer, { id: "ratio-box", border: true, borderColor: colors.border, focusedBorderColor: colors.borderFocus, title: " Aspect Ratio ", height: 9, flexShrink: 0 });
    ratioSelect = new SelectRenderable(renderer, { id: "ratios", width: "auto", height: "auto", options: aspectRatios, backgroundColor: colors.surface, textColor: colors.text, selectedBackgroundColor: colors.selection, selectedTextColor: "#fff", descriptionColor: colors.textMuted, showDescription: true, wrapSelection: true, flexGrow: 1 });
    ratioBox.add(ratioSelect);
    
    promptBox = new BoxRenderable(renderer, { id: "prompt-box", border: true, borderColor: colors.border, focusedBorderColor: colors.borderFocus, title: " Prompt ", flexGrow: 1, minHeight: 3 });
    promptInput = new InputRenderable(renderer, { id: "prompt", width: "auto", height: 1, backgroundColor: colors.surface, textColor: colors.text, placeholder: "A cat wearing sunglasses...", placeholderColor: colors.textMuted, cursorColor: colors.borderFocus, flexGrow: 1 });
    promptBox.add(promptInput);
    
    generateBtn = new BoxRenderable(renderer, { id: "btn", height: 3, flexShrink: 0, border: true, borderColor: colors.success, backgroundColor: colors.success });
    btnText = new TextRenderable(renderer, { id: "btn-text", content: " GENERATE ", fg: "#fff", flexGrow: 1 });
    generateBtn.add(btnText);
    
    right.add(ratioBox);
    right.add(promptBox);
    right.add(generateBtn);
    
    main.add(left);
    main.add(right);

    // Logs
    const logBox = new BoxRenderable(renderer, { id: "logs", border: true, borderColor: colors.border, title: " Logs ", height: 7, flexShrink: 0 });
    logText = new TextRenderable(renderer, { id: "log-text", content: "Ready. Search models and enter a prompt.", fg: colors.textMuted, flexGrow: 1 });
    logBox.add(logText);

    // Footer
    const footer = new BoxRenderable(renderer, { id: "footer", height: 1, flexShrink: 0, backgroundColor: colors.surface });
    footerText = new TextRenderable(renderer, { id: "footer-text", content: "", flexGrow: 1 });
    footer.add(footerText);

    renderer.root.add(header);
    renderer.root.add(main);
    renderer.root.add(logBox);
    renderer.root.add(footer);

    // Focus setup
    focusableElements = [searchInput, modelSelect, ratioSelect, promptInput];
    focusableBoxes = [searchBox, modelBox, ratioBox, promptBox];

    // Events
    searchInput.on(InputRenderableEvents.INPUT, filterModels);
    searchInput.on(InputRenderableEvents.ENTER, () => { focusIndex = 1; updateFocus(); });
    modelSelect.on(SelectRenderableEvents.SELECTION_CHANGED, updateStatus);
    modelSelect.on(SelectRenderableEvents.ITEM_SELECTED, () => {
        if (modelSelect.getSelectedOption()?.value) {
            addLog(`Selected: ${modelSelect.getSelectedOption()?.name}`);
            focusIndex = 2;
            updateFocus();
        }
    });
    ratioSelect.on(SelectRenderableEvents.ITEM_SELECTED, () => { focusIndex = 3; updateFocus(); });
    promptInput.on(InputRenderableEvents.ENTER, handleGenerate);

    renderer.keyInput.on("keypress", (key) => {
        if (key.name === "tab") {
            focusIndex = key.shift ? (focusIndex - 1 + 4) % 4 : (focusIndex + 1) % 4;
            updateFocus();
        } else if (key.sequence === "/" && focusIndex !== 0) {
            focusIndex = 0;
            updateFocus();
        }
    });

    logToFile("UI setup complete, updating focus...");
    updateFocus();
    
    logToFile("Fetching models from API...");
    addLog("Fetching models...");
    
    try {
        allModels = await fetchModels();
        logToFile(`Fetched ${allModels.length} models`);
        addLog(`Loaded ${allModels.length} models`);
    } catch (e: any) {
        logToFile(`Model fetch error: ${e.message}`);
        addLog(`Fetch error: ${e.message}`);
    }
    
    filterModels("");
    logToFile("CLI fully initialized");
}

main().catch((err) => {
    logToFile(`FATAL ERROR: ${err.message}\n${err.stack}`);
    console.error("Error logged to fal-cli.log");
    console.error(err);
    process.exit(1);
});
