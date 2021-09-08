#!/usr/bin/env zx
$.verbose = false

import {markdownTable} from 'markdown-table'

const baselineCoverageSource=argv.baseline
const currentCoverageSource=argv.current
const configPath=argv.config
const mandatory = [baselineCoverageSource, currentCoverageSource, configPath]

const usage="Usage: coverage --baseline path/to/baseline.xcresult --current path/to/current.xcresult --config path/to/.coverage.json"

mandatory.forEach(file => {
  fs.pathExists(file, (_, exists) => {
    if(!exists) {
      console.error(chalk.red('File does not exist:',file))
      console.error(chalk.yellow(usage))
      process.exit(1)
    }
  })
});

const config=JSON.parse(await fs.readFile(configPath, "utf-8"))

const failThreshold=-config.threshold

const activeTargets = config.targets.sort((a,b) => a.localeCompare(b))

const diffSrc = [baselineCoverageSource, currentCoverageSource]
const diffReport = JSON.parse(await $`xcrun xccov diff --json ${diffSrc}`.pipe($`jq .targetDeltas`))

const currentCoverage = await coverage(currentCoverageSource)
const baselineCoverage = await coverage(baselineCoverageSource)

const coverageReport = mergeReports(baselineCoverage, currentCoverage, diffReport, activeTargets)

const report = [['target','baseline','current','diff']].concat(coverageReport.map(row => Object.values(row)))
const markdown = markdownTable(report, {align: ['l', 'r', 'r', 'r']})

console.log("\n\n")
console.log(markdown)
console.log("\n\n")

diffReport.forEach(itm => {
  const diffCoverage = itm.lineCoverageDelta?.lineCoverageDelta ?? 0
  if (diffCoverage < failThreshold) {
    console.log(chalk.red(`🚩 Coverage decreased dramatically by ${formatCoverage(diffCoverage)} - back to work!\n\n`))

    process.exit(1)
  }
});

console.info(chalk.green('👍 Well done!\n\n'))

// Helper

// Transform coverage report and filter to active targets
async function coverage(source) {
  const report = await $`xcrun xccov view --report --only-targets --json ${source}`.pipe($`jq .`)
  return JSON.parse(report)
    .filter(item => item.executableLines > 0)
    .map(item => { return {target: item.name, coverage: item.lineCoverage}})
}

function mergeReports(baseline, current, diffReport, activeTargets) {
  return activeTargets.map(target => {
    const currentItem = current.find(itm => itm.target == target)
    const baselineItem = baseline.find(itm => itm.target == target)
    const diff = diffReport.find(itm => itm.name == target)

    return {
      target: target,
      baseline_coverage: formatCoverage(baselineItem?.coverage ?? 0),
      current_coverage: formatCoverage(currentItem?.coverage ?? 0),
      diff: formatCoverage(diff?.lineCoverageDelta?.lineCoverageDelta ?? 0),
    }
  });
}

function formatCoverage(coverage) {
  return (coverage * 100).toFixed(2) + '%'
}
