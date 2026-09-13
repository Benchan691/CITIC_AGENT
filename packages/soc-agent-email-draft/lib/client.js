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
		const css = ".a5LXvW_card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-surface-l1,transparent);border-radius:10px;margin:6px 0;overflow:hidden}.a5LXvW_header{background:var(--dsw-alias-surface-l2,transparent);justify-content:space-between;align-items:center;gap:12px;padding:10px 12px;display:flex}.a5LXvW_title{font-weight:600}.a5LXvW_account{color:var(--dsw-alias-text-l2);font-size:12px}.a5LXvW_content{gap:9px;padding:12px;display:grid}.a5LXvW_field{gap:4px;display:grid}.a5LXvW_label{color:var(--dsw-alias-text-l2);font-size:12px;font-weight:600}.a5LXvW_input,.a5LXvW_textarea{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-surface-l0,transparent);width:100%;color:inherit;font:inherit;border-radius:6px;padding:8px 9px}.a5LXvW_textarea{resize:vertical;min-height:180px;line-height:1.45}.a5LXvW_input:focus,.a5LXvW_textarea:focus{outline:2px solid var(--dsw-alias-primary,currentColor);outline-offset:1px}.a5LXvW_actions{justify-content:flex-end;gap:8px;padding-top:3px;display:flex}.a5LXvW_signaturePanel{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-surface-l2,transparent);border-radius:8px;gap:9px;padding:10px;display:grid}.a5LXvW_button{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-surface-l2,transparent);color:inherit;cursor:pointer;font:inherit;border-radius:6px;padding:7px 12px}.a5LXvW_primary{color:var(--dsw-alias-on-primary,#fff);background:#2563eb;border-color:#2563eb}.a5LXvW_primary:hover{background:#1d4ed8;border-color:#1d4ed8}.a5LXvW_danger{color:#fff;background:#dc2626;border-color:#dc2626}.a5LXvW_danger:hover{background:#b91c1c;border-color:#b91c1c}.a5LXvW_signatureButton{color:#fff;background:#7c3aed;border-color:#7c3aed}.a5LXvW_signatureButton:hover{background:#6d28d9;border-color:#6d28d9}.a5LXvW_button:disabled{cursor:wait;opacity:.6}.a5LXvW_message{color:var(--dsw-alias-text-l2);padding:10px 12px;font-size:13px}.a5LXvW_error{color:var(--dsw-alias-danger,#b42318)}";
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
			"button": "a5LXvW_button",
			"card": "a5LXvW_card",
			"content": "a5LXvW_content",
			"danger": "a5LXvW_danger",
			"error": "a5LXvW_error",
			"field": "a5LXvW_field",
			"header": "a5LXvW_header",
			"input": "a5LXvW_input",
			"label": "a5LXvW_label",
			"message": "a5LXvW_message",
			"primary": "a5LXvW_primary",
			"signatureButton": "a5LXvW_signatureButton",
			"signaturePanel": "a5LXvW_signaturePanel",
			"textarea": "a5LXvW_textarea",
			"title": "a5LXvW_title"
		};
		//#endregion
		//#region src/client/emailDraft.ts
		const ZIMBRA_DRAFT_TOOL_NAME = "mcp__soc_agent__zimbra_send_email";
		const ZIMBRA_FORWARD_DRAFT_TOOL_NAME = "mcp__soc_agent__zimbra_forward_email";
		const ZIMBRA_SIGNATURE_DRAFT_TOOL_NAME = "mcp__soc_agent__zimbra_use_signature_on_email";
		function parseRecipientText(value) {
			return [...new Set(value.split(/[\n,;]/).map((item) => item.trim()).filter(Boolean))];
		}
		function draftFromForm(fields, forwardMessageId) {
			return {
				to: parseRecipientText(fields.to),
				cc: parseRecipientText(fields.cc),
				bcc: parseRecipientText(fields.bcc),
				subject: fields.subject.trim(),
				body: fields.body,
				...forwardMessageId === void 0 ? {} : { forward_message_id: forwardMessageId }
			};
		}
		//#endregion
		//#region src/client/EmailDraftToolview.tsx
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
		function errorMessage(envelope) {
			const error = envelope?.error;
			if (typeof error === "object" && error !== null && "message" in error) {
				const message = error.message;
				if (typeof message === "string" && message) return message;
			}
			return typeof error === "string" && error ? error : null;
		}
		function EmailDraftToolview({ block, socClient }) {
			const envelope = (0, react.useMemo)(() => parseEnvelope(block), [block]);
			const sourceKey = (0, react.useMemo)(() => JSON.stringify(envelope?.draft ?? null), [envelope]);
			const [fields, setFields] = (0, react.useState)(() => envelope ? formFromEnvelope(envelope) : {
				to: "",
				cc: "",
				bcc: "",
				subject: "",
				body: ""
			});
			const [status, setStatus] = (0, react.useState)("editing");
			const [sendError, setSendError] = (0, react.useState)(null);
			const [bodyFormat, setBodyFormat] = (0, react.useState)(envelope?.draft.body_format === "html" ? "html" : "text");
			const [signaturePanel, setSignaturePanel] = (0, react.useState)(false);
			const [signatures, setSignatures] = (0, react.useState)([]);
			const [signatureId, setSignatureId] = (0, react.useState)("");
			const [signatureFormat, setSignatureFormat] = (0, react.useState)("text");
			const [signaturePlacement, setSignaturePlacement] = (0, react.useState)("below");
			const [signatureStatus, setSignatureStatus] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				if (envelope?.draft) {
					setFields(formFromEnvelope(envelope));
					setStatus("editing");
					setSendError(null);
					setBodyFormat(envelope.draft.body_format === "html" ? "html" : "text");
					setSignaturePanel(false);
					setSignatureStatus(null);
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
						onClick: () => {
							setFields(envelope ? formFromEnvelope(envelope) : fields);
							setStatus("editing");
						},
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
			const forwardMessageId = envelope?.draft.forward_message_id;
			const forwardedMessage = envelope?.draft.forwarded_message;
			const submit = async () => {
				const draft = draftFromForm(fields, forwardMessageId);
				if (draft.to.length === 0) {
					setSendError("Add at least one To recipient.");
					return;
				}
				if (!draft.subject) {
					setSendError("Subject cannot be empty.");
					return;
				}
				if (typeof window !== "undefined" && !window.confirm(forwardMessageId ? "Forward this email with the original message and all its attachments now?" : "Send this email now?")) return;
				setStatus("sending");
				setSendError(null);
				try {
					if ((await socClient.rpc("send-email", {
						...draft,
						body_format: bodyFormat
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
				const value = signatures.find((item) => item.id === signatureId)?.[signatureFormat];
				if (!value) {
					setSignatureStatus(`The selected signature has no ${signatureFormat} content.`);
					return;
				}
				const separator = signatureFormat === "html" ? "<br><br>" : "\n\n";
				setFields((current) => ({
					...current,
					body: signaturePlacement === "above" && current.body ? `${value}${separator}${current.body}` : current.body ? `${current.body}${separator}${value}` : value
				}));
				setBodyFormat(signatureFormat);
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
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: EmailDraftToolview_module_css_default.title,
						children: forwardMessageId ? "Forward email" : "Email draft"
					}) })
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
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: EmailDraftToolview_module_css_default.field,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: EmailDraftToolview_module_css_default.label,
								children: forwardMessageId ? "Your message (optional)" : "Body"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
								className: EmailDraftToolview_module_css_default.textarea,
								"aria-label": "Body",
								value: fields.body,
								onChange: update("body"),
								maxLength: 18e3
							})]
						}),
						forwardMessageId && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: EmailDraftToolview_module_css_default.field,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: EmailDraftToolview_module_css_default.label,
									children: "Original message and all attachments will be included."
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", { children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: forwardedMessage?.subject || "Original message" }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
										forwardedMessage?.from,
										" ",
										forwardedMessage?.date
									] }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
										className: EmailDraftToolview_module_css_default.textarea,
										"aria-label": "Original message preview",
										value: forwardedMessage?.body || "",
										readOnly: true
									}),
									forwardedMessage?.body_truncated && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: "Preview shortened; the full original message will be forwarded." })
								] }),
								forwardedMessage?.attachments?.map((attachment) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: attachment.filename || "Unnamed attachment" }, attachment.part))
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
										children: "Format"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
										className: EmailDraftToolview_module_css_default.input,
										"aria-label": "Signature format",
										value: signatureFormat,
										onChange: (event) => setSignatureFormat(event.target.value),
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: "text",
											children: "Plain text"
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: "html",
											children: "HTML"
										})]
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
									onClick: () => {
										setStatus("discarded");
									},
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
				for (const key of [
					ZIMBRA_DRAFT_TOOL_NAME,
					ZIMBRA_FORWARD_DRAFT_TOOL_NAME,
					ZIMBRA_SIGNATURE_DRAFT_TOOL_NAME
				]) ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({
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
		exports.EmailDraftToolview = EmailDraftToolview;
		exports.ZIMBRA_DRAFT_TOOL_NAME = ZIMBRA_DRAFT_TOOL_NAME;
		exports.ZIMBRA_FORWARD_DRAFT_TOOL_NAME = ZIMBRA_FORWARD_DRAFT_TOOL_NAME;
		exports.ZIMBRA_SIGNATURE_DRAFT_TOOL_NAME = ZIMBRA_SIGNATURE_DRAFT_TOOL_NAME;
		exports.apply = apply;
		exports.draftFromForm = draftFromForm;
		exports.emailDraftToolview = emailDraftToolview;
		exports.inject = inject;
		exports.parseRecipientText = parseRecipientText;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map