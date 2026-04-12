variable "env" {
  type = string
}

variable "subnet_ids" {
  type = list(string)
}

variable "security_group_ids" {
  type    = list(string)
  default = []
}

variable "db_username" {
  type    = string
  default = "marketplace"
}

variable "db_password" {
  type      = string
  sensitive = true
}
