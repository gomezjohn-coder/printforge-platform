# ============================================================
# ECS Module — Fargate for Legacy Monolith
# ============================================================
# Runs the monolith-service service on ECS Fargate.
# Shows dual orchestrator management (EKS + ECS).
# See ADR-002: EKS for Microservices, ECS for Monolith
# ============================================================

terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

# ─── ECS Cluster ─────────────────────────────────────────
resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-${var.environment}-monolith"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  configuration {
    execute_command_configuration {
      logging = "OVERRIDE"
      log_configuration {
        cloud_watch_log_group_name = aws_cloudwatch_log_group.ecs.name
      }
    }
  }

  tags = var.tags
}

# ─── CloudWatch Log Group ────────────────────────────────
resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/ecs/${var.project_name}-${var.environment}/monolith-service"
  retention_in_days = 30
  tags              = var.tags
}

# ─── Task Definition ─────────────────────────────────────
resource "aws_ecs_task_definition" "monolith" {
  family                   = "${var.project_name}-monolith-service"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name      = "monolith-service"
    image     = "${var.ecr_repository_url}:${var.image_tag}"
    essential = true

    portMappings = [{
      containerPort = 4000
      protocol      = "tcp"
    }]

    healthCheck = {
      command     = ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:4000/healthz || exit 1"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 60
    }

    environment = [
      { name = "NODE_ENV", value = var.environment },
      { name = "PORT", value = "4000" },
      { name = "LOG_LEVEL", value = "info" },
    ]

    secrets = [
      { name = "DATABASE_URL", valueFrom = var.database_url_secret_arn },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "monolith"
      }
    }
  }])

  tags = var.tags
}

# ─── ECS Service ─────────────────────────────────────────
resource "aws_ecs_service" "monolith" {
  name            = "monolith-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.monolith.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  # Deployment with circuit breaker — auto-rollback on failure
  deployment_configuration {
    maximum_percent         = 200
    minimum_healthy_percent = 100

    deployment_circuit_breaker {
      enable   = true
      rollback = true
    }
  }

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.monolith.arn
    container_name   = "monolith-service"
    container_port   = 4000
  }

  # Allow Terraform to update task definition without drift
  lifecycle {
    ignore_changes = [task_definition]
  }

  tags = var.tags
}

# ─── Auto Scaling ─────────────────────────────────────────
resource "aws_appautoscaling_target" "monolith" {
  max_capacity       = var.max_count
  min_capacity       = var.desired_count
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.monolith.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "monolith_cpu" {
  name               = "${var.project_name}-monolith-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.monolith.resource_id
  scalable_dimension = aws_appautoscaling_target.monolith.scalable_dimension
  service_namespace  = aws_appautoscaling_target.monolith.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

# ─── ALB ──────────────────────────────────────────────────
resource "aws_lb" "monolith" {
  name               = "${var.project_name}-${var.environment}-monolith"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = var.public_subnet_ids

  tags = var.tags
}

resource "aws_lb_target_group" "monolith" {
  name        = "${var.project_name}-monolith-tg"
  port        = 4000
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    path                = "/healthz"
    healthy_threshold   = 3
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
  }

  tags = var.tags
}

resource "aws_lb_listener" "monolith_https" {
  load_balancer_arn = aws_lb.monolith.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.monolith.arn
  }
}

# ─── Security Groups ─────────────────────────────────────
resource "aws_security_group" "alb" {
  name_prefix = "${var.project_name}-monolith-alb-"
  vpc_id      = var.vpc_id
  description = "ALB for monolith service"

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = var.tags
}

resource "aws_security_group" "ecs_tasks" {
  name_prefix = "${var.project_name}-monolith-tasks-"
  vpc_id      = var.vpc_id
  description = "ECS tasks security group"

  ingress {
    from_port       = 4000
    to_port         = 4000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = var.tags
}

# ─── IAM Roles ────────────────────────────────────────────
resource "aws_iam_role" "ecs_execution" {
  name = "${var.project_name}-${var.environment}-ecs-execution"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "ecs_task" {
  name = "${var.project_name}-${var.environment}-ecs-task"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
  tags = var.tags
}
