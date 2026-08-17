"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  Settings2,
  ShieldCheck,
  Trash2,
  Wifi,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  MODEL_PROVIDERS,
  type ModelChoice,
  type StandaloneConfig,
} from "@/lib/config";
import type { EmailAccount } from "@/app/hooks/useAccounts";
import { useServerSettings } from "@/app/hooks/useServerSettings";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (config: StandaloneConfig) => void;
  initialConfig?: StandaloneConfig;
  accounts?: EmailAccount[];
  onAddAccount?: (account: {
    label: string;
    email: string;
    username: string;
    password: string;
  }) => Promise<unknown>;
  onUpdateAccount?: (
    id: string,
    account: Partial<{
      label: string;
      email: string;
      username: string;
      password: string;
    }>
  ) => Promise<void>;
  onDeleteAccount?: (id: string) => Promise<void>;
  onTestAccount?: (id: string) => Promise<void>;
  onTestSplunk?: (splunk?: {
    url: string;
    username: string;
    password?: string;
  }) => Promise<unknown>;
}

export function ConfigDialog({
  open,
  onOpenChange,
  onSave,
  initialConfig,
  accounts = [],
  onAddAccount,
  onUpdateAccount,
  onDeleteAccount,
  onTestAccount,
  onTestSplunk,
}: ConfigDialogProps) {
  const [deploymentUrl, setDeploymentUrl] = useState(
    initialConfig?.deploymentUrl || "http://127.0.0.1:2024"
  );
  const [assistantId, setAssistantId] = useState(
    initialConfig?.assistantId || "incident_agent"
  );
  const [mcpServerUrl, setMcpServerUrl] = useState(
    initialConfig?.mcpServerUrl || "http://127.0.0.1:8050"
  );
  const [accountApiKey, setAccountApiKey] = useState(
    initialConfig?.accountApiKey || ""
  );
  const [langsmithApiKey, setLangsmithApiKey] = useState(
    initialConfig?.langsmithApiKey || ""
  );
  const [splunkUrl, setSplunkUrl] = useState("http://127.0.0.1:8089");
  const [splunkUsername, setSplunkUsername] = useState("");
  const [splunkPassword, setSplunkPassword] = useState("");
  const [hasSplunkPassword, setHasSplunkPassword] = useState(false);
  const [modelProvider, setModelProvider] = useState<ModelChoice>(
    initialConfig?.defaultModelChoice || "deepseek"
  );
  const [modelApiKey, setModelApiKey] = useState("");
  const [hasModelApiKey, setHasModelApiKey] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [testedId, setTestedId] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [splunkTestState, setSplunkTestState] = useState<
    "idle" | "testing" | "success"
  >("idle");
  const [splunkError, setSplunkError] = useState<string | null>(null);
  const {
    load: loadServerSettings,
    save: saveServerSettings,
  } = useServerSettings({
    serverUrl: mcpServerUrl,
    apiKey: accountApiKey,
  });

  useEffect(() => {
    if (!open) return;
    setDeploymentUrl(initialConfig?.deploymentUrl || "http://127.0.0.1:2024");
    setAssistantId(initialConfig?.assistantId || "incident_agent");
    setMcpServerUrl(initialConfig?.mcpServerUrl || "http://127.0.0.1:8050");
    setAccountApiKey(initialConfig?.accountApiKey || "");
    setLangsmithApiKey(initialConfig?.langsmithApiKey || "");
    setModelProvider(initialConfig?.defaultModelChoice || "deepseek");
    setModelApiKey("");
    setSplunkPassword("");
    setSettingsError(null);
    setSplunkTestState("idle");
    setSplunkError(null);
  }, [open, initialConfig]);

  useEffect(() => {
    if (!open || !mcpServerUrl) return;
    setSettingsLoading(true);
    void loadServerSettings()
      .then((stored) => {
        setSplunkUrl(stored.splunk.url || "http://127.0.0.1:8089");
        setSplunkUsername(stored.splunk.username || "");
        setHasSplunkPassword(stored.splunk.has_password);
        const provider = stored.model.default_provider;
        if (provider === "deepseek" || provider === "local") {
          setModelProvider(provider);
        }
        setHasModelApiKey(
          Boolean(
            stored.model.providers.find((item) => item.id === provider)
              ?.configured
          )
        );
        setSettingsError(null);
      })
      .catch((reason) => {
        setSettingsError(
          reason instanceof Error
            ? reason.message
            : "Could not load server settings."
        );
      })
      .finally(() => setSettingsLoading(false));
  }, [loadServerSettings, mcpServerUrl, open]);

  useEffect(() => {
    setSplunkTestState("idle");
    setSplunkError(null);
  }, [mcpServerUrl, accountApiKey]);

  const clearAccountForm = () => {
    setLabel("");
    setEmail("");
    setUsername("");
    setPassword("");
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!deploymentUrl || !assistantId || !mcpServerUrl) {
      setAccountError(
        "Deployment, assistant, and MCP server URLs are required."
      );
      return;
    }
    try {
      const parsedSplunkUrl = new URL(splunkUrl);
      if (
        !["http:", "https:"].includes(parsedSplunkUrl.protocol) ||
        !parsedSplunkUrl.hostname ||
        !splunkUsername ||
        (!splunkPassword && !hasSplunkPassword)
      ) {
        throw new Error("Splunk URL, username, and password are required.");
      }
      if (MODEL_PROVIDERS[modelProvider].requiresApiKey && !modelApiKey && !hasModelApiKey) {
        throw new Error(`${MODEL_PROVIDERS[modelProvider].label} API key is required.`);
      }
      setSettingsSaving(true);
      setSettingsError(null);
      await saveServerSettings({
        splunk: {
          url: splunkUrl,
          username: splunkUsername,
          ...(splunkPassword ? { password: splunkPassword } : {}),
        },
        model: {
          provider: modelProvider,
          ...(modelApiKey ? { api_key: modelApiKey } : {}),
        },
      });
      onSave({
        deploymentUrl,
        assistantId,
        mcpServerUrl,
        accountApiKey: accountApiKey || undefined,
        langsmithApiKey: langsmithApiKey || undefined,
        defaultModelChoice: modelProvider,
      });
      onOpenChange(false);
    } catch (reason) {
      setSettingsError(
        reason instanceof Error ? reason.message : "Could not save settings."
      );
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleAccountSubmit = async () => {
    if (!email || (!editingId && !password)) {
      setAccountError("Email and password are required for a new account.");
      return;
    }
    setAccountError(null);
    try {
      if (editingId && onUpdateAccount) {
        await onUpdateAccount(editingId, {
          label,
          email,
          username,
          ...(password ? { password } : {}),
        });
      } else if (onAddAccount) {
        await onAddAccount({ label, email, username, password });
      }
      clearAccountForm();
    } catch (reason) {
      setAccountError(
        reason instanceof Error ? reason.message : "Could not save account."
      );
    } finally {
      setPassword("");
    }
  };

  const handleTest = async (id: string) => {
    if (!onTestAccount) return;
    setBusyId(id);
    setAccountError(null);
    try {
      await onTestAccount(id);
      setTestedId(id);
      const account = accounts.find((item) => item.id === id);
      toast.success("Connection test succeeded", {
        description: account
          ? `${account.label} is ready to use.`
          : "The email account is ready to use.",
      });
    } catch (reason) {
      setTestedId(null);
      setAccountError(
        reason instanceof Error ? reason.message : "Connection test failed."
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleTestSplunk = async () => {
    if (!onTestSplunk) return;
    setSplunkTestState("testing");
    setSplunkError(null);
    try {
      const result = await onTestSplunk({
        url: splunkUrl,
        username: splunkUsername,
        ...(splunkPassword ? { password: splunkPassword } : {}),
      });
      setSplunkTestState("success");
      toast.success("Splunk connection succeeded", {
        description: `${
          result && typeof result === "object" && "index_count" in result
            ? String(result.index_count)
            : "Read-only"
        } index access is available.`,
      });
    } catch (reason) {
      setSplunkTestState("idle");
      setSplunkError(
        reason instanceof Error
          ? reason.message
          : "Splunk connection test failed."
      );
    }
  };

  const handleDelete = async (id: string) => {
    if (!onDeleteAccount) return;
    setBusyId(id);
    try {
      await onDeleteAccount(id);
      if (testedId === id) setTestedId(null);
      if (editingId === id) clearAccountForm();
    } catch (reason) {
      setAccountError(
        reason instanceof Error ? reason.message : "Could not delete account."
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" /> Workspace settings
          </DialogTitle>
          <DialogDescription>
            Splunk credentials and model API keys are encrypted and saved by
            the MCP server. They are never sent to the agent as prompt data.
          </DialogDescription>
        </DialogHeader>

        <section className="grid gap-4 border-b border-border pb-5 pt-2 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="deploymentUrl">Agent deployment URL</Label>
            <Input
              id="deploymentUrl"
              value={deploymentUrl}
              onChange={(e) => setDeploymentUrl(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="assistantId">Assistant ID</Label>
            <Input
              id="assistantId"
              value={assistantId}
              onChange={(e) => setAssistantId(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mcpServerUrl">MCP server URL</Label>
            <Input
              id="mcpServerUrl"
              value={mcpServerUrl}
              onChange={(e) => setMcpServerUrl(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="accountApiKey">
              Account API key{" "}
              <span className="text-muted-foreground">(remote only)</span>
            </Label>
            <Input
              id="accountApiKey"
              type="password"
              value={accountApiKey}
              onChange={(e) => setAccountApiKey(e.target.value)}
            />
          </div>
          <div className="grid gap-2 md:col-span-2">
            <Label htmlFor="langsmithApiKey">
              LangSmith API key{" "}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="langsmithApiKey"
              type="password"
              value={langsmithApiKey}
              onChange={(e) => setLangsmithApiKey(e.target.value)}
            />
          </div>
          <div className="grid gap-2 md:col-span-2">
            <Label htmlFor="modelProvider">Model provider</Label>
            <Select
              value={modelProvider}
              onValueChange={(value) => {
                if (value === "deepseek" || value === "local") {
                  setModelProvider(value);
                }
              }}
              disabled={settingsLoading || settingsSaving}
            >
              <SelectTrigger id="modelProvider">
                <SelectValue placeholder="Choose a model provider" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(MODEL_PROVIDERS).map(([value, provider]) => (
                  <SelectItem
                    key={value}
                    value={value}
                  >
                    {provider.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {MODEL_PROVIDERS[modelProvider].requiresApiKey ? (
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="modelApiKey">
                {MODEL_PROVIDERS[modelProvider].label} API key
              </Label>
              <Input
                id="modelApiKey"
                type="password"
                placeholder={
                  hasModelApiKey ? "Already configured; leave blank to keep" : "Enter API key"
                }
                value={modelApiKey}
                onChange={(e) => setModelApiKey(e.target.value)}
              />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground md:col-span-2">
              The local model URL, model name, and local key remain configured on the server.
            </p>
          )}
          <div className="grid gap-2">
            <Label htmlFor="splunkUrl">Splunk URL</Label>
            <Input
              id="splunkUrl"
              placeholder="http://127.0.0.1:8089"
              value={splunkUrl}
              onChange={(e) => setSplunkUrl(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="splunkUsername">Splunk username</Label>
            <Input
              id="splunkUsername"
              autoComplete="username"
              value={splunkUsername}
              onChange={(e) => setSplunkUsername(e.target.value)}
            />
          </div>
          <div className="grid gap-2 md:col-span-2">
            <Label htmlFor="splunkPassword">Splunk password</Label>
            <Input
              id="splunkPassword"
              type="password"
              autoComplete="current-password"
              placeholder={
                hasSplunkPassword ? "Already configured; leave blank to keep" : "Enter password"
              }
              value={splunkPassword}
              onChange={(e) => setSplunkPassword(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3 md:col-span-2">
            <div>
              <p className="text-sm font-medium">Splunk connection</p>
              <p className="text-xs text-muted-foreground">
                Checks authentication and read-only index access on the MCP
                server.
              </p>
              {splunkError && (
                <p className="mt-1 text-xs text-destructive">{splunkError}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {splunkTestState === "success" && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-500">
                  <CheckCircle2 className="h-4 w-4" /> Connected
                </span>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleTestSplunk()}
                disabled={!onTestSplunk || splunkTestState === "testing"}
              >
                {splunkTestState === "testing" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wifi className="h-4 w-4" />
                )}
                {splunkTestState === "testing"
                  ? "Testing..."
                  : "Test Splunk connection"}
              </Button>
            </div>
          </div>
          {settingsError && (
            <p className="text-sm text-destructive md:col-span-2">{settingsError}</p>
          )}
        </section>

        <section className="grid gap-4">
          <div>
            <p className="font-semibold">Email accounts</p>
            <p className="text-sm text-muted-foreground">
              Add accounts here; only safe account labels and IDs are available
              to the agent.
            </p>
          </div>
          <div className="grid gap-3 rounded-xl border border-border bg-muted/30 p-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="accountLabel">Account label</Label>
              <Input
                id="accountLabel"
                placeholder="Work mailbox"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="accountEmail">Email</Label>
              <Input
                id="accountEmail"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="accountUsername">
                Login username{" "}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="accountUsername"
                autoComplete="off"
                placeholder="Usually leave blank"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Use only if Zimbra requires a username different from the email.
                Do not enter a display name.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="accountPassword">Password</Label>
              <Input
                id="accountPassword"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="flex gap-2 md:col-span-2">
              <Button onClick={handleAccountSubmit}>
                {editingId ? "Update account" : "Add account"}
              </Button>
              {editingId && (
                <Button
                  variant="ghost"
                  onClick={clearAccountForm}
                >
                  Cancel edit
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {accounts.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                No accounts connected yet.
              </p>
            ) : (
              accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center gap-3 rounded-lg border border-border px-3 py-3"
                >
                  <div className="bg-primary/10 flex h-8 w-8 items-center justify-center rounded-full text-primary">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {account.label}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {account.email}
                    </p>
                  </div>
                  {testedId === account.id && (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-500">
                      <CheckCircle2 className="h-4 w-4" /> Connected
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busyId === account.id}
                    onClick={() => void handleTest(account.id)}
                  >
                    <Wifi className="h-4 w-4" /> Test
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingId(account.id);
                      setTestedId(null);
                      setLabel(account.label);
                      setEmail(account.email);
                      setUsername(account.username);
                      setPassword("");
                    }}
                    aria-label={`Edit ${account.label}`}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={busyId === account.id}
                    onClick={() => void handleDelete(account.id)}
                    aria-label={`Delete ${account.label}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))
            )}
          </div>
          {accountError && (
            <p className="text-sm text-destructive">{accountError}</p>
          )}
        </section>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          <Button
            onClick={() => void handleSave()}
            disabled={settingsSaving}
          >
            {settingsSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
