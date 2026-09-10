import test from "#test-utils/test/index";
import checkNetworkConnectivity, {
  buildRegistryPingUrl,
} from "#utils/shared/check-network-connectivity/index";

const registryUrl = "https://registry.npmjs.org";

test.case("buildRegistryPingUrl strips trailing slashes and appends the ping path", async assert => {
  const pingUrl = "https://registry.npmjs.org/-/ping";
  assert(buildRegistryPingUrl("https://registry.npmjs.org")).equals(pingUrl);
  assert(buildRegistryPingUrl("https://registry.npmjs.org/")).equals(pingUrl);
  assert(buildRegistryPingUrl("https://registry.npmjs.org//")).equals(pingUrl);
  assert(buildRegistryPingUrl("http://localhost:4873"))
    .equals("http://localhost:4873/-/ping");
});

test.case("is online when the registry responds, regardless of the status code", async assert => {
  const connectivity = await checkNetworkConnectivity({
    registryUrl,
    fetchImpl: async () => new Response(null, { status: 200 }),
  });

  assert(connectivity.online).true();
});

test.case("is online when the registry responds with a server error", async assert => {
  const connectivity = await checkNetworkConnectivity({
    registryUrl,
    fetchImpl: async () => new Response(null, { status: 404 }),
  });

  assert(connectivity.online).true();
});

test.case("is offline when the request fails", async assert => {
  const connectivity = await checkNetworkConnectivity({
    registryUrl,
    fetchImpl: async () => {
      throw new Error("getaddrinfo ENOTFOUND registry.npmjs.org");
    },
  });

  assert(connectivity.online).false();
  assert(connectivity.error).defined();
});