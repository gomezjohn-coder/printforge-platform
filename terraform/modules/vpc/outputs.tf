output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "vpc_cidr" {
  description = "VPC CIDR block"
  value       = aws_vpc.main.cidr_block
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "Private subnet IDs (for EKS nodes, ECS tasks)"
  value       = aws_subnet.private[*].id
}

output "data_subnet_ids" {
  description = "Data subnet IDs (for RDS, ElastiCache)"
  value       = aws_subnet.data[*].id
}

output "nat_gateway_ips" {
  description = "NAT Gateway public IPs"
  value       = aws_eip.nat[*].public_ip
}

output "availability_zones" {
  description = "Availability zones used"
  value       = local.azs
}
