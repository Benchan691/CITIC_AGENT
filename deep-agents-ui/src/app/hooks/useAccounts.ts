"use client";

import { useCallback, useEffect, useState } from "react";

export interface EmailAccount {
  id: string;
  label: string;
  email: string;
  username: string;
}

interface AccountOptions {
  serverUrl: string;
  apiKey?: string;
}

function headers(apiKey?: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    ...(apiKey ? { "X-Account-Api-Key": apiKey } : {}),
  };
}

function baseUrl(serverUrl: string): string {
  return serverUrl.replace(/\/mcp\/?$/, "").replace(/\/$/, "");
}

export function useAccounts({ serverUrl, apiKey }: AccountOptions) {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!serverUrl) return;
    setLoading(true);
    try {
      const response = await fetch(`${baseUrl(serverUrl)}/api/accounts`, {
        headers: headers(apiKey),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error?.message || "Could not load accounts.");
      setAccounts(body.accounts || []);
      setError(null);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not load accounts."
      );
    } finally {
      setLoading(false);
    }
  }, [serverUrl, apiKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addAccount = useCallback(
    async (account: {
      label: string;
      email: string;
      username: string;
      password: string;
    }) => {
      const response = await fetch(`${baseUrl(serverUrl)}/api/accounts`, {
        method: "POST",
        headers: headers(apiKey),
        body: JSON.stringify(account),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error?.message || "Could not add account.");
      await refresh();
      return body.account as EmailAccount;
    },
    [serverUrl, apiKey, refresh]
  );

  const updateAccount = useCallback(
    async (
      id: string,
      account: Partial<{
        label: string;
        email: string;
        username: string;
        password: string;
      }>
    ) => {
      const response = await fetch(
        `${baseUrl(serverUrl)}/api/accounts/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: headers(apiKey),
          body: JSON.stringify(account),
        }
      );
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error?.message || "Could not update account.");
      await refresh();
    },
    [serverUrl, apiKey, refresh]
  );

  const deleteAccount = useCallback(
    async (id: string) => {
      const response = await fetch(
        `${baseUrl(serverUrl)}/api/accounts/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          headers: headers(apiKey),
        }
      );
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error?.message || "Could not delete account.");
      await refresh();
    },
    [serverUrl, apiKey, refresh]
  );

  const testAccount = useCallback(
    async (id: string) => {
      const response = await fetch(
        `${baseUrl(serverUrl)}/api/accounts/${encodeURIComponent(id)}/test`,
        {
          method: "POST",
          headers: headers(apiKey),
        }
      );
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error?.message || "Connection test failed.");
    },
    [serverUrl, apiKey]
  );

  const testSplunk = useCallback(async (splunk?: {
    url: string;
    username: string;
    password?: string;
  }) => {
    const response = await fetch(`${baseUrl(serverUrl)}/api/splunk/test`, {
      method: "POST",
      headers: headers(apiKey),
      body: splunk ? JSON.stringify({ splunk }) : undefined,
    });
    const body = await response.json();
    if (!response.ok)
      throw new Error(body.error?.message || "Splunk connection test failed.");
    return body;
  }, [serverUrl, apiKey]);

  return {
    accounts,
    loading,
    error,
    refresh,
    addAccount,
    updateAccount,
    deleteAccount,
    testAccount,
    testSplunk,
  };
}
