{{/*
Expand the name of the chart.
*/}}
{{- define "arbitragex-supreme.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "arbitragex-supreme.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "arbitragex-supreme.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "arbitragex-supreme.labels" -}}
helm.sh/chart: {{ include "arbitragex-supreme.chart" . }}
{{ include "arbitragex-supreme.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/component: arbitrage-system
app.kubernetes.io/part-of: trading-platform
{{- end }}

{{/*
Selector labels
*/}}
{{- define "arbitragex-supreme.selectorLabels" -}}
app.kubernetes.io/name: {{ include "arbitragex-supreme.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "arbitragex-supreme.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "arbitragex-supreme.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Create the name of the cluster role to use
*/}}
{{- define "arbitragex-supreme.clusterRoleName" -}}
{{- if .Values.rbac.create }}
{{- default (printf "%s-cluster-role" (include "arbitragex-supreme.fullname" .)) .Values.rbac.clusterRole.name }}
{{- else }}
{{- default "default" .Values.rbac.clusterRole.name }}
{{- end }}
{{- end }}

{{/*
Create the name of the role to use
*/}}
{{- define "arbitragex-supreme.roleName" -}}
{{- if .Values.rbac.create }}
{{- default (printf "%s-role" (include "arbitragex-supreme.fullname" .)) .Values.rbac.role.name }}
{{- else }}
{{- default "default" .Values.rbac.role.name }}
{{- end }}
{{- end }}

{{/*
Generate certificates for webhook TLS
*/}}
{{- define "arbitragex-supreme.webhook-certs" -}}
{{- $altNames := list ( printf "%s.%s" (include "arbitragex-supreme.fullname" .) .Release.Namespace ) ( printf "%s.%s.svc" (include "arbitragex-supreme.fullname" .) .Release.Namespace ) -}}
{{- $ca := genCA "arbitragex-supreme-ca" 365 -}}
{{- $cert := genSignedCert ( include "arbitragex-supreme.fullname" . ) nil $altNames 365 $ca -}}
tls.crt: {{ $cert.Cert | b64enc }}
tls.key: {{ $cert.Key | b64enc }}
ca.crt: {{ $ca.Cert | b64enc }}
{{- end }}

{{/*
Generate the Docker image name
*/}}
{{- define "arbitragex-supreme.image" -}}
{{- if .Values.image.registry }}
{{- printf "%s/%s:%s" .Values.image.registry .Values.image.repository (.Values.image.tag | default .Chart.AppVersion) }}
{{- else }}
{{- printf "%s:%s" .Values.image.repository (.Values.image.tag | default .Chart.AppVersion) }}
{{- end }}
{{- end }}

{{/*
Generate the init container image name
*/}}
{{- define "arbitragex-supreme.initImage" -}}
{{- if .Values.initContainer.image.registry }}
{{- printf "%s/%s:%s" .Values.initContainer.image.registry .Values.initContainer.image.repository .Values.initContainer.image.tag }}
{{- else }}
{{- printf "%s:%s" .Values.initContainer.image.repository .Values.initContainer.image.tag }}
{{- end }}
{{- end }}

{{/*
Generate Vault agent image name
*/}}
{{- define "arbitragex-supreme.vaultImage" -}}
{{- if .Values.vault.agent.image.registry }}
{{- printf "%s/%s:%s" .Values.vault.agent.image.registry .Values.vault.agent.image.repository .Values.vault.agent.image.tag }}
{{- else }}
{{- printf "%s:%s" .Values.vault.agent.image.repository .Values.vault.agent.image.tag }}
{{- end }}
{{- end }}

{{/*
Generate resource requirements
*/}}
{{- define "arbitragex-supreme.resources" -}}
{{- if .Values.resources }}
resources:
  {{- if .Values.resources.limits }}
  limits:
    {{- if .Values.resources.limits.cpu }}
    cpu: {{ .Values.resources.limits.cpu }}
    {{- end }}
    {{- if .Values.resources.limits.memory }}
    memory: {{ .Values.resources.limits.memory }}
    {{- end }}
    {{- if .Values.resources.limits.ephemeralStorage }}
    ephemeral-storage: {{ .Values.resources.limits.ephemeralStorage }}
    {{- end }}
  {{- end }}
  {{- if .Values.resources.requests }}
  requests:
    {{- if .Values.resources.requests.cpu }}
    cpu: {{ .Values.resources.requests.cpu }}
    {{- end }}
    {{- if .Values.resources.requests.memory }}
    memory: {{ .Values.resources.requests.memory }}
    {{- end }}
    {{- if .Values.resources.requests.ephemeralStorage }}
    ephemeral-storage: {{ .Values.resources.requests.ephemeralStorage }}
    {{- end }}
  {{- end }}
{{- end }}
{{- end }}

{{/*
Generate security context
*/}}
{{- define "arbitragex-supreme.securityContext" -}}
{{- if .Values.securityContext }}
securityContext:
  {{- if .Values.securityContext.runAsUser }}
  runAsUser: {{ .Values.securityContext.runAsUser }}
  {{- end }}
  {{- if .Values.securityContext.runAsGroup }}
  runAsGroup: {{ .Values.securityContext.runAsGroup }}
  {{- end }}
  {{- if .Values.securityContext.fsGroup }}
  fsGroup: {{ .Values.securityContext.fsGroup }}
  {{- end }}
  {{- if .Values.securityContext.runAsNonRoot }}
  runAsNonRoot: {{ .Values.securityContext.runAsNonRoot }}
  {{- end }}
  {{- if .Values.securityContext.readOnlyRootFilesystem }}
  readOnlyRootFilesystem: {{ .Values.securityContext.readOnlyRootFilesystem }}
  {{- end }}
  {{- if .Values.securityContext.allowPrivilegeEscalation }}
  allowPrivilegeEscalation: {{ .Values.securityContext.allowPrivilegeEscalation }}
  {{- end }}
  {{- if .Values.securityContext.capabilities }}
  capabilities:
    {{- if .Values.securityContext.capabilities.add }}
    add:
      {{- range .Values.securityContext.capabilities.add }}
      - {{ . }}
      {{- end }}
    {{- end }}
    {{- if .Values.securityContext.capabilities.drop }}
    drop:
      {{- range .Values.securityContext.capabilities.drop }}
      - {{ . }}
      {{- end }}
    {{- end }}
  {{- end }}
{{- end }}
{{- end }}

{{/*
Generate pod security context
*/}}
{{- define "arbitragex-supreme.podSecurityContext" -}}
{{- if .Values.podSecurityContext }}
securityContext:
  {{- if .Values.podSecurityContext.runAsUser }}
  runAsUser: {{ .Values.podSecurityContext.runAsUser }}
  {{- end }}
  {{- if .Values.podSecurityContext.runAsGroup }}
  runAsGroup: {{ .Values.podSecurityContext.runAsGroup }}
  {{- end }}
  {{- if .Values.podSecurityContext.fsGroup }}
  fsGroup: {{ .Values.podSecurityContext.fsGroup }}
  {{- end }}
  {{- if .Values.podSecurityContext.fsGroupChangePolicy }}
  fsGroupChangePolicy: {{ .Values.podSecurityContext.fsGroupChangePolicy }}
  {{- end }}
  {{- if .Values.podSecurityContext.seccompProfile }}
  seccompProfile:
    type: {{ .Values.podSecurityContext.seccompProfile.type }}
  {{- end }}
  {{- if .Values.podSecurityContext.seLinuxOptions }}
  seLinuxOptions:
    {{- toYaml .Values.podSecurityContext.seLinuxOptions | nindent 4 }}
  {{- end }}
  {{- if .Values.podSecurityContext.supplementalGroups }}
  supplementalGroups:
    {{- range .Values.podSecurityContext.supplementalGroups }}
    - {{ . }}
    {{- end }}
  {{- end }}
  {{- if .Values.podSecurityContext.sysctls }}
  sysctls:
    {{- range .Values.podSecurityContext.sysctls }}
    - name: {{ .name }}
      value: {{ .value | quote }}
    {{- end }}
  {{- end }}
{{- end }}
{{- end }}

{{/*
Generate node selector
*/}}
{{- define "arbitragex-supreme.nodeSelector" -}}
{{- if .Values.nodeSelector }}
nodeSelector:
  {{- toYaml .Values.nodeSelector | nindent 2 }}
{{- end }}
{{- end }}

{{/*
Generate affinity rules
*/}}
{{- define "arbitragex-supreme.affinity" -}}
{{- if .Values.affinity }}
affinity:
  {{- toYaml .Values.affinity | nindent 2 }}
{{- else if .Values.affinityPreset }}
affinity:
  {{- if eq .Values.affinityPreset "hard" }}
  podAntiAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
    - labelSelector:
        matchLabels:
          {{- include "arbitragex-supreme.selectorLabels" . | nindent 10 }}
      topologyKey: kubernetes.io/hostname
  {{- else if eq .Values.affinityPreset "soft" }}
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
    - weight: 100
      podAffinityTerm:
        labelSelector:
          matchLabels:
            {{- include "arbitragex-supreme.selectorLabels" . | nindent 12 }}
        topologyKey: kubernetes.io/hostname
  {{- end }}
{{- end }}
{{- end }}

{{/*
Generate tolerations
*/}}
{{- define "arbitragex-supreme.tolerations" -}}
{{- if .Values.tolerations }}
tolerations:
  {{- toYaml .Values.tolerations | nindent 2 }}
{{- end }}
{{- end }}

{{/*
Generate environment variables from ConfigMap
*/}}
{{- define "arbitragex-supreme.envFromConfigMap" -}}
envFrom:
- configMapRef:
    name: {{ include "arbitragex-supreme.fullname" . }}-config
{{- if .Values.vault.enabled }}
- secretRef:
    name: {{ include "arbitragex-supreme.fullname" . }}-vault-config
{{- else }}
- secretRef:
    name: {{ include "arbitragex-supreme.fullname" . }}-fallback-secrets
{{- end }}
{{- end }}

{{/*
Generate volume mounts for application
*/}}
{{- define "arbitragex-supreme.volumeMounts" -}}
volumeMounts:
- name: tmp-volume
  mountPath: /tmp
- name: app-logs
  mountPath: /app/logs
{{- if .Values.vault.enabled }}
- name: vault-secrets
  mountPath: /vault/secrets
  readOnly: true
{{- end }}
{{- if .Values.persistence.enabled }}
- name: data-volume
  mountPath: {{ .Values.persistence.mountPath }}
{{- end }}
{{- if .Values.configFiles }}
{{- range $key, $value := .Values.configFiles }}
- name: config-{{ $key }}
  mountPath: /app/config/{{ $key }}
  subPath: {{ $key }}
  readOnly: true
{{- end }}
{{- end }}
{{- end }}

{{/*
Generate volumes for deployment
*/}}
{{- define "arbitragex-supreme.volumes" -}}
volumes:
- name: tmp-volume
  emptyDir: {}
- name: app-logs
  emptyDir: {}
{{- if .Values.vault.enabled }}
- name: vault-secrets
  emptyDir:
    medium: Memory
{{- end }}
{{- if .Values.persistence.enabled }}
- name: data-volume
  persistentVolumeClaim:
    claimName: {{ include "arbitragex-supreme.fullname" . }}-data
{{- end }}
{{- if .Values.configFiles }}
{{- range $key, $value := .Values.configFiles }}
- name: config-{{ $key }}
  configMap:
    name: {{ include "arbitragex-supreme.fullname" . }}-{{ $key }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Generate probe configuration
*/}}
{{- define "arbitragex-supreme.livenessProbe" -}}
{{- if .Values.livenessProbe.enabled }}
livenessProbe:
  {{- if eq .Values.livenessProbe.type "http" }}
  httpGet:
    path: {{ .Values.livenessProbe.httpPath | default "/health" }}
    port: {{ .Values.livenessProbe.httpPort | default "health" }}
    scheme: {{ .Values.livenessProbe.httpScheme | default "HTTP" }}
  {{- else if eq .Values.livenessProbe.type "tcp" }}
  tcpSocket:
    port: {{ .Values.livenessProbe.tcpPort | default "http" }}
  {{- else if eq .Values.livenessProbe.type "exec" }}
  exec:
    command:
      {{- range .Values.livenessProbe.execCommand }}
      - {{ . }}
      {{- end }}
  {{- end }}
  initialDelaySeconds: {{ .Values.livenessProbe.initialDelaySeconds | default 30 }}
  periodSeconds: {{ .Values.livenessProbe.periodSeconds | default 10 }}
  timeoutSeconds: {{ .Values.livenessProbe.timeoutSeconds | default 5 }}
  successThreshold: {{ .Values.livenessProbe.successThreshold | default 1 }}
  failureThreshold: {{ .Values.livenessProbe.failureThreshold | default 3 }}
{{- end }}
{{- end }}

{{/*
Generate readiness probe configuration
*/}}
{{- define "arbitragex-supreme.readinessProbe" -}}
{{- if .Values.readinessProbe.enabled }}
readinessProbe:
  {{- if eq .Values.readinessProbe.type "http" }}
  httpGet:
    path: {{ .Values.readinessProbe.httpPath | default "/health/ready" }}
    port: {{ .Values.readinessProbe.httpPort | default "health" }}
    scheme: {{ .Values.readinessProbe.httpScheme | default "HTTP" }}
  {{- else if eq .Values.readinessProbe.type "tcp" }}
  tcpSocket:
    port: {{ .Values.readinessProbe.tcpPort | default "http" }}
  {{- else if eq .Values.readinessProbe.type "exec" }}
  exec:
    command:
      {{- range .Values.readinessProbe.execCommand }}
      - {{ . }}
      {{- end }}
  {{- end }}
  initialDelaySeconds: {{ .Values.readinessProbe.initialDelaySeconds | default 5 }}
  periodSeconds: {{ .Values.readinessProbe.periodSeconds | default 5 }}
  timeoutSeconds: {{ .Values.readinessProbe.timeoutSeconds | default 3 }}
  successThreshold: {{ .Values.readinessProbe.successThreshold | default 1 }}
  failureThreshold: {{ .Values.readinessProbe.failureThreshold | default 3 }}
{{- end }}
{{- end }}

{{/*
Generate startup probe configuration
*/}}
{{- define "arbitragex-supreme.startupProbe" -}}
{{- if .Values.startupProbe.enabled }}
startupProbe:
  {{- if eq .Values.startupProbe.type "http" }}
  httpGet:
    path: {{ .Values.startupProbe.httpPath | default "/health/startup" }}
    port: {{ .Values.startupProbe.httpPort | default "health" }}
    scheme: {{ .Values.startupProbe.httpScheme | default "HTTP" }}
  {{- else if eq .Values.startupProbe.type "tcp" }}
  tcpSocket:
    port: {{ .Values.startupProbe.tcpPort | default "http" }}
  {{- else if eq .Values.startupProbe.type "exec" }}
  exec:
    command:
      {{- range .Values.startupProbe.execCommand }}
      - {{ . }}
      {{- end }}
  {{- end }}
  initialDelaySeconds: {{ .Values.startupProbe.initialDelaySeconds | default 10 }}
  periodSeconds: {{ .Values.startupProbe.periodSeconds | default 10 }}
  timeoutSeconds: {{ .Values.startupProbe.timeoutSeconds | default 5 }}
  successThreshold: {{ .Values.startupProbe.successThreshold | default 1 }}
  failureThreshold: {{ .Values.startupProbe.failureThreshold | default 30 }}
{{- end }}
{{- end }}

{{/*
Generate checksum for config maps to force pod restart on config change
*/}}
{{- define "arbitragex-supreme.configChecksum" -}}
checksum/config: {{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}
{{- if .Values.vault.enabled }}
checksum/vault-config: {{ include (print $.Template.BasePath "/secret.yaml") . | sha256sum }}
{{- end }}
{{- end }}

{{/*
Generate priority class name
*/}}
{{- define "arbitragex-supreme.priorityClassName" -}}
{{- if .Values.priorityClassName }}
priorityClassName: {{ .Values.priorityClassName }}
{{- end }}
{{- end }}

{{/*
Generate topology spread constraints
*/}}
{{- define "arbitragex-supreme.topologySpreadConstraints" -}}
{{- if .Values.topologySpreadConstraints }}
topologySpreadConstraints:
  {{- range .Values.topologySpreadConstraints }}
  - maxSkew: {{ .maxSkew }}
    topologyKey: {{ .topologyKey }}
    whenUnsatisfiable: {{ .whenUnsatisfiable }}
    labelSelector:
      matchLabels:
        {{- include "arbitragex-supreme.selectorLabels" $ | nindent 8 }}
  {{- end }}
{{- end }}
{{- end }}