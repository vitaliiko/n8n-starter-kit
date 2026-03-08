FROM mcr.microsoft.com/playwright:v1.58.1-jammy-arm64

WORKDIR /app
RUN npm init -y \
 && npm i express playwright

COPY server.js /app/server.js

EXPOSE 3000
CMD ["node", "server.js"]
