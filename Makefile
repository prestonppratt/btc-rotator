.PHONY: test dev install seed sec-foundation package-sec-foundation

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

sec-foundation:
	python3.11 -m brae.sec_foundation --output data/sec-edgar

package-sec-foundation:
	mkdir -p .build/sec-foundation/brae
	cp brae/__init__.py brae/sec_edgar.py brae/sec_lambda.py .build/sec-foundation/brae/
	cd .build/sec-foundation && zip -qr ../sec-foundation.zip brae
