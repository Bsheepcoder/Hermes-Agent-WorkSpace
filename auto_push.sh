#!/bin/bash
cd /root/.hermes/workspace
git add -A
if [ -n "$(git status --porcelain)" ]; then
  git commit -m "auto sync $(date +'%Y-%m-%d %H:%M')" 
  git push origin main
fi
