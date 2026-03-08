build-image:
	docker rmi manga-image-translator || true
	docker build . --tag=manga-image-translator

run:
	docker run --gpus all -p 5003:5003 --ipc=host --rm \
		-v $(PWD)/result:/app/result \
		-v $(PWD)/models:/app/models \
		--env-file .env \
		manga-image-translator

run-no-gpu:
	docker run -p 5003:5003 --ipc=host --rm \
		-v $(PWD)/result:/app/result \
		-v $(PWD)/models:/app/models \
		--env-file .env \
		manga-image-translator \
		--host 0.0.0.0 --port 5003 --start-instance
