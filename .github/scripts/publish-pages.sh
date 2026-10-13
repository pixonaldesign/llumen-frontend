#!/usr/bin/env bash
# Publishes builds to the gh-pages branch, which GitHub Pages serves.
#
#   publish-pages.sh slug <branch>       print the preview folder name for a branch
#   publish-pages.sh main <dist>         site root (keeps preview/)
#   publish-pages.sh preview <dist> <slug>   preview/<slug>/
#   publish-pages.sh remove <slug>       delete preview/<slug>/
#
# gh-pages is kept to a single commit. Concurrent runs are safe: each push is
# leased against the commit it started from and retried on conflict.
set -euo pipefail

slugify() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//'
}

mode="$1"
if [ "$mode" = slug ]; then
  slugify "$2"
  exit 0
fi

case "$mode" in
  main) dist="$(cd "$2" && pwd)"; message="Deploy main" ;;
  preview) dist="$(cd "$2" && pwd)"; slug="$3"; message="Deploy preview/$slug" ;;
  remove) slug="$2"; message="Remove preview/$slug" ;;
  *) echo "unknown mode: $mode" >&2; exit 2 ;;
esac

remote="https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"
work="$(mktemp -d)"

for attempt in 1 2 3 4 5; do
  rm -rf "$work" && mkdir -p "$work" && cd "$work"
  git init -q
  git remote add origin "$remote"
  if git fetch -q --depth 1 origin gh-pages 2>/dev/null; then
    git checkout -q FETCH_HEAD
    lease="gh-pages:$(git rev-parse HEAD)"
  else
    lease="gh-pages:"
  fi

  case "$mode" in
    main)
      find . -mindepth 1 -maxdepth 1 ! -name .git ! -name preview -exec rm -rf {} +
      cp -R "$dist"/. .
      ;;
    preview)
      rm -rf "preview/$slug"
      mkdir -p "preview/$slug"
      cp -R "$dist"/. "preview/$slug/"
      ;;
    remove)
      rm -rf "preview/$slug"
      ;;
  esac
  touch .nojekyll

  git checkout -q --orphan publish
  git add -A
  git -c user.name="github-actions[bot]" \
      -c user.email="41898282+github-actions[bot]@users.noreply.github.com" \
      commit -q -m "$message"
  if git push -q --force-with-lease="$lease" origin publish:gh-pages; then
    echo "$message: done"
    exit 0
  fi
  echo "gh-pages moved while publishing; retrying ($attempt)" >&2
  sleep $((attempt * 5))
done

echo "$message: gave up after 5 attempts" >&2
exit 1
