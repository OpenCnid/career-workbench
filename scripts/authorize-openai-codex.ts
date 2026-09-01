import { createServer } from "node:http";
import { Context } from "@deepseek-ai/cordis";
import Authorization from "@deepseek-ai/dsh-authorization";
import CredentialsLocal from "@deepseek-ai/dsh-credentials-local";
import LlmRuntime from "@deepseek-ai/dsh-llm";
import * as LlmPiAi from "@deepseek-ai/dsh-llm-pi-ai";
import { recordKeyFor } from "@deepseek-ai/dsh-llm-pi-ai";

const PROVIDER = "openai-codex";

let pendingUrl: string | undefined;
const redirect = createServer((request, response) => {
  response.setHeader("cache-control", "no-store");
  response.setHeader("referrer-policy", "no-referrer");
  if (request.url !== "/oauth-start" || pendingUrl === undefined) {
    response.statusCode = 503;
    response.end("The DSH authorization page is not ready.");
    return;
  }
  response.statusCode = 302;
  response.setHeader("location", pendingUrl);
  response.end();
});
await new Promise<void>((resolve, reject) => {
  redirect.once("error", reject);
  redirect.listen(1466, "127.0.0.1", resolve);
});

const ctx = new Context();
await ctx.plugin(LlmRuntime);
await ctx.plugin(CredentialsLocal, { watch: false });
await ctx.plugin(Authorization);
await ctx.plugin(LlmPiAi, { providers: { [PROVIDER]: {} } });

try {
  const key = recordKeyFor(PROVIDER);
  if ((await ctx.credentials.describeRecord(key)).configured) {
    process.stdout.write("DSH OpenAI Codex OAuth is already configured.\n");
    process.exitCode = 0;
  } else {
    const result = await ctx.authorization.begin({
      key,
      method: "oauth",
      interaction: {
        notify(notice) {
          if (notice.url !== undefined) {
            pendingUrl = notice.url;
            process.stdout.write(
              "Open http://127.0.0.1:1466/oauth-start in a browser.\n",
            );
          }
          process.stdout.write(`${notice.message}\n`);
        },
        async prompt(prompt) {
          if (prompt.kind === "select") return "browser";
          return await new Promise<string>((_resolve, reject) => {
            const abort = (): void => {
              reject(new Error("Browser callback received."));
            };
            if (prompt.signal?.aborted === true) abort();
            else
              prompt.signal?.addEventListener("abort", abort, { once: true });
          });
        },
      },
    });
    if (result.status !== "authorized") {
      throw new Error(`Authorization ended with status ${result.status}.`);
    }
    process.stdout.write("DSH OpenAI Codex OAuth authorization succeeded.\n");
  }
} finally {
  await ctx.fiber.dispose();
  await new Promise<void>((resolve, reject) => {
    redirect.close((error) => {
      if (error === undefined) resolve();
      else reject(error);
    });
  });
}
