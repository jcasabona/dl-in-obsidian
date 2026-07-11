import { Plugin } from "obsidian";
import {
	Decoration,
	DecorationSet,
	EditorView,
	ViewPlugin,
	ViewUpdate,
} from "@codemirror/view";
import { Range } from "@codemirror/state";

/** Matches a definition line, e.g. ": A fruit that grows on trees." */
const DEFINITION_MARKER = /^:\s+/;

type Role = "term" | "def" | "continuation" | "none";

/**
 * Classify each line of a single block (a run of non-blank lines).
 *
 *   - `def`          — starts with ": " and opens a new definition.
 *   - `term`         — a plain line that heads the block, or is directly
 *                      followed by a definition.
 *   - `continuation` — a plain line that lazily continues the previous
 *                      definition onto another line.
 *
 * A block is only a definition list if it opens with a term and contains at
 * least one definition; otherwise every line is `none` and left untouched.
 */
function classifyBlock(lines: string[]): { roles: Role[]; valid: boolean } {
	const roles: Role[] = new Array(lines.length).fill("none");
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

/* ------------------------------------------------------------------ *
 * Reading view: rewrite qualifying <p> blocks into real <dl> markup.
 * ------------------------------------------------------------------ */

function processReadingView(element: HTMLElement) {
	element.querySelectorAll("p").forEach((p) => {
		// Obsidian renders soft line breaks inside a paragraph either as a <br>
		// or as a bare newline in the HTML, depending on the "Strict line breaks"
		// setting — split on both so reading view works in either mode.
		const fragments = p.innerHTML
			.split(/<br\s*\/?>|\r?\n/i)
			.map((line) => line.trim())
			.filter((line) => line.length > 0);

		if (fragments.length < 2) return;

		const { roles, valid } = classifyBlock(fragments);
		if (!valid) return;

		const dl = document.createElement("dl");
		let lastDd: HTMLElement | null = null;

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

/* ------------------------------------------------------------------ *
 * Live Preview: decorate lines via CodeMirror so definition lists are
 * styled while remaining fully editable.
 * ------------------------------------------------------------------ */

const termLine = Decoration.line({ class: "dl-line dl-term" });
const defLine = Decoration.line({ class: "dl-line dl-def" });
const continuationLine = Decoration.line({ class: "dl-line dl-cont" });
const hiddenMarker = Decoration.replace({});

function buildDecorations(view: EditorView): DecorationSet {
	const ranges: Range<Decoration>[] = [];
	const doc = view.state.doc;
	const cursor = view.state.selection.main;

	let lineNo = 1;
	while (lineNo <= doc.lines) {
		// Skip blank separators.
		if (doc.line(lineNo).text.trim().length === 0) {
			lineNo++;
			continue;
		}

		// Gather the current block of consecutive non-blank lines.
		const blockStart = lineNo;
		const texts: string[] = [];
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

				// Hide the ": " marker unless the cursor is on this line, so
				// the source stays revealed and editable where you're working.
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

	return Decoration.set(ranges, true);
}

const livePreviewExtension = ViewPlugin.fromClass(
	class {
		decorations: DecorationSet;

		constructor(view: EditorView) {
			this.decorations = buildDecorations(view);
		}

		update(update: ViewUpdate) {
			if (update.docChanged || update.viewportChanged || update.selectionSet) {
				this.decorations = buildDecorations(update.view);
			}
		}
	},
	{ decorations: (plugin) => plugin.decorations }
);

/* ------------------------------------------------------------------ */

export default class DefinitionListPlugin extends Plugin {
	async onload() {
		this.registerMarkdownPostProcessor((element) => processReadingView(element));
		this.registerEditorExtension(livePreviewExtension);
	}
}
