output "cluster_id" {
  description = "EKS cluster ID"
  value       = aws_eks_cluster.main.id
}

output "cluster_endpoint" {
  description = "EKS cluster API endpoint"
  value       = aws_eks_cluster.main.endpoint
}

output "cluster_certificate_authority" {
  description = "EKS cluster CA certificate"
  value       = aws_eks_cluster.main.certificate_authority[0].data
}

output "cluster_name" {
  description = "EKS cluster name"
  value       = aws_eks_cluster.main.name
}

output "cluster_version" {
  description = "EKS cluster version"
  value       = aws_eks_cluster.main.version
}

output "oidc_provider_arn" {
  description = "OIDC provider ARN for IRSA"
  value       = aws_iam_openid_connect_provider.eks.arn
}

output "product_service_role_arn" {
  description = "IAM role ARN for product-service service account"
  value       = aws_iam_role.product_service.arn
}

output "order_service_role_arn" {
  description = "IAM role ARN for order-service service account"
  value       = aws_iam_role.order_service.arn
}

output "artist_service_role_arn" {
  description = "IAM role ARN for artist-service service account"
  value       = aws_iam_role.artist_service.arn
}

output "node_security_group_id" {
  description = "Security group ID for EKS nodes"
  value       = aws_security_group.cluster.id
}
