"use client";

import { useCallback } from "react";

export interface ServerSettings {
  splunk: {
    url: string;
    username: string;
    configured: boolean;
    has_password: boolean;
  };
  model: {
    default_provider: string;
    providers: Array<{
      id: string;
      label: string;
      requires_api_key: boolean;
      configured: boolean;
    }>;
  };
}

export interface ServerSettingsPayload {
  splunk: {
    url: string;
    username: string;
    password?: string | null;
  };
  model: {
    provider: string;
    api_key?: string | null;
  };
}

function baseUrl(serverUrl: string): string {
  return serverUrl.replace(/\/mcp\/?$/, "").replace(/\/$/, "");
}

function headers(apiKey?: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    ...(apiKey ? { "X-Account-Api-Key": apiKey } : {}),
  };
}

async function parseResponse(response: Response): Promise<ServerSettings> {
  let body: Partial<ServerSettings> & {
    error?: { message?: string };
  };
  try {
    body = await response.json();
  } catch {
    throw new Error("The MCP server returned an invalid settings response.");
  }
  if (!response.ok) {
    throw new Error(body.error?.message || "Could not save server settings.");
  }
  return body as ServerSettings;
}

async function requestSettings(
  url: string,
  init?: RequestInit
): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (reason) {
    if (reason instanceof TypeError) {
      throw new Error(
        `Could not reach the MCP server at ${url}. Check that it is running and that its allowed origins include this UI.`,
        { cause: reason }
      );
    }
    throw reason;
  }
}

export function useServerSettings({
  serverUrl,
  apiKey,
}: {
  serverUrl: string;
  apiKey?: string;
}) {
  const load = useCallback(async (): Promise<ServerSettings> => {
    const response = await requestSettings(`${baseUrl(serverUrl)}/api/settings`, {
      headers: headers(apiKey),
    });
    return parseResponse(response);
  }, [apiKey, serverUrl]);

  const save = useCallback(
    async (payload: ServerSettingsPayload): Promise<ServerSettings> => {
      const response = await requestSettings(`${baseUrl(serverUrl)}/api/settings`, {
        method: "PUT",
        headers: headers(apiKey),
        body: JSON.stringify(payload),
      });
      return parseResponse(response);
    },
    [apiKey, serverUrl]
  );

  return { load, save };
}
