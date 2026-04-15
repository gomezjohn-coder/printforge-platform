variable "cluster_name" {
  type        = string
  description = "EKS cluster name for monitor queries"
}

variable "environment" {
  type    = string
  default = "production"
}

variable "notification_channel" {
  type    = string
  default = "@slack-platform-alerts"
}
