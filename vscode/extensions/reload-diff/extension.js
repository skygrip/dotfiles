'use strict';

const vscode = require('vscode');
const path = require('path');
const { computeLineDiff } = require('./diff');

let snapshots = new Map();         // fsPath.toLowerCase() -> text
let previousSnapshots = new Map(); // fsPath.toLowerCase() -> text (before latest reload)
let activeDiffs = new Map();       // fsPath.toLowerCase() -> diffResult
let autoFadeTimers = new Map();
let statusBarItem;
let outputChannel;

let addedDecorationType;
let modifiedDecorationType;
let deletedDecorationType;
let wordDiffDecorationType;

function getKey(uri) {
    return uri.fsPath ? uri.fsPath.toLowerCase() : uri.toString().toLowerCase();
}

function log(msg) {
    if (outputChannel) {
        outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ${msg}`);
    }
}

function createDecorations(context) {
    if (addedDecorationType) addedDecorationType.dispose();
    if (modifiedDecorationType) modifiedDecorationType.dispose();
    if (deletedDecorationType) deletedDecorationType.dispose();
    if (wordDiffDecorationType) wordDiffDecorationType.dispose();

    const config = vscode.workspace.getConfiguration('reloadDiff');
    const highlightBg = config.get('highlightLineBackground', true);

    const addedIcon = vscode.Uri.file(path.join(context.extensionPath, 'icons', 'added.svg'));
    const modifiedIcon = vscode.Uri.file(path.join(context.extensionPath, 'icons', 'modified.svg'));
    const deletedIcon = vscode.Uri.file(path.join(context.extensionPath, 'icons', 'deleted.svg'));

    const addedBg = config.get('addedLineColor') || new vscode.ThemeColor('diffEditor.insertedLineBackground');
    const modifiedBg = config.get('modifiedLineColor') || 'rgba(56, 139, 253, 0.16)';
    const wordBg = config.get('modifiedWordColor') || 'rgba(56, 139, 253, 0.38)';

    // Added Lines: Soft Green line tint + 4px Green left-edge bar
    addedDecorationType = vscode.window.createTextEditorDecorationType({
        isWholeLine: true,
        backgroundColor: highlightBg ? addedBg : undefined,
        borderWidth: '0 0 0 4px',
        borderStyle: 'solid',
        borderColor: new vscode.ThemeColor('editorGutter.addedBackground'),
        gutterIconPath: addedIcon,
        gutterIconSize: 'contain',
        overviewRulerColor: new vscode.ThemeColor('editorOverviewRuler.addedForeground'),
        overviewRulerLane: vscode.OverviewRulerLane.Full
    });

    // Modified Lines: Soft Blue line tint + 4px Blue left-edge bar
    modifiedDecorationType = vscode.window.createTextEditorDecorationType({
        isWholeLine: true,
        backgroundColor: highlightBg ? modifiedBg : undefined,
        borderWidth: '0 0 0 4px',
        borderStyle: 'solid',
        borderColor: new vscode.ThemeColor('editorGutter.modifiedBackground'),
        gutterIconPath: modifiedIcon,
        gutterIconSize: 'contain',
        overviewRulerColor: new vscode.ThemeColor('editorOverviewRuler.modifiedForeground'),
        overviewRulerLane: vscode.OverviewRulerLane.Full
    });

    // Word/Character Diff: Highlight changed token on modified lines
    wordDiffDecorationType = vscode.window.createTextEditorDecorationType({
        isWholeLine: false,
        backgroundColor: wordBg,
        borderRadius: '2px'
    });

    // Deleted Marker: Red line underline and overview ruler indicator
    deletedDecorationType = vscode.window.createTextEditorDecorationType({
        borderWidth: '0 0 2px 0',
        borderStyle: 'solid',
        borderColor: new vscode.ThemeColor('editorGutter.deletedBackground'),
        gutterIconPath: deletedIcon,
        gutterIconSize: 'contain',
        overviewRulerColor: new vscode.ThemeColor('editorOverviewRuler.deletedForeground'),
        overviewRulerLane: vscode.OverviewRulerLane.Full
    });
}

function applyDecorations(editor, diff) {
    if (!editor || !diff) return;

    const doc = editor.document;
    const maxLine = doc.lineCount - 1;

    const addedRanges = diff.added
        .filter(line => line <= maxLine)
        .map(line => new vscode.Range(line, 0, line, doc.lineAt(line).text.length));

    const modifiedRanges = diff.modified
        .filter(line => line <= maxLine)
        .map(line => new vscode.Range(line, 0, line, doc.lineAt(line).text.length));

    const deletedRanges = diff.deleted
        .filter(line => line <= maxLine)
        .map(line => new vscode.Range(line, 0, line, doc.lineAt(line).text.length));

    const wordRanges = (diff.wordRanges || [])
        .filter(r => r.line <= maxLine)
        .map(r => {
            const lineLen = doc.lineAt(r.line).text.length;
            return new vscode.Range(r.line, Math.min(r.start, lineLen), r.line, Math.min(r.end, lineLen));
        });

    editor.setDecorations(addedDecorationType, addedRanges);
    editor.setDecorations(modifiedDecorationType, modifiedRanges);
    editor.setDecorations(deletedDecorationType, deletedRanges);
    editor.setDecorations(wordDiffDecorationType, wordRanges);
}

function clearDecorations(editor) {
    if (!editor) return;
    editor.setDecorations(addedDecorationType, []);
    editor.setDecorations(modifiedDecorationType, []);
    editor.setDecorations(deletedDecorationType, []);
    editor.setDecorations(wordDiffDecorationType, []);
}

function updateStatusBar(editor) {
    if (!editor || editor.document.uri.scheme !== 'file') {
        statusBarItem.hide();
        return;
    }

    const key = getKey(editor.document.uri);
    const diff = activeDiffs.get(key);

    if (diff && (diff.stats.addedCount > 0 || diff.stats.modifiedCount > 0 || diff.stats.deletedCount > 0)) {
        statusBarItem.text = `$(diff) Reload Diff: +${diff.stats.addedCount} ~${diff.stats.modifiedCount} -${diff.stats.deletedCount}`;
        statusBarItem.tooltip = `Reload Diff: ${diff.stats.addedCount} added, ${diff.stats.modifiedCount} modified, ${diff.stats.deletedCount} deleted.\nClick to view Side-by-Side Diff.`;
        statusBarItem.command = 'reloadDiff.openDiff';
        statusBarItem.show();
    } else {
        statusBarItem.hide();
    }
}

function activate(context) {
    outputChannel = vscode.window.createOutputChannel('Reload Diff');
    context.subscriptions.push(outputChannel);
    log('Reload Diff extension activated.');

    createDecorations(context);

    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    context.subscriptions.push(statusBarItem);

    // Provide content for the "Before Reload" side-by-side snapshot
    const snapshotProvider = new (class {
        provideTextDocumentContent(uri) {
            const originalKey = decodeURIComponent(uri.query);
            return previousSnapshots.get(originalKey) || '';
        }
    })();
    context.subscriptions.push(
        vscode.workspace.registerTextDocumentContentProvider('reload-diff-snapshot', snapshotProvider)
    );

    // Register Hover Provider for instant in-editor before/after comparison
    context.subscriptions.push(
        vscode.languages.registerHoverProvider({ scheme: 'file' }, {
            provideHover(document, position) {
                const key = getKey(document.uri);
                const diff = activeDiffs.get(key);
                if (!diff || !diff.lineDetails) return null;

                const lineInfo = diff.lineDetails.get(position.line);
                if (!lineInfo) return null;

                const md = new vscode.MarkdownString();
                md.isTrusted = true;
                md.supportHtml = true;

                md.appendMarkdown('### ⚡ **Reload Diff**\n\n');

                if (lineInfo.type === 'modified') {
                    md.appendMarkdown('```diff\n');
                    if (lineInfo.oldBlock && lineInfo.oldBlock.length > 0) {
                        for (const l of lineInfo.oldBlock) md.appendMarkdown(`- ${l}\n`);
                    } else if (lineInfo.oldText !== undefined) {
                        md.appendMarkdown(`- ${lineInfo.oldText}\n`);
                    }
                    if (lineInfo.newBlock && lineInfo.newBlock.length > 0) {
                        for (const l of lineInfo.newBlock) md.appendMarkdown(`+ ${l}\n`);
                    } else if (lineInfo.newText !== undefined) {
                        md.appendMarkdown(`+ ${lineInfo.newText}\n`);
                    }
                    md.appendMarkdown('```\n\n');
                } else if (lineInfo.type === 'added') {
                    md.appendMarkdown('```diff\n');
                    md.appendMarkdown(`+ ${lineInfo.newText}\n`);
                    md.appendMarkdown('```\n\n');
                } else if (lineInfo.type === 'deleted') {
                    md.appendMarkdown('```diff\n');
                    if (lineInfo.oldBlock) {
                        for (const l of lineInfo.oldBlock) md.appendMarkdown(`- ${l}\n`);
                    } else if (lineInfo.oldText) {
                        md.appendMarkdown(`- ${lineInfo.oldText}\n`);
                    }
                    md.appendMarkdown('```\n\n');
                }

                md.appendMarkdown('[🔍 Compare Side-by-Side](command:reloadDiff.openDiff)  |  [✕ Dismiss](command:reloadDiff.clear)');
                return new vscode.Hover(md);
            }
        })
    );

    // Snapshot existing open documents
    for (const doc of vscode.workspace.textDocuments) {
        if (doc.uri.scheme === 'file') {
            const key = getKey(doc.uri);
            snapshots.set(key, doc.getText());
            log(`Snapshotted initial state: ${doc.fileName}`);
        }
    }

    // Track document open
    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(doc => {
            if (doc.uri.scheme === 'file') {
                const key = getKey(doc.uri);
                if (!snapshots.has(key)) {
                    snapshots.set(key, doc.getText());
                    log(`Tracked open file: ${doc.fileName}`);
                }
            }
        })
    );

    // Track document close
    context.subscriptions.push(
        vscode.workspace.onDidCloseTextDocument(doc => {
            if (doc.uri.scheme === 'file') {
                const key = getKey(doc.uri);
                snapshots.delete(key);
                previousSnapshots.delete(key);
                activeDiffs.delete(key);
                if (autoFadeTimers.has(key)) {
                    clearTimeout(autoFadeTimers.get(key));
                    autoFadeTimers.delete(key);
                }
            }
        })
    );

    // Main diff detection on reload / modification
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(event => {
            const config = vscode.workspace.getConfiguration('reloadDiff');
            if (!config.get('enabled', true)) return;

            const doc = event.document;
            if (doc.uri.scheme !== 'file') return;

            const key = getKey(doc.uri);
            const oldText = snapshots.get(key);
            const newText = doc.getText();

            if (oldText === undefined) {
                snapshots.set(key, newText);
                return;
            }

            if (oldText === newText) {
                return;
            }

            // Save previous snapshot for side-by-side comparison
            previousSnapshots.set(key, oldText);

            // Compute line and intra-line word diff
            const diff = computeLineDiff(oldText, newText);
            activeDiffs.set(key, diff);
            snapshots.set(key, newText);

            log(`Diff detected in ${path.basename(doc.fileName)}: +${diff.stats.addedCount} ~${diff.stats.modifiedCount} -${diff.stats.deletedCount}, ${diff.wordRanges.length} word changes`);

            // Apply decorations to visible editors showing this document
            for (const editor of vscode.window.visibleTextEditors) {
                if (getKey(editor.document.uri) === key) {
                    applyDecorations(editor, diff);
                }
            }

            if (vscode.window.activeTextEditor && getKey(vscode.window.activeTextEditor.document.uri) === key) {
                updateStatusBar(vscode.window.activeTextEditor);
            }

            // Handle auto-fade if configured (default 30 seconds)
            const autoFade = config.get('autoFadeSeconds', 30);
            if (autoFade > 0) {
                if (autoFadeTimers.has(key)) {
                    clearTimeout(autoFadeTimers.get(key));
                }
                const timer = setTimeout(() => {
                    activeDiffs.delete(key);
                    for (const editor of vscode.window.visibleTextEditors) {
                        if (getKey(editor.document.uri) === key) {
                            clearDecorations(editor);
                        }
                    }
                    if (vscode.window.activeTextEditor && getKey(vscode.window.activeTextEditor.document.uri) === key) {
                        updateStatusBar(vscode.window.activeTextEditor);
                    }
                    autoFadeTimers.delete(key);
                    log(`Auto-cleared highlights after ${autoFade}s for ${path.basename(doc.fileName)}`);
                }, autoFade * 1000);
                autoFadeTimers.set(key, timer);
            }
        })
    );

    // Update active editor decorations & status bar when switching tabs
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor && editor.document.uri.scheme === 'file') {
                const key = getKey(editor.document.uri);
                if (!snapshots.has(key)) {
                    snapshots.set(key, editor.document.getText());
                }
                const diff = activeDiffs.get(key);
                if (diff) {
                    applyDecorations(editor, diff);
                }
                updateStatusBar(editor);
            } else {
                statusBarItem.hide();
            }
        })
    );

    // Reload settings when config changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('reloadDiff')) {
                createDecorations(context);
                for (const editor of vscode.window.visibleTextEditors) {
                    const key = getKey(editor.document.uri);
                    const diff = activeDiffs.get(key);
                    if (diff) applyDecorations(editor, diff);
                }
            }
        })
    );

    // Command: Clear highlights
    context.subscriptions.push(
        vscode.commands.registerCommand('reloadDiff.clear', () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const key = getKey(editor.document.uri);
                activeDiffs.delete(key);
                clearDecorations(editor);
                updateStatusBar(editor);
                log(`Cleared highlights for ${editor.document.fileName}`);
            }
        })
    );

    // Command: Open side-by-side diff against previous state
    context.subscriptions.push(
        vscode.commands.registerCommand('reloadDiff.openDiff', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.document.uri.scheme !== 'file') return;

            const doc = editor.document;
            const key = getKey(doc.uri);

            if (!previousSnapshots.has(key)) {
                vscode.window.showInformationMessage('No prior snapshot recorded for this file yet.');
                return;
            }

            const snapshotUri = vscode.Uri.parse(`reload-diff-snapshot:${path.basename(doc.fileName)}?${encodeURIComponent(key)}`);
            const fileName = path.basename(doc.fileName);
            await vscode.commands.executeCommand(
                'vscode.diff',
                snapshotUri,
                doc.uri,
                `${fileName} (Before Reload) ↔ (Current)`
            );
        })
    );

    // Command: Toggle enabled
    context.subscriptions.push(
        vscode.commands.registerCommand('reloadDiff.toggle', async () => {
            const config = vscode.workspace.getConfiguration('reloadDiff');
            const current = config.get('enabled', true);
            await config.update('enabled', !current, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`Reload Diff is now ${!current ? 'Enabled' : 'Disabled'}.`);
        })
    );
}

function deactivate() {
    if (statusBarItem) statusBarItem.dispose();
    if (outputChannel) outputChannel.dispose();
    if (addedDecorationType) addedDecorationType.dispose();
    if (modifiedDecorationType) modifiedDecorationType.dispose();
    if (deletedDecorationType) deletedDecorationType.dispose();
    if (wordDiffDecorationType) wordDiffDecorationType.dispose();
}

module.exports = { activate, deactivate };
