# Reelhaven needs nothing but Python: no dependencies to install.
FROM python:3.12-slim
WORKDIR /app
COPY server.py index.html manifest.json service-worker.js ./
COPY css ./css
COPY js ./js
COPY data ./data
COPY assets ./assets
# Hosts tell the app which port to use through $PORT. Accounts and saves go to
# RH_DATA — put it on a mounted disk (/data) so they survive restarts.
ENV HOST=0.0.0.0 PORT=8000 RH_DATA=/data/reelhaven.json PYTHONUNBUFFERED=1
EXPOSE 8000
CMD ["python", "server.py"]
