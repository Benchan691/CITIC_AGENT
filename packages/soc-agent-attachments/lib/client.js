window.__ModuleLoader__.load({
	id: "dsh-soc-agent-attachments",
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
		let _deepseek_ai_dsh_client_store = require("@deepseek-ai/dsh-client-store");
		let react_jsx_runtime = require("react/jsx-runtime");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_dom = require("react-dom");
		//#region src/attachment-constants.ts
		const MARKITDOWN_ATTACHMENTS_NAMESPACE = "soc-agent-markitdown-attachments";
		const DEFAULT_MARKITDOWN_ATTACHMENT_SETTINGS = {
			maxFiles: 5,
			maxBytesPerFile: 1e7,
			maxTotalBytes: 5e7,
			maxCharsPerFile: 2e5,
			maxTotalChars: 5e5
		};
		//#endregion
		//#region \0dsh-css:/Users/chankokpan/Documents/CITIC_AGENT/packages/soc-agent-attachments/src/client/MarkItDownAttachmentSettings.module.css.mjs
		const css$7 = ".Y3zsUW_card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;list-style:none;transition:border-color .16s,background .16s}.Y3zsUW_card:hover,.Y3zsUW_cardOpen{border-color:var(--dsw-alias-label-dimmed)}.Y3zsUW_cardOpen{background:var(--dsw-alias-bg-layer-2)}.Y3zsUW_header{width:100%;color:inherit;font:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-radius:12px;align-items:center;gap:12px;padding:14px 16px;display:flex}.Y3zsUW_header:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}.Y3zsUW_headText{flex-direction:column;flex:1;gap:4px;min-width:0;display:flex}.Y3zsUW_name{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:1.4}.Y3zsUW_description,.Y3zsUW_hint,.Y3zsUW_invalid{font-size:12px;line-height:1.5}.Y3zsUW_description,.Y3zsUW_hint{color:var(--dsw-alias-label-tertiary)}.Y3zsUW_chevron{color:var(--dsw-alias-label-tertiary);flex:none;transition:transform .16s}.Y3zsUW_chevronOpen{transform:rotate(180deg)}.Y3zsUW_body{border-top:1px solid var(--dsw-alias-border-l2);margin:0 16px;padding-bottom:8px}.Y3zsUW_field{flex-direction:column;gap:6px;padding:12px 0;display:flex}.Y3zsUW_field+.Y3zsUW_field{border-top:1px solid var(--dsw-alias-border-l2)}.Y3zsUW_fieldHead{align-items:center;gap:8px;display:flex}.Y3zsUW_fieldLabel{min-width:0;color:var(--dsw-alias-label-primary);flex:1;font-size:13px;font-weight:500;line-height:1.5}.Y3zsUW_badges{align-items:center;gap:8px;display:inline-flex}.Y3zsUW_badge{background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);white-space:nowrap;border-radius:999px;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}.Y3zsUW_reset{color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;background:0 0;border:0;padding:0;font-size:12px;line-height:1.5}.Y3zsUW_reset:hover:not(:disabled){color:var(--dsw-alias-label-primary)}.Y3zsUW_input{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);width:100%;height:34px;color:var(--dsw-alias-label-primary);font:inherit;border-radius:8px;padding:0 12px;font-size:13px;line-height:1.5}.Y3zsUW_input:focus-visible{border-color:var(--dsw-alias-brand-primary);outline:none}.Y3zsUW_input:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}.Y3zsUW_inputInvalid{border-color:var(--dsw-alias-label-error)}.Y3zsUW_hint,.Y3zsUW_invalid,.Y3zsUW_failed{margin:0}.Y3zsUW_invalid,.Y3zsUW_failed{color:var(--dsw-alias-label-error)}.Y3zsUW_footer{border-top:1px solid var(--dsw-alias-border-l2);justify-content:flex-end;align-items:center;gap:8px;padding:12px 0 4px;display:flex}.Y3zsUW_failed{flex:1;min-width:0;font-size:12px;line-height:1.5}.Y3zsUW_discard,.Y3zsUW_save{font:inherit;cursor:pointer;border:1px solid #0000;border-radius:8px;padding:5px 14px;font-size:13px;line-height:1.5}.Y3zsUW_discard{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);background:0 0}.Y3zsUW_save{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}.Y3zsUW_discard:disabled,.Y3zsUW_save:disabled{opacity:.4;cursor:default}.Y3zsUW_discard:focus-visible,.Y3zsUW_save:focus-visible,.Y3zsUW_reset:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}";
		const tagId$7 = "dsh-soc-agent-attachments/MarkItDownAttachmentSettings.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$7) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-soc-agent-attachments";
			tag.dataset.pluginCss = tagId$7;
			tag.textContent = css$7;
			document.head.appendChild(tag);
		}
		var MarkItDownAttachmentSettings_module_css_default = {
			"badge": "Y3zsUW_badge",
			"badges": "Y3zsUW_badges",
			"body": "Y3zsUW_body",
			"card": "Y3zsUW_card",
			"cardOpen": "Y3zsUW_cardOpen",
			"chevron": "Y3zsUW_chevron",
			"chevronOpen": "Y3zsUW_chevronOpen",
			"description": "Y3zsUW_description",
			"discard": "Y3zsUW_discard",
			"failed": "Y3zsUW_failed",
			"field": "Y3zsUW_field",
			"fieldHead": "Y3zsUW_fieldHead",
			"fieldLabel": "Y3zsUW_fieldLabel",
			"footer": "Y3zsUW_footer",
			"headText": "Y3zsUW_headText",
			"header": "Y3zsUW_header",
			"hint": "Y3zsUW_hint",
			"input": "Y3zsUW_input",
			"inputInvalid": "Y3zsUW_inputInvalid",
			"invalid": "Y3zsUW_invalid",
			"name": "Y3zsUW_name",
			"reset": "Y3zsUW_reset",
			"save": "Y3zsUW_save"
		};
		//#endregion
		//#region src/client/MarkItDownAttachmentSettings.tsx
		const FIELDS = [
			"maxFiles",
			"maxBytesPerFile",
			"maxTotalBytes",
			"maxCharsPerFile",
			"maxTotalChars"
		];
		var AttachmentSettingsController = class {
			scope;
			drafts = /* @__PURE__ */ new Map();
			cleared = /* @__PURE__ */ new Set();
			store;
			saving = false;
			failed = false;
			unsubscribe;
			constructor(scope) {
				this.scope = scope;
				this.store = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(this.state());
				this.unsubscribe = scope.subscribe(() => this.publish());
			}
			dispose() {
				this.unsubscribe();
				this.drafts.clear();
				this.cleared.clear();
			}
			inject() {
				return {
					hooks: { attachmentSettings: this.store },
					edit: (field, text) => {
						if (FIELDS.includes(field)) {
							this.drafts.set(field, text);
							this.cleared.delete(field);
							this.failed = false;
							this.publish();
						}
					},
					resetField: (field) => {
						this.drafts.delete(field);
						this.cleared.add(field);
						this.failed = false;
						this.publish();
					},
					save: () => {
						this.save();
					},
					discard: () => {
						this.drafts.clear();
						this.cleared.clear();
						this.failed = false;
						this.publish();
					}
				};
			}
			async save() {
				if (this.saving || !this.state().writable || this.state().invalid) return;
				this.saving = true;
				this.publish();
				try {
					for (const field of FIELDS) if (this.cleared.has(field)) await this.scope.unset(field);
					else if (this.drafts.has(field)) {
						const value = Number(this.drafts.get(field));
						if (!Number.isSafeInteger(value) || value < 1) throw new Error("invalid");
						await this.scope.set(field, value);
					}
					this.drafts.clear();
					this.cleared.clear();
					this.failed = false;
				} catch {
					this.failed = true;
				} finally {
					this.saving = false;
					this.publish();
				}
			}
			state() {
				const snapshot = this.scope.getSnapshot();
				const value = snapshot.value ?? {};
				const user = snapshot.user && typeof snapshot.user === "object" ? snapshot.user : {};
				const field = (name) => {
					const raw = value[name];
					const text = this.drafts.get(name) ?? (this.cleared.has(name) ? "" : typeof raw === "number" ? String(raw) : "");
					return {
						text,
						overridden: this.drafts.has(name) || this.cleared.has(name) || Object.prototype.hasOwnProperty.call(user, name),
						invalid: text !== "" && (!Number.isSafeInteger(Number(text)) || Number(text) < 1)
					};
				};
				const fields = Object.fromEntries(FIELDS.map((name) => [name, field(name)]));
				return {
					available: snapshot.status !== "unavailable",
					writable: snapshot.writable,
					dirty: this.drafts.size > 0 || this.cleared.size > 0,
					invalid: FIELDS.some((name) => fields[name].invalid),
					saving: this.saving,
					failed: this.failed,
					...fields
				};
			}
			publish() {
				this.store.set(this.state());
			}
		};
		function Field({ id, label, hint, state, disabled, edit, reset }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: MarkItDownAttachmentSettings_module_css_default.field,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: MarkItDownAttachmentSettings_module_css_default.fieldHead,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
							className: MarkItDownAttachmentSettings_module_css_default.fieldLabel,
							htmlFor: id,
							children: label
						}), state.overridden && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: MarkItDownAttachmentSettings_module_css_default.badges,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: MarkItDownAttachmentSettings_module_css_default.badge,
								children: "Overridden"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: MarkItDownAttachmentSettings_module_css_default.reset,
								type: "button",
								disabled,
								onClick: reset,
								children: "Reset"
							})]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						className: state.invalid ? `${MarkItDownAttachmentSettings_module_css_default.input} ${MarkItDownAttachmentSettings_module_css_default.inputInvalid}` : MarkItDownAttachmentSettings_module_css_default.input,
						id,
						inputMode: "numeric",
						value: state.text,
						disabled,
						"aria-invalid": state.invalid || void 0,
						onChange: (event) => edit(event.target.value)
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: state.invalid ? MarkItDownAttachmentSettings_module_css_default.invalid : MarkItDownAttachmentSettings_module_css_default.hint,
						children: state.invalid ? "Enter a positive whole number." : hint
					})
				]
			});
		}
		function Chevron({ open }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				className: open ? `${MarkItDownAttachmentSettings_module_css_default.chevron} ${MarkItDownAttachmentSettings_module_css_default.chevronOpen}` : MarkItDownAttachmentSettings_module_css_default.chevron,
				width: "14",
				height: "14",
				viewBox: "0 0 14 14",
				fill: "none",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z",
					fill: "currentColor"
				})
			});
		}
		function MarkItDownAttachmentSettingsCard(props) {
			const state = props.useAttachmentSettings((value) => value);
			const [open, setOpen] = (0, react.useState)(false);
			if (!state.available) return null;
			const disabled = !state.writable;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				className: `${MarkItDownAttachmentSettings_module_css_default.card}${open ? ` ${MarkItDownAttachmentSettings_module_css_default.cardOpen}` : ""}`,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					className: MarkItDownAttachmentSettings_module_css_default.header,
					type: "button",
					"aria-expanded": open,
					"aria-label": `${open ? "Collapse" : "Expand"} settings: MarkItDown attachments`,
					onClick: () => setOpen((value) => !value),
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: MarkItDownAttachmentSettings_module_css_default.headText,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: MarkItDownAttachmentSettings_module_css_default.name,
							children: "MarkItDown attachments"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: MarkItDownAttachmentSettings_module_css_default.description,
							children: "Upload files and send their readable text to the AI."
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Chevron, { open })]
				}), open && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: MarkItDownAttachmentSettings_module_css_default.body,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
							id: "markitdown-max-files",
							label: "Maximum files per message",
							hint: "Default: 5",
							state: state.maxFiles,
							disabled,
							edit: (value) => props.edit("maxFiles", value),
							reset: () => props.resetField("maxFiles")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
							id: "markitdown-max-file-bytes",
							label: "Maximum bytes per file",
							hint: "Default: 10 MB",
							state: state.maxBytesPerFile,
							disabled,
							edit: (value) => props.edit("maxBytesPerFile", value),
							reset: () => props.resetField("maxBytesPerFile")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
							id: "markitdown-max-total-bytes",
							label: "Maximum total upload bytes",
							hint: "Default: 50 MB",
							state: state.maxTotalBytes,
							disabled,
							edit: (value) => props.edit("maxTotalBytes", value),
							reset: () => props.resetField("maxTotalBytes")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
							id: "markitdown-max-file-chars",
							label: "Maximum Markdown characters per file",
							hint: "Default: 200,000",
							state: state.maxCharsPerFile,
							disabled,
							edit: (value) => props.edit("maxCharsPerFile", value),
							reset: () => props.resetField("maxCharsPerFile")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
							id: "markitdown-max-total-chars",
							label: "Maximum total Markdown characters",
							hint: "Default: 500,000",
							state: state.maxTotalChars,
							disabled,
							edit: (value) => props.edit("maxTotalChars", value),
							reset: () => props.resetField("maxTotalChars")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: MarkItDownAttachmentSettings_module_css_default.footer,
							children: [
								state.failed && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: MarkItDownAttachmentSettings_module_css_default.failed,
									role: "status",
									children: "Could not save these limits."
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: MarkItDownAttachmentSettings_module_css_default.discard,
									type: "button",
									disabled: !state.dirty || state.saving,
									onClick: props.discard,
									children: "Discard"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: MarkItDownAttachmentSettings_module_css_default.save,
									type: "button",
									disabled: !state.dirty || state.invalid || state.saving,
									onClick: props.save,
									children: state.saving ? "Saving…" : "Save"
								})
							]
						})
					]
				})]
			});
		}
		//#endregion
		//#region src/client/markitdownAttachments.ts
		const CHANNEL = "/soc-agent-config";
		function bytesToBase64(bytes) {
			let binary = "";
			const chunk = 32768;
			for (let offset = 0; offset < bytes.length; offset += chunk) binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
			return btoa(binary);
		}
		function settingsOf(scope) {
			return {
				...DEFAULT_MARKITDOWN_ATTACHMENT_SETTINGS,
				...scope.getSnapshot().value ?? {}
			};
		}
		var MarkItDownDocumentController = class {
			connection;
			settings;
			drafts = /* @__PURE__ */ new Map();
			aborts = /* @__PURE__ */ new Map();
			listeners = /* @__PURE__ */ new Set();
			version = 0;
			converted = /* @__PURE__ */ new Map();
			constructor(connection, settings) {
				this.connection = connection;
				this.settings = settings;
			}
			/** Abort pending conversions and release all browser-local draft state. */
			dispose() {
				for (const controller of this.aborts.values()) controller.abort();
				this.aborts.clear();
				this.drafts.clear();
				this.converted.clear();
				this.listeners.clear();
			}
			subscribe = (listener) => {
				this.listeners.add(listener);
				return () => {
					this.listeners.delete(listener);
				};
			};
			getVersion = () => this.version;
			create(sessionId, files) {
				const limits = settingsOf(this.settings);
				const sessionDrafts = this.drafts.get(sessionId) ?? /* @__PURE__ */ new Map();
				if (files.length === 0) return [];
				if (sessionDrafts.size + files.length > limits.maxFiles) throw new Error(`You can attach up to ${limits.maxFiles} files per message.`);
				const totalBytes = [...sessionDrafts.values()].reduce((total, item) => total + item.file.size, 0);
				if (files.some((file) => file.size > limits.maxBytesPerFile)) throw new Error("One attachment exceeds the configured per-file size limit.");
				if (totalBytes + files.reduce((total, file) => total + file.size, 0) > limits.maxTotalBytes) throw new Error("The attachments exceed the configured total size limit.");
				const created = files.map((file) => ({
					kind: "document",
					id: crypto.randomUUID(),
					file,
					status: "queued"
				}));
				for (const document of created) sessionDrafts.set(document.id, document);
				this.drafts.set(sessionId, sessionDrafts);
				this.changed();
				return created;
			}
			list(sessionId, ids) {
				const drafts = this.drafts.get(sessionId);
				if (drafts === void 0) return [];
				return ids.flatMap((id) => {
					const document = drafts.get(id);
					return document === void 0 ? [] : [document];
				});
			}
			release(sessionId, id) {
				this.aborts.get(id)?.abort();
				this.aborts.delete(id);
				this.converted.delete(id);
				const drafts = this.drafts.get(sessionId);
				if (drafts?.delete(id)) this.changed();
				if (drafts?.size === 0) this.drafts.delete(sessionId);
			}
			async convert(sessionId, ids, signal) {
				const limits = settingsOf(this.settings);
				const cacheKey = JSON.stringify([limits.maxBytesPerFile, limits.maxCharsPerFile]);
				const results = /* @__PURE__ */ new Map();
				let next = 0;
				let failure;
				const convertOne = async (id) => {
					if (signal.aborted) throw new Error("attachment_conversion_cancelled");
					const document = this.drafts.get(sessionId)?.get(id);
					if (document === void 0) return;
					const cached = this.converted.get(id);
					if (cached?.key === cacheKey) {
						results.set(id, cached.value);
						return;
					}
					this.setStatus(sessionId, id, "converting");
					const localAbort = new AbortController();
					const abort = () => {
						localAbort.abort();
					};
					signal.addEventListener("abort", abort, { once: true });
					this.aborts.set(id, localAbort);
					try {
						const bytes = new Uint8Array(await document.file.arrayBuffer());
						const response = await this.connection.rpc.call(CHANNEL, "convert-attachment", {
							filename: document.file.name,
							content_type: document.file.type,
							data: bytesToBase64(bytes),
							limits: {
								max_bytes: limits.maxBytesPerFile,
								max_chars: limits.maxCharsPerFile
							}
						}, localAbort.signal);
						if (!response?.ok) throw new Error(response?.error?.message || "The attachment conversion failed.");
						const value = response.value;
						if (typeof value?.text !== "string") throw new Error("The converter returned no attachment text.");
						if (!this.drafts.get(sessionId)?.has(id)) return;
						const notice = value.text_truncated === true ? "[Attachment excerpt: text was truncated during conversion.]\n" : "";
						const attachment = {
							id,
							filename: typeof value.filename === "string" ? value.filename : document.file.name,
							markdown: notice + value.text
						};
						this.converted.set(id, {
							key: cacheKey,
							value: attachment
						});
						results.set(id, attachment);
						this.setStatus(sessionId, id, "converted");
					} catch (error) {
						if (localAbort.signal.aborted || signal.aborted) {
							if (!this.drafts.get(sessionId)?.has(id)) return;
							throw new Error("attachment_conversion_cancelled");
						}
						this.setStatus(sessionId, id, "failed", error instanceof Error ? error.message : String(error));
						throw error;
					} finally {
						signal.removeEventListener("abort", abort);
						if (this.aborts.get(id) === localAbort) this.aborts.delete(id);
					}
				};
				const worker = async () => {
					while (next < ids.length && failure === void 0) {
						const id = ids[next++];
						try {
							await convertOne(id);
						} catch (error) {
							failure = error;
						}
					}
				};
				await Promise.all([worker(), worker()]);
				if (failure !== void 0) throw failure;
				if (signal.aborted) throw new Error("attachment_conversion_cancelled");
				const ordered = ids.flatMap((id) => results.has(id) ? [results.get(id)] : []);
				if (ordered.reduce((total, item) => total + item.markdown.length, 0) > limits.maxTotalChars) throw new Error("The attachments exceed the configured Markdown character limit.");
				return ordered;
			}
			setStatus(sessionId, id, status, error) {
				const drafts = this.drafts.get(sessionId);
				const current = drafts?.get(id);
				if (current === void 0) return;
				drafts?.set(id, {
					...current,
					...status === void 0 ? {} : { status },
					...error === void 0 ? {} : { error }
				});
				this.changed();
			}
			changed() {
				this.version += 1;
				for (const listener of this.listeners) listener();
			}
		};
		//#endregion
		//#region \0dsh-css:/Users/chankokpan/Documents/CITIC_AGENT/packages/soc-agent-attachments/src/client/MarkItDownDocuments.module.css.mjs
		const css$6 = ".jH9gTW_rail{flex-wrap:wrap;gap:8px;padding:10px 12px 0;display:flex}.jH9gTW_item{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);min-width:0;max-width:min(100%,360px);color:var(--dsw-alias-label-primary);border-radius:8px;align-items:center;gap:7px;padding:6px 8px;font-size:13px;line-height:20px;display:inline-flex}.jH9gTW_icon{flex:none;font-size:14px;line-height:1}.jH9gTW_name{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}.jH9gTW_status{color:var(--dsw-alias-label-tertiary);white-space:nowrap;flex:none;font-size:12px}.jH9gTW_remove{width:20px;height:20px;color:var(--dsw-alias-label-tertiary);font:inherit;cursor:pointer;background:0 0;border:0;border-radius:50%;flex:none;padding:0;font-size:18px;line-height:18px}.jH9gTW_remove:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.jH9gTW_remove:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}";
		const tagId$6 = "dsh-soc-agent-attachments/MarkItDownDocuments.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$6) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-soc-agent-attachments";
			tag.dataset.pluginCss = tagId$6;
			tag.textContent = css$6;
			document.head.appendChild(tag);
		}
		var MarkItDownDocuments_module_css_default = {
			"icon": "jH9gTW_icon",
			"item": "jH9gTW_item",
			"name": "jH9gTW_name",
			"rail": "jH9gTW_rail",
			"remove": "jH9gTW_remove",
			"status": "jH9gTW_status"
		};
		//#endregion
		//#region src/client/MarkItDownDocuments.tsx
		function statusText(document, converting) {
			if (document.status === "failed") return document.error ?? "Conversion failed";
			if (converting || document.status === "converting") return "Converting…";
			if (document.status === "converted") return "Ready";
			return "Queued";
		}
		function MarkItDownDocuments(props) {
			const { controller, sessionId } = props;
			(0, react.useSyncExternalStore)(controller.subscribe, controller.getVersion, controller.getVersion);
			if (sessionId === void 0) return null;
			const documents = controller.list(sessionId, props.attachments.filter((attachment) => attachment.kind === "document").map((document) => document.id));
			const pickerId = `soc-agent-file-picker-${sessionId}`;
			if (documents.length === 0 && !props.canAcceptDrop) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: MarkItDownDocuments_module_css_default.rail,
				"aria-label": "Attached files",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
					id: pickerId,
					type: "file",
					multiple: true,
					hidden: true,
					onChange: (event) => {
						const files = [...event.currentTarget.files ?? []];
						event.currentTarget.value = "";
						if (files.length > 0 && props.canAcceptDrop) props.onAddFiles(files);
					}
				}), documents.map((document) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: MarkItDownDocuments_module_css_default.item,
					title: document.error,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: MarkItDownDocuments_module_css_default.icon,
							"aria-hidden": "true",
							children: "📎"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: MarkItDownDocuments_module_css_default.name,
							children: document.file.name
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: MarkItDownDocuments_module_css_default.status,
							children: statusText(document, document.status === "converting")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: MarkItDownDocuments_module_css_default.remove,
							type: "button",
							"aria-label": `Remove ${document.file.name}`,
							onClick: () => props.onRemoveAttachment(document.id),
							children: "×"
						})
					]
				}, document.id))]
			});
		}
		function openMarkItDownPicker(sessionId) {
			const input = document.getElementById(`soc-agent-file-picker-${sessionId}`);
			if (input instanceof HTMLInputElement) input.click();
		}
		//#endregion
		//#region ../../node_modules/.pnpm/clsx@2.1.1/node_modules/clsx/dist/clsx.mjs
		function r(e) {
			var t, f, n = "";
			if ("string" == typeof e || "number" == typeof e) n += e;
			else if ("object" == typeof e) if (Array.isArray(e)) {
				var o = e.length;
				for (t = 0; t < o; t++) e[t] && (f = r(e[t])) && (n && (n += " "), n += f);
			} else for (f in e) e[f] && (n && (n += " "), n += f);
			return n;
		}
		function clsx() {
			for (var e, t, f = 0, n = "", o = arguments.length; f < o; f++) (e = arguments[f]) && (t = r(e)) && (n && (n += " "), n += t);
			return n;
		}
		//#endregion
		//#region \0dsh-css:/Users/chankokpan/Documents/CITIC_AGENT/packages/soc-agent-attachments/src/AttachmentRail.module.css.mjs
		const css$5 = "._4erjrq_root{min-width:0;position:relative}._4erjrq_rail{scrollbar-width:none;--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);align-items:stretch;gap:10px;display:flex;overflow:auto hidden}._4erjrq_rail::-webkit-scrollbar{display:none}._4erjrq_item{flex:none;height:64px}._4erjrq_thumbnail{border:.5px solid var(--dsw-alias-border-l2-darkmode-thin);background:var(--dsw-alias-interactive-bg-hover);cursor:zoom-in;border-radius:16px;width:64px;height:64px;padding:0;overflow:hidden}._4erjrq_thumbnail img{object-fit:cover;width:100%;height:100%;display:block}._4erjrq_remove{z-index:1;corner-shape:round;background:var(--dsw-alias-button-contrast-fill);width:18px;height:18px;color:var(--dsw-alias-label-primary-inverted);cursor:pointer;opacity:0;border:none;border-radius:50%;place-items:center;padding:0;transition:opacity .2s ease-in-out;display:grid;position:absolute;top:4px;right:4px}._4erjrq_item:hover ._4erjrq_remove,._4erjrq_remove:focus-visible{opacity:1}@media (pointer:coarse){._4erjrq_remove{opacity:1}}@media (prefers-reduced-motion:reduce){._4erjrq_remove{transition:none}}._4erjrq_arrow{z-index:2;--dsw-elevation-stroke-color:var(--dsw-alias-border-l2-darkmode-thin);corner-shape:round;background:var(--dsw-specific-input-major);width:24px;height:24px;color:var(--dsw-alias-label-secondary);box-shadow:var(--dsw-elevation-panel);cursor:pointer;border:0;border-radius:999px;place-items:center;padding:0;display:grid;position:absolute;top:50%;transform:translateY(-50%)}._4erjrq_arrow:hover{background:var(--dsw-alias-interactive-bg-hover-solid)}._4erjrq_arrowLeft{left:4px}._4erjrq_arrowRight{right:4px}";
		const tagId$5 = "dsh-soc-agent-attachments/AttachmentRail.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$5) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-soc-agent-attachments";
			tag.dataset.pluginCss = tagId$5;
			tag.textContent = css$5;
			document.head.appendChild(tag);
		}
		var AttachmentRail_module_css_default = {
			"arrow": "_4erjrq_arrow",
			"arrowLeft": "_4erjrq_arrowLeft",
			"arrowRight": "_4erjrq_arrowRight",
			"item": "_4erjrq_item",
			"rail": "_4erjrq_rail",
			"remove": "_4erjrq_remove",
			"root": "_4erjrq_root",
			"thumbnail": "_4erjrq_thumbnail"
		};
		//#endregion
		//#region src/AttachmentRail.tsx
		/** Draft-attachment rail: scrollbar-less horizontal overflow paged by edge arrows. */
		/** Approximate pixels per wheel step for `deltaMode` LINE deltas (Firefox
		* notch wheels report lines, not pixels). */
		const WHEEL_LINE_PX = 16;
		/** Smooth paging unless the user asked for reduced motion. */
		function pageBehavior() {
			const matchMedia = window.matchMedia;
			return matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
		}
		/**
		* Horizontal rail over the caller's ordered draft attachments.
		*
		* The rail scrolls with its scrollbar hidden; overflow is announced by edge
		* arrows recomputed from scroll geometry on scroll, item-count changes, and
		* rail size changes (a ResizeObserver on the rail element, so sidebar or
		* panel resizes count, not only window resizes). A vertical wheel pans the
		* rail horizontally and is consumed exclusively (non-passive listener), a
		* newly added item is revealed at the rail's end while a rail that mounts
		* over an existing draft keeps its start position. The owner renders each
		* item and decides mounting; it renders the rail only while items exist.
		*
		* @param props.items - attachments in draft order.
		* @param props.labels - rail-level strings (group name and paging arrows).
		* @param props.renderItem - render one attachment card in draft order.
		* @returns the rail group with its paging arrows.
		*/
		function AttachmentRail({ items, labels, renderItem }) {
			const railRef = (0, react.useRef)(null);
			const countRef = (0, react.useRef)(null);
			const [edges, setEdges] = (0, react.useState)({
				left: false,
				right: false
			});
			const updateEdges = (0, react.useCallback)(() => {
				const el = railRef.current;
				/* v8 ignore next -- defensive: every caller runs while the rail element is mounted. */
				if (el === null) return;
				const left = el.scrollLeft > 1;
				const right = el.scrollLeft < el.scrollWidth - el.clientWidth - 1;
				setEdges((prev) => prev.left === left && prev.right === right ? prev : {
					left,
					right
				});
			}, []);
			(0, react.useLayoutEffect)(() => {
				const grew = countRef.current !== null && items.length > countRef.current;
				countRef.current = items.length;
				const el = railRef.current;
				/* v8 ignore next -- defensive: the rail div renders unconditionally, so the layout effect always finds it. */
				if (el === null) return;
				if (grew) el.scrollLeft = el.scrollWidth - el.clientWidth;
				updateEdges();
			}, [items.length, updateEdges]);
			(0, react.useEffect)(() => {
				const el = railRef.current;
				/* v8 ignore next -- defensive: the rail div renders unconditionally, so the mount effect always finds it. */
				if (el === null) return;
				let disconnect = () => {};
				if (typeof ResizeObserver !== "undefined") {
					const observer = new ResizeObserver(updateEdges);
					observer.observe(el);
					disconnect = () => {
						observer.disconnect();
					};
				}
				const onWheel = (event) => {
					if (event.deltaY === 0) return;
					const scale = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? WHEEL_LINE_PX : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? el.clientWidth : 1;
					event.preventDefault();
					el.scrollBy({
						left: event.deltaX !== 0 ? event.deltaX * scale : Math.sign(event.deltaY) * Math.min(Math.abs(event.deltaY) * scale, 60),
						behavior: "auto"
					});
				};
				el.addEventListener("wheel", onWheel, { passive: false });
				return () => {
					disconnect();
					el.removeEventListener("wheel", onWheel);
				};
			}, [updateEdges]);
			const page = (direction) => {
				const el = railRef.current;
				/* v8 ignore next -- defensive: the arrows render only while the rail is mounted, so a click cannot find a null ref. */
				if (el === null) return;
				el.scrollBy({
					left: direction * Math.max(el.clientWidth - 64, 200),
					behavior: pageBehavior()
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: AttachmentRail_module_css_default.root,
				children: [
					edges.left && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: clsx(AttachmentRail_module_css_default.arrow, AttachmentRail_module_css_default.arrowLeft),
						"aria-label": labels.scrollLeft,
						onClick: () => {
							page(-1);
						},
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronLeftOutline14, {})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						ref: railRef,
						className: AttachmentRail_module_css_default.rail,
						role: "group",
						"aria-label": labels.group,
						onScroll: updateEdges,
						children: items.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: AttachmentRail_module_css_default.item,
							children: renderItem(item)
						}, item.id))
					}),
					edges.right && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: clsx(AttachmentRail_module_css_default.arrow, AttachmentRail_module_css_default.arrowRight),
						"aria-label": labels.scrollRight,
						onClick: () => {
							page(1);
						},
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutline14, {})
					})
				]
			});
		}
		//#endregion
		//#region \0dsh-css:/Users/chankokpan/Documents/CITIC_AGENT/packages/soc-agent-attachments/src/DropOverlay.module.css.mjs
		const css$4 = ".j5ZM5W_mask{z-index:1000;pointer-events:none;background-color:var(--dsw-alias-bg-mask-drop);backdrop-filter:blur(10px);justify-content:center;align-items:center;animation:.16s ease-out j5ZM5W_fade-in;display:flex;position:fixed;inset:0}@keyframes j5ZM5W_fade-in{0%{opacity:0}to{opacity:1}}@media (prefers-reduced-motion:reduce){.j5ZM5W_mask{animation:none}}.j5ZM5W_wrap{color:var(--dsw-alias-label-primary);text-align:center;flex-direction:column;align-items:center;margin-top:-3%;padding:0 40px;display:flex}.j5ZM5W_illustration{width:115px;height:84px}.j5ZM5W_title{font:var(--dsw-font-l-20);margin-top:16px}.j5ZM5W_desc{font:var(--dsw-font-s-14);color:var(--dsw-alias-label-tertiary);white-space:pre-wrap;margin-top:16px}";
		const tagId$4 = "dsh-soc-agent-attachments/DropOverlay.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$4) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-soc-agent-attachments";
			tag.dataset.pluginCss = tagId$4;
			tag.textContent = css$4;
			document.head.appendChild(tag);
		}
		var DropOverlay_module_css_default = {
			"desc": "j5ZM5W_desc",
			"fade-in": "j5ZM5W_fade-in",
			"illustration": "j5ZM5W_illustration",
			"mask": "j5ZM5W_mask",
			"title": "j5ZM5W_title",
			"wrap": "j5ZM5W_wrap"
		};
		//#endregion
		//#region src/DropOverlay.tsx
		/**
		* Full-viewport invitation shown while a file drag is over the page
		* (DeepSeek Chat's DragMask). Decoration only: `pointer-events: none` keeps
		* drag targeting on the page below, so the owner's document-level listeners
		* keep an accurate enter/leave count and own accept/reject. Rendered through
		* a body portal for the same transformed-ancestor reason as the lightbox.
		*
		* @param props.disabled - drops are currently refused; renders the blocked
		* illustration and drops the desc line.
		* @param props.labels - resolved title and limits strings.
		* @returns the overlay layer.
		*/
		function DropOverlay({ disabled, labels }) {
			return (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: DropOverlay_module_css_default.mask,
				role: "status",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: DropOverlay_module_css_default.wrap,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: DropOverlay_module_css_default.illustration,
							"aria-hidden": "true",
							children: disabled ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(UploadDisabledIllustration, {}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(UploadIllustration, {})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: DropOverlay_module_css_default.title,
							children: labels.title
						}),
						!disabled && labels.desc !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: DropOverlay_module_css_default.desc,
							children: labels.desc
						})
					]
				})
			}), document.body);
		}
		/** Tilted photo-and-note cards (DeepSeek Chat upload illustration). */
		const UploadIllustration = () => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
			width: "115",
			height: "84",
			viewBox: "0 0 115 84",
			fill: "none",
			xmlns: "http://www.w3.org/2000/svg",
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("g", {
				clipPath: "url(#dshDropOverlayClip)",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
						y: "17.0742",
						width: "44.1832",
						height: "43.6431",
						rx: "12",
						transform: "rotate(-22.7338 0 17.0742)",
						fill: "#9CE5ED"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
						x: "73.4043",
						y: "8.54297",
						width: "43.7267",
						height: "50.5284",
						rx: "8",
						transform: "rotate(17.403 73.4043 8.54297)",
						fill: "#679EFE"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						d: "M30.4917 28.1369L40.8865 33.4564L37.2232 34.9524L29.5302 31.0159L26.7919 39.2122L23.1285 40.7082L26.8287 29.6338L16.8967 24.5516L20.5601 23.0556L27.7902 26.7549L30.3639 19.052L34.0273 17.556L30.4917 28.1369Z",
						fill: "white"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						d: "M77.5088 26.3047L101.057 33.7966",
						stroke: "white",
						strokeWidth: "3"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						d: "M72.2646 42.7871L86.3938 47.2823",
						stroke: "white",
						strokeWidth: "3"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						d: "M74.8867 34.5469L98.4353 42.0388",
						stroke: "white",
						strokeWidth: "3"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
						x: "31.583",
						y: "38.6641",
						width: "44.9157",
						height: "44.3666",
						rx: "12",
						transform: "rotate(-0.134233 31.583 38.6641)",
						fill: "#3964FE"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						d: "M38.9521 73.0337C39.6129 71.7086 41.7113 66.0937 43.5113 61.1663C44.1607 59.3885 46.7484 59.3923 47.4591 61.1465C48.9728 64.8828 50.7969 68.6922 51.9988 69.1925C54.2946 70.1482 57.9854 59.3573 68.0064 70.1801",
						stroke: "white",
						strokeWidth: "3"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: "60.6157",
						cy: "52.247",
						r: "4.38794",
						transform: "rotate(22.5996 60.6157 52.247)",
						fill: "white"
					})
				]
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("defs", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("clipPath", {
				id: "dshDropOverlayClip",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
					width: "115",
					height: "84",
					fill: "white"
				})
			}) })]
		});
		/** Greyed cards with a blocked badge (DeepSeek Chat disabled illustration). */
		const UploadDisabledIllustration = () => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
			width: "115",
			height: "84",
			viewBox: "0 0 115 84",
			fill: "none",
			xmlns: "http://www.w3.org/2000/svg",
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M29.6829 4.63701L11.0677 12.4368C4.95519 14.998 2.07624 22.0294 4.6374 28.1419L12.2285 46.259C14.7896 52.3715 21.8211 55.2505 27.9336 52.6893L46.5488 44.8895C52.6613 42.3283 55.5403 35.2969 52.9791 29.1844L45.388 11.0673C42.8269 4.9548 35.7954 2.07585 29.6829 4.63701Z",
					fill: "#979DA6"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M30.4915 28.1375L40.8863 33.4569L37.223 34.9529L29.53 31.0165L26.7917 39.2128L23.1283 40.7088L26.8285 29.6344L16.8965 24.5522L20.5599 23.0562L27.79 26.7555L30.3637 19.0526L34.0271 17.5566L30.4915 28.1375Z",
					fill: "white"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M107.496 19.2285L81.0381 10.9357C76.8221 9.61423 72.333 11.9607 71.0116 16.1768L60.6844 49.1246C59.363 53.3406 61.7095 57.8297 65.9255 59.1511L92.383 67.4439C96.599 68.7654 101.088 66.4189 102.41 62.2029L112.737 29.255C114.058 25.039 111.712 20.55 107.496 19.2285Z",
					fill: "#979DA6"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M77.5088 26.3047L101.057 33.7967",
					stroke: "white",
					strokeWidth: "3"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M72.2646 42.7871L86.3938 47.2823",
					stroke: "white",
					strokeWidth: "3"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M74.8867 34.5469L98.4353 42.0388",
					stroke: "white",
					strokeWidth: "3"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M66.5798 30.1418L41.481 30.2006C33.5281 30.2193 27.0962 36.6815 27.1148 44.6343L27.172 69.0742C27.1907 77.0271 33.6529 83.459 41.6057 83.4404L66.7045 83.3816C74.6574 83.363 81.0894 76.9008 81.0707 68.9479L81.0135 44.5081C80.9949 36.5552 74.5327 30.1232 66.5798 30.1418Z",
					fill: "#F59E0B"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M54 70.7969C61.732 70.7969 68 64.5289 68 56.7969C68 49.0649 61.732 42.7969 54 42.7969C46.268 42.7969 40 49.0649 40 56.7969C40 64.5289 46.268 70.7969 54 70.7969Z",
					stroke: "white",
					strokeWidth: "3.5"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M44 46.7969L64 66.7969",
					stroke: "white",
					strokeWidth: "3.5",
					strokeLinecap: "round"
				})
			]
		});
		//#endregion
		//#region \0dsh-css:/Users/chankokpan/Documents/CITIC_AGENT/packages/soc-agent-attachments/src/FileCard.module.css.mjs
		const css$3 = ".DZ9VdW_card{border:.5px solid var(--dsw-alias-border-l2,#0000001f);background:var(--dsw-specific-input-major,transparent);box-sizing:border-box;text-align:left;border-radius:16px;align-items:center;gap:10px;width:240px;height:64px;padding:0 12px;display:inline-flex;position:relative}.DZ9VdW_failed{border-color:var(--dsw-alias-state-error-primary,#d54941)}.DZ9VdW_icon{flex:none;justify-content:center;align-items:center;width:28px;height:28px;display:inline-flex}.DZ9VdW_spinner{corner-shape:round;border:2px solid;border-top-color:#0000;border-radius:50%;width:20px;height:20px;animation:.8s linear infinite DZ9VdW_file-card-spin}@keyframes DZ9VdW_file-card-spin{to{transform:rotate(360deg)}}.DZ9VdW_body{flex-direction:column;flex:1;min-width:0;padding:8px 0;display:flex}.DZ9VdW_retry{color:inherit;font:inherit;text-align:left;cursor:pointer;background:0 0;border:0;padding:0}.DZ9VdW_name{white-space:nowrap;text-overflow:ellipsis;color:var(--dsw-alias-label-primary);font-size:14px;font-weight:500;line-height:22px;overflow:hidden}.DZ9VdW_meta{white-space:nowrap;text-overflow:ellipsis;color:var(--dsw-alias-label-tertiary,#00000073);font-size:12px;line-height:15px;overflow:hidden}.DZ9VdW_metaFailed{color:var(--dsw-alias-state-error-primary,#d54941)}.DZ9VdW_remove{corner-shape:round;background:var(--dsw-alias-button-contrast-fill,#000000b8);width:18px;height:18px;color:var(--dsw-alias-label-primary-inverted,#fff);opacity:0;cursor:pointer;border:none;border-radius:50%;justify-content:center;align-items:center;padding:0;transition:opacity .2s ease-in-out;display:inline-flex;position:absolute;top:6px;right:6px}.DZ9VdW_card:hover .DZ9VdW_remove,.DZ9VdW_remove:focus-visible{opacity:1}@media (pointer:coarse){.DZ9VdW_remove{opacity:1}}@media (prefers-reduced-motion:reduce){.DZ9VdW_remove{transition:none}}.DZ9VdW_card:hover .DZ9VdW_name,.DZ9VdW_card:focus-within .DZ9VdW_name{padding-right:18px}.DZ9VdW_removeFailed{background:var(--dsw-alias-state-error-primary,#d54941);color:#fff;opacity:1}.DZ9VdW_progressTrack{background:var(--dsw-alias-fill-tertiary,#00000014);border-radius:1px;height:2px;position:absolute;bottom:5px;left:12px;right:12px;overflow:hidden}.DZ9VdW_progressBar{border-radius:inherit;background:var(--dsw-alias-brand-primary,#4d6bfe);width:35%;height:100%;animation:1.2s ease-in-out infinite alternate DZ9VdW_file-card-progress;display:block}.DZ9VdW_progressBar[style]{animation:none}@keyframes DZ9VdW_file-card-progress{0%{transform:translate(-70%)}to{transform:translate(220%)}}@media (pointer:coarse){.DZ9VdW_remove{opacity:1}}";
		const tagId$3 = "dsh-soc-agent-attachments/FileCard.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$3) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-soc-agent-attachments";
			tag.dataset.pluginCss = tagId$3;
			tag.textContent = css$3;
			document.head.appendChild(tag);
		}
		var FileCard_module_css_default = {
			"body": "DZ9VdW_body",
			"card": "DZ9VdW_card",
			"failed": "DZ9VdW_failed",
			"file-card-progress": "DZ9VdW_file-card-progress",
			"file-card-spin": "DZ9VdW_file-card-spin",
			"icon": "DZ9VdW_icon",
			"meta": "DZ9VdW_meta",
			"metaFailed": "DZ9VdW_metaFailed",
			"name": "DZ9VdW_name",
			"progressBar": "DZ9VdW_progressBar",
			"progressTrack": "DZ9VdW_progressTrack",
			"remove": "DZ9VdW_remove",
			"removeFailed": "DZ9VdW_removeFailed",
			"retry": "DZ9VdW_retry",
			"spinner": "DZ9VdW_spinner"
		};
		//#endregion
		//#region src/FileCard.tsx
		/** One pending file card: type glyph, name, size or upload status, remove, retry. */
		function FileCard({ name, bytes, state, progress, labels, onRemove, onRetry }) {
			const extension = (0, _deepseek_ai_dsh_client_ui_primitives.fileExtension)(name).toUpperCase().slice(0, 8);
			const meta = state === "uploading" ? labels.uploading : state === "error" ? labels.failed : [extension, (0, _deepseek_ai_dsh_client_ui_primitives.fileSizeText)(bytes)].filter((part) => part !== "").join(" ");
			const retryable = state === "error";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: `${FileCard_module_css_default.card}${retryable ? ` ${FileCard_module_css_default.failed}` : ""}`,
				title: name,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: FileCard_module_css_default.icon,
						"aria-hidden": true,
						children: state === "uploading" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: FileCard_module_css_default.spinner }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.FileTypeIcon, { path: name })
					}),
					retryable ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: `${FileCard_module_css_default.body} ${FileCard_module_css_default.retry}`,
						"aria-label": labels.retry,
						onClick: onRetry,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: FileCard_module_css_default.name,
							children: name
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: `${FileCard_module_css_default.meta} ${FileCard_module_css_default.metaFailed}`,
							children: meta
						})]
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: FileCard_module_css_default.body,
						"aria-label": labels.label,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: FileCard_module_css_default.name,
							children: name
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: FileCard_module_css_default.meta,
							children: meta
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: retryable ? `${FileCard_module_css_default.remove} ${FileCard_module_css_default.removeFailed}` : FileCard_module_css_default.remove,
						"aria-label": labels.remove,
						onClick: onRemove,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseFill14, { size: 12 })
					}),
					state === "uploading" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: FileCard_module_css_default.progressTrack,
						"aria-hidden": true,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: FileCard_module_css_default.progressBar,
							style: progress === void 0 ? void 0 : { width: `${String(Math.min(1, Math.max(0, progress)) * 100)}%` }
						})
					})
				]
			});
		}
		//#endregion
		//#region \0dsh-css:/Users/chankokpan/Documents/CITIC_AGENT/packages/soc-agent-attachments/src/ImageLightbox.module.css.mjs
		const css$2 = ".wv6fqG_backdrop{z-index:1000;place-items:center;padding:40px;display:grid;position:fixed;inset:0}.wv6fqG_mask{background:var(--dsw-alias-bg-mask-1);backdrop-filter:var(--dsw-mask-blur);position:absolute;inset:0}.wv6fqG_image{object-fit:contain;background:var(--dsw-specific-input-major);max-width:min(100%,1600px);max-height:calc(100vh - 80px);box-shadow:var(--dsw-shadow-lv3);border-radius:12px;position:relative}.wv6fqG_close{z-index:1;border:.5px solid var(--dsw-alias-border-l2-darkmode-thin);corner-shape:round;background:var(--dsw-specific-input-major);width:36px;height:36px;color:var(--dsw-alias-label-primary);cursor:pointer;border-radius:999px;place-items:center;display:grid;position:fixed;top:20px;right:20px}";
		const tagId$2 = "dsh-soc-agent-attachments/ImageLightbox.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-soc-agent-attachments";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var ImageLightbox_module_css_default = {
			"backdrop": "wv6fqG_backdrop",
			"close": "wv6fqG_close",
			"image": "wv6fqG_image",
			"mask": "wv6fqG_mask"
		};
		//#endregion
		//#region src/ImageLightbox.tsx
		/**
		* Document-level original-image preview opened by clicking a thumbnail.
		* Closes on Escape, backdrop press, or the close control, and restores focus
		* to the opener on unmount. Rendered through a body portal: an opener inside
		* a transformed or filtered ancestor would otherwise trap the fixed backdrop
		* in that ancestor's box instead of covering the viewport.
		*
		* @param props.src - the original image URL.
		* @param props.alt - the image's alt text.
		* @param props.labels - dialog and close-control strings.
		* @param props.onClose - dismiss callback owned by the opener.
		* @returns the modal preview dialog.
		*/
		function ImageLightbox({ src, alt, labels, onClose }) {
			const closeRef = (0, react.useRef)(null);
			const restoreRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
				closeRef.current?.focus();
				const onKeyDown = (event) => {
					if (event.key === "Escape") onClose();
				};
				window.addEventListener("keydown", onKeyDown);
				return () => {
					window.removeEventListener("keydown", onKeyDown);
					restoreRef.current?.focus();
				};
			}, [onClose]);
			return (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: ImageLightbox_module_css_default.backdrop,
				role: "dialog",
				"aria-modal": "true",
				"aria-label": labels.dialog,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: ImageLightbox_module_css_default.mask,
						"aria-hidden": "true",
						onMouseDown: onClose
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
						className: ImageLightbox_module_css_default.image,
						src,
						alt
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						ref: closeRef,
						type: "button",
						className: ImageLightbox_module_css_default.close,
						"aria-label": labels.close,
						onClick: onClose,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseOutline16, { size: 16 })
					})
				]
			}), document.body);
		}
		//#endregion
		//#region src/client/labels.ts
		/**
		* Resolve original-image lightbox strings from the conversation namespace.
		* @param t - conversation namespace translator.
		* @returns translated lightbox labels.
		*/
		function lightboxLabels(t) {
			return {
				dialog: t("image.preview"),
				close: t("image.closePreview")
			};
		}
		/**
		* Resolve historical message-image strings from the conversation namespace.
		* @param t - conversation namespace translator.
		* @returns translated message-image labels.
		*/
		function messageImageLabels(t) {
			return {
				image: t("image.label"),
				open: t("image.openOriginal"),
				openNamed: (label) => t("image.openOriginalLabel", { label }),
				loading: t("image.loading"),
				loadFailed: t("image.loadFailed"),
				lightbox: lightboxLabels(t)
			};
		}
		/**
		* Resolve the document-level drop invitation and its optional limits line.
		* @param t - conversation namespace translator.
		* @param accepting - whether the composer can accept dropped files.
		* @param limits - optional translated count and size values.
		* @returns translated drop-overlay labels.
		*/
		function dropOverlayLabels(t, accepting, limits) {
			if (!accepting) return { title: t("attachment.dropBlocked") };
			return {
				title: t("attachment.dropTitle"),
				desc: limits === void 0 ? void 0 : t("attachment.dropDesc", limits)
			};
		}
		/**
		* Resolve pending-file card strings from the conversation namespace.
		* @param t - conversation namespace translator.
		* @param name - browser file name interpolated into remove/retry labels.
		* @returns translated file-card labels.
		*/
		function fileCardLabels(t, name) {
			return {
				label: t("file.pending"),
				remove: t("file.remove", { name }),
				uploading: t("file.uploading"),
				failed: t("file.uploadFailed"),
				retry: t("file.retry", { name })
			};
		}
		/**
		* Resolve the mixed draft-attachment rail strings from the conversation namespace.
		* @param t - conversation namespace translator.
		* @returns translated attachment-rail labels.
		*/
		function attachmentRailLabels(t) {
			return {
				group: t("attachment.pending"),
				scrollLeft: t("attachment.scrollLeft"),
				scrollRight: t("attachment.scrollRight")
			};
		}
		//#endregion
		//#region \0dsh-css:/Users/chankokpan/Documents/CITIC_AGENT/packages/soc-agent-attachments/src/client/ComposerAttachments.module.css.mjs
		const css$1 = ".e7xcIa_rail{min-width:0;margin-bottom:-6px;padding:2px 10px 0}.e7xcIa_imageItem{width:64px;height:64px;position:relative}.e7xcIa_thumbnail{border:.5px solid var(--dsw-alias-border-l2-darkmode-thin);background:var(--dsw-alias-interactive-bg-hover);cursor:zoom-in;border-radius:16px;width:64px;height:64px;padding:0;overflow:hidden}.e7xcIa_thumbnail img{object-fit:cover;width:100%;height:100%;display:block}.e7xcIa_remove{z-index:1;corner-shape:round;background:var(--dsw-alias-button-contrast-fill);width:18px;height:18px;color:var(--dsw-alias-label-primary-inverted);cursor:pointer;opacity:0;border:none;border-radius:50%;place-items:center;padding:0;transition:opacity .2s ease-in-out;display:grid;position:absolute;top:4px;right:4px}.e7xcIa_imageItem:hover .e7xcIa_remove,.e7xcIa_remove:focus-visible{opacity:1}@media (pointer:coarse){.e7xcIa_remove{opacity:1}}@media (prefers-reduced-motion:reduce){.e7xcIa_remove{transition:none}}";
		const tagId$1 = "dsh-soc-agent-attachments/ComposerAttachments.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-soc-agent-attachments";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var ComposerAttachments_module_css_default = {
			"imageItem": "e7xcIa_imageItem",
			"rail": "e7xcIa_rail",
			"remove": "e7xcIa_remove",
			"thumbnail": "e7xcIa_thumbnail"
		};
		//#endregion
		//#region src/client/ComposerAttachments.tsx
		/** Draft image previews, pending-file cards, drop target, and original-image preview. */
		function ComposerAttachments({ attachments, canAcceptDrop, onAddFiles, onRemoveAttachment, uploads, onRetryFile, dropLimits, t }) {
			const [preview, setPreview] = (0, react.useState)(null);
			const [dragActive, setDragActive] = (0, react.useState)(false);
			const dragDepth = (0, react.useRef)(0);
			const closePreview = (0, react.useCallback)(() => {
				setPreview(null);
			}, []);
			(0, react.useEffect)(() => {
				if (preview !== null && !attachments.some((attachment) => attachment.id === preview.id)) setPreview(null);
			}, [attachments, preview]);
			(0, react.useEffect)(() => {
				const fileTransfer = (event) => {
					const dataTransfer = event.dataTransfer;
					if (dataTransfer === null || !dataTransfer.types.includes("Files")) return null;
					return dataTransfer;
				};
				const reset = () => {
					dragDepth.current = 0;
					setDragActive(false);
				};
				const onDragEnter = (event) => {
					if (fileTransfer(event) === null) return;
					event.preventDefault();
					dragDepth.current += 1;
					setDragActive(true);
				};
				const onDragOver = (event) => {
					const dataTransfer = fileTransfer(event);
					if (dataTransfer === null) return;
					event.preventDefault();
					dataTransfer.dropEffect = canAcceptDrop ? "copy" : "none";
				};
				const onDragLeave = (event) => {
					if (fileTransfer(event) === null) return;
					dragDepth.current = Math.max(0, dragDepth.current - 1);
					if (dragDepth.current === 0) setDragActive(false);
					const leftViewport = event.clientX <= 0 || event.clientY <= 0 || event.clientX >= window.innerWidth || event.clientY >= window.innerHeight;
					if ((event.target === document.documentElement || event.target === document.body) && leftViewport) reset();
				};
				const onDrop = (event) => {
					const dataTransfer = fileTransfer(event);
					if (dataTransfer === null) return;
					event.preventDefault();
					reset();
					if (canAcceptDrop) onAddFiles([...dataTransfer.files]);
				};
				document.addEventListener("dragenter", onDragEnter);
				document.addEventListener("dragover", onDragOver);
				document.addEventListener("dragleave", onDragLeave);
				document.addEventListener("drop", onDrop);
				window.addEventListener("dragend", reset);
				return () => {
					document.removeEventListener("dragenter", onDragEnter);
					document.removeEventListener("dragover", onDragOver);
					document.removeEventListener("dragleave", onDragLeave);
					document.removeEventListener("drop", onDrop);
					window.removeEventListener("dragend", reset);
				};
			}, [canAcceptDrop, onAddFiles]);
			const railItems = (0, react.useMemo)(() => attachments.map((attachment) => ({
				id: attachment.id,
				attachment
			})), [attachments]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				dragActive && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DropOverlay, {
					disabled: !canAcceptDrop,
					labels: dropOverlayLabels(t, canAcceptDrop, dropLimits)
				}),
				railItems.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: ComposerAttachments_module_css_default.rail,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AttachmentRail, {
						items: railItems,
						labels: attachmentRailLabels(t),
						renderItem: (item) => {
							const attachment = item.attachment;
							if (attachment.kind === "file") {
								const upload = uploads[attachment.id];
								return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(FileCard, {
									name: attachment.file.name || t("file.label"),
									bytes: attachment.file.size,
									state: upload === void 0 || upload.status === "uploading" ? "uploading" : upload.status === "ready" ? "ready" : "error",
									...upload?.status === "uploading" && upload.total !== void 0 && upload.total > 0 ? { progress: upload.loaded / upload.total } : {},
									labels: fileCardLabels(t, attachment.file.name),
									onRemove: () => {
										onRemoveAttachment(attachment.id);
									},
									onRetry: () => {
										onRetryFile(attachment.id);
									}
								});
							}
							if (attachment.kind === "document") return null;
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: ComposerAttachments_module_css_default.imageItem,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: ComposerAttachments_module_css_default.thumbnail,
									title: t("image.openOriginal"),
									onClick: () => {
										setPreview(attachment);
									},
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
										src: attachment.previewUrl,
										alt: attachment.file.name || t("image.pending")
									})
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: ComposerAttachments_module_css_default.remove,
									"aria-label": t("image.remove", { name: attachment.file.name }),
									onClick: () => {
										onRemoveAttachment(attachment.id);
									},
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseFill14, { size: 12 })
								})]
							});
						}
					})
				}),
				preview !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ImageLightbox, {
					src: preview.previewUrl,
					alt: preview.file.name || t("image.original"),
					labels: lightboxLabels(t),
					onClose: closePreview
				})
			] });
		}
		//#endregion
		//#region \0dsh-css:/Users/chankokpan/Documents/CITIC_AGENT/packages/soc-agent-attachments/src/MessageImage.module.css.mjs
		const css = ".EmnAnG_gallery{flex-wrap:wrap;gap:10px;max-width:100%;display:flex}.EmnAnG_gallery[data-align=end]{justify-content:flex-end;align-self:flex-end}.EmnAnG_gallery[data-align=start]{justify-content:flex-start;align-self:flex-start}.EmnAnG_frame{border:.5px solid var(--dsw-alias-border-l2-darkmode-thin);background:var(--dsw-alias-interactive-bg-hover);cursor:zoom-in;border-radius:16px;flex:none;place-items:center;min-width:44px;min-height:44px;padding:0;display:grid;overflow:hidden}.EmnAnG_frame[data-variant=tile]{width:64px;min-width:64px;height:64px;min-height:64px}.EmnAnG_frame img{object-fit:cover;width:100%;height:100%;display:block}.EmnAnG_loading,.EmnAnG_error{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}.EmnAnG_error{border:.5px solid var(--dsw-alias-border-l2-darkmode-thin);background:var(--dsw-alias-interactive-bg-hover-danger);cursor:pointer;border-radius:10px;max-width:240px;padding:10px 12px}.EmnAnG_error[data-variant=tile]{border-radius:16px;width:64px;height:64px;padding:4px;overflow:hidden}";
		const tagId = "dsh-soc-agent-attachments/MessageImage.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-soc-agent-attachments";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var MessageImage_module_css_default = {
			"error": "EmnAnG_error",
			"frame": "EmnAnG_frame",
			"gallery": "EmnAnG_gallery",
			"loading": "EmnAnG_loading"
		};
		//#endregion
		//#region src/MessageImage.tsx
		/** Display box for a lone image (DeepSeek Chat rule): long edge 240px with
		* the rendered aspect ratio clamped to [0.25, 4] — the overflow is cropped by
		* `object-fit: cover` — and never upscaled past the image's natural size. The
		* crop anchor keeps the top of very tall images and the left of very wide
		* ones, where the informative content usually starts. */
		function singleFit(dimensions) {
			const natural = dimensions.width / dimensions.height;
			const ratio = Math.min(4, Math.max(.25, natural));
			const box = ratio >= 1 ? {
				width: 240,
				height: 240 / ratio
			} : {
				width: 240 * ratio,
				height: 240
			};
			const scale = Math.min(1, dimensions.width / box.width, dimensions.height / box.height);
			return {
				width: Math.max(1, Math.round(box.width * scale)),
				height: Math.max(1, Math.round(box.height * scale)),
				objectPosition: natural < .25 ? "center top" : natural > 4 ? "left center" : "center"
			};
		}
		/** Intrinsic dimensions of one gallery entry; a preview's stay unknown until its intake probe resolved. */
		function dimensionsOf(image) {
			if ("attachment" in image) return image.attachment;
			return image.preview.width !== void 0 && image.preview.height !== void 0 ? {
				width: image.preview.width,
				height: image.preview.height
			} : void 0;
		}
		/**
		* Compact history renderer with retryable loading and click-to-open original
		* preview. A lone image renders at its `singleFit` size; an image among
		* several renders as a fixed 64px square tile. The preview arm displays its
		* local URL directly — no loader round-trip, no failure/retry surface.
		*
		* @param props.image - the durable reference to load, or the local preview to display.
		* @param props.load - session-authorized URL loader for the durable arm.
		* @param props.variant - `single` for a message's lone image, `tile` otherwise.
		* @param props.labels - resolved strings (tooltip, loading, retry, lightbox).
		* @returns the bounded thumbnail button, or the retry control on failure.
		*/
		function MessageImage({ image, load, variant, labels }) {
			const preview = "preview" in image ? image.preview : void 0;
			const attachment = "attachment" in image ? image.attachment : void 0;
			const [loaded, setLoaded] = (0, react.useState)(() => attachment === void 0 ? null : load.peek?.(attachment) ?? null);
			const [error, setError] = (0, react.useState)(false);
			const [open, setOpen] = (0, react.useState)(false);
			const [attempt, setAttempt] = (0, react.useState)(0);
			const request = (0, react.useCallback)(() => {
				setAttempt((a) => a + 1);
			}, []);
			const close = (0, react.useCallback)(() => {
				setOpen(false);
			}, []);
			const dimensions = (0, react.useMemo)(() => dimensionsOf(image), [image]);
			const fit = (0, react.useMemo)(() => {
				if (variant !== "single") return void 0;
				return dimensions === void 0 ? {
					width: 240,
					height: 240,
					objectPosition: "center"
				} : singleFit(dimensions);
			}, [dimensions, variant]);
			(0, react.useEffect)(() => {
				if (attachment === void 0) return;
				let live = true;
				setError(false);
				setLoaded(load.peek?.(attachment) ?? null);
				load(attachment).then((url) => {
					if (live) setLoaded(url);
				}).catch(() => {
					if (live) setError(true);
				});
				return () => {
					live = false;
				};
			}, [
				attachment,
				load,
				attempt
			]);
			const src = preview?.url ?? loaded;
			const label = preview?.name ?? attachment?.name ?? labels.image;
			if (error) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: MessageImage_module_css_default.error,
				"data-variant": variant,
				onClick: request,
				children: labels.loadFailed
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: MessageImage_module_css_default.frame,
				"data-variant": variant,
				style: fit === void 0 ? void 0 : {
					width: fit.width,
					height: fit.height
				},
				title: labels.open,
				"aria-label": labels.openNamed(label),
				onClick: () => {
					if (src !== null) setOpen(true);
				},
				children: src === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: MessageImage_module_css_default.loading,
					children: labels.loading
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
					src,
					alt: label,
					style: fit === void 0 ? void 0 : { objectPosition: fit.objectPosition }
				})
			}), open && src !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ImageLightbox, {
				src,
				alt: label,
				labels: labels.lightbox,
				onClose: close
			})] });
		}
		/** Wrapping image group shared by user and assistant history: a lone image
		* renders large unless its owning mixed-attachment row requests compact tiles. */
		function ImageGallery({ images, load, align, compact = false, labels }) {
			if (images.length === 0) return null;
			const variant = compact || images.length > 1 ? "tile" : "single";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: MessageImage_module_css_default.gallery,
				"data-align": align,
				children: images.map((image, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MessageImage, {
					image,
					load,
					variant,
					labels
				}, `${"attachment" in image ? image.attachment.attachmentId : image.preview.url}:${index}`))
			});
		}
		//#endregion
		//#region src/client/MessageImages.tsx
		/** Historical message-image slot entry. */
		function MessageImages({ images, loadImage, align, compact = false, t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ImageGallery, {
				images,
				load: loadImage,
				align,
				compact,
				labels: messageImageLabels(t)
			});
		}
		//#endregion
		//#region src/client/index.ts
		/** Optional MarkItDown attachment/document feature. */
		const inject = [
			"slots",
			"connection",
			"conversation",
			"commandUi",
			"settingsScope",
			"socClient"
		];
		function apply(ctx) {
			if (ctx.get("socClient").surface !== "workspace") return;
			const documents = new MarkItDownDocumentController(ctx.get("connection"), ctx.settingsScope.bind({ namespace: MARKITDOWN_ATTACHMENTS_NAMESPACE }));
			const settings = new AttachmentSettingsController(ctx.settingsScope.bind({ namespace: MARKITDOWN_ATTACHMENTS_NAMESPACE }));
			ctx.effect(() => {
				const disposeProvider = ctx.conversation.registerDocumentProvider(documents);
				return () => {
					disposeProvider();
					documents.dispose();
				};
			}, "soc-agent-attachments: MarkItDown document provider");
			ctx.slots.inject("conversation.input.attachments", () => ctx.slots.register({
				name: "conversation.input.attachments",
				locale: "conversation"
			}, (props) => react.default.createElement(react.default.Fragment, null, react.default.createElement(ComposerAttachments, {
				...props,
				attachments: props.attachments.filter((attachment) => attachment.kind !== "document")
			}), react.default.createElement(MarkItDownDocuments, {
				...props,
				controller: documents
			}))));
			ctx.slots.inject("conversation.message.images", () => ctx.slots.register({
				name: "conversation.message.images",
				locale: "conversation"
			}, MessageImages));
			ctx.slots.inject("conversation.trajectory.images", () => ctx.slots.register({
				name: "conversation.trajectory.images",
				locale: "conversation"
			}, MessageImages));
			ctx.slots.inject("tool.call.images", () => ctx.slots.register({
				name: "tool.call.images",
				locale: "conversation"
			}, MessageImages));
			ctx.effect(() => ctx.commandUi.register({
				name: "attach-file",
				description: () => "Attach file",
				available: () => true,
				ui: {
					kind: "action",
					run: (session) => {
						openMarkItDownPicker(session.sessionId);
					}
				}
			}), "soc-agent-attachments: file command");
			ctx.slots.inject("settings.plugin.item", () => ctx.slots.register({
				name: "settings.plugin.item",
				key: MARKITDOWN_ATTACHMENTS_NAMESPACE,
				inject: () => settings.inject()
			}, MarkItDownAttachmentSettingsCard));
			ctx.effect(() => () => settings.dispose(), "soc-agent-attachments: settings controller");
		}
		//#endregion
		exports.AttachmentSettingsController = AttachmentSettingsController;
		exports.DEFAULT_MARKITDOWN_ATTACHMENT_SETTINGS = DEFAULT_MARKITDOWN_ATTACHMENT_SETTINGS;
		exports.MARKITDOWN_ATTACHMENTS_NAMESPACE = MARKITDOWN_ATTACHMENTS_NAMESPACE;
		exports.MarkItDownAttachmentSettingsCard = MarkItDownAttachmentSettingsCard;
		exports.MarkItDownDocumentController = MarkItDownDocumentController;
		exports.MarkItDownDocuments = MarkItDownDocuments;
		exports.apply = apply;
		exports.inject = inject;
		exports.openMarkItDownPicker = openMarkItDownPicker;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map