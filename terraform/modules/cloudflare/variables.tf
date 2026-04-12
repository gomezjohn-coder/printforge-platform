variable "zone_id" { type = string; description = "Cloudflare Zone ID" }
variable "domain_name" { type = string; description = "Domain name" }
variable "alb_dns_name" { type = string; description = "EKS ALB DNS name" }
variable "monolith_alb_dns_name" { type = string; description = "ECS monolith ALB DNS name" }
