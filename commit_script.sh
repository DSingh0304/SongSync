#!/bin/bash
FILES=$(git ls-files --others --exclude-standard; git ls-files -m; git diff --name-only --cached)
# get unique files
UNIQUE_FILES=$(echo "$FILES" | sort | uniq)

mapfile -t FILES_ARRAY <<< "$UNIQUE_FILES"
TOTAL_FILES=${#FILES_ARRAY[@]}

if [ "$TOTAL_FILES" -eq 0 ]; then
  echo "No files to commit"
  exit 0
fi

DAYS=10
SECONDS_PER_DAY=86400
NOW=$(date +%s)
START_TIME=$((NOW - DAYS * SECONDS_PER_DAY))
TIME_STEP=$(( (NOW - START_TIME) / TOTAL_FILES ))

current_time=$START_TIME

for file in "${FILES_ARRAY[@]}"; do
    if [ -z "$file" ]; then continue; fi
    git add "$file"
    commit_date=$(date -d "@$current_time" -R)
    GIT_AUTHOR_DATE="$commit_date" GIT_COMMITTER_DATE="$commit_date" git commit -m "Add $(basename "$file")"
    current_time=$((current_time + TIME_STEP))
done
