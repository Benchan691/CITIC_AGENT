window.__ModuleLoader__.load({
	id: "dsh-soc-agent-reports",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		//#region src/report-contract.ts
		const REPORT_CHANNEL = "/soc-agent-reports";
		const REPORT_TOOL_NAME = "mcp__soc_agent__generate_customer_report";
		const REPORT_DOWNLOAD_PREFIX = `${REPORT_CHANNEL}/download/`;
		const ARTIFACT_ID = /^(?:[a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/iu;
		const SESSION_ID = /^[A-Za-z0-9_-]{1,128}$/u;
		function record(value) {
			return typeof value === "object" && value !== null && !Array.isArray(value);
		}
		function nonempty(value) {
			return typeof value === "string" && value.trim().length > 0;
		}
		function emptyCustomerProfile(account) {
			return {
				customer_id: "",
				display_name: "",
				report_id: "",
				company_name: "",
				email: {
					account,
					scope_type: "folder",
					scope: "",
					include_subfolders: false
				},
				customer_senders: [],
				report: {
					template: {
						owner: "",
						app: "",
						view: ""
					},
					output_stem: ""
				},
				news: {
					scope_type: "folder",
					scope: "",
					source_labels: ["Source collection", "来源集合"],
					source_terms: ["hkcert"],
					scan_limit: 500
				},
				extensions: {}
			};
		}
		/** Browser validation is explanatory; the backend remains authoritative. */
		function validateCustomerProfiles(customers, account) {
			if (!nonempty(account)) return "Sign in to configure customer reports.";
			const ids = /* @__PURE__ */ new Set();
			for (const [index, customer] of customers.entries()) {
				const label = customer.display_name || `Customer ${index + 1}`;
				if (![
					customer.customer_id,
					customer.display_name,
					customer.report_id,
					customer.company_name
				].every(nonempty)) return `${label}: enter the customer ID, display name, report ID, and company name.`;
				if (!/^[A-Za-z0-9_-]{1,128}$/u.test(customer.customer_id)) return `${label}: use letters, numbers, underscores, or hyphens in the customer ID.`;
				if (ids.has(customer.customer_id)) return `${label}: each customer ID must be unique.`;
				ids.add(customer.customer_id);
				if (customer.email.account.trim().toLowerCase() !== account.trim().toLowerCase()) return `${label}: the email account must match your signed-in account.`;
				if (!nonempty(customer.email.scope)) return `${label}: enter the report email folder or label.`;
				if (!["folder", "label"].includes(customer.email.scope_type)) return `${label}: choose a folder or label.`;
				if (![
					customer.report.template.owner,
					customer.report.template.app,
					customer.report.template.view
				].every(nonempty)) return `${label}: enter the Splunk dashboard owner, app, and view.`;
				if (!nonempty(customer.news.scope)) return `${label}: enter the security news folder or label.`;
				if (!["folder", "label"].includes(customer.news.scope_type)) return `${label}: choose a news folder or label.`;
				if (!Number.isInteger(customer.news.scan_limit) || customer.news.scan_limit < 1 || customer.news.scan_limit > 2e3) return `${label}: the news scan limit must be between 1 and 2,000.`;
				if (!record(customer.extensions)) return `${label}: additional settings must be a JSON object.`;
			}
			return null;
		}
		function validArtifactType(filename, mime) {
			if (typeof filename !== "string" || !filename || filename.length > 255 || /[\u0000-\u001f\u007f/\\]/u.test(filename)) return false;
			return mime === "application/pdf" && /\.pdf$/iu.test(filename) || mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" && /\.xlsx$/iu.test(filename);
		}
		/** Admit only authenticated local report URLs, never URLs supplied by email. */
		function validReportArtifact(value) {
			if (!record(value) || typeof value.id !== "string" || !ARTIFACT_ID.test(value.id) || !validArtifactType(value.filename, value.mime_type)) return false;
			if (!Number.isSafeInteger(value.size_bytes) || value.size_bytes <= 0) return false;
			if (typeof value.download_url !== "string" || !value.download_url.startsWith(`${REPORT_DOWNLOAD_PREFIX}${value.id}?`)) return false;
			try {
				const url = new URL(value.download_url, "http://dsh.internal");
				const session = url.searchParams.get("session_id");
				return url.origin === "http://dsh.internal" && url.pathname === `${REPORT_DOWNLOAD_PREFIX}${value.id}` && !url.hash && session !== null && SESSION_ID.test(session) && [...url.searchParams.keys()].length === 1;
			} catch {
				return false;
			}
		}
		/** MCP text is an envelope; artifacts must form one complete PDF/Excel pair. */
		function reportPanelResult(block) {
			if (!record(block) || !("kind" in block) || !Array.isArray(block.content)) return { kind: "working" };
			const text = block.content.filter(record).filter((item) => item.type === "text" && typeof item.text === "string").map((item) => item.text).join("");
			try {
				const start = text.indexOf("{");
				const envelope = JSON.parse(start < 0 ? text : text.slice(start));
				if (!record(envelope)) return {
					kind: "error",
					message: "The report tool returned an invalid result."
				};
				if (envelope.ok === false) {
					const error = envelope.error;
					return {
						kind: "error",
						message: record(error) && nonempty(error.message) ? error.message : "Report generation failed."
					};
				}
				const data = envelope.data;
				const artifacts = record(data) ? data.artifacts : void 0;
				if (block.isError === true || envelope.ok !== true || !Array.isArray(artifacts) || artifacts.length !== 2 || !artifacts.every(validReportArtifact) || new Set(artifacts.map((item) => item.mime_type)).size !== 2 || new Set(artifacts.map((item) => item.id)).size !== 2) return {
					kind: "error",
					message: "The report tool did not return a valid Excel and PDF pair."
				};
				return {
					kind: "success",
					artifacts
				};
			} catch {
				return {
					kind: "error",
					message: "The report tool returned an unreadable result. Check the generation error."
				};
			}
		}
		//#endregion
		//#region \0dsh-css:/Users/chankokpan/Documents/CITIC_AGENT/packages/soc-agent-reports/src/client/Reports.module.css.mjs
		const css = ".ohZIda_settings,.ohZIda_reportPanel{color:var(--color-text-primary,inherit);padding:16px}.ohZIda_settings h2,.ohZIda_settings h3,.ohZIda_reportPanel p{margin:0 0 12px}.ohZIda_settings h3{margin-top:16px;font-size:14px}.ohZIda_settings p{line-height:1.5}.ohZIda_form{border:0;min-width:0;margin:16px 0;padding:0}.ohZIda_form legend{margin-bottom:12px;font-size:14px;font-weight:600}.ohZIda_grid{grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;display:grid}.ohZIda_field{flex-direction:column;gap:6px;margin:0 0 12px;font-size:13px;display:flex}.ohZIda_field input,.ohZIda_field select,.ohZIda_field textarea{box-sizing:border-box;border:1px solid var(--color-border,#88909b);width:100%;font:inherit;background:var(--color-bg-primary,transparent);color:inherit;border-radius:6px;padding:8px}.ohZIda_field textarea{resize:vertical}.ohZIda_checkbox{align-items:center;gap:8px;margin-bottom:12px;font-size:13px;display:flex}.ohZIda_customerBar,.ohZIda_actions{flex-wrap:wrap;align-items:end;gap:10px;display:flex}.ohZIda_customerBar>.ohZIda_field{flex:1;min-width:200px;margin:0}.ohZIda_settings button{border:1px solid var(--color-border,#88909b);cursor:pointer;color:inherit;background:var(--color-bg-secondary,transparent);font:inherit;border-radius:6px;padding:8px 12px}.ohZIda_settings button:disabled{cursor:default;opacity:.55}.ohZIda_error{color:var(--color-error,#d54343)}.ohZIda_reportPanel{border:1px solid var(--color-border,#88909b);border-radius:10px;margin:8px 0}.ohZIda_reportPanel strong{margin-bottom:8px;display:block}.ohZIda_downloads{flex-wrap:wrap;gap:10px;display:flex}.ohZIda_download{border:1px solid var(--color-border,#88909b);color:var(--color-link,#3b82f6);border-radius:6px;flex-direction:column;gap:4px;max-width:100%;padding:10px 12px;text-decoration:none;display:flex}.ohZIda_download:hover{text-decoration:underline}.ohZIda_download small{overflow-wrap:anywhere;font-size:11px}";
		const tagId = "dsh-soc-agent-reports/Reports.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-soc-agent-reports";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var Reports_module_css_default = {
			"actions": "ohZIda_actions",
			"checkbox": "ohZIda_checkbox",
			"customerBar": "ohZIda_customerBar",
			"download": "ohZIda_download",
			"downloads": "ohZIda_downloads",
			"error": "ohZIda_error",
			"field": "ohZIda_field",
			"form": "ohZIda_form",
			"grid": "ohZIda_grid",
			"reportPanel": "ohZIda_reportPanel",
			"settings": "ohZIda_settings"
		};
		//#endregion
		//#region src/client/ReportArtifacts.tsx
		function ReportArtifacts({ block }) {
			const result = reportPanelResult(block);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: Reports_module_css_default.reportPanel,
				"aria-label": "Customer report files",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "Customer report" }),
					result.kind === "working" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						role: "status",
						children: "Preparing the Excel and PDF report…"
					}),
					result.kind === "error" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: Reports_module_css_default.error,
						role: "alert",
						children: result.message
					}),
					result.kind === "success" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "Your report files are ready." }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: Reports_module_css_default.downloads,
						children: result.artifacts.map((artifact) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("a", {
							className: Reports_module_css_default.download,
							href: artifact.download_url,
							download: artifact.filename,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: artifact.mime_type === "application/pdf" ? "Download PDF" : "Download Excel" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("small", { children: [
								artifact.filename,
								" · ",
								(artifact.size_bytes / 1024).toFixed(0),
								" KB"
							] })]
						}, artifact.id))
					})] })
				]
			});
		}
		//#endregion
		//#region src/client/ReportSettings.tsx
		function TextField({ label, value, onChange, multiline = false }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: Reports_module_css_default.field,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: label }), multiline ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
					value,
					onChange: (event) => onChange(event.target.value),
					rows: 4
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
					value,
					onChange: (event) => onChange(event.target.value)
				})]
			});
		}
		function list(value) {
			return value.split(/[\n,;]/u).map((item) => item.trim()).filter(Boolean);
		}
		function ListField({ label, values, onChange, multiline = false }) {
			const [text, setText] = (0, react.useState)(values.join(multiline ? "\n" : ", "));
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TextField, {
				label,
				value: text,
				multiline,
				onChange: (value) => {
					setText(value);
					onChange(list(value));
				}
			});
		}
		async function rpc(connection, endpoint, payload, signal) {
			const result = await connection.rpc.call(REPORT_CHANNEL, endpoint, payload, signal);
			if (!result.ok) throw new Error(result.error.message);
			const settings = result.value;
			if (!settings || !Array.isArray(settings.customers) || typeof settings.account !== "string") throw new Error("The customer settings response is invalid.");
			return settings;
		}
		/** User-scoped report profiles use their own authenticated settings channel. */
		function CustomerReportSettingsCard({ connection }) {
			const [customers, setCustomers] = (0, react.useState)([]);
			const [account, setAccount] = (0, react.useState)("");
			const [selected, setSelected] = (0, react.useState)(0);
			const [status, setStatus] = (0, react.useState)("loading");
			const [error, setError] = (0, react.useState)(null);
			const [notice, setNotice] = (0, react.useState)("");
			const [extensions, setExtensions] = (0, react.useState)("{}");
			const [extensionsError, setExtensionsError] = (0, react.useState)(null);
			const [reload, setReload] = (0, react.useState)(0);
			(0, react.useEffect)(() => {
				const controller = new AbortController();
				setStatus("loading");
				setError(null);
				rpc(connection, "get-customer-settings", {}, controller.signal).then((settings) => {
					setCustomers(settings.customers);
					setAccount(settings.account);
					setSelected(0);
					setExtensions(JSON.stringify(settings.customers[0]?.extensions ?? {}, null, 2));
					setExtensionsError(null);
					setStatus("ready");
				}).catch((reason) => {
					if (!controller.signal.aborted) {
						setError(reason instanceof Error ? reason.message : "Could not load customer settings.");
						setStatus("failed");
					}
				});
				return () => controller.abort();
			}, [connection, reload]);
			const customer = customers[selected];
			(0, react.useEffect)(() => {
				setExtensions(JSON.stringify(customer?.extensions ?? {}, null, 2));
				setExtensionsError(null);
			}, [
				selected,
				customer?.customer_id,
				reload
			]);
			function edit(update) {
				setCustomers((values) => values.map((value, index) => index === selected ? update(value) : value));
				setNotice("");
				setError(null);
			}
			function core(field, value) {
				edit((current) => ({
					...current,
					[field]: value
				}));
			}
			function reportText(field, value) {
				edit((current) => {
					const report = { ...current.report };
					if (value) report[field] = value;
					else delete report[field];
					return {
						...current,
						report
					};
				});
			}
			function changeExtensions(text) {
				setExtensions(text);
				try {
					const value = JSON.parse(text);
					if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Enter a JSON object for additional settings.");
					edit((current) => ({
						...current,
						extensions: value
					}));
					setExtensionsError(null);
				} catch {
					setExtensionsError("Additional settings must be a valid JSON object.");
				}
			}
			async function save() {
				const invalid = extensionsError ?? validateCustomerProfiles(customers, account);
				if (invalid) {
					setError(invalid);
					return;
				}
				setStatus("saving");
				setError(null);
				setNotice("");
				try {
					const settings = await rpc(connection, "save-customer-settings", { customers });
					setCustomers(settings.customers);
					setAccount(settings.account);
					setExtensions(JSON.stringify(settings.customers[selected]?.extensions ?? {}, null, 2));
					setStatus("ready");
					setNotice("Customer report settings saved.");
				} catch (reason) {
					setError(reason instanceof Error ? reason.message : "Could not save customer settings.");
					setStatus("ready");
				}
			}
			const busy = status === "loading" || status === "saving";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: Reports_module_css_default.settings,
				"aria-label": "Customer report settings",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", { children: "Customer reports" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "Choose the email folder or label and report settings for each customer. Reports use your signed-in email account." }),
					status === "loading" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						role: "status",
						children: "Loading your customer settings…"
					}),
					error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: Reports_module_css_default.error,
						role: "alert",
						children: error
					}),
					notice && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						role: "status",
						children: notice
					}),
					status === "failed" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setReload((value) => value + 1),
						children: "Retry"
					}),
					status !== "loading" && status !== "failed" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: Reports_module_css_default.customerBar,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: Reports_module_css_default.field,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "Customer" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
										value: selected,
										disabled: busy || !customers.length,
										onChange: (event) => setSelected(Number(event.target.value)),
										children: customers.map((value, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: index,
											children: value.display_name || `Customer ${index + 1}`
										}, index))
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									disabled: busy,
									onClick: () => {
										setCustomers((values) => [...values, emptyCustomerProfile(account)]);
										setSelected(customers.length);
										setExtensions("{}");
										setNotice("");
									},
									children: "Add customer"
								}),
								customer && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									disabled: busy,
									onClick: () => {
										setCustomers((values) => values.filter((_value, index) => index !== selected));
										setSelected(0);
										setNotice("");
									},
									children: "Remove customer"
								})
							]
						}),
						customer ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("fieldset", {
							disabled: busy,
							className: Reports_module_css_default.form,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("legend", { children: "Customer configuration" }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: Reports_module_css_default.grid,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TextField, {
											label: "Customer ID",
											value: customer.customer_id,
											onChange: (value) => core("customer_id", value)
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TextField, {
											label: "Display name",
											value: customer.display_name,
											onChange: (value) => core("display_name", value)
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TextField, {
											label: "Report ID",
											value: customer.report_id,
											onChange: (value) => core("report_id", value)
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TextField, {
											label: "Company name",
											value: customer.company_name,
											onChange: (value) => core("company_name", value)
										})
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: "Report emails" }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TextField, {
									label: "Email account",
									value: customer.email.account,
									onChange: (value) => edit((current) => ({
										...current,
										email: {
											...current.email,
											account: value
										}
									}))
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: Reports_module_css_default.grid,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										className: Reports_module_css_default.field,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "Folder or label" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
											value: customer.email.scope_type,
											onChange: (event) => edit((current) => ({
												...current,
												email: {
													...current.email,
													scope_type: event.target.value
												}
											})),
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
												value: "folder",
												children: "Folder"
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
												value: "label",
												children: "Label"
											})]
										})]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TextField, {
										label: "Folder path or label",
										value: customer.email.scope,
										onChange: (value) => edit((current) => ({
											...current,
											email: {
												...current.email,
												scope: value
											}
										}))
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: Reports_module_css_default.checkbox,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										checked: customer.email.include_subfolders,
										onChange: (event) => edit((current) => ({
											...current,
											email: {
												...current.email,
												include_subfolders: event.target.checked
											}
										}))
									}), "Include subfolders"]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ListField, {
									label: "Customer sender addresses (one per line)",
									values: customer.customer_senders,
									multiline: true,
									onChange: (values) => edit((current) => ({
										...current,
										customer_senders: values
									}))
								}, `senders-${customer.customer_id}-${selected}-${reload}`),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: "Splunk dashboard" }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: Reports_module_css_default.grid,
									children: [[
										"owner",
										"app",
										"view"
									].map((field) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TextField, {
										label: field === "view" ? "Dashboard view" : field === "app" ? "App" : "Owner",
										value: customer.report.template[field],
										onChange: (value) => edit((current) => ({
											...current,
											report: {
												...current.report,
												template: {
													...current.report.template,
													[field]: value
												}
											}
										}))
									}, field)), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TextField, {
										label: "Output filename stem (optional)",
										value: customer.report.output_stem ?? "",
										onChange: (value) => edit((current) => ({
											...current,
											report: {
												...current.report,
												output_stem: value
											}
										}))
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: "Security news" }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: Reports_module_css_default.grid,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
											className: Reports_module_css_default.field,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "News folder or label" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
												value: customer.news.scope_type,
												onChange: (event) => edit((current) => ({
													...current,
													news: {
														...current.news,
														scope_type: event.target.value
													}
												})),
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
													value: "folder",
													children: "Folder"
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
													value: "label",
													children: "Label"
												})]
											})]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TextField, {
											label: "News folder path or label",
											value: customer.news.scope,
											onChange: (value) => edit((current) => ({
												...current,
												news: {
													...current.news,
													scope: value
												}
											}))
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ListField, {
											label: "News source terms",
											values: customer.news.source_terms,
											onChange: (values) => edit((current) => ({
												...current,
												news: {
													...current.news,
													source_terms: values
												}
											}))
										}, `terms-${customer.customer_id}-${selected}-${reload}`),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ListField, {
											label: "News source labels",
											values: customer.news.source_labels,
											onChange: (values) => edit((current) => ({
												...current,
												news: {
													...current.news,
													source_labels: values
												}
											}))
										}, `labels-${customer.customer_id}-${selected}-${reload}`),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
											className: Reports_module_css_default.field,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "Maximum news messages" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												type: "number",
												min: 1,
												max: 2e3,
												value: customer.news.scan_limit,
												onChange: (event) => edit((current) => ({
													...current,
													news: {
														...current.news,
														scan_limit: Number(event.target.value)
													}
												}))
											})]
										})
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", { children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: "Report text and additional settings" }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TextField, {
										label: "Executive summary HTML (optional)",
										value: customer.report.executive_summary_html ?? "",
										multiline: true,
										onChange: (value) => reportText("executive_summary_html", value)
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TextField, {
										label: "Security analysis HTML (optional)",
										value: customer.report.security_analysis_html ?? "",
										multiline: true,
										onChange: (value) => reportText("security_analysis_html", value)
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TextField, {
										label: "Additional customer settings (JSON)",
										value: extensions,
										multiline: true,
										onChange: changeExtensions
									}),
									extensionsError && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: Reports_module_css_default.error,
										role: "alert",
										children: extensionsError
									})
								] })
							]
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "Add a customer to configure a report." }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: Reports_module_css_default.actions,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								disabled: busy,
								onClick: () => setReload((value) => value + 1),
								children: "Reload saved settings"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								disabled: busy || Boolean(extensionsError),
								onClick: () => {
									save();
								},
								children: status === "saving" ? "Saving…" : "Save customer settings"
							})]
						})
					] })
				]
			});
		}
		//#endregion
		//#region src/client/index.ts
		const inject = [
			"slots",
			"connection",
			"socClient"
		];
		function apply(ctx) {
			if (ctx.get("socClient").surface !== "workspace") return;
			const connection = ctx.get("connection");
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "customer-reports",
				order: 18,
				label: () => "Customer reports",
				inject: () => ({ connection })
			}, CustomerReportSettingsCard));
			ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({
				name: "tool.call.toolview",
				key: REPORT_TOOL_NAME
			}, ReportArtifacts));
		}
		//#endregion
		exports.CustomerReportSettingsCard = CustomerReportSettingsCard;
		exports.ReportArtifacts = ReportArtifacts;
		exports.apply = apply;
		exports.inject = inject;
		exports.reportPanelResult = reportPanelResult;
		exports.validReportArtifact = validReportArtifact;
		exports.validateCustomerProfiles = validateCustomerProfiles;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map