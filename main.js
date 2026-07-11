"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const obsidian = require("obsidian");
const view_1 = require("@codemirror/view");

/** Matches a definition line, e.g. ": A fruit that grows on trees." */
const DEFINITION_MARKER = /^:\s+/;

/**
 * Classify each line of a single block (a run of non-blank lines).
 * Returns roles ("term" | "def" | "continuation" | "none") and whether the
 * block qualifies as a definition list (opens with a term, has >=1 definition).
 */
function classifyBlock(lines) {
	const roles = new Array(lines.length).fill("none");
	let hasDefinition = false;

	for (let i = 0; i < lines.length; i++) {
		if (DEFINITION_MARKER.test(lines[i].trim())) {
			roles[i] = "def";
			hasDefinition = true;
		} else {
			const nextIsDef =
				i + 1 < lines.length && DEFINITION_MARKER.test(lines[i + 1].trim());
			roles[i] = i === 0 || nextIsDef ? "term" : "continuation";
		}
	}

	const valid = hasDefinition && roles[0] === "term";
	return valid ? { roles, valid } : { roles: roles.map(() => "none"), valid: false };
}

/* Reading view: rewrite qualifying <p> blocks into real <dl> markup. */
function processReadingView(element) {
	element.querySelectorAll("p").forEach((p) => {
		const fragments = p.innerHTML
			.split(/<br\s*\/?>|\r?\n/i)
			.map((line) => line.trim())
			.filter((line) => line.length > 0);

		if (fragments.length < 2) return;

		const { roles, valid } = classifyBlock(fragments);
		if (!valid) return;

		const dl = document.createElement("dl");
		let lastDd = null;

		for (let i = 0; i < fragments.length; i++) {
			const frag = fragments[i];
			if (roles[i] === "def") {
				const dd = document.createElement("dd");
				dd.innerHTML = frag.replace(DEFINITION_MARKER, "");
				dl.appendChild(dd);
				lastDd = dd;
			} else if (roles[i] === "continuation" && lastDd) {
				lastDd.innerHTML += " " + frag;
			} else {
				const dt = document.createElement("dt");
				dt.innerHTML = frag;
				dl.appendChild(dt);
				lastDd = null;
			}
		}

		p.replaceWith(dl);
	});
}

/* Live Preview: decorate lines via CodeMirror. */
const termLine = view_1.Decoration.line({ class: "dl-line dl-term" });
const defLine = view_1.Decoration.line({ class: "dl-line dl-def" });
const continuationLine = view_1.Decoration.line({ class: "dl-line dl-cont" });
const hiddenMarker = view_1.Decoration.replace({});

function buildDecorations(view) {
	const ranges = [];
	const doc = view.state.doc;
	const cursor = view.state.selection.main;

	let lineNo = 1;
	while (lineNo <= doc.lines) {
		if (doc.line(lineNo).text.trim().length === 0) {
			lineNo++;
			continue;
		}

		const blockStart = lineNo;
		const texts = [];
		while (lineNo <= doc.lines && doc.line(lineNo).text.trim().length > 0) {
			texts.push(doc.line(lineNo).text);
			lineNo++;
		}

		const { roles, valid } = classifyBlock(texts);
		if (!valid) continue;

		for (let i = 0; i < texts.length; i++) {
			const line = doc.line(blockStart + i);
			const role = roles[i];

			if (role === "term") {
				ranges.push(termLine.range(line.from));
			} else if (role === "continuation") {
				ranges.push(continuationLine.range(line.from));
			} else if (role === "def") {
				ranges.push(defLine.range(line.from));

				const cursorOnLine = cursor.from <= line.to && cursor.to >= line.from;
				if (!cursorOnLine) {
					const match = line.text.match(DEFINITION_MARKER);
					if (match) {
						ranges.push(hiddenMarker.range(line.from, line.from + match[0].length));
					}
				}
			}
		}
	}

	return view_1.Decoration.set(ranges, true);
}

const livePreviewExtension = view_1.ViewPlugin.fromClass(
	class {
		constructor(view) {
			this.decorations = buildDecorations(view);
		}

		update(update) {
			if (update.docChanged || update.viewportChanged || update.selectionSet) {
				this.decorations = buildDecorations(update.view);
			}
		}
	},
	{ decorations: (plugin) => plugin.decorations }
);

class DefinitionListPlugin extends obsidian.Plugin {
	async onload() {
		this.registerMarkdownPostProcessor((element) => processReadingView(element));
		this.registerEditorExtension(livePreviewExtension);
	}
}

exports.default = DefinitionListPlugin;
module.exports = DefinitionListPlugin;
module.exports.default = DefinitionListPlugin;
