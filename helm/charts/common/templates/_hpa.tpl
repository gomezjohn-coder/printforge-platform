{{/*
Shared HorizontalPodAutoscaler template with scaling behavior stabilization.
Usage:
  {{- include "common.hpa" . }}
*/}}
{{- define "common.hpa" -}}
{{- if .Values.autoscaling.enabled }}
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: {{ include "common.fullname" . }}
  labels:
    {{- include "common.labels" . | nindent 4 }}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: {{ include "common.fullname" . }}
  minReplicas: {{ .Values.autoscaling.minReplicas }}
  maxReplicas: {{ .Values.autoscaling.maxReplicas }}
  metrics:
    {{- if .Values.autoscaling.targetCPUUtilizationPercentage }}
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: {{ .Values.autoscaling.targetCPUUtilizationPercentage }}
    {{- end }}
    {{- if .Values.autoscaling.targetMemoryUtilizationPercentage }}
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: {{ .Values.autoscaling.targetMemoryUtilizationPercentage }}
    {{- end }}
    {{- with .Values.autoscaling.customMetrics }}
    {{- toYaml . | nindent 4 }}
    {{- end }}
  behavior:
    scaleUp:
      stabilizationWindowSeconds: {{ .Values.autoscaling.behavior.scaleUp.stabilizationWindowSeconds | default 60 }}
      policies:
        - type: Pods
          value: {{ .Values.autoscaling.behavior.scaleUp.maxPods | default 2 }}
          periodSeconds: 60
        - type: Percent
          value: {{ .Values.autoscaling.behavior.scaleUp.maxPercent | default 50 }}
          periodSeconds: 60
      selectPolicy: Max
    scaleDown:
      stabilizationWindowSeconds: {{ .Values.autoscaling.behavior.scaleDown.stabilizationWindowSeconds | default 300 }}
      policies:
        - type: Pods
          value: {{ .Values.autoscaling.behavior.scaleDown.maxPods | default 1 }}
          periodSeconds: 60
      selectPolicy: Min
{{- end }}
{{- end }}
