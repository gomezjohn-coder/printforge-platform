# ============================================================
# IRSA — IAM Roles for Service Accounts
# ============================================================
# Enables pod-level IAM permissions via Kubernetes service accounts.
# Each microservice gets only the AWS permissions it needs.
# ============================================================

# ─── OIDC Provider for IRSA ──────────────────────────────
data "tls_certificate" "eks" {
  url = aws_eks_cluster.main.identity[0].oidc[0].issuer
}

resource "aws_iam_openid_connect_provider" "eks" {
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.eks.certificates[0].sha1_fingerprint]
  url             = aws_eks_cluster.main.identity[0].oidc[0].issuer
  tags            = var.tags
}

# ─── product-service Role — S3 Read for product images ────
resource "aws_iam_role" "product_service" {
  name = "${var.cluster_name}-product-service"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = aws_iam_openid_connect_provider.eks.arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "${replace(aws_eks_cluster.main.identity[0].oidc[0].issuer, "https://", "")}:sub" = "system:serviceaccount:printforge:product-service"
          "${replace(aws_eks_cluster.main.identity[0].oidc[0].issuer, "https://", "")}:aud" = "sts.amazonaws.com"
        }
      }
    }]
  })
  tags = var.tags
}

resource "aws_iam_role_policy" "product_service_s3" {
  name = "s3-read-product-images"
  role = aws_iam_role.product_service.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["s3:GetObject", "s3:ListBucket"]
      Resource = [
        "arn:aws:s3:::${var.project_name}-${var.environment}-product-images",
        "arn:aws:s3:::${var.project_name}-${var.environment}-product-images/*"
      ]
    }]
  })
}

# ─── order-service Role — Secrets Manager + KMS + DynamoDB idempotency ────
# The order-service owns checkout, so it needs:
#   - Secrets Manager: Stripe API key, DB credentials
#   - KMS: decrypt secrets
#   - DynamoDB: idempotency keys (prevent duplicate charges on retries)
resource "aws_iam_role" "order_service" {
  name = "${var.cluster_name}-order-service"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = aws_iam_openid_connect_provider.eks.arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "${replace(aws_eks_cluster.main.identity[0].oidc[0].issuer, "https://", "")}:sub" = "system:serviceaccount:printforge:order-service"
          "${replace(aws_eks_cluster.main.identity[0].oidc[0].issuer, "https://", "")}:aud" = "sts.amazonaws.com"
        }
      }
    }]
  })
  tags = var.tags
}

resource "aws_iam_role_policy" "order_service_secrets" {
  name = "secrets-and-idempotency"
  role = aws_iam_role.order_service.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"]
        Resource = [
          "arn:aws:secretsmanager:*:*:secret:${var.project_name}/${var.environment}/order-service/*"
        ]
      },
      {
        Effect = "Allow"
        Action = ["kms:Decrypt"]
        Resource = "*"
        Condition = {
          StringEquals = {
            "kms:ViaService" = "secretsmanager.${var.aws_region}.amazonaws.com"
          }
        }
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:ConditionCheckItem"
        ]
        Resource = "arn:aws:dynamodb:*:*:table/${var.project_name}-${var.environment}-order-idempotency"
      }
    ]
  })
}

# ─── artist-service Role — S3 Write for design uploads ───
resource "aws_iam_role" "artist_service" {
  name = "${var.cluster_name}-artist-service"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = aws_iam_openid_connect_provider.eks.arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "${replace(aws_eks_cluster.main.identity[0].oidc[0].issuer, "https://", "")}:sub" = "system:serviceaccount:printforge:artist-service"
          "${replace(aws_eks_cluster.main.identity[0].oidc[0].issuer, "https://", "")}:aud" = "sts.amazonaws.com"
        }
      }
    }]
  })
  tags = var.tags
}

resource "aws_iam_role_policy" "artist_service_s3" {
  name = "s3-write-design-uploads"
  role = aws_iam_role.artist_service.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        Resource = "arn:aws:s3:::${var.project_name}-${var.environment}-design-uploads/*"
      },
      {
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = "arn:aws:s3:::${var.project_name}-${var.environment}-design-uploads"
      }
    ]
  })
}
