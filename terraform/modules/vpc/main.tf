# ============================================================
# VPC Module — Three-tier subnet architecture
# ============================================================
# Public subnets:  NAT gateways, ALBs, bastion hosts
# Private subnets: EKS nodes, ECS tasks, internal ALBs
# Data subnets:    RDS, ElastiCache (no internet access)
#
# Deployed across 3 AZs for high availability
# ============================================================

terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  azs = slice(data.aws_availability_zones.available.names, 0, 3)
}

# ─── VPC ──────────────────────────────────────────────────
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-vpc"
    # Required for EKS load balancer auto-discovery
    "kubernetes.io/cluster/${var.cluster_name}" = "shared"
  })
}

# ─── Internet Gateway ────────────────────────────────────
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = merge(var.tags, { Name = "${var.project_name}-${var.environment}-igw" })
}

# ─── Public Subnets (NAT, ALB) ───────────────────────────
resource "aws_subnet" "public" {
  count                   = 3
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 4, count.index)
  availability_zone       = local.azs[count.index]
  map_public_ip_on_launch = true

  tags = merge(var.tags, {
    Name                                        = "${var.project_name}-${var.environment}-public-${local.azs[count.index]}"
    "kubernetes.io/role/elb"                     = "1"
    "kubernetes.io/cluster/${var.cluster_name}" = "shared"
    Tier                                        = "public"
  })
}

# ─── Private Subnets (EKS Nodes, ECS Tasks) ──────────────
resource "aws_subnet" "private" {
  count             = 3
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, count.index + 3)
  availability_zone = local.azs[count.index]

  tags = merge(var.tags, {
    Name                                        = "${var.project_name}-${var.environment}-private-${local.azs[count.index]}"
    "kubernetes.io/role/internal-elb"           = "1"
    "kubernetes.io/cluster/${var.cluster_name}" = "shared"
    Tier                                        = "private"
  })
}

# ─── Data Subnets (RDS, ElastiCache) ─────────────────────
resource "aws_subnet" "data" {
  count             = 3
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, count.index + 6)
  availability_zone = local.azs[count.index]

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-data-${local.azs[count.index]}"
    Tier = "data"
  })
}

# ─── NAT Gateways (one per AZ for HA) ────────────────────
resource "aws_eip" "nat" {
  count  = var.single_nat_gateway ? 1 : 3
  domain = "vpc"
  tags   = merge(var.tags, { Name = "${var.project_name}-${var.environment}-nat-eip-${count.index}" })
}

resource "aws_nat_gateway" "main" {
  count         = var.single_nat_gateway ? 1 : 3
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id
  tags          = merge(var.tags, { Name = "${var.project_name}-${var.environment}-nat-${count.index}" })

  depends_on = [aws_internet_gateway.main]
}

# ─── Route Tables ─────────────────────────────────────────
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  tags   = merge(var.tags, { Name = "${var.project_name}-${var.environment}-public-rt" })
}

resource "aws_route" "public_internet" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.main.id
}

resource "aws_route_table_association" "public" {
  count          = 3
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table" "private" {
  count  = 3
  vpc_id = aws_vpc.main.id
  tags   = merge(var.tags, { Name = "${var.project_name}-${var.environment}-private-rt-${count.index}" })
}

resource "aws_route" "private_nat" {
  count                  = 3
  route_table_id         = aws_route_table.private[count.index].id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.main[var.single_nat_gateway ? 0 : count.index].id
}

resource "aws_route_table_association" "private" {
  count          = 3
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

resource "aws_route_table_association" "data" {
  count          = 3
  subnet_id      = aws_subnet.data[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

# ─── VPC Flow Logs ────────────────────────────────────────
resource "aws_flow_log" "main" {
  vpc_id               = aws_vpc.main.id
  traffic_type         = "ALL"
  log_destination      = aws_cloudwatch_log_group.flow_log.arn
  log_destination_type = "cloud-watch-logs"
  iam_role_arn         = aws_iam_role.flow_log.arn

  tags = merge(var.tags, { Name = "${var.project_name}-${var.environment}-flow-log" })
}

resource "aws_cloudwatch_log_group" "flow_log" {
  name              = "/vpc/${var.project_name}-${var.environment}/flow-logs"
  retention_in_days = 30
  tags              = var.tags
}

resource "aws_iam_role" "flow_log" {
  name = "${var.project_name}-${var.environment}-flow-log-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "vpc-flow-logs.amazonaws.com" }
    }]
  })
  tags = var.tags
}

resource "aws_iam_role_policy" "flow_log" {
  name = "flow-log-policy"
  role = aws_iam_role.flow_log.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams"
      ]
      Resource = "*"
    }]
  })
}
