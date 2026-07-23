import { Octokit } from "@octokit/core";

const token = process.env.GITHUB_TOKEN;

export const demoOctokit = token
  ? new Octokit({ auth: token })
  : new Octokit();
