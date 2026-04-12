resource "aws_ecs_cluster" "monolith" {
  name = "monolith-cluster-${var.env}"
}

resource "aws_ecs_task_definition" "monolith" {
  family                   = "monolith-service"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = var.execution_role_arn

  container_definitions = jsonencode([
    {
      name         = "monolith"
      image        = "${var.ecr_repo}:latest"
      essential    = true
      portMappings = [{ containerPort = 5000, hostPort = 5000 }]
    }
  ])
}

output "cluster_name" {
  value = aws_ecs_cluster.monolith.name
}
