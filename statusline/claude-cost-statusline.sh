#!/bin/bash
# claude-cost-statusline.sh — See your Claude Code session cost live, in real time.
#
# Part of the JD AI System Optimizer. Free and open source.
# https://github.com/jdwhite0/jd-ai-system-optimizer
#
# WHY THIS EXISTS: It's easy to burn through your AI budget without realizing it —
# background agents, long sessions, premium models. This puts your live session
# cost right in your status bar so you're never blindsided by the bill again.
#
# INSTALL:
#   1. Copy this file anywhere, e.g. ~/.claude/claude-cost-statusline.sh
#   2. chmod +x ~/.claude/claude-cost-statusline.sh
#   3. Add to ~/.claude/settings.json:
#        "statusLine": {
#          "type": "command",
#          "command": "bash ~/.claude/claude-cost-statusline.sh"
#        }
#
# No third-party code runs. This script only reads the session JSON Claude Code
# hands it on stdin and prints one line. Read it top to bottom — it's all here.

# Resolve node robustly — your editor's shell may not have nvm's node on PATH.
NODE_BIN="$(command -v node || ls -d "$HOME"/.nvm/versions/node/*/bin/node 2>/dev/null | tail -1)"
[ -z "$NODE_BIN" ] && { echo "⚡ Claude"; exit 0; }

input=$(cat)

j() { echo "$input" | "$NODE_BIN" -e "try{const d=JSON.parse(require('fs').readFileSync(0,'utf8'));$1}catch{process.stdout.write('')}"; }

model=$(j 'process.stdout.write(d.model?.display_name||"Claude")')
cost=$(j 'const c=d.cost?.total_cost_usd;process.stdout.write(c!=null?("$"+c.toFixed(2)):"")')
dir=$(j 'const p=d.workspace?.current_dir||"";process.stdout.write(p.split("/").pop()||"")')

out="⚡ ${model:-Claude}"
[ -n "$dir" ] && out="$out  📁 $dir"
[ -n "$cost" ] && out="$out  💰 $cost session"

# Cost warning — turns yellow at $2, red at $5 in a single session.
if [ -n "$cost" ]; then
  cnum=$(echo "$cost" | tr -d '$')
  warn=$("$NODE_BIN" -e "const c=parseFloat('$cnum');process.stdout.write(c>=5?'🔴':(c>=2?'🟡':''))" 2>/dev/null)
  [ -n "$warn" ] && out="$out $warn"
fi

echo "$out"
