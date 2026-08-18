window.__ModuleLoader__.load({
	id: "dsh-splunk-zimbra-client",
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
		//#region \0dsh-css:/Users/chankokpan/Documents/MCP_sever/dsh-splunk-zimbra-client/src/client/SplunkZimbraOverlay.module.css.mjs
		const css = ".hB6_Vq_form button:focus-visible,.hB6_Vq_input:focus-visible{outline:2px solid var(--dsw-alias-border-l4);outline-offset:2px}.hB6_Vq_loading{color:var(--dsw-alias-label-secondary);text-align:center;padding:24px}.hB6_Vq_form{flex-direction:column;gap:14px;font-size:13px;line-height:20px;display:flex}.hB6_Vq_description,.hB6_Vq_status{color:var(--dsw-alias-label-secondary);margin:0}.hB6_Vq_status{background:var(--dsw-alias-bg-layer-1);border-radius:8px;padding:8px 10px}.hB6_Vq_section{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);border-radius:12px;flex-direction:column;gap:8px;margin:0;padding:12px;display:flex}.hB6_Vq_section h3{margin:0 0 2px;font-size:14px;font-weight:500;line-height:22px}.hB6_Vq_row{grid-template-columns:118px minmax(0,1fr) auto;align-items:center;gap:8px;display:grid}.hB6_Vq_row label{color:var(--dsw-alias-label-secondary)}.hB6_Vq_input{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);min-width:0;height:32px;color:var(--dsw-alias-label-primary);font:inherit;border-radius:8px;padding:0 9px}.hB6_Vq_input::placeholder{color:var(--dsw-alias-label-tertiary)}.hB6_Vq_textarea{box-sizing:border-box;resize:vertical;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);width:100%;min-height:96px;color:var(--dsw-alias-label-primary);font:inherit;border-radius:8px;padding:9px}.hB6_Vq_fieldLabel{color:var(--dsw-alias-label-secondary)}.hB6_Vq_rule{overflow-wrap:anywhere;color:var(--dsw-alias-label-secondary)}.hB6_Vq_run{border-bottom:1px solid var(--dsw-alias-border-l1);justify-content:space-between;align-items:center;gap:8px;padding:8px 0;display:flex}.hB6_Vq_run:last-child{border-bottom:0}.hB6_Vq_actions{flex-wrap:wrap;align-items:center;gap:8px;margin-top:4px;display:flex}.hB6_Vq_primaryButton,.hB6_Vq_secondaryButton,.hB6_Vq_deleteButton{min-height:30px;font:inherit;cursor:pointer;border-radius:15px;padding:0 10px;font-size:12px}.hB6_Vq_primaryButton{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);border:0}.hB6_Vq_primaryButton:hover{background:var(--dsw-alias-button-primary-hover)}.hB6_Vq_secondaryButton,.hB6_Vq_deleteButton{border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);background:0 0}.hB6_Vq_secondaryButton:hover,.hB6_Vq_deleteButton:hover{background:var(--dsw-alias-interactive-bg-hover)}.hB6_Vq_deleteButton{border-radius:14px;min-height:28px}.hB6_Vq_account{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);border-radius:10px;flex-direction:column;gap:8px;padding:10px;display:flex}.hB6_Vq_connectedAccount{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);border-radius:10px;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;padding:10px;display:flex}.hB6_Vq_accountIdentity{flex-direction:column;gap:2px;min-width:0;display:flex}.hB6_Vq_accountMeta{overflow-wrap:anywhere;color:var(--dsw-alias-label-secondary)}.hB6_Vq_accountActions{flex-wrap:wrap;align-items:center;gap:8px;display:flex}.hB6_Vq_testResult{overflow-wrap:anywhere;min-width:0;min-height:30px;color:var(--dsw-alias-label-secondary);align-items:center;display:inline-flex}.hB6_Vq_testOk{color:var(--dsw-alias-state-success-primary)}.hB6_Vq_testFail{color:var(--dsw-alias-state-error-primary)}@media (width<=520px){.hB6_Vq_row{grid-template-columns:1fr auto}.hB6_Vq_row label{grid-column:1/-1}}";
		const tagId = "dsh-splunk-zimbra-client/SplunkZimbraOverlay.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-splunk-zimbra-client";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var SplunkZimbraOverlay_module_css_default = {
			"accountIdentity": "hB6_Vq_accountIdentity",
			"section": "hB6_Vq_section",
			"testResult": "hB6_Vq_testResult",
			"accountActions": "hB6_Vq_accountActions",
			"status": "hB6_Vq_status",
			"textarea": "hB6_Vq_textarea",
			"fieldLabel": "hB6_Vq_fieldLabel",
			"row": "hB6_Vq_row",
			"accountMeta": "hB6_Vq_accountMeta",
			"run": "hB6_Vq_run",
			"testFail": "hB6_Vq_testFail",
			"loading": "hB6_Vq_loading",
			"testOk": "hB6_Vq_testOk",
			"primaryButton": "hB6_Vq_primaryButton",
			"account": "hB6_Vq_account",
			"rule": "hB6_Vq_rule",
			"form": "hB6_Vq_form",
			"input": "hB6_Vq_input",
			"actions": "hB6_Vq_actions",
			"description": "hB6_Vq_description",
			"deleteButton": "hB6_Vq_deleteButton",
			"secondaryButton": "hB6_Vq_secondaryButton",
			"connectedAccount": "hB6_Vq_connectedAccount"
		};
		//#endregion
		//#region src/client/SplunkZimbraForm.ts
		const CHANNEL$1 = "/splunk-zimbra-config";
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
		function AccountEditor({ account, onSave }) {
			const [draft, setDraft] = (0, react.useState)(account);
			(0, react.useEffect)(() => {
				setDraft(account);
			}, [account]);
			return react.default.createElement("div", { className: SplunkZimbraOverlay_module_css_default.account }, react.default.createElement("div", { className: SplunkZimbraOverlay_module_css_default.row }, react.default.createElement("label", null, "Label"), react.default.createElement(TextInput, {
				value: draft.label || "",
				onChange: (value) => setDraft({
					...draft,
					label: value
				})
			})), react.default.createElement("div", { className: SplunkZimbraOverlay_module_css_default.row }, react.default.createElement("label", null, "Email"), react.default.createElement(TextInput, {
				value: draft.email || "",
				onChange: (value) => setDraft({
					...draft,
					email: value
				})
			})), react.default.createElement("div", { className: SplunkZimbraOverlay_module_css_default.row }, react.default.createElement("label", null, "Password"), react.default.createElement(TextInput, {
				value: draft.password || "",
				onChange: (value) => setDraft({
					...draft,
					password: value
				}),
				type: "password"
			})), react.default.createElement("div", { className: SplunkZimbraOverlay_module_css_default.actions }, react.default.createElement("button", {
				className: SplunkZimbraOverlay_module_css_default.primaryButton,
				type: "button",
				onClick: () => onSave(draft)
			}, "Add account")));
		}
		function ConnectedAccountRow({ account, testResult, onTest, onDelete }) {
			const title = account.label || account.email || account.id;
			const meta = account.email && account.email !== title ? account.email : "";
			return react.default.createElement("div", { className: SplunkZimbraOverlay_module_css_default.connectedAccount }, react.default.createElement("div", { className: SplunkZimbraOverlay_module_css_default.accountIdentity }, react.default.createElement("strong", null, title), meta ? react.default.createElement("span", { className: SplunkZimbraOverlay_module_css_default.accountMeta }, meta) : null), react.default.createElement("div", { className: SplunkZimbraOverlay_module_css_default.accountActions }, react.default.createElement("button", {
				className: SplunkZimbraOverlay_module_css_default.secondaryButton,
				type: "button",
				onClick: () => onTest(account.id)
			}, "Test"), react.default.createElement(TestStatus, { result: testResult }), react.default.createElement("button", {
				className: SplunkZimbraOverlay_module_css_default.deleteButton,
				type: "button",
				onClick: () => onDelete(account.id)
			}, "Delete")));
		}
		function SplunkZimbraForm({ connection }) {
			const [status, setStatus] = (0, react.useState)("Loading...");
			const [settings, setSettings] = (0, react.useState)(null);
			const [accounts, setAccounts] = (0, react.useState)([]);
			const [newAccountNonce, setNewAccountNonce] = (0, react.useState)(0);
			const [splunkTest, setSplunkTest] = (0, react.useState)(null);
			const [accountTests, setAccountTests] = (0, react.useState)({});
			const blankAccount = (0, react.useMemo)(() => ({
				id: "",
				label: "",
				email: "",
				password: ""
			}), [newAccountNonce]);
			const load = (0, react.useCallback)(async () => {
				setStatus("Loading...");
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
			const updateNested = (group, key, value) => {
				setSettings((current) => ({
					...current,
					[group]: {
						...current[group],
						[key]: value
					}
				}));
			};
			const saveSettings = async () => {
				try {
					setStatus("Saving...");
					setSettings(await rpc$1(connection, "update-settings", settings ?? {}));
					setStatus("Saved");
				} catch (error) {
					setStatus(errorText(error));
				}
			};
			const deleteSetting = async (key) => {
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
					setNewAccountNonce((value) => value + 1);
					await load();
				} catch (error) {
					setStatus(errorText(error));
				}
			};
			const deleteAccount = async (id) => {
				try {
					setStatus("Deleting account...");
					await rpc$1(connection, "delete-account", { id });
					setAccountTests((current) => {
						const next = { ...current };
						delete next[id];
						return next;
					});
					await load();
				} catch (error) {
					setStatus(errorText(error));
				}
			};
			const testAccount = async (id) => {
				setAccountTests((current) => ({
					...current,
					[id]: {
						kind: "pending",
						text: "Testing…"
					}
				}));
				try {
					await rpc$1(connection, "test-account", { id });
					setAccountTests((current) => ({
						...current,
						[id]: {
							kind: "ok",
							text: "Account test succeeded"
						}
					}));
				} catch (error) {
					setAccountTests((current) => ({
						...current,
						[id]: {
							kind: "fail",
							text: errorText(error)
						}
					}));
				}
			};
			const testSplunk = async () => {
				setSplunkTest({
					kind: "pending",
					text: "Testing…"
				});
				try {
					const value = await rpc$1(connection, "test-splunk");
					setSplunkTest({
						kind: "ok",
						text: `Splunk OK (${String(value.index_count ?? 0)} indexes)`
					});
				} catch (error) {
					setSplunkTest({
						kind: "fail",
						text: errorText(error)
					});
				}
			};
			if (settings == null) return react.default.createElement("div", { className: SplunkZimbraOverlay_module_css_default.loading }, status);
			return react.default.createElement("div", { className: SplunkZimbraOverlay_module_css_default.form }, react.default.createElement("p", { className: SplunkZimbraOverlay_module_css_default.description }, "Splunk and Zimbra connections for the analyst agent."), status ? react.default.createElement("p", {
				className: SplunkZimbraOverlay_module_css_default.status,
				role: "status"
			}, status) : null, react.default.createElement("section", { className: SplunkZimbraOverlay_module_css_default.section }, react.default.createElement("h3", null, "Splunk"), react.default.createElement(SettingRow, {
				label: "URL",
				value: String(settings.splunk.url || ""),
				onChange: (value) => updateNested("splunk", "url", value),
				onDelete: () => {
					deleteSetting("splunk.url");
				}
			}), react.default.createElement(SettingRow, {
				label: "Username",
				value: String(settings.splunk.username || ""),
				onChange: (value) => updateNested("splunk", "username", value),
				onDelete: () => {
					deleteSetting("splunk.username");
				}
			}), react.default.createElement(SettingRow, {
				label: "Password",
				value: "",
				type: "password",
				placeholder: settings.splunk.has_password ? "Stored password is set" : "",
				onChange: (value) => updateNested("splunk", "password", value),
				onDelete: () => {
					deleteSetting("splunk.password");
				}
			}), react.default.createElement(SettingRow, {
				label: "Verify SSL",
				value: String(settings.splunk.verify_ssl ?? true),
				onChange: (value) => updateNested("splunk", "verify_ssl", value === "true"),
				onDelete: () => {
					deleteSetting("splunk.verify_ssl");
				}
			}), react.default.createElement(SettingRow, {
				label: "Max events",
				value: String(settings.splunk.max_events ?? ""),
				onChange: (value) => updateNested("splunk", "max_events", Number(value || 0)),
				onDelete: () => {
					deleteSetting("splunk.max_events");
				}
			}), react.default.createElement(SettingRow, {
				label: "Risk tolerance",
				value: String(settings.splunk.risk_tolerance ?? ""),
				onChange: (value) => updateNested("splunk", "risk_tolerance", Number(value || 0)),
				onDelete: () => {
					deleteSetting("splunk.risk_tolerance");
				}
			}), react.default.createElement(SettingRow, {
				label: "Allow drafts",
				value: String(settings.splunk.detection_write_enabled ?? false),
				onChange: (value) => updateNested("splunk", "detection_write_enabled", value === "true"),
				onDelete: () => {
					deleteSetting("splunk.detection_write_enabled");
				}
			}), react.default.createElement(SettingRow, {
				label: "Allow enable",
				value: String(settings.splunk.detection_enable_enabled ?? false),
				onChange: (value) => updateNested("splunk", "detection_enable_enabled", value === "true"),
				onDelete: () => {
					deleteSetting("splunk.detection_enable_enabled");
				}
			}), react.default.createElement("div", { className: SplunkZimbraOverlay_module_css_default.actions }, react.default.createElement("button", {
				className: SplunkZimbraOverlay_module_css_default.primaryButton,
				type: "button",
				onClick: () => {
					saveSettings();
				}
			}, "Save settings"), react.default.createElement("button", {
				className: SplunkZimbraOverlay_module_css_default.secondaryButton,
				type: "button",
				onClick: () => {
					testSplunk();
				}
			}, "Test Splunk"), react.default.createElement(TestStatus, { result: splunkTest }))), react.default.createElement("section", { className: SplunkZimbraOverlay_module_css_default.section }, react.default.createElement("h3", null, "Zimbra"), react.default.createElement(SettingRow, {
				label: "Host",
				value: String(settings.zimbra.host || ""),
				onChange: (value) => updateNested("zimbra", "host", value),
				onDelete: () => {
					deleteSetting("zimbra.host");
				}
			}), react.default.createElement(SettingRow, {
				label: "Verify SSL",
				value: String(settings.zimbra.verify_ssl ?? true),
				onChange: (value) => updateNested("zimbra", "verify_ssl", value === "true"),
				onDelete: () => {
					deleteSetting("zimbra.verify_ssl");
				}
			}), react.default.createElement(SettingRow, {
				label: "Timeout",
				value: String(settings.zimbra.timeout ?? ""),
				onChange: (value) => updateNested("zimbra", "timeout", Number(value || 0)),
				onDelete: () => {
					deleteSetting("zimbra.timeout");
				}
			}), react.default.createElement(SettingRow, {
				label: "Allow send",
				value: String(settings.zimbra.allow_send ?? false),
				onChange: (value) => updateNested("zimbra", "allow_send", value === "true"),
				onDelete: () => {
					deleteSetting("zimbra.allow_send");
				}
			}), react.default.createElement(SettingRow, {
				label: "Attachment bytes",
				value: String(settings.zimbra.max_attachment_bytes ?? ""),
				onChange: (value) => updateNested("zimbra", "max_attachment_bytes", Number(value || 0)),
				onDelete: () => {
					deleteSetting("zimbra.max_attachment_bytes");
				}
			}), react.default.createElement(SettingRow, {
				label: "Text characters",
				value: String(settings.zimbra.max_attachment_text_chars ?? ""),
				onChange: (value) => updateNested("zimbra", "max_attachment_text_chars", Number(value || 0)),
				onDelete: () => {
					deleteSetting("zimbra.max_attachment_text_chars");
				}
			}), react.default.createElement("div", { className: SplunkZimbraOverlay_module_css_default.actions }, react.default.createElement("button", {
				className: SplunkZimbraOverlay_module_css_default.primaryButton,
				type: "button",
				onClick: () => {
					saveSettings();
				}
			}, "Save settings"))), react.default.createElement("section", { className: SplunkZimbraOverlay_module_css_default.section }, react.default.createElement("h3", null, "Accounts"), accounts.length === 0 ? react.default.createElement("p", { className: SplunkZimbraOverlay_module_css_default.description }, "No connected accounts.") : null, accounts.map((account) => react.default.createElement(ConnectedAccountRow, {
				key: account.id,
				account,
				testResult: accountTests[account.id] ?? null,
				onTest: (id) => {
					testAccount(id);
				},
				onDelete: (id) => {
					deleteAccount(id);
				}
			})), react.default.createElement(AccountEditor, {
				key: `new-${newAccountNonce}`,
				account: blankAccount,
				onSave: (draft) => {
					saveAccount(draft);
				}
			})));
		}
		//#endregion
		//#region src/client/ScheduledTasksForm.ts
		const CHANNEL = "/splunk-zimbra-schedules";
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
		function ScheduledTasksForm({ connection, openSession }) {
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
			id: "splunk-zimbra-connections",
			order: 30,
			label: "Connections"
		}, {
			id: "splunk-zimbra-schedules",
			order: 40,
			label: "Scheduled Tasks"
		}];
		//#endregion
		//#region src/client/index.ts
		const inject = ["slots", "connection"];
		function apply(ctx) {
			const connection = ctx.get("connection");
			ctx.slots.inject("settings.section", () => {
				const connections = ctx.slots.register({
					name: "settings.section",
					...SETTINGS_SECTIONS[0],
					inject: () => ({ connection })
				}, SplunkZimbraForm);
				const schedules = ctx.slots.register({
					name: "settings.section",
					...SETTINGS_SECTIONS[1],
					inject: () => ({
						connection,
						openSession: (id) => {
							ctx.sessions.open(id);
						}
					})
				}, ScheduledTasksForm);
				return () => {
					schedules();
					connections();
				};
			});
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map