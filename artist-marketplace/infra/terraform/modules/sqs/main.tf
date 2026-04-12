resource "aws_sqs_queue" "design_events" {
  name                       = "design-events-${var.env}"
  visibility_timeout_seconds = 30
  message_retention_seconds  = 86400

  tags = {
    Service     = "artist-marketplace"
    Environment = var.env
  }
}

output "queue_url" {
  value = aws_sqs_queue.design_events.url
}

output "queue_arn" {
  value = aws_sqs_queue.design_events.arn
}
