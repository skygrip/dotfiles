'use strict';

/**
 * Tokenizes a line into words, spaces, and punctuation tokens.
 */
function tokenizeLine(line) {
    const tokens = [];
    const regex = /\w+|\s+|[^\w\s]/g;
    let match;
    while ((match = regex.exec(line)) !== null) {
        tokens.push({ text: match[0], start: match.index, end: match.index + match[0].length });
    }
    return tokens;
}

/**
 * Myers diff on generic arrays of string tokens.
 */
function diffTokens(oldWords, newWords) {
    const N = oldWords.length;
    const M = newWords.length;
    const max = N + M;
    if (max === 0) return [];

    let start = 0;
    while (start < N && start < M && oldWords[start] === newWords[start]) {
        start++;
    }
    let oldEnd = N - 1;
    let newEnd = M - 1;
    while (oldEnd >= start && newEnd >= start && oldWords[oldEnd] === newWords[newEnd]) {
        oldEnd--;
        newEnd--;
    }

    const oldSlice = oldWords.slice(start, oldEnd + 1);
    const newSlice = newWords.slice(start, newEnd + 1);
    const script = [];

    for (let i = 0; i < start; i++) {
        script.push({ type: 'equal', oldIdx: i, newIdx: i });
    }

    const subN = oldSlice.length;
    const subM = newSlice.length;
    const subMax = subN + subM;

    if (subMax > 0) {
        const v = { 1: 0 };
        const trace = [];

        for (let d = 0; d <= subMax; d++) {
            trace.push(Object.assign({}, v));
            for (let k = -d; k <= d; k += 2) {
                let x;
                if (k === -d || (k !== d && (v[k - 1] === undefined ? -Infinity : v[k - 1]) < (v[k + 1] === undefined ? -Infinity : v[k + 1]))) {
                    x = v[k + 1];
                } else {
                    x = v[k - 1] + 1;
                }
                let y = x - k;
                while (x < subN && y < subM && oldSlice[x] === newSlice[y]) {
                    x++;
                    y++;
                }
                v[k] = x;
                if (x >= subN && y >= subM) break;
            }
            if (v[subN - subM] >= subN) break;
        }

        let x = subN;
        let y = subM;
        const middleScript = [];

        for (let d = trace.length - 1; d > 0; d--) {
            const vState = trace[d];
            const k = x - y;
            let prevK;
            if (k === -d || (k !== d && (vState[k - 1] === undefined ? -Infinity : vState[k - 1]) < (vState[k + 1] === undefined ? -Infinity : vState[k + 1]))) {
                prevK = k + 1;
            } else {
                prevK = k - 1;
            }
            const prevX = vState[prevK];
            const prevY = prevX - prevK;

            while (x > prevX && y > prevY) {
                x--;
                y--;
                middleScript.unshift({ type: 'equal', oldIdx: start + x, newIdx: start + y });
            }

            if (x === prevX) {
                y--;
                middleScript.unshift({ type: 'insert', newIdx: start + y });
            } else if (y === prevY) {
                x--;
                middleScript.unshift({ type: 'delete', oldIdx: start + x });
            }
        }

        while (x > 0 && y > 0) {
            x--;
            y--;
            middleScript.unshift({ type: 'equal', oldIdx: start + x, newIdx: start + y });
        }

        script.push(...middleScript);
    }

    for (let i = 0; i < (N - 1 - oldEnd); i++) {
        script.push({ type: 'equal', oldIdx: oldEnd + 1 + i, newIdx: newEnd + 1 + i });
    }

    return script;
}

/**
 * Computes per-word inserted character ranges within a modified line.
 */
function getWordDiffRanges(oldLine, newLine) {
    if (oldLine === newLine) return [];
    if (!oldLine) {
        return [{ start: 0, end: newLine.length }];
    }

    const oldTokens = tokenizeLine(oldLine);
    const newTokens = tokenizeLine(newLine);
    const script = diffTokens(oldTokens.map(t => t.text), newTokens.map(t => t.text));

    const insertedRanges = [];
    let currentRange = null;

    for (const op of script) {
        if (op.type === 'insert') {
            const token = newTokens[op.newIdx];
            if (!currentRange) {
                currentRange = { start: token.start, end: token.end };
            } else {
                currentRange.end = token.end;
            }
        } else {
            if (currentRange) {
                insertedRanges.push(currentRange);
                currentRange = null;
            }
        }
    }
    if (currentRange) {
        insertedRanges.push(currentRange);
    }

    return insertedRanges;
}

