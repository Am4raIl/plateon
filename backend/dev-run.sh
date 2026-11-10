#!/bin/sh
set -eu

cd /app
app_pid=
trap 'if [ -n "$app_pid" ]; then kill "$app_pid" 2>/dev/null || true; wait "$app_pid" 2>/dev/null || true; fi; exit 0' INT TERM

fingerprint() {
  find src pom.xml -type f -print0 | sort -z | xargs -0 sha256sum | sha256sum | cut -d ' ' -f 1
}

last_fingerprint=
while :; do
  current_fingerprint=$(fingerprint)
  if [ "$current_fingerprint" != "$last_fingerprint" ]; then
    if mvn -q -DskipTests compile dependency:build-classpath -Dmdep.outputFile=target/classpath; then
      if [ -n "$app_pid" ]; then
        kill "$app_pid" 2>/dev/null || true
        wait "$app_pid" 2>/dev/null || true
      fi
      java -cp "target/classes:$(cat target/classpath)" japones.dev.plateon.PlateonApplication &
      app_pid=$!
      last_fingerprint=$current_fingerprint
    else
      echo "Compilação falhou; aguardando uma alteração para tentar novamente." >&2
      last_fingerprint=$current_fingerprint
    fi
  fi
  sleep 2 & wait $!
done
