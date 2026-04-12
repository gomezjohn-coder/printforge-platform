.PHONY: help dev-up dev-down dev-logs build-all test-all lint-all \
       k8s-up k8s-down k8s-deploy k8s-status port-forward \
       helm-lint helm-template tf-validate smoke-test load-test validate-all

SHELL := /bin/bash
CLUSTER_NAME := printforge-local
NAMESPACE := printforge
SERVICES := product-service order-service marketplace-web artist-service search-service monolith-service
EKS_CHARTS := product-service order-service marketplace-web artist-service search-service

# ============================================================
# Help
# ============================================================

help: ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ============================================================
# Local Development (Docker Compose)
# ============================================================

dev-up: ## Start all services locally via Docker Compose
	docker-compose up -d --build
	@echo "✓ Marketplace running at http://localhost:3000"

dev-down: ## Stop all local services
	docker-compose down -v

dev-logs: ## Tail logs from all services
	docker-compose logs -f

dev-restart: ## Restart a specific service (usage: make dev-restart SVC=product-service)
	docker-compose restart $(SVC)

build-all: ## Build all Docker images
	@for svc in $(SERVICES); do \
		echo "Building $$svc..."; \
		docker build -t printforge/$$svc:local ./services/$$svc; \
	done

seed-db: ## Seed the database with sample data
	docker-compose exec product-service node src/seed.js

# ============================================================
# Kubernetes (Kind)
# ============================================================

k8s-up: ## Create Kind cluster with ingress controller and Flagger
	@echo "Creating Kind cluster..."
	kind create cluster --name $(CLUSTER_NAME) --config scripts/kind-config.yaml
	@echo "Installing NGINX Ingress Controller..."
	kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml
	@echo "Waiting for ingress controller..."
	kubectl wait --namespace ingress-nginx \
		--for=condition=ready pod \
		--selector=app.kubernetes.io/component=controller \
		--timeout=120s
	@echo "Installing Flagger..."
	kubectl apply -f https://github.com/fluxcd/flagger/releases/latest/download/flagger.yaml
	@echo "Applying cluster-level manifests..."
	kubectl apply -f k8s/namespaces/
	kubectl apply -f k8s/priority-classes/
	kubectl apply -f k8s/limit-ranges/
	kubectl apply -f k8s/resource-quotas/
	kubectl apply -f k8s/rbac/
	kubectl apply -f k8s/network-policies/
	@echo "✓ Kind cluster ready"

k8s-down: ## Destroy Kind cluster
	kind delete cluster --name $(CLUSTER_NAME)

k8s-deploy: ## Deploy all services to Kind via Helm
	@for svc in $(EKS_CHARTS); do \
		echo "Deploying $$svc..."; \
		helm upgrade --install $$svc ./helm/charts/$$svc \
			-n $(NAMESPACE) \
			-f ./helm/environments/local/values.yaml \
			--wait --timeout 120s; \
	done
	@echo "✓ All services deployed"

k8s-status: ## Show pod status in printforge namespace
	kubectl get pods -n $(NAMESPACE) -o wide
	@echo ""
	kubectl get svc -n $(NAMESPACE)
	@echo ""
	kubectl get hpa -n $(NAMESPACE)

port-forward: ## Port-forward marketplace-web to localhost:3000
	kubectl port-forward -n $(NAMESPACE) svc/marketplace-web 3000:3000

# ============================================================
# Helm
# ============================================================

helm-lint: ## Lint all Helm charts
	@for chart in helm/charts/*/; do \
		echo "Linting $$chart..."; \
		helm lint $$chart || exit 1; \
	done
	@echo "✓ All charts pass linting"

helm-template: ## Render Helm templates for inspection
	@for chart in $(EKS_CHARTS); do \
		echo "=== $$chart ==="; \
		helm template $$chart ./helm/charts/$$chart \
			-f ./helm/environments/local/values.yaml; \
	done

helm-diff: ## Show diff of what would change on deploy
	@for chart in $(EKS_CHARTS); do \
		echo "=== $$chart ==="; \
		helm diff upgrade $$chart ./helm/charts/$$chart \
			-n $(NAMESPACE) \
			-f ./helm/environments/local/values.yaml; \
	done

# ============================================================
# Terraform
# ============================================================

tf-validate: ## Validate all Terraform modules
	@for mod in terraform/modules/*/; do \
		echo "Validating $$mod..."; \
		cd $$mod && terraform init -backend=false > /dev/null 2>&1 && terraform validate && cd -; \
	done
	@echo "✓ All Terraform modules valid"

tf-fmt: ## Format all Terraform files
	terraform fmt -recursive terraform/

tf-plan: ## Run Terraform plan for staging
	cd terraform/environments/staging && terraform plan

# ============================================================
# Testing
# ============================================================

test-all: ## Run all service tests
	cd services/product-service && npm test
	cd services/order-service && npm test
	cd services/search-service && npm test
	cd services/artist-service && go test ./...
	@echo "✓ All tests passed"

lint-all: ## Run all linters
	cd services/product-service && npm run lint
	cd services/order-service && npm run lint
	cd services/marketplace-web && npm run lint
	cd services/artist-service && golangci-lint run
	@echo "✓ All linters passed"

smoke-test: ## Run smoke tests against running services
	@echo "Checking health endpoints..."
	@curl -sf http://localhost:3001/healthz > /dev/null && echo "✓ product-service healthy" || echo "✗ product-service unhealthy"
	@curl -sf http://localhost:3003/healthz > /dev/null && echo "✓ order-service healthy" || echo "✗ order-service unhealthy"
	@curl -sf http://localhost:3000/api/health > /dev/null && echo "✓ marketplace-web healthy" || echo "✗ marketplace-web unhealthy"
	@curl -sf http://localhost:8080/healthz > /dev/null && echo "✓ artist-service healthy" || echo "✗ artist-service unhealthy"
	@curl -sf http://localhost:3002/healthz > /dev/null && echo "✓ search-service healthy" || echo "✗ search-service unhealthy"
	@curl -sf http://localhost:4000/healthz > /dev/null && echo "✓ monolith-service healthy" || echo "✗ monolith-service unhealthy"

load-test: ## Run k6 baseline load test
	k6 run monitoring/k6/baseline.js

load-spike: ## Run k6 Black Friday spike test (3x load on checkout)
	k6 run monitoring/k6/spike.js

# ============================================================
# Validation (All-in-one)
# ============================================================

validate-all: helm-lint tf-validate lint-all test-all ## Run all validations
	@echo ""
	@echo "============================================"
	@echo "✓ All validations passed"
	@echo "============================================"