function calculateSimilarity(str1, str2) {
    if (str1 === str2) return 1.0;
    if (!str1 || !str2) return 0.0;
    const len = Math.max(str1.length, str2.length);
    let common = 0;
    const minLen = Math.min(str1.length, str2.length);
    for (let i = 0; i < minLen; i++) {
        if (str1[i] === str2[i]) common++;
    }
    return common / len;
}

/**
 * Computes line-by-line and intra-line word diffs.
 */
function computeLineDiff(oldText, newText) {
    if (oldText === newText) {
        return {
            added: [],
            modified: [],
            deleted: [],
            wordRanges: [],
            lineDetails: new Map(),
            stats: { addedCount: 0, modifiedCount: 0, deletedCount: 0 }
        };
    }

    const oldLines = oldText.split(/\r?\n/);
    const newLines = newText.split(/\r?\n/);

    const script = diffTokens(oldLines, newLines);

    const added = [];
    const modified = [];
    const deleted = [];
    const wordRanges = [];
    const lineDetails = new Map();

    let i = 0;
    while (i < script.length) {
        if (script[i].type === 'equal') {
            i++;
            continue;
        }

        const deleteOps = [];
        const insertOps = [];

        while (i < script.length && script[i].type !== 'equal') {
            if (script[i].type === 'delete') {
                deleteOps.push(script[i]);
            } else if (script[i].type === 'insert') {
                insertOps.push(script[i]);
            }
            i++;
        }

        if (deleteOps.length > 0 && insertOps.length > 0) {
            // Pairing logic: pair positional/similarity matches
            const pairCount = Math.min(deleteOps.length, insertOps.length);

            // Pair up to pairCount
            for (let j = 0; j < pairCount; j++) {
                const oldIdx = deleteOps[j].oldIdx;
                const newIdx = insertOps[j].newIdx;
                const oldLine = oldLines[oldIdx];
                const newLine = newLines[newIdx];

                modified.push(newIdx);

                const ranges = getWordDiffRanges(oldLine, newLine);
                for (const r of ranges) {
                    wordRanges.push({ line: newIdx, start: r.start, end: r.end });
                }

                lineDetails.set(newIdx, {
                    type: 'modified',
                    oldText: oldLine,
                    newText: newLine
                });
            }

            // Remaining insertions beyond pairCount are pure additions (no word boxes)
            for (let j = pairCount; j < insertOps.length; j++) {
                const newIdx = insertOps[j].newIdx;
                added.push(newIdx);
                lineDetails.set(newIdx, {
                    type: 'added',
                    newText: newLines[newIdx]
                });
            }

            // Remaining deletions beyond pairCount
            for (let j = pairCount; j < deleteOps.length; j++) {
                const targetLine = script[i] ? script[i].newIdx : (newLines.length > 0 ? newLines.length - 1 : 0);
                deleted.push(targetLine);
                lineDetails.set(targetLine, {
                    type: 'deleted',
                    oldText: oldLines[deleteOps[j].oldIdx]
                });
            }
        } else if (insertOps.length > 0) {
            // Pure insertions - whole line green wash, no word boxes
            for (const ins of insertOps) {
                added.push(ins.newIdx);
                lineDetails.set(ins.newIdx, {
                    type: 'added',
                    newText: newLines[ins.newIdx]
                });
            }
        } else if (deleteOps.length > 0) {
            // Pure deletions
            const targetLine = script[i] ? script[i].newIdx : (newLines.length > 0 ? newLines.length - 1 : 0);
            deleted.push(targetLine);
            lineDetails.set(targetLine, {
                type: 'deleted',
                oldBlock: deleteOps.map(op => oldLines[op.oldIdx])
            });
        }
    }

    return {
        added,
        modified,
        deleted,
        wordRanges,
        lineDetails,
        stats: {
            addedCount: added.length,
            modifiedCount: modified.length,
            deletedCount: script.filter(s => s.type === 'delete').length
        }
    };
}

module.exports = { computeLineDiff, getWordDiffRanges };
