terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

locals {
  env    = "prod"
  region = "us-east-1"
}

module "vpc" {
  source = "../../modules/vpc"
  region = local.region
  env    = local.env
}

module "eks" {
  source             = "../../modules/eks"
  region             = local.region
  env                = local.env
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
}

module "sqs" {
  source = "../../modules/sqs"
  env    = local.env
}

module "ecs_monolith" {
  source   = "../../modules/ecs"
  env      = local.env
  ecr_repo = "123456789012.dkr.ecr.us-east-1.amazonaws.com/monolith-service"
}
