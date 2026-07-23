import { Octokit } from "@octokit/core";
import { throttling } from "@octokit/plugin-throttling";
import { retry } from "@octokit/plugin-retry";
import type { RequestOptions } from "@octokit/types";

// Fail fast on startup, never on runtime
if (!process.env.GITHUB_TOKEN) {
  throw new Error("Octokit initialization failed: GITHUB_TOKEN is not defined");
}

const MyOctokit = Octokit.plugin(throttling, retry);

type OctokitInstance = InstanceType<typeof MyOctokit>;

export const octokit = new MyOctokit({
  auth: process.env.GITHUB_TOKEN,
  throttle: {
    onRateLimit: (retryAfter: number, options: RequestOptions, octokitInstance: OctokitInstance, retryCount: number) => {
      octokitInstance.log.warn(
        `Request quota exhausted for request ${options.method} ${options.url}`
      );

      if (retryCount < 3) {
        octokitInstance.log.info(`Retrying after ${retryAfter} seconds!`);
        return true;
      }
    },
    onSecondaryRateLimit: (_retryAfter: number, options: RequestOptions, octokitInstance: OctokitInstance) => {
      octokitInstance.log.warn(
        `SecondaryRateLimit detected for request ${options.method} ${options.url}`
      );
    },
  },
  retry: {
    doNotRetry: [422], // Don't retry on 422 status (validation errors)
  },
});