# ============================================================
# Staging Environment — Cost-optimized for testing
# ============================================================

terraform {
  required_version = ">= 1.5"

  backend "s3" {
    bucket         = "rawcanvas-terraform-state"
    key            = "staging/terraform.tfstate"
    region         = "ap-southeast-2"
    dynamodb_table = "rawcanvas-terraform-locks"
    encrypt        = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "ap-southeast-2"
  default_tags {
    tags = local.tags
  }
}

locals {
  environment  = "staging"
  project_name = "printforge"
  cluster_name = "${local.project_name}-${local.environment}"

  tags = {
    Project     = local.project_name
    Environment = local.environment
    ManagedBy   = "terraform"
    Team        = "devops"
  }
}

module "vpc" {
  source = "../../modules/vpc"

  project_name       = local.project_name
  environment        = local.environment
  vpc_cidr           = "10.1.0.0/16"
  cluster_name       = local.cluster_name
  single_nat_gateway = true  # Cost savings: single NAT in staging
  tags               = local.tags
}

module "eks" {
  source = "../../modules/eks"

  project_name           = local.project_name
  environment            = local.environment
  cluster_name           = local.cluster_name
  cluster_version        = "1.30"
  vpc_id                 = module.vpc.vpc_id
  vpc_cidr               = module.vpc.vpc_cidr
  private_subnet_ids     = module.vpc.private_subnet_ids
  public_subnet_ids      = module.vpc.public_subnet_ids
  endpoint_public_access = true  # Public access OK for staging

  node_instance_types = ["t3.medium"]
  node_desired_size   = 2
  node_min_size       = 1
  node_max_size       = 4

  spot_desired_size = 0
  spot_min_size     = 0
  spot_max_size     = 1

  tags = local.tags
}
