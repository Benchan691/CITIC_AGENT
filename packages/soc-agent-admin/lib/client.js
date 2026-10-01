window.__ModuleLoader__.load({
	id: "dsh-soc-agent-admin",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region \0dsh-css:/home/cpcnet/CITIC_AGENT/packages/soc-agent-admin/src/client/AdminConsole.module.css.mjs
		const css = ".jd4TFW_page,.jd4TFW_loginPage{--ink:#202c35;--muted:#65747d;--line:#dfe5e5;--accent:#216b5c;--paper:#fff;color-scheme:light;color:var(--ink);background:#f4f6f5;min-height:100vh;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;font-size:14px;line-height:1.5}.jd4TFW_page *,.jd4TFW_loginPage *{box-sizing:border-box}.jd4TFW_page [hidden]{display:none!important}.jd4TFW_page button,.jd4TFW_loginPage button,.jd4TFW_page input,.jd4TFW_page select,.jd4TFW_page textarea{font:inherit}.jd4TFW_page a{color:inherit}.jd4TFW_page :focus-visible,.jd4TFW_loginPage :focus-visible{outline-offset:3px;outline:3px solid #49a68d}.jd4TFW_page{grid-template-columns:232px minmax(0,1fr);display:grid}.jd4TFW_sidebar{color:#d3dfdc;background:#142c2c;flex-direction:column;height:100vh;padding:32px 18px 22px;display:flex;position:sticky;top:0}.jd4TFW_brand{letter-spacing:-.5px;align-items:center;gap:12px;padding:0 10px 42px;font-size:22px;font-weight:700;text-decoration:none;display:flex}.jd4TFW_brand small{letter-spacing:.3px;color:#a9bfba;font-size:11px;font-weight:400;display:block}.jd4TFW_brandMark{color:#194e40;background:#d9eee1;border-radius:12px;place-items:center;width:38px;height:42px;font-family:Georgia,serif;font-size:24px;display:grid}.jd4TFW_navLabel{letter-spacing:1.8px;color:#8da9a2;margin:0 0 12px;padding:0 14px;font-size:10px;font-weight:600}.jd4TFW_navigation{gap:5px;display:grid}.jd4TFW_navigation a{color:#b4c8c2;border-radius:7px;align-items:center;gap:12px;padding:12px 14px;font-size:13px;text-decoration:none;display:flex}.jd4TFW_navigation a:hover{color:#fff;background:#203d3b}.jd4TFW_navigation .jd4TFW_navActive{color:#f0f8f3;background:#2c4944;font-weight:600;box-shadow:inset 3px 0 #a9d3b7}.jd4TFW_sidebarFoot{margin-top:auto;padding:32px 10px 0}.jd4TFW_backLink{padding-bottom:24px;font-size:12px;text-decoration:none;display:block;color:#b8c9c4!important}.jd4TFW_identity{border-top:1px solid #37504a;gap:10px;min-width:0;padding:19px 0 10px;display:flex}.jd4TFW_identity>div{min-width:0}.jd4TFW_identity strong{color:#e0e9e5;font-size:12px;font-weight:500;display:block}.jd4TFW_avatar{color:#d4e9db;background:#36574b;border-radius:50%;flex:0 0 33px;place-items:center;height:33px;display:grid}.jd4TFW_account{text-overflow:ellipsis;white-space:nowrap;color:#9eb6ae;max-width:155px;font-size:11px;display:block;overflow:hidden}.jd4TFW_signOut{color:#b9cdc5;cursor:pointer;background:0 0;border:0;padding:8px 0;font-size:12px!important}.jd4TFW_shell{width:100%;min-width:0;max-width:1550px;margin:0 auto;padding:0 clamp(24px,4vw,64px)}.jd4TFW_topbar{border-bottom:1px solid var(--line);min-height:74px;color:var(--muted);justify-content:space-between;align-items:center;font-size:12px;display:flex}.jd4TFW_topbar strong{color:var(--ink);font-weight:500}.jd4TFW_adminBadge{color:#4c6259;background:#e8eeeb;border-radius:4px;padding:4px 10px;font-size:11px}.jd4TFW_header{justify-content:space-between;align-items:center;gap:24px;padding:34px 0 26px;display:flex}.jd4TFW_eyebrow,.jd4TFW_sectionKicker{color:#677f75;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 9px;font-size:10px;font-weight:700}.jd4TFW_title,.jd4TFW_loginTitle,.jd4TFW_sectionTitle,.jd4TFW_editorTitle{color:var(--ink);letter-spacing:-.6px;margin:0;font-weight:600}.jd4TFW_title{font-size:34px;line-height:1.2}.jd4TFW_subtitle{color:var(--muted);margin:10px 0 0;font-size:14px}.jd4TFW_headerMark{color:#4c7161;background:#ecf1ec;border:1px solid #d3dfd8;border-radius:13px;place-items:center;width:48px;height:48px;display:grid}.jd4TFW_headerMark svg{width:24px;height:24px}.jd4TFW_section{margin:8px 0 32px}.jd4TFW_sectionHeading{justify-content:space-between;align-items:center;gap:20px;margin-bottom:20px;display:flex}.jd4TFW_sectionTitle{font-size:20px}.jd4TFW_sectionHint{color:var(--muted);text-align:right;max-width:290px;font-size:12px}.jd4TFW_headerActions,.jd4TFW_toolbar{flex-wrap:wrap;align-items:center;gap:12px;display:flex}.jd4TFW_metrics{grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin:0 0 28px;display:grid}.jd4TFW_metric{border:1px solid var(--line);background:#fff;border-radius:10px;flex-direction:column;padding:22px;text-decoration:none;display:flex;box-shadow:0 2px 3px #182e2610}.jd4TFW_metric:hover{border-color:#a8c4b8}.jd4TFW_metricLabel{color:#54675f;justify-content:space-between;align-items:center;gap:8px;font-size:12px;display:flex}.jd4TFW_metricLabel svg{color:#7a9689}.jd4TFW_metric>strong{letter-spacing:-1px;margin:18px 0;font-size:32px;font-weight:600;line-height:1.3}.jd4TFW_metric>small{color:var(--muted);justify-content:space-between;gap:12px;font-size:11px;display:flex}.jd4TFW_metricAttention{background:#fffaf2;border-color:#ebd6b7}.jd4TFW_metricAttention>strong{color:#976322}.jd4TFW_contentGrid{grid-template-columns:minmax(0,1.9fr) minmax(230px,1fr);align-items:start;gap:22px;display:grid}.jd4TFW_card{background:var(--paper);border:1px solid var(--line);border-radius:10px;min-width:0;margin-bottom:22px;padding:26px}.jd4TFW_helpCard{color:#455c4e;background:#eaf0e9;border:1px solid #dce5d9;border-radius:10px;padding:28px}.jd4TFW_helpCard h3{color:#294938;margin:0 0 12px;font-family:Georgia,serif;font-size:26px;font-weight:400;line-height:1.2}.jd4TFW_helpCard p{font-size:13px;line-height:1.75}.jd4TFW_steps{margin:22px 0;padding-left:20px;font-size:12px}.jd4TFW_steps li{padding:5px 0 5px 5px}.jd4TFW_quickLinks{margin-top:18px;display:grid}.jd4TFW_quickLinks a{border-bottom:1px solid #e9eeeb;align-items:center;gap:15px;padding:20px 0;text-decoration:none;display:flex}.jd4TFW_quickLinks a:last-child{border-bottom:0;padding-bottom:4px}.jd4TFW_quickLinks a>span:nth-child(2){flex:1}.jd4TFW_quickLinks strong{font-size:14px;font-weight:600;display:block}.jd4TFW_quickLinks small{color:var(--muted);margin-top:5px;font-size:12px;line-height:1.5;display:block}.jd4TFW_quickLinks a:hover strong{color:var(--accent)}.jd4TFW_quickIcon{color:#50725e;background:#f0f4f1;border:1px solid #e2eae4;border-radius:9px;flex:0 0 38px;place-items:center;width:38px;height:38px;display:grid}.jd4TFW_pageFoot{border-top:1px solid var(--line);color:#77867e;margin-top:30px;padding:24px 0;font-size:11px}.jd4TFW_statusGrid{grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;display:grid}.jd4TFW_statusCard{border:1px solid var(--line);background:#fff;border-radius:10px;gap:15px;min-width:0;padding:22px;display:flex}.jd4TFW_statusIcon{color:#346e55;background:#edf4ef;border:1px solid #d6e4dc;border-radius:9px;flex:0 0 36px;place-items:center;height:36px;font-weight:600;display:grid}.jd4TFW_statusBody{flex:1;min-width:0}.jd4TFW_statusTopline{flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;display:flex}.jd4TFW_statusTopline h3{margin:0;font-size:14px;font-weight:600}.jd4TFW_statusBody p{color:var(--muted);margin:9px 0 0;font-size:12px}.jd4TFW_statusPill,.jd4TFW_customBadge,.jd4TFW_customTag,.jd4TFW_countBadge{white-space:nowrap;border-radius:5px;align-items:center;gap:6px;padding:4px 9px;font-size:11px;font-weight:500;display:inline-flex}.jd4TFW_statusReady{color:#286043;background:#e5f2e9}.jd4TFW_statusConfigured,.jd4TFW_statusInfo{color:#385e73;background:#e8f0f4}.jd4TFW_statusError{color:#9d3e32;background:#fceee7}.jd4TFW_statusMuted{color:#65726e;background:#eff1ef}.jd4TFW_statusDot,.jd4TFW_providerDot{background:#97a59e;border-radius:50%;width:6px;height:6px;display:inline-block}.jd4TFW_statusReady .jd4TFW_statusDot,.jd4TFW_providerDotReady{background:#378657}.jd4TFW_statusConfigured .jd4TFW_statusDot,.jd4TFW_statusInfo .jd4TFW_statusDot{background:#507c94}.jd4TFW_statusError .jd4TFW_statusDot{background:#bb5f4c}.jd4TFW_textButton{cursor:pointer;background:0 0;border:0;margin-top:14px;padding:0;font-weight:600;text-decoration:none;display:inline-block;color:var(--accent)!important;font-size:12px!important}.jd4TFW_textButton:hover{text-decoration:underline}.jd4TFW_envManaged{color:#76827c;margin-top:14px;font-size:11px;display:block}.jd4TFW_button,.jd4TFW_dangerButton{color:#3e5349;cursor:pointer;background:#fff;border:1px solid #d5deda;border-radius:6px;justify-content:center;align-items:center;gap:7px;min-height:38px;padding:9px 14px;line-height:1.3;text-decoration:none;display:inline-flex;font-size:12px!important;font-weight:600!important}.jd4TFW_button:hover:not(:disabled){background:#f2f6f3;border-color:#91b3a3}.jd4TFW_primary{color:#fff;background:#246b55;border-color:#246b55}.jd4TFW_primary:hover:not(:disabled){background:#19533f;border-color:#19533f}.jd4TFW_dangerButton{color:#a14235;background:#fff9f6;border-color:#eccdc3}.jd4TFW_dangerButton:hover{background:#fceee8}.jd4TFW_button:disabled,.jd4TFW_dangerButton:disabled,.jd4TFW_textButton:disabled{cursor:not-allowed;opacity:.55}.jd4TFW_error,.jd4TFW_message{overflow-wrap:anywhere;border-radius:6px;margin:12px 0;padding:12px 15px;font-size:13px}.jd4TFW_error{color:#9b3c32;background:#fff0eb}.jd4TFW_success{color:#2b6748;background:#eaf5ed}.jd4TFW_info{color:#365e73;background:#edf3f7}.jd4TFW_checkMessage{overflow-wrap:anywhere}.jd4TFW_checkMessage.jd4TFW_success{color:#2b6748;padding:5px}.jd4TFW_loading,.jd4TFW_loadingInline{color:#5d7167;background:#f4f6f5;padding:28px;font-size:14px}.jd4TFW_loading{place-items:center;min-height:100vh;display:grid}.jd4TFW_providerLayout{border:1px solid var(--line);background:#fff;border-radius:10px;grid-template-columns:250px minmax(0,1fr);display:grid;overflow:hidden}.jd4TFW_providerPicker{border-right:1px solid var(--line);background:#fafbf9;min-width:0;padding:18px 12px}.jd4TFW_pickerHeader{justify-content:space-between;align-items:center;padding:0 8px 12px;font-size:12px;font-weight:600;display:flex}.jd4TFW_countBadge{color:#4a6c59;background:#e9efeb}.jd4TFW_providerList{flex-direction:column;gap:4px;max-height:430px;display:flex;overflow:auto}.jd4TFW_providerOption,.jd4TFW_customOption{text-align:left;width:100%;color:var(--ink);cursor:pointer;background:0 0;border:1px solid #0000;border-radius:6px;align-items:center;gap:10px;padding:12px 10px;display:flex}.jd4TFW_providerOption:hover,.jd4TFW_customOption:hover{background:#eef3ef}.jd4TFW_providerOptionSelected,.jd4TFW_customOptionSelected{background:#e7f0e9;border-color:#c6d9cc}.jd4TFW_providerDot{flex:0 0 6px}.jd4TFW_providerOptionText,.jd4TFW_customOption>span:last-child{flex-direction:column;flex:1;gap:4px;min-width:0;display:flex}.jd4TFW_providerOptionText strong,.jd4TFW_customOption strong{overflow-wrap:anywhere;font-size:12px;font-weight:600}.jd4TFW_providerOptionText small,.jd4TFW_customOption small{color:var(--muted);font-size:10px}.jd4TFW_customTag,.jd4TFW_customBadge{color:#806239;background:#f4eee0;font-size:9px}.jd4TFW_customOption{border-top:1px solid var(--line);border-radius:0;margin-top:14px}.jd4TFW_addIcon{color:var(--accent);font-size:20px}.jd4TFW_providerEditor{min-width:0;padding:28px}.jd4TFW_editorHeading{border-bottom:1px solid var(--line);justify-content:space-between;align-items:flex-start;gap:15px;padding-bottom:22px;display:flex}.jd4TFW_editorTitle{font-size:20px}.jd4TFW_editorCopy{color:var(--muted);margin:10px 0 0;font-size:13px;line-height:1.6}.jd4TFW_editorForm,.jd4TFW_form,.jd4TFW_formFields{border:0;flex-direction:column;gap:20px;min-width:0;margin:22px 0 0;padding:0;display:flex}.jd4TFW_fieldGrid{grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;display:grid}.jd4TFW_field{color:#3f5449;flex-direction:column;gap:8px;min-width:0;font-size:12px;font-weight:600;display:flex}.jd4TFW_field em{color:var(--muted);font-size:11px;font-style:normal;font-weight:400}.jd4TFW_input{width:100%;min-width:0;color:var(--ink);background:#fff;border:1px solid #cedbd3;border-radius:6px;padding:10px 12px;font-weight:400;line-height:1.5;display:block;font-size:13px!important}.jd4TFW_input::placeholder{color:#7c8c82}.jd4TFW_input:focus{border-color:#559779}.jd4TFW_input:disabled{cursor:not-allowed;opacity:.7;background:#f3f5f2}textarea.jd4TFW_input{resize:vertical}.jd4TFW_textarea{min-height:100px}.jd4TFW_fieldHint{color:var(--muted);font-size:11px;font-weight:400;line-height:1.6}.jd4TFW_advanced{border:1px solid var(--line);background:#fafbf9;border-radius:7px;margin-top:8px}.jd4TFW_advanced summary{cursor:pointer;color:#425e4e;padding:13px 16px;font-size:12px;font-weight:600}.jd4TFW_advancedBody{flex-direction:column;gap:16px;padding:0 16px 18px;display:flex}.jd4TFW_modelRows{flex-direction:column;gap:12px;display:flex}.jd4TFW_modelEntry{background:#fff;border:1px solid #dfe7e1;border-radius:7px;flex-direction:column;gap:14px;padding:14px;display:flex}.jd4TFW_modelEntryHeading{color:#40584a;justify-content:space-between;align-items:center;gap:12px;font-size:12px;display:flex}.jd4TFW_modelEntryHeading .jd4TFW_textButton{margin-top:0}.jd4TFW_discoveryRow,.jd4TFW_discovered{flex-wrap:wrap;align-items:center;gap:10px;display:flex}.jd4TFW_modelChip{color:#3e6d50;cursor:pointer;background:#edf5ef;border:1px solid #cadecf;border-radius:5px;padding:7px 10px;font-size:12px}.jd4TFW_actions{flex-wrap:wrap;align-items:center;gap:10px;margin-top:8px;display:flex}.jd4TFW_confirmGroup{color:#8e4e42;flex-wrap:wrap;align-items:center;gap:8px;font-size:12px;display:flex}.jd4TFW_confirmGroup .jd4TFW_error{width:100%}.jd4TFW_loginPage{background:#eaf0ea;place-items:center;padding:24px;display:grid}.jd4TFW_loginPanel{background:#fff;border:1px solid #d4dfd5;border-radius:14px;width:min(100%,430px);padding:40px;box-shadow:0 20px 80px #26443515}.jd4TFW_loginMark{color:#fff;background:#246b55;border-radius:11px;place-items:center;width:44px;height:44px;margin-bottom:26px;font-family:Georgia,serif;font-size:22px;display:grid}.jd4TFW_loginTitle{font-size:30px;line-height:1.2}.jd4TFW_loginCopy{color:var(--muted);margin:14px 0 25px;font-size:13px}.jd4TFW_fullButton{width:100%}.jd4TFW_loginFootnote{color:var(--muted);margin:24px 0 0;font-size:11px}.jd4TFW_notice{color:#526b5d;background:#edf2ef;border:1px solid #dce5df;border-radius:7px;align-items:center;gap:12px;padding:14px 18px;font-size:12px;display:flex}.jd4TFW_tabs{border-bottom:1px solid var(--line);flex-wrap:wrap;gap:4px;margin:22px 0;display:flex}.jd4TFW_tabs button{color:var(--muted);cursor:pointer;background:0 0;border:0;border-bottom:2px solid #0000;padding:12px 14px;font-size:12px}.jd4TFW_tabs .jd4TFW_activeTab{color:#256849;border-bottom-color:#256849;font-weight:600}.jd4TFW_toolbar{margin:0 0 18px}.jd4TFW_toolbar>.jd4TFW_input,.jd4TFW_search{max-width:320px}.jd4TFW_toolbar>.jd4TFW_button:last-child{margin-left:auto}.jd4TFW_tableWrap{border:1px solid var(--line);background:#fff;border-radius:8px;margin-bottom:22px;overflow:auto}.jd4TFW_table{border-collapse:collapse;text-align:left;width:100%;font-size:12px}.jd4TFW_table th{color:#67786d;border-bottom:1px solid var(--line);white-space:nowrap;background:#f9fbf8;padding:13px 18px;font-size:11px;font-weight:500}.jd4TFW_table td{vertical-align:top;border-bottom:1px solid #edf0ec;padding:17px 18px}.jd4TFW_table tr:last-child td{border-bottom:0}.jd4TFW_table td strong{font-weight:600}.jd4TFW_table td small{color:var(--muted);margin-top:5px;display:block}.jd4TFW_table td summary{cursor:pointer;min-width:150px}.jd4TFW_empty{color:var(--muted);text-align:center;padding:35px 22px;font-size:13px}.jd4TFW_checkboxGroup{border:1px solid var(--line);border-radius:7px;flex-wrap:wrap;gap:12px;max-height:230px;padding:14px;display:flex;overflow:auto}.jd4TFW_checkboxGroup legend{color:#4b6555;padding:0 5px;font-size:12px}.jd4TFW_checkboxGroup label,.jd4TFW_checkLabel{color:#3c5546;align-items:center;gap:8px;font-size:12px;display:flex}.jd4TFW_checkboxGroup input,.jd4TFW_checkLabel input{accent-color:#276e53;width:16px;height:16px}.jd4TFW_previewEnvelope{border:1px solid var(--line);overflow-wrap:anywhere;background:#f4f7f3;border-bottom:0;margin-top:24px;padding:20px;font-size:12px}.jd4TFW_previewFrame{border:1px solid var(--line);background:#fff;width:100%;height:560px}.jd4TFW_plainText{white-space:pre-wrap;overflow-wrap:anywhere;padding:18px;font-size:12px}.jd4TFW_deliveryDetails{overflow-wrap:anywhere;min-width:220px;max-width:360px;font-size:11px}.jd4TFW_mono{overflow-wrap:anywhere;font-family:ui-monospace,SFMono-Regular,monospace!important}.jd4TFW_importRow{border-top:1px solid var(--line);overflow-wrap:anywhere;justify-content:space-between;align-items:center;gap:20px;padding:18px 0;font-size:12px;display:flex}.jd4TFW_importRow p{color:var(--muted)}.jd4TFW_srOnly{clip:rect(0,0,0,0);white-space:nowrap;width:1px;height:1px;position:absolute;overflow:hidden}.jd4TFW_skipLink{z-index:10;background:#fff;padding:12px;position:fixed;top:0;left:240px;transform:translateY(-150%)}.jd4TFW_skipLink:focus{transform:translateY(0)}@media (width<=1150px){.jd4TFW_page{grid-template-columns:200px minmax(0,1fr)}.jd4TFW_sidebar{padding-inline:12px}.jd4TFW_shell{padding-inline:28px}.jd4TFW_contentGrid{grid-template-columns:minmax(0,1.6fr) minmax(220px,1fr)}.jd4TFW_metric{padding:18px}.jd4TFW_metric>strong{font-size:28px}.jd4TFW_providerLayout{grid-template-columns:210px minmax(0,1fr)}}@media (width<=900px){.jd4TFW_contentGrid{grid-template-columns:1fr}.jd4TFW_metrics{gap:10px}.jd4TFW_metric{padding:14px}.jd4TFW_metricLabel{font-size:11px}.jd4TFW_metricLabel svg{display:none}.jd4TFW_statusGrid,.jd4TFW_providerLayout{grid-template-columns:1fr}.jd4TFW_providerPicker{border-right:0;border-bottom:1px solid var(--line)}.jd4TFW_providerList{max-height:180px}.jd4TFW_notice{flex-direction:column;align-items:flex-start}}@media (width<=680px){.jd4TFW_page{display:block}.jd4TFW_sidebar{height:auto;padding:18px 16px 0;position:static}.jd4TFW_brand{padding:0 0 18px;font-size:19px}.jd4TFW_brandMark{width:30px;height:34px;font-size:20px}.jd4TFW_navLabel{display:none}.jd4TFW_navigation{grid-template-columns:repeat(5,minmax(0,1fr));gap:0;display:grid}.jd4TFW_navigation a{border-radius:5px 5px 0 0;flex-direction:column;flex-shrink:0;justify-content:center;gap:6px;padding:10px 3px;font-size:10px}.jd4TFW_navigation svg{width:15px}.jd4TFW_navigation .jd4TFW_navActive{box-shadow:inset 0 -3px #a9d3b7}.jd4TFW_sidebarFoot{flex-wrap:wrap;align-items:center;gap:15px;padding:8px 0;display:flex}.jd4TFW_backLink{padding:0;font-size:11px}.jd4TFW_identity{display:none}.jd4TFW_signOut{margin-left:auto}.jd4TFW_shell{padding:0 18px}.jd4TFW_topbar{min-height:54px}.jd4TFW_header{padding:24px 0 20px}.jd4TFW_title{font-size:28px}.jd4TFW_headerMark{display:none}.jd4TFW_sectionHeading{flex-wrap:wrap;align-items:flex-start;gap:12px}.jd4TFW_metrics{grid-template-columns:1fr;gap:10px}.jd4TFW_metric{grid-template-columns:1fr auto;align-items:center;gap:8px;padding:16px 18px;display:grid}.jd4TFW_metric>strong{grid-area:1/2/3;margin:0;font-size:24px}.jd4TFW_metric>small{grid-column:1}.jd4TFW_metric small span{display:none}.jd4TFW_card,.jd4TFW_helpCard,.jd4TFW_providerEditor{padding:20px}.jd4TFW_fieldGrid{grid-template-columns:1fr}.jd4TFW_editorHeading{flex-wrap:wrap}.jd4TFW_toolbar>.jd4TFW_input,.jd4TFW_search{width:100%;max-width:none}.jd4TFW_tabs{gap:0}.jd4TFW_tabs button{padding:11px 9px;font-size:11px}.jd4TFW_sectionHint{text-align:left}.jd4TFW_table td,.jd4TFW_table th{padding:12px}.jd4TFW_table{min-width:560px}.jd4TFW_importRow{flex-direction:column;align-items:flex-start}.jd4TFW_skipLink{left:16px}}.jd4TFW_contextGrid{grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;display:grid}.jd4TFW_contextCard{border:1px solid var(--line);background:var(--paper);border-radius:10px;min-width:0;padding:26px;box-shadow:0 2px 3px #182e2610}.jd4TFW_contextCard h3{color:var(--ink);margin:0;font-size:16px;font-weight:600}.jd4TFW_contextCard p:not(.jd4TFW_sectionKicker){color:var(--muted);margin:8px 0 0;font-size:12px;line-height:1.55}.jd4TFW_fieldError{color:#9b3c32;font-size:11px;font-weight:500;line-height:1.5}.jd4TFW_input[aria-invalid=true]{background:#fffaf8;border-color:#bb5f4c}.jd4TFW_toggleField{color:#3f5449;cursor:pointer;align-items:flex-start;gap:11px;display:flex}.jd4TFW_toggleField input{accent-color:#276e53;width:17px;height:17px;margin:1px 0 0}.jd4TFW_toggleField span{flex-direction:column;gap:4px;display:flex}.jd4TFW_toggleField strong{font-size:12px}.jd4TFW_toggleField small{color:var(--muted);font-size:11px;font-weight:400;line-height:1.5}.jd4TFW_contextCardWide{grid-column:1/-1}.jd4TFW_actionGroups{grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:18px;display:grid}.jd4TFW_actionGroups .jd4TFW_checkboxGroup{max-height:none;margin:0}.jd4TFW_actionGroups .jd4TFW_checkLabel{align-items:flex-start}.jd4TFW_modeChoices{border:0;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:20px 0 0;padding:0;display:grid}.jd4TFW_modeChoice{border:1px solid var(--line);cursor:pointer;background:#fafcf9;border-radius:7px;align-items:flex-start;gap:10px;min-width:0;padding:14px;display:flex}.jd4TFW_modeChoice:has(input:checked){background:#eef6ef;border-color:#9fc5ae}.jd4TFW_modeChoice input{accent-color:#276e53;width:16px;height:16px;margin:1px 0 0}.jd4TFW_modeChoice span{flex-direction:column;gap:4px;min-width:0;display:flex}.jd4TFW_modeChoice strong{color:#314d40;font-size:12px}.jd4TFW_modeChoice small{color:var(--muted);font-size:11px;font-weight:400;line-height:1.5}.jd4TFW_accessGroups{gap:16px;margin-top:18px;display:grid}.jd4TFW_actionGroup{border:1px solid var(--line);background:var(--paper);border-radius:10px;min-width:0;margin:0;padding:0;overflow:hidden}.jd4TFW_actionGroup>legend{border-bottom:1px solid var(--line);color:#4b6555;background:#f9fbf8;width:100%;padding:14px 18px;font-size:12px;font-weight:600}.jd4TFW_actionRow{border-bottom:1px solid #edf0ec;justify-content:space-between;align-items:center;gap:18px;min-width:0;padding:15px 18px;display:flex}.jd4TFW_actionGroup .jd4TFW_actionRow:last-child{border-bottom:0}.jd4TFW_actionInfo{flex-direction:column;flex:1;gap:5px;min-width:0;display:flex}.jd4TFW_actionInfo strong{color:#314b3e;font-size:12px;font-weight:600}.jd4TFW_actionInfo small{color:var(--muted);font-size:10px}.jd4TFW_stateChoices{flex-wrap:wrap;flex:none;justify-content:flex-end;gap:6px;display:flex}.jd4TFW_actionControls{flex-wrap:wrap;justify-content:flex-end;align-items:center;gap:8px;display:flex}.jd4TFW_stateChoice{color:#52685d;cursor:pointer;white-space:nowrap;background:#fff;border:1px solid #d8e2dc;border-radius:5px;align-items:center;gap:5px;padding:6px 8px;font-size:10px;font-weight:500;display:inline-flex}.jd4TFW_stateChoice:has(input:checked){color:#286047;background:#eaf5ed;border-color:#8fb8a0}.jd4TFW_stateChoice input{accent-color:#276e53;width:13px;height:13px;margin:0}.jd4TFW_protectedBadge{color:#8b5f2d;white-space:nowrap;background:#fbf1df;border-radius:5px;flex:none;padding:6px 9px;font-size:10px;font-weight:600}.jd4TFW_unavailableBadge{color:#8b4b42;white-space:nowrap;background:#fceee8;border-radius:5px;padding:5px 8px;font-size:10px;font-weight:600}@media (width<=900px){.jd4TFW_contextGrid,.jd4TFW_actionGroups,.jd4TFW_modeChoices{grid-template-columns:1fr}.jd4TFW_actionRow{flex-direction:column;align-items:flex-start}.jd4TFW_stateChoices,.jd4TFW_actionControls{justify-content:flex-start}}@media (width<=680px){.jd4TFW_contextCard{padding:20px}.jd4TFW_navigation{grid-template-columns:repeat(3,minmax(0,1fr))}}";
		const tagId = "dsh-soc-agent-admin/AdminConsole.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-soc-agent-admin";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var AdminConsole_module_css_default = {
			"accessGroups": "jd4TFW_accessGroups",
			"account": "jd4TFW_account",
			"actionControls": "jd4TFW_actionControls",
			"actionGroup": "jd4TFW_actionGroup",
			"actionGroups": "jd4TFW_actionGroups",
			"actionInfo": "jd4TFW_actionInfo",
			"actionRow": "jd4TFW_actionRow",
			"actions": "jd4TFW_actions",
			"activeTab": "jd4TFW_activeTab",
			"addIcon": "jd4TFW_addIcon",
			"adminBadge": "jd4TFW_adminBadge",
			"advanced": "jd4TFW_advanced",
			"advancedBody": "jd4TFW_advancedBody",
			"avatar": "jd4TFW_avatar",
			"backLink": "jd4TFW_backLink",
			"brand": "jd4TFW_brand",
			"brandMark": "jd4TFW_brandMark",
			"button": "jd4TFW_button",
			"card": "jd4TFW_card",
			"checkLabel": "jd4TFW_checkLabel",
			"checkMessage": "jd4TFW_checkMessage",
			"checkboxGroup": "jd4TFW_checkboxGroup",
			"confirmGroup": "jd4TFW_confirmGroup",
			"contentGrid": "jd4TFW_contentGrid",
			"contextCard": "jd4TFW_contextCard",
			"contextCardWide": "jd4TFW_contextCardWide",
			"contextGrid": "jd4TFW_contextGrid",
			"countBadge": "jd4TFW_countBadge",
			"customBadge": "jd4TFW_customBadge",
			"customOption": "jd4TFW_customOption",
			"customOptionSelected": "jd4TFW_customOptionSelected",
			"customTag": "jd4TFW_customTag",
			"dangerButton": "jd4TFW_dangerButton",
			"deliveryDetails": "jd4TFW_deliveryDetails",
			"discovered": "jd4TFW_discovered",
			"discoveryRow": "jd4TFW_discoveryRow",
			"editorCopy": "jd4TFW_editorCopy",
			"editorForm": "jd4TFW_editorForm",
			"editorHeading": "jd4TFW_editorHeading",
			"editorTitle": "jd4TFW_editorTitle",
			"empty": "jd4TFW_empty",
			"envManaged": "jd4TFW_envManaged",
			"error": "jd4TFW_error",
			"eyebrow": "jd4TFW_eyebrow",
			"field": "jd4TFW_field",
			"fieldError": "jd4TFW_fieldError",
			"fieldGrid": "jd4TFW_fieldGrid",
			"fieldHint": "jd4TFW_fieldHint",
			"form": "jd4TFW_form",
			"formFields": "jd4TFW_formFields",
			"fullButton": "jd4TFW_fullButton",
			"header": "jd4TFW_header",
			"headerActions": "jd4TFW_headerActions",
			"headerMark": "jd4TFW_headerMark",
			"helpCard": "jd4TFW_helpCard",
			"identity": "jd4TFW_identity",
			"importRow": "jd4TFW_importRow",
			"info": "jd4TFW_info",
			"input": "jd4TFW_input",
			"loading": "jd4TFW_loading",
			"loadingInline": "jd4TFW_loadingInline",
			"loginCopy": "jd4TFW_loginCopy",
			"loginFootnote": "jd4TFW_loginFootnote",
			"loginMark": "jd4TFW_loginMark",
			"loginPage": "jd4TFW_loginPage",
			"loginPanel": "jd4TFW_loginPanel",
			"loginTitle": "jd4TFW_loginTitle",
			"message": "jd4TFW_message",
			"metric": "jd4TFW_metric",
			"metricAttention": "jd4TFW_metricAttention",
			"metricLabel": "jd4TFW_metricLabel",
			"metrics": "jd4TFW_metrics",
			"modeChoice": "jd4TFW_modeChoice",
			"modeChoices": "jd4TFW_modeChoices",
			"modelChip": "jd4TFW_modelChip",
			"modelEntry": "jd4TFW_modelEntry",
			"modelEntryHeading": "jd4TFW_modelEntryHeading",
			"modelRows": "jd4TFW_modelRows",
			"mono": "jd4TFW_mono",
			"navActive": "jd4TFW_navActive",
			"navLabel": "jd4TFW_navLabel",
			"navigation": "jd4TFW_navigation",
			"notice": "jd4TFW_notice",
			"page": "jd4TFW_page",
			"pageFoot": "jd4TFW_pageFoot",
			"pickerHeader": "jd4TFW_pickerHeader",
			"plainText": "jd4TFW_plainText",
			"previewEnvelope": "jd4TFW_previewEnvelope",
			"previewFrame": "jd4TFW_previewFrame",
			"primary": "jd4TFW_primary",
			"protectedBadge": "jd4TFW_protectedBadge",
			"providerDot": "jd4TFW_providerDot",
			"providerDotReady": "jd4TFW_providerDotReady",
			"providerEditor": "jd4TFW_providerEditor",
			"providerLayout": "jd4TFW_providerLayout",
			"providerList": "jd4TFW_providerList",
			"providerOption": "jd4TFW_providerOption",
			"providerOptionSelected": "jd4TFW_providerOptionSelected",
			"providerOptionText": "jd4TFW_providerOptionText",
			"providerPicker": "jd4TFW_providerPicker",
			"quickIcon": "jd4TFW_quickIcon",
			"quickLinks": "jd4TFW_quickLinks",
			"search": "jd4TFW_search",
			"section": "jd4TFW_section",
			"sectionHeading": "jd4TFW_sectionHeading",
			"sectionHint": "jd4TFW_sectionHint",
			"sectionKicker": "jd4TFW_sectionKicker",
			"sectionTitle": "jd4TFW_sectionTitle",
			"shell": "jd4TFW_shell",
			"sidebar": "jd4TFW_sidebar",
			"sidebarFoot": "jd4TFW_sidebarFoot",
			"signOut": "jd4TFW_signOut",
			"skipLink": "jd4TFW_skipLink",
			"srOnly": "jd4TFW_srOnly",
			"stateChoice": "jd4TFW_stateChoice",
			"stateChoices": "jd4TFW_stateChoices",
			"statusBody": "jd4TFW_statusBody",
			"statusCard": "jd4TFW_statusCard",
			"statusConfigured": "jd4TFW_statusConfigured",
			"statusDot": "jd4TFW_statusDot",
			"statusError": "jd4TFW_statusError",
			"statusGrid": "jd4TFW_statusGrid",
			"statusIcon": "jd4TFW_statusIcon",
			"statusInfo": "jd4TFW_statusInfo",
			"statusMuted": "jd4TFW_statusMuted",
			"statusPill": "jd4TFW_statusPill",
			"statusReady": "jd4TFW_statusReady",
			"statusTopline": "jd4TFW_statusTopline",
			"steps": "jd4TFW_steps",
			"subtitle": "jd4TFW_subtitle",
			"success": "jd4TFW_success",
			"table": "jd4TFW_table",
			"tableWrap": "jd4TFW_tableWrap",
			"tabs": "jd4TFW_tabs",
			"textButton": "jd4TFW_textButton",
			"textarea": "jd4TFW_textarea",
			"title": "jd4TFW_title",
			"toggleField": "jd4TFW_toggleField",
			"toolbar": "jd4TFW_toolbar",
			"topbar": "jd4TFW_topbar",
			"unavailableBadge": "jd4TFW_unavailableBadge"
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
		const REASONING_LEVELS = [
			"minimal",
			"low",
			"medium",
			"high",
			"xhigh",
			"max"
		];
		const REASONING_LABELS = {
			minimal: "Minimal",
			low: "Low",
			medium: "Medium",
			high: "High",
			xhigh: "X-high",
			max: "Max"
		};
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
		function reasoningDraft(model) {
			if (model.reasoningEfforts === false) return {
				mode: "disabled",
				levels: []
			};
			if (!Object.prototype.hasOwnProperty.call(model, "reasoningEfforts")) return {
				mode: "all",
				levels: [...REASONING_LEVELS]
			};
			const configured = objectValue(model.reasoningEfforts);
			const levels = REASONING_LEVELS.filter((level) => Object.prototype.hasOwnProperty.call(configured, level));
			return {
				mode: levels.length === REASONING_LEVELS.length ? "all" : "customize",
				levels
			};
		}
		function reasoningEffortsValue(draft) {
			if (draft.mode === "disabled") return false;
			const levels = draft.mode === "all" ? REASONING_LEVELS : draft.levels;
			return {
				off: null,
				...Object.fromEntries(levels.map((level) => [level, level]))
			};
		}
		function withReasoningDraft(model, draft) {
			const next = { ...model };
			next.reasoningEfforts = reasoningEffortsValue(draft);
			return next;
		}
		function newProviderModel(id = "") {
			return {
				id,
				reasoningEfforts: reasoningEffortsValue({
					mode: "all",
					levels: []
				})
			};
		}
		function defaultReasoningModel(model) {
			return Object.prototype.hasOwnProperty.call(model, "reasoningEfforts") ? model : {
				...model,
				reasoningEfforts: reasoningEffortsValue({
					mode: "all",
					levels: []
				})
			};
		}
		/** Per-model capacity fields the model rows expose and discovery fills. */
		const CAPACITY_KEYS = ["contextWindow", "maxTokens"];
		const CAPACITY_LABELS = {
			contextWindow: "context window",
			maxTokens: "max output tokens"
		};
		function persistableModels(models) {
			return models.map((model) => {
				const next = {
					...model,
					id: stringValue(model.id).trim()
				};
				for (const key of CAPACITY_KEYS) {
					const value = next[key];
					if (typeof value === "string") {
						const trimmed = value.trim();
						if (trimmed === "") delete next[key];
						else next[key] = Number(trimmed);
					}
				}
				return next;
			});
		}
		/** The editable text for one capacity field: the number, or empty when unset. */
		function capacityText(model, key) {
			const value = model[key];
			return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? String(value) : "";
		}
		function capacityInvalid(model, key) {
			const value = model[key];
			if (value === void 0 || value === "") return false;
			if (typeof value === "number") return !Number.isSafeInteger(value) || value <= 0;
			return typeof value !== "string" || !/^\d+$/u.test(value.trim());
		}
		function protocolLabel(api) {
			return SUPPORTED_PROTOCOLS.find((protocol) => protocol.value === api)?.label ?? api;
		}
		/**
		* Fold discovered models into the draft rows: a row the endpoint also
		* advertises gains the capacities it was missing, and everything new is
		* appended in endpoint order with all reasoning levels enabled — the
		* discoverable default for an endpoint that says nothing about reasoning.
		* Blank rows are the add form's placeholders, so adoption clears them.
		*/
		function adoptDiscoveredModels(models, discovered) {
			const adopted = models.filter((model) => stringValue(model.id).trim() !== "");
			const indexById = new Map(adopted.map((model, index) => [stringValue(model.id).trim(), index]));
			for (const model of discovered) {
				const existing = indexById.get(model.id);
				if (existing !== void 0) {
					const next = { ...adopted[existing] };
					for (const key of CAPACITY_KEYS) if (next[key] === void 0 || next[key] === "") {
						const value = model[key];
						if (value !== void 0) next[key] = value;
					}
					if (next.name === void 0 && model.name !== void 0) next.name = model.name;
					adopted[existing] = next;
					continue;
				}
				indexById.set(model.id, adopted.length);
				adopted.push({
					...newProviderModel(model.id),
					...model.name === void 0 ? {} : { name: model.name },
					...model.contextWindow === void 0 ? {} : { contextWindow: model.contextWindow },
					...model.maxTokens === void 0 ? {} : { maxTokens: model.maxTokens }
				});
			}
			return adopted;
		}
		function modelValidation(models) {
			if (models.length === 0) return "Add at least one model.";
			const seen = /* @__PURE__ */ new Set();
			for (let index = 0; index < models.length; index += 1) {
				const model = models[index];
				if (model === void 0) return `Model ${index + 1} needs a model ID.`;
				const id = stringValue(model?.id).trim();
				if (!id) return `Model ${index + 1} needs a model ID.`;
				if (seen.has(id)) return `Model ID "${id}" is listed more than once.`;
				seen.add(id);
				for (const key of CAPACITY_KEYS) if (capacityInvalid(model, key)) return `Model ${index + 1}'s ${CAPACITY_LABELS[key]} must be a positive whole number.`;
				const reasoning = reasoningDraft(model);
				if (reasoning.mode === "customize" && reasoning.levels.length === 0) return `Model ${index + 1} needs at least one reasoning level.`;
			}
		}
		function commonReasoningEfforts(models) {
			let common;
			for (const model of models) {
				const reasoning = reasoningDraft(model);
				const supported = new Set(["off"]);
				if (reasoning.mode === "all") for (const level of REASONING_LEVELS) supported.add(level);
				else if (reasoning.mode === "customize") for (const level of reasoning.levels) supported.add(level);
				if (common === void 0) common = supported;
				else common = new Set([...common].filter((value) => supported.has(value)));
			}
			return common ?? /* @__PURE__ */ new Set();
		}
		function defaultReasoningValidation(defaultEffort, models) {
			if (!defaultEffort) return void 0;
			if (!commonReasoningEfforts(models).has(defaultEffort)) return "The default reasoning effort must be supported by every model.";
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
					setAuth(await (await fetch("/admin/auth/me", { credentials: "same-origin" })).json());
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
			const [visited, setVisited] = (0, react.useState)(() => new Set([currentPage()]));
			(0, react.useEffect)(() => {
				const change = () => {
					const next = currentPage();
					setPage(next);
					setVisited((old) => new Set([...old, next]));
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
					setData({
						providers: providers.map((provider) => {
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
						}),
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
		function ModelRows({ models, onChange, disabled }) {
			function patch(index, next) {
				onChange(models.map((model, modelIndex) => modelIndex === index ? next : model));
			}
			function addModel() {
				onChange([...models, newProviderModel()]);
			}
			function removeModel(index) {
				onChange(models.filter((_, modelIndex) => modelIndex !== index));
			}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: AdminConsole_module_css_default.modelRows,
				children: [models.map((model, index) => {
					const reasoning = reasoningDraft(model);
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: AdminConsole_module_css_default.modelEntry,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: AdminConsole_module_css_default.modelEntryHeading,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("strong", { children: ["Model ", index + 1] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: AdminConsole_module_css_default.textButton,
									type: "button",
									onClick: () => removeModel(index),
									disabled,
									"aria-label": `Remove model ${index + 1}`,
									children: "Remove"
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: AdminConsole_module_css_default.field,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "Model ID" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									className: AdminConsole_module_css_default.input,
									value: stringValue(model.id),
									onChange: (event) => {
										patch(index, {
											...model,
											id: event.target.value
										});
									},
									placeholder: "model-name",
									"aria-label": `Model ID ${index + 1}`,
									disabled
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: AdminConsole_module_css_default.fieldGrid,
								children: CAPACITY_KEYS.map((key) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: AdminConsole_module_css_default.field,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
										key === "contextWindow" ? "Context window" : "Max output tokens",
										" ",
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("em", { children: "optional" })
									] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										className: AdminConsole_module_css_default.input,
										value: capacityText(model, key),
										onChange: (event) => {
											const raw = event.target.value;
											patch(index, {
												...model,
												[key]: raw.trim() === "" ? "" : raw
											});
										},
										inputMode: "numeric",
										placeholder: "auto",
										"aria-label": `Model ${index + 1} ${CAPACITY_LABELS[key]}`,
										disabled
									})]
								}, key))
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: AdminConsole_module_css_default.field,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "Reasoning capability" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
									className: AdminConsole_module_css_default.input,
									value: reasoning.mode,
									onChange: (event) => {
										const mode = event.target.value;
										patch(index, withReasoningDraft(model, {
											mode,
											levels: mode === "customize" && reasoning.mode === "customize" ? reasoning.levels : []
										}));
									},
									"aria-label": `Reasoning capability ${index + 1}`,
									disabled,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: "all",
											children: "Select all"
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: "disabled",
											children: "Disable"
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: "customize",
											children: "Customize"
										})
									]
								})]
							}),
							reasoning.mode === "customize" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("fieldset", {
								className: AdminConsole_module_css_default.checkboxGroup,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("legend", { children: "Supported reasoning efforts" }), REASONING_LEVELS.map((level) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: AdminConsole_module_css_default.checkLabel,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										checked: reasoning.levels.includes(level),
										onChange: (event) => {
											patch(index, withReasoningDraft(model, {
												mode: "customize",
												levels: event.target.checked ? [...reasoning.levels, level] : reasoning.levels.filter((item) => item !== level)
											}));
										},
										"aria-label": `${REASONING_LABELS[level]} ${index + 1}`,
										disabled
									}), REASONING_LABELS[level]]
								}, level))]
							}) : null,
							reasoning.mode === "customize" && reasoning.levels.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
								className: AdminConsole_module_css_default.fieldError,
								children: "Choose at least one supported reasoning level."
							}) : null
						]
					}, index);
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					className: AdminConsole_module_css_default.button,
					type: "button",
					onClick: addModel,
					disabled,
					children: "Add model"
				})]
			});
		}
		function DefaultReasoningField({ models, value, onChange, disabled }) {
			const common = commonReasoningEfforts(models);
			const options = REASONING_LEVELS.filter((level) => common.has(level));
			const hasStoredValue = value === "off" || REASONING_LEVELS.includes(value);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: AdminConsole_module_css_default.field,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["Default reasoning effort ", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("em", { children: "optional" })] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
						className: AdminConsole_module_css_default.input,
						value,
						onChange: (event) => {
							onChange(event.target.value);
						},
						"aria-label": "Default reasoning effort",
						disabled,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: "",
								children: "Provider default"
							}),
							common.has("off") || value === "off" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: "off",
								children: "Off"
							}) : null,
							options.map((level) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: level,
								children: REASONING_LABELS[level]
							}, level)),
							value && !hasStoredValue ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value,
								children: value
							}) : null,
							value && hasStoredValue && value !== "off" && !common.has(value) ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("option", {
								value,
								children: [REASONING_LABELS[value], " (not supported by every model)"]
							}) : null
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
						className: AdminConsole_module_css_default.fieldHint,
						children: "Only an effort supported by every model can be used as the provider default."
					})
				]
			});
		}
		function ProviderEditor({ connection, row, onChanged }) {
			const { provider, namespace, profile } = row;
			const initialModels = modelEntries(profile);
			const isCustomProvider = provider.declared === true;
			const [displayName, setDisplayName] = (0, react.useState)(stringValue(profile.displayName));
			const [baseURL, setBaseURL] = (0, react.useState)(stringValue(profile.baseURL));
			const [api, setApi] = (0, react.useState)(stringValue(profile.api));
			const [models, setModels] = (0, react.useState)(() => isCustomProvider ? initialModels.map(defaultReasoningModel) : initialModels);
			const [defaultEffort, setDefaultEffort] = (0, react.useState)(stringValue(profile.reasoning));
			const [secret, setSecret] = (0, react.useState)("");
			const { message, setMessage, busy, run } = useStatus();
			const canEditProtocol = provider.settingsNs === "llm-pi-ai" && isCustomProvider;
			const canRemoveProvider = provider.declared === true && Boolean(namespace) && provider.settingsPath.length > 0;
			const modelsError = isCustomProvider ? modelValidation(models) : void 0;
			const defaultError = isCustomProvider ? defaultReasoningValidation(defaultEffort, models) : void 0;
			async function save() {
				if (!namespace || !row.writable || modelsError || defaultError) return;
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
					const nextModels = persistableModels(models);
					if (JSON.stringify(nextModels) !== JSON.stringify(persistableModels(initialModels))) ops.push(nextModels.length ? {
						op: "set",
						path: [...provider.settingsPath, "models"],
						value: nextModels
					} : {
						op: "unset",
						path: [...provider.settingsPath, "models"]
					});
					const originalDefault = stringValue(profile.reasoning).trim();
					if (canEditProtocol && defaultEffort.trim() !== originalDefault) ops.push(defaultEffort.trim() ? {
						op: "set",
						path: [...provider.settingsPath, "reasoning"],
						value: defaultEffort.trim()
					} : {
						op: "unset",
						path: [...provider.settingsPath, "reasoning"]
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
						api: canEditProtocol && api.trim() ? api.trim() : void 0,
						apiKey: secret.trim() || void 0
					}));
					setModels((current) => adoptDiscoveredModels(current, result.models));
					if (canEditProtocol && !api.trim() && result.detectedApi) setApi(result.detectedApi);
					setMessage({
						kind: "success",
						text: result.models.length ? `Adopted ${result.models.length} model${result.models.length === 1 ? "" : "s"}${result.detectedApi ? ` — the endpoint speaks ${protocolLabel(result.detectedApi)}` : ""}. Review the model list and save.` : "The endpoint answered but listed no models."
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
						open: Boolean(baseURL || api || initialModels.length || defaultEffort),
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
										"aria-label": "API protocol",
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
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: AdminConsole_module_css_default.field,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "Models" }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelRows, {
											models,
											onChange: setModels,
											disabled: !row.writable || busy
										}),
										modelsError ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
											className: AdminConsole_module_css_default.fieldError,
											children: modelsError
										}) : null
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(DefaultReasoningField, {
									models,
									value: defaultEffort,
									onChange: setDefaultEffort,
									disabled: !row.writable || busy
								}),
								defaultError ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
									className: AdminConsole_module_css_default.fieldError,
									children: defaultError
								}) : null,
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
										children: "Fetches the endpoint's protocol and model list and adopts them below; the draft URL and key are used when provided."
									})]
								})
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
							disabled: !row.writable || busy || Boolean(modelsError || defaultError),
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
			const [api, setApi] = (0, react.useState)("");
			const [models, setModels] = (0, react.useState)([newProviderModel()]);
			const [defaultEffort, setDefaultEffort] = (0, react.useState)("");
			const [secret, setSecret] = (0, react.useState)("");
			const [savedRoute, setSavedRoute] = (0, react.useState)("");
			const [advancedOpen, setAdvancedOpen] = (0, react.useState)(false);
			const { message, setMessage, busy, run } = useStatus();
			const normalizedRoute = route.trim().toLowerCase();
			const routeTaken = providers.some((row) => row.provider.provider === normalizedRoute);
			const routeValid = PROVIDER_ROUTE_PATTERN.test(normalizedRoute);
			const modelsError = modelValidation(models);
			const defaultError = defaultReasoningValidation(defaultEffort, models);
			const protocolError = api.trim() ? void 0 : "Run Auto-detect, or choose the API protocol under it.";
			const canSave = Boolean(namespace && writable && routeValid && !routeTaken && baseURL.trim() && api.trim() && !modelsError && !defaultError);
			const credentialRef = `${normalizedRoute.replace(/[^a-z0-9]+/gi, "_").toUpperCase()}_API_KEY`;
			async function discover() {
				if (!namespace || !baseURL.trim()) return;
				return run(async () => {
					const result = apiValue(await connection.api.llm.discoverModels({
						settingsNs: namespace.ns,
						baseURL: baseURL.trim(),
						api: api.trim() || void 0,
						apiKey: secret.trim() || void 0
					}));
					setModels((current) => adoptDiscoveredModels(current, result.models));
					if (!api.trim() && result.detectedApi) setApi(result.detectedApi);
					setAdvancedOpen(true);
					setMessage({
						kind: "success",
						text: result.models.length ? `Detected ${result.detectedApi ? protocolLabel(result.detectedApi) : "the endpoint"} — ${result.models.length} model${result.models.length === 1 ? "" : "s"} loaded. Review the list below and save.` : `The endpoint answered${result.detectedApi ? ` as ${protocolLabel(result.detectedApi)}` : ""} but listed no models. Enter them by hand.`
					});
				});
			}
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
									models: persistableModels(models),
									...defaultEffort ? { reasoning: defaultEffort } : {}
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
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
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
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: AdminConsole_module_css_default.field,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "Base URL" }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									className: AdminConsole_module_css_default.input,
									type: "url",
									value: baseURL,
									onChange: (event) => setBaseURL(event.target.value),
									placeholder: "https://api.example.com",
									disabled: busy,
									required: true
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
									className: AdminConsole_module_css_default.fieldHint,
									children: "With or without the /v1 suffix — auto-detect tries both."
								})
							]
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
									children: "Stored securely under a provider-derived credential name. Auto-detect uses it to verify access."
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: AdminConsole_module_css_default.discoveryRow,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: `${AdminConsole_module_css_default.button} ${AdminConsole_module_css_default.primary}`,
								type: "button",
								onClick: () => void discover(),
								disabled: busy || !namespace || !baseURL.trim(),
								children: busy ? "Detecting…" : "Auto-detect provider"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: AdminConsole_module_css_default.fieldHint,
								children: "Probes the endpoint, detects its protocol, and loads its model list with capacities."
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: AdminConsole_module_css_default.field,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "API protocol" }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
									className: AdminConsole_module_css_default.input,
									value: api,
									onChange: (event) => setApi(event.target.value),
									"aria-label": "API protocol",
									disabled: busy,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: "",
										children: "Auto-detect (recommended)"
									}), SUPPORTED_PROTOCOLS.map((protocol) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: protocol.value,
										children: protocol.label
									}, protocol.value))]
								}),
								protocolError ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
									className: AdminConsole_module_css_default.fieldError,
									children: protocolError
								}) : null
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
							className: AdminConsole_module_css_default.advanced,
							open: advancedOpen,
							onToggle: (event) => setAdvancedOpen(event.target.open),
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: "Advanced provider settings" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: AdminConsole_module_css_default.advancedBody,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										className: AdminConsole_module_css_default.field,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["Display name ", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("em", { children: "optional" })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											className: AdminConsole_module_css_default.input,
											value: displayName,
											onChange: (event) => setDisplayName(event.target.value),
											placeholder: "My AI provider",
											disabled: busy
										})]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: AdminConsole_module_css_default.field,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "Models" }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelRows, {
												models,
												onChange: setModels,
												disabled: busy
											}),
											modelsError ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
												className: AdminConsole_module_css_default.fieldError,
												children: modelsError
											}) : null
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(DefaultReasoningField, {
										models,
										value: defaultEffort,
										onChange: setDefaultEffort,
										disabled: busy
									}),
									defaultError ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
										className: AdminConsole_module_css_default.fieldError,
										children: defaultError
									}) : null
								]
							})]
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
		const inject = ["slots", "socClient"];
		function apply(ctx) {
			if (ctx.get("socClient").surface !== "admin") return;
			ctx.slots.inject("soc.admin.content", () => ctx.slots.register({ name: "soc.admin.content" }, AdminConsole));
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