module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "marketplace-vpc-${var.region}"
  cidr = var.vpc_cidr

  azs             = ["${var.region}a", "${var.region}b"]
  private_subnets = var.private_subnets
  public_subnets  = var.public_subnets

  enable_nat_gateway = true
  single_nat_gateway = false # HA — one NAT per AZ

  tags = {
    Environment = var.env
    Project     = "artist-marketplace"
  }
}
