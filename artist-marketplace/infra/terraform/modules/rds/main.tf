resource "aws_db_subnet_group" "main" {
  name       = "marketplace-${var.env}"
  subnet_ids = var.subnet_ids
}

resource "aws_db_instance" "orders" {
  identifier             = "orders-${var.env}"
  engine                 = "postgres"
  engine_version         = "16.3"
  instance_class         = "db.t4g.small"
  allocated_storage      = 20
  db_name                = "orders"
  username               = var.db_username
  password               = var.db_password
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = var.security_group_ids
  skip_final_snapshot    = true
  multi_az               = true
}

output "endpoint" {
  value = aws_db_instance.orders.endpoint
}
