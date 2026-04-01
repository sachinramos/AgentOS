.PHONY: setup dev build start db-push seed clean

setup:
	npm install
	npm run db:push

dev:
	npm run dev

build:
	npm run build

start:
	npm start

db-push:
	npm run db:push

seed:
	@echo "Register at http://localhost:5000 first, then POST /api/agentos/seed-demo"

clean:
	rm -rf node_modules dist
