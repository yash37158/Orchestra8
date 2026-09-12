{{- define "orchestr8-collector.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "orchestr8-collector.fullname" -}}
{{- printf "%s-%s" .Release.Name (include "orchestr8-collector.name" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "orchestr8-collector.labels" -}}
app.kubernetes.io/name: {{ include "orchestr8-collector.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
orchestr8.io/cluster-id: {{ .Values.clusterId | quote }}
{{- end -}}

{{- define "orchestr8-collector.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{- default (include "orchestr8-collector.fullname" .) .Values.serviceAccount.name -}}
{{- else -}}
{{- default "default" .Values.serviceAccount.name -}}
{{- end -}}
{{- end -}}

{{- define "orchestr8-collector.secretName" -}}
{{- if .Values.existingSecret -}}
{{- .Values.existingSecret -}}
{{- else -}}
{{- printf "%s-token" (include "orchestr8-collector.fullname" .) -}}
{{- end -}}
{{- end -}}
