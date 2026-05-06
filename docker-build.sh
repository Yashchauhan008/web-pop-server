docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t yashchauhan008/web-pop-server:latest \
  --push .
