output "cluster_id" { value = aws_ecs_cluster.main.id }
output "service_name" { value = aws_ecs_service.monolith.name }
output "alb_dns_name" { value = aws_lb.monolith.dns_name }
output "alb_zone_id" { value = aws_lb.monolith.zone_id }
output "task_definition_arn" { value = aws_ecs_task_definition.monolith.arn }
