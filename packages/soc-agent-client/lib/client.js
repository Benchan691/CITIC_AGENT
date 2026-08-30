window.__ModuleLoader__.load({
	id: "dsh-soc-agent-client",
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
		let _deepseek_ai_dsh_client_runtime_client = require("@deepseek-ai/dsh-client-runtime/client");
		//#region \0dsh-css:/Users/chankokpan/Documents/CITIC_AGENT/packages/soc-agent-client/src/client/CiticBrand.module.css.mjs
		const css$7 = ".U2KmSq_wordmark{text-overflow:ellipsis;white-space:nowrap;letter-spacing:.08em;align-items:center;min-width:0;max-width:100%;font-size:16px;font-weight:700;line-height:24px;display:inline-flex;overflow:hidden}";
		const tagId$7 = "dsh-soc-agent-client/CiticBrand.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$7) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-soc-agent-client";
			tag.dataset.pluginCss = tagId$7;
			tag.textContent = css$7;
			document.head.appendChild(tag);
		}
		var CiticBrand_module_css_default = { "wordmark": "U2KmSq_wordmark" };
		//#endregion
		//#region src/client/CiticBrand.tsx
		/** CITIC Telecom CPC's red emblem, adapted from the official logo artwork. */
		function CiticBrandMark({ size, className }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				width: size,
				height: size,
				viewBox: "80 160 18 18",
				className,
				fill: "none",
				"aria-hidden": "true",
				focusable: "false",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("g", {
					transform: "translate(-80.898923,-160.69617)",
					fill: "#d70010",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("g", {
							transform: "matrix(0.35277777,0,0,-0.35277777,93.64196,167.46844)",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m 0,0 c 0,9.347 -7.577,16.93 -16.928,16.93 -9.349,0 -16.928,-7.583 -16.928,-16.93 0,-9.347 7.579,-16.925 16.928,-16.925 C -7.577,-16.925 0,-9.347 0,0 M -16.928,18.447 C -6.74,18.447 1.52,10.189 1.52,0 c 0,-10.187 -8.26,-18.442 -18.448,-18.442 -10.184,0 -18.444,8.255 -18.444,18.442 0,10.189 8.26,18.447 18.444,18.447" })
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("g", {
							transform: "matrix(0.35277777,0,0,-0.35277777,89.825999,163.10352)",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m 0,0 c 0.714,0.405 1.001,1.258 -0.056,1.78 -1.496,0.743 -3.981,1.29 -6.055,1.29 -2.288,0 -4.61,-0.408 -6.247,-1.312 -0.89,-0.488 -0.825,-1.333 0.133,-1.78 1.008,-0.476 3.829,-1.892 3.829,-5.314 l 0.044,-22.315 c 0.732,-0.104 1.479,-0.165 2.241,-0.165 0.735,0 1.46,0.058 2.168,0.155 L -3.9,-5.336 c 0,3.422 3.063,4.862 3.9,5.336" })
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("g", {
							transform: "matrix(0.35277777,0,0,-0.35277777,90.08078,163.61855)",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m 0,0 c -2.713,-0.619 -3.116,-3.182 -3.116,-3.949 v -21.926 c 1.087,0.267 2.132,0.629 3.116,1.11 z" })
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("g", {
							transform: "matrix(0.35277777,0,0,-0.35277777,92.09496,168.53023)",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m 0,0 c 0,0 -0.472,-0.815 -0.915,0.316 -0.521,1.455 -0.547,3.843 0,5.344 C -0.482,6.76 0,5.976 0,5.976 0.795,3.964 2.833,4.103 2.833,4.103 H 2.86 C 2.51,9.12 -0.233,13.469 -4.232,16.029 l 0.003,-26.031 c 3.986,2.55 6.718,6.881 7.088,11.87 H 2.833 C 2.833,1.868 0.795,2.009 0,0" })
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("g", {
							transform: "matrix(0.35277777,0,0,-0.35277777,83.73628,168.53023)",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m 0,0 c 0,0 -0.377,-0.854 -0.915,0.316 -0.538,1.409 -0.606,3.576 0,5.317 0.48,1.146 0.936,0.321 0.936,0.321 C 0.817,3.942 2.767,4.103 2.767,4.103 V 15.98 C -1.481,13.226 -4.288,8.447 -4.288,3.01 c 0,-5.436 2.807,-10.212 7.055,-12.963 V 1.868 C 2.767,1.868 0.795,2.009 0,0" })
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("g", {
							transform: "matrix(0.35277777,0,0,-0.35277777,85.234031,163.61855)",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m 0,0 v -24.727 c 0.985,-0.49 2.028,-0.881 3.115,-1.158 0,0 -0.002,21.136 -0.002,21.936 C 3.113,-3.15 2.679,-0.568 0,0" })
						})
					]
				})
			});
		}
		/** Sentinel wordmark shown next to the CITIC mark in the expanded sidebar. */
		function CiticBrandName() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: CiticBrand_module_css_default.wordmark,
				children: "Sentinel"
			});
		}
		//#endregion
		//#region \0dsh-css:/Users/chankokpan/Documents/CITIC_AGENT/packages/soc-agent-client/src/client/SplunkZimbraOverlay.module.css.mjs
		const css$6 = "._3bvj8q_form button:focus-visible,._3bvj8q_input:focus-visible{outline:2px solid var(--dsw-alias-border-l4);outline-offset:2px}._3bvj8q_loading{color:var(--dsw-alias-label-secondary);text-align:center;padding:24px}._3bvj8q_form{flex-direction:column;gap:14px;font-size:13px;line-height:20px;display:flex}._3bvj8q_description,._3bvj8q_status{color:var(--dsw-alias-label-secondary);margin:0}._3bvj8q_status{background:var(--dsw-alias-bg-layer-1);border-radius:8px;padding:8px 10px}._3bvj8q_section{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);border-radius:12px;flex-direction:column;gap:8px;margin:0;padding:12px;display:flex}._3bvj8q_section h3{margin:0 0 2px;font-size:14px;font-weight:500;line-height:22px}._3bvj8q_row{grid-template-columns:118px minmax(0,1fr) auto;align-items:center;gap:8px;display:grid}._3bvj8q_row label{color:var(--dsw-alias-label-secondary)}._3bvj8q_input{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);min-width:0;height:32px;color:var(--dsw-alias-label-primary);font:inherit;border-radius:8px;padding:0 9px}._3bvj8q_input::placeholder{color:var(--dsw-alias-label-tertiary)}._3bvj8q_textarea{box-sizing:border-box;resize:vertical;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);width:100%;min-height:96px;color:var(--dsw-alias-label-primary);font:inherit;border-radius:8px;padding:9px}._3bvj8q_fieldLabel{color:var(--dsw-alias-label-secondary)}._3bvj8q_rule{overflow-wrap:anywhere;color:var(--dsw-alias-label-secondary)}._3bvj8q_run{border-bottom:1px solid var(--dsw-alias-border-l1);justify-content:space-between;align-items:center;gap:8px;padding:8px 0;display:flex}._3bvj8q_run:last-child{border-bottom:0}._3bvj8q_actions{flex-wrap:wrap;align-items:center;gap:8px;margin-top:4px;display:flex}._3bvj8q_primaryButton,._3bvj8q_secondaryButton,._3bvj8q_deleteButton{min-height:30px;font:inherit;cursor:pointer;border-radius:15px;padding:0 10px;font-size:12px}._3bvj8q_primaryButton{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);border:0}._3bvj8q_primaryButton:hover{background:var(--dsw-alias-button-primary-hover)}._3bvj8q_secondaryButton,._3bvj8q_deleteButton{border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);background:0 0}._3bvj8q_secondaryButton:hover,._3bvj8q_deleteButton:hover{background:var(--dsw-alias-interactive-bg-hover)}._3bvj8q_deleteButton{border-radius:14px;min-height:28px}._3bvj8q_account{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);border-radius:10px;flex-direction:column;gap:8px;padding:10px;display:flex}._3bvj8q_connectedAccount{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);border-radius:10px;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;padding:10px;display:flex}._3bvj8q_accountIdentity{flex-direction:column;gap:2px;min-width:0;display:flex}._3bvj8q_accountMeta{overflow-wrap:anywhere;color:var(--dsw-alias-label-secondary)}._3bvj8q_accountActions{flex-wrap:wrap;align-items:center;gap:8px;display:flex}._3bvj8q_testResult{overflow-wrap:anywhere;min-width:0;min-height:30px;color:var(--dsw-alias-label-secondary);align-items:center;display:inline-flex}._3bvj8q_testOk{color:var(--dsw-alias-state-success-primary)}._3bvj8q_testFail{color:var(--dsw-alias-state-error-primary)}@media (width<=520px){._3bvj8q_row{grid-template-columns:1fr auto}._3bvj8q_row label{grid-column:1/-1}}";
		const tagId$6 = "dsh-soc-agent-client/SplunkZimbraOverlay.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$6) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-soc-agent-client";
			tag.dataset.pluginCss = tagId$6;
			tag.textContent = css$6;
			document.head.appendChild(tag);
		}
		var SplunkZimbraOverlay_module_css_default = {
			"account": "_3bvj8q_account",
			"accountActions": "_3bvj8q_accountActions",
			"accountIdentity": "_3bvj8q_accountIdentity",
			"accountMeta": "_3bvj8q_accountMeta",
			"actions": "_3bvj8q_actions",
			"connectedAccount": "_3bvj8q_connectedAccount",
			"deleteButton": "_3bvj8q_deleteButton",
			"description": "_3bvj8q_description",
			"fieldLabel": "_3bvj8q_fieldLabel",
			"form": "_3bvj8q_form",
			"input": "_3bvj8q_input",
			"loading": "_3bvj8q_loading",
			"primaryButton": "_3bvj8q_primaryButton",
			"row": "_3bvj8q_row",
			"rule": "_3bvj8q_rule",
			"run": "_3bvj8q_run",
			"secondaryButton": "_3bvj8q_secondaryButton",
			"section": "_3bvj8q_section",
			"status": "_3bvj8q_status",
			"testFail": "_3bvj8q_testFail",
			"testOk": "_3bvj8q_testOk",
			"testResult": "_3bvj8q_testResult",
			"textarea": "_3bvj8q_textarea"
		};
		//#endregion
		//#region src/client/settings-common.ts
		const CHANNEL$4 = "/soc-agent-config";
		async function rpc$1(connection, name, payload = {}) {
			const result = await connection.rpc.call(CHANNEL$4, name, payload);
			if (!result?.ok) throw new Error(result?.error?.message || `Request failed: ${name}`);
			return result.value;
		}
		function errorText(error) {
			return error instanceof Error ? error.message : String(error);
		}
		function TextInput({ value, onChange, type = "text", placeholder = "" }) {
			return react.default.createElement("input", {
				className: SplunkZimbraOverlay_module_css_default.input,
				type,
				value: value ?? "",
				placeholder,
				onChange: (event) => onChange(event.target.value)
			});
		}
		function SettingRow({ label, value, onChange, onDelete, type = "text", placeholder = "" }) {
			return react.default.createElement("div", { className: SplunkZimbraOverlay_module_css_default.row }, react.default.createElement("label", null, label), react.default.createElement(TextInput, {
				value,
				onChange,
				type,
				placeholder
			}), react.default.createElement("button", {
				className: SplunkZimbraOverlay_module_css_default.deleteButton,
				type: "button",
				onClick: onDelete
			}, "Delete"));
		}
		function TestStatus({ result }) {
			if (!result) return null;
			const className = result.kind === "ok" ? `${SplunkZimbraOverlay_module_css_default.testResult} ${SplunkZimbraOverlay_module_css_default.testOk}` : result.kind === "fail" ? `${SplunkZimbraOverlay_module_css_default.testResult} ${SplunkZimbraOverlay_module_css_default.testFail}` : SplunkZimbraOverlay_module_css_default.testResult;
			return react.default.createElement("span", {
				className,
				role: "status"
			}, result.text);
		}
		//#endregion
		//#region src/client/SplunkSettings.ts
		function SplunkSettings({ connection }) {
			const [settings, setSettings] = (0, react.useState)(null);
			const [status, setStatus] = (0, react.useState)("Loading...");
			const [test, setTest] = (0, react.useState)(null);
			const load = (0, react.useCallback)(async () => {
				try {
					setSettings(await rpc$1(connection, "get-settings"));
					setStatus("");
				} catch (error) {
					setStatus(errorText(error));
				}
			}, [connection]);
			(0, react.useEffect)(() => {
				load();
			}, [load]);
			const update = (key, value) => {
				setSettings((current) => ({
					...current,
					splunk: {
						...current.splunk,
						[key]: value
					}
				}));
			};
			const save = async () => {
				try {
					setStatus("Saving...");
					setSettings(await rpc$1(connection, "update-settings", settings ?? {}));
					setStatus("Saved");
				} catch (error) {
					setStatus(errorText(error));
				}
			};
			const remove = async (key) => {
				try {
					setStatus("Deleting...");
					setSettings(await rpc$1(connection, "delete-setting", { key }));
					setStatus("Deleted");
				} catch (error) {
					setStatus(errorText(error));
				}
			};
			const testSplunk = async () => {
				setTest({
					kind: "pending",
					text: "Testing…"
				});
				try {
					const value = await rpc$1(connection, "test-splunk");
					setTest({
						kind: "ok",
						text: `Splunk OK (${String(value.index_count ?? 0)} indexes)`
					});
				} catch (error) {
					setTest({
						kind: "fail",
						text: errorText(error)
					});
				}
			};
			if (!settings) return react.default.createElement("div", { className: SplunkZimbraOverlay_module_css_default.loading }, status);
			const splunk = settings.splunk;
			return react.default.createElement("section", { className: SplunkZimbraOverlay_module_css_default.section }, react.default.createElement("h3", null, "Splunk"), react.default.createElement(SettingRow, {
				label: "URL",
				value: String(splunk.url || ""),
				onChange: (value) => update("url", value),
				onDelete: () => {
					remove("splunk.url");
				}
			}), react.default.createElement(SettingRow, {
				label: "Username",
				value: String(splunk.username || ""),
				onChange: (value) => update("username", value),
				onDelete: () => {
					remove("splunk.username");
				}
			}), react.default.createElement(SettingRow, {
				label: "Password",
				value: "",
				type: "password",
				placeholder: splunk.has_password ? "Stored password is set" : "",
				onChange: (value) => update("password", value),
				onDelete: () => {
					remove("splunk.password");
				}
			}), react.default.createElement(SettingRow, {
				label: "Verify SSL",
				value: String(splunk.verify_ssl ?? true),
				onChange: (value) => update("verify_ssl", value === "true"),
				onDelete: () => {
					remove("splunk.verify_ssl");
				}
			}), react.default.createElement(SettingRow, {
				label: "Max events",
				value: String(splunk.max_events ?? ""),
				onChange: (value) => update("max_events", Number(value || 0)),
				onDelete: () => {
					remove("splunk.max_events");
				}
			}), react.default.createElement(SettingRow, {
				label: "Risk tolerance",
				value: String(splunk.risk_tolerance ?? ""),
				onChange: (value) => update("risk_tolerance", Number(value || 0)),
				onDelete: () => {
					remove("splunk.risk_tolerance");
				}
			}), react.default.createElement(SettingRow, {
				label: "Allow drafts",
				value: String(splunk.detection_write_enabled ?? false),
				onChange: (value) => update("detection_write_enabled", value === "true"),
				onDelete: () => {
					remove("splunk.detection_write_enabled");
				}
			}), react.default.createElement(SettingRow, {
				label: "Allow enable",
				value: String(splunk.detection_enable_enabled ?? false),
				onChange: (value) => update("detection_enable_enabled", value === "true"),
				onDelete: () => {
					remove("splunk.detection_enable_enabled");
				}
			}), react.default.createElement("div", { className: SplunkZimbraOverlay_module_css_default.actions }, react.default.createElement("button", {
				className: SplunkZimbraOverlay_module_css_default.primaryButton,
				type: "button",
				onClick: () => {
					save();
				}
			}, "Save settings"), react.default.createElement("button", {
				className: SplunkZimbraOverlay_module_css_default.secondaryButton,
				type: "button",
				onClick: () => {
					testSplunk();
				}
			}, "Test Splunk"), react.default.createElement(TestStatus, { result: test })), status ? react.default.createElement("p", {
				className: SplunkZimbraOverlay_module_css_default.status,
				role: "status"
			}, status) : null);
		}
		//#endregion
		//#region src/client/SubscriptionServerSettings.ts
		function SubscriptionServerSettings({ connection }) {
			const [settings, setSettings] = (0, react.useState)(null);
			const [status, setStatus] = (0, react.useState)("Loading...");
			const [test, setTest] = (0, react.useState)(null);
			const load = (0, react.useCallback)(async () => {
				try {
					setSettings(await rpc$1(connection, "get-settings"));
					setStatus("");
				} catch (error) {
					setStatus(errorText(error));
				}
			}, [connection]);
			(0, react.useEffect)(() => {
				load();
			}, [load]);
			const testConnection = async () => {
				setTest({
					kind: "pending",
					text: "Testing…"
				});
				try {
					const value = await rpc$1(connection, "test-subscription-server");
					setTest({
						kind: "ok",
						text: `Subscription server OK (${String(value.subscription_count ?? 0)} subscriptions)`
					});
				} catch (error) {
					setTest({
						kind: "fail",
						text: errorText(error)
					});
				}
			};
			if (!settings) return react.default.createElement("div", { className: SplunkZimbraOverlay_module_css_default.loading }, status);
			const server = settings.subscription_server ?? {};
			return react.default.createElement("section", { className: SplunkZimbraOverlay_module_css_default.section }, react.default.createElement("h3", null, "Subscription server"), react.default.createElement("p", { className: SplunkZimbraOverlay_module_css_default.description }, "Configured through the server .env file. Credentials are never shown here."), react.default.createElement("p", { className: SplunkZimbraOverlay_module_css_default.description }, `URL: ${String(server.url || "")}`), react.default.createElement("p", { className: SplunkZimbraOverlay_module_css_default.description }, server.configured ? "Credentials configured" : "Credentials not configured"), react.default.createElement("div", { className: SplunkZimbraOverlay_module_css_default.actions }, react.default.createElement("button", {
				className: SplunkZimbraOverlay_module_css_default.secondaryButton,
				type: "button",
				onClick: () => {
					testConnection();
				}
			}, "Test subscription server"), react.default.createElement(TestStatus, { result: test })), status ? react.default.createElement("p", {
				className: SplunkZimbraOverlay_module_css_default.status,
				role: "status"
			}, status) : null);
		}
		//#endregion
		//#region src/client/ScheduledTasksForm.ts
		const CHANNEL$3 = "/soc-agent-schedules";
		async function rpc(connection, endpoint, payload = {}) {
			const result = await connection.rpc.call(CHANNEL$3, endpoint, payload);
			if (!result?.ok) throw new Error(result?.error?.message || `Request failed: ${endpoint}`);
			return result.value;
		}
		function localZone() {
			return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
		}
		function readable(value) {
			return value ? new Date(value).toLocaleString() : "—";
		}
		function modelKey(provider, model) {
			return `${provider}\u0000${model}`;
		}
		function taskModelLabel(task) {
			if (!task.provider || !task.model) return "Default model";
			return `${task.provider} / ${task.model} · ${task.reasoningEffort || "Provider default"}`;
		}
		function SchedulerSettings({ connection, openSession }) {
			const [tasks, setTasks] = (0, react.useState)([]);
			const [runs, setRuns] = (0, react.useState)([]);
			const [schedulerSettings, setSchedulerSettings] = (0, react.useState)({
				maxConcurrentRuns: 1,
				runTimeoutMs: 9e5
			});
			const [status, setStatus] = (0, react.useState)("Loading...");
			const [modelStatus, setModelStatus] = (0, react.useState)("Loading models...");
			const [modelGroups, setModelGroups] = (0, react.useState)([]);
			const [name, setName] = (0, react.useState)("");
			const [prompt, setPrompt] = (0, react.useState)("");
			const [provider, setProvider] = (0, react.useState)("");
			const [model, setModel] = (0, react.useState)("");
			const [reasoningEffort, setReasoningEffort] = (0, react.useState)("");
			const [kind, setKind] = (0, react.useState)("once");
			const [at, setAt] = (0, react.useState)("");
			const [cron, setCron] = (0, react.useState)("0 * * * *");
			const [timeZone, setTimeZone] = (0, react.useState)(localZone);
			const load = (0, react.useCallback)(async () => {
				try {
					const value = await rpc(connection, "list");
					setTasks(value.tasks ?? []);
					setRuns(value.runs ?? []);
					if (value.settings) setSchedulerSettings(value.settings);
					setStatus("");
				} catch (error) {
					setStatus(error instanceof Error ? error.message : String(error));
				}
			}, [connection]);
			const loadModels = (0, react.useCallback)(async () => {
				setModelStatus("Loading models...");
				try {
					const [catalogResponse, hostResponse] = await Promise.all([connection.api.llm.models({}), connection.api.host.describe({}).catch(() => void 0)]);
					if (!catalogResponse.result.ok) throw new Error(catalogResponse.result.error.message);
					const groups = catalogResponse.result.value.groups;
					const choices = groups.flatMap((group) => group.models.map((item) => ({
						provider: group.id,
						id: item.id,
						reasoning: item.reasoning
					})));
					setModelGroups(groups);
					if (choices.length === 0) {
						setProvider("");
						setModel("");
						setReasoningEffort("");
						setModelStatus("No models are available.");
						return;
					}
					const preferredProvider = hostResponse?.result.ok ? hostResponse.result.value.provider : void 0;
					const preferredModel = hostResponse?.result.ok ? hostResponse.result.value.model : void 0;
					const choice = choices.find((item) => item.provider === preferredProvider && item.id === preferredModel) ?? choices[0];
					setProvider(choice.provider);
					setModel(choice.id);
					setReasoningEffort("");
					setModelStatus(catalogResponse.result.value.failures.length > 0 ? "Some providers could not be loaded." : "");
				} catch (error) {
					setModelStatus(error instanceof Error ? error.message : String(error));
				}
			}, [connection]);
			(0, react.useEffect)(() => {
				load();
				loadModels();
			}, [load, loadModels]);
			const mutate = async (endpoint, payload) => {
				setStatus("Saving...");
				try {
					await rpc(connection, endpoint, payload);
					await load();
				} catch (error) {
					setStatus(error instanceof Error ? error.message : String(error));
				}
			};
			const create = async () => {
				const payload = {
					name,
					prompt,
					provider,
					model
				};
				if (reasoningEffort) payload.reasoning_effort = reasoningEffort;
				if (kind === "once") {
					const [date, time] = at.split("T");
					payload.at = {
						date,
						time: time?.length === 5 ? `${time}:00` : time,
						time_zone: timeZone
					};
				} else {
					payload.cron = cron;
					payload.time_zone = timeZone;
				}
				await mutate("create", payload);
				setName("");
				setPrompt("");
				setAt("");
			};
			const selectedModel = modelGroups.find((group) => group.id === provider)?.models.find((item) => item.id === model);
			return react.default.createElement("div", { className: SplunkZimbraOverlay_module_css_default.form }, react.default.createElement("p", { className: SplunkZimbraOverlay_module_css_default.description }, "Persistent read-only investigations run whenever this DSH host is active."), status ? react.default.createElement("p", {
				className: SplunkZimbraOverlay_module_css_default.status,
				role: "status"
			}, status) : null, react.default.createElement("section", { className: SplunkZimbraOverlay_module_css_default.section }, react.default.createElement("h3", null, "Scheduler limits"), react.default.createElement("div", { className: SplunkZimbraOverlay_module_css_default.row }, react.default.createElement("label", null, "Concurrent runs"), react.default.createElement("input", {
				className: SplunkZimbraOverlay_module_css_default.input,
				type: "number",
				min: 1,
				max: 8,
				value: schedulerSettings.maxConcurrentRuns,
				onChange: (event) => setSchedulerSettings({
					...schedulerSettings,
					maxConcurrentRuns: Number(event.target.value)
				})
			})), react.default.createElement("div", { className: SplunkZimbraOverlay_module_css_default.row }, react.default.createElement("label", null, "Run timeout (seconds)"), react.default.createElement("input", {
				className: SplunkZimbraOverlay_module_css_default.input,
				type: "number",
				min: 1,
				max: 86400,
				value: schedulerSettings.runTimeoutMs / 1e3,
				onChange: (event) => setSchedulerSettings({
					...schedulerSettings,
					runTimeoutMs: Number(event.target.value) * 1e3
				})
			})), react.default.createElement("div", { className: SplunkZimbraOverlay_module_css_default.actions }, react.default.createElement("button", {
				className: SplunkZimbraOverlay_module_css_default.primaryButton,
				type: "button",
				onClick: () => {
					mutate("settings", schedulerSettings);
				}
			}, "Save limits"))), react.default.createElement("section", { className: SplunkZimbraOverlay_module_css_default.section }, react.default.createElement("h3", null, "Create task"), react.default.createElement("label", { className: SplunkZimbraOverlay_module_css_default.fieldLabel }, "Name"), react.default.createElement("input", {
				className: SplunkZimbraOverlay_module_css_default.input,
				value: name,
				maxLength: 120,
				onChange: (event) => setName(event.target.value)
			}), react.default.createElement("label", { className: SplunkZimbraOverlay_module_css_default.fieldLabel }, "Investigation prompt"), react.default.createElement("textarea", {
				className: SplunkZimbraOverlay_module_css_default.textarea,
				value: prompt,
				maxLength: 8e3,
				rows: 5,
				onChange: (event) => setPrompt(event.target.value)
			}), react.default.createElement("div", { className: SplunkZimbraOverlay_module_css_default.row }, react.default.createElement("label", null, "Model"), react.default.createElement("select", {
				className: SplunkZimbraOverlay_module_css_default.input,
				value: modelKey(provider, model),
				disabled: modelGroups.length === 0,
				onChange: (event) => {
					const selected = modelGroups.flatMap((group) => group.models.map((item) => ({
						group,
						item
					}))).find(({ group, item }) => modelKey(group.id, item.id) === event.target.value);
					if (!selected) return;
					setProvider(selected.group.id);
					setModel(selected.item.id);
					setReasoningEffort(selected.item.reasoning?.defaultEffort ?? "");
				}
			}, modelGroups.map((group) => react.default.createElement("optgroup", {
				key: group.id,
				label: group.name
			}, group.models.map((item) => react.default.createElement("option", {
				key: modelKey(group.id, item.id),
				value: modelKey(group.id, item.id)
			}, item.name)))))), react.default.createElement("div", { className: SplunkZimbraOverlay_module_css_default.row }, react.default.createElement("label", null, "Reasoning effort"), react.default.createElement("select", {
				className: SplunkZimbraOverlay_module_css_default.input,
				value: reasoningEffort,
				disabled: !provider || !model,
				onChange: (event) => setReasoningEffort(event.target.value)
			}, react.default.createElement("option", { value: "" }, "Provider default"), (selectedModel?.reasoning?.efforts ?? []).map((effort) => react.default.createElement("option", {
				key: effort.id,
				value: effort.id
			}, effort.name)))), modelStatus ? react.default.createElement("p", {
				className: SplunkZimbraOverlay_module_css_default.description,
				role: "status"
			}, modelStatus) : null, react.default.createElement("div", { className: SplunkZimbraOverlay_module_css_default.row }, react.default.createElement("label", null, "Rule"), react.default.createElement("select", {
				className: SplunkZimbraOverlay_module_css_default.input,
				value: kind,
				onChange: (event) => setKind(event.target.value)
			}, react.default.createElement("option", { value: "once" }, "One time"), react.default.createElement("option", { value: "cron" }, "Cron"))), kind === "once" ? react.default.createElement("div", { className: SplunkZimbraOverlay_module_css_default.row }, react.default.createElement("label", null, "Local time"), react.default.createElement("input", {
				className: SplunkZimbraOverlay_module_css_default.input,
				type: "datetime-local",
				step: 1,
				value: at,
				onChange: (event) => setAt(event.target.value)
			})) : react.default.createElement("div", { className: SplunkZimbraOverlay_module_css_default.row }, react.default.createElement("label", null, "5-field cron"), react.default.createElement("input", {
				className: SplunkZimbraOverlay_module_css_default.input,
				value: cron,
				onChange: (event) => setCron(event.target.value)
			})), react.default.createElement("div", { className: SplunkZimbraOverlay_module_css_default.row }, react.default.createElement("label", null, "Time zone"), react.default.createElement("input", {
				className: SplunkZimbraOverlay_module_css_default.input,
				value: timeZone,
				onChange: (event) => setTimeZone(event.target.value)
			})), react.default.createElement("div", { className: SplunkZimbraOverlay_module_css_default.actions }, react.default.createElement("button", {
				className: SplunkZimbraOverlay_module_css_default.primaryButton,
				type: "button",
				disabled: !name.trim() || !prompt.trim() || !provider || !model || modelGroups.length === 0 || kind === "once" && !at,
				onClick: () => {
					create();
				}
			}, "Create task"))), react.default.createElement("section", { className: SplunkZimbraOverlay_module_css_default.section }, react.default.createElement("h3", null, "Tasks"), tasks.length === 0 ? react.default.createElement("p", { className: SplunkZimbraOverlay_module_css_default.description }, "No scheduled tasks.") : null, tasks.map((task) => react.default.createElement("article", {
				className: SplunkZimbraOverlay_module_css_default.account,
				key: task.id
			}, react.default.createElement("strong", null, task.name), react.default.createElement("span", { className: SplunkZimbraOverlay_module_css_default.description }, `${task.status} · Next ${readable(task.nextRunAt)} · Last ${readable(task.lastRunAt)}`), react.default.createElement("span", { className: SplunkZimbraOverlay_module_css_default.description }, `Model: ${taskModelLabel(task)}`), react.default.createElement("code", { className: SplunkZimbraOverlay_module_css_default.rule }, task.rule.kind === "once" ? task.rule.at : `${task.rule.expression} (${task.rule.timeZone})`), react.default.createElement("div", { className: SplunkZimbraOverlay_module_css_default.actions }, task.status === "active" ? react.default.createElement("button", {
				className: SplunkZimbraOverlay_module_css_default.secondaryButton,
				type: "button",
				onClick: () => {
					mutate("pause", { id: task.id });
				}
			}, "Pause") : null, task.status === "paused" ? react.default.createElement("button", {
				className: SplunkZimbraOverlay_module_css_default.secondaryButton,
				type: "button",
				onClick: () => {
					mutate("resume", { id: task.id });
				}
			}, "Resume") : null, react.default.createElement("button", {
				className: SplunkZimbraOverlay_module_css_default.secondaryButton,
				type: "button",
				onClick: () => {
					mutate("run-now", { id: task.id });
				}
			}, "Run now"), react.default.createElement("button", {
				className: SplunkZimbraOverlay_module_css_default.deleteButton,
				type: "button",
				onClick: () => {
					if (window.confirm(`Delete scheduled task “${task.name}”?`)) mutate("delete", { id: task.id });
				}
			}, "Delete"))))), react.default.createElement("section", { className: SplunkZimbraOverlay_module_css_default.section }, react.default.createElement("h3", null, "Recent runs"), runs.length === 0 ? react.default.createElement("p", { className: SplunkZimbraOverlay_module_css_default.description }, "No runs yet.") : null, runs.map((run) => react.default.createElement("div", {
				className: SplunkZimbraOverlay_module_css_default.run,
				key: run.id
			}, react.default.createElement("span", null, `${readable(run.scheduledFor)} · ${run.state}${run.errorCode ? ` · ${run.errorCode}` : ""}`), run.sessionId ? react.default.createElement("button", {
				className: SplunkZimbraOverlay_module_css_default.secondaryButton,
				type: "button",
				onClick: () => openSession(run.sessionId)
			}, "Open investigation") : null))));
		}
		//#endregion
		//#region src/client/sections.ts
		const SETTINGS_SECTIONS = [{
			id: "soc-agent-connections",
			order: 30,
			label: "Connections"
		}, {
			id: "soc-agent-schedules",
			order: 40,
			label: "Scheduled Tasks"
		}];
		//#endregion
		//#region \0dsh-css:/Users/chankokpan/Documents/CITIC_AGENT/packages/soc-agent-client/src/client/AuthGate.module.css.mjs
		const css$5 = ".e9h_7W_layer{z-index:10000;color:#eef3f8;pointer-events:auto;background:#0c121cb8;place-items:center;display:grid;position:fixed;inset:0}.e9h_7W_card{background:#182230;border:1px solid #ffffff29;border-radius:14px;width:min(390px,100vw - 40px);padding:28px;box-shadow:0 18px 55px #00000052}.e9h_7W_title{margin:0 0 20px;font-size:20px;font-weight:600}.e9h_7W_field{gap:6px;margin:14px 0;font-size:13px;display:grid}.e9h_7W_input{box-sizing:border-box;width:100%;color:inherit;font:inherit;background:#101923;border:1px solid #fff3;border-radius:8px;padding:10px 11px}.e9h_7W_button{color:#fff;cursor:pointer;width:100%;font:inherit;background:#4b8cf7;border:0;border-radius:8px;margin-top:8px;padding:10px 12px}.e9h_7W_button:disabled{cursor:wait;opacity:.65}.e9h_7W_error{color:#ffb7b7;margin:10px 0;font-size:13px}.e9h_7W_loading{color:#cbd6e2;font-size:14px}.e9h_7W_badge{z-index:10001;color:#dce7f2;pointer-events:auto;background:#182230eb;border:1px solid #ffffff1f;border-radius:999px;align-items:center;gap:10px;padding:6px 9px 6px 11px;font-size:12px;display:flex;position:fixed;top:12px;right:16px}.e9h_7W_logout{color:inherit;cursor:pointer;font:inherit;background:0 0;border:1px solid #fff3;border-radius:6px;padding:3px 7px}";
		const tagId$5 = "dsh-soc-agent-client/AuthGate.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$5) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-soc-agent-client";
			tag.dataset.pluginCss = tagId$5;
			tag.textContent = css$5;
			document.head.appendChild(tag);
		}
		var AuthGate_module_css_default = {
			"badge": "e9h_7W_badge",
			"button": "e9h_7W_button",
			"card": "e9h_7W_card",
			"error": "e9h_7W_error",
			"field": "e9h_7W_field",
			"input": "e9h_7W_input",
			"layer": "e9h_7W_layer",
			"loading": "e9h_7W_loading",
			"logout": "e9h_7W_logout",
			"title": "e9h_7W_title"
		};
		//#endregion
		//#region src/client/AuthGate.tsx
		async function readAuth() {
			const response = await fetch("/auth/me", {
				credentials: "same-origin",
				cache: "no-store"
			});
			if (!response.ok) return { authenticated: false };
			const value = await response.json();
			return value.authenticated === true && typeof value.user?.zimbra_email === "string" ? value : { authenticated: false };
		}
		function AuthGate() {
			const [state, setState] = (0, react.useState)(null);
			const [email, setEmail] = (0, react.useState)("");
			const [password, setPassword] = (0, react.useState)("");
			const [error, setError] = (0, react.useState)("");
			const [busy, setBusy] = (0, react.useState)(false);
			const refresh = (0, react.useCallback)(async () => {
				try {
					setState(await readAuth());
				} catch {
					setState({ authenticated: false });
				}
			}, []);
			(0, react.useEffect)(() => {
				refresh();
				const timer = window.setInterval(() => {
					refresh();
				}, 3e4);
				return () => window.clearInterval(timer);
			}, [refresh]);
			const login = async (event) => {
				event.preventDefault();
				setBusy(true);
				setError("");
				try {
					if (!(await fetch("/auth/login", {
						method: "POST",
						credentials: "same-origin",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({
							email,
							password
						})
					})).ok) throw new Error("Invalid email or password.");
					setPassword("");
					window.location.reload();
				} catch (caught) {
					setPassword("");
					setError(caught instanceof Error ? caught.message : "Login failed.");
					setBusy(false);
				}
			};
			const logout = async () => {
				setBusy(true);
				try {
					await fetch("/auth/logout", {
						method: "POST",
						credentials: "same-origin"
					});
				} finally {
					window.location.reload();
				}
			};
			if (state === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: AuthGate_module_css_default.layer,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: AuthGate_module_css_default.loading,
					children: "Loading…"
				})
			});
			if (!state.authenticated || !state.user) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: AuthGate_module_css_default.layer,
				role: "dialog",
				"aria-label": "Sentinel login",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
					className: AuthGate_module_css_default.card,
					onSubmit: login,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h1", {
							className: AuthGate_module_css_default.title,
							children: "Sentinel"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: AuthGate_module_css_default.field,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "Email" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: AuthGate_module_css_default.input,
								type: "email",
								autoComplete: "username",
								value: email,
								onChange: (event) => setEmail(event.target.value),
								required: true
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: AuthGate_module_css_default.field,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "Password" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: AuthGate_module_css_default.input,
								type: "password",
								autoComplete: "current-password",
								value: password,
								onChange: (event) => setPassword(event.target.value),
								required: true
							})]
						}),
						error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: AuthGate_module_css_default.error,
							role: "alert",
							children: error
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: AuthGate_module_css_default.button,
							type: "submit",
							disabled: busy,
							children: "Login"
						})
					]
				})
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: AuthGate_module_css_default.badge,
				"aria-label": `Signed in as ${state.user.zimbra_email}`,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: state.user.zimbra_email }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					className: AuthGate_module_css_default.logout,
					type: "button",
					onClick: () => {
						logout();
					},
					disabled: busy,
					children: "Logout"
				})]
			});
		}
		//#endregion
		//#region \0dsh-css:/Users/chankokpan/Documents/CITIC_AGENT/packages/soc-agent-client/src/client/EmailDraftToolview.module.css.mjs
		const css$4 = "._2F_7Mq_card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-surface-l1,transparent);border-radius:10px;margin:6px 0;overflow:hidden}._2F_7Mq_header{background:var(--dsw-alias-surface-l2,transparent);justify-content:space-between;align-items:center;gap:12px;padding:10px 12px;display:flex}._2F_7Mq_title{font-weight:600}._2F_7Mq_account{color:var(--dsw-alias-text-l2);font-size:12px}._2F_7Mq_content{gap:9px;padding:12px;display:grid}._2F_7Mq_field{gap:4px;display:grid}._2F_7Mq_label{color:var(--dsw-alias-text-l2);font-size:12px;font-weight:600}._2F_7Mq_input,._2F_7Mq_textarea{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-surface-l0,transparent);width:100%;color:inherit;font:inherit;border-radius:6px;padding:8px 9px}._2F_7Mq_textarea{resize:vertical;min-height:180px;line-height:1.45}._2F_7Mq_input:focus,._2F_7Mq_textarea:focus{outline:2px solid var(--dsw-alias-primary,currentColor);outline-offset:1px}._2F_7Mq_actions{justify-content:flex-end;gap:8px;padding-top:3px;display:flex}._2F_7Mq_signaturePanel{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-surface-l2,transparent);border-radius:8px;gap:9px;padding:10px;display:grid}._2F_7Mq_button{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-surface-l2,transparent);color:inherit;cursor:pointer;font:inherit;border-radius:6px;padding:7px 12px}._2F_7Mq_primary{color:var(--dsw-alias-on-primary,#fff);background:#2563eb;border-color:#2563eb}._2F_7Mq_primary:hover{background:#1d4ed8;border-color:#1d4ed8}._2F_7Mq_danger{color:#fff;background:#dc2626;border-color:#dc2626}._2F_7Mq_danger:hover{background:#b91c1c;border-color:#b91c1c}._2F_7Mq_signatureButton{color:#fff;background:#7c3aed;border-color:#7c3aed}._2F_7Mq_signatureButton:hover{background:#6d28d9;border-color:#6d28d9}._2F_7Mq_button:disabled{cursor:wait;opacity:.6}._2F_7Mq_message{color:var(--dsw-alias-text-l2);padding:10px 12px;font-size:13px}._2F_7Mq_error{color:var(--dsw-alias-danger,#b42318)}";
		const tagId$4 = "dsh-soc-agent-client/EmailDraftToolview.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$4) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-soc-agent-client";
			tag.dataset.pluginCss = tagId$4;
			tag.textContent = css$4;
			document.head.appendChild(tag);
		}
		var EmailDraftToolview_module_css_default = {
			"account": "_2F_7Mq_account",
			"actions": "_2F_7Mq_actions",
			"button": "_2F_7Mq_button",
			"card": "_2F_7Mq_card",
			"content": "_2F_7Mq_content",
			"danger": "_2F_7Mq_danger",
			"error": "_2F_7Mq_error",
			"field": "_2F_7Mq_field",
			"header": "_2F_7Mq_header",
			"input": "_2F_7Mq_input",
			"label": "_2F_7Mq_label",
			"message": "_2F_7Mq_message",
			"primary": "_2F_7Mq_primary",
			"signatureButton": "_2F_7Mq_signatureButton",
			"signaturePanel": "_2F_7Mq_signaturePanel",
			"textarea": "_2F_7Mq_textarea",
			"title": "_2F_7Mq_title"
		};
		//#endregion
		//#region src/client/emailDraft.ts
		const ZIMBRA_DRAFT_TOOL_NAME = "mcp__soc_agent__zimbra_send_email";
		const ZIMBRA_SIGNATURE_DRAFT_TOOL_NAME = "mcp__soc_agent__zimbra_use_signature_on_email";
		function parseRecipientText(value) {
			return [...new Set(value.split(/[\n,;]/).map((item) => item.trim()).filter(Boolean))];
		}
		function draftFromForm(fields) {
			return {
				to: parseRecipientText(fields.to),
				cc: parseRecipientText(fields.cc),
				bcc: parseRecipientText(fields.bcc),
				subject: fields.subject.trim(),
				body: fields.body
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
		function EmailDraftToolview({ block, connection }) {
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
			const submit = async () => {
				const draft = draftFromForm(fields);
				if (draft.to.length === 0) {
					setSendError("Add at least one To recipient.");
					return;
				}
				if (!draft.subject) {
					setSendError("Subject cannot be empty.");
					return;
				}
				if (typeof window !== "undefined" && !window.confirm("Send this email now?")) return;
				setStatus("sending");
				setSendError(null);
				try {
					if ((await rpc$1(connection, "send-email", {
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
					const next = (await rpc$1(connection, "list-signatures")).signatures ?? [];
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
						children: "Email draft"
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
								children: "Body"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
								className: EmailDraftToolview_module_css_default.textarea,
								"aria-label": "Body",
								value: fields.body,
								onChange: update("body"),
								maxLength: 18e3
							})]
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
			inject: ["slots", "connection"],
			apply(ctx) {
				const connection = ctx.get("connection");
				for (const key of [ZIMBRA_DRAFT_TOOL_NAME, ZIMBRA_SIGNATURE_DRAFT_TOOL_NAME]) ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({
					name: "tool.call.toolview",
					key,
					inject: () => ({ connection })
				}, EmailDraftToolview));
			}
		};
		function installEmailDraftToolview(ctx) {
			ctx.plugin(emailDraftToolview);
		}
		//#endregion
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
		//#region src/client/markitdownAttachments.ts
		const CHANNEL$2 = "/soc-agent-config";
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
			constructor(connection, settings) {
				this.connection = connection;
				this.settings = settings;
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
				const drafts = this.drafts.get(sessionId);
				if (drafts?.delete(id)) this.changed();
				if (drafts?.size === 0) this.drafts.delete(sessionId);
			}
			async convert(sessionId, ids, signal) {
				const limits = settingsOf(this.settings);
				const result = [];
				let totalChars = 0;
				for (const id of ids) {
					if (signal.aborted) throw new Error("attachment_conversion_cancelled");
					const document = this.drafts.get(sessionId)?.get(id);
					if (document === void 0) continue;
					this.setStatus(sessionId, id, "converting");
					const localAbort = new AbortController();
					const abort = () => {
						localAbort.abort();
					};
					signal.addEventListener("abort", abort, { once: true });
					this.aborts.set(id, localAbort);
					try {
						const bytes = new Uint8Array(await document.file.arrayBuffer());
						const response = await this.connection.rpc.call(CHANNEL$2, "convert-attachment", {
							filename: document.file.name,
							content_type: document.file.type,
							data: bytesToBase64(bytes),
							limits: {
								max_bytes: limits.maxBytesPerFile,
								max_chars: limits.maxCharsPerFile
							}
						}, localAbort.signal);
						if (!response?.ok) throw new Error(response?.error?.message || "The attachment conversion failed.");
						const converted = response.value;
						const markdown = typeof converted.text === "string" ? converted.text : "";
						totalChars += markdown.length;
						if (totalChars > limits.maxTotalChars) throw new Error("The attachments exceed the configured Markdown character limit.");
						if (!this.drafts.get(sessionId)?.has(id)) continue;
						this.setStatus(sessionId, id, "converted");
						result.push({
							id,
							filename: typeof converted.filename === "string" ? converted.filename : document.file.name,
							markdown
						});
					} catch (error) {
						if (localAbort.signal.aborted || signal.aborted) {
							if (!this.drafts.get(sessionId)?.has(id)) continue;
							throw new Error("attachment_conversion_cancelled");
						}
						const message = error instanceof Error ? error.message : "The attachment conversion failed.";
						this.setStatus(sessionId, id, "failed", message);
						throw new Error(message);
					} finally {
						signal.removeEventListener("abort", abort);
						if (this.aborts.get(id) === localAbort) this.aborts.delete(id);
					}
				}
				return result;
			}
			setStatus(sessionId, id, status, error) {
				const drafts = this.drafts.get(sessionId);
				const current = drafts?.get(id);
				if (current === void 0) return;
				drafts?.set(id, {
					...current,
					status,
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
		//#region \0dsh-css:/Users/chankokpan/Documents/CITIC_AGENT/packages/soc-agent-client/src/client/MarkItDownDocuments.module.css.mjs
		const css$3 = ".Lt34_a_rail{flex-wrap:wrap;gap:8px;padding:10px 12px 0;display:flex}.Lt34_a_item{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);min-width:0;max-width:min(100%,360px);color:var(--dsw-alias-label-primary);border-radius:8px;align-items:center;gap:7px;padding:6px 8px;font-size:13px;line-height:20px;display:inline-flex}.Lt34_a_icon{flex:none;font-size:14px;line-height:1}.Lt34_a_name{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}.Lt34_a_status{color:var(--dsw-alias-label-tertiary);white-space:nowrap;flex:none;font-size:12px}.Lt34_a_remove{width:20px;height:20px;color:var(--dsw-alias-label-tertiary);font:inherit;cursor:pointer;background:0 0;border:0;border-radius:50%;flex:none;padding:0;font-size:18px;line-height:18px}.Lt34_a_remove:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.Lt34_a_remove:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}";
		const tagId$3 = "dsh-soc-agent-client/MarkItDownDocuments.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$3) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-soc-agent-client";
			tag.dataset.pluginCss = tagId$3;
			tag.textContent = css$3;
			document.head.appendChild(tag);
		}
		var MarkItDownDocuments_module_css_default = {
			"icon": "Lt34_a_icon",
			"item": "Lt34_a_item",
			"name": "Lt34_a_name",
			"rail": "Lt34_a_rail",
			"remove": "Lt34_a_remove",
			"status": "Lt34_a_status"
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
			const documents = controller.list(sessionId, props.documents.map((document) => document.id));
			const pickerId = `soc-agent-file-picker-${sessionId}`;
			if (documents.length === 0 && !props.canAcceptDocuments) return null;
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
						if (files.length > 0 && props.canAcceptDocuments) props.onAddDocuments(files);
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
							children: statusText(document, props.phase === "submitting")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: MarkItDownDocuments_module_css_default.remove,
							type: "button",
							"aria-label": `Remove ${document.file.name}`,
							onClick: () => props.onRemoveDocument(document.id),
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
		//#region \0dsh-css:/Users/chankokpan/Documents/CITIC_AGENT/packages/soc-agent-client/src/client/MarkItDownAttachmentSettings.module.css.mjs
		const css$2 = ".TdgZiW_card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;list-style:none;transition:border-color .16s,background .16s}.TdgZiW_card:hover,.TdgZiW_cardOpen{border-color:var(--dsw-alias-label-dimmed)}.TdgZiW_cardOpen{background:var(--dsw-alias-bg-layer-2)}.TdgZiW_header{width:100%;color:inherit;font:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-radius:12px;align-items:center;gap:12px;padding:14px 16px;display:flex}.TdgZiW_header:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}.TdgZiW_headText{flex-direction:column;flex:1;gap:4px;min-width:0;display:flex}.TdgZiW_name{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:1.4}.TdgZiW_description,.TdgZiW_hint,.TdgZiW_invalid{font-size:12px;line-height:1.5}.TdgZiW_description,.TdgZiW_hint{color:var(--dsw-alias-label-tertiary)}.TdgZiW_chevron{color:var(--dsw-alias-label-tertiary);flex:none;transition:transform .16s}.TdgZiW_chevronOpen{transform:rotate(180deg)}.TdgZiW_body{border-top:1px solid var(--dsw-alias-border-l2);margin:0 16px;padding-bottom:8px}.TdgZiW_field{flex-direction:column;gap:6px;padding:12px 0;display:flex}.TdgZiW_field+.TdgZiW_field{border-top:1px solid var(--dsw-alias-border-l2)}.TdgZiW_fieldHead{align-items:center;gap:8px;display:flex}.TdgZiW_fieldLabel{min-width:0;color:var(--dsw-alias-label-primary);flex:1;font-size:13px;font-weight:500;line-height:1.5}.TdgZiW_badges{align-items:center;gap:8px;display:inline-flex}.TdgZiW_badge{background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);white-space:nowrap;border-radius:999px;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}.TdgZiW_reset{color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;background:0 0;border:0;padding:0;font-size:12px;line-height:1.5}.TdgZiW_reset:hover:not(:disabled){color:var(--dsw-alias-label-primary)}.TdgZiW_input{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);width:100%;height:34px;color:var(--dsw-alias-label-primary);font:inherit;border-radius:8px;padding:0 12px;font-size:13px;line-height:1.5}.TdgZiW_input:focus-visible{border-color:var(--dsw-alias-brand-primary);outline:none}.TdgZiW_input:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}.TdgZiW_inputInvalid{border-color:var(--dsw-alias-label-error)}.TdgZiW_hint,.TdgZiW_invalid,.TdgZiW_failed{margin:0}.TdgZiW_invalid,.TdgZiW_failed{color:var(--dsw-alias-label-error)}.TdgZiW_footer{border-top:1px solid var(--dsw-alias-border-l2);justify-content:flex-end;align-items:center;gap:8px;padding:12px 0 4px;display:flex}.TdgZiW_failed{flex:1;min-width:0;font-size:12px;line-height:1.5}.TdgZiW_discard,.TdgZiW_save{font:inherit;cursor:pointer;border:1px solid #0000;border-radius:8px;padding:5px 14px;font-size:13px;line-height:1.5}.TdgZiW_discard{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);background:0 0}.TdgZiW_save{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}.TdgZiW_discard:disabled,.TdgZiW_save:disabled{opacity:.4;cursor:default}.TdgZiW_discard:focus-visible,.TdgZiW_save:focus-visible,.TdgZiW_reset:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}";
		const tagId$2 = "dsh-soc-agent-client/MarkItDownAttachmentSettings.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-soc-agent-client";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var MarkItDownAttachmentSettings_module_css_default = {
			"badge": "TdgZiW_badge",
			"badges": "TdgZiW_badges",
			"body": "TdgZiW_body",
			"card": "TdgZiW_card",
			"cardOpen": "TdgZiW_cardOpen",
			"chevron": "TdgZiW_chevron",
			"chevronOpen": "TdgZiW_chevronOpen",
			"description": "TdgZiW_description",
			"discard": "TdgZiW_discard",
			"failed": "TdgZiW_failed",
			"field": "TdgZiW_field",
			"fieldHead": "TdgZiW_fieldHead",
			"fieldLabel": "TdgZiW_fieldLabel",
			"footer": "TdgZiW_footer",
			"headText": "TdgZiW_headText",
			"header": "TdgZiW_header",
			"hint": "TdgZiW_hint",
			"input": "TdgZiW_input",
			"inputInvalid": "TdgZiW_inputInvalid",
			"invalid": "TdgZiW_invalid",
			"name": "TdgZiW_name",
			"reset": "TdgZiW_reset",
			"save": "TdgZiW_save"
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
			constructor(scope) {
				this.scope = scope;
				this.store = (0, _deepseek_ai_dsh_client_runtime_client.createSnapshotStore)(this.state());
				scope.subscribe(() => this.publish());
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
		function Chevron$1({ open }) {
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
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Chevron$1, { open })]
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
		//#region \0dsh-css:/Users/chankokpan/Documents/CITIC_AGENT/packages/soc-agent-client/src/client/SocActionApprovalSettings.module.css.mjs
		const css$1 = ".T0RV3q_card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;list-style:none}.T0RV3q_cardOpen{border-color:var(--dsw-alias-label-dimmed);background:var(--dsw-alias-bg-layer-2)}.T0RV3q_header{width:100%;color:inherit;font:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-radius:12px;align-items:center;gap:12px;padding:14px 16px;display:flex}.T0RV3q_header:focus-visible,.T0RV3q_checkbox:focus-visible,.T0RV3q_shortcut:focus-visible,.T0RV3q_reset:focus-visible,.T0RV3q_discard:focus-visible,.T0RV3q_save:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}.T0RV3q_headText{flex-direction:column;flex:1;gap:4px;min-width:0;display:flex}.T0RV3q_name{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:1.4}.T0RV3q_description,.T0RV3q_hint,.T0RV3q_status{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.5}.T0RV3q_chevron{color:var(--dsw-alias-label-tertiary);flex:none;transition:transform .16s}.T0RV3q_chevronOpen{transform:rotate(180deg)}.T0RV3q_body{border-top:1px solid var(--dsw-alias-border-l2);margin:0 16px;padding:12px 0 8px}.T0RV3q_explanation,.T0RV3q_status,.T0RV3q_failed{margin:0 0 12px}.T0RV3q_groups{gap:14px;display:grid}.T0RV3q_group{border:0;min-width:0;margin:0;padding:0}.T0RV3q_groupTitle{color:var(--dsw-alias-label-secondary);text-transform:uppercase;letter-spacing:.04em;margin:0 0 6px;font-size:12px;font-weight:600;line-height:1.5}.T0RV3q_action{color:var(--dsw-alias-label-primary);cursor:pointer;align-items:flex-start;gap:9px;padding:5px 0;font-size:13px;line-height:1.4;display:flex}.T0RV3q_checkbox{width:16px;height:16px;accent-color:var(--dsw-alias-brand-primary);flex:none;margin:1px 0 0}.T0RV3q_actionText{flex-direction:column;min-width:0;display:flex}.T0RV3q_actionName{font-weight:500}.T0RV3q_actionTool{overflow-wrap:anywhere;color:var(--dsw-alias-label-tertiary);font-family:var(--ds-font-family-code);font-size:11px}.T0RV3q_shortcuts{border-top:1px solid var(--dsw-alias-border-l2);flex-wrap:wrap;gap:8px;margin-top:16px;padding-top:12px;display:flex}.T0RV3q_shortcut,.T0RV3q_reset,.T0RV3q_discard,.T0RV3q_save{border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;background:0 0;border-radius:8px;padding:5px 12px;font-size:12px;line-height:1.5}.T0RV3q_shortcut:hover:not(:disabled),.T0RV3q_reset:hover:not(:disabled),.T0RV3q_discard:hover:not(:disabled){color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-dimmed)}.T0RV3q_footer{border-top:1px solid var(--dsw-alias-border-l2);justify-content:flex-end;align-items:center;gap:8px;margin-top:12px;padding-top:12px;display:flex}.T0RV3q_failed{min-width:0;color:var(--dsw-alias-label-error);flex:1;font-size:12px;line-height:1.5}.T0RV3q_save{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3);border-color:#0000}.T0RV3q_shortcut:disabled,.T0RV3q_reset:disabled,.T0RV3q_discard:disabled,.T0RV3q_save:disabled{opacity:.4;cursor:default}";
		const tagId$1 = "dsh-soc-agent-client/SocActionApprovalSettings.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-soc-agent-client";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var SocActionApprovalSettings_module_css_default = {
			"action": "T0RV3q_action",
			"actionName": "T0RV3q_actionName",
			"actionText": "T0RV3q_actionText",
			"actionTool": "T0RV3q_actionTool",
			"body": "T0RV3q_body",
			"card": "T0RV3q_card",
			"cardOpen": "T0RV3q_cardOpen",
			"checkbox": "T0RV3q_checkbox",
			"chevron": "T0RV3q_chevron",
			"chevronOpen": "T0RV3q_chevronOpen",
			"description": "T0RV3q_description",
			"discard": "T0RV3q_discard",
			"explanation": "T0RV3q_explanation",
			"failed": "T0RV3q_failed",
			"footer": "T0RV3q_footer",
			"group": "T0RV3q_group",
			"groupTitle": "T0RV3q_groupTitle",
			"groups": "T0RV3q_groups",
			"headText": "T0RV3q_headText",
			"header": "T0RV3q_header",
			"hint": "T0RV3q_hint",
			"name": "T0RV3q_name",
			"reset": "T0RV3q_reset",
			"save": "T0RV3q_save",
			"shortcut": "T0RV3q_shortcut",
			"shortcuts": "T0RV3q_shortcuts",
			"status": "T0RV3q_status"
		};
		//#endregion
		//#region src/client/SocActionApprovalSettings.tsx
		const CHANNEL$1 = "/soc-agent-config";
		function validCatalog(value) {
			if (!Array.isArray(value)) return [];
			const seen = /* @__PURE__ */ new Set();
			return value.flatMap((item) => {
				if (!item || typeof item !== "object") return [];
				const candidate = item;
				if (typeof candidate.name !== "string" || typeof candidate.group !== "string" || typeof candidate.label !== "string") return [];
				if (candidate.name.length === 0 || seen.has(candidate.name)) return [];
				seen.add(candidate.name);
				return [{
					name: candidate.name,
					group: candidate.group,
					label: candidate.label
				}];
			});
		}
		function namesOf(value) {
			return new Set(Array.isArray(value) ? value.filter((name) => typeof name === "string") : []);
		}
		var SocActionApprovalController = class {
			connection;
			scope;
			actions = [];
			catalogLoaded = false;
			catalogFailed = false;
			draft;
			resetOnSave = false;
			saving = false;
			failed = false;
			store;
			constructor(connection, scope) {
				this.connection = connection;
				this.scope = scope;
				this.store = (0, _deepseek_ai_dsh_client_runtime_client.createSnapshotStore)(this.state());
				scope.subscribe(() => this.publish());
				this.loadCatalog();
			}
			inject() {
				return {
					hooks: { socActionApproval: this.store },
					toggle: (name, ask) => this.toggle(name, ask),
					requireApprovalForAll: () => this.stage(/* @__PURE__ */ new Set(), true),
					allowAllKnownActions: () => this.stage(new Set(this.actions.map((action) => action.name)), false),
					reset: () => this.stage(/* @__PURE__ */ new Set(), true),
					save: () => {
						this.save();
					},
					discard: () => {
						this.draft = void 0;
						this.resetOnSave = false;
						this.failed = false;
						this.publish();
					}
				};
			}
			async loadCatalog() {
				try {
					const response = await this.connection.rpc.call(CHANNEL$1, "get-action-catalog", {});
					if (!response?.ok) throw new Error("catalog");
					const actions = validCatalog(response.value?.actions);
					if (actions.length === 0) throw new Error("catalog");
					this.actions = actions;
					this.catalogLoaded = true;
				} catch {
					this.catalogFailed = true;
				}
				this.publish();
			}
			toggle(name, ask) {
				if (!this.actions.some((action) => action.name === name)) return;
				const next = this.draft === void 0 ? namesOf(this.scope.getSnapshot().value?.autoApproveActions) : new Set(this.draft);
				if (ask) next.delete(name);
				else next.add(name);
				this.stage(next, false);
			}
			stage(actions, resetOnSave) {
				this.draft = actions;
				this.resetOnSave = resetOnSave;
				this.failed = false;
				this.publish();
			}
			async save() {
				const state = this.state();
				if (this.saving || !state.writable || !state.dirty || state.invalid) return;
				this.saving = true;
				this.publish();
				try {
					if (this.resetOnSave) await this.scope.unset("autoApproveActions");
					else await this.scope.set("autoApproveActions", [...this.draft ?? /* @__PURE__ */ new Set()]);
					this.draft = void 0;
					this.resetOnSave = false;
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
				const saved = namesOf(snapshot.value?.autoApproveActions);
				const autoApproveActions = this.draft === void 0 ? saved : this.draft;
				return {
					available: snapshot.status !== "unavailable",
					writable: snapshot.writable,
					dirty: this.draft !== void 0,
					invalid: this.catalogFailed,
					saving: this.saving,
					failed: this.failed,
					catalogLoaded: this.catalogLoaded,
					catalogFailed: this.catalogFailed,
					actions: this.actions,
					autoApproveActions: [...autoApproveActions]
				};
			}
			publish() {
				this.store.set(this.state());
			}
		};
		function Chevron({ open }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				className: open ? `${SocActionApprovalSettings_module_css_default.chevron} ${SocActionApprovalSettings_module_css_default.chevronOpen}` : SocActionApprovalSettings_module_css_default.chevron,
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
		function SocActionApprovalSettingsCard(props) {
			const state = props.useSocActionApproval((value) => value);
			const [open, setOpen] = (0, react.useState)(false);
			if (!state.available) return null;
			const disabled = !state.writable || state.saving || !state.catalogLoaded;
			const auto = new Set(state.autoApproveActions);
			const groups = [...new Set(state.actions.map((action) => action.group))];
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				className: open ? `${SocActionApprovalSettings_module_css_default.card} ${SocActionApprovalSettings_module_css_default.cardOpen}` : SocActionApprovalSettings_module_css_default.card,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					className: SocActionApprovalSettings_module_css_default.header,
					type: "button",
					"aria-expanded": open,
					"aria-label": `${open ? "Collapse" : "Expand"} settings: SOC action approvals`,
					onClick: () => setOpen((value) => !value),
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: SocActionApprovalSettings_module_css_default.headText,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: SocActionApprovalSettings_module_css_default.name,
							children: "SOC action approvals"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: SocActionApprovalSettings_module_css_default.description,
							children: "Choose which SOC actions must ask before they run."
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Chevron, { open })]
				}), open && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: SocActionApprovalSettings_module_css_default.body,
					children: [
						!state.writable && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: SocActionApprovalSettings_module_css_default.status,
							role: "status",
							children: "This deployment stores settings read-only."
						}),
						state.catalogFailed && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: SocActionApprovalSettings_module_css_default.failed,
							role: "status",
							children: "Could not load the SOC action catalog."
						}),
						!state.catalogLoaded && !state.catalogFailed && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: SocActionApprovalSettings_module_css_default.status,
							role: "status",
							children: "Loading actions…"
						}),
						state.catalogLoaded && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: SocActionApprovalSettings_module_css_default.explanation,
								children: "Checked actions ask for approval. Unchecked actions run automatically, while all server-side safety checks still apply."
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: SocActionApprovalSettings_module_css_default.groups,
								children: groups.map((group) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("fieldset", {
									className: SocActionApprovalSettings_module_css_default.group,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("legend", {
										className: SocActionApprovalSettings_module_css_default.groupTitle,
										children: group
									}), state.actions.filter((action) => action.group === group).map((action) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										className: SocActionApprovalSettings_module_css_default.action,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											className: SocActionApprovalSettings_module_css_default.checkbox,
											type: "checkbox",
											checked: !auto.has(action.name),
											disabled,
											onChange: (event) => props.toggle(action.name, event.currentTarget.checked)
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: SocActionApprovalSettings_module_css_default.actionText,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: SocActionApprovalSettings_module_css_default.actionName,
												children: action.label
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: SocActionApprovalSettings_module_css_default.actionTool,
												children: action.name
											})]
										})]
									}, action.name))]
								}, group))
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: SocActionApprovalSettings_module_css_default.shortcuts,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: SocActionApprovalSettings_module_css_default.shortcut,
										type: "button",
										disabled,
										onClick: props.requireApprovalForAll,
										children: "Require approval for all"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: SocActionApprovalSettings_module_css_default.shortcut,
										type: "button",
										disabled,
										onClick: props.allowAllKnownActions,
										children: "Allow all known actions"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: SocActionApprovalSettings_module_css_default.reset,
										type: "button",
										disabled,
										onClick: props.reset,
										children: "Reset to default"
									})
								]
							})
						] }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: SocActionApprovalSettings_module_css_default.footer,
							children: [
								state.failed && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: SocActionApprovalSettings_module_css_default.failed,
									role: "status",
									children: "Could not save these approval settings."
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: SocActionApprovalSettings_module_css_default.discard,
									type: "button",
									disabled: !state.dirty || state.saving,
									onClick: props.discard,
									children: "Discard"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: SocActionApprovalSettings_module_css_default.save,
									type: "button",
									disabled: !state.dirty || state.invalid || state.saving || !state.catalogLoaded,
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
		//#region \0dsh-css:/Users/chankokpan/Documents/CITIC_AGENT/packages/soc-agent-client/src/client/SocActionPolicyMenu.module.css.mjs
		const css = ".X9dZ8W_root{align-items:center;display:inline-flex;position:relative}.X9dZ8W_trigger{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);height:30px;color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;border-radius:8px;align-items:center;gap:6px;padding:0 10px;font-size:12px;display:inline-flex}.X9dZ8W_trigger:hover,.X9dZ8W_trigger[aria-expanded=true]{border-color:var(--dsw-alias-label-dimmed);color:var(--dsw-alias-label-primary)}.X9dZ8W_trigger:focus-visible,.X9dZ8W_modeRadio:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}.X9dZ8W_icon{font-size:15px;line-height:1}.X9dZ8W_panel{z-index:20;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);width:min(380px,100vw - 24px);max-height:min(70vh,560px);box-shadow:var(--dsw-shadow-lv2);border-radius:12px;padding:14px;position:absolute;bottom:calc(100% + 8px);right:0;overflow-y:auto}.X9dZ8W_error,.X9dZ8W_status{color:var(--dsw-alias-label-tertiary);margin:5px 0 0;font-size:11px;line-height:1.5}.X9dZ8W_error{color:var(--dsw-alias-label-error)}.X9dZ8W_modes{border:0;gap:7px;margin-top:12px;padding:0;display:grid}.X9dZ8W_modeLegend{color:var(--dsw-alias-label-secondary);margin:0 0 4px;font-size:11px;font-weight:600}.X9dZ8W_mode{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);cursor:pointer;border-radius:8px;align-items:center;gap:8px;padding:8px 9px;font-size:12px;line-height:1.4;display:flex}.X9dZ8W_mode:hover{border-color:var(--dsw-alias-label-dimmed)}.X9dZ8W_modeRadio{width:15px;height:15px;accent-color:var(--dsw-alias-brand-primary);flex:none;margin:0}.X9dZ8W_modeText{gap:2px;display:grid}.X9dZ8W_modeLabel{color:var(--dsw-alias-label-primary);font-weight:600}.X9dZ8W_modeDescription{color:var(--dsw-alias-label-tertiary);font-size:11px}";
		const tagId = "dsh-soc-agent-client/SocActionPolicyMenu.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-soc-agent-client";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var SocActionPolicyMenu_module_css_default = {
			"error": "X9dZ8W_error",
			"icon": "X9dZ8W_icon",
			"mode": "X9dZ8W_mode",
			"modeDescription": "X9dZ8W_modeDescription",
			"modeLabel": "X9dZ8W_modeLabel",
			"modeLegend": "X9dZ8W_modeLegend",
			"modeRadio": "X9dZ8W_modeRadio",
			"modeText": "X9dZ8W_modeText",
			"modes": "X9dZ8W_modes",
			"panel": "X9dZ8W_panel",
			"root": "X9dZ8W_root",
			"status": "X9dZ8W_status",
			"trigger": "X9dZ8W_trigger"
		};
		//#endregion
		//#region src/client/SocActionPolicyMenu.tsx
		const CHANNEL = "/soc-agent-config";
		function parsePolicy(value) {
			if (!value || typeof value !== "object") return void 0;
			const candidate = value;
			const actions = validCatalog(candidate.actions);
			const autoApproveActions = Array.isArray(candidate.autoApproveActions) ? candidate.autoApproveActions.filter((name) => typeof name === "string" && actions.some((action) => action.name === name)) : [];
			const source = candidate.source === "session" ? "session" : "defaults";
			return actions.length === 0 ? void 0 : {
				actions,
				autoApproveActions,
				source
			};
		}
		function modeOf(policy) {
			if (policy.source === "defaults") return "soc";
			return policy.autoApproveActions.length === 0 ? "ask" : "soc";
		}
		function SocActionPolicyMenu({ connection, sessionId }) {
			const [open, setOpen] = (0, react.useState)(false);
			const [policy, setPolicy] = (0, react.useState)();
			const [draftMode, setDraftMode] = (0, react.useState)();
			const [loading, setLoading] = (0, react.useState)(false);
			const [saving, setSaving] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)();
			(0, react.useEffect)(() => {
				let live = true;
				setLoading(true);
				setError(void 0);
				connection.rpc.call(CHANNEL, "get-action-policy", { session_id: String(sessionId) }).then((response) => {
					if (!live) return;
					if (!response?.ok) throw new Error(response?.error?.message || "The session action policy is unavailable.");
					const next = parsePolicy(response.value);
					if (next === void 0) throw new Error("The session action policy is unavailable.");
					setPolicy(next);
					setDraftMode(modeOf(next));
				}).catch((reason) => {
					if (live) setError(reason instanceof Error ? reason.message : "The session action policy is unavailable.");
				}).finally(() => {
					if (live) setLoading(false);
				});
				return () => {
					live = false;
				};
			}, [connection, sessionId]);
			const currentMode = policy === void 0 ? void 0 : modeOf(policy);
			const selectedMode = draftMode ?? currentMode;
			const selectMode = async (mode) => {
				if (policy === void 0 || saving) return;
				if (mode === currentMode && !(mode === "soc" && policy.source === "session")) {
					setOpen(false);
					return;
				}
				setDraftMode(mode);
				setSaving(true);
				setError(void 0);
				try {
					const response = mode === "soc" ? await connection.rpc.call(CHANNEL, "reset-session-action-policy", { session_id: String(sessionId) }) : await connection.rpc.call(CHANNEL, "set-session-action-policy", {
						session_id: String(sessionId),
						auto_approve_actions: []
					});
					if (!response?.ok) throw new Error(response?.error?.message || "The session action policy could not be saved.");
					const next = parsePolicy(response.value);
					if (next === void 0) throw new Error("The session action policy could not be saved.");
					setPolicy(next);
					setDraftMode(modeOf(next));
					setOpen(false);
				} catch (reason) {
					setError(reason instanceof Error ? reason.message : "The session action policy could not be saved.");
				} finally {
					setSaving(false);
				}
			};
			const modeLabel = selectedMode === "ask" ? "Ask for approval" : "SOC mode";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: SocActionPolicyMenu_module_css_default.root,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					className: SocActionPolicyMenu_module_css_default.trigger,
					type: "button",
					"aria-expanded": open,
					"aria-controls": `soc-action-policy-${String(sessionId)}`,
					onClick: () => setOpen((value) => !value),
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: SocActionPolicyMenu_module_css_default.icon,
						"aria-hidden": "true",
						children: "✓"
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: modeLabel })]
				}), open && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: SocActionPolicyMenu_module_css_default.panel,
					id: `soc-action-policy-${String(sessionId)}`,
					role: "dialog",
					"aria-label": "SOC action modes",
					children: [
						loading && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: SocActionPolicyMenu_module_css_default.status,
							children: "Loading actions…"
						}),
						error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: SocActionPolicyMenu_module_css_default.error,
							role: "status",
							children: error
						}),
						policy !== void 0 && !loading && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("fieldset", {
							className: SocActionPolicyMenu_module_css_default.modes,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("legend", {
									className: SocActionPolicyMenu_module_css_default.modeLegend,
									children: "Choose a mode"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: SocActionPolicyMenu_module_css_default.mode,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										className: SocActionPolicyMenu_module_css_default.modeRadio,
										type: "radio",
										name: `soc-action-mode-${String(sessionId)}`,
										checked: selectedMode === "ask",
										readOnly: true,
										disabled: saving,
										onClick: () => {
											selectMode("ask");
										}
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: SocActionPolicyMenu_module_css_default.modeText,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: SocActionPolicyMenu_module_css_default.modeLabel,
											children: "Ask for approval"
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: SocActionPolicyMenu_module_css_default.modeDescription,
											children: "Ask before every known SOC action."
										})]
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: SocActionPolicyMenu_module_css_default.mode,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										className: SocActionPolicyMenu_module_css_default.modeRadio,
										type: "radio",
										name: `soc-action-mode-${String(sessionId)}`,
										checked: selectedMode === "soc",
										readOnly: true,
										disabled: saving,
										onClick: () => {
											selectMode("soc");
										}
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: SocActionPolicyMenu_module_css_default.modeText,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: SocActionPolicyMenu_module_css_default.modeLabel,
											children: "SOC mode"
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: SocActionPolicyMenu_module_css_default.modeDescription,
											children: "Use the approval checklist from Settings → Plugins."
										})]
									})]
								})
							]
						})
					]
				})]
			});
		}
		//#endregion
		//#region ../../vendor/deepseek-harness/vendor/cosmokit/lib/index.js
		/** Return true when a value is `null` or `undefined`. */
		function isNullable(value) {
			return value === null || value === void 0;
		}
		/** Return true for non-array object values. */
		function isPlainObject(data) {
			return data && typeof data === "object" && !Array.isArray(data);
		}
		/** Filter object entries and return a new object. */
		function filterKeys(object, filter) {
			return Object.fromEntries(Object.entries(object).filter(([key, value]) => filter(key, value)));
		}
		/** Map object values while preserving the original key set. */
		function mapValues(object, transform) {
			return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, transform(value, key)]));
		}
		/** Pick selected keys from an object, optionally including `undefined` values. */
		function pick(source, keys, forced) {
			if (!keys) return { ...source };
			const result = {};
			for (const key of keys) if (forced || source[key] !== void 0) result[key] = source[key];
			return result;
		}
		/** Test values using `instanceof` with a `toStringTag` fallback. */
		function is(type, value) {
			if (arguments.length === 1) return (value) => is(type, value);
			return type in globalThis && value instanceof globalThis[type] || Object.prototype.toString.call(value).slice(8, -1) === type;
		}
		function isArrayBufferLike(value) {
			return is("ArrayBuffer", value) || is("SharedArrayBuffer", value);
		}
		function isArrayBufferSource(value) {
			return isArrayBufferLike(value) || ArrayBuffer.isView(value);
		}
		/** Binary source detection and base64/hex conversion helpers. */
		var Binary;
		(function(Binary) {
			Binary.is = isArrayBufferLike;
			Binary.isSource = isArrayBufferSource;
			function fromSource(source) {
				if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
				else return source;
			}
			Binary.fromSource = fromSource;
			function toBase64(source) {
				source = fromSource(source);
				if (typeof Buffer !== "undefined") return Buffer.from(source).toString("base64");
				let binary = "";
				const bytes = new Uint8Array(source);
				for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
				return btoa(binary);
			}
			Binary.toBase64 = toBase64;
			function fromBase64(source) {
				if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "base64"));
				return Uint8Array.from(atob(source), (c) => c.charCodeAt(0));
			}
			Binary.fromBase64 = fromBase64;
			function toHex(source) {
				source = fromSource(source);
				if (typeof Buffer !== "undefined") return Buffer.from(source).toString("hex");
				return Array.from(new Uint8Array(source), (byte) => byte.toString(16).padStart(2, "0")).join("");
			}
			Binary.toHex = toHex;
			function fromHex(source) {
				if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "hex"));
				const hex = source.length % 2 === 0 ? source : source.slice(0, source.length - 1);
				const buffer = [];
				for (let i = 0; i < hex.length; i += 2) buffer.push(parseInt(`${hex[i]}${hex[i + 1]}`, 16));
				return Uint8Array.from(buffer).buffer;
			}
			Binary.fromHex = fromHex;
		})(Binary || (Binary = {}));
		Binary.fromBase64;
		Binary.toBase64;
		Binary.fromHex;
		Binary.toHex;
		/** Deep-clone common JavaScript values while preserving prototypes and cycles. */
		function clone(source, refs = /* @__PURE__ */ new Map()) {
			if (!source || typeof source !== "object") return source;
			if (is("Date", source)) return new Date(source.valueOf());
			if (is("RegExp", source)) return new RegExp(source.source, source.flags);
			if (isArrayBufferLike(source)) return source.slice(0);
			if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
			const cached = refs.get(source);
			if (cached) return cached;
			if (Array.isArray(source)) {
				const result = [];
				refs.set(source, result);
				source.forEach((value, index) => {
					result[index] = Reflect.apply(clone, null, [value, refs]);
				});
				return result;
			}
			const result = Object.create(Object.getPrototypeOf(source));
			refs.set(source, result);
			for (const key of Reflect.ownKeys(source)) {
				const descriptor = { ...Reflect.getOwnPropertyDescriptor(source, key) };
				if ("value" in descriptor) descriptor.value = Reflect.apply(clone, null, [descriptor.value, refs]);
				Reflect.defineProperty(result, key, descriptor);
			}
			return result;
		}
		/** Deeply compare arrays, dates, regexps, buffers, and plain object fields. */
		function deepEqual(a, b, strict) {
			if (a === b) return true;
			if (!strict && isNullable(a) && isNullable(b)) return true;
			if (typeof a !== typeof b) return false;
			if (typeof a !== "object") return false;
			if (!a || !b) return false;
			function check(test, then) {
				return test(a) ? test(b) ? then(a, b) : false : test(b) ? false : void 0;
			}
			return check(Array.isArray, (a, b) => a.length === b.length && a.every((item, index) => deepEqual(item, b[index]))) ?? check(is("Date"), (a, b) => a.valueOf() === b.valueOf()) ?? check(is("RegExp"), (a, b) => a.source === b.source && a.flags === b.flags) ?? check(isArrayBufferLike, (a, b) => {
				if (a.byteLength !== b.byteLength) return false;
				const viewA = new Uint8Array(a);
				const viewB = new Uint8Array(b);
				for (let i = 0; i < viewA.length; i++) if (viewA[i] !== viewB[i]) return false;
				return true;
			}) ?? Object.keys({
				...a,
				...b
			}).every((key) => deepEqual(a[key], b[key], strict));
		}
		/** Time constants plus parsing and formatting helpers. */
		var Time;
		(function(Time) {
			Time.millisecond = 1;
			Time.second = 1e3;
			Time.minute = Time.second * 60;
			Time.hour = Time.minute * 60;
			Time.day = Time.hour * 24;
			Time.week = Time.day * 7;
			let timezoneOffset = (/* @__PURE__ */ new Date()).getTimezoneOffset();
			function setTimezoneOffset(offset) {
				timezoneOffset = offset;
			}
			Time.setTimezoneOffset = setTimezoneOffset;
			function getTimezoneOffset() {
				return timezoneOffset;
			}
			Time.getTimezoneOffset = getTimezoneOffset;
			function getDateNumber(date = /* @__PURE__ */ new Date(), offset) {
				if (typeof date === "number") date = new Date(date);
				if (offset === void 0) offset = timezoneOffset;
				return Math.floor((date.valueOf() / Time.minute - offset) / 1440);
			}
			Time.getDateNumber = getDateNumber;
			function fromDateNumber(value, offset) {
				const date = new Date(value * Time.day);
				if (offset === void 0) offset = timezoneOffset;
				return new Date(+date + offset * Time.minute);
			}
			Time.fromDateNumber = fromDateNumber;
			const numeric = /\d+(?:\.\d+)?/.source;
			const timeRegExp = new RegExp(`^${[
				"w(?:eek(?:s)?)?",
				"d(?:ay(?:s)?)?",
				"h(?:our(?:s)?)?",
				"m(?:in(?:ute)?(?:s)?)?",
				"s(?:ec(?:ond)?(?:s)?)?"
			].map((unit) => `(${numeric}${unit})?`).join("")}$`);
			function parseTime(source) {
				const capture = timeRegExp.exec(source);
				if (!capture) return 0;
				return (parseFloat(capture[1]) * Time.week || 0) + (parseFloat(capture[2]) * Time.day || 0) + (parseFloat(capture[3]) * Time.hour || 0) + (parseFloat(capture[4]) * Time.minute || 0) + (parseFloat(capture[5]) * Time.second || 0);
			}
			Time.parseTime = parseTime;
			function parseDate(date) {
				const parsed = parseTime(date);
				if (parsed) date = Date.now() + parsed;
				else if (/^\d{1,2}(:\d{1,2}){1,2}$/.test(date)) date = `${(/* @__PURE__ */ new Date()).toLocaleDateString()}-${date}`;
				else if (/^\d{1,2}-\d{1,2}-\d{1,2}(:\d{1,2}){1,2}$/.test(date)) date = `${(/* @__PURE__ */ new Date()).getFullYear()}-${date}`;
				return date ? new Date(date) : /* @__PURE__ */ new Date();
			}
			Time.parseDate = parseDate;
			function format(ms) {
				const abs = Math.abs(ms);
				if (abs >= Time.day - Time.hour / 2) return Math.round(ms / Time.day) + "d";
				else if (abs >= Time.hour - Time.minute / 2) return Math.round(ms / Time.hour) + "h";
				else if (abs >= Time.minute - Time.second / 2) return Math.round(ms / Time.minute) + "m";
				else if (abs >= Time.second) return Math.round(ms / Time.second) + "s";
				return ms + "ms";
			}
			Time.format = format;
			function toDigits(source, length = 2) {
				return source.toString().padStart(length, "0");
			}
			Time.toDigits = toDigits;
			function template(template, time = /* @__PURE__ */ new Date()) {
				return template.replace("yyyy", time.getFullYear().toString()).replace("yy", time.getFullYear().toString().slice(2)).replace("MM", toDigits(time.getMonth() + 1)).replace("dd", toDigits(time.getDate())).replace("hh", toDigits(time.getHours())).replace("mm", toDigits(time.getMinutes())).replace("ss", toDigits(time.getSeconds())).replace("SSS", toDigits(time.getMilliseconds(), 3));
			}
			Time.template = template;
		})(Time || (Time = {}));
		//#endregion
		//#region ../../vendor/deepseek-harness/vendor/schemastery/lib/index.mjs
		const kSchema = Symbol.for("schemastery");
		const kValidationError = Symbol.for("ValidationError");
		globalThis.__schemastery_index__ ??= 0;
		globalThis.__schemastery_refs__ = void 0;
		var ValidationError = class extends TypeError {
			options;
			name = "ValidationError";
			constructor(message, options) {
				let prefix = "$";
				for (const segment of options.path || []) if (typeof segment === "string") prefix += "." + segment;
				else if (typeof segment === "number") prefix += "[" + segment + "]";
				else if (typeof segment === "symbol") prefix += `[Symbol(${segment.toString()})]`;
				if (prefix.startsWith(".")) prefix = prefix.slice(1);
				super((prefix === "$" ? "" : `${prefix} `) + message);
				this.options = options;
			}
			static is(error) {
				return !!error?.[kValidationError];
			}
		};
		Object.defineProperty(ValidationError.prototype, kValidationError, { value: true });
		const Schema = function(options) {
			const schema = function(data, options = {}) {
				return Schema.resolve(data, schema, options)[0];
			};
			if (options.refs) {
				const refs = mapValues(options.refs, (options) => new Schema(options));
				const getRef = (uid) => refs[uid];
				for (const key in refs) {
					const options = refs[key];
					options.sKey = getRef(options.sKey);
					options.inner = getRef(options.inner);
					options.list = options.list && options.list.map(getRef);
					options.dict = options.dict && mapValues(options.dict, getRef);
				}
				return refs[options.uid];
			}
			Object.assign(schema, options);
			if (typeof schema.callback === "string") try {
				schema.callback = new Function("return " + schema.callback)();
			} catch {}
			Object.defineProperty(schema, "uid", { value: globalThis.__schemastery_index__++ });
			Object.setPrototypeOf(schema, Schema.prototype);
			schema.meta ||= {};
			schema.toString = schema.toString.bind(schema);
			return schema;
		};
		Schema.prototype = Object.create(Function.prototype);
		Schema.prototype[kSchema] = true;
		Object.defineProperty(Schema.prototype, "~standard", { get() {
			return {
				version: 1,
				vendor: "schemastery",
				validate: (value) => {
					try {
						return { value: Schema.resolve(value, this, {})[0] };
					} catch (error) {
						if (ValidationError.is(error)) return { issues: [{
							message: error.message,
							path: error.options.path
						}] };
						throw error;
					}
				}
			};
		} });
		Schema.ValidationError = ValidationError;
		Schema.prototype.toJSON = function toJSON() {
			if (globalThis.__schemastery_refs__) {
				globalThis.__schemastery_refs__[this.uid] ??= JSON.parse(JSON.stringify({ ...this }));
				return this.uid;
			}
			globalThis.__schemastery_refs__ = { [this.uid]: { ...this } };
			globalThis.__schemastery_refs__[this.uid] = JSON.parse(JSON.stringify({ ...this }));
			const result = {
				uid: this.uid,
				refs: globalThis.__schemastery_refs__
			};
			globalThis.__schemastery_refs__ = void 0;
			return result;
		};
		Schema.prototype.set = function set(key, value) {
			this.dict[key] = value;
			return this;
		};
		Schema.prototype.push = function push(value) {
			this.list.push(value);
			return this;
		};
		function mergeDesc(original, messages) {
			const result = typeof original === "string" ? { "": original } : { ...original };
			for (const locale in messages) {
				const value = messages[locale];
				if (value?.$description || value?.$desc) result[locale] = value.$description || value.$desc;
				else if (typeof value === "string") result[locale] = value;
			}
			return result;
		}
		function getInner(value) {
			return value?.$value ?? value?.$inner;
		}
		function extractKeys(data) {
			return filterKeys(data ?? {}, (key) => !key.startsWith("$"));
		}
		Schema.prototype.i18n = function i18n(messages) {
			const schema = Schema(this);
			const desc = mergeDesc(schema.meta.description, messages);
			if (Object.keys(desc).length) schema.meta.description = desc;
			if (schema.dict) schema.dict = mapValues(schema.dict, (inner, key) => {
				return inner.i18n(mapValues(messages, (data) => getInner(data)?.[key] ?? data?.[key]));
			});
			if (schema.list) schema.list = schema.list.map((inner, index) => {
				return inner.i18n(mapValues(messages, (data = {}) => {
					if (Array.isArray(getInner(data))) return getInner(data)[index];
					if (Array.isArray(data)) return data[index];
					return extractKeys(data);
				}));
			});
			if (schema.inner) schema.inner = schema.inner.i18n(mapValues(messages, (data) => {
				if (getInner(data)) return getInner(data);
				return extractKeys(data);
			}));
			if (schema.sKey) schema.sKey = schema.sKey.i18n(mapValues(messages, (data) => data?.$key));
			return schema;
		};
		Schema.prototype.extra = function extra(key, value) {
			const schema = Schema(this);
			schema.meta = {
				...schema.meta,
				[key]: value
			};
			return schema;
		};
		for (const key of [
			"required",
			"disabled",
			"collapse",
			"hidden",
			"loose"
		]) Object.assign(Schema.prototype, { [key](value = true) {
			const schema = Schema(this);
			schema.meta = {
				...schema.meta,
				[key]: value
			};
			return schema;
		} });
		Schema.prototype.deprecated = function deprecated() {
			const schema = Schema(this);
			schema.meta.badges ||= [];
			schema.meta.badges.push({
				text: "deprecated",
				type: "danger"
			});
			return schema;
		};
		Schema.prototype.experimental = function experimental() {
			const schema = Schema(this);
			schema.meta.badges ||= [];
			schema.meta.badges.push({
				text: "experimental",
				type: "warning"
			});
			return schema;
		};
		Schema.prototype.pattern = function pattern(regexp) {
			const schema = Schema(this);
			const pattern = pick(regexp, ["source", "flags"]);
			schema.meta = {
				...schema.meta,
				pattern
			};
			return schema;
		};
		Schema.prototype.simplify = function simplify(value) {
			if (deepEqual(value, this.meta.default, this.type === "dict")) return null;
			if (isNullable(value)) return value;
			if (this.type === "object" || this.type === "dict") {
				const result = {};
				for (const key in value) {
					const item = (this.type === "object" ? this.dict[key] : this.inner)?.simplify(value[key]);
					if (this.type === "dict" || !isNullable(item)) result[key] = item;
				}
				if (deepEqual(result, this.meta.default, this.type === "dict")) return null;
				return result;
			} else if (this.type === "array" || this.type === "tuple") {
				const result = [];
				value.forEach((value, index) => {
					const schema = this.type === "array" ? this.inner : this.list[index];
					const item = schema ? schema.simplify(value) : value;
					result.push(item);
				});
				return result;
			} else if (this.type === "intersect") {
				const result = {};
				for (const item of this.list) Object.assign(result, item.simplify(value));
				return result;
			} else if (this.type === "union") for (const schema of this.list) try {
				Schema.resolve(value, schema, {});
				return schema.simplify(value);
			} catch {}
			return value;
		};
		Schema.prototype.toString = function toString(inline) {
			return formatters[this.type]?.(this, inline) ?? `Schema<${this.type}>`;
		};
		Schema.prototype.role = function role(role, extra) {
			const schema = Schema(this);
			schema.meta = {
				...schema.meta,
				role,
				extra
			};
			return schema;
		};
		for (const key of [
			"default",
			"link",
			"comment",
			"description",
			"max",
			"min",
			"step"
		]) Object.assign(Schema.prototype, { [key](value) {
			const schema = Schema(this);
			schema.meta = {
				...schema.meta,
				[key]: value
			};
			return schema;
		} });
		const resolvers = {};
		Schema.extend = function extend(type, resolve) {
			resolvers[type] = resolve;
		};
		Schema.resolve = function resolve(data, schema, options = {}, strict = false) {
			if (!schema) return [data];
			if (options.ignore?.(data, schema)) return [data];
			if (isNullable(data) && schema.type !== "lazy") {
				if (schema.meta.required) throw new ValidationError(`missing required value`, options);
				let current = schema;
				let fallback = schema.meta.default;
				while (current?.type === "intersect" && isNullable(fallback)) {
					current = current.list[0];
					fallback = current?.meta.default;
				}
				if (isNullable(fallback)) return [data];
				data = clone(fallback);
			}
			const callback = resolvers[schema.type];
			if (!callback) throw new ValidationError(`unsupported type "${schema.type}"`, options);
			try {
				return callback(data, schema, options, strict);
			} catch (error) {
				if (!schema.meta.loose) throw error;
				return [schema.meta.default];
			}
		};
		Schema.from = function from(source) {
			if (isNullable(source)) return Schema.any();
			else if ([
				"string",
				"number",
				"boolean"
			].includes(typeof source)) return Schema.const(source).required();
			else if (source[kSchema]) return source;
			else if (typeof source === "function") switch (source) {
				case String: return Schema.string().required();
				case Number: return Schema.number().required();
				case Boolean: return Schema.boolean().required();
				case Function: return Schema.function().required();
				default: return Schema.is(source).required();
			}
			else throw new TypeError(`cannot infer schema from ${source}`);
		};
		Schema.lazy = function lazy(builder) {
			const toJSON = () => {
				if (!schema.inner[kSchema]) {
					schema.inner = schema.builder();
					schema.inner.meta = {
						...schema.meta,
						...schema.inner.meta
					};
				}
				return schema.inner.toJSON();
			};
			const schema = new Schema({
				type: "lazy",
				builder,
				inner: { toJSON }
			});
			return schema;
		};
		Schema.natural = function natural() {
			return Schema.number().step(1).min(0);
		};
		Schema.percent = function percent() {
			return Schema.number().step(.01).min(0).max(1).role("slider");
		};
		Schema.date = function date() {
			return Schema.union([Schema.is(Date), Schema.transform(Schema.string().role("datetime"), (value, options) => {
				const date = new Date(value);
				if (isNaN(+date)) throw new ValidationError(`invalid date "${value}"`, options);
				return date;
			}, true)]);
		};
		Schema.regExp = function regExp(flag = "") {
			return Schema.union([Schema.is(RegExp), Schema.transform(Schema.string().role("regexp", { flag }), (value, options) => {
				try {
					return new RegExp(value, flag);
				} catch (e) {
					throw new ValidationError(e.message, options);
				}
			}, true)]);
		};
		Schema.arrayBuffer = function arrayBuffer(encoding) {
			return Schema.union([
				Schema.is(ArrayBuffer),
				Schema.is(SharedArrayBuffer),
				Schema.transform(Schema.any(), (value, options) => {
					if (Binary.isSource(value)) return Binary.fromSource(value);
					throw new ValidationError(`expected ArrayBufferSource but got ${value}`, options);
				}, true),
				...encoding ? [Schema.transform(Schema.string(), (value, options) => {
					try {
						return encoding === "base64" ? Binary.fromBase64(value) : Binary.fromHex(value);
					} catch (e) {
						throw new ValidationError(e.message, options);
					}
				}, true)] : []
			]);
		};
		Schema.extend("lazy", (data, schema, options, strict) => {
			if (!schema.inner[kSchema]) {
				schema.inner = schema.builder();
				schema.inner.meta = {
					...schema.meta,
					...schema.inner.meta
				};
			}
			return Schema.resolve(data, schema.inner, options, strict);
		});
		Schema.extend("any", (data) => {
			return [data];
		});
		Schema.extend("never", (data, _, options) => {
			throw new ValidationError(`expected nullable but got ${data}`, options);
		});
		Schema.extend("const", (data, { value }, options) => {
			if (deepEqual(data, value)) return [value];
			throw new ValidationError(`expected ${value} but got ${data}`, options);
		});
		function checkWithinRange(data, meta, description, options, skipMin = false) {
			const { max = Infinity, min = -Infinity } = meta;
			if (data > max) throw new ValidationError(`expected ${description} <= ${max} but got ${data}`, options);
			if (data < min && !skipMin) throw new ValidationError(`expected ${description} >= ${min} but got ${data}`, options);
		}
		Schema.extend("string", (data, { meta }, options) => {
			if (typeof data !== "string") throw new ValidationError(`expected string but got ${data}`, options);
			if (meta.pattern) {
				const regexp = new RegExp(meta.pattern.source, meta.pattern.flags);
				if (!regexp.test(data)) throw new ValidationError(`expect string to match regexp ${regexp}`, options);
			}
			checkWithinRange(data.length, meta, "string length", options);
			return [data];
		});
		function decimalShift(data, digits) {
			const str = data.toString();
			if (str.includes("e")) return data * Math.pow(10, digits);
			const index = str.indexOf(".");
			if (index === -1) return data * Math.pow(10, digits);
			const frac = str.slice(index + 1);
			const integer = str.slice(0, index);
			if (frac.length <= digits) return +(integer + frac.padEnd(digits, "0"));
			return +(integer + frac.slice(0, digits) + "." + frac.slice(digits));
		}
		function isMultipleOf(data, min, step) {
			step = Math.abs(step);
			if (!/^\d+\.\d+$/.test(step.toString())) return (data - min) % step === 0;
			const index = step.toString().indexOf(".");
			const digits = step.toString().slice(index + 1).length;
			return Math.abs(decimalShift(data, digits) - decimalShift(min, digits)) % decimalShift(step, digits) === 0;
		}
		Schema.extend("number", (data, { meta }, options) => {
			if (typeof data !== "number") throw new ValidationError(`expected number but got ${data}`, options);
			checkWithinRange(data, meta, "number", options);
			const { step } = meta;
			if (step && !isMultipleOf(data, meta.min ?? 0, step)) throw new ValidationError(`expected number multiple of ${step} but got ${data}`, options);
			return [data];
		});
		Schema.extend("boolean", (data, _, options) => {
			if (typeof data === "boolean") return [data];
			throw new ValidationError(`expected boolean but got ${data}`, options);
		});
		Schema.extend("bitset", (data, { bits, meta }, options) => {
			let value = 0, keys = [];
			if (typeof data === "number") {
				value = data;
				for (const key in bits) if (data & bits[key]) keys.push(key);
			} else if (Array.isArray(data)) {
				keys = data;
				for (const key of keys) {
					if (typeof key !== "string") throw new ValidationError(`expected string but got ${key}`, options);
					if (key in bits) value |= bits[key];
				}
			} else throw new ValidationError(`expected number or array but got ${data}`, options);
			if (value === meta.default) return [value];
			return [value, keys];
		});
		Schema.extend("function", (data, _, options) => {
			if (typeof data === "function") return [data];
			throw new ValidationError(`expected function but got ${data}`, options);
		});
		Schema.extend("is", (data, { constructor }, options) => {
			if (typeof constructor === "function") {
				if (data instanceof constructor) return [data];
				throw new ValidationError(`expected ${constructor.name} but got ${data}`, options);
			} else {
				if (isNullable(data)) throw new ValidationError(`expected ${constructor} but got ${data}`, options);
				let prototype = Object.getPrototypeOf(data);
				while (prototype) {
					if (prototype.constructor?.name === constructor) return [data];
					prototype = Object.getPrototypeOf(prototype);
				}
				throw new ValidationError(`expected ${constructor} but got ${data}`, options);
			}
		});
		function property(data, key, schema, options) {
			try {
				const [value, adapted] = Schema.resolve(data[key], schema, {
					...options,
					path: [...options.path || [], key]
				});
				if (adapted !== void 0) data[key] = adapted;
				return value;
			} catch (e) {
				if (!options?.autofix) throw e;
				delete data[key];
				return schema.meta.default;
			}
		}
		Schema.extend("array", (data, { inner, meta }, options) => {
			if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
			checkWithinRange(data.length, meta, "array length", options, !isNullable(inner.meta.default));
			return [data.map((_, index) => property(data, index, inner, options))];
		});
		Schema.extend("dict", (data, { inner, sKey }, options, strict) => {
			if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
			const result = {};
			for (const key in data) {
				let rKey;
				try {
					rKey = Schema.resolve(key, sKey, options)[0];
				} catch (error) {
					if (strict) continue;
					throw error;
				}
				result[rKey] = property(data, key, inner, options);
				data[rKey] = data[key];
				if (key !== rKey) delete data[key];
			}
			return [result];
		});
		Schema.extend("tuple", (data, { list }, options, strict) => {
			if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
			const result = list.map((inner, index) => property(data, index, inner, options));
			if (strict) return [result];
			result.push(...data.slice(list.length));
			return [result];
		});
		function merge(result, data) {
			for (const key in data) {
				if (key in result) continue;
				result[key] = data[key];
			}
		}
		Schema.extend("object", (data, { dict }, options, strict) => {
			if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
			const result = {};
			for (const key in dict) {
				const value = property(data, key, dict[key], options);
				if (!isNullable(value) || key in data) result[key] = value;
			}
			if (!strict) merge(result, data);
			return [result];
		});
		Schema.extend("union", (data, { list, toString }, options, strict) => {
			const messages = [];
			for (const inner of list) try {
				return Schema.resolve(data, inner, options, strict);
			} catch (error) {
				messages.push(error);
			}
			throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
		});
		Schema.extend("intersect", (data, { list, toString }, options, strict) => {
			if (!list.length) return [data];
			let result;
			for (const inner of list) {
				const value = Schema.resolve(data, inner, options, true)[0];
				if (isNullable(value)) continue;
				if (isNullable(result)) result = value;
				else if (typeof result !== typeof value) throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
				else if (typeof value === "object") merge(result ??= {}, value);
				else if (result !== value) throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
			}
			if (!strict && isPlainObject(data)) merge(result, data);
			return [result];
		});
		Schema.extend("transform", (data, { inner, callback, preserve }, options) => {
			const [result, adapted = data] = Schema.resolve(data, inner, options, true);
			if (preserve) return [callback(result)];
			else return [callback(result), callback(adapted)];
		});
		const formatters = {};
		function defineMethod(name, keys, format) {
			formatters[name] = format;
			Object.assign(Schema, { [name](...args) {
				const schema = new Schema({ type: name });
				keys.forEach((key, index) => {
					switch (key) {
						case "sKey":
							schema.sKey = args[index] ?? Schema.string();
							break;
						case "inner":
							schema.inner = Schema.from(args[index]);
							break;
						case "list":
							schema.list = args[index].map(Schema.from);
							break;
						case "dict":
							schema.dict = mapValues(args[index], Schema.from);
							break;
						case "bits":
							schema.bits = {};
							for (const key in args[index]) {
								if (typeof args[index][key] !== "number") continue;
								schema.bits[key] = args[index][key];
							}
							break;
						case "callback": {
							const callback = schema.callback = args[index];
							callback["toJSON"] ||= () => callback.toString();
							break;
						}
						case "constructor": {
							const constructor = schema.constructor = args[index];
							if (typeof constructor === "function") constructor["toJSON"] ||= () => constructor["name"];
							break;
						}
						default: schema[key] = args[index];
					}
				});
				if (name === "object" || name === "dict") schema.meta.default = {};
				else if (name === "array" || name === "tuple") schema.meta.default = [];
				else if (name === "bitset") schema.meta.default = 0;
				return schema;
			} });
		}
		defineMethod("is", ["constructor"], ({ constructor }) => {
			if (typeof constructor === "function") return constructor.name;
			else return constructor;
		});
		defineMethod("any", [], () => "any");
		defineMethod("never", [], () => "never");
		defineMethod("const", ["value"], ({ value }) => typeof value === "string" ? JSON.stringify(value) : value);
		defineMethod("string", [], () => "string");
		defineMethod("number", [], () => "number");
		defineMethod("boolean", [], () => "boolean");
		defineMethod("bitset", ["bits"], () => "bitset");
		defineMethod("function", [], () => "function");
		defineMethod("array", ["inner"], ({ inner }) => `${inner.toString(true)}[]`);
		defineMethod("dict", ["inner", "sKey"], ({ inner, sKey }) => `{ [key: ${sKey.toString()}]: ${inner.toString()} }`);
		defineMethod("tuple", ["list"], ({ list }) => `[${list.map((inner) => inner.toString()).join(", ")}]`);
		defineMethod("object", ["dict"], ({ dict }) => {
			if (Object.keys(dict).length === 0) return "{}";
			return `{ ${Object.entries(dict).map(([key, inner]) => {
				return `${key}${inner.meta.required ? "" : "?"}: ${inner.toString()}`;
			}).join(", ")} }`;
		});
		defineMethod("union", ["list"], ({ list }, inline) => {
			const result = list.map(({ toString: format }) => format()).join(" | ");
			return inline ? `(${result})` : result;
		});
		defineMethod("intersect", ["list"], ({ list }) => {
			return `${list.map((inner) => inner.toString(true)).join(" & ")}`;
		});
		defineMethod("transform", [
			"inner",
			"callback",
			"preserve"
		], ({ inner }, isInner) => inner.toString(isInner));
		//#endregion
		//#region src/action-approval-settings.ts
		const SOC_ACTION_APPROVAL_NAMESPACE = "soc-action-approval";
		Schema.object({ autoApproveActions: Schema.array(Schema.string()).default([]) });
		//#endregion
		//#region src/client/index.ts
		const inject = [
			"slots",
			"connection",
			"conversation",
			"commandUi",
			"settingsScope"
		];
		function apply(ctx) {
			const connection = ctx.get("connection");
			const api = connection.api;
			api.folders = void 0;
			const documents = new MarkItDownDocumentController(connection, ctx.settingsScope.bind({ namespace: MARKITDOWN_ATTACHMENTS_NAMESPACE }));
			const settings = new AttachmentSettingsController(ctx.settingsScope.bind({ namespace: MARKITDOWN_ATTACHMENTS_NAMESPACE }));
			const actionApproval = new SocActionApprovalController(connection, ctx.settingsScope.bind({ namespace: SOC_ACTION_APPROVAL_NAMESPACE }));
			ctx.effect(() => ctx.conversation.registerDocumentProvider(documents), "soc-agent: MarkItDown document provider");
			ctx.slots.inject("conversation.input.documents", () => ctx.slots.register({
				name: "conversation.input.documents",
				locale: "conversation"
			}, (props) => react.default.createElement(MarkItDownDocuments, {
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
						openMarkItDownPicker(session.sessionId);
					}
				}
			}), "soc-agent: MarkItDown file command");
			ctx.slots.inject("settings.plugin.item", () => ctx.slots.register({
				name: "settings.plugin.item",
				key: MARKITDOWN_ATTACHMENTS_NAMESPACE,
				inject: () => settings.inject()
			}, MarkItDownAttachmentSettingsCard));
			ctx.slots.inject("settings.plugin.item", () => ctx.slots.register({
				name: "settings.plugin.item",
				key: SOC_ACTION_APPROVAL_NAMESPACE,
				inject: () => actionApproval.inject()
			}, SocActionApprovalSettingsCard));
			ctx.slots.inject("conversation.input.left", () => ctx.slots.register({
				name: "conversation.input.left",
				id: "soc-action-policy",
				priority: -10
			}, (props) => react.default.createElement(SocActionPolicyMenu, {
				...props,
				connection
			})));
			installEmailDraftToolview(ctx);
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "soc-agent-auth-gate",
				priority: -100
			}, AuthGate));
			ctx.slots.inject("sidebar.brand.mark", () => ctx.slots.inject("sidebar.brand.name", () => ctx.slots.inject("conversation.hero.brand.mark", function* () {
				yield ctx.slots.register({
					name: "sidebar.brand.mark",
					priority: -1
				}, CiticBrandMark);
				yield ctx.slots.register({
					name: "sidebar.brand.name",
					priority: -1
				}, CiticBrandName);
				yield ctx.slots.register({
					name: "conversation.hero.brand.mark",
					priority: -1
				}, CiticBrandMark);
			})));
			ctx.slots.inject("settings.section", () => {
				const connections = ctx.slots.register({
					name: "settings.section",
					...SETTINGS_SECTIONS[0],
					inject: () => ({ connection })
				}, () => react.default.createElement(react.default.Fragment, null, react.default.createElement(SplunkSettings, { connection }), react.default.createElement(SubscriptionServerSettings, { connection })));
				const schedules = ctx.slots.register({
					name: "settings.section",
					...SETTINGS_SECTIONS[1],
					inject: () => ({
						connection,
						openSession: (id) => {
							ctx.sessions.open(id);
						}
					})
				}, SchedulerSettings);
				return () => {
					schedules();
					connections();
				};
			});
		}
		//#endregion
		exports.EmailDraftToolview = EmailDraftToolview;
		exports.SchedulerSettings = SchedulerSettings;
		exports.SplunkSettings = SplunkSettings;
		exports.SubscriptionServerSettings = SubscriptionServerSettings;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map