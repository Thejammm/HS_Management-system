// ══════════════════════════════════════════════════════════════
//  Finding a browser to render with.
//
//  The PDF renderer needs a real Chromium. So do the two pre-deploy check
//  scripts, which used to hardcode one Windows path each - so on any other
//  machine they simply did not run, which is a poor state for the scripts that
//  guard "a report must never count differently from a screen".
//  One definition, used by the server and by the checks.
// ══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

function chromiumCandidates(){
  const cands = [];
  const push = c => { if(c && !cands.includes(c)) cands.push(c); };
  push(process.env.PUPPETEER_EXECUTABLE_PATH);
  push(process.env.CHROMIUM_PATH);
  // PATH lookup — nix (nixpacks.toml) puts its chromium on PATH in the build
  // shell, but the runtime process PATH does not always carry the nix profile.
  try {
    const { execSync } = require('child_process');
    const cmd = process.platform === 'win32' ? 'where chromium' : 'which -a chromium chromium-browser google-chrome 2>/dev/null || true';
    execSync(cmd, { encoding: 'utf8' }).split(/\r?\n/).map(l => l.trim()).filter(Boolean).forEach(push);
  } catch(e){}
  // Nix store scan — the reliable route in the nixpacks image, independent of
  // PATH. The chromium package's launcher lives at /nix/store/<hash>-chromium-<v>/bin/chromium.
  try {
    const { execSync } = require('child_process');
    execSync('ls -d /nix/store/*/bin/chromium /nix/store/*/bin/chromium-browser 2>/dev/null || true', { encoding: 'utf8' })
      .split(/\r?\n/).map(l => l.trim()).filter(Boolean).forEach(push);
  } catch(e){}
  ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
   'C:/Program Files/Google/Chrome/Application/chrome.exe',
   'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].forEach(push);
  return cands.filter(c => { try { return fs.existsSync(c) && usableBrowser(c); } catch(e){ return false; } });
}
// A nix bin/chromium is a small wrapper SCRIPT that execs the real binary from
// the store — size alone must not disqualify it (unlike Ubuntu's snap stub,
// which demands "snap install"). Accept small files only when they are nix
// wrappers; keep rejecting the snap stub.
function usableBrowser(p){
  try {
    const st = fs.statSync(p);
    if(!st.isFile() && !st.isSymbolicLink()) return false;
    if(st.size >= 1024 * 1024) return true;            // real binary
    const head = fs.readFileSync(p, { encoding: 'utf8', flag: 'r' }).slice(0, 600);
    if(/snap/i.test(head)) return false;               // Ubuntu snap stub
    if(p.startsWith('/nix/store/') && head.startsWith('#!')) return true;   // nix wrapper script
    return false;
  } catch(e){ return false; }
}

// The first candidate that actually works, or null. Callers decide whether a
// missing browser is fatal.
function findChromium(){ const c = chromiumCandidates(); return c.length ? c[0] : null; }

module.exports = { chromiumCandidates, usableBrowser, findChromium };
