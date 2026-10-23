FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY practical ./practical
COPY server ./server
COPY web ./web
RUN mkdir -p /data && chown node:node /data
USER node
ENV NODE_ENV=production DATA_DIR=/data PORT=4930 PRACTICAL_MODE=online
EXPOSE 4930
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:4930/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node","practical/server/index.mjs"]
