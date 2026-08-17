"use client";

import { Check, Mail, Plus, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EmailAccount } from "@/app/hooks/useAccounts";
import { cn } from "@/lib/utils";

interface AccountRailProps {
  accounts: EmailAccount[];
  activeAccountId?: string;
  onSelect: (id: string) => void;
  onSettings: () => void;
}

export function AccountRail({ accounts, activeAccountId, onSelect, onSettings }: AccountRailProps) {
  return (
    <section className="border-b border-border bg-card px-3 py-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Accounts</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {accounts.length ? `${accounts.length} connected` : "Add a mailbox to begin"}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onSettings} aria-label="Open account settings">
          <Settings2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="space-y-1.5">
        {accounts.map((account) => {
          const active = account.id === activeAccountId;
          return (
            <button
              key={account.id}
              type="button"
              onClick={() => onSelect(account.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
                active ? "border-primary/30 bg-primary/10" : "border-transparent hover:bg-muted"
              )}
            >
              <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                <Mail className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{account.label}</span>
                <span className="block truncate text-xs text-muted-foreground">{account.email}</span>
              </span>
              {active && <Check className="h-4 w-4 text-primary" />}
            </button>
          );
        })}
        <Button variant="outline" className="mt-2 w-full justify-start" onClick={onSettings}>
          <Plus className="h-4 w-4" />
          Add account
        </Button>
      </div>
    </section>
  );
}
