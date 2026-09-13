import { settingsNamespace } from "@deepseek-ai/dsh-settings";
import z from "@deepseek-ai/schemastery";
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
//#region src/attachment-settings.ts
const MarkItDownAttachmentSettingsSchema = z.object({
	maxFiles: z.number().step(1).min(1).max(20).default(5),
	maxBytesPerFile: z.number().step(1).min(1).max(1e8).default(1e7),
	maxTotalBytes: z.number().step(1).min(1).max(5e8).default(5e7),
	maxCharsPerFile: z.number().step(1).min(1).max(2e6).default(2e5),
	maxTotalChars: z.number().step(1).min(1).max(5e6).default(5e5)
});
//#endregion
//#region src/index.ts
/** Registers the durable attachment settings owned by this optional feature. */
function apply(ctx) {
	ctx.inject(["settings"], (settingsCtx) => {
		settingsCtx.settings.register(settingsNamespace(MARKITDOWN_ATTACHMENTS_NAMESPACE), MarkItDownAttachmentSettingsSchema);
	});
}
//#endregion
export { DEFAULT_MARKITDOWN_ATTACHMENT_SETTINGS, MARKITDOWN_ATTACHMENTS_NAMESPACE, apply };
