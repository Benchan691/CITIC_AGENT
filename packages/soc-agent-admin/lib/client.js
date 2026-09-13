window.__ModuleLoader__.load({
	id: "dsh-soc-agent-admin",
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
		//#region \0dsh-css:/Users/chankokpan/Documents/CITIC_AGENT/packages/soc-agent-admin/src/client/AdminConsole.module.css.mjs
		const css = ".yGqTkG_page,.yGqTkG_loginPage{--ink:#202c35;--muted:#65747d;--line:#dfe5e5;--accent:#216b5c;--paper:#fff;color-scheme:light;color:var(--ink);background:#f4f6f5;min-height:100vh;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;font-size:14px;line-height:1.5}.yGqTkG_page *,.yGqTkG_loginPage *{box-sizing:border-box}.yGqTkG_page [hidden]{display:none!important}.yGqTkG_page button,.yGqTkG_loginPage button,.yGqTkG_page input,.yGqTkG_page select,.yGqTkG_page textarea{font:inherit}.yGqTkG_page a{color:inherit}.yGqTkG_page :focus-visible,.yGqTkG_loginPage :focus-visible{outline-offset:3px;outline:3px solid #49a68d}.yGqTkG_page{grid-template-columns:232px minmax(0,1fr);display:grid}.yGqTkG_sidebar{color:#d3dfdc;background:#142c2c;flex-direction:column;height:100vh;padding:32px 18px 22px;display:flex;position:sticky;top:0}.yGqTkG_brand{letter-spacing:-.5px;align-items:center;gap:12px;padding:0 10px 42px;font-size:22px;font-weight:700;text-decoration:none;display:flex}.yGqTkG_brand small{letter-spacing:.3px;color:#a9bfba;font-size:11px;font-weight:400;display:block}.yGqTkG_brandMark{color:#194e40;background:#d9eee1;border-radius:12px;place-items:center;width:38px;height:42px;font-family:Georgia,serif;font-size:24px;display:grid}.yGqTkG_navLabel{letter-spacing:1.8px;color:#8da9a2;margin:0 0 12px;padding:0 14px;font-size:10px;font-weight:600}.yGqTkG_navigation{gap:5px;display:grid}.yGqTkG_navigation a{color:#b4c8c2;border-radius:7px;align-items:center;gap:12px;padding:12px 14px;font-size:13px;text-decoration:none;display:flex}.yGqTkG_navigation a:hover{color:#fff;background:#203d3b}.yGqTkG_navigation .yGqTkG_navActive{color:#f0f8f3;background:#2c4944;font-weight:600;box-shadow:inset 3px 0 #a9d3b7}.yGqTkG_sidebarFoot{margin-top:auto;padding:32px 10px 0}.yGqTkG_backLink{padding-bottom:24px;font-size:12px;text-decoration:none;display:block;color:#b8c9c4!important}.yGqTkG_identity{border-top:1px solid #37504a;gap:10px;min-width:0;padding:19px 0 10px;display:flex}.yGqTkG_identity>div{min-width:0}.yGqTkG_identity strong{color:#e0e9e5;font-size:12px;font-weight:500;display:block}.yGqTkG_avatar{color:#d4e9db;background:#36574b;border-radius:50%;flex:0 0 33px;place-items:center;height:33px;display:grid}.yGqTkG_account{text-overflow:ellipsis;white-space:nowrap;color:#9eb6ae;max-width:155px;font-size:11px;display:block;overflow:hidden}.yGqTkG_signOut{color:#b9cdc5;cursor:pointer;background:0 0;border:0;padding:8px 0;font-size:12px!important}.yGqTkG_shell{width:100%;min-width:0;max-width:1550px;margin:0 auto;padding:0 clamp(24px,4vw,64px)}.yGqTkG_topbar{border-bottom:1px solid var(--line);min-height:74px;color:var(--muted);justify-content:space-between;align-items:center;font-size:12px;display:flex}.yGqTkG_topbar strong{color:var(--ink);font-weight:500}.yGqTkG_adminBadge{color:#4c6259;background:#e8eeeb;border-radius:4px;padding:4px 10px;font-size:11px}.yGqTkG_header{justify-content:space-between;align-items:center;gap:24px;padding:34px 0 26px;display:flex}.yGqTkG_eyebrow,.yGqTkG_sectionKicker{color:#677f75;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 9px;font-size:10px;font-weight:700}.yGqTkG_title,.yGqTkG_loginTitle,.yGqTkG_sectionTitle,.yGqTkG_editorTitle{color:var(--ink);letter-spacing:-.6px;margin:0;font-weight:600}.yGqTkG_title{font-size:34px;line-height:1.2}.yGqTkG_subtitle{color:var(--muted);margin:10px 0 0;font-size:14px}.yGqTkG_headerMark{color:#4c7161;background:#ecf1ec;border:1px solid #d3dfd8;border-radius:13px;place-items:center;width:48px;height:48px;display:grid}.yGqTkG_headerMark svg{width:24px;height:24px}.yGqTkG_section{margin:8px 0 32px}.yGqTkG_sectionHeading{justify-content:space-between;align-items:center;gap:20px;margin-bottom:20px;display:flex}.yGqTkG_sectionTitle{font-size:20px}.yGqTkG_sectionHint{color:var(--muted);text-align:right;max-width:290px;font-size:12px}.yGqTkG_headerActions,.yGqTkG_toolbar{flex-wrap:wrap;align-items:center;gap:12px;display:flex}.yGqTkG_metrics{grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin:0 0 28px;display:grid}.yGqTkG_metric{border:1px solid var(--line);background:#fff;border-radius:10px;flex-direction:column;padding:22px;text-decoration:none;display:flex;box-shadow:0 2px 3px #182e2610}.yGqTkG_metric:hover{border-color:#a8c4b8}.yGqTkG_metricLabel{color:#54675f;justify-content:space-between;align-items:center;gap:8px;font-size:12px;display:flex}.yGqTkG_metricLabel svg{color:#7a9689}.yGqTkG_metric>strong{letter-spacing:-1px;margin:18px 0;font-size:32px;font-weight:600;line-height:1.3}.yGqTkG_metric>small{color:var(--muted);justify-content:space-between;gap:12px;font-size:11px;display:flex}.yGqTkG_metricAttention{background:#fffaf2;border-color:#ebd6b7}.yGqTkG_metricAttention>strong{color:#976322}.yGqTkG_contentGrid{grid-template-columns:minmax(0,1.9fr) minmax(230px,1fr);align-items:start;gap:22px;display:grid}.yGqTkG_card{background:var(--paper);border:1px solid var(--line);border-radius:10px;min-width:0;margin-bottom:22px;padding:26px}.yGqTkG_helpCard{color:#455c4e;background:#eaf0e9;border:1px solid #dce5d9;border-radius:10px;padding:28px}.yGqTkG_helpCard h3{color:#294938;margin:0 0 12px;font-family:Georgia,serif;font-size:26px;font-weight:400;line-height:1.2}.yGqTkG_helpCard p{font-size:13px;line-height:1.75}.yGqTkG_steps{margin:22px 0;padding-left:20px;font-size:12px}.yGqTkG_steps li{padding:5px 0 5px 5px}.yGqTkG_quickLinks{margin-top:18px;display:grid}.yGqTkG_quickLinks a{border-bottom:1px solid #e9eeeb;align-items:center;gap:15px;padding:20px 0;text-decoration:none;display:flex}.yGqTkG_quickLinks a:last-child{border-bottom:0;padding-bottom:4px}.yGqTkG_quickLinks a>span:nth-child(2){flex:1}.yGqTkG_quickLinks strong{font-size:14px;font-weight:600;display:block}.yGqTkG_quickLinks small{color:var(--muted);margin-top:5px;font-size:12px;line-height:1.5;display:block}.yGqTkG_quickLinks a:hover strong{color:var(--accent)}.yGqTkG_quickIcon{color:#50725e;background:#f0f4f1;border:1px solid #e2eae4;border-radius:9px;flex:0 0 38px;place-items:center;width:38px;height:38px;display:grid}.yGqTkG_pageFoot{border-top:1px solid var(--line);color:#77867e;margin-top:30px;padding:24px 0;font-size:11px}.yGqTkG_statusGrid{grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;display:grid}.yGqTkG_statusCard{border:1px solid var(--line);background:#fff;border-radius:10px;gap:15px;min-width:0;padding:22px;display:flex}.yGqTkG_statusIcon{color:#346e55;background:#edf4ef;border:1px solid #d6e4dc;border-radius:9px;flex:0 0 36px;place-items:center;height:36px;font-weight:600;display:grid}.yGqTkG_statusBody{flex:1;min-width:0}.yGqTkG_statusTopline{flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;display:flex}.yGqTkG_statusTopline h3{margin:0;font-size:14px;font-weight:600}.yGqTkG_statusBody p{color:var(--muted);margin:9px 0 0;font-size:12px}.yGqTkG_statusPill,.yGqTkG_customBadge,.yGqTkG_customTag,.yGqTkG_countBadge{white-space:nowrap;border-radius:5px;align-items:center;gap:6px;padding:4px 9px;font-size:11px;font-weight:500;display:inline-flex}.yGqTkG_statusReady{color:#286043;background:#e5f2e9}.yGqTkG_statusConfigured,.yGqTkG_statusInfo{color:#385e73;background:#e8f0f4}.yGqTkG_statusError{color:#9d3e32;background:#fceee7}.yGqTkG_statusMuted{color:#65726e;background:#eff1ef}.yGqTkG_statusDot,.yGqTkG_providerDot{background:#97a59e;border-radius:50%;width:6px;height:6px;display:inline-block}.yGqTkG_statusReady .yGqTkG_statusDot,.yGqTkG_providerDotReady{background:#378657}.yGqTkG_statusConfigured .yGqTkG_statusDot,.yGqTkG_statusInfo .yGqTkG_statusDot{background:#507c94}.yGqTkG_statusError .yGqTkG_statusDot{background:#bb5f4c}.yGqTkG_textButton{cursor:pointer;background:0 0;border:0;margin-top:14px;padding:0;font-weight:600;text-decoration:none;display:inline-block;color:var(--accent)!important;font-size:12px!important}.yGqTkG_textButton:hover{text-decoration:underline}.yGqTkG_envManaged{color:#76827c;margin-top:14px;font-size:11px;display:block}.yGqTkG_button,.yGqTkG_dangerButton{color:#3e5349;cursor:pointer;background:#fff;border:1px solid #d5deda;border-radius:6px;justify-content:center;align-items:center;gap:7px;min-height:38px;padding:9px 14px;line-height:1.3;text-decoration:none;display:inline-flex;font-size:12px!important;font-weight:600!important}.yGqTkG_button:hover:not(:disabled){background:#f2f6f3;border-color:#91b3a3}.yGqTkG_primary{color:#fff;background:#246b55;border-color:#246b55}.yGqTkG_primary:hover:not(:disabled){background:#19533f;border-color:#19533f}.yGqTkG_dangerButton{color:#a14235;background:#fff9f6;border-color:#eccdc3}.yGqTkG_dangerButton:hover{background:#fceee8}.yGqTkG_button:disabled,.yGqTkG_dangerButton:disabled,.yGqTkG_textButton:disabled{cursor:not-allowed;opacity:.55}.yGqTkG_error,.yGqTkG_message{overflow-wrap:anywhere;border-radius:6px;margin:12px 0;padding:12px 15px;font-size:13px}.yGqTkG_error{color:#9b3c32;background:#fff0eb}.yGqTkG_success{color:#2b6748;background:#eaf5ed}.yGqTkG_info{color:#365e73;background:#edf3f7}.yGqTkG_checkMessage{overflow-wrap:anywhere}.yGqTkG_checkMessage.yGqTkG_success{color:#2b6748;padding:5px}.yGqTkG_loading,.yGqTkG_loadingInline{color:#5d7167;background:#f4f6f5;padding:28px;font-size:14px}.yGqTkG_loading{place-items:center;min-height:100vh;display:grid}.yGqTkG_providerLayout{border:1px solid var(--line);background:#fff;border-radius:10px;grid-template-columns:250px minmax(0,1fr);display:grid;overflow:hidden}.yGqTkG_providerPicker{border-right:1px solid var(--line);background:#fafbf9;min-width:0;padding:18px 12px}.yGqTkG_pickerHeader{justify-content:space-between;align-items:center;padding:0 8px 12px;font-size:12px;font-weight:600;display:flex}.yGqTkG_countBadge{color:#4a6c59;background:#e9efeb}.yGqTkG_providerList{flex-direction:column;gap:4px;max-height:430px;display:flex;overflow:auto}.yGqTkG_providerOption,.yGqTkG_customOption{text-align:left;width:100%;color:var(--ink);cursor:pointer;background:0 0;border:1px solid #0000;border-radius:6px;align-items:center;gap:10px;padding:12px 10px;display:flex}.yGqTkG_providerOption:hover,.yGqTkG_customOption:hover{background:#eef3ef}.yGqTkG_providerOptionSelected,.yGqTkG_customOptionSelected{background:#e7f0e9;border-color:#c6d9cc}.yGqTkG_providerDot{flex:0 0 6px}.yGqTkG_providerOptionText,.yGqTkG_customOption>span:last-child{flex-direction:column;flex:1;gap:4px;min-width:0;display:flex}.yGqTkG_providerOptionText strong,.yGqTkG_customOption strong{overflow-wrap:anywhere;font-size:12px;font-weight:600}.yGqTkG_providerOptionText small,.yGqTkG_customOption small{color:var(--muted);font-size:10px}.yGqTkG_customTag,.yGqTkG_customBadge{color:#806239;background:#f4eee0;font-size:9px}.yGqTkG_customOption{border-top:1px solid var(--line);border-radius:0;margin-top:14px}.yGqTkG_addIcon{color:var(--accent);font-size:20px}.yGqTkG_providerEditor{min-width:0;padding:28px}.yGqTkG_editorHeading{border-bottom:1px solid var(--line);justify-content:space-between;align-items:flex-start;gap:15px;padding-bottom:22px;display:flex}.yGqTkG_editorTitle{font-size:20px}.yGqTkG_editorCopy{color:var(--muted);margin:10px 0 0;font-size:13px;line-height:1.6}.yGqTkG_editorForm,.yGqTkG_form,.yGqTkG_formFields{border:0;flex-direction:column;gap:20px;min-width:0;margin:22px 0 0;padding:0;display:flex}.yGqTkG_fieldGrid{grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;display:grid}.yGqTkG_field{color:#3f5449;flex-direction:column;gap:8px;min-width:0;font-size:12px;font-weight:600;display:flex}.yGqTkG_field em{color:var(--muted);font-size:11px;font-style:normal;font-weight:400}.yGqTkG_input{width:100%;min-width:0;color:var(--ink);background:#fff;border:1px solid #cedbd3;border-radius:6px;padding:10px 12px;font-weight:400;line-height:1.5;display:block;font-size:13px!important}.yGqTkG_input::placeholder{color:#7c8c82}.yGqTkG_input:focus{border-color:#559779}.yGqTkG_input:disabled{cursor:not-allowed;opacity:.7;background:#f3f5f2}textarea.yGqTkG_input{resize:vertical}.yGqTkG_textarea{min-height:100px}.yGqTkG_fieldHint{color:var(--muted);font-size:11px;font-weight:400;line-height:1.6}.yGqTkG_advanced{border:1px solid var(--line);background:#fafbf9;border-radius:7px;margin-top:8px}.yGqTkG_advanced summary{cursor:pointer;color:#425e4e;padding:13px 16px;font-size:12px;font-weight:600}.yGqTkG_advancedBody{flex-direction:column;gap:16px;padding:0 16px 18px;display:flex}.yGqTkG_discoveryRow,.yGqTkG_discovered{flex-wrap:wrap;align-items:center;gap:10px;display:flex}.yGqTkG_modelChip{color:#3e6d50;cursor:pointer;background:#edf5ef;border:1px solid #cadecf;border-radius:5px;padding:7px 10px;font-size:12px}.yGqTkG_actions{flex-wrap:wrap;align-items:center;gap:10px;margin-top:8px;display:flex}.yGqTkG_confirmGroup{color:#8e4e42;flex-wrap:wrap;align-items:center;gap:8px;font-size:12px;display:flex}.yGqTkG_confirmGroup .yGqTkG_error{width:100%}.yGqTkG_loginPage{background:#eaf0ea;place-items:center;padding:24px;display:grid}.yGqTkG_loginPanel{background:#fff;border:1px solid #d4dfd5;border-radius:14px;width:min(100%,430px);padding:40px;box-shadow:0 20px 80px #26443515}.yGqTkG_loginMark{color:#fff;background:#246b55;border-radius:11px;place-items:center;width:44px;height:44px;margin-bottom:26px;font-family:Georgia,serif;font-size:22px;display:grid}.yGqTkG_loginTitle{font-size:30px;line-height:1.2}.yGqTkG_loginCopy{color:var(--muted);margin:14px 0 25px;font-size:13px}.yGqTkG_fullButton{width:100%}.yGqTkG_loginFootnote{color:var(--muted);margin:24px 0 0;font-size:11px}.yGqTkG_notice{color:#526b5d;background:#edf2ef;border:1px solid #dce5df;border-radius:7px;align-items:center;gap:12px;padding:14px 18px;font-size:12px;display:flex}.yGqTkG_tabs{border-bottom:1px solid var(--line);flex-wrap:wrap;gap:4px;margin:22px 0;display:flex}.yGqTkG_tabs button{color:var(--muted);cursor:pointer;background:0 0;border:0;border-bottom:2px solid #0000;padding:12px 14px;font-size:12px}.yGqTkG_tabs .yGqTkG_activeTab{color:#256849;border-bottom-color:#256849;font-weight:600}.yGqTkG_toolbar{margin:0 0 18px}.yGqTkG_toolbar>.yGqTkG_input,.yGqTkG_search{max-width:320px}.yGqTkG_toolbar>.yGqTkG_button:last-child{margin-left:auto}.yGqTkG_tableWrap{border:1px solid var(--line);background:#fff;border-radius:8px;margin-bottom:22px;overflow:auto}.yGqTkG_table{border-collapse:collapse;text-align:left;width:100%;font-size:12px}.yGqTkG_table th{color:#67786d;border-bottom:1px solid var(--line);white-space:nowrap;background:#f9fbf8;padding:13px 18px;font-size:11px;font-weight:500}.yGqTkG_table td{vertical-align:top;border-bottom:1px solid #edf0ec;padding:17px 18px}.yGqTkG_table tr:last-child td{border-bottom:0}.yGqTkG_table td strong{font-weight:600}.yGqTkG_table td small{color:var(--muted);margin-top:5px;display:block}.yGqTkG_table td summary{cursor:pointer;min-width:150px}.yGqTkG_empty{color:var(--muted);text-align:center;padding:35px 22px;font-size:13px}.yGqTkG_checkboxGroup{border:1px solid var(--line);border-radius:7px;flex-wrap:wrap;gap:12px;max-height:230px;padding:14px;display:flex;overflow:auto}.yGqTkG_checkboxGroup legend{color:#4b6555;padding:0 5px;font-size:12px}.yGqTkG_checkboxGroup label,.yGqTkG_checkLabel{color:#3c5546;align-items:center;gap:8px;font-size:12px;display:flex}.yGqTkG_checkboxGroup input,.yGqTkG_checkLabel input{accent-color:#276e53;width:16px;height:16px}.yGqTkG_previewEnvelope{border:1px solid var(--line);overflow-wrap:anywhere;background:#f4f7f3;border-bottom:0;margin-top:24px;padding:20px;font-size:12px}.yGqTkG_previewFrame{border:1px solid var(--line);background:#fff;width:100%;height:560px}.yGqTkG_plainText{white-space:pre-wrap;overflow-wrap:anywhere;padding:18px;font-size:12px}.yGqTkG_deliveryDetails{overflow-wrap:anywhere;min-width:220px;max-width:360px;font-size:11px}.yGqTkG_mono{overflow-wrap:anywhere;font-family:ui-monospace,SFMono-Regular,monospace!important}.yGqTkG_importRow{border-top:1px solid var(--line);overflow-wrap:anywhere;justify-content:space-between;align-items:center;gap:20px;padding:18px 0;font-size:12px;display:flex}.yGqTkG_importRow p{color:var(--muted)}.yGqTkG_srOnly{clip:rect(0,0,0,0);white-space:nowrap;width:1px;height:1px;position:absolute;overflow:hidden}.yGqTkG_skipLink{z-index:10;background:#fff;padding:12px;position:fixed;top:0;left:240px;transform:translateY(-150%)}.yGqTkG_skipLink:focus{transform:translateY(0)}@media (width<=1150px){.yGqTkG_page{grid-template-columns:200px minmax(0,1fr)}.yGqTkG_sidebar{padding-inline:12px}.yGqTkG_shell{padding-inline:28px}.yGqTkG_contentGrid{grid-template-columns:minmax(0,1.6fr) minmax(220px,1fr)}.yGqTkG_metric{padding:18px}.yGqTkG_metric>strong{font-size:28px}.yGqTkG_providerLayout{grid-template-columns:210px minmax(0,1fr)}}@media (width<=900px){.yGqTkG_contentGrid{grid-template-columns:1fr}.yGqTkG_metrics{gap:10px}.yGqTkG_metric{padding:14px}.yGqTkG_metricLabel{font-size:11px}.yGqTkG_metricLabel svg{display:none}.yGqTkG_statusGrid,.yGqTkG_providerLayout{grid-template-columns:1fr}.yGqTkG_providerPicker{border-right:0;border-bottom:1px solid var(--line)}.yGqTkG_providerList{max-height:180px}.yGqTkG_notice{flex-direction:column;align-items:flex-start}}@media (width<=680px){.yGqTkG_page{display:block}.yGqTkG_sidebar{height:auto;padding:18px 16px 0;position:static}.yGqTkG_brand{padding:0 0 18px;font-size:19px}.yGqTkG_brandMark{width:30px;height:34px;font-size:20px}.yGqTkG_navLabel{display:none}.yGqTkG_navigation{grid-template-columns:repeat(5,minmax(0,1fr));gap:0;display:grid}.yGqTkG_navigation a{border-radius:5px 5px 0 0;flex-direction:column;flex-shrink:0;justify-content:center;gap:6px;padding:10px 3px;font-size:10px}.yGqTkG_navigation svg{width:15px}.yGqTkG_navigation .yGqTkG_navActive{box-shadow:inset 0 -3px #a9d3b7}.yGqTkG_sidebarFoot{flex-wrap:wrap;align-items:center;gap:15px;padding:8px 0;display:flex}.yGqTkG_backLink{padding:0;font-size:11px}.yGqTkG_identity{display:none}.yGqTkG_signOut{margin-left:auto}.yGqTkG_shell{padding:0 18px}.yGqTkG_topbar{min-height:54px}.yGqTkG_header{padding:24px 0 20px}.yGqTkG_title{font-size:28px}.yGqTkG_headerMark{display:none}.yGqTkG_sectionHeading{flex-wrap:wrap;align-items:flex-start;gap:12px}.yGqTkG_metrics{grid-template-columns:1fr;gap:10px}.yGqTkG_metric{grid-template-columns:1fr auto;align-items:center;gap:8px;padding:16px 18px;display:grid}.yGqTkG_metric>strong{grid-area:1/2/3;margin:0;font-size:24px}.yGqTkG_metric>small{grid-column:1}.yGqTkG_metric small span{display:none}.yGqTkG_card,.yGqTkG_helpCard,.yGqTkG_providerEditor{padding:20px}.yGqTkG_fieldGrid{grid-template-columns:1fr}.yGqTkG_editorHeading{flex-wrap:wrap}.yGqTkG_toolbar>.yGqTkG_input,.yGqTkG_search{width:100%;max-width:none}.yGqTkG_tabs{gap:0}.yGqTkG_tabs button{padding:11px 9px;font-size:11px}.yGqTkG_sectionHint{text-align:left}.yGqTkG_table td,.yGqTkG_table th{padding:12px}.yGqTkG_table{min-width:560px}.yGqTkG_importRow{flex-direction:column;align-items:flex-start}.yGqTkG_skipLink{left:16px}}.yGqTkG_contextGrid{grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;display:grid}.yGqTkG_contextCard{border:1px solid var(--line);background:var(--paper);border-radius:10px;min-width:0;padding:26px;box-shadow:0 2px 3px #182e2610}.yGqTkG_contextCard h3{color:var(--ink);margin:0;font-size:16px;font-weight:600}.yGqTkG_contextCard p:not(.yGqTkG_sectionKicker){color:var(--muted);margin:8px 0 0;font-size:12px;line-height:1.55}.yGqTkG_fieldError{color:#9b3c32;font-size:11px;font-weight:500;line-height:1.5}.yGqTkG_input[aria-invalid=true]{background:#fffaf8;border-color:#bb5f4c}.yGqTkG_toggleField{color:#3f5449;cursor:pointer;align-items:flex-start;gap:11px;display:flex}.yGqTkG_toggleField input{accent-color:#276e53;width:17px;height:17px;margin:1px 0 0}.yGqTkG_toggleField span{flex-direction:column;gap:4px;display:flex}.yGqTkG_toggleField strong{font-size:12px}.yGqTkG_toggleField small{color:var(--muted);font-size:11px;font-weight:400;line-height:1.5}.yGqTkG_contextCardWide{grid-column:1/-1}.yGqTkG_actionGroups{grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:18px;display:grid}.yGqTkG_actionGroups .yGqTkG_checkboxGroup{max-height:none;margin:0}.yGqTkG_actionGroups .yGqTkG_checkLabel{align-items:flex-start}.yGqTkG_modeChoices{border:0;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:20px 0 0;padding:0;display:grid}.yGqTkG_modeChoice{border:1px solid var(--line);cursor:pointer;background:#fafcf9;border-radius:7px;align-items:flex-start;gap:10px;min-width:0;padding:14px;display:flex}.yGqTkG_modeChoice:has(input:checked){background:#eef6ef;border-color:#9fc5ae}.yGqTkG_modeChoice input{accent-color:#276e53;width:16px;height:16px;margin:1px 0 0}.yGqTkG_modeChoice span{flex-direction:column;gap:4px;min-width:0;display:flex}.yGqTkG_modeChoice strong{color:#314d40;font-size:12px}.yGqTkG_modeChoice small{color:var(--muted);font-size:11px;font-weight:400;line-height:1.5}.yGqTkG_accessGroups{gap:16px;margin-top:18px;display:grid}.yGqTkG_actionGroup{border:1px solid var(--line);background:var(--paper);border-radius:10px;min-width:0;margin:0;padding:0;overflow:hidden}.yGqTkG_actionGroup>legend{border-bottom:1px solid var(--line);color:#4b6555;background:#f9fbf8;width:100%;padding:14px 18px;font-size:12px;font-weight:600}.yGqTkG_actionRow{border-bottom:1px solid #edf0ec;justify-content:space-between;align-items:center;gap:18px;min-width:0;padding:15px 18px;display:flex}.yGqTkG_actionGroup .yGqTkG_actionRow:last-child{border-bottom:0}.yGqTkG_actionInfo{flex-direction:column;flex:1;gap:5px;min-width:0;display:flex}.yGqTkG_actionInfo strong{color:#314b3e;font-size:12px;font-weight:600}.yGqTkG_actionInfo small{color:var(--muted);font-size:10px}.yGqTkG_stateChoices{flex-wrap:wrap;flex:none;justify-content:flex-end;gap:6px;display:flex}.yGqTkG_actionControls{flex-wrap:wrap;justify-content:flex-end;align-items:center;gap:8px;display:flex}.yGqTkG_stateChoice{color:#52685d;cursor:pointer;white-space:nowrap;background:#fff;border:1px solid #d8e2dc;border-radius:5px;align-items:center;gap:5px;padding:6px 8px;font-size:10px;font-weight:500;display:inline-flex}.yGqTkG_stateChoice:has(input:checked){color:#286047;background:#eaf5ed;border-color:#8fb8a0}.yGqTkG_stateChoice input{accent-color:#276e53;width:13px;height:13px;margin:0}.yGqTkG_protectedBadge{color:#8b5f2d;white-space:nowrap;background:#fbf1df;border-radius:5px;flex:none;padding:6px 9px;font-size:10px;font-weight:600}.yGqTkG_unavailableBadge{color:#8b4b42;white-space:nowrap;background:#fceee8;border-radius:5px;padding:5px 8px;font-size:10px;font-weight:600}@media (width<=900px){.yGqTkG_contextGrid,.yGqTkG_actionGroups,.yGqTkG_modeChoices{grid-template-columns:1fr}.yGqTkG_actionRow{flex-direction:column;align-items:flex-start}.yGqTkG_stateChoices,.yGqTkG_actionControls{justify-content:flex-start}}@media (width<=680px){.yGqTkG_contextCard{padding:20px}.yGqTkG_navigation{grid-template-columns:repeat(3,minmax(0,1fr))}}";
		const tagId = "dsh-soc-agent-admin/AdminConsole.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-soc-agent-admin";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var AdminConsole_module_css_default = {
			"accessGroups": "yGqTkG_accessGroups",
			"account": "yGqTkG_account",
			"actionControls": "yGqTkG_actionControls",
			"actionGroup": "yGqTkG_actionGroup",
			"actionGroups": "yGqTkG_actionGroups",
			"actionInfo": "yGqTkG_actionInfo",
			"actionRow": "yGqTkG_actionRow",
			"actions": "yGqTkG_actions",
			"activeTab": "yGqTkG_activeTab",
			"addIcon": "yGqTkG_addIcon",
			"adminBadge": "yGqTkG_adminBadge",
			"advanced": "yGqTkG_advanced",
			"advancedBody": "yGqTkG_advancedBody",
			"avatar": "yGqTkG_avatar",
			"backLink": "yGqTkG_backLink",
			"brand": "yGqTkG_brand",
			"brandMark": "yGqTkG_brandMark",
			"button": "yGqTkG_button",
			"card": "yGqTkG_card",
			"checkLabel": "yGqTkG_checkLabel",
			"checkMessage": "yGqTkG_checkMessage",
			"checkboxGroup": "yGqTkG_checkboxGroup",
			"confirmGroup": "yGqTkG_confirmGroup",
			"contentGrid": "yGqTkG_contentGrid",
			"contextCard": "yGqTkG_contextCard",
			"contextCardWide": "yGqTkG_contextCardWide",
			"contextGrid": "yGqTkG_contextGrid",
			"countBadge": "yGqTkG_countBadge",
			"customBadge": "yGqTkG_customBadge",
			"customOption": "yGqTkG_customOption",
			"customOptionSelected": "yGqTkG_customOptionSelected",
			"customTag": "yGqTkG_customTag",
			"dangerButton": "yGqTkG_dangerButton",
			"deliveryDetails": "yGqTkG_deliveryDetails",
			"discovered": "yGqTkG_discovered",
			"discoveryRow": "yGqTkG_discoveryRow",
			"editorCopy": "yGqTkG_editorCopy",
			"editorForm": "yGqTkG_editorForm",
			"editorHeading": "yGqTkG_editorHeading",
			"editorTitle": "yGqTkG_editorTitle",
			"empty": "yGqTkG_empty",
			"envManaged": "yGqTkG_envManaged",
			"error": "yGqTkG_error",
			"eyebrow": "yGqTkG_eyebrow",
			"field": "yGqTkG_field",
			"fieldError": "yGqTkG_fieldError",
			"fieldGrid": "yGqTkG_fieldGrid",
			"fieldHint": "yGqTkG_fieldHint",
			"form": "yGqTkG_form",
			"formFields": "yGqTkG_formFields",
			"fullButton": "yGqTkG_fullButton",
			"header": "yGqTkG_header",
			"headerActions": "yGqTkG_headerActions",
			"headerMark": "yGqTkG_headerMark",
			"helpCard": "yGqTkG_helpCard",
			"identity": "yGqTkG_identity",
			"importRow": "yGqTkG_importRow",
			"info": "yGqTkG_info",
			"input": "yGqTkG_input",
			"loading": "yGqTkG_loading",
			"loadingInline": "yGqTkG_loadingInline",
			"loginCopy": "yGqTkG_loginCopy",
			"loginFootnote": "yGqTkG_loginFootnote",
			"loginMark": "yGqTkG_loginMark",
			"loginPage": "yGqTkG_loginPage",
			"loginPanel": "yGqTkG_loginPanel",
			"loginTitle": "yGqTkG_loginTitle",
			"message": "yGqTkG_message",
			"metric": "yGqTkG_metric",
			"metricAttention": "yGqTkG_metricAttention",
			"metricLabel": "yGqTkG_metricLabel",
			"metrics": "yGqTkG_metrics",
			"modeChoice": "yGqTkG_modeChoice",
			"modeChoices": "yGqTkG_modeChoices",
			"modelChip": "yGqTkG_modelChip",
			"mono": "yGqTkG_mono",
			"navActive": "yGqTkG_navActive",
			"navLabel": "yGqTkG_navLabel",
			"navigation": "yGqTkG_navigation",
			"notice": "yGqTkG_notice",
			"page": "yGqTkG_page",
			"pageFoot": "yGqTkG_pageFoot",
			"pickerHeader": "yGqTkG_pickerHeader",
			"plainText": "yGqTkG_plainText",
			"previewEnvelope": "yGqTkG_previewEnvelope",
			"previewFrame": "yGqTkG_previewFrame",
			"primary": "yGqTkG_primary",
			"protectedBadge": "yGqTkG_protectedBadge",
			"providerDot": "yGqTkG_providerDot",
			"providerDotReady": "yGqTkG_providerDotReady",
			"providerEditor": "yGqTkG_providerEditor",
			"providerLayout": "yGqTkG_providerLayout",
			"providerList": "yGqTkG_providerList",
			"providerOption": "yGqTkG_providerOption",
			"providerOptionSelected": "yGqTkG_providerOptionSelected",
			"providerOptionText": "yGqTkG_providerOptionText",
			"providerPicker": "yGqTkG_providerPicker",
			"quickIcon": "yGqTkG_quickIcon",
			"quickLinks": "yGqTkG_quickLinks",
			"search": "yGqTkG_search",
			"section": "yGqTkG_section",
			"sectionHeading": "yGqTkG_sectionHeading",
			"sectionHint": "yGqTkG_sectionHint",
			"sectionKicker": "yGqTkG_sectionKicker",
			"sectionTitle": "yGqTkG_sectionTitle",
			"shell": "yGqTkG_shell",
			"sidebar": "yGqTkG_sidebar",
			"sidebarFoot": "yGqTkG_sidebarFoot",
			"signOut": "yGqTkG_signOut",
			"skipLink": "yGqTkG_skipLink",
			"srOnly": "yGqTkG_srOnly",
			"stateChoice": "yGqTkG_stateChoice",
			"stateChoices": "yGqTkG_stateChoices",
			"statusBody": "yGqTkG_statusBody",
			"statusCard": "yGqTkG_statusCard",
			"statusConfigured": "yGqTkG_statusConfigured",
			"statusDot": "yGqTkG_statusDot",
			"statusError": "yGqTkG_statusError",
			"statusGrid": "yGqTkG_statusGrid",
			"statusIcon": "yGqTkG_statusIcon",
			"statusInfo": "yGqTkG_statusInfo",
			"statusMuted": "yGqTkG_statusMuted",
			"statusPill": "yGqTkG_statusPill",
			"statusReady": "yGqTkG_statusReady",
			"statusTopline": "yGqTkG_statusTopline",
			"steps": "yGqTkG_steps",
			"subtitle": "yGqTkG_subtitle",
			"success": "yGqTkG_success",
			"table": "yGqTkG_table",
			"tableWrap": "yGqTkG_tableWrap",
			"tabs": "yGqTkG_tabs",
			"textButton": "yGqTkG_textButton",
			"textarea": "yGqTkG_textarea",
			"title": "yGqTkG_title",
			"toggleField": "yGqTkG_toggleField",
			"toolbar": "yGqTkG_toolbar",
			"topbar": "yGqTkG_topbar",
			"unavailableBadge": "yGqTkG_unavailableBadge"
		};
		//#endregion
		//#region src/client/SocActionApprovalSettings.tsx
		function validCatalog(value) {
			if (!Array.isArray(value)) return [];
			const seen = /* @__PURE__ */ new Set();
			return value.flatMap((item) => {
				if (!item || typeof item !== "object") return [];
				const candidate = item;
				if (typeof candidate.name !== "string" || typeof candidate.group !== "string" || typeof candidate.label !== "string") return [];
				if (candidate.name.length === 0 || seen.has(candidate.name)) return [];
				seen.add(candidate.name);
				const kind = candidate.kind === "read" || candidate.kind === "mutation" || candidate.kind === "ui-confirmed" ? candidate.kind : void 0;
				return [{
					name: candidate.name,
					group: candidate.group,
					label: candidate.label,
					...kind === void 0 ? {} : { kind }
				}];
			});
		}
		//#endregion
		//#region src/client/rpc.ts
		function errorText(error) {
			return error instanceof Error ? error.message : String(error);
		}
		function rpc(client, name, payload = {}) {
			return client.rpc(name, payload);
		}
		//#endregion
		//#region src/client/AdminConsole.tsx
		const CUSTOM_PROVIDER = "__custom__";
		const BACKGROUND_SETTINGS_NAMESPACE = "soc-background";
		const TIME_SETTINGS_NAMESPACE = "time-context";
		const ACTION_APPROVAL_SETTINGS_NAMESPACE = "soc-action-approval";
		const MAX_INTERVAL_SECONDS = Math.floor(Number.MAX_SAFE_INTEGER / 1e3);
		const PROVIDER_ROUTE_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
		const SUPPORTED_PROTOCOLS = [
			{
				value: "openai-completions",
				label: "OpenAI Chat Completions"
			},
			{
				value: "openai-responses",
				label: "OpenAI Responses"
			},
			{
				value: "anthropic-messages",
				label: "Anthropic Messages"
			}
		];
		function stringValue(value) {
			return typeof value === "string" ? value : "";
		}
		function objectValue(value) {
			return value && typeof value === "object" && !Array.isArray(value) ? value : {};
		}
		function pathValue(value, path) {
			let current = value;
			for (const segment of path) current = objectValue(current)[segment];
			return current;
		}
		function providerProfile(namespace, provider) {
			return objectValue(pathValue(namespace?.value, provider.settingsPath));
		}
		function modelEntries(profile) {
			return Array.isArray(profile.models) ? profile.models.map(objectValue) : [];
		}
		function modelIds(profile) {
			return modelEntries(profile).map((model) => stringValue(model.id).trim()).filter(Boolean);
		}
		function mergeModels(profile, ids) {
			const existing = new Map(modelEntries(profile).map((model) => [stringValue(model.id), model]));
			return ids.map((id) => ({
				...existing.get(id) ?? {},
				id
			}));
		}
		function deriveCredentialRef(provider, profile) {
			const configuredRef = stringValue(profile.apiKeyEnv).trim();
			if (configuredRef) return configuredRef;
			return `${provider.provider.replace(/[^a-z0-9]+/gi, "_").toUpperCase()}_API_KEY`;
		}
		function apiValue(response) {
			if (!response.result.ok) throw new Error(response.result.error?.message || "The request could not be completed.");
			return response.result.value;
		}
		async function describeSettings(connection) {
			const view = apiValue(await connection.api.settings.describe({}));
			return {
				namespaces: new Map(view.namespaces.map((namespace) => [namespace.ns, namespace])),
				writable: view.writable
			};
		}
		function useStatus() {
			const [message, setMessage] = (0, react.useState)(null);
			const [busy, setBusy] = (0, react.useState)(false);
			async function run(operation) {
				setBusy(true);
				setMessage(null);
				try {
					await operation();
				} catch (error) {
					setMessage({
						kind: "error",
						text: errorText(error)
					});
				} finally {
					setBusy(false);
				}
			}
			return {
				message,
				setMessage,
				busy,
				run
			};
		}
		function StatusNotice({ message, onRetry }) {
			if (!message) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: `${AdminConsole_module_css_default.message} ${AdminConsole_module_css_default[message.kind]}`,
				role: message.kind === "error" ? "alert" : "status",
				children: message.text
			}), message.kind === "error" && onRetry ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				className: AdminConsole_module_css_default.button,
				type: "button",
				onClick: () => void onRetry(),
				children: "Retry"
			}) : null] });
		}
		function serviceReady(service) {
			return service?.status === "ready" || service?.configured === true || service?.available === true;
		}
		function nonNegativeInteger(value, label, maximum = Number.MAX_SAFE_INTEGER) {
			const normalized = value.trim();
			const parsed = Number(normalized);
			if (!/^\d+$/u.test(normalized) || !Number.isSafeInteger(parsed) || parsed > maximum) throw new Error(`${label} must be a non-negative whole number.`);
			return parsed;
		}
		function AdminConsole({ connection, socClient }) {
			const [auth, setAuth] = (0, react.useState)(null);
			const [loading, setLoading] = (0, react.useState)(true);
			const [authError, setAuthError] = (0, react.useState)("");
			const loadAuth = (0, react.useCallback)(async () => {
				setLoading(true);
				setAuthError("");
				try {
					const body = await (await fetch("/admin/auth/me", { credentials: "same-origin" })).json();
					setAuth(body);
				} catch (error) {
					setAuthError(errorText(error));
				} finally {
					setLoading(false);
				}
			}, []);
			(0, react.useEffect)(() => {
				loadAuth();
			}, [loadAuth]);
			if (loading) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: AdminConsole_module_css_default.loading,
				children: "Loading administration…"
			});
			if (!auth?.authenticated) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AdminLogin, {
				onAuthenticated: loadAuth,
				error: authError
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AdminWorkspace, {
				connection,
				socClient,
				email: auth.email || "",
				onSignedOut: loadAuth
			});
		}
		function AdminLogin({ onAuthenticated, error: initialError }) {
			const [email, setEmail] = (0, react.useState)("");
			const [password, setPassword] = (0, react.useState)("");
			const [error, setError] = (0, react.useState)(initialError);
			const [busy, setBusy] = (0, react.useState)(false);
			async function signIn(event) {
				event.preventDefault();
				setBusy(true);
				setError("");
				try {
					const response = await fetch("/admin/auth/login", {
						method: "POST",
						headers: { "content-type": "application/json" },
						credentials: "same-origin",
						body: JSON.stringify({
							email,
							password
						})
					});
					const body = await response.json().catch(() => ({}));
					if (!response.ok) throw new Error(body.error || "Sign-in failed.");
					setPassword("");
					await onAuthenticated();
				} catch (loginError) {
					setError(errorText(loginError));
				} finally {
					setBusy(false);
				}
			}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("main", {
				className: AdminConsole_module_css_default.loginPage,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
					className: AdminConsole_module_css_default.loginPanel,
					"aria-labelledby": "admin-login-title",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: AdminConsole_module_css_default.loginMark,
							children: "C"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: AdminConsole_module_css_default.eyebrow,
							children: "CITICTEL-CPC · SOC AGENT"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h1", {
							id: "admin-login-title",
							className: AdminConsole_module_css_default.loginTitle,
							children: "Administration console"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: AdminConsole_module_css_default.loginCopy,
							children: "Manage LLM provider credentials and review the health of connected services."
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
							className: AdminConsole_module_css_default.form,
							onSubmit: signIn,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: AdminConsole_module_css_default.field,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "Email" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										className: AdminConsole_module_css_default.input,
										type: "email",
										value: email,
										onChange: (event) => setEmail(event.target.value),
										autoComplete: "username",
										required: true
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: AdminConsole_module_css_default.field,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "Password" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										className: AdminConsole_module_css_default.input,
										type: "password",
										value: password,
										onChange: (event) => setPassword(event.target.value),
										autoComplete: "current-password",
										required: true
									})]
								}),
								error ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: AdminConsole_module_css_default.error,
									role: "alert",
									children: error
								}) : null,
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: `${AdminConsole_module_css_default.button} ${AdminConsole_module_css_default.primary} ${AdminConsole_module_css_default.fullButton}`,
									type: "submit",
									disabled: busy,
									children: busy ? "Signing in…" : "Sign in"
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: AdminConsole_module_css_default.loginFootnote,
							children: "Service configuration is managed by the server environment."
						})
					]
				})
			});
		}
		const ADMIN_PAGES = [
			{
				id: "connections",
				name: "Connections",
				icon: "connections",
				copy: "Review service setup and verify connections when needed."
			},
			{
				id: "agent-context",
				name: "Agent context",
				icon: "context",
				copy: "Control workspace context and current-time injection."
			},
			{
				id: "access-approvals",
				name: "Access & approvals",
				icon: "access",
				copy: "Choose the deployment access mode and action controls."
			},
			{
				id: "providers",
				name: "AI providers",
				icon: "providers",
				copy: "Manage model access and credentials in one place."
			}
		];
		function AdminIcon({ name }) {
			const paths = {
				connections: "M8 3v5 M16 3v5 M6 8h12v3a6 6 0 0 1-12 0z M12 17v4",
				context: "M12 3a9 9 0 1 0 9 9 M12 7v5l3 2",
				access: "M12 3l8 3v5c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V6z M9 12l2 2 4-4",
				providers: "M12 3l9 5-9 5-9-5z M3 12l9 5 9-5 M3 16l9 5 9-5"
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				width: "20",
				height: "20",
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.6",
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: paths[name] || paths.connections })
			});
		}
		function currentPage() {
			const hash = window.location.hash.slice(1).split("/")[0];
			return ADMIN_PAGES.some((page) => page.id === hash) ? hash : "connections";
		}
		function AdminWorkspace({ connection, socClient, email, onSignedOut }) {
			const [signingOut, setSigningOut] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)("");
			const [page, setPage] = (0, react.useState)(currentPage);
			const [visited, setVisited] = (0, react.useState)(() => /* @__PURE__ */ new Set([currentPage()]));
			(0, react.useEffect)(() => {
				const change = () => {
					const next = currentPage();
					setPage(next);
					setVisited((old) => /* @__PURE__ */ new Set([...old, next]));
				};
				window.addEventListener("hashchange", change);
				return () => window.removeEventListener("hashchange", change);
			}, []);
			const selected = ADMIN_PAGES.find((item) => item.id === page) || ADMIN_PAGES[0];
			async function signOut() {
				setSigningOut(true);
				setError("");
				try {
					if (!(await fetch("/admin/auth/logout", {
						method: "POST",
						credentials: "same-origin"
					})).ok) throw new Error("Sign-out failed. Please try again.");
					await onSignedOut();
				} catch (signOutError) {
					setError(errorText(signOutError));
				} finally {
					setSigningOut(false);
				}
			}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: AdminConsole_module_css_default.page,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
						className: AdminConsole_module_css_default.skipLink,
						href: "#admin-content",
						onClick: (event) => {
							event.preventDefault();
							document.getElementById("admin-content")?.focus();
						},
						children: "Skip to content"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("aside", {
						className: AdminConsole_module_css_default.sidebar,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("a", {
								href: "/admin",
								className: AdminConsole_module_css_default.brand,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: AdminConsole_module_css_default.brandMark,
									children: "S"
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["Sentinel", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: "Administration" })] })]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: AdminConsole_module_css_default.navLabel,
								children: "WORKSPACE"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("nav", {
								className: AdminConsole_module_css_default.navigation,
								"aria-label": "Administration",
								children: ADMIN_PAGES.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("a", {
									href: `#${item.id}`,
									className: page === item.id ? AdminConsole_module_css_default.navActive : "",
									"aria-current": page === item.id ? "page" : void 0,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(AdminIcon, { name: item.icon }), item.name]
								}, item.id))
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: AdminConsole_module_css_default.sidebarFoot,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
										href: "/",
										className: AdminConsole_module_css_default.backLink,
										children: "← Back to workspace"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: AdminConsole_module_css_default.identity,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: AdminConsole_module_css_default.avatar,
											children: email.slice(0, 1).toUpperCase() || "A"
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "Administrator" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: AdminConsole_module_css_default.account,
											title: email,
											children: email
										})] })]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: AdminConsole_module_css_default.signOut,
										type: "button",
										onClick: () => void signOut(),
										disabled: signingOut,
										children: signingOut ? "Signing out…" : "Sign out"
									})
								]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("main", {
						id: "admin-content",
						className: AdminConsole_module_css_default.shell,
						tabIndex: -1,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: AdminConsole_module_css_default.topbar,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["Workspace / ", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "Administration" })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: AdminConsole_module_css_default.adminBadge,
									children: "Admin access"
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
								className: AdminConsole_module_css_default.header,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: AdminConsole_module_css_default.eyebrow,
										children: "CITICTEL-CPC · SOC AGENT"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h1", {
										className: AdminConsole_module_css_default.title,
										children: selected.name
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: AdminConsole_module_css_default.subtitle,
										children: selected.copy
									})
								] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: AdminConsole_module_css_default.headerMark,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AdminIcon, { name: selected.icon })
								})]
							}),
							error ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: AdminConsole_module_css_default.error,
								role: "alert",
								children: error
							}) : null,
							visited.has("connections") ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								hidden: page !== "connections",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ServiceStatusPanel, { socClient })
							}) : null,
							visited.has("agent-context") ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								hidden: page !== "agent-context",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AgentContextSettings, { connection })
							}) : null,
							visited.has("access-approvals") ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								hidden: page !== "access-approvals",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AccessApprovalsSettings, {
									connection,
									socClient
								})
							}) : null,
							visited.has("providers") ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								hidden: page !== "providers",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProviderSettings, { connection })
							}) : null,
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("footer", {
								className: AdminConsole_module_css_default.pageFoot,
								children: "Sentinel administration · CITICTEL-CPC"
							})
						]
					})
				]
			});
		}
		function ServiceStatusPanel({ socClient }) {
			const [settings, setSettings] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)("");
			const [checks, setChecks] = (0, react.useState)({});
			const [busy, setBusy] = (0, react.useState)(null);
			const load = (0, react.useCallback)(async () => {
				setError("");
				try {
					setSettings(await rpc(socClient, "get-settings"));
				} catch (loadError) {
					setError(errorText(loadError));
				}
			}, [socClient]);
			(0, react.useEffect)(() => {
				load();
			}, [load]);
			async function check(service) {
				setBusy(service);
				setChecks((current) => ({
					...current,
					[service]: {
						kind: "info",
						text: "Checking…"
					}
				}));
				try {
					await rpc(socClient, service === "splunk" ? "test-splunk" : "test-subscription-server");
					setChecks((current) => ({
						...current,
						[service]: {
							kind: "success",
							text: "Connection verified"
						}
					}));
					await load();
				} catch (checkError) {
					setChecks((current) => ({
						...current,
						[service]: {
							kind: "error",
							text: errorText(checkError)
						}
					}));
				} finally {
					setBusy(null);
				}
			}
			const services = settings?.services || {};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: AdminConsole_module_css_default.section,
				"aria-labelledby": "service-status-title",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: AdminConsole_module_css_default.sectionHeading,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: AdminConsole_module_css_default.sectionKicker,
							children: "Environment services"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
							id: "service-status-title",
							className: AdminConsole_module_css_default.sectionTitle,
							children: "Connection status"
						})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: AdminConsole_module_css_default.sectionHint,
							children: "Configuration stays in the server .env file."
						})]
					}),
					error ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: AdminConsole_module_css_default.error,
						role: "alert",
						children: error
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: AdminConsole_module_css_default.statusGrid,
						children: [
							{
								key: "splunk",
								name: "Splunk",
								description: "Security event search and investigation",
								mark: "S",
								checkable: true
							},
							{
								key: "zimbra",
								name: "Zimbra",
								description: "Mail and identity operations",
								mark: "Z"
							},
							{
								key: "markitdown",
								name: "MarkItDown",
								description: "Attachment and document conversion",
								mark: "M"
							},
							{
								key: "subscription_server",
								name: "Subscription server",
								description: "Subscription and entitlement checks",
								mark: "↗",
								checkable: true
							}
						].map((card) => {
							const state = checks[card.key];
							const ready = serviceReady(services[card.key]);
							const connectionLabel = state?.kind === "info" ? "Checking…" : state?.kind === "success" ? "Connected" : state?.kind === "error" ? "Unavailable" : ready ? "Configured" : "Not configured";
							const connectionClass = state?.kind === "info" ? AdminConsole_module_css_default.statusInfo : state?.kind === "success" ? AdminConsole_module_css_default.statusReady : state?.kind === "error" ? AdminConsole_module_css_default.statusError : ready ? AdminConsole_module_css_default.statusConfigured : AdminConsole_module_css_default.statusMuted;
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
								className: AdminConsole_module_css_default.statusCard,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: AdminConsole_module_css_default.statusIcon,
									"aria-hidden": "true",
									children: card.mark
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: AdminConsole_module_css_default.statusBody,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: AdminConsole_module_css_default.statusTopline,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: card.name }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: `${AdminConsole_module_css_default.statusPill} ${connectionClass}`,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: AdminConsole_module_css_default.statusDot,
													"aria-hidden": "true"
												}), connectionLabel]
											})]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: card.description }),
										state ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: `${AdminConsole_module_css_default.checkMessage} ${AdminConsole_module_css_default[state.kind]}`,
											children: state.text
										}) : null,
										card.checkable ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											className: AdminConsole_module_css_default.textButton,
											type: "button",
											onClick: () => void check(card.key),
											disabled: busy === card.key,
											children: busy === card.key ? "Checking…" : "Check connection"
										}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: AdminConsole_module_css_default.envManaged,
											children: "Environment managed"
										})
									]
								})]
							}, card.key);
						})
					})
				]
			});
		}
		function AgentContextSettings({ connection }) {
			const [data, setData] = (0, react.useState)(null);
			const [backgroundEnabled, setBackgroundEnabled] = (0, react.useState)(true);
			const [backgroundPrompts, setBackgroundPrompts] = (0, react.useState)("5");
			const [timeEnabled, setTimeEnabled] = (0, react.useState)(true);
			const [timeSeconds, setTimeSeconds] = (0, react.useState)("0");
			const [validation, setValidation] = (0, react.useState)({});
			const [loading, setLoading] = (0, react.useState)(true);
			const { message, setMessage, busy, run } = useStatus();
			const load = (0, react.useCallback)(async () => {
				setLoading(true);
				setMessage(null);
				setValidation({});
				try {
					const { namespaces, writable } = await describeSettings(connection);
					const background = namespaces.get(BACKGROUND_SETTINGS_NAMESPACE);
					const time = namespaces.get(TIME_SETTINGS_NAMESPACE);
					if (!background || !time) throw new Error("Agent context settings are unavailable.");
					const backgroundValue = objectValue(background.value);
					const timeValue = objectValue(time.value);
					setData({
						background,
						time,
						writable
					});
					setBackgroundEnabled(backgroundValue.enabled !== false);
					setBackgroundPrompts(String(backgroundValue.repeatEveryUserPrompts ?? 5));
					setTimeEnabled(timeValue.enabled !== false);
					setTimeSeconds(String(Number(timeValue.refreshIntervalMs ?? 0) / 1e3));
				} catch (loadError) {
					setMessage({
						kind: "error",
						text: errorText(loadError)
					});
				} finally {
					setLoading(false);
				}
			}, [connection]);
			(0, react.useEffect)(() => {
				load();
			}, [load]);
			async function save(event) {
				event.preventDefault();
				if (!data?.writable || loading) return;
				setValidation({});
				return run(async () => {
					let repeatEveryUserPrompts;
					let seconds;
					const nextValidation = {};
					try {
						repeatEveryUserPrompts = nonNegativeInteger(backgroundPrompts, "BACKGROUND prompt frequency");
					} catch (validationError) {
						nextValidation.background = errorText(validationError);
					}
					try {
						seconds = nonNegativeInteger(timeSeconds, "Time interval", MAX_INTERVAL_SECONDS);
					} catch (validationError) {
						nextValidation.time = errorText(validationError);
					}
					if (nextValidation.background || nextValidation.time || repeatEveryUserPrompts === void 0 || seconds === void 0) {
						setValidation(nextValidation);
						setMessage({
							kind: "error",
							text: "Check the highlighted agent context fields."
						});
						return;
					}
					const backgroundResponse = await connection.api.settings.mutate({
						ns: data.background.ns,
						ops: [{
							op: "set",
							path: ["enabled"],
							value: backgroundEnabled
						}, {
							op: "set",
							path: ["repeatEveryUserPrompts"],
							value: repeatEveryUserPrompts
						}],
						expectedRevision: data.background.revision
					});
					const timeResponse = await connection.api.settings.mutate({
						ns: data.time.ns,
						ops: [{
							op: "set",
							path: ["enabled"],
							value: timeEnabled
						}, {
							op: "set",
							path: ["refreshIntervalMs"],
							value: seconds * 1e3
						}],
						expectedRevision: data.time.revision
					});
					const background = apiValue(backgroundResponse);
					const time = apiValue(timeResponse);
					setData({
						...data,
						background,
						time
					});
					setMessage({
						kind: "success",
						text: "Agent context settings saved."
					});
				});
			}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: AdminConsole_module_css_default.section,
				"aria-labelledby": "agent-context-title",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: AdminConsole_module_css_default.sectionHeading,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: AdminConsole_module_css_default.sectionKicker,
							children: "Model context"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
							id: "agent-context-title",
							className: AdminConsole_module_css_default.sectionTitle,
							children: "Agent context"
						})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: AdminConsole_module_css_default.sectionHint,
							children: "Changes apply live to existing and new sessions."
						})]
					}),
					loading ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						className: AdminConsole_module_css_default.loadingInline,
						children: [data ? "Refreshing" : "Loading", " agent context…"]
					}) : null,
					data ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
						onSubmit: save,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: AdminConsole_module_css_default.contextGrid,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
									className: AdminConsole_module_css_default.contextCard,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
												className: AdminConsole_module_css_default.sectionKicker,
												children: "Workspace reference"
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: "BACKGROUND.md" }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "Load this file at session startup and on configured refreshes." })
										] }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
											className: AdminConsole_module_css_default.toggleField,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												type: "checkbox",
												checked: backgroundEnabled,
												onChange: (event) => setBackgroundEnabled(event.target.checked),
												disabled: !data.writable || busy || loading
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "Inject BACKGROUND.md" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: "Disable to stop startup and periodic injections." })] })]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
											className: AdminConsole_module_css_default.field,
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "Repeat every user prompts" }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													className: AdminConsole_module_css_default.input,
													type: "number",
													min: "0",
													step: "1",
													inputMode: "numeric",
													value: backgroundPrompts,
													onChange: (event) => setBackgroundPrompts(event.target.value),
													"aria-describedby": "background-frequency-help",
													"aria-invalid": validation.background ? "true" : void 0,
													disabled: !data.writable || busy || loading
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
													id: "background-frequency-help",
													className: AdminConsole_module_css_default.fieldHint,
													children: "Use 0 for startup only. The default is every 5 additional user prompts."
												}),
												validation.background ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
													className: AdminConsole_module_css_default.fieldError,
													role: "alert",
													children: validation.background
												}) : null
											]
										})
									]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
									className: AdminConsole_module_css_default.contextCard,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
												className: AdminConsole_module_css_default.sectionKicker,
												children: "Current clock"
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: "Time context" }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "Supply the model with the current time and elapsed time." })
										] }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
											className: AdminConsole_module_css_default.toggleField,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												type: "checkbox",
												checked: timeEnabled,
												onChange: (event) => setTimeEnabled(event.target.checked),
												disabled: !data.writable || busy || loading
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "Inject current time" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: "Applies on the next eligible model step." })] })]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
											className: AdminConsole_module_css_default.field,
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "Minimum interval in seconds" }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													className: AdminConsole_module_css_default.input,
													type: "number",
													min: "0",
													max: MAX_INTERVAL_SECONDS,
													step: "1",
													inputMode: "numeric",
													value: timeSeconds,
													onChange: (event) => setTimeSeconds(event.target.value),
													"aria-describedby": "time-frequency-help",
													"aria-invalid": validation.time ? "true" : void 0,
													disabled: !data.writable || busy || loading || !timeEnabled
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
													id: "time-frequency-help",
													className: AdminConsole_module_css_default.fieldHint,
													children: "Use 0 to inject on every eligible model step."
												}),
												validation.time ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
													className: AdminConsole_module_css_default.fieldError,
													role: "alert",
													children: validation.time
												}) : null
											]
										})
									]
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatusNotice, {
								message,
								onRetry: load
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: AdminConsole_module_css_default.actions,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: `${AdminConsole_module_css_default.button} ${AdminConsole_module_css_default.primary}`,
									type: "submit",
									disabled: !data.writable || busy || loading,
									children: busy ? "Saving…" : "Save agent context"
								})
							})
						]
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatusNotice, {
						message,
						onRetry: load
					})
				]
			});
		}
		function defaultToolState(tool) {
			return tool.kind === "read" ? "auto" : "ask";
		}
		function isActionState(value) {
			return value === "ask" || value === "auto" || value === "disabled";
		}
		function AccessApprovalsSettings({ connection, socClient }) {
			const [data, setData] = (0, react.useState)(null);
			const [mode, setMode] = (0, react.useState)("soc");
			const [actionStates, setActionStates] = (0, react.useState)({});
			const [loading, setLoading] = (0, react.useState)(true);
			const { message, setMessage, busy, run } = useStatus();
			const load = (0, react.useCallback)(async () => {
				setLoading(true);
				setMessage(null);
				try {
					const [{ namespaces, writable }, catalogValue] = await Promise.all([describeSettings(connection), rpc(socClient, "get-admin-action-catalog")]);
					const actionApproval = namespaces.get(ACTION_APPROVAL_SETTINGS_NAMESPACE);
					const catalog = objectValue(catalogValue);
					const tools = validCatalog(Array.isArray(catalog.tools) ? catalog.tools : catalog.actions);
					if (!actionApproval || tools.length === 0) throw new Error("Access & approvals settings are unavailable.");
					const saved = objectValue(actionApproval.value);
					const savedStates = objectValue(saved.actionStates);
					const normalizedStates = Object.fromEntries(tools.filter((tool) => tool.kind !== "ui-confirmed").map((tool) => {
						const configured = savedStates[tool.name];
						const state = isActionState(configured) ? configured : defaultToolState(tool);
						return [tool.name, state];
					}));
					setData({
						actionApproval,
						tools,
						writable
					});
					setMode(saved.mode === "full" ? "full" : "soc");
					setActionStates(normalizedStates);
				} catch (loadError) {
					setMessage({
						kind: "error",
						text: errorText(loadError)
					});
				} finally {
					setLoading(false);
				}
			}, [connection, socClient]);
			(0, react.useEffect)(() => {
				load();
			}, [load]);
			async function save(event) {
				event.preventDefault();
				if (!data?.writable || loading) return;
				return run(async () => {
					const actionApproval = apiValue(await connection.api.settings.mutate({
						ns: data.actionApproval.ns,
						ops: [{
							op: "set",
							path: ["mode"],
							value: mode
						}, {
							op: "set",
							path: ["actionStates"],
							value: actionStates
						}],
						expectedRevision: data.actionApproval.revision
					}));
					setData({
						...data,
						actionApproval
					});
					setMessage({
						kind: "success",
						text: "Access & approvals settings saved."
					});
				});
			}
			const groups = data ? [...new Set(data.tools.map((tool) => tool.group))] : [];
			const stateLabel = {
				ask: "Ask",
				auto: "Run automatically",
				disabled: "Disabled"
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: AdminConsole_module_css_default.section,
				"aria-labelledby": "access-approvals-title",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: AdminConsole_module_css_default.sectionHeading,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: AdminConsole_module_css_default.sectionKicker,
							children: "Deployment policy"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
							id: "access-approvals-title",
							className: AdminConsole_module_css_default.sectionTitle,
							children: "Access & approvals"
						})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: AdminConsole_module_css_default.sectionHint,
							children: "Changes apply live to existing and new sessions."
						})]
					}),
					loading ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						className: AdminConsole_module_css_default.loadingInline,
						children: [data ? "Refreshing" : "Loading", " access controls…"]
					}) : null,
					data ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
						onSubmit: save,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
								className: AdminConsole_module_css_default.contextCard,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: AdminConsole_module_css_default.sectionKicker,
										children: "Deployment mode"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: "How permitted actions run" }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "Full access runs non-disabled permitted actions directly. SOC mode follows the action checklist below." }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("fieldset", {
										className: AdminConsole_module_css_default.modeChoices,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("legend", {
												className: AdminConsole_module_css_default.srOnly,
												children: "Deployment access mode"
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
												className: AdminConsole_module_css_default.modeChoice,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													type: "radio",
													name: "deployment-mode",
													value: "full",
													checked: mode === "full",
													onChange: () => setMode("full"),
													disabled: !data.writable || busy || loading
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "Full access" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: "Run every permitted tool directly." })] })]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
												className: AdminConsole_module_css_default.modeChoice,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													type: "radio",
													name: "deployment-mode",
													value: "soc",
													checked: mode === "soc",
													onChange: () => setMode("soc"),
													disabled: !data.writable || busy || loading
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "SOC mode" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: "Ask or run actions according to the checklist for this deployment." })] })]
											})
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: AdminConsole_module_css_default.fieldHint,
										children: "SOC mode controls only the per-tool ask, auto-run, and disabled states. Email delivery still requires the explicit Send confirmation in the draft view."
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: AdminConsole_module_css_default.accessGroups,
								children: groups.map((group) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("fieldset", {
									className: AdminConsole_module_css_default.actionGroup,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("legend", { children: group }), data.tools.filter((tool) => tool.group === group).map((tool) => {
										if (tool.kind === "ui-confirmed") return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: AdminConsole_module_css_default.actionRow,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: AdminConsole_module_css_default.actionInfo,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: tool.label }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
													className: AdminConsole_module_css_default.mono,
													children: tool.name
												})]
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: AdminConsole_module_css_default.protectedBadge,
												children: "Explicit confirmation"
											})]
										}, tool.name);
										const selected = actionStates[tool.name] ?? defaultToolState(tool);
										return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: AdminConsole_module_css_default.actionRow,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: AdminConsole_module_css_default.actionInfo,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: tool.label }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
													className: AdminConsole_module_css_default.mono,
													children: tool.name
												})]
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: AdminConsole_module_css_default.actionControls,
												children: [selected === "disabled" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: AdminConsole_module_css_default.unavailableBadge,
													children: "Unavailable"
												}) : null, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
													className: AdminConsole_module_css_default.stateChoices,
													role: "group",
													"aria-label": `Access for ${tool.label}`,
													children: [
														"ask",
														"auto",
														"disabled"
													].map((state) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
														className: AdminConsole_module_css_default.stateChoice,
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
															type: "radio",
															name: `action-state-${tool.name}`,
															value: state,
															checked: selected === state,
															onChange: () => setActionStates((current) => ({
																...current,
																[tool.name]: state
															})),
															disabled: !data.writable || busy || loading
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: stateLabel[state] })]
													}, state))
												})]
											})]
										}, tool.name);
									})]
								}, group))
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatusNotice, {
								message,
								onRetry: load
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: AdminConsole_module_css_default.actions,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: `${AdminConsole_module_css_default.button} ${AdminConsole_module_css_default.primary}`,
									type: "submit",
									disabled: !data.writable || busy || loading,
									children: busy ? "Saving…" : "Save access settings"
								})
							})
						]
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatusNotice, {
						message,
						onRetry: load
					})
				]
			});
		}
		function ProviderSettings({ connection }) {
			const [data, setData] = (0, react.useState)(null);
			const [selected, setSelected] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)("");
			const [loading, setLoading] = (0, react.useState)(true);
			const load = (0, react.useCallback)(async () => {
				setLoading(true);
				setError("");
				try {
					const [{ namespaces, writable }, providerResponse] = await Promise.all([describeSettings(connection), connection.api.llm.providers({})]);
					const providers = apiValue(providerResponse).providers;
					const refs = [...new Set(providers.map((provider) => {
						return deriveCredentialRef(provider, providerProfile(namespaces.get(provider.settingsNs), provider));
					}))];
					const credentialsView = apiValue(await connection.api.credentials.describe({ refs }));
					const credentialMap = new Map(Object.entries(credentialsView.credentials));
					const rows = providers.map((provider) => {
						const namespace = namespaces.get(provider.settingsNs);
						const profile = providerProfile(namespace, provider);
						const credentialRef = deriveCredentialRef(provider, profile);
						return {
							provider,
							namespace,
							profile,
							credentialRef,
							credential: credentialMap.get(credentialRef),
							configured: Boolean(namespace) && (provider.settingsPath.length === 0 || pathValue(namespace?.value, provider.settingsPath) !== void 0),
							writable: Boolean(namespace) && writable,
							modelCount: modelIds(profile).length
						};
					});
					setData({
						providers: rows,
						piAiNamespace: namespaces.get("llm-pi-ai"),
						writable
					});
				} catch (loadError) {
					setError(errorText(loadError));
				} finally {
					setLoading(false);
				}
			}, [connection]);
			(0, react.useEffect)(() => {
				load();
			}, [load]);
			(0, react.useEffect)(() => {
				if (!data) return;
				if (selected === CUSTOM_PROVIDER || data.providers.some((row) => row.provider.provider === selected)) return;
				setSelected(data.providers[0]?.provider.provider || CUSTOM_PROVIDER);
			}, [data, selected]);
			const current = (0, react.useMemo)(() => data?.providers.find((row) => row.provider.provider === selected), [data, selected]);
			const providerKey = current ? `${current.provider.provider}-${current.namespace?.revision ?? 0}` : CUSTOM_PROVIDER;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: AdminConsole_module_css_default.section,
				"aria-labelledby": "provider-settings-title",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: AdminConsole_module_css_default.sectionHeading,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: AdminConsole_module_css_default.sectionKicker,
							children: "LLM access"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
							id: "provider-settings-title",
							className: AdminConsole_module_css_default.sectionTitle,
							children: "Providers and credentials"
						})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: AdminConsole_module_css_default.sectionHint,
							children: "Keys are write-only and never displayed."
						})]
					}),
					error ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: AdminConsole_module_css_default.error,
						role: "alert",
						children: error
					}) : null,
					loading && !data ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: AdminConsole_module_css_default.loadingInline,
						children: "Loading providers…"
					}) : null,
					data ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: AdminConsole_module_css_default.providerLayout,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("aside", {
							className: AdminConsole_module_css_default.providerPicker,
							"aria-label": "LLM providers",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: AdminConsole_module_css_default.pickerHeader,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "Available providers" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: AdminConsole_module_css_default.countBadge,
										children: data.providers.length
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: AdminConsole_module_css_default.providerList,
									role: "listbox",
									"aria-label": "Choose a provider",
									children: data.providers.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
										className: `${AdminConsole_module_css_default.providerOption} ${selected === row.provider.provider ? AdminConsole_module_css_default.providerOptionSelected : ""}`,
										type: "button",
										role: "option",
										"aria-selected": selected === row.provider.provider,
										onClick: () => setSelected(row.provider.provider),
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: `${AdminConsole_module_css_default.providerDot} ${row.credential?.configured ? AdminConsole_module_css_default.providerDotReady : ""}`,
												"aria-hidden": "true"
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: AdminConsole_module_css_default.providerOptionText,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: row.provider.displayName || row.provider.provider }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: row.credential?.configured ? "Credential configured" : row.modelCount ? `${row.modelCount} model${row.modelCount === 1 ? "" : "s"}` : "Setup required" })]
											}),
											row.provider.declared === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: AdminConsole_module_css_default.customTag,
												children: "Custom"
											}) : null
										]
									}, row.provider.provider))
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									className: `${AdminConsole_module_css_default.customOption} ${selected === CUSTOM_PROVIDER ? AdminConsole_module_css_default.customOptionSelected : ""}`,
									type: "button",
									onClick: () => setSelected(CUSTOM_PROVIDER),
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: AdminConsole_module_css_default.addIcon,
										"aria-hidden": "true",
										children: "+"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "Custom provider" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: "OpenAI-compatible or Anthropic" })] })]
								})
							]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: AdminConsole_module_css_default.providerEditor,
							children: current ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProviderEditor, {
								connection,
								row: current,
								onChanged: load
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CustomProviderEditor, {
								connection,
								namespace: data.piAiNamespace,
								providers: data.providers,
								writable: data.writable,
								onChanged: load,
								onCreated: setSelected
							})
						}, providerKey)]
					}) : null
				]
			});
		}
		function ProviderEditor({ connection, row, onChanged }) {
			const { provider, namespace, profile } = row;
			const initialModels = modelIds(profile);
			const [displayName, setDisplayName] = (0, react.useState)(stringValue(profile.displayName));
			const [baseURL, setBaseURL] = (0, react.useState)(stringValue(profile.baseURL));
			const [api, setApi] = (0, react.useState)(stringValue(profile.api));
			const [models, setModels] = (0, react.useState)(initialModels.join("\n"));
			const [secret, setSecret] = (0, react.useState)("");
			const [discovered, setDiscovered] = (0, react.useState)([]);
			const { message, setMessage, busy, run } = useStatus();
			const isCustomProvider = provider.declared === true;
			const canEditProtocol = provider.settingsNs === "llm-pi-ai" && isCustomProvider;
			const canRemoveProvider = provider.declared === true && Boolean(namespace) && provider.settingsPath.length > 0;
			function addDiscoveredModel(id) {
				const current = models.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
				if (!current.includes(id)) setModels([...current, id].join("\n"));
			}
			async function save() {
				if (!namespace || !row.writable) return;
				return run(async () => {
					const ops = [];
					if (canEditProtocol && displayName.trim() !== stringValue(profile.displayName)) ops.push(displayName.trim() ? {
						op: "set",
						path: [...provider.settingsPath, "displayName"],
						value: displayName.trim()
					} : {
						op: "unset",
						path: [...provider.settingsPath, "displayName"]
					});
					const originalBaseURL = stringValue(profile.baseURL);
					if (baseURL.trim() !== originalBaseURL) ops.push(baseURL.trim() ? {
						op: "set",
						path: [...provider.settingsPath, "baseURL"],
						value: baseURL.trim()
					} : {
						op: "unset",
						path: [...provider.settingsPath, "baseURL"]
					});
					if (canEditProtocol && api.trim() !== stringValue(profile.api)) ops.push(api.trim() ? {
						op: "set",
						path: [...provider.settingsPath, "api"],
						value: api.trim()
					} : {
						op: "unset",
						path: [...provider.settingsPath, "api"]
					});
					const nextModels = models.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
					if (JSON.stringify(nextModels) !== JSON.stringify(initialModels)) ops.push(nextModels.length ? {
						op: "set",
						path: [...provider.settingsPath, "models"],
						value: mergeModels(profile, nextModels)
					} : {
						op: "unset",
						path: [...provider.settingsPath, "models"]
					});
					if (secret.trim() && !stringValue(profile.apiKeyEnv)) ops.push({
						op: "set",
						path: [...provider.settingsPath, "apiKeyEnv"],
						value: row.credentialRef
					});
					if (ops.length) apiValue(await connection.api.settings.mutate({
						ns: namespace.ns,
						ops,
						expectedRevision: namespace.revision
					}));
					if (secret.trim()) apiValue(await connection.api.credentials.set({
						ref: row.credentialRef,
						value: secret.trim()
					}));
					setSecret("");
					setMessage({
						kind: "success",
						text: "Provider settings saved."
					});
					await onChanged();
				});
			}
			async function removeCredential() {
				if (!row.credential?.configured || !row.credential.writable) return;
				return run(async () => {
					apiValue(await connection.api.credentials.unset({ ref: row.credentialRef }));
					setMessage({
						kind: "success",
						text: "Credential removed."
					});
					await onChanged();
				});
			}
			async function discover() {
				return run(async () => {
					const result = apiValue(await connection.api.llm.discoverModels({
						settingsNs: provider.settingsNs,
						provider: provider.provider,
						baseURL: baseURL.trim() || void 0,
						api: canEditProtocol ? api.trim() || void 0 : void 0,
						apiKey: secret.trim() || void 0
					}));
					setDiscovered(result.models);
					setMessage({
						kind: "info",
						text: result.models.length ? "Choose a model to add it to the provider." : "No models were discovered."
					});
				});
			}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: AdminConsole_module_css_default.editorHeading,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: AdminConsole_module_css_default.sectionKicker,
							children: "Provider configuration"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
							className: AdminConsole_module_css_default.editorTitle,
							children: provider.displayName || provider.provider
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: AdminConsole_module_css_default.editorCopy,
							children: isCustomProvider ? "Configure the provider connection and credential." : "Manage the credential for this provider."
						})
					] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: `${AdminConsole_module_css_default.statusPill} ${row.credential?.configured ? AdminConsole_module_css_default.statusReady : AdminConsole_module_css_default.statusMuted}`,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: AdminConsole_module_css_default.statusDot,
							"aria-hidden": "true"
						}), row.credential?.configured ? "Credential set" : "Credential needed"]
					})]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: AdminConsole_module_css_default.editorForm,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						className: AdminConsole_module_css_default.field,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "API key" }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: AdminConsole_module_css_default.input,
								type: "password",
								value: secret,
								onChange: (event) => setSecret(event.target.value),
								placeholder: row.credential?.configured ? "Stored securely · enter a new key to replace it" : "Enter the provider API key",
								autoComplete: "new-password",
								disabled: !row.writable || row.credential?.writable === false || busy
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
								className: AdminConsole_module_css_default.fieldHint,
								children: "The key is stored securely and is never returned to this page."
							})
						]
					}), isCustomProvider ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
						className: AdminConsole_module_css_default.advanced,
						open: Boolean(baseURL || api || initialModels.length),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: "Advanced provider settings" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: AdminConsole_module_css_default.advancedBody,
							children: [
								canEditProtocol ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: AdminConsole_module_css_default.field,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["Display name ", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("em", { children: "optional" })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										className: AdminConsole_module_css_default.input,
										value: displayName,
										onChange: (event) => setDisplayName(event.target.value),
										placeholder: provider.provider,
										disabled: !row.writable || busy
									})]
								}) : null,
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: AdminConsole_module_css_default.field,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["Base URL ", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("em", { children: "optional" })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										className: AdminConsole_module_css_default.input,
										type: "url",
										value: baseURL,
										onChange: (event) => setBaseURL(event.target.value),
										placeholder: "https://api.example.com",
										disabled: !row.writable || busy
									})]
								}),
								canEditProtocol ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: AdminConsole_module_css_default.field,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "API protocol" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
										className: AdminConsole_module_css_default.input,
										value: api,
										onChange: (event) => setApi(event.target.value),
										disabled: !row.writable || busy,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: "",
											children: "Provider default"
										}), SUPPORTED_PROTOCOLS.map((protocol) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: protocol.value,
											children: protocol.label
										}, protocol.value))]
									})]
								}) : null,
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: AdminConsole_module_css_default.field,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["Model IDs ", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("em", { children: "one per line" })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
										className: `${AdminConsole_module_css_default.input} ${AdminConsole_module_css_default.textarea}`,
										value: models,
										onChange: (event) => setModels(event.target.value),
										placeholder: "deepseek-chat",
										rows: 4,
										disabled: !row.writable || busy
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: AdminConsole_module_css_default.discoveryRow,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: AdminConsole_module_css_default.button,
										type: "button",
										onClick: () => void discover(),
										disabled: busy || !provider.settingsNs,
										children: busy ? "Working…" : "Discover models"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: AdminConsole_module_css_default.fieldHint,
										children: "Uses the draft URL and key when provided."
									})]
								}),
								discovered.length ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: AdminConsole_module_css_default.discovered,
									"aria-label": "Discovered models",
									children: discovered.map((model) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
										className: AdminConsole_module_css_default.modelChip,
										type: "button",
										onClick: () => addDiscoveredModel(model.id),
										children: [
											model.id,
											" ",
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												"aria-hidden": "true",
												children: "+"
											})
										]
									}, model.id))
								}) : null
							]
						})]
					}) : null]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatusNotice, { message }),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: AdminConsole_module_css_default.actions,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: `${AdminConsole_module_css_default.button} ${AdminConsole_module_css_default.primary}`,
							type: "button",
							onClick: () => void save(),
							disabled: !row.writable || busy,
							children: busy ? "Saving…" : "Save provider"
						}),
						row.credential?.configured ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: AdminConsole_module_css_default.button,
							type: "button",
							onClick: () => void removeCredential(),
							disabled: !row.credential.writable || busy,
							children: "Remove credential"
						}) : null,
						canRemoveProvider ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CustomProviderRemoval, {
							connection,
							row,
							onChanged,
							disabled: busy
						}) : null
					]
				})
			] });
		}
		function CustomProviderRemoval({ connection, row, onChanged, disabled }) {
			const [confirming, setConfirming] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)("");
			async function remove() {
				if (!row.namespace) return;
				setError("");
				try {
					if (row.credential?.configured) apiValue(await connection.api.credentials.unset({ ref: row.credentialRef }));
					apiValue(await connection.api.settings.mutate({
						ns: row.namespace.ns,
						ops: [{
							op: "unset",
							path: row.provider.settingsPath
						}],
						expectedRevision: row.namespace.revision
					}));
					await onChanged();
				} catch (removeError) {
					setError(errorText(removeError));
					setConfirming(false);
				}
			}
			if (confirming) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: AdminConsole_module_css_default.confirmGroup,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
						"Remove ",
						row.provider.displayName || row.provider.provider,
						"?"
					] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						className: AdminConsole_module_css_default.dangerButton,
						type: "button",
						onClick: () => void remove(),
						disabled,
						children: "Remove"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						className: AdminConsole_module_css_default.button,
						type: "button",
						onClick: () => setConfirming(false),
						disabled,
						children: "Cancel"
					}),
					error ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
						className: AdminConsole_module_css_default.error,
						children: error
					}) : null
				]
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				className: AdminConsole_module_css_default.dangerButton,
				type: "button",
				onClick: () => setConfirming(true),
				disabled,
				children: "Remove provider"
			});
		}
		function CustomProviderEditor({ connection, namespace, providers, writable, onChanged, onCreated }) {
			const [route, setRoute] = (0, react.useState)("");
			const [displayName, setDisplayName] = (0, react.useState)("");
			const [baseURL, setBaseURL] = (0, react.useState)("");
			const [api, setApi] = (0, react.useState)("openai-completions");
			const [model, setModel] = (0, react.useState)("");
			const [secret, setSecret] = (0, react.useState)("");
			const [savedRoute, setSavedRoute] = (0, react.useState)("");
			const { message, setMessage, busy, run } = useStatus();
			const normalizedRoute = route.trim().toLowerCase();
			const routeTaken = providers.some((row) => row.provider.provider === normalizedRoute);
			const routeValid = PROVIDER_ROUTE_PATTERN.test(normalizedRoute);
			const canSave = Boolean(namespace && writable && routeValid && !routeTaken && baseURL.trim() && model.trim());
			const credentialRef = `${normalizedRoute.replace(/[^a-z0-9]+/gi, "_").toUpperCase()}_API_KEY`;
			async function save() {
				if (!namespace || !canSave) return;
				return run(async () => {
					if (savedRoute && savedRoute !== normalizedRoute) throw new Error("The route cannot be changed after saving.");
					if (!savedRoute) {
						apiValue(await connection.api.settings.mutate({
							ns: namespace.ns,
							ops: [{
								op: "set",
								path: ["providers", normalizedRoute],
								value: {
									...displayName.trim() ? { displayName: displayName.trim() } : {},
									...secret.trim() ? { apiKeyEnv: credentialRef } : {},
									api,
									baseURL: baseURL.trim(),
									models: [{ id: model.trim() }]
								}
							}],
							expectedRevision: namespace.revision
						}));
						setSavedRoute(normalizedRoute);
					}
					if (secret.trim()) apiValue(await connection.api.credentials.set({
						ref: credentialRef,
						value: secret.trim()
					}));
					setSecret("");
					setMessage({
						kind: "success",
						text: "Custom provider saved."
					});
					await onChanged();
					onCreated(normalizedRoute);
				});
			}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: AdminConsole_module_css_default.editorHeading,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: AdminConsole_module_css_default.sectionKicker,
							children: "Add provider"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
							className: AdminConsole_module_css_default.editorTitle,
							children: "Custom provider"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: AdminConsole_module_css_default.editorCopy,
							children: "Connect an OpenAI-compatible or Anthropic endpoint with its own model name."
						})
					] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: AdminConsole_module_css_default.customBadge,
						children: "Custom"
					})]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: AdminConsole_module_css_default.editorForm,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: AdminConsole_module_css_default.fieldGrid,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: AdminConsole_module_css_default.field,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "Provider route" }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										className: AdminConsole_module_css_default.input,
										value: route,
										onChange: (event) => setRoute(event.target.value),
										placeholder: "my-provider",
										disabled: Boolean(savedRoute) || busy,
										autoComplete: "off"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
										className: AdminConsole_module_css_default.fieldHint,
										children: route && !routeValid ? "Use lowercase letters, numbers, and hyphens." : routeTaken ? "That provider already exists." : "This becomes the provider identifier."
									})
								]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: AdminConsole_module_css_default.field,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["Display name ", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("em", { children: "optional" })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									className: AdminConsole_module_css_default.input,
									value: displayName,
									onChange: (event) => setDisplayName(event.target.value),
									placeholder: "My AI provider",
									disabled: busy
								})]
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: AdminConsole_module_css_default.field,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "Base URL" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: AdminConsole_module_css_default.input,
								type: "url",
								value: baseURL,
								onChange: (event) => setBaseURL(event.target.value),
								placeholder: "https://api.example.com/v1",
								disabled: busy,
								required: true
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: AdminConsole_module_css_default.fieldGrid,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: AdminConsole_module_css_default.field,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "API protocol" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
									className: AdminConsole_module_css_default.input,
									value: api,
									onChange: (event) => setApi(event.target.value),
									disabled: busy,
									children: SUPPORTED_PROTOCOLS.map((protocol) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: protocol.value,
										children: protocol.label
									}, protocol.value))
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: AdminConsole_module_css_default.field,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "Model ID" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									className: AdminConsole_module_css_default.input,
									value: model,
									onChange: (event) => setModel(event.target.value),
									placeholder: "model-name",
									disabled: busy,
									required: true
								})]
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: AdminConsole_module_css_default.field,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["API key ", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("em", { children: "optional for provider-native auth" })] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									className: AdminConsole_module_css_default.input,
									type: "password",
									value: secret,
									onChange: (event) => setSecret(event.target.value),
									placeholder: "Enter the provider API key",
									autoComplete: "new-password",
									disabled: busy
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
									className: AdminConsole_module_css_default.fieldHint,
									children: "Stored securely under a provider-derived credential name."
								})
							]
						})
					]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatusNotice, { message }),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: AdminConsole_module_css_default.actions,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						className: `${AdminConsole_module_css_default.button} ${AdminConsole_module_css_default.primary}`,
						type: "button",
						onClick: () => void save(),
						disabled: !canSave || busy,
						children: busy ? "Saving…" : savedRoute ? "Save credential" : "Add provider"
					})
				})
			] });
		}
		//#endregion
		//#region src/client/index.ts
		/** The complete optional administration surface. */
		const inject = [
			"slots",
			"socClient",
			"remote"
		];
		function adminConnection(remote) {
			const wrap = async (operation) => ({ result: await operation });
			return { api: {
				settings: {
					describe: () => wrap(remote.settings.describe()),
					mutate: (request) => wrap(remote.settings.mutate(request.ns, request.ops, request.expectedRevision))
				},
				credentials: {
					describe: async (request) => {
						const result = await remote.credentials.describe(request.refs);
						return { result: result.ok ? {
							ok: true,
							value: { credentials: result.value }
						} : result };
					},
					set: (request) => wrap(remote.credentials.set(request.ref, request.value)),
					unset: (request) => wrap(remote.credentials.unset(request.ref))
				},
				llm: {
					providers: async () => {
						const result = await remote.llm.listConfigurableProviders();
						return { result: result.ok ? {
							ok: true,
							value: { providers: result.value }
						} : result };
					},
					discoverModels: async (request) => {
						const { settingsNs, ...draft } = request;
						const result = await remote.llm.discoverModels(settingsNs, draft);
						return { result: result.ok ? {
							ok: true,
							value: { models: result.value }
						} : result };
					}
				}
			} };
		}
		function apply(ctx) {
			if (ctx.get("socClient").surface !== "admin") return;
			ctx.slots.inject("soc.admin.content", () => ctx.slots.register({ name: "soc.admin.content" }, (props) => react.default.createElement(AdminConsole, {
				...props,
				connection: adminConnection(ctx.remote)
			})));
		}
		//#endregion
		exports.AdminConsole = AdminConsole;
		exports.apply = apply;
		exports.inject = inject;
		exports.validCatalog = validCatalog;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map