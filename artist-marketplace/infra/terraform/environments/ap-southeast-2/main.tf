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
  region = "ap-southeast-2"
}

locals {
  env    = "prod"
  region = "ap-southeast-2"
}

module "vpc" {
  source   = "../../modules/vpc"
  region   = local.region
  env      = local.env
  vpc_cidr = "10.1.0.0/16"
  private_subnets = ["10.1.1.0/24", "10.1.2.0/24"]
  public_subnets  = ["10.1.101.0/24", "10.1.102.0/24"]
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
