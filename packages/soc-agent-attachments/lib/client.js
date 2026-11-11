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
		let _deepseek_ai_dsh_client_runtime_client = require("@deepseek-ai/dsh-client-runtime/client");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/attachment-constants.ts
		const DOCUMENT_ATTACHMENTS_NAMESPACE = "soc-agent-document-attachments";
		const DEFAULT_DOCUMENT_ATTACHMENT_SETTINGS = {
			maxFiles: 5,
			maxBytesPerFile: 1e7,
			maxTotalBytes: 5e7
		};
		//#endregion
		//#region \0dsh-css:/Users/chankokpan/Documents/CITIC_AGENT/packages/soc-agent-attachments/src/client/DocumentAttachmentSettings.module.css.mjs
		const css$1 = ".BnJYvq_card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;list-style:none;transition:border-color .16s,background .16s}.BnJYvq_card:hover,.BnJYvq_cardOpen{border-color:var(--dsw-alias-label-dimmed)}.BnJYvq_cardOpen{background:var(--dsw-alias-bg-layer-2)}.BnJYvq_header{width:100%;color:inherit;font:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-radius:12px;align-items:center;gap:12px;padding:14px 16px;display:flex}.BnJYvq_header:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}.BnJYvq_headText{flex-direction:column;flex:1;gap:4px;min-width:0;display:flex}.BnJYvq_name{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:1.4}.BnJYvq_description,.BnJYvq_hint,.BnJYvq_invalid{font-size:12px;line-height:1.5}.BnJYvq_description,.BnJYvq_hint{color:var(--dsw-alias-label-tertiary)}.BnJYvq_chevron{color:var(--dsw-alias-label-tertiary);flex:none;transition:transform .16s}.BnJYvq_chevronOpen{transform:rotate(180deg)}.BnJYvq_body{border-top:1px solid var(--dsw-alias-border-l2);margin:0 16px;padding-bottom:8px}.BnJYvq_field{flex-direction:column;gap:6px;padding:12px 0;display:flex}.BnJYvq_field+.BnJYvq_field{border-top:1px solid var(--dsw-alias-border-l2)}.BnJYvq_fieldHead{align-items:center;gap:8px;display:flex}.BnJYvq_fieldLabel{min-width:0;color:var(--dsw-alias-label-primary);flex:1;font-size:13px;font-weight:500;line-height:1.5}.BnJYvq_badges{align-items:center;gap:8px;display:inline-flex}.BnJYvq_badge{background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);white-space:nowrap;border-radius:999px;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}.BnJYvq_reset{color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;background:0 0;border:0;padding:0;font-size:12px;line-height:1.5}.BnJYvq_reset:hover:not(:disabled){color:var(--dsw-alias-label-primary)}.BnJYvq_input{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);width:100%;height:34px;color:var(--dsw-alias-label-primary);font:inherit;border-radius:8px;padding:0 12px;font-size:13px;line-height:1.5}.BnJYvq_input:focus-visible{border-color:var(--dsw-alias-brand-primary);outline:none}.BnJYvq_input:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}.BnJYvq_inputInvalid{border-color:var(--dsw-alias-label-error)}.BnJYvq_hint,.BnJYvq_invalid,.BnJYvq_failed{margin:0}.BnJYvq_invalid,.BnJYvq_failed{color:var(--dsw-alias-label-error)}.BnJYvq_footer{border-top:1px solid var(--dsw-alias-border-l2);justify-content:flex-end;align-items:center;gap:8px;padding:12px 0 4px;display:flex}.BnJYvq_failed{flex:1;min-width:0;font-size:12px;line-height:1.5}.BnJYvq_discard,.BnJYvq_save{font:inherit;cursor:pointer;border:1px solid #0000;border-radius:8px;padding:5px 14px;font-size:13px;line-height:1.5}.BnJYvq_discard{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);background:0 0}.BnJYvq_save{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}.BnJYvq_discard:disabled,.BnJYvq_save:disabled{opacity:.4;cursor:default}.BnJYvq_discard:focus-visible,.BnJYvq_save:focus-visible,.BnJYvq_reset:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}";
		const tagId$1 = "dsh-soc-agent-attachments/DocumentAttachmentSettings.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-soc-agent-attachments";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var DocumentAttachmentSettings_module_css_default = {
			"badge": "BnJYvq_badge",
			"badges": "BnJYvq_badges",
			"body": "BnJYvq_body",
			"card": "BnJYvq_card",
			"cardOpen": "BnJYvq_cardOpen",
			"chevron": "BnJYvq_chevron",
			"chevronOpen": "BnJYvq_chevronOpen",
			"description": "BnJYvq_description",
			"discard": "BnJYvq_discard",
			"failed": "BnJYvq_failed",
			"field": "BnJYvq_field",
			"fieldHead": "BnJYvq_fieldHead",
			"fieldLabel": "BnJYvq_fieldLabel",
			"footer": "BnJYvq_footer",
			"headText": "BnJYvq_headText",
			"header": "BnJYvq_header",
			"hint": "BnJYvq_hint",
			"input": "BnJYvq_input",
			"inputInvalid": "BnJYvq_inputInvalid",
			"invalid": "BnJYvq_invalid",
			"name": "BnJYvq_name",
			"reset": "BnJYvq_reset",
			"save": "BnJYvq_save"
		};
		//#endregion
		//#region src/client/DocumentAttachmentSettings.tsx
		const FIELDS = [
			"maxFiles",
			"maxBytesPerFile",
			"maxTotalBytes"
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
				this.store = (0, _deepseek_ai_dsh_client_runtime_client.createSnapshotStore)(this.state());
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
				className: DocumentAttachmentSettings_module_css_default.field,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: DocumentAttachmentSettings_module_css_default.fieldHead,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
							className: DocumentAttachmentSettings_module_css_default.fieldLabel,
							htmlFor: id,
							children: label
						}), state.overridden && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: DocumentAttachmentSettings_module_css_default.badges,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: DocumentAttachmentSettings_module_css_default.badge,
								children: "Overridden"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: DocumentAttachmentSettings_module_css_default.reset,
								type: "button",
								disabled,
								onClick: reset,
								children: "Reset"
							})]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						className: state.invalid ? `${DocumentAttachmentSettings_module_css_default.input} ${DocumentAttachmentSettings_module_css_default.inputInvalid}` : DocumentAttachmentSettings_module_css_default.input,
						id,
						inputMode: "numeric",
						value: state.text,
						disabled,
						"aria-invalid": state.invalid || void 0,
						onChange: (event) => edit(event.target.value)
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: state.invalid ? DocumentAttachmentSettings_module_css_default.invalid : DocumentAttachmentSettings_module_css_default.hint,
						children: state.invalid ? "Enter a positive whole number." : hint
					})
				]
			});
		}
		function Chevron({ open }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				className: open ? `${DocumentAttachmentSettings_module_css_default.chevron} ${DocumentAttachmentSettings_module_css_default.chevronOpen}` : DocumentAttachmentSettings_module_css_default.chevron,
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
		function DocumentAttachmentSettingsCard(props) {
			const state = props.useAttachmentSettings((value) => value);
			const [open, setOpen] = (0, react.useState)(false);
			if (!state.available) return null;
			const disabled = !state.writable;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				className: `${DocumentAttachmentSettings_module_css_default.card}${open ? ` ${DocumentAttachmentSettings_module_css_default.cardOpen}` : ""}`,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					className: DocumentAttachmentSettings_module_css_default.header,
					type: "button",
					"aria-expanded": open,
					"aria-label": `${open ? "Collapse" : "Expand"} settings: Documents`,
					onClick: () => setOpen((value) => !value),
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: DocumentAttachmentSettings_module_css_default.headText,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: DocumentAttachmentSettings_module_css_default.name,
							children: "Documents"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: DocumentAttachmentSettings_module_css_default.description,
							children: "Analyse spreadsheets and read document text."
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Chevron, { open })]
				}), open && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: DocumentAttachmentSettings_module_css_default.body,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "Files stay with this chat. The agent reads document text on request and analyses original spreadsheet data." }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
							id: "documents-max-files",
							label: "Maximum files per message",
							hint: "Default: 5",
							state: state.maxFiles,
							disabled,
							edit: (value) => props.edit("maxFiles", value),
							reset: () => props.resetField("maxFiles")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
							id: "documents-max-file-bytes",
							label: "Maximum bytes per file",
							hint: "Default: 10 MB",
							state: state.maxBytesPerFile,
							disabled,
							edit: (value) => props.edit("maxBytesPerFile", value),
							reset: () => props.resetField("maxBytesPerFile")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
							id: "documents-max-total-bytes",
							label: "Maximum total upload bytes",
							hint: "Default: 50 MB",
							state: state.maxTotalBytes,
							disabled,
							edit: (value) => props.edit("maxTotalBytes", value),
							reset: () => props.resetField("maxTotalBytes")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: DocumentAttachmentSettings_module_css_default.footer,
							children: [
								state.failed && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: DocumentAttachmentSettings_module_css_default.failed,
									role: "status",
									children: "Could not save these limits."
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: DocumentAttachmentSettings_module_css_default.discard,
									type: "button",
									disabled: !state.dirty || state.saving,
									onClick: props.discard,
									children: "Discard"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: DocumentAttachmentSettings_module_css_default.save,
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
		//#region src/client/documentAttachments.ts
		const CHANNEL = "/soc-agent-config";
		function bytesToBase64(bytes) {
			let binary = "";
			const chunk = 32768;
			for (let offset = 0; offset < bytes.length; offset += chunk) binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
			return btoa(binary);
		}
		function settingsOf(scope) {
			return {
				...DEFAULT_DOCUMENT_ATTACHMENT_SETTINGS,
				...scope.getSnapshot().value ?? {}
			};
		}
		var DocumentAttachmentController = class {
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
			/** Abort pending uploads and release all browser-local draft state. */
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
				const cacheKey = JSON.stringify([limits.maxBytesPerFile]);
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
							investigation_id: sessionId,
							content_type: document.file.type,
							data: bytesToBase64(bytes),
							limits: { max_bytes: limits.maxBytesPerFile }
						}, localAbort.signal);
						if (!response?.ok) throw new Error(response?.error?.message || "The attachment upload failed.");
						const value = response.value;
						if (typeof value?.text !== "string") throw new Error("The upload returned no attachment reference.");
						if (!this.drafts.get(sessionId)?.has(id)) return;
						const attachment = {
							id,
							filename: typeof value.filename === "string" ? value.filename : document.file.name,
							markdown: value.text
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
				return ids.flatMap((id) => results.has(id) ? [results.get(id)] : []);
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
		//#region \0dsh-css:/Users/chankokpan/Documents/CITIC_AGENT/packages/soc-agent-attachments/src/client/Documents.module.css.mjs
		const css = ".F0Kb6a_rail{flex-wrap:wrap;gap:8px;padding:10px 12px 0;display:flex}.F0Kb6a_item{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);min-width:0;max-width:min(100%,360px);color:var(--dsw-alias-label-primary);border-radius:8px;align-items:center;gap:7px;padding:6px 8px;font-size:13px;line-height:20px;display:inline-flex}.F0Kb6a_icon{flex:none;font-size:14px;line-height:1}.F0Kb6a_name{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}.F0Kb6a_status{color:var(--dsw-alias-label-tertiary);white-space:nowrap;flex:none;font-size:12px}.F0Kb6a_remove{width:20px;height:20px;color:var(--dsw-alias-label-tertiary);font:inherit;cursor:pointer;background:0 0;border:0;border-radius:50%;flex:none;padding:0;font-size:18px;line-height:18px}.F0Kb6a_remove:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.F0Kb6a_remove:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}";
		const tagId = "dsh-soc-agent-attachments/Documents.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-soc-agent-attachments";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var Documents_module_css_default = {
			"icon": "F0Kb6a_icon",
			"item": "F0Kb6a_item",
			"name": "F0Kb6a_name",
			"rail": "F0Kb6a_rail",
			"remove": "F0Kb6a_remove",
			"status": "F0Kb6a_status"
		};
		//#endregion
		//#region src/client/Documents.tsx
		function statusText(document, converting) {
			if (document.status === "failed") return document.error ?? "Upload failed";
			if (converting || document.status === "converting") return "Uploading…";
			if (document.status === "converted") return "Attached";
			return "Queued";
		}
		function Documents(props) {
			const { controller, sessionId } = props;
			(0, react.useSyncExternalStore)(controller.subscribe, controller.getVersion, controller.getVersion);
			if (sessionId === void 0) return null;
			const documents = controller.list(sessionId, props.documents.map((document) => document.id));
			const pickerId = `soc-agent-file-picker-${sessionId}`;
			if (documents.length === 0 && !props.canAcceptDocuments) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: Documents_module_css_default.rail,
				"aria-label": "Attached files",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
					id: pickerId,
					type: "file",
					multiple: true,
					hidden: true,
					onChange: (event) => {
						const files = [...event.currentTarget.files ?? []];
						event.currentTarget.value = "";
						if (files.length > 0 && props.canAcceptDocuments) props.onAddDocuments(files);
					}
				}), documents.map((document) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: Documents_module_css_default.item,
					title: document.error,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: Documents_module_css_default.icon,
							"aria-hidden": "true",
							children: "📎"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: Documents_module_css_default.name,
							children: document.file.name
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: Documents_module_css_default.status,
							children: statusText(document, props.phase === "submitting")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: Documents_module_css_default.remove,
							type: "button",
							"aria-label": `Remove ${document.file.name}`,
							onClick: () => props.onRemoveDocument(document.id),
							children: "×"
						})
					]
				}, document.id))]
			});
		}
		function openDocumentPicker(sessionId) {
			const input = document.getElementById(`soc-agent-file-picker-${sessionId}`);
			if (input instanceof HTMLInputElement) input.click();
		}
		//#endregion
		//#region src/client/index.ts
		/** Optional on-demand attachment/document feature. */
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
			const documents = new DocumentAttachmentController(ctx.get("connection"), ctx.settingsScope.bind({ namespace: DOCUMENT_ATTACHMENTS_NAMESPACE }));
			const settings = new AttachmentSettingsController(ctx.settingsScope.bind({ namespace: DOCUMENT_ATTACHMENTS_NAMESPACE }));
			ctx.effect(() => {
				const disposeProvider = ctx.conversation.registerDocumentProvider(documents);
				return () => {
					disposeProvider();
					documents.dispose();
				};
			}, "soc-agent-attachments: on-demand document provider");
			ctx.slots.inject("conversation.input.documents", () => ctx.slots.register({
				name: "conversation.input.documents",
				locale: "conversation"
			}, (props) => react.default.createElement(Documents, {
				...props,
				controller: documents
			})));
			ctx.effect(() => ctx.commandUi.register({
				name: "attach-file",
				description: "Attach file",
				available: () => true,
				ui: {
					kind: "action",
					options: async () => [],
					onSelect: (_option, session) => {
						openDocumentPicker(session.sessionId);
					}
				}
			}), "soc-agent-attachments: file command");
			ctx.slots.inject("settings.plugin.item", () => ctx.slots.register({
				name: "settings.plugin.item",
				key: DOCUMENT_ATTACHMENTS_NAMESPACE,
				inject: () => settings.inject()
			}, DocumentAttachmentSettingsCard));
			ctx.effect(() => () => settings.dispose(), "soc-agent-attachments: settings controller");
		}
		//#endregion
		exports.AttachmentSettingsController = AttachmentSettingsController;
		exports.DEFAULT_DOCUMENT_ATTACHMENT_SETTINGS = DEFAULT_DOCUMENT_ATTACHMENT_SETTINGS;
		exports.DOCUMENT_ATTACHMENTS_NAMESPACE = DOCUMENT_ATTACHMENTS_NAMESPACE;
		exports.DocumentAttachmentController = DocumentAttachmentController;
		exports.DocumentAttachmentSettingsCard = DocumentAttachmentSettingsCard;
		exports.Documents = Documents;
		exports.apply = apply;
		exports.inject = inject;
		exports.openDocumentPicker = openDocumentPicker;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map