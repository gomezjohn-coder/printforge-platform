variable "project_name" {
  type    = string
  default = "printforge"
}

variable "environment" {
  type = string
}

variable "aws_region" {
  type    = string
  default = "ap-southeast-2"
}

variable "vpc_id" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "public_subnet_ids" {
  type = list(string)
}

variable "ecr_repository_url" {
  type = string
}

variable "image_tag" {
  type    = string
  default = "latest"
}

variable "database_url_secret_arn" {
  type = string
}

variable "certificate_arn" {
  type = string
}

variable "task_cpu" {
  type    = number
  default = 512
}

variable "task_memory" {
  type    = number
  default = 1024
}

variable "desired_count" {
  type    = number
  default = 2
}

variable "max_count" {
  type    = number
  default = 6
}

variable "tags" {
  type    = map(string)
  default = {}
}
