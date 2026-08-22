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
		//#region \0dsh-css:/Users/chankokpan/Documents/MCP_sever/dsh-soc-agent-client/src/client/SplunkZimbraOverlay.module.css.mjs
		const css$1 = ".RBKUgW_form button:focus-visible,.RBKUgW_input:focus-visible{outline:2px solid var(--dsw-alias-border-l4);outline-offset:2px}.RBKUgW_loading{color:var(--dsw-alias-label-secondary);text-align:center;padding:24px}.RBKUgW_form{flex-direction:column;gap:14px;font-size:13px;line-height:20px;display:flex}.RBKUgW_description,.RBKUgW_status{color:var(--dsw-alias-label-secondary);margin:0}.RBKUgW_status{background:var(--dsw-alias-bg-layer-1);border-radius:8px;padding:8px 10px}.RBKUgW_section{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);border-radius:12px;flex-direction:column;gap:8px;margin:0;padding:12px;display:flex}.RBKUgW_section h3{margin:0 0 2px;font-size:14px;font-weight:500;line-height:22px}.RBKUgW_row{grid-template-columns:118px minmax(0,1fr) auto;align-items:center;gap:8px;display:grid}.RBKUgW_row label{color:var(--dsw-alias-label-secondary)}.RBKUgW_input{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);min-width:0;height:32px;color:var(--dsw-alias-label-primary);font:inherit;border-radius:8px;padding:0 9px}.RBKUgW_input::placeholder{color:var(--dsw-alias-label-tertiary)}.RBKUgW_textarea{box-sizing:border-box;resize:vertical;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);width:100%;min-height:96px;color:var(--dsw-alias-label-primary);font:inherit;border-radius:8px;padding:9px}.RBKUgW_fieldLabel{color:var(--dsw-alias-label-secondary)}.RBKUgW_rule{overflow-wrap:anywhere;color:var(--dsw-alias-label-secondary)}.RBKUgW_run{border-bottom:1px solid var(--dsw-alias-border-l1);justify-content:space-between;align-items:center;gap:8px;padding:8px 0;display:flex}.RBKUgW_run:last-child{border-bottom:0}.RBKUgW_actions{flex-wrap:wrap;align-items:center;gap:8px;margin-top:4px;display:flex}.RBKUgW_primaryButton,.RBKUgW_secondaryButton,.RBKUgW_deleteButton{min-height:30px;font:inherit;cursor:pointer;border-radius:15px;padding:0 10px;font-size:12px}.RBKUgW_primaryButton{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);border:0}.RBKUgW_primaryButton:hover{background:var(--dsw-alias-button-primary-hover)}.RBKUgW_secondaryButton,.RBKUgW_deleteButton{border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);background:0 0}.RBKUgW_secondaryButton:hover,.RBKUgW_deleteButton:hover{background:var(--dsw-alias-interactive-bg-hover)}.RBKUgW_deleteButton{border-radius:14px;min-height:28px}.RBKUgW_account{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);border-radius:10px;flex-direction:column;gap:8px;padding:10px;display:flex}.RBKUgW_connectedAccount{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);border-radius:10px;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;padding:10px;display:flex}.RBKUgW_accountIdentity{flex-direction:column;gap:2px;min-width:0;display:flex}.RBKUgW_accountMeta{overflow-wrap:anywhere;color:var(--dsw-alias-label-secondary)}.RBKUgW_accountActions{flex-wrap:wrap;align-items:center;gap:8px;display:flex}.RBKUgW_testResult{overflow-wrap:anywhere;min-width:0;min-height:30px;color:var(--dsw-alias-label-secondary);align-items:center;display:inline-flex}.RBKUgW_testOk{color:var(--dsw-alias-state-success-primary)}.RBKUgW_testFail{color:var(--dsw-alias-state-error-primary)}@media (width<=520px){.RBKUgW_row{grid-template-columns:1fr auto}.RBKUgW_row label{grid-column:1/-1}}";
		const tagId$1 = "dsh-soc-agent-client/SplunkZimbraOverlay.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-soc-agent-client";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var SplunkZimbraOverlay_module_css_default = {
			"deleteButton": "RBKUgW_deleteButton",
			"description": "RBKUgW_description",
			"accountIdentity": "RBKUgW_accountIdentity",
			"loading": "RBKUgW_loading",
			"connectedAccount": "RBKUgW_connectedAccount",
			"accountActions": "RBKUgW_accountActions",
			"input": "RBKUgW_input",
			"accountMeta": "RBKUgW_accountMeta",
			"testResult": "RBKUgW_testResult",
			"primaryButton": "RBKUgW_primaryButton",
			"section": "RBKUgW_section",
			"run": "RBKUgW_run",
			"testFail": "RBKUgW_testFail",
			"textarea": "RBKUgW_textarea",
			"status": "RBKUgW_status",
			"fieldLabel": "RBKUgW_fieldLabel",
			"form": "RBKUgW_form",
			"actions": "RBKUgW_actions",
			"account": "RBKUgW_account",
			"testOk": "RBKUgW_testOk",
			"row": "RBKUgW_row",
			"rule": "RBKUgW_rule",
			"secondaryButton": "RBKUgW_secondaryButton"
		};
		//#endregion
		//#region src/client/settings-common.ts
		const CHANNEL$1 = "/soc-agent-config";
		async function rpc$1(connection, name, payload = {}) {
			const result = await connection.rpc.call(CHANNEL$1, name, payload);
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
		//#region src/client/ZimbraSettings.ts
		function AccountEditor({ onSave }) {
			const [draft, setDraft] = (0, react.useState)({
				id: "",
				label: "",
				email: "",
				password: ""
			});
			return react.default.createElement("div", { className: SplunkZimbraOverlay_module_css_default.account }, react.default.createElement("div", { className: SplunkZimbraOverlay_module_css_default.row }, react.default.createElement("label", null, "Label"), react.default.createElement(TextInput, {
				value: draft.label,
				onChange: (value) => setDraft({
					...draft,
					label: value
				})
			})), react.default.createElement("div", { className: SplunkZimbraOverlay_module_css_default.row }, react.default.createElement("label", null, "Email"), react.default.createElement(TextInput, {
				value: draft.email,
				onChange: (value) => setDraft({
					...draft,
					email: value
				})
			})), react.default.createElement("div", { className: SplunkZimbraOverlay_module_css_default.row }, react.default.createElement("label", null, "Password"), react.default.createElement(TextInput, {
				value: draft.password,
				type: "password",
				onChange: (value) => setDraft({
					...draft,
					password: value
				})
			})), react.default.createElement("div", { className: SplunkZimbraOverlay_module_css_default.actions }, react.default.createElement("button", {
				className: SplunkZimbraOverlay_module_css_default.primaryButton,
				type: "button",
				onClick: () => onSave(draft)
			}, "Add account")));
		}
		function ZimbraSettings({ connection }) {
			const [settings, setSettings] = (0, react.useState)(null);
			const [accounts, setAccounts] = (0, react.useState)([]);
			const [tests, setTests] = (0, react.useState)({});
			const [status, setStatus] = (0, react.useState)("Loading...");
			const load = (0, react.useCallback)(async () => {
				try {
					const [nextSettings, nextAccounts] = await Promise.all([rpc$1(connection, "get-settings"), rpc$1(connection, "list-accounts")]);
					setSettings(nextSettings);
					setAccounts(nextAccounts.accounts || []);
					setStatus("");
				} catch (error) {
					setStatus(errorText(error));
				}
			}, [connection]);
			(0, react.useEffect)(() => {
				load();
			}, [load]);
			const update = (key, value) => setSettings((current) => ({
				...current,
				zimbra: {
					...current.zimbra,
					[key]: value
				}
			}));
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
			const saveAccount = async (account) => {
				try {
					setStatus("Saving account...");
					await rpc$1(connection, "add-account", account);
					await load();
				} catch (error) {
					setStatus(errorText(error));
				}
			};
			const deleteAccount = async (id) => {
				try {
					setStatus("Deleting account...");
					await rpc$1(connection, "delete-account", { id });
					await load();
				} catch (error) {
					setStatus(errorText(error));
				}
			};
			const testAccount = async (id) => {
				setTests((current) => ({
					...current,
					[id]: {
						kind: "pending",
						text: "Testing…"
					}
				}));
				try {
					await rpc$1(connection, "test-account", { id });
					setTests((current) => ({
						...current,
						[id]: {
							kind: "ok",
							text: "Account test succeeded"
						}
					}));
				} catch (error) {
					setTests((current) => ({
						...current,
						[id]: {
							kind: "fail",
							text: errorText(error)
						}
					}));
				}
			};
			if (!settings) return react.default.createElement("div", { className: SplunkZimbraOverlay_module_css_default.loading }, status);
			const zimbra = settings.zimbra;
			return react.default.createElement(react.default.Fragment, null, react.default.createElement("section", { className: SplunkZimbraOverlay_module_css_default.section }, react.default.createElement("h3", null, "Zimbra"), react.default.createElement(SettingRow, {
				label: "Host",
				value: String(zimbra.host || ""),
				onChange: (value) => update("host", value),
				onDelete: () => {
					remove("zimbra.host");
				}
			}), react.default.createElement(SettingRow, {
				label: "Verify SSL",
				value: String(zimbra.verify_ssl ?? true),
				onChange: (value) => update("verify_ssl", value === "true"),
				onDelete: () => {
					remove("zimbra.verify_ssl");
				}
			}), react.default.createElement(SettingRow, {
				label: "Timeout",
				value: String(zimbra.timeout ?? ""),
				onChange: (value) => update("timeout", Number(value || 0)),
				onDelete: () => {
					remove("zimbra.timeout");
				}
			}), react.default.createElement(SettingRow, {
				label: "Allow send",
				value: String(zimbra.allow_send ?? false),
				onChange: (value) => update("allow_send", value === "true"),
				onDelete: () => {
					remove("zimbra.allow_send");
				}
			}), react.default.createElement(SettingRow, {
				label: "Attachment bytes",
				value: String(zimbra.max_attachment_bytes ?? ""),
				onChange: (value) => update("max_attachment_bytes", Number(value || 0)),
				onDelete: () => {
					remove("zimbra.max_attachment_bytes");
				}
			}), react.default.createElement(SettingRow, {
				label: "Text characters",
				value: String(zimbra.max_attachment_text_chars ?? ""),
				onChange: (value) => update("max_attachment_text_chars", Number(value || 0)),
				onDelete: () => {
					remove("zimbra.max_attachment_text_chars");
				}
			}), react.default.createElement("div", { className: SplunkZimbraOverlay_module_css_default.actions }, react.default.createElement("button", {
				className: SplunkZimbraOverlay_module_css_default.primaryButton,
				type: "button",
				onClick: () => {
					save();
				}
			}, "Save settings"))), react.default.createElement("section", { className: SplunkZimbraOverlay_module_css_default.section }, react.default.createElement("h3", null, "Accounts"), accounts.length === 0 ? react.default.createElement("p", { className: SplunkZimbraOverlay_module_css_default.description }, "No connected accounts.") : null, accounts.map((account) => react.default.createElement("div", {
				className: SplunkZimbraOverlay_module_css_default.connectedAccount,
				key: account.id
			}, react.default.createElement("div", { className: SplunkZimbraOverlay_module_css_default.accountIdentity }, react.default.createElement("strong", null, account.label || account.email || account.id), account.email && account.email !== account.label ? react.default.createElement("span", { className: SplunkZimbraOverlay_module_css_default.accountMeta }, account.email) : null), react.default.createElement("div", { className: SplunkZimbraOverlay_module_css_default.accountActions }, react.default.createElement("button", {
				className: SplunkZimbraOverlay_module_css_default.secondaryButton,
				type: "button",
				onClick: () => {
					testAccount(account.id);
				}
			}, "Test"), react.default.createElement(TestStatus, { result: tests[account.id] ?? null }), react.default.createElement("button", {
				className: SplunkZimbraOverlay_module_css_default.deleteButton,
				type: "button",
				onClick: () => {
					deleteAccount(account.id);
				}
			}, "Delete")))), react.default.createElement(AccountEditor, { onSave: (account) => {
				saveAccount(account);
			} })), status ? react.default.createElement("p", {
				className: SplunkZimbraOverlay_module_css_default.status,
				role: "status"
			}, status) : null);
		}
		//#endregion
		//#region src/client/ScheduledTasksForm.ts
		const CHANNEL = "/soc-agent-schedules";
		async function rpc(connection, endpoint, payload = {}) {
			const result = await connection.rpc.call(CHANNEL, endpoint, payload);
			if (!result?.ok) throw new Error(result?.error?.message || `Request failed: ${endpoint}`);
			return result.value;
		}
		function localZone() {
			return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
		}
		function readable(value) {
			return value ? new Date(value).toLocaleString() : "—";
		}
		function SchedulerSettings({ connection, openSession }) {
			const [tasks, setTasks] = (0, react.useState)([]);
			const [runs, setRuns] = (0, react.useState)([]);
			const [schedulerSettings, setSchedulerSettings] = (0, react.useState)({
				maxConcurrentRuns: 1,
				runTimeoutMs: 9e5
			});
			const [status, setStatus] = (0, react.useState)("Loading...");
			const [name, setName] = (0, react.useState)("");
			const [prompt, setPrompt] = (0, react.useState)("");
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
			(0, react.useEffect)(() => {
				load();
			}, [load]);
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
					prompt
				};
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
				maxLength: 2e4,
				rows: 5,
				onChange: (event) => setPrompt(event.target.value)
			}), react.default.createElement("div", { className: SplunkZimbraOverlay_module_css_default.row }, react.default.createElement("label", null, "Rule"), react.default.createElement("select", {
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
				disabled: !name.trim() || !prompt.trim() || kind === "once" && !at,
				onClick: () => {
					create();
				}
			}, "Create task"))), react.default.createElement("section", { className: SplunkZimbraOverlay_module_css_default.section }, react.default.createElement("h3", null, "Tasks"), tasks.length === 0 ? react.default.createElement("p", { className: SplunkZimbraOverlay_module_css_default.description }, "No scheduled tasks.") : null, tasks.map((task) => react.default.createElement("article", {
				className: SplunkZimbraOverlay_module_css_default.account,
				key: task.id
			}, react.default.createElement("strong", null, task.name), react.default.createElement("span", { className: SplunkZimbraOverlay_module_css_default.description }, `${task.status} · Next ${readable(task.nextRunAt)} · Last ${readable(task.lastRunAt)}`), react.default.createElement("code", { className: SplunkZimbraOverlay_module_css_default.rule }, task.rule.kind === "once" ? task.rule.at : `${task.rule.expression} (${task.rule.timeZone})`), react.default.createElement("div", { className: SplunkZimbraOverlay_module_css_default.actions }, task.status === "active" ? react.default.createElement("button", {
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
					mutate("delete", { id: task.id });
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
		//#region \0dsh-css:/Users/chankokpan/Documents/MCP_sever/dsh-soc-agent-client/src/client/EmailDraftToolview.module.css.mjs
		const css = ".i4uqOW_card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-surface-l1,transparent);border-radius:10px;margin:6px 0;overflow:hidden}.i4uqOW_header{background:var(--dsw-alias-surface-l2,transparent);justify-content:space-between;align-items:center;gap:12px;padding:10px 12px;display:flex}.i4uqOW_title{font-weight:600}.i4uqOW_account{color:var(--dsw-alias-text-l2);font-size:12px}.i4uqOW_content{gap:9px;padding:12px;display:grid}.i4uqOW_field{gap:4px;display:grid}.i4uqOW_label{color:var(--dsw-alias-text-l2);font-size:12px;font-weight:600}.i4uqOW_input,.i4uqOW_textarea{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-surface-l0,transparent);width:100%;color:inherit;font:inherit;border-radius:6px;padding:8px 9px}.i4uqOW_textarea{resize:vertical;min-height:180px;line-height:1.45}.i4uqOW_input:focus,.i4uqOW_textarea:focus{outline:2px solid var(--dsw-alias-primary,currentColor);outline-offset:1px}.i4uqOW_actions{justify-content:flex-end;gap:8px;padding-top:3px;display:flex}.i4uqOW_button{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-surface-l2,transparent);color:inherit;cursor:pointer;font:inherit;border-radius:6px;padding:7px 12px}.i4uqOW_primary{background:var(--dsw-alias-primary,#2563eb);border-color:var(--dsw-alias-primary,#2563eb);color:var(--dsw-alias-on-primary,#fff)}.i4uqOW_button:disabled{cursor:wait;opacity:.6}.i4uqOW_message{color:var(--dsw-alias-text-l2);padding:10px 12px;font-size:13px}.i4uqOW_error{color:var(--dsw-alias-danger,#b42318)}";
		const tagId = "dsh-soc-agent-client/EmailDraftToolview.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-soc-agent-client";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var EmailDraftToolview_module_css_default = {
			"label": "i4uqOW_label",
			"card": "i4uqOW_card",
			"title": "i4uqOW_title",
			"header": "i4uqOW_header",
			"button": "i4uqOW_button",
			"textarea": "i4uqOW_textarea",
			"error": "i4uqOW_error",
			"input": "i4uqOW_input",
			"content": "i4uqOW_content",
			"account": "i4uqOW_account",
			"field": "i4uqOW_field",
			"actions": "i4uqOW_actions",
			"primary": "i4uqOW_primary",
			"message": "i4uqOW_message"
		};
		//#endregion
		//#region src/client/emailDraft.ts
		const ZIMBRA_DRAFT_TOOL_NAME = "mcp__soc_agent__zimbra_create_email_draft";
		function parseRecipientText(value) {
			return [...new Set(value.split(/[\n,;]/).map((item) => item.trim()).filter(Boolean))];
		}
		function draftFromForm(fields) {
			return {
				to: parseRecipientText(fields.to),
				cc: parseRecipientText(fields.cc),
				bcc: parseRecipientText(fields.bcc),
				subject: fields.subject.trim(),
				body: fields.body,
				account_id: fields.accountId
			};
		}
		function buildEmailSendPrompt(draft) {
			return [
				"The user reviewed and clicked Send for this exact email draft.",
				"Call zimbra_send_email now using the JSON fields below as data. Do not rewrite, omit, or add any recipient, subject, or body content.",
				"<user-approved-email-draft>",
				JSON.stringify(draft),
				"</user-approved-email-draft>"
			].join("\n");
		}
		//#endregion
		//#region src/client/EmailDraftToolview.tsx
		const MAX_PROMPT_CHARS = 2e4;
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
			const account = draft.account;
			const accountLabel = [account?.label, account?.email].filter((value) => typeof value === "string" && value !== "").join(" · ");
			return {
				to: listValue(draft.to).join(", "),
				cc: listValue(draft.cc).join(", "),
				bcc: listValue(draft.bcc).join(", "),
				subject: typeof draft.subject === "string" ? draft.subject : "",
				body: typeof draft.body === "string" ? draft.body : "",
				accountId: typeof draft.account_id === "string" ? draft.account_id : "",
				accountLabel
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
		function EmailDraftToolview({ block, sendDraft }) {
			const envelope = (0, react.useMemo)(() => parseEnvelope(block), [block]);
			const sourceKey = (0, react.useMemo)(() => JSON.stringify(envelope?.draft ?? null), [envelope]);
			const [fields, setFields] = (0, react.useState)(() => envelope ? formFromEnvelope(envelope) : {
				to: "",
				cc: "",
				bcc: "",
				subject: "",
				body: "",
				accountId: "",
				accountLabel: ""
			});
			const [status, setStatus] = (0, react.useState)("editing");
			const [error, setError] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				if (envelope?.draft) setFields(formFromEnvelope(envelope));
			}, [sourceKey]);
			if (!("kind" in block)) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: EmailDraftToolview_module_css_default.card,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: EmailDraftToolview_module_css_default.message,
					children: "Preparing email draft…"
				})
			});
			const upstreamError = errorMessage(envelope);
			if (upstreamError || block.isError) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: EmailDraftToolview_module_css_default.card,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: `${EmailDraftToolview_module_css_default.message} ${EmailDraftToolview_module_css_default.error}`,
					children: upstreamError || "Unable to create the email draft."
				})
			});
			if (status === "discarded") return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: EmailDraftToolview_module_css_default.card,
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
							setError(null);
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
				setError(null);
			};
			const submit = async () => {
				const draft = draftFromForm(fields);
				if (draft.to.length === 0) return setError("Add at least one To recipient.");
				if (!draft.subject) return setError("Subject cannot be empty.");
				if (buildEmailSendPrompt(draft).length > MAX_PROMPT_CHARS) return setError("This email is too large to send from the editor.");
				setStatus("sending");
				setError(null);
				try {
					await sendDraft(draft);
					setStatus("sent");
				} catch (reason) {
					setStatus("editing");
					setError(reason instanceof Error ? reason.message : "The send request could not be submitted.");
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: EmailDraftToolview_module_css_default.card,
				"aria-label": "Editable Zimbra email draft",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: EmailDraftToolview_module_css_default.header,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: EmailDraftToolview_module_css_default.title,
						children: status === "sent" ? "Send request submitted" : "Email draft"
					}), fields.accountLabel && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: EmailDraftToolview_module_css_default.account,
						children: ["via ", fields.accountLabel]
					})] }), status === "sent" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: EmailDraftToolview_module_css_default.account,
						children: "Waiting for AI and approval"
					})]
				}), status === "sent" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: EmailDraftToolview_module_css_default.message,
					children: "The finalized email was sent to the AI. Complete the normal approval step if requested."
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
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
						error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: `${EmailDraftToolview_module_css_default.message} ${EmailDraftToolview_module_css_default.error}`,
							role: "alert",
							children: error
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: EmailDraftToolview_module_css_default.actions,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: EmailDraftToolview_module_css_default.button,
								type: "button",
								disabled: status === "sending",
								onClick: () => {
									setStatus("discarded");
									setError(null);
								},
								children: "Discard"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: `${EmailDraftToolview_module_css_default.button} ${EmailDraftToolview_module_css_default.primary}`,
								type: "button",
								disabled: status === "sending",
								onClick: () => {
									submit();
								},
								children: status === "sending" ? "Submitting…" : "Send"
							})]
						})
					]
				})]
			});
		}
		const emailDraftToolview = {
			name: "zimbra-email-draft-toolview",
			inject: ["slots", "sessions"],
			apply(ctx) {
				ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({
					name: "tool.call.toolview",
					key: ZIMBRA_DRAFT_TOOL_NAME,
					inject: (sessionId) => ({ sendDraft: async (draft) => {
						const binding = ctx.sessions.binding(sessionId);
						if (!binding) throw new Error("The current session is no longer available.");
						const result = await binding.session.prompt([{
							type: "text",
							text: buildEmailSendPrompt(draft)
						}], "queue");
						if (!result.ok) throw new Error(result.error.message);
					} })
				}, EmailDraftToolview));
			}
		};
		function installEmailDraftToolview(ctx) {
			ctx.plugin(emailDraftToolview);
		}
		//#endregion
		//#region src/client/index.ts
		const inject = ["slots", "connection"];
		function apply(ctx) {
			const connection = ctx.get("connection");
			installEmailDraftToolview(ctx);
			ctx.slots.inject("settings.section", () => {
				const connections = ctx.slots.register({
					name: "settings.section",
					...SETTINGS_SECTIONS[0],
					inject: () => ({ connection })
				}, () => react.default.createElement(react.default.Fragment, null, react.default.createElement(SplunkSettings, { connection }), react.default.createElement(ZimbraSettings, { connection })));
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
		exports.ZimbraSettings = ZimbraSettings;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map