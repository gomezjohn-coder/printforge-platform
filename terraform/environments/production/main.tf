# ============================================================
# Production Environment — Full Infrastructure Composition
# ============================================================
# Wires all Terraform modules together for production.
# Region: ap-southeast-2 (Sydney) — primary AU region
# A parallel stack in terraform/environments/production-us/
# runs us-east-1 for the US audience. Route53 latency-based
# routing steers customers to the closest region; cross-region
# Aurora Global Database provides RPO < 1s failover.
# ============================================================

terraform {
  required_version = ">= 1.5"

  backend "s3" {
    bucket         = "printforge-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "ap-southeast-2"
    dynamodb_table = "printforge-terraform-locks"
    encrypt        = true
  }

  required_providers {
    aws        = { source = "hashicorp/aws"; version = "~> 5.0" }
    cloudflare = { source = "cloudflare/cloudflare"; version = "~> 4.0" }
    datadog    = { source = "DataDog/datadog"; version = "~> 3.30" }
    kubernetes = { source = "hashicorp/kubernetes"; version = "~> 2.24" }
    helm       = { source = "hashicorp/helm"; version = "~> 2.12" }
  }
}

provider "aws" {
  region = "ap-southeast-2"
  default_tags {
    tags = local.tags
  }
}

locals {
  environment  = "production"
  project_name = "printforge"
  cluster_name = "${local.project_name}-${local.environment}"
  domain_name  = "printforge.com"

  tags = {
    Project     = local.project_name
    Environment = local.environment
    ManagedBy   = "terraform"
    Team        = "devops"
  }
}

# ─── Networking ───────────────────────────────────────────
module "vpc" {
  source = "../../modules/vpc"

  project_name       = local.project_name
  environment        = local.environment
  vpc_cidr           = "10.0.0.0/16"
  cluster_name       = local.cluster_name
  single_nat_gateway = false  # HA: one NAT per AZ in production
  tags               = local.tags
}

# ─── EKS Cluster (Microservices) ──────────────────────────
module "eks" {
  source = "../../modules/eks"

  project_name           = local.project_name
  environment            = local.environment
  cluster_name           = local.cluster_name
  cluster_version        = "1.29"
  aws_region             = "ap-southeast-2"
  vpc_id                 = module.vpc.vpc_id
  vpc_cidr               = module.vpc.vpc_cidr
  private_subnet_ids     = module.vpc.private_subnet_ids
  public_subnet_ids      = module.vpc.public_subnet_ids
  endpoint_public_access = false  # Private API endpoint only

  # On-demand nodes (baseline capacity)
  node_instance_types = ["m6i.large", "m5.large"]
  node_desired_size   = 3
  node_min_size       = 2
  node_max_size       = 10

  # Spot nodes (cost optimization for non-critical workloads)
  spot_instance_types = ["m6i.large", "m5.large", "m5a.large", "m6a.large"]
  spot_desired_size   = 2
  spot_min_size       = 0
  spot_max_size       = 10

  tags = local.tags
}

# ─── ECS (Legacy Monolith) ───────────────────────────────
module "ecs" {
  source = "../../modules/ecs"

  project_name            = local.project_name
  environment             = local.environment
  vpc_id                  = module.vpc.vpc_id
  private_subnet_ids      = module.vpc.private_subnet_ids
  public_subnet_ids       = module.vpc.public_subnet_ids
  ecr_repository_url      = "${data.aws_caller_identity.current.account_id}.dkr.ecr.ap-southeast-2.amazonaws.com/${local.project_name}/monolith-service"
  database_url_secret_arn = aws_secretsmanager_secret.database_url.arn
  certificate_arn         = aws_acm_certificate.main.arn
  task_cpu                = 1024
  task_memory             = 2048
  desired_count           = 2
  max_count               = 6
  tags                    = local.tags
}

# ─── Cloudflare (Edge Layer) ─────────────────────────────
module "cloudflare" {
  source = "../../modules/cloudflare"

  zone_id               = var.cloudflare_zone_id
  domain_name           = local.domain_name
  alb_dns_name          = "placeholder.elb.ap-southeast-2.amazonaws.com"  # From EKS ingress
  monolith_alb_dns_name = module.ecs.alb_dns_name
}

# ─── Datadog (Observability) ─────────────────────────────
module "datadog" {
  source = "../../modules/datadog"

  cluster_name         = local.cluster_name
  environment          = local.environment
  notification_channel = "@slack-platform-alerts @pagerduty-devops"
}

# ─── Supporting Resources ─────────────────────────────────
data "aws_caller_identity" "current" {}

resource "aws_secretsmanager_secret" "database_url" {
  name = "${local.project_name}/${local.environment}/database-url"
  tags = local.tags
}

resource "aws_acm_certificate" "main" {
  domain_name               = local.domain_name
  subject_alternative_names = ["*.${local.domain_name}"]
  validation_method         = "DNS"
  tags                      = local.tags

  lifecycle {
    create_before_destroy = true
  }
}

# ─── Variables ────────────────────────────────────────────
variable "cloudflare_zone_id" {
  type        = string
  description = "Cloudflare zone ID"
}
