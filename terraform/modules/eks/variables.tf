variable "project_name" {
  description = "Project name"
  type        = string
  default     = "printforge"
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "aws_region" {
  description = "AWS region where this cluster lives (e.g. us-east-1, ap-southeast-2)"
  type        = string
  default     = "us-east-1"
}

variable "cluster_name" {
  description = "EKS cluster name"
  type        = string
}

variable "cluster_version" {
  description = "Kubernetes version"
  type        = string
  default     = "1.29"
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for EKS nodes"
  type        = list(string)
}

variable "public_subnet_ids" {
  description = "Public subnet IDs"
  type        = list(string)
}

variable "endpoint_public_access" {
  description = "Enable public API endpoint (false for production)"
  type        = bool
  default     = false
}

variable "node_instance_types" {
  description = "Instance types for on-demand node group"
  type        = list(string)
  default     = ["m6i.large", "m5.large"]
}

variable "node_desired_size" {
  description = "Desired number of on-demand nodes"
  type        = number
  default     = 3
}

variable "node_min_size" {
  description = "Minimum number of on-demand nodes"
  type        = number
  default     = 2
}

variable "node_max_size" {
  description = "Maximum number of on-demand nodes"
  type        = number
  default     = 10
}

variable "spot_instance_types" {
  description = "Instance types for spot node group"
  type        = list(string)
  default     = ["m6i.large", "m5.large", "m5a.large", "m6a.large"]
}

variable "spot_desired_size" {
  type    = number
  default = 2
}

variable "spot_min_size" {
  type    = number
  default = 0
}

variable "spot_max_size" {
  type    = number
  default = 10
}

variable "tags" {
  description = "Common tags"
  type        = map(string)
  default     = {}
}
