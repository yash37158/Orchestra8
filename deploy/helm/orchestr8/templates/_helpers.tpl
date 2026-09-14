{{- define "orchestr8.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "orchestr8.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name (include "orchestr8.name" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "orchestr8.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" }}
app.kubernetes.io/name: {{ include "orchestr8.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{- define "orchestr8.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{- default (include "orchestr8.fullname" .) .Values.serviceAccount.name -}}
{{- else -}}
{{- default "default" .Values.serviceAccount.name -}}
{{- end -}}
{{- end -}}

{{- define "orchestr8.image" -}}
{{- $reg := .root.Values.image.registry -}}
{{- if $reg -}}{{ printf "%s/%s:%s" $reg .repo .tag }}{{- else -}}{{ printf "%s:%s" .repo .tag }}{{- end -}}
{{- end -}}

{{/*
A value that must survive `helm upgrade`.

Regenerating AUTH_SECRET signs every user out; regenerating the collector
secret breaks ingest until both ends restart. Helm's randAlphaNum runs on every
render, so the existing Secret is read back first and only a genuinely new
install generates anything.
*/}}
{{- define "orchestr8.keepSecret" -}}
{{- $existing := lookup "v1" "Secret" .ns .name -}}
{{- if and $existing (index $existing.data .key) -}}
{{- index $existing.data .key -}}
{{- else -}}
{{- .default | b64enc -}}
{{- end -}}
{{- end -}}

{{- define "orchestr8.postgresDsn" -}}
{{- if .Values.postgres.external.dsn -}}
{{- .Values.postgres.external.dsn -}}
{{- else -}}
{{- printf "postgres://%s:$(POSTGRES_PASSWORD)@%s-postgres:5432/%s?sslmode=disable" .Values.postgres.username (include "orchestr8.fullname" .) .Values.postgres.database -}}
{{- end -}}
{{- end -}}

{{/*
Credentials go in the userinfo, not the query string: a password in a query
string is a password in every access log between here and the server. Go's
http.Client turns URL userinfo into a Basic Authorization header.

The bundled ClickHouse sets CLICKHOUSE_USER/PASSWORD, so an unauthenticated
URL is refused with a 401 — which is how the first install failed.
*/}}
{{- define "orchestr8.clickhouseUrl" -}}
{{- if .Values.clickhouse.external.url -}}
{{- .Values.clickhouse.external.url -}}
{{- else -}}
{{- printf "http://%s:$(CLICKHOUSE_PASSWORD)@%s-clickhouse:8123/?database=%s&output_format_json_quote_64bit_integers=0" .Values.clickhouse.username (include "orchestr8.fullname" .) .Values.clickhouse.database -}}
{{- end -}}
{{- end -}}

{{/*
The address browsers reach the UI at.

OAuth callbacks come back here and the identity provider compares them against
what was registered, character for character, so this has to be the real
external URL and not whatever the pod happens to see. Taken from publicUrl, or
derived from the Ingress host when only that is set.
*/}}
{{- define "orchestr8.publicUrl" -}}
{{- if .Values.web.publicUrl -}}
{{- .Values.web.publicUrl | trimSuffix "/" -}}
{{- else if and .Values.ingress.enabled .Values.ingress.host -}}
{{- printf "%s://%s" (ternary "https" "http" (gt (len .Values.ingress.tls) 0)) .Values.ingress.host -}}
{{- end -}}
{{- end -}}
