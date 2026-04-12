{{/*
Shared Deployment template for PrintForge microservices.
Demonstrates production-grade Kubernetes best practices:
  - All three probe types (startup, liveness, readiness)
  - Resource requests AND limits
  - topologySpreadConstraints for AZ distribution
  - podAntiAffinity for node spreading
  - Full pod and container securityContext
  - terminationGracePeriodSeconds with preStop hook
  - Environment injection from ConfigMap and Secret refs

Usage:
  {{- include "common.deployment" . }}
*/}}
{{- define "common.deployment" -}}
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "common.fullname" . }}
  labels:
    {{- include "common.labels" . | nindent 4 }}
spec:
  {{- if not .Values.autoscaling.enabled }}
  replicas: {{ .Values.replicaCount }}
  {{- end }}
  revisionHistoryLimit: {{ .Values.revisionHistoryLimit | default 5 }}
  selector:
    matchLabels:
      {{- include "common.selectorLabels" . | nindent 6 }}
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0
      maxSurge: 1
  template:
    metadata:
      labels:
        {{- include "common.selectorLabels" . | nindent 8 }}
        {{- with .Values.podLabels }}
        {{- toYaml . | nindent 8 }}
        {{- end }}
      annotations:
        checksum/config: {{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum | trunc 8 }}
        {{- with .Values.podAnnotations }}
        {{- toYaml . | nindent 8 }}
        {{- end }}
    spec:
      serviceAccountName: {{ include "common.serviceAccountName" . }}
      automountServiceAccountToken: {{ .Values.automountServiceAccountToken | default false }}
      terminationGracePeriodSeconds: {{ .Values.terminationGracePeriodSeconds | default 30 }}

      {{- /* --- Pod-level security context --- */}}
      securityContext:
        runAsNonRoot: true
        runAsUser: {{ .Values.podSecurityContext.runAsUser | default 1000 }}
        runAsGroup: {{ .Values.podSecurityContext.runAsGroup | default 1000 }}
        fsGroup: {{ .Values.podSecurityContext.fsGroup | default 1000 }}
        seccompProfile:
          type: RuntimeDefault

      {{- /* --- Topology spread: distribute evenly across AZs --- */}}
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: ScheduleAnyway
          labelSelector:
            matchLabels:
              {{- include "common.selectorLabels" . | nindent 14 }}
        - maxSkew: 1
          topologyKey: kubernetes.io/hostname
          whenUnsatisfiable: ScheduleAnyway
          labelSelector:
            matchLabels:
              {{- include "common.selectorLabels" . | nindent 14 }}

      {{- /* --- Pod anti-affinity: prefer spreading across nodes --- */}}
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchExpressions:
                    - key: app.kubernetes.io/name
                      operator: In
                      values:
                        - {{ include "common.name" . }}
                topologyKey: kubernetes.io/hostname
        {{- with .Values.affinity }}
        {{- toYaml . | nindent 8 }}
        {{- end }}

      {{- with .Values.imagePullSecrets }}
      imagePullSecrets:
        {{- toYaml . | nindent 8 }}
      {{- end }}

      {{- with .Values.initContainers }}
      initContainers:
        {{- toYaml . | nindent 8 }}
      {{- end }}

      containers:
        - name: {{ include "common.name" . }}
          image: {{ include "common.image" . }}
          imagePullPolicy: {{ .Values.image.pullPolicy | default "IfNotPresent" }}

          {{- /* --- Container-level security context --- */}}
          securityContext:
            runAsNonRoot: true
            readOnlyRootFilesystem: true
            allowPrivilegeEscalation: false
            capabilities:
              drop:
                - ALL

          ports:
            - name: http
              containerPort: {{ .Values.containerPort }}
              protocol: TCP
            {{- range .Values.additionalPorts }}
            - name: {{ .name }}
              containerPort: {{ .containerPort }}
              protocol: {{ .protocol | default "TCP" }}
            {{- end }}

          {{- /* --- Environment variables from ConfigMap and Secret refs --- */}}
          {{- with .Values.env }}
          env:
            {{- toYaml . | nindent 12 }}
          {{- end }}
          envFrom:
            {{- if .Values.configMapRef }}
            - configMapRef:
                name: {{ .Values.configMapRef | default (include "common.fullname" .) }}
            {{- end }}
            {{- if .Values.secretRef }}
            - secretRef:
                name: {{ .Values.secretRef }}
            {{- end }}
            {{- with .Values.extraEnvFrom }}
            {{- toYaml . | nindent 12 }}
            {{- end }}

          {{- /* --- Startup probe: generous initial check window --- */}}
          startupProbe:
            httpGet:
              path: {{ .Values.probes.startup.path | default "/healthz" }}
              port: http
            initialDelaySeconds: {{ .Values.probes.startup.initialDelaySeconds | default 5 }}
            periodSeconds: {{ .Values.probes.startup.periodSeconds | default 5 }}
            timeoutSeconds: {{ .Values.probes.startup.timeoutSeconds | default 3 }}
            failureThreshold: {{ .Values.probes.startup.failureThreshold | default 30 }}

          {{- /* --- Liveness probe: restart if the process is hung --- */}}
          livenessProbe:
            httpGet:
              path: {{ .Values.probes.liveness.path | default "/healthz" }}
              port: http
            periodSeconds: {{ .Values.probes.liveness.periodSeconds | default 15 }}
            timeoutSeconds: {{ .Values.probes.liveness.timeoutSeconds | default 3 }}
            failureThreshold: {{ .Values.probes.liveness.failureThreshold | default 3 }}
            successThreshold: 1

          {{- /* --- Readiness probe: stop traffic if not ready --- */}}
          readinessProbe:
            httpGet:
              path: {{ .Values.probes.readiness.path | default "/ready" }}
              port: http
            periodSeconds: {{ .Values.probes.readiness.periodSeconds | default 10 }}
            timeoutSeconds: {{ .Values.probes.readiness.timeoutSeconds | default 3 }}
            failureThreshold: {{ .Values.probes.readiness.failureThreshold | default 3 }}
            successThreshold: {{ .Values.probes.readiness.successThreshold | default 1 }}

          {{- /* --- Resource requests and limits --- */}}
          resources:
            requests:
              memory: {{ .Values.resources.requests.memory }}
              cpu: {{ .Values.resources.requests.cpu }}
            limits:
              memory: {{ .Values.resources.limits.memory }}
              cpu: {{ .Values.resources.limits.cpu }}

          {{- /* --- Lifecycle hook: preStop sleep for endpoint propagation --- */}}
          lifecycle:
            preStop:
              exec:
                command:
                  - /bin/sh
                  - -c
                  - "sleep 5"

          {{- /* --- Volume mounts --- */}}
          volumeMounts:
            - name: tmp
              mountPath: /tmp
            {{- with .Values.volumeMounts }}
            {{- toYaml . | nindent 12 }}
            {{- end }}

      {{- /* --- Volumes --- */}}
      volumes:
        - name: tmp
          emptyDir:
            sizeLimit: 64Mi
        {{- with .Values.volumes }}
        {{- toYaml . | nindent 8 }}
        {{- end }}

      {{- with .Values.nodeSelector }}
      nodeSelector:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.tolerations }}
      tolerations:
        {{- toYaml . | nindent 8 }}
      {{- end }}
{{- end }}
