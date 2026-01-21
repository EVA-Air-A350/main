#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: create_link_html.sh [output_file]

Creates a simple HTML file containing a clickable link to the given URL.
The script prompts for the URL so you can paste the script and then type it.

Arguments:
  output_file   Optional output HTML file (default: link.html)

Example:
  ./create_link_html.sh my-link.html
USAGE
}

if [[ ${1:-} == "-h" || ${1:-} == "--help" ]]; then
  usage
  exit 0
fi

output_file="${1:-link.html}"
read -r -p "Enter the URL to link to: " url

if [[ -z "$url" ]]; then
  echo "Error: URL cannot be empty." >&2
  exit 1
fi

cat > "$output_file" <<HTML
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>Redirect</title>
    <meta http-equiv="refresh" content="0; url=$url">
  </head>
  <body>
    <p>If you are not redirected automatically,
      <a href="$url">click here</a>.
    </p>
  </body>
</html>
HTML

echo "Created $output_file"
