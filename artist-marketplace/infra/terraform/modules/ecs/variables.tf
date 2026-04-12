variable "env" {
  type = string
}

variable "ecr_repo" {
  type = string
}

variable "execution_role_arn" {
  type    = string
  default = ""
}
