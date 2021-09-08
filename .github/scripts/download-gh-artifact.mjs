#!/usr/bin/env zx
$.verbose = false
const { Octokit } = require("@octokit/core");

const usage="Usage: download-gh-artifact --owner org1 --repo ios-app --token $GITHUB_TOKEN --branch main --workflow ci --artifact name [ --destination ./artifact/ ]"

console.log(chalk.blue("God morgon"))
console.log(chalk.yellow("Usage:", usage))

const owner=argv.owner
const repo=argv.repo
const ghToken=argv.token
const branch=argv.branch
const workflowName=argv.workflow
const artifactName=argv.artifact
const destination=argv.destination ?? 'artifact'

const octokit = new Octokit({ auth: ghToken });

// fetch last workflow runs on base branch
const workflowId = await lastRun(octokit, owner, repo, branch)
const artifactId = await fetchArtifact(octokit, owner, repo, workflowId, artifactName)
await downloadArtifact(octokit, owner, repo, artifactId, destination)

console.log(chalk.green("Artifact downloaded to", destination))

// Helper

async function lastRun(octokit, owner, repo, branch) {
  const { data } = await octokit.request('GET /repos/{owner}/{repo}/actions/runs', {
    owner: owner,
    repo: repo,
    branch: branch,
    status: 'completed',
  });

  const lastRun = data.workflow_runs
    .filter(item => item.name.toLowerCase() == workflowName.toLowerCase())
    [0]

  if(lastRun == undefined) {
    console.warn(chalk.red("Could not find last workflow run"))
    ProcessingInstruction.exit(1)
  }

  return lastRun.id
}

async function fetchArtifact(octokit, owner, repo, workflowId, artifactName) {
  const { data } = await octokit.request('GET /repos/{owner}/{repo}/actions/runs/{run_id}/artifacts', {
    owner: owner,
    repo: repo,
    run_id: workflowId
  })

  const artifact = data.artifacts
    .filter(item => item.name.toLowerCase() == artifactName.toLowerCase())
    [0]

  if(artifact == undefined) {
    console.warn(chalk.red("Could not find artifact"))
    ProcessingInstruction.exit(1)
  }

  return artifact.id
}

async function downloadArtifact(octokit, owner, repo, artifactId, destination) {
  const { data } = await octokit.request('GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}/{archive_format}', {
    owner: owner,
    repo: repo,
    artifact_id: artifactId,
    archive_format: 'zip'
  })

  await fs.writeFile(`${destination}.zip`, Buffer.from(data));
  await $`unzip ${destination}.zip -d ${destination}`
}
