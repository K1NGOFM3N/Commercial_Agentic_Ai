#!/usr/bin/env node
// Fetches git-native agent directories at build time.
//
// The app repo does not track {slug}-agent/ directories — each agent lives in
// its own GitHub repo. In the Architect sandbox the platform's sync engine
// keeps those dirs present and current, so this script is a no-op there. In
// deployed builds (Netlify, Coolify/Docker, Vercel, Amplify) the checkout
// starts without them: the platform injects GIT_AGENT_REPOS (JSON array of
// {"slug","repo_url"}) and GIT_AGENT_REPO_TOKEN at deploy time, and this npm
// "prebuild" step clones each repo into place before `next build`.
//
// Failure policy: a broken or unreachable agent repo must never brick the app
// build — warn loudly and continue; that agent's chat route 404s at runtime.

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const SLUG_RE = /^[a-z0-9-]+$/
const token = process.env.GIT_AGENT_REPO_TOKEN || ''

function parseRepos() {
  const raw = process.env.GIT_AGENT_REPOS
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    console.warn('[git-agents] GIT_AGENT_REPOS is not valid JSON — skipping agent fetch')
    return []
  }
}

// https://github.com/{owner}/{repo}[.git] → "owner/repo" (null for anything else)
function ownerRepo(repoUrl) {
  try {
    const u = new URL(repoUrl)
    if (u.hostname !== 'github.com') return null
    const parts = u.pathname.replace(/\.git$/, '').split('/').filter(Boolean)
    if (parts.length < 2) return null
    return `${parts[0]}/${parts[1]}`
  } catch {
    return null
  }
}

// git clone errors echo the remote URL (token included) — never let that
// reach the log. Callers catch and fall back without printing.
function cloneWithGit(path, dest) {
  const url = token
    ? `https://x-access-token:${token}@github.com/${path}.git`
    : `https://github.com/${path}.git`
  execFileSync('git', ['clone', '--depth', '1', url, dest], {
    stdio: ['ignore', 'ignore', 'pipe'],
  })
}

// Fallback for build images without git: GitHub tarball API + system tar
// (GNU tar on Netlify, busybox tar on alpine both support --strip-components).
async function fetchTarball(path, dest) {
  const headers = { 'User-Agent': 'architect-prebuild' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`https://api.github.com/repos/${path}/tarball/main`, {
    headers,
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`tarball fetch failed: HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const tmp = join(tmpdir(), `git-agent-${process.pid}-${Math.random().toString(36).slice(2)}.tgz`)
  writeFileSync(tmp, buf)
  mkdirSync(dest, { recursive: true })
  try {
    execFileSync('tar', ['-xzf', tmp, '--strip-components=1', '-C', dest], {
      stdio: ['ignore', 'ignore', 'pipe'],
    })
  } finally {
    rmSync(tmp, { force: true })
  }
}

const repos = parseRepos()
if (repos.length > 0) {
  let fetched = 0
  for (const entry of repos) {
    const slug = entry && entry.slug
    if (typeof slug !== 'string' || !SLUG_RE.test(slug)) {
      console.warn('[git-agents] skipping entry with invalid slug')
      continue
    }
    const dest = `${slug}-agent`
    if (existsSync(dest)) continue // sandbox / rerun — already present
    const path = ownerRepo(entry && entry.repo_url)
    if (!path) {
      console.warn(`[git-agents] skipping '${slug}': unsupported repo URL`)
      continue
    }
    try {
      try {
        cloneWithGit(path, dest)
      } catch {
        rmSync(dest, { recursive: true, force: true })
        await fetchTarball(path, dest)
      }
      rmSync(join(dest, '.git'), { recursive: true, force: true })
      fetched++
      console.log(`[git-agents] fetched agent '${slug}' from ${path}`)
    } catch (err) {
      rmSync(dest, { recursive: true, force: true })
      let msg = String((err && err.message) || 'unknown error')
      if (token) msg = msg.split(token).join('***')
      console.warn(
        `##[warning] git agent '${slug}' could not be fetched (${msg}) — its chat route will 404 at runtime`,
      )
    }
  }
  if (fetched > 0) console.log(`[git-agents] ${fetched} agent director${fetched === 1 ? 'y' : 'ies'} ready`)
}
