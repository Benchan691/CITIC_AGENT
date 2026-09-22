window.__ModuleLoader__.load({
	id: "dsh-soc-agent-email-draft",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region \0rolldown/runtime.js
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __copyProps = (to, from, except, desc) => {
			if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
				key = keys[i];
				if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
			return to;
		};
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
			value: mod,
			enumerable: true
		}) : target, mod));
		//#endregion
		let react = require("react");
		react = __toESM(react, 1);
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region \0dsh-css:/Users/chankokpan/Documents/CITIC_AGENT/packages/soc-agent-email-draft/src/client/EmailDraftToolview.module.css.mjs
		const css = ".a5LXvW_card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-surface-l1,transparent);border-radius:10px;margin:6px 0;overflow:hidden}.a5LXvW_header{background:var(--dsw-alias-surface-l2,transparent);justify-content:space-between;align-items:center;gap:12px;padding:10px 12px;display:flex}.a5LXvW_title{font-weight:600}.a5LXvW_account{color:var(--dsw-alias-text-l2);font-size:12px}.a5LXvW_content{gap:9px;padding:12px;display:grid}.a5LXvW_field{gap:4px;display:grid}.a5LXvW_label{color:var(--dsw-alias-text-l2);font-size:12px;font-weight:600}.a5LXvW_input,.a5LXvW_textarea{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-surface-l0,transparent);width:100%;color:inherit;font:inherit;border-radius:6px;padding:8px 9px}.a5LXvW_textarea{resize:vertical;min-height:180px;line-height:1.45}.a5LXvW_bodyEditor{gap:4px;min-width:0;display:grid}.a5LXvW_editorHeader{justify-content:space-between;align-items:center;gap:12px;min-width:0;display:flex}.a5LXvW_viewTabs{flex-shrink:0;align-items:center;gap:2px;display:flex}.a5LXvW_viewTab{color:var(--dsw-alias-text-l2);cursor:pointer;font:inherit;white-space:nowrap;background:0 0;border:0;border-radius:6px;padding:6px 10px;line-height:1.2}.a5LXvW_viewTab:hover,.a5LXvW_viewTab[data-active=true]{color:inherit}.a5LXvW_viewTab[data-active=true]{background:var(--dsw-alias-surface-l2,#e5e7eb);font-weight:600}.a5LXvW_viewTab:focus-visible{outline:2px solid var(--dsw-alias-primary,currentColor);outline-offset:1px}.a5LXvW_bodyPanel{min-width:0;min-height:240px}.a5LXvW_bodyPanel[hidden]{display:none}.a5LXvW_bodySource{height:240px;min-height:240px}.a5LXvW_preview{border:1px solid var(--dsw-alias-border-l2);background:#fff;border-radius:6px;width:100%;height:240px;min-height:240px;display:block}.a5LXvW_preview:focus-visible,.a5LXvW_bodySource:focus-visible{outline:2px solid var(--dsw-alias-primary,currentColor);outline-offset:1px}.a5LXvW_attachmentPanel{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-surface-l2,transparent);border-radius:8px;gap:7px;padding:10px;display:grid}.a5LXvW_hiddenInput{clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;width:1px;height:1px;position:absolute;overflow:hidden}.a5LXvW_attachmentList{gap:5px;display:grid}.a5LXvW_attachmentItem{background:var(--dsw-alias-surface-l0,transparent);overflow-wrap:anywhere;border-radius:5px;justify-content:space-between;align-items:center;gap:8px;padding:6px 8px;display:flex}.a5LXvW_removeButton{color:var(--dsw-alias-danger,#b42318);cursor:pointer;font:inherit;white-space:nowrap;background:0 0;border:0;padding:2px 4px}.a5LXvW_removeButton:disabled{cursor:wait;opacity:.6}.a5LXvW_help{color:var(--dsw-alias-text-l2);font-size:12px}.a5LXvW_input:focus,.a5LXvW_textarea:focus{outline:2px solid var(--dsw-alias-primary,currentColor);outline-offset:1px}.a5LXvW_actions{justify-content:flex-end;gap:8px;padding-top:3px;display:flex}.a5LXvW_signaturePanel{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-surface-l2,transparent);border-radius:8px;gap:9px;padding:10px;display:grid}.a5LXvW_button{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-surface-l2,transparent);color:inherit;cursor:pointer;font:inherit;border-radius:6px;padding:7px 12px}.a5LXvW_primary{color:var(--dsw-alias-on-primary,#fff);background:#2563eb;border-color:#2563eb}.a5LXvW_primary:hover{background:#1d4ed8;border-color:#1d4ed8}.a5LXvW_danger{color:#fff;background:#dc2626;border-color:#dc2626}.a5LXvW_danger:hover{background:#b91c1c;border-color:#b91c1c}.a5LXvW_signatureButton{color:#fff;background:#7c3aed;border-color:#7c3aed}.a5LXvW_signatureButton:hover{background:#6d28d9;border-color:#6d28d9}.a5LXvW_button:disabled{cursor:wait;opacity:.6}.a5LXvW_message{color:var(--dsw-alias-text-l2);padding:10px 12px;font-size:13px}.a5LXvW_error{color:var(--dsw-alias-danger,#b42318)}@media (width<=700px){.a5LXvW_editorHeader{flex-wrap:wrap;align-items:flex-start}.a5LXvW_viewTabs{margin-left:auto}}";
		const tagId = "dsh-soc-agent-email-draft/EmailDraftToolview.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-soc-agent-email-draft";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var EmailDraftToolview_module_css_default = {
			"account": "a5LXvW_account",
			"actions": "a5LXvW_actions",
			"attachmentItem": "a5LXvW_attachmentItem",
			"attachmentList": "a5LXvW_attachmentList",
			"attachmentPanel": "a5LXvW_attachmentPanel",
			"bodyEditor": "a5LXvW_bodyEditor",
			"bodyPanel": "a5LXvW_bodyPanel",
			"bodySource": "a5LXvW_bodySource",
			"button": "a5LXvW_button",
			"card": "a5LXvW_card",
			"content": "a5LXvW_content",
			"danger": "a5LXvW_danger",
			"editorHeader": "a5LXvW_editorHeader",
			"error": "a5LXvW_error",
			"field": "a5LXvW_field",
			"header": "a5LXvW_header",
			"help": "a5LXvW_help",
			"hiddenInput": "a5LXvW_hiddenInput",
			"input": "a5LXvW_input",
			"label": "a5LXvW_label",
			"message": "a5LXvW_message",
			"preview": "a5LXvW_preview",
			"primary": "a5LXvW_primary",
			"removeButton": "a5LXvW_removeButton",
			"signatureButton": "a5LXvW_signatureButton",
			"signaturePanel": "a5LXvW_signaturePanel",
			"textarea": "a5LXvW_textarea",
			"title": "a5LXvW_title",
			"viewTab": "a5LXvW_viewTab",
			"viewTabs": "a5LXvW_viewTabs"
		};
		//#endregion
		//#region src/client/emailDraft.ts
		const ZIMBRA_DRAFT_TOOL_NAME = "mcp__soc_agent__zimbra_send_email";
		const ZIMBRA_SIGNATURE_DRAFT_TOOL_NAME = "mcp__soc_agent__zimbra_use_signature_on_email";
		const EMAIL_ATTACHMENT_LIMITS = {
			maxFiles: 5,
			maxBytesPerFile: 1e7,
			maxTotalBytes: 5e7
		};
		function invalidFilename(filename) {
			return !filename || filename.length > 255 || /[\u0000\r\n\\/]/u.test(filename);
		}
		function validateEmailAttachmentSelection(files, existing = []) {
			if (existing.length + files.length > EMAIL_ATTACHMENT_LIMITS.maxFiles) return `Select no more than ${EMAIL_ATTACHMENT_LIMITS.maxFiles} files.`;
			let totalBytes = existing.reduce((sum, file) => sum + file.size, 0);
			for (const file of files) {
				if (invalidFilename(file.name)) return `The filename "${file.name}" is not allowed.`;
				if (file.size > EMAIL_ATTACHMENT_LIMITS.maxBytesPerFile) return `${file.name} exceeds the 10 MB per-file limit.`;
				totalBytes += file.size;
			}
			if (totalBytes > EMAIL_ATTACHMENT_LIMITS.maxTotalBytes) return "The selected files exceed the 50 MB total limit.";
			return null;
		}
		function bytesToBase64(bytes) {
			if (typeof globalThis.btoa !== "function") throw new Error("Base64 encoding is unavailable in this browser.");
			let binary = "";
			const chunkSize = 32768;
			for (let offset = 0; offset < bytes.length; offset += chunkSize) binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)));
			return globalThis.btoa(binary);
		}
		async function fileToEmailAttachment(file) {
			const bytes = new Uint8Array(await file.arrayBuffer());
			return {
				filename: file.name,
				content_type: file.type || "application/octet-stream",
				data: bytesToBase64(bytes)
			};
		}
		function parseRecipientText(value) {
			return [...new Set(value.split(/[\n,;]/).map((item) => item.trim()).filter(Boolean))];
		}
		function draftFromForm(fields, metadata = {}) {
			return {
				to: parseRecipientText(fields.to),
				cc: parseRecipientText(fields.cc),
				bcc: parseRecipientText(fields.bcc),
				subject: fields.subject.trim(),
				body: fields.body,
				...metadata
			};
		}
		//#endregion
		//#region src/client/htmlEmail.ts
		const SAFE_ELEMENTS = new Set([
			"a",
			"article",
			"aside",
			"blockquote",
			"br",
			"caption",
			"code",
			"col",
			"colgroup",
			"div",
			"em",
			"figcaption",
			"figure",
			"footer",
			"h1",
			"h2",
			"h3",
			"h4",
			"h5",
			"h6",
			"body",
			"head",
			"header",
			"hr",
			"html",
			"i",
			"li",
			"main",
			"ol",
			"p",
			"pre",
			"section",
			"small",
			"span",
			"strong",
			"style",
			"table",
			"tbody",
			"td",
			"tfoot",
			"th",
			"thead",
			"title",
			"tr",
			"u",
			"ul"
		]);
		const REMOVE_ELEMENTS = new Set([
			"applet",
			"base",
			"embed",
			"form",
			"iframe",
			"img",
			"input",
			"link",
			"meta",
			"object",
			"script",
			"select",
			"textarea",
			"video",
			"audio",
			"source",
			"track",
			"svg",
			"math"
		]);
		const SAFE_ATTRIBUTES = new Set([
			"align",
			"aria-label",
			"aria-hidden",
			"class",
			"colspan",
			"id",
			"lang",
			"name",
			"role",
			"rowspan",
			"style",
			"title",
			"valign",
			"width"
		]);
		const SAFE_CSS_PROPERTIES = new Set([
			"background",
			"background-color",
			"border",
			"border-collapse",
			"border-radius",
			"border-spacing",
			"color",
			"display",
			"font-family",
			"font-size",
			"font-style",
			"font-weight",
			"height",
			"line-height",
			"margin",
			"margin-bottom",
			"margin-left",
			"margin-right",
			"margin-top",
			"max-width",
			"min-width",
			"padding",
			"padding-bottom",
			"padding-left",
			"padding-right",
			"padding-top",
			"text-align",
			"text-decoration",
			"vertical-align",
			"white-space",
			"width"
		]);
		function safeUrl(value) {
			const candidate = value.trim().toLowerCase();
			if (!candidate || candidate.startsWith("#") || candidate.startsWith("/") || candidate.startsWith("./") || candidate.startsWith("../")) return true;
			return candidate.startsWith("https:") || candidate.startsWith("mailto:");
		}
		function escapeHtml(value) {
			return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;").replaceAll("'", "&#39;");
		}
		function safeCssDeclarations(value) {
			return value.split(";").map((item) => item.trim()).filter(Boolean).map((item) => {
				const separator = item.indexOf(":");
				if (separator <= 0) return null;
				const property = item.slice(0, separator).trim().toLowerCase();
				const cssValue = item.slice(separator + 1).trim();
				if (!SAFE_CSS_PROPERTIES.has(property)) return null;
				if (/url\s*\(|expression\s*\(|(?:javascript|vbscript|data):|@import|-moz-binding|behavior\s*:/iu.test(cssValue)) return null;
				return `${property}: ${cssValue}`;
			}).filter((item) => Boolean(item)).join("; ");
		}
		function safeCssText(value) {
			return value.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/@(?:import|font-face|namespace|supports|keyframes)[\s\S]*?(?:;|\{[\s\S]*?\})/giu, "").replace(/([^{}]+)\{([^{}]*)\}/gu, (_match, selector, declarations) => {
				if (/[@{}]|url\s*\(|expression\s*\(|(?:javascript|vbscript|data):/iu.test(selector)) return "";
				const safeDeclarations = safeCssDeclarations(declarations);
				return safeDeclarations ? `${selector.trim()} { ${safeDeclarations}; }` : "";
			});
		}
		function unwrap(element) {
			const parent = element.parentNode;
			if (!parent) return;
			while (element.firstChild) parent.insertBefore(element.firstChild, element);
			parent.removeChild(element);
		}
		function sanitizeEmailHtml(value) {
			if (!value) return "";
			if (typeof DOMParser === "undefined") return escapeHtml(value);
			const document = new DOMParser().parseFromString(String(value), "text/html");
			for (const element of Array.from(document.querySelectorAll("*"))) {
				const tag = element.tagName.toLowerCase();
				if (REMOVE_ELEMENTS.has(tag)) {
					element.remove();
					continue;
				}
				if (!SAFE_ELEMENTS.has(tag)) {
					unwrap(element);
					continue;
				}
				if (tag === "style") element.textContent = safeCssText(element.textContent || "");
				for (const attribute of Array.from(element.attributes)) {
					const name = attribute.name.toLowerCase();
					const attributeValue = attribute.value;
					if (name.startsWith("on") || name === "srcdoc" || name === "srcset" || name === "formaction" || name === "action" || name === "target") element.removeAttribute(attribute.name);
					else if (name === "href") {
						if (!safeUrl(attributeValue)) element.removeAttribute(attribute.name);
					} else if (name === "style") {
						const safeStyle = safeCssDeclarations(attributeValue);
						if (safeStyle) element.setAttribute("style", safeStyle);
						else element.removeAttribute(attribute.name);
					} else if (!SAFE_ATTRIBUTES.has(name)) element.removeAttribute(attribute.name);
				}
			}
			return `${Array.from(document.head?.querySelectorAll("style") ?? []).map((element) => `<style>${safeCssText(element.textContent || "")}</style>`).join("")}${document.body?.innerHTML || ""}`;
		}
		const PREVIEW_CSS = `
  :root { color-scheme: light dark; }
  body { box-sizing: border-box; margin: 0; padding: 16px; font: 14px/1.45 system-ui, sans-serif; overflow-wrap: anywhere; }
  *, *::before, *::after { box-sizing: inherit; }
  table { max-width: 100%; border-collapse: collapse; }
  td, th { padding: 4px 6px; border: 1px solid #9ca3af; }
  a { color: #2563eb; }
`;
		function renderEmailPreviewDocument(value) {
			return `<!doctype html><html><head><meta charset="utf-8"><style>${PREVIEW_CSS}</style></head><body>${sanitizeEmailHtml(value)}</body></html>`;
		}
		//#endregion
		//#region src/client/EmailDraftToolview.tsx
		const BODY_VIEW_TABS = [{
			id: "preview",
			label: "Preview"
		}, {
			id: "source",
			label: "HTML source"
		}];
		let attachmentId = 0;
		function resultText(block) {
			if (!("kind" in block)) return "";
			return block.content.filter((item) => item.type === "text").map((item) => item.text).join("");
		}
		function parseEnvelope(block) {
			const text = resultText(block);
			if (!text) return null;
			try {
				const value = JSON.parse(text);
				if (typeof value !== "object" || value === null) return null;
				const record = value;
				const data = record.data;
				if (typeof data === "object" && data !== null && "draft" in data) return data;
				if ("draft" in record) return record;
				return {
					draft: {},
					error: record.error
				};
			} catch {
				return null;
			}
		}
		function listValue(value) {
			if (Array.isArray(value)) return value.filter((item) => typeof item === "string");
			if (typeof value === "string") return value.split(/[\n,;]/).map((item) => item.trim()).filter(Boolean);
			return [];
		}
		function formFromEnvelope(envelope) {
			const draft = envelope.draft || {};
			return {
				to: listValue(draft.to).join(", "),
				cc: listValue(draft.cc).join(", "),
				bcc: listValue(draft.bcc).join(", "),
				subject: typeof draft.subject === "string" ? draft.subject : "",
				body: typeof draft.body === "string" ? draft.body : ""
			};
		}
		function actionFromEnvelope(value) {
			return value === "reply" || value === "forward" ? value : "send";
		}
		function errorMessage(envelope) {
			const error = envelope?.error;
			if (typeof error === "object" && error !== null && "message" in error) {
				const message = error.message;
				if (typeof message === "string" && message) return message;
			}
			return typeof error === "string" && error ? error : null;
		}
		function formatBytes(bytes) {
			if (bytes < 1e3) return `${bytes} B`;
			if (bytes < 1e6) return `${(bytes / 1e3).toFixed(1)} KB`;
			return `${(bytes / 1e6).toFixed(1)} MB`;
		}
		function signatureAsHtml(signature) {
			return sanitizeEmailHtml(signature.html?.trim() ? signature.html : escapeHtml(signature.text || "").replace(/\r?\n/gu, "<br>"));
		}
		function EmailDraftToolview({ block, socClient }) {
			const envelope = (0, react.useMemo)(() => parseEnvelope(block), [block]);
			const sourceKey = (0, react.useMemo)(() => JSON.stringify(envelope?.draft ?? null), [envelope]);
			const action = actionFromEnvelope(envelope?.draft.action);
			const [fields, setFields] = (0, react.useState)(() => envelope ? formFromEnvelope(envelope) : {
				to: "",
				cc: "",
				bcc: "",
				subject: "",
				body: ""
			});
			const [status, setStatus] = (0, react.useState)("editing");
			const [sendError, setSendError] = (0, react.useState)(null);
			const [selectedAttachments, setSelectedAttachments] = (0, react.useState)([]);
			const [attachmentError, setAttachmentError] = (0, react.useState)(null);
			const [signaturePanel, setSignaturePanel] = (0, react.useState)(false);
			const [signatures, setSignatures] = (0, react.useState)([]);
			const [signatureId, setSignatureId] = (0, react.useState)("");
			const [signaturePlacement, setSignaturePlacement] = (0, react.useState)("below");
			const [signatureStatus, setSignatureStatus] = (0, react.useState)(null);
			const attachmentInput = (0, react.useRef)(null);
			const bodyViewId = (0, react.useId)();
			const bodyViewTabRefs = (0, react.useRef)([]);
			const [bodyView, setBodyView] = (0, react.useState)("preview");
			(0, react.useEffect)(() => {
				if (envelope?.draft) {
					setFields(formFromEnvelope(envelope));
					setStatus("editing");
					setSendError(null);
					setSelectedAttachments([]);
					setAttachmentError(null);
					setSignaturePanel(false);
					setSignatureStatus(null);
					setBodyView("preview");
				}
			}, [sourceKey]);
			if (!("kind" in block)) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: EmailDraftToolview_module_css_default.card,
				"data-dshcf-preserve": "true",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: EmailDraftToolview_module_css_default.message,
					children: "Preparing email draft…"
				})
			});
			const upstreamError = errorMessage(envelope);
			if (upstreamError || block.isError) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: EmailDraftToolview_module_css_default.card,
				"data-dshcf-preserve": "true",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: `${EmailDraftToolview_module_css_default.message} ${EmailDraftToolview_module_css_default.error}`,
					children: upstreamError || "Unable to create the email draft."
				})
			});
			const reopen = () => {
				setFields(envelope ? formFromEnvelope(envelope) : fields);
				setSelectedAttachments([]);
				setAttachmentError(null);
				setSendError(null);
				setBodyView("preview");
				setStatus("editing");
			};
			if (status === "discarded") return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: EmailDraftToolview_module_css_default.card,
				"data-dshcf-preserve": "true",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: EmailDraftToolview_module_css_default.header,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: EmailDraftToolview_module_css_default.title,
						children: "Email draft discarded"
					})
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: EmailDraftToolview_module_css_default.actions,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						className: EmailDraftToolview_module_css_default.button,
						type: "button",
						onClick: reopen,
						children: "Reopen"
					})
				})]
			});
			const update = (field) => (event) => {
				setFields((current) => ({
					...current,
					[field]: event.target.value
				}));
			};
			const moveBodyView = (event, index) => {
				let nextIndex;
				switch (event.key) {
					case "ArrowRight":
						nextIndex = (index + 1) % BODY_VIEW_TABS.length;
						break;
					case "ArrowLeft":
						nextIndex = (index - 1 + BODY_VIEW_TABS.length) % BODY_VIEW_TABS.length;
						break;
					case "Home":
						nextIndex = 0;
						break;
					case "End":
						nextIndex = BODY_VIEW_TABS.length - 1;
						break;
					default: return;
				}
				event.preventDefault();
				const nextTab = BODY_VIEW_TABS[nextIndex];
				setBodyView(nextTab.id);
				bodyViewTabRefs.current[nextIndex]?.focus();
			};
			const chooseAttachments = (event) => {
				const files = Array.from(event.currentTarget.files ?? []);
				const validation = validateEmailAttachmentSelection(files, selectedAttachments.map((item) => item.file));
				if (validation) setAttachmentError(validation);
				else {
					setSelectedAttachments((current) => [...current, ...files.map((file) => ({
						id: `${Date.now()}-${attachmentId++}`,
						file
					}))]);
					setAttachmentError(null);
				}
				event.currentTarget.value = "";
			};
			const removeAttachment = (id) => {
				setSelectedAttachments((current) => current.filter((item) => item.id !== id));
				setAttachmentError(null);
			};
			const sourceMessageId = envelope?.draft.source_message_id;
			const sourceMessage = envelope?.draft.source_message;
			const replyAll = envelope?.draft.reply_all === true;
			const submit = async () => {
				const safeBody = sanitizeEmailHtml(fields.body);
				const draft = draftFromForm({
					...fields,
					body: safeBody
				}, {
					action,
					body_format: "html",
					...sourceMessageId === void 0 ? {} : { source_message_id: sourceMessageId },
					...action === "reply" ? { reply_all: replyAll } : {}
				});
				if (action !== "reply" && draft.to.length === 0) {
					setSendError("Add at least one To recipient.");
					return;
				}
				if (action === "send" && !draft.subject) {
					setSendError("Subject cannot be empty.");
					return;
				}
				const confirmation = action === "reply" ? "Reply to this email now?" : action === "forward" ? "Forward this email with the original message and all its attachments plus selected attachments now?" : "Send this email now?";
				if (typeof window !== "undefined" && !window.confirm(confirmation)) return;
				setStatus("sending");
				setSendError(null);
				try {
					const attachments = await Promise.all(selectedAttachments.map((item) => fileToEmailAttachment(item.file)));
					if ((await socClient.rpc("send-email", {
						...draft,
						body_format: "html",
						attachments
					}))?.sent !== true) throw new Error("Zimbra did not confirm that the email was sent.");
					setStatus("sent");
				} catch (error) {
					setStatus("failed");
					setSendError(error instanceof Error ? error.message : String(error));
				}
			};
			const loadSignatures = async () => {
				setSignaturePanel(true);
				setSignatureStatus("Loading signatures…");
				try {
					const next = (await socClient.rpc("list-signatures")).signatures ?? [];
					setSignatures(next);
					setSignatureId((current) => current || next[0]?.id || "");
					setSignatureStatus(next.length ? null : "No signatures are configured for this account.");
				} catch (error) {
					setSignatureStatus(error instanceof Error ? error.message : String(error));
				}
			};
			const applySignature = () => {
				const signature = signatures.find((item) => item.id === signatureId);
				const value = signature ? signatureAsHtml(signature) : "";
				if (!value) {
					setSignatureStatus("The selected signature has no HTML content.");
					return;
				}
				setFields((current) => ({
					...current,
					body: signaturePlacement === "above" && current.body ? `${value}<br><br>${current.body}` : current.body ? `${current.body}<br><br>${value}` : value
				}));
				setSignaturePanel(false);
				setSignatureStatus(null);
			};
			if (status === "sent") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: EmailDraftToolview_module_css_default.card,
				"data-dshcf-preserve": "true",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: EmailDraftToolview_module_css_default.header,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: EmailDraftToolview_module_css_default.title,
						children: "Email sent successfully"
					})
				})
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: EmailDraftToolview_module_css_default.card,
				"data-dshcf-preserve": "true",
				"aria-label": "Editable Zimbra email draft",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: EmailDraftToolview_module_css_default.header,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: EmailDraftToolview_module_css_default.title,
						children: action === "reply" ? "Reply to email" : action === "forward" ? "Forward email" : "Email draft"
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: EmailDraftToolview_module_css_default.account,
						children: "HTML draft · Send remains pending until confirmation"
					})] })
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: EmailDraftToolview_module_css_default.content,
					children: [
						[
							"to",
							"cc",
							"bcc"
						].map((field) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: EmailDraftToolview_module_css_default.field,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: EmailDraftToolview_module_css_default.label,
								children: field === "to" ? "To" : field === "cc" ? "Cc" : "Bcc"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: EmailDraftToolview_module_css_default.input,
								"aria-label": field,
								value: fields[field],
								onChange: update(field),
								placeholder: "name@example.com"
							})]
						}, field)),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: EmailDraftToolview_module_css_default.field,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: EmailDraftToolview_module_css_default.label,
								children: "Subject"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: EmailDraftToolview_module_css_default.input,
								"aria-label": "Subject",
								value: fields.subject,
								onChange: update("subject"),
								maxLength: 998
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: EmailDraftToolview_module_css_default.bodyEditor,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: EmailDraftToolview_module_css_default.editorHeader,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: EmailDraftToolview_module_css_default.label,
										children: action === "send" ? "HTML body" : "Your HTML message (optional)"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: EmailDraftToolview_module_css_default.viewTabs,
										role: "tablist",
										"aria-label": "Email body view",
										children: BODY_VIEW_TABS.map((tab, index) => {
											const selected = bodyView === tab.id;
											const tabId = `${bodyViewId}-tab-${tab.id}`;
											const panelId = `${bodyViewId}-panel-${tab.id}`;
											return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												ref: (element) => {
													bodyViewTabRefs.current[index] = element;
												},
												id: tabId,
												className: EmailDraftToolview_module_css_default.viewTab,
												type: "button",
												role: "tab",
												"aria-selected": selected,
												"aria-controls": panelId,
												tabIndex: selected ? 0 : -1,
												"data-active": selected ? "true" : void 0,
												onClick: () => setBodyView(tab.id),
												onKeyDown: (event) => moveBodyView(event, index),
												children: tab.label
											}, tab.id);
										})
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									id: `${bodyViewId}-panel-preview`,
									className: EmailDraftToolview_module_css_default.bodyPanel,
									role: "tabpanel",
									"aria-labelledby": `${bodyViewId}-tab-preview`,
									hidden: bodyView !== "preview",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("iframe", {
										className: EmailDraftToolview_module_css_default.preview,
										title: "Rendered HTML preview",
										sandbox: "",
										srcDoc: renderEmailPreviewDocument(fields.body)
									})
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									id: `${bodyViewId}-panel-source`,
									className: EmailDraftToolview_module_css_default.bodyPanel,
									role: "tabpanel",
									"aria-labelledby": `${bodyViewId}-tab-source`,
									hidden: bodyView !== "source",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
										className: `${EmailDraftToolview_module_css_default.textarea} ${EmailDraftToolview_module_css_default.bodySource}`,
										"aria-label": "HTML body source",
										value: fields.body,
										onChange: update("body"),
										maxLength: 18e3
									})
								})
							]
						}),
						action !== "send" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: EmailDraftToolview_module_css_default.field,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: EmailDraftToolview_module_css_default.label,
									children: action === "forward" ? "The original message and all source attachments will be included; selected files will be added." : "The original message will be quoted in the reply; its source attachments will not be reattached."
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", { children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: sourceMessage?.subject || "Original message" }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
										sourceMessage?.from,
										" ",
										sourceMessage?.date
									] }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
										className: EmailDraftToolview_module_css_default.textarea,
										"aria-label": "Original message preview",
										value: sourceMessage?.body || "",
										readOnly: true
									}),
									sourceMessage?.body_truncated && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: "Preview shortened; the full original message will be included." })
								] }),
								sourceMessage?.attachments?.map((attachment) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: attachment.filename || "Unnamed attachment" }, attachment.part))
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: EmailDraftToolview_module_css_default.attachmentPanel,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: EmailDraftToolview_module_css_default.label,
									children: "Selected attachments"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									ref: attachmentInput,
									className: EmailDraftToolview_module_css_default.hiddenInput,
									"aria-label": "Attach files",
									type: "file",
									multiple: true,
									onChange: chooseAttachments
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: EmailDraftToolview_module_css_default.button,
									type: "button",
									disabled: status === "sending",
									onClick: () => attachmentInput.current?.click(),
									children: "Attach files"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: EmailDraftToolview_module_css_default.attachmentList,
									children: selectedAttachments.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: EmailDraftToolview_module_css_default.attachmentItem,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
											item.file.name,
											" · ",
											formatBytes(item.file.size)
										] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											className: EmailDraftToolview_module_css_default.removeButton,
											type: "button",
											"aria-label": `Remove ${item.file.name}`,
											disabled: status === "sending",
											onClick: () => removeAttachment(item.id),
											children: "Remove"
										})]
									}, item.id))
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: EmailDraftToolview_module_css_default.help,
									children: "Up to 5 files, 10 MB per file, 50 MB total. Files are attached only after Send confirmation."
								}),
								attachmentError && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: `${EmailDraftToolview_module_css_default.message} ${EmailDraftToolview_module_css_default.error}`,
									role: "alert",
									children: attachmentError
								})
							]
						}),
						sendError && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: `${EmailDraftToolview_module_css_default.message} ${EmailDraftToolview_module_css_default.error}`,
							role: "alert",
							children: sendError
						}),
						signaturePanel && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: EmailDraftToolview_module_css_default.signaturePanel,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: EmailDraftToolview_module_css_default.field,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: EmailDraftToolview_module_css_default.label,
										children: "Signature"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
										className: EmailDraftToolview_module_css_default.input,
										"aria-label": "Signature",
										value: signatureId,
										onChange: (event) => setSignatureId(event.target.value),
										children: signatures.map((signature) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: signature.id,
											children: signature.name
										}, signature.id))
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: EmailDraftToolview_module_css_default.field,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: EmailDraftToolview_module_css_default.label,
										children: "Placement"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
										className: EmailDraftToolview_module_css_default.input,
										"aria-label": "Signature placement",
										value: signaturePlacement,
										onChange: (event) => setSignaturePlacement(event.target.value),
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: "below",
											children: "Below body"
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: "above",
											children: "Above body"
										})]
									})]
								}),
								signatureStatus && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: EmailDraftToolview_module_css_default.message,
									role: "status",
									children: signatureStatus
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: EmailDraftToolview_module_css_default.actions,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: EmailDraftToolview_module_css_default.button,
										type: "button",
										onClick: () => setSignaturePanel(false),
										children: "Cancel"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: `${EmailDraftToolview_module_css_default.button} ${EmailDraftToolview_module_css_default.primary}`,
										type: "button",
										disabled: !signatureId || Boolean(signatureStatus),
										onClick: applySignature,
										children: "Apply signature"
									})]
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: EmailDraftToolview_module_css_default.actions,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: `${EmailDraftToolview_module_css_default.button} ${EmailDraftToolview_module_css_default.danger}`,
									type: "button",
									disabled: status === "sending",
									onClick: () => setStatus("discarded"),
									children: "Discard"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: `${EmailDraftToolview_module_css_default.button} ${EmailDraftToolview_module_css_default.signatureButton}`,
									type: "button",
									disabled: status === "sending",
									onClick: () => {
										loadSignatures();
									},
									children: "Add signature"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: `${EmailDraftToolview_module_css_default.button} ${EmailDraftToolview_module_css_default.primary}`,
									type: "button",
									disabled: status === "sending",
									onClick: submit,
									children: status === "sending" ? "Sending…" : status === "failed" ? "Retry" : "Send"
								})
							]
						})
					]
				})]
			});
		}
		const emailDraftToolview = {
			name: "zimbra-email-draft-toolview",
			inject: ["slots", "socClient"],
			apply(ctx) {
				const socClient = ctx.get("socClient");
				for (const key of [ZIMBRA_DRAFT_TOOL_NAME, ZIMBRA_SIGNATURE_DRAFT_TOOL_NAME]) ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({
					name: "tool.call.toolview",
					key,
					inject: () => ({ socClient })
				}, EmailDraftToolview));
			}
		};
		function installEmailDraftToolview(ctx) {
			ctx.plugin(emailDraftToolview);
		}
		//#endregion
		//#region src/client/index.ts
		/** Optional editable email draft tool views. */
		const inject = ["slots", "socClient"];
		function apply(ctx) {
			if (ctx.get("socClient").surface !== "workspace") return;
			installEmailDraftToolview(ctx);
		}
		//#endregion
		exports.EMAIL_ATTACHMENT_LIMITS = EMAIL_ATTACHMENT_LIMITS;
		exports.EmailDraftToolview = EmailDraftToolview;
		exports.ZIMBRA_DRAFT_TOOL_NAME = ZIMBRA_DRAFT_TOOL_NAME;
		exports.ZIMBRA_SIGNATURE_DRAFT_TOOL_NAME = ZIMBRA_SIGNATURE_DRAFT_TOOL_NAME;
		exports.apply = apply;
		exports.draftFromForm = draftFromForm;
		exports.emailDraftToolview = emailDraftToolview;
		exports.fileToEmailAttachment = fileToEmailAttachment;
		exports.inject = inject;
		exports.parseRecipientText = parseRecipientText;
		exports.validateEmailAttachmentSelection = validateEmailAttachmentSelection;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map