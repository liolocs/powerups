import io from "@rcompat/io";

const DEFAULT_REGISTRY_URL = "https://registry.npmjs.org";
const DEFAULT_CHECK_TIMEOUT_MS = 5_000;
const REGISTRY_COMMAND_TIMEOUT_MS = 5_000;

export type ConnectivityResult = {
  online: boolean;
  error?: string;
};

export type CheckNetworkConnectivity = (options?: {
  timeoutMs?: number;
  registryUrl?: string;
  fetchImpl?: typeof fetch;
}) => Promise<ConnectivityResult>;

export default async function checkNetworkConnectivity({
  timeoutMs = DEFAULT_CHECK_TIMEOUT_MS,
  registryUrl,
  fetchImpl = fetch,
}: {
  timeoutMs?: number;
  registryUrl?: string;
  fetchImpl?: typeof fetch;
} = {}): Promise<ConnectivityResult> {
  const registry = registryUrl ?? await getConfiguredRegistryUrl();
  const pingUrl = buildRegistryPingUrl(registry);

  try {
    await fetchImpl(pingUrl, { signal: AbortSignal.timeout(timeoutMs) });
    return { online: true };
  } catch (error) {
    return { online: false, error: String(error) };
  }
}

export function buildRegistryPingUrl(registryUrl: string): string {
  return `${registryUrl.replace(/\/+$/, "")}/-/ping`;
}

async function getConfiguredRegistryUrl(): Promise<string> {
  try {
    const output = await io.run("npm config get registry", {
      timeout: REGISTRY_COMMAND_TIMEOUT_MS,
    });
    const configuredRegistry = output.trim();

    if (configuredRegistry.length === 0) {
      return DEFAULT_REGISTRY_URL;
    }

    return configuredRegistry;
  } catch {
    return DEFAULT_REGISTRY_URL;
  }
}