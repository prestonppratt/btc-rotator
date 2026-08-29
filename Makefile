.PHONY: test dev install seed

install:
	pip3.11 install -q pytest 2>&1 | tail -5
	npm install

test:
	python3.11 -m pytest brae/tests -v
	python3.11 brae/tests/test_metrics.py

dev:
	npm run dev

seed:
	python3.11 -c "import brae.metrics; print('metrics ok')"
